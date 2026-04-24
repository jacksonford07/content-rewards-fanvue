import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ScrapersService } from "../scrapers/scrapers.service.js";
import { resolveShortUrl } from "../scrapers/scrapers.types.js";

type EnrichedSubmission = {
  status: string;
  lockDate?: string;
  isBanned?: boolean;
};

function calcPendingEarningsCents(
  viewCount: number,
  campaign: typeof schema.campaigns.$inferSelect,
): number {
  if (viewCount < campaign.minPayoutThreshold) return 0;
  let cents = Math.round((viewCount / 1000) * campaign.rewardRatePer1kCents);
  if (
    campaign.maxPayoutPerClipCents &&
    cents > campaign.maxPayoutPerClipCents
  ) {
    cents = campaign.maxPayoutPerClipCents;
  }
  return cents;
}

function filterInboxByTab<T extends EnrichedSubmission>(
  rows: T[],
  tab?: string,
): T[] {
  const now = Date.now();
  switch (tab) {
    case "pending":
      return rows.filter((s) => s.status === "pending");
    case "approved":
      return rows.filter(
        (s) =>
          (s.status === "approved" || s.status === "auto_approved") &&
          (!s.lockDate || new Date(s.lockDate).getTime() > now),
      );
    case "verify":
      return rows.filter(
        (s) =>
          (s.status === "approved" || s.status === "auto_approved") &&
          !!s.lockDate &&
          new Date(s.lockDate).getTime() <= now,
      );
    case "rejected":
      return rows.filter((s) => s.status === "rejected" && !s.isBanned);
    case "banned":
      return rows.filter((s) => s.status === "rejected" && !!s.isBanned);
    case "paid":
      return rows.filter((s) => s.status === "paid");
    default:
      return rows;
  }
}

function filterMineByTab<T extends EnrichedSubmission>(
  rows: T[],
  tab?: string,
): T[] {
  switch (tab) {
    case "pending":
      return rows.filter((s) => s.status === "pending");
    case "approved":
      return rows.filter(
        (s) => s.status === "approved" || s.status === "auto_approved",
      );
    case "paid":
      return rows.filter((s) => s.status === "paid");
    case "rejected":
      return rows.filter((s) => s.status === "rejected" && !s.isBanned);
    case "banned":
      return rows.filter((s) => s.status === "rejected" && !!s.isBanned);
    case "all":
    default:
      return rows;
  }
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @Inject(DB) private db: Database,
    private notifications: NotificationsService,
    private scrapers: ScrapersService,
  ) {}

  async submit(
    fanId: string,
    data: { campaignId: string; postUrl: string; platform: string },
  ) {
    // Check campaign exists and is active
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, data.campaignId))
      .limit(1);

    if (!campaign) throw new NotFoundException("Campaign not found");
    if (campaign.status !== "active")
      throw new BadRequestException("Campaign is not active");

    // Check available budget
    const availableBudget =
      campaign.totalBudgetCents - campaign.budgetSpentCents;
    if (availableBudget <= 0)
      throw new BadRequestException("Campaign has no available budget");

    // Check not banned
    const [ban] = await this.db
      .select()
      .from(schema.campaignBans)
      .where(
        and(
          eq(schema.campaignBans.campaignId, data.campaignId),
          eq(schema.campaignBans.userId, fanId),
        ),
      )
      .limit(1);

    if (ban) throw new ForbiddenException("You are banned from this campaign");

    const autoApproveAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const postUrl = await resolveShortUrl(data.postUrl);

    const [submission] = await this.db
      .insert(schema.submissions)
      .values({
        campaignId: data.campaignId,
        fanId,
        postUrl,
        platform: data.platform as "tiktok" | "instagram" | "youtube",
        status: "pending",
        autoApproveAt,
      })
      .returning();

    // Kick off first scrape synchronously so the UI shows views immediately.
    // A failure here must not fail the submission — cron will retry.
    await this.initialScrape(submission!);

    // Notify creator
    await this.notifications.create({
      userId: campaign.creatorId,
      type: "new_submission",
      title: "New submission received",
      message: `A new clip was submitted to "${campaign.title}"`,
      actionUrl: "/creator/inbox?tab=pending",
    });

    return this.serializeSubmission(submission!);
  }

  private async initialScrape(
    submission: typeof schema.submissions.$inferSelect,
  ) {
    try {
      const now = new Date();
      const result = await this.scrapers.getViews(submission.postUrl);

      await this.db.insert(schema.submissionViewSnapshots).values({
        submissionId: submission.id,
        viewCount: result.viewCount ?? 0,
        available: result.available,
        capturedAt: now,
      });

      const update: Partial<typeof schema.submissions.$inferInsert> = {
        lastScrapedAt: now,
        updatedAt: now,
      };
      if (result.available && typeof result.viewCount === "number") {
        update.lastViewCount = result.viewCount;
      }
      if (result.postedAt) {
        update.postedAt = result.postedAt;
        update.lockDate = new Date(
          result.postedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
        );
      }
      if (result.platformUsername) {
        update.platformUsername = result.platformUsername;
      }

      await this.db
        .update(schema.submissions)
        .set(update)
        .where(eq(schema.submissions.id, submission.id));

      await this.recomputeCampaignReservations(submission.campaignId);
    } catch (err) {
      this.logger.error(
        `Initial scrape failed for submission ${submission.id}: ${String(err)}`,
      );
    }
  }

  /**
   * Calculates projected earnings in cents for a given view count and
   * campaign, applying min-threshold and per-clip cap (but NOT the
   * campaign's remaining budget — that's handled at final settlement).
   * Exported for use from the cron after each scrape.
   */
  calcPendingEarningsCents(
    viewCount: number,
    campaign: typeof schema.campaigns.$inferSelect,
  ): number {
    return calcPendingEarningsCents(viewCount, campaign);
  }

  /**
   * Allocate `pending_earnings_cents` across a campaign's active submissions
   * in FIFO (earliest-submitted first) order, capped by the remaining pool
   * (totalBudget - spent). Once the pool is exhausted, later submissions get
   * whatever is left and anyone below them gets 0. Total reserved + spent is
   * guaranteed to never exceed the campaign's total budget.
   */
  async recomputeCampaignReservations(campaignId: string): Promise<void> {
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);
    if (!campaign) return;

    const subs = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.campaignId, campaignId),
          inArray(schema.submissions.status, [
            "pending",
            "approved",
            "auto_approved",
          ]),
        ),
      )
      .orderBy(asc(schema.submissions.createdAt));

    let pool = Math.max(
      0,
      campaign.totalBudgetCents - campaign.budgetSpentCents,
    );
    const now = new Date();
    for (const s of subs) {
      const desired = calcPendingEarningsCents(s.lastViewCount, campaign);
      const capped = Math.min(desired, pool);
      if (capped !== s.pendingEarningsCents) {
        await this.db
          .update(schema.submissions)
          .set({ pendingEarningsCents: capped, updatedAt: now })
          .where(eq(schema.submissions.id, s.id));
      }
      pool = Math.max(0, pool - capped);
    }
  }

  /**
   * FIFO-ceiling for a given submission: the maximum pending earnings it can
   * ever reach while higher-priority (earlier) submissions keep their current
   * reservations. Used by the cron to skip wasted scrapes on submissions
   * whose share of the pool is already taken by earlier clippers.
   */
  async getReservationCeilingCents(
    submission: typeof schema.submissions.$inferSelect,
    campaign: typeof schema.campaigns.$inferSelect,
  ): Promise<number> {
    const [row] = await this.db
      .select({
        sum: sql<number>`coalesce(sum(${schema.submissions.pendingEarningsCents}), 0)::int`,
      })
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.campaignId, submission.campaignId),
          inArray(schema.submissions.status, [
            "pending",
            "approved",
            "auto_approved",
          ]),
          sql`${schema.submissions.createdAt} < ${submission.createdAt}`,
        ),
      );
    const earlierReserved = row?.sum ?? 0;
    const poolTotal = Math.max(
      0,
      campaign.totalBudgetCents - campaign.budgetSpentCents,
    );
    return Math.max(0, poolTotal - earlierReserved);
  }

  async mine(
    fanId: string,
    params?: {
      tab?: string;
      page?: number;
      limit?: number;
      campaignId?: string;
    },
  ) {
    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 20));

    const conditions = [eq(schema.submissions.fanId, fanId)];
    if (params?.campaignId) {
      conditions.push(eq(schema.submissions.campaignId, params.campaignId));
    }

    const rows = await this.db
      .select()
      .from(schema.submissions)
      .where(and(...conditions))
      .orderBy(desc(schema.submissions.createdAt));

    const enriched = await this.enrichSubmissions(rows);
    const filtered = filterMineByTab(enriched, params?.tab);

    const totalItems = filtered.length;
    const offset = (page - 1) * limit;
    const pageRows = filtered.slice(offset, offset + limit);

    return {
      data: pageRows,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    };
  }

  async mineStats(fanId: string) {
    const rows = await this.db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.fanId, fanId));

    const enriched = await this.enrichSubmissions(rows);
    return {
      all: enriched.length,
      pending: filterMineByTab(enriched, "pending").length,
      approved: filterMineByTab(enriched, "approved").length,
      paid: filterMineByTab(enriched, "paid").length,
      rejected: filterMineByTab(enriched, "rejected").length,
      banned: filterMineByTab(enriched, "banned").length,
    };
  }

  async inbox(
    creatorId: string,
    params?: {
      tab?: string;
      page?: number;
      limit?: number;
      campaignId?: string;
    },
  ) {
    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 20));

    const creatorCampaigns = await this.db
      .select({ id: schema.campaigns.id })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.creatorId, creatorId));

    const ownedIds = new Set(creatorCampaigns.map((c) => c.id));
    if (ownedIds.size === 0) {
      return {
        data: [],
        meta: { page, limit, totalItems: 0, totalPages: 1 },
      };
    }

    let campaignIds = [...ownedIds];
    if (params?.campaignId) {
      if (!ownedIds.has(params.campaignId)) {
        // Quietly return empty rather than 403 — a stale URL shouldn't leak.
        return {
          data: [],
          meta: { page, limit, totalItems: 0, totalPages: 1 },
        };
      }
      campaignIds = [params.campaignId];
    }

    const rows = await this.db
      .select()
      .from(schema.submissions)
      .where(inArray(schema.submissions.campaignId, campaignIds))
      .orderBy(desc(schema.submissions.createdAt));

    const enriched = await this.enrichSubmissions(rows);
    const filtered = filterInboxByTab(enriched, params?.tab);

    const totalItems = filtered.length;
    const offset = (page - 1) * limit;
    const pageRows = filtered.slice(offset, offset + limit);

    return {
      data: pageRows,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    };
  }

  async inboxStats(creatorId: string, campaignId?: string) {
    const creatorCampaigns = await this.db
      .select({ id: schema.campaigns.id })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.creatorId, creatorId));

    const ownedIds = new Set(creatorCampaigns.map((c) => c.id));
    const empty = {
      pending: 0,
      approved: 0,
      verify: 0,
      rejected: 0,
      banned: 0,
      paid: 0,
    };
    if (ownedIds.size === 0) return empty;

    let campaignIds = [...ownedIds];
    if (campaignId) {
      if (!ownedIds.has(campaignId)) return empty;
      campaignIds = [campaignId];
    }

    const rows = await this.db
      .select()
      .from(schema.submissions)
      .where(inArray(schema.submissions.campaignId, campaignIds));

    const enriched = await this.enrichSubmissions(rows);
    return {
      pending: filterInboxByTab(enriched, "pending").length,
      approved: filterInboxByTab(enriched, "approved").length,
      verify: filterInboxByTab(enriched, "verify").length,
      rejected: filterInboxByTab(enriched, "rejected").length,
      banned: filterInboxByTab(enriched, "banned").length,
      paid: filterInboxByTab(enriched, "paid").length,
    };
  }

  async byCampaign(campaignId: string, status?: string) {
    const conditions = [eq(schema.submissions.campaignId, campaignId)];
    if (status) {
      conditions.push(
        eq(
          schema.submissions.status,
          status as
            | "pending"
            | "approved"
            | "rejected"
            | "auto_approved"
            | "paid"
            | "paid",
        ),
      );
    }

    const rows = await this.db
      .select()
      .from(schema.submissions)
      .where(and(...conditions))
      .orderBy(desc(schema.submissions.createdAt));

    return this.enrichSubmissions(rows);
  }

  async approve(id: string, creatorId: string) {
    const submission = await this.getOwnedSubmission(id, creatorId);

    const now = new Date();
    const lockDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await this.db
      .update(schema.submissions)
      .set({
        status: "approved",
        creatorDecisionAt: now,
        verificationStartedAt: now,
        lockDate,
        updatedAt: now,
      })
      .where(eq(schema.submissions.id, id));

    // Notify clipper
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, submission.campaignId))
      .limit(1);

    await this.notifications.create({
      userId: submission.fanId,
      type: "approved",
      title: "Submission approved",
      message: `Your clip for "${campaign?.title}" was approved. 30-day view verification started.`,
      actionUrl: "/submissions?tab=approved",
    });

    return { success: true };
  }

  async reject(id: string, creatorId: string, reason: string) {
    const submission = await this.getOwnedSubmission(id, creatorId);

    await this.db
      .update(schema.submissions)
      .set({
        status: "rejected",
        rejectionReason: reason,
        pendingEarningsCents: 0,
        creatorDecisionAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.submissions.id, id));

    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, submission.campaignId))
      .limit(1);

    await this.notifications.create({
      userId: submission.fanId,
      type: "rejected",
      title: "Submission rejected",
      message: `Your clip for "${campaign?.title}" was rejected. Reason: ${reason}`,
      actionUrl: "/submissions?tab=rejected",
    });

    // Reservation freed — let the next in line take the slack.
    await this.recomputeCampaignReservations(submission.campaignId);

    return { success: true };
  }

  async ban(id: string, creatorId: string, reason: string) {
    const submission = await this.getOwnedSubmission(id, creatorId);

    // Reject the submission
    await this.db
      .update(schema.submissions)
      .set({
        status: "rejected",
        rejectionReason: reason,
        pendingEarningsCents: 0,
        creatorDecisionAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.submissions.id, id));

    // Add ban
    await this.db
      .insert(schema.campaignBans)
      .values({
        campaignId: submission.campaignId,
        userId: submission.fanId,
      })
      .onConflictDoNothing();

    await this.recomputeCampaignReservations(submission.campaignId);

    return { success: true };
  }

  async verifyViews(id: string, creatorId: string, views: number) {
    const submission = await this.getOwnedSubmission(id, creatorId);

    if (submission.status !== "approved" && submission.status !== "auto_approved")
      throw new BadRequestException("Submission is not in approved state");

    if (views == null || views < 0)
      throw new BadRequestException("Views must be a non-negative number");

    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, submission.campaignId))
      .limit(1);

    if (!campaign) throw new NotFoundException("Campaign not found");

    return this.settlePayout(submission, campaign, views);
  }

  async autoFinalizeDueSubmissions() {
    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const due = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          inArray(schema.submissions.status, ["approved", "auto_approved"]),
          sql`${schema.submissions.viewsAtDay30} IS NULL`,
        ),
      );

    let finalized = 0;
    for (const sub of due) {
      const anchor = sub.postedAt ?? sub.createdAt;
      if (anchor.getTime() + thirtyDaysMs > now.getTime()) continue;

      const [campaign] = await this.db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, sub.campaignId))
        .limit(1);
      if (!campaign) continue;

      await this.settlePayout(sub, campaign, sub.lastViewCount ?? 0);
      finalized++;
    }

    return { finalized };
  }

  private async settlePayout(
    submission: typeof schema.submissions.$inferSelect,
    campaign: typeof schema.campaigns.$inferSelect,
    views: number,
  ) {
    // Use same calc as pending earnings (threshold + per-clip cap) …
    let payoutCents = calcPendingEarningsCents(views, campaign);

    // …then cap by remaining pool AFTER subtracting other active
    // reservations (FIFO priority — earlier clippers own their share).
    const [otherReserved] = await this.db
      .select({
        sum: sql<number>`coalesce(sum(${schema.submissions.pendingEarningsCents}), 0)::int`,
      })
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.campaignId, submission.campaignId),
          inArray(schema.submissions.status, [
            "pending",
            "approved",
            "auto_approved",
          ]),
          sql`${schema.submissions.id} <> ${submission.id}`,
        ),
      );
    const availableForMe =
      campaign.totalBudgetCents -
      campaign.budgetSpentCents -
      (otherReserved?.sum ?? 0);
    if (payoutCents > availableForMe) {
      payoutCents = Math.max(availableForMe, 0);
    }

    // Update submission — clear pending earnings since they've been settled
    await this.db
      .update(schema.submissions)
      .set({
        status: "paid",
        viewsAtDay30: views,
        payoutAmountCents: payoutCents,
        pendingEarningsCents: 0,
        updatedAt: new Date(),
      })
      .where(eq(schema.submissions.id, submission.id));

    if (payoutCents > 0) {
      // Credit clipper wallet
      await this.db
        .update(schema.users)
        .set({
          walletBalanceCents: sql`${schema.users.walletBalanceCents} + ${payoutCents}`,
        })
        .where(eq(schema.users.id, submission.fanId));

      // Update campaign budget spent
      await this.db
        .update(schema.campaigns)
        .set({
          budgetSpentCents: sql`${schema.campaigns.budgetSpentCents} + ${payoutCents}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.campaigns.id, submission.campaignId));

      // Wallet transaction for clipper
      await this.db.insert(schema.walletTransactions).values({
        userId: submission.fanId,
        campaignId: submission.campaignId,
        type: "payout",
        description: `Payout for "${campaign.title}" — ${(views / 1000).toFixed(1)}K views`,
        amountCents: payoutCents,
      });

      // Campaign transaction
      await this.db.insert(schema.campaignTransactions).values({
        campaignId: submission.campaignId,
        type: "payout_release",
        description: `Payout — ${(views / 1000).toFixed(1)}K views`,
        amountCents: -payoutCents,
      });

      // Notify clipper
      await this.notifications.create({
        userId: submission.fanId,
        type: "payout_released",
        title: `Payout released: $${(payoutCents / 100).toFixed(2)}`,
        message: `Your earnings from "${campaign.title}" have been credited to your wallet.`,
        actionUrl: "/wallet",
      });
    }

    // This submission's reservation moved from pending to spent. Recompute
    // FIFO-capped reservations for the remaining active submissions so any
    // slack from rounding / per-clip caps goes to the next in line.
    await this.recomputeCampaignReservations(submission.campaignId);

    // Check if campaign budget is exhausted → mark completed
    await this.checkCampaignCompletion(submission.campaignId);

    return {
      views,
      payoutAmount: payoutCents / 100,
      status: "paid",
    };
  }

  private async checkCampaignCompletion(campaignId: string) {
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);

    if (!campaign || campaign.status !== "active") return;

    const available =
      campaign.totalBudgetCents - campaign.budgetSpentCents;
    if (available <= 0) {
      await this.db
        .update(schema.campaigns)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(schema.campaigns.id, campaignId));
    }
  }

  async devFastForwardLockDate(id: string, creatorId: string) {
    const submission = await this.getOwnedSubmission(id, creatorId);

    if (
      submission.status !== "approved" &&
      submission.status !== "auto_approved"
    ) {
      throw new BadRequestException(
        "Submission is not in approved state",
      );
    }

    const now = new Date();
    await this.db
      .update(schema.submissions)
      .set({ lockDate: now, updatedAt: now })
      .where(eq(schema.submissions.id, id));

    return { lockDate: now.toISOString() };
  }

  private async getOwnedSubmission(submissionId: string, creatorId: string) {
    const [submission] = await this.db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submissionId))
      .limit(1);

    if (!submission) throw new NotFoundException("Submission not found");

    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, submission.campaignId))
      .limit(1);

    if (!campaign || campaign.creatorId !== creatorId)
      throw new ForbiddenException();

    return submission;
  }

  private async enrichSubmissions(
    rows: (typeof schema.submissions.$inferSelect)[],
  ) {
    if (rows.length === 0) return [];

    const campaignIds = [...new Set(rows.map((r) => r.campaignId))];
    const fanIds = [...new Set(rows.map((r) => r.fanId))];

    const campaignsList = await this.db
      .select()
      .from(schema.campaigns)
      .where(inArray(schema.campaigns.id, campaignIds));

    const fans = await this.db
      .select()
      .from(schema.users)
      .where(inArray(schema.users.id, fanIds));

    const creatorIds = [
      ...new Set(campaignsList.map((c) => c.creatorId)),
    ];
    const creators =
      creatorIds.length > 0
        ? await this.db
            .select()
            .from(schema.users)
            .where(inArray(schema.users.id, creatorIds))
        : [];

    const bans =
      campaignIds.length > 0 && fanIds.length > 0
        ? await this.db
            .select()
            .from(schema.campaignBans)
            .where(
              and(
                inArray(schema.campaignBans.campaignId, campaignIds),
                inArray(schema.campaignBans.userId, fanIds),
              ),
            )
        : [];
    const banTimeMap = new Map<string, Date>(
      bans.map((b) => [`${b.campaignId}:${b.userId}`, b.createdAt]),
    );

    const campaignsMap = new Map(campaignsList.map((c) => [c.id, c]));
    const fansMap = new Map(fans.map((f) => [f.id, f]));
    const creatorsMap = new Map(creators.map((c) => [c.id, c]));

    return rows.map((s) => {
      const campaign = campaignsMap.get(s.campaignId);
      const fan = fansMap.get(s.fanId);
      const creator = campaign
        ? creatorsMap.get(campaign.creatorId)
        : undefined;

      // A submission is "banned" only if it was the submission that triggered
      // the ban. Heuristic: rejected submission whose decision was made within
      // a short window of the ban's createdAt. Otherwise the user may be
      // banned now, but this earlier submission was a normal rejection or
      // paid/approved before the ban.
      const banTime = banTimeMap.get(`${s.campaignId}:${s.fanId}`);
      const isBanned =
        banTime !== undefined &&
        s.status === "rejected" &&
        s.creatorDecisionAt !== null &&
        Math.abs(banTime.getTime() - s.creatorDecisionAt.getTime()) < 10_000;

      return {
        id: s.id,
        campaignId: s.campaignId,
        campaignTitle: campaign?.title ?? "",
        campaignCreator: creator?.displayName ?? "",
        rewardRatePer1k: campaign ? campaign.rewardRatePer1kCents / 100 : 0,
        maxPayoutPerClip: campaign?.maxPayoutPerClipCents ? campaign.maxPayoutPerClipCents / 100 : undefined,
        minPayoutThreshold: campaign?.minPayoutThreshold ?? 0,
        campaignBudgetRemaining: campaign
          ? Math.max(
              (campaign.totalBudgetCents - campaign.budgetSpentCents) / 100,
              0,
            )
          : 0,
        fanId: s.fanId,
        fanName: fan?.displayName ?? "",
        fanHandle: fan?.handle ?? "",
        fanAvatarUrl: fan?.avatarUrl ?? "",
        fanFollowers: 0,
        postUrl: s.postUrl,
        thumbnailUrl: campaign?.sourceThumbnailUrl ?? "",
        platform: s.platform,
        submittedAt: s.createdAt.toISOString(),
        status: s.status,
        viewsAtDay30: s.viewsAtDay30,
        payoutAmount: s.payoutAmountCents ? s.payoutAmountCents / 100 : undefined,
        creatorDecisionAt: s.creatorDecisionAt?.toISOString(),
        rejectionReason: s.rejectionReason,
        isBanned,
        verificationStartedAt: s.verificationStartedAt?.toISOString(),
        autoApproveAt: s.autoApproveAt?.toISOString(),
        lockDate: s.lockDate?.toISOString(),
        lastViewCount: s.lastViewCount ?? 0,
        lastScrapedAt: s.lastScrapedAt?.toISOString(),
        postedAt: s.postedAt?.toISOString(),
        postDeletedAt: s.postDeletedAt?.toISOString(),
        platformUsername: s.platformUsername ?? undefined,
        pendingEarnings: s.pendingEarningsCents
          ? s.pendingEarningsCents / 100
          : 0,
      };
    });
  }

  async getSnapshots(submissionId: string, userId: string) {
    const [submission] = await this.db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submissionId))
      .limit(1);

    if (!submission) throw new NotFoundException("Submission not found");

    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, submission.campaignId))
      .limit(1);

    const isFan = submission.fanId === userId;
    const isCreator = campaign?.creatorId === userId;
    if (!isFan && !isCreator) throw new ForbiddenException();

    const snapshots = await this.db
      .select()
      .from(schema.submissionViewSnapshots)
      .where(eq(schema.submissionViewSnapshots.submissionId, submissionId))
      .orderBy(schema.submissionViewSnapshots.capturedAt);

    return snapshots.map((s) => ({
      capturedAt: s.capturedAt.toISOString(),
      viewCount: s.viewCount,
      available: s.available,
    }));
  }

  private serializeSubmission(s: typeof schema.submissions.$inferSelect) {
    return {
      id: s.id,
      campaignId: s.campaignId,
      postUrl: s.postUrl,
      platform: s.platform,
      status: s.status,
      autoApproveAt: s.autoApproveAt?.toISOString(),
      createdAt: s.createdAt.toISOString(),
    };
  }
}
