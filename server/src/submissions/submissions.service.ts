import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";
import { AiVerificationService } from "../ai-verification/ai-verification.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ScrapersService } from "../scrapers/scrapers.service.js";
import { resolveShortUrl } from "../scrapers/scrapers.types.js";
import { TrustService } from "../trust/trust.service.js";
import { FanvueTrackingLinksService } from "../fanvue/fanvue-tracking-links.service.js";

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
    case "ready_to_pay":
      return rows.filter((s) => s.status === "ready_to_pay");
    case "paid":
      return rows.filter(
        (s) => s.status === "paid" || s.status === "paid_off_platform",
      );
    case "disputed":
      return rows.filter((s) => s.status === "disputed");
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
      return rows.filter(
        (s) => s.status === "paid" || s.status === "paid_off_platform",
      );
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
    private aiVerification: AiVerificationService,
    private trust: TrustService,
    private fanvueLinks: FanvueTrackingLinksService,
  ) {}

  /**
   * Per-subscriber apply flow (M4.2). Clipper joins a per-sub campaign without
   * a clip artefact — they get a tracking link instead. Auto mode mints the
   * link immediately and lands at `approved`; manual mode parks at `pending`
   * with a 24h auto-reject deadline (cron flips it on timeout).
   *
   * Distinct entrypoint from `submit` so the per-views path is untouched.
   */
  async apply(
    fanId: string,
    campaignId: string,
    opts?: { platform?: "tiktok" | "instagram" | "youtube" },
  ) {
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);
    if (!campaign) throw new NotFoundException("Campaign not found");
    if (campaign.payoutType !== "per_subscriber") {
      throw new BadRequestException(
        "This campaign uses per-views payouts. Submit a clip URL via /submissions instead.",
      );
    }
    if (campaign.status !== "active")
      throw new BadRequestException("Campaign is not active");

    const availableBudget =
      campaign.totalBudgetCents - campaign.budgetSpentCents;
    if (availableBudget <= 0)
      throw new BadRequestException("Campaign has no available budget");

    if (campaign.endsAt && campaign.endsAt.getTime() <= Date.now()) {
      throw new BadRequestException("This campaign has ended");
    }

    // One application per clipper per campaign — re-applying returns the
    // existing submission so the UI can show the link/state idempotently.
    const [existing] = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.campaignId, campaignId),
          eq(schema.submissions.fanId, fanId),
        ),
      )
      .limit(1);
    if (existing) {
      return this.serializeApplication(existing);
    }

    const [ban] = await this.db
      .select()
      .from(schema.campaignBans)
      .where(
        and(
          eq(schema.campaignBans.campaignId, campaignId),
          eq(schema.campaignBans.userId, fanId),
        ),
      )
      .limit(1);
    if (ban) throw new ForbiddenException("You are banned from this campaign");

    if (campaign.acceptedPayoutMethods.length > 0) {
      const clipperMethods = await this.db
        .select({ method: schema.clipperPayoutMethods.method })
        .from(schema.clipperPayoutMethods)
        .where(eq(schema.clipperPayoutMethods.userId, fanId));
      const clipperSet = new Set(clipperMethods.map((m) => m.method));
      const overlap = campaign.acceptedPayoutMethods.some((m) =>
        clipperSet.has(m),
      );
      if (!overlap) {
        throw new BadRequestException(
          `This creator pays in ${campaign.acceptedPayoutMethods.join(", ")}. Add one of these to your payout settings to apply.`,
        );
      }
    }

    const isAuto = campaign.applicationMode === "auto";
    const now = new Date();
    // D3 — auto_approve_at is overloaded: per-sub manual = auto-reject at 24h.
    const autoApproveAt = isAuto
      ? null
      : new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [submission] = await this.db
      .insert(schema.submissions)
      .values({
        campaignId,
        fanId,
        postUrl: null,
        platform: opts?.platform ?? null,
        status: isAuto ? "approved" : "pending",
        creatorDecisionAt: isAuto ? now : null,
        verificationStartedAt: isAuto ? now : null,
        autoApproveAt,
      })
      .returning();

    if (isAuto) {
      await this.tryMintTrackingLink(submission!, campaign);
    }

    await this.notifications.create({
      userId: campaign.creatorId,
      type: "new_submission",
      title: isAuto ? "New clipper joined" : "New application to review",
      message: isAuto
        ? `A clipper joined "${campaign.title}" and is now accruing.`
        : `A clipper applied to "${campaign.title}". You have 24h to approve or deny.`,
      actionUrl: isAuto
        ? "/creator/inbox?tab=approved"
        : "/creator/inbox?tab=pending",
    });

    // Re-read so we surface the minted link slug to the clipper.
    const [fresh] = await this.db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submission!.id))
      .limit(1);
    return this.serializeApplication(fresh!);
  }

  private serializeApplication(
    s: typeof schema.submissions.$inferSelect,
  ) {
    return {
      id: s.id,
      campaignId: s.campaignId,
      status: s.status,
      autoApproveAt: s.autoApproveAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      trackingLinkUuid: s.trackingLinkUuid,
      trackingLinkSlug: s.trackingLinkSlug,
      trackingLinkUrl: s.trackingLinkSlug
        ? this.fanvueLinks.resolveTrackingUrl(s.trackingLinkSlug)
        : null,
      lastAcquiredSubs: s.lastAcquiredSubs,
      lastClicks: s.lastClicks ?? 0,
      pendingEarnings: s.pendingEarningsCents
        ? s.pendingEarningsCents / 100
        : 0,
    };
  }

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

    // M2.3 — payout-method overlap gate. Clipper must have at least one
    // method that the campaign accepts; otherwise day-30 has nothing to
    // settle on. Defence-in-depth — frontend also gates the submit button.
    if (campaign.acceptedPayoutMethods.length > 0) {
      const clipperMethods = await this.db
        .select({ method: schema.clipperPayoutMethods.method })
        .from(schema.clipperPayoutMethods)
        .where(eq(schema.clipperPayoutMethods.userId, fanId));
      const clipperSet = new Set(clipperMethods.map((m) => m.method));
      const overlap = campaign.acceptedPayoutMethods.some((m) =>
        clipperSet.has(m),
      );
      if (!overlap) {
        throw new BadRequestException(
          `This creator pays in ${campaign.acceptedPayoutMethods.join(", ")}. Add one of these to your payout settings to submit.`,
        );
      }
    }

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

    // AI content review runs in the background — it can take 10–20s once we
    // pull the video and ask Claude. We don't block the response; the
    // creator will see the verdict in the inbox as soon as it lands.
    void this.runAiVerification(submission!.id, submission!.postUrl!, campaign);

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
    if (!submission.postUrl) return; // per-sub apply flow has no clip to scrape
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

      // Feed the scrape into the campaign-wide accrual so this fresh
      // submission takes its pro-rata share of whatever pool is left.
      if (result.available && typeof result.viewCount === "number") {
        await this.applyCampaignAccrual(submission.campaignId, [
          { submissionId: submission.id, newViewCount: result.viewCount },
        ]);
      }
    } catch (err) {
      this.logger.error(
        `Initial scrape failed for submission ${submission.id}: ${String(err)}`,
      );
    }
  }

  private async runAiVerification(
    submissionId: string,
    postUrl: string,
    campaign: typeof schema.campaigns.$inferSelect,
  ): Promise<void> {
    try {
      const outcome = await this.aiVerification.verify({
        clipUrl: postUrl,
        campaign: {
          id: campaign.id,
          title: campaign.title,
          description: campaign.description,
          requirementsText: campaign.requirementsText,
          sourceContentUrl: campaign.sourceContentUrl,
          sourceThumbnailUrl: campaign.sourceThumbnailUrl,
        },
      });
      if (!outcome) return; // Service is disabled or hit a transient issue.

      await this.db
        .update(schema.submissions)
        .set({
          aiReviewResult: outcome.result,
          aiNotes: outcome.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.submissions.id, submissionId));
    } catch (err) {
      this.logger.error(
        `AI verification failed for submission ${submissionId}: ${String(err)}`,
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
   * Time-window accrual: takes the new view counts each cron cycle and grows
   * each submission's `pending_earnings_cents` by its *delta earnings* (what
   * it would have added since last scrape). When the sum of deltas across
   * the campaign exceeds the remaining pool (`totalBudget − spent − already
   * accrued`), every growing submission gets its share cut proportionally to
   * how much it grew this window. Nobody is "first in line" — clippers who
   * happen to rack up views in the same window miss out together.
   *
   * Pass `scrapes` — one entry per submission whose `last_view_count` changed
   * this window. The new view counts are written here along with the accrual.
   */
  async applyCampaignAccrual(
    campaignId: string,
    scrapes: { submissionId: string; newViewCount: number }[],
  ): Promise<void> {
    if (scrapes.length === 0) return;
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);
    if (!campaign) return;

    const activeSubs = await this.db
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
      );

    // Remaining pool capacity = total budget minus what's already been paid
    // AND already accrued across all active submissions. Capacity shrinks as
    // deltas get applied.
    const alreadyAccrued = activeSubs.reduce(
      (sum, s) => sum + s.pendingEarningsCents,
      0,
    );
    let remainingPool = Math.max(
      0,
      campaign.totalBudgetCents - campaign.budgetSpentCents - alreadyAccrued,
    );

    const scrapeMap = new Map(scrapes.map((s) => [s.submissionId, s]));
    // Compute each growing sub's desired delta (how much earnings it *would*
    // add if the pool were infinite).
    type Growth = {
      sub: typeof schema.submissions.$inferSelect;
      newViews: number;
      delta: number;
    };
    const growths: Growth[] = [];
    for (const sub of activeSubs) {
      const scrape = scrapeMap.get(sub.id);
      if (!scrape) continue;
      const theoretical = calcPendingEarningsCents(
        scrape.newViewCount,
        campaign,
      );
      const delta = Math.max(0, theoretical - sub.pendingEarningsCents);
      if (delta === 0) continue;
      growths.push({ sub, newViews: scrape.newViewCount, delta });
    }

    const totalDelta = growths.reduce((sum, g) => sum + g.delta, 0);
    const now = new Date();

    // Apply pro-rata cut if the pool can't cover everyone this window.
    for (const g of growths) {
      let allocated = g.delta;
      if (totalDelta > remainingPool) {
        // Integer-safe proportional split (floor avoids overshooting pool).
        allocated = Math.floor((g.delta * remainingPool) / totalDelta);
      }
      await this.db
        .update(schema.submissions)
        .set({
          pendingEarningsCents: g.sub.pendingEarningsCents + allocated,
          lastViewCount: g.newViews,
          updatedAt: now,
        })
        .where(eq(schema.submissions.id, g.sub.id));
    }

    // Write view counts for non-growing subs too (so snapshots match).
    for (const sub of activeSubs) {
      const scrape = scrapeMap.get(sub.id);
      if (!scrape) continue;
      if (growths.find((g) => g.sub.id === sub.id)) continue;
      if (scrape.newViewCount !== sub.lastViewCount) {
        await this.db
          .update(schema.submissions)
          .set({ lastViewCount: scrape.newViewCount, updatedAt: now })
          .where(eq(schema.submissions.id, sub.id));
      }
    }
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
      ready_to_pay: 0,
      rejected: 0,
      banned: 0,
      paid: 0,
      disputed: 0,
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
      ready_to_pay: filterInboxByTab(enriched, "ready_to_pay").length,
      rejected: filterInboxByTab(enriched, "rejected").length,
      banned: filterInboxByTab(enriched, "banned").length,
      paid: filterInboxByTab(enriched, "paid").length,
      disputed: filterInboxByTab(enriched, "disputed").length,
    };
  }

  // ── Off-platform payout (M2.4) ─────────────────────────────────────────

  async getPayoutContext(submissionId: string, creatorId: string) {
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
    if (!campaign) throw new NotFoundException("Campaign not found");
    if (campaign.creatorId !== creatorId) throw new ForbiddenException();

    const [clipper] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, submission.fanId))
      .limit(1);

    const clipperMethods = await this.db
      .select()
      .from(schema.clipperPayoutMethods)
      .where(eq(schema.clipperPayoutMethods.userId, submission.fanId));

    const overlap = campaign.acceptedPayoutMethods.filter((m) =>
      clipperMethods.some((cm) => cm.method === m),
    );

    return {
      submission: {
        id: submission.id,
        status: submission.status,
        payoutAmountCents: submission.payoutAmountCents ?? 0,
      },
      campaign: {
        id: campaign.id,
        title: campaign.title,
        acceptedPayoutMethods: campaign.acceptedPayoutMethods,
      },
      clipper: {
        id: clipper?.id,
        displayName: clipper?.displayName ?? "",
        handle: clipper?.handle ?? "",
        contactChannel: clipper?.contactChannel ?? null,
        contactValue: clipper?.contactValue ?? null,
      },
      // Methods both sides have agreed to. Pre-fill from this list.
      overlapMethods: overlap,
      clipperSavedMethods: clipperMethods.map((cm) => ({
        method: cm.method,
        value: cm.value,
      })),
    };
  }

  async markPaid(
    submissionId: string,
    creatorId: string,
    body: {
      method: schema.PayoutMethod;
      value: string;
      reference?: string;
      txHash?: string;
    },
  ) {
    const [submission] = await this.db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submissionId))
      .limit(1);
    if (!submission) throw new NotFoundException("Submission not found");
    if (submission.status !== "ready_to_pay") {
      throw new BadRequestException(
        `Can only mark paid when submission is in 'ready_to_pay' state (currently '${submission.status}')`,
      );
    }

    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, submission.campaignId))
      .limit(1);
    if (!campaign) throw new NotFoundException("Campaign not found");
    if (campaign.creatorId !== creatorId) throw new ForbiddenException();

    if (
      campaign.acceptedPayoutMethods.length > 0 &&
      !campaign.acceptedPayoutMethods.includes(body.method)
    ) {
      throw new BadRequestException(
        `Method '${body.method}' is not in this campaign's accepted methods`,
      );
    }
    if (!body.value || !body.value.trim()) {
      throw new BadRequestException("Recipient value required");
    }

    // Idempotent: if a payout_event already exists for this submission,
    // return it rather than creating a second one.
    const [existing] = await this.db
      .select()
      .from(schema.payoutEvents)
      .where(eq(schema.payoutEvents.submissionId, submissionId))
      .limit(1);
    if (existing) {
      return { event: existing, status: submission.status, idempotent: true };
    }

    const [event] = await this.db
      .insert(schema.payoutEvents)
      .values({
        submissionId,
        creatorId,
        clipperId: submission.fanId,
        method: body.method,
        valueSnapshot: body.value.trim(),
        amountCents: submission.payoutAmountCents ?? 0,
        reference: body.reference?.trim() || null,
        txHash: body.txHash?.trim() || null,
      })
      .returning();

    await this.db
      .update(schema.submissions)
      .set({ status: "paid_off_platform", updatedAt: new Date() })
      .where(eq(schema.submissions.id, submissionId));

    // Notify the clipper that the creator has marked them paid. M3.5 will
    // turn this into the "Did you receive payment?" confirmation flow.
    await this.notifications.create({
      userId: submission.fanId,
      type: "payout_released",
      title: `Marked paid: $${((submission.payoutAmountCents ?? 0) / 100).toFixed(2)}`,
      message: `${campaign.title}'s creator marked your payout sent via ${body.method}. Confirm receipt or raise a dispute from your submissions page.`,
      actionUrl: "/submissions",
    });

    return { event, status: "paid_off_platform" };
  }

  async confirmPayout(submissionId: string, clipperId: string) {
    const [event] = await this.db
      .select()
      .from(schema.payoutEvents)
      .where(eq(schema.payoutEvents.submissionId, submissionId))
      .limit(1);
    if (!event) throw new NotFoundException("Payout event not found");
    if (event.clipperId !== clipperId) throw new ForbiddenException();
    if (event.confirmedAt) {
      return { event, idempotent: true };
    }
    if (event.disputedAt) {
      throw new BadRequestException(
        "Cannot confirm a disputed payout. Withdraw the dispute first.",
      );
    }
    await this.db
      .update(schema.payoutEvents)
      .set({ confirmedAt: new Date() })
      .where(eq(schema.payoutEvents.id, event.id));
    return { ...event, confirmedAt: new Date() };
  }

  async disputePayout(
    submissionId: string,
    clipperId: string,
    reason?: string,
  ) {
    const [event] = await this.db
      .select()
      .from(schema.payoutEvents)
      .where(eq(schema.payoutEvents.submissionId, submissionId))
      .limit(1);
    if (!event) throw new NotFoundException("Payout event not found");
    if (event.clipperId !== clipperId) throw new ForbiddenException();
    if (event.confirmedAt) {
      throw new BadRequestException(
        "Cannot dispute a payout you already confirmed.",
      );
    }
    if (event.disputedAt) {
      return { event, idempotent: true };
    }
    await this.db
      .update(schema.payoutEvents)
      .set({ disputedAt: new Date() })
      .where(eq(schema.payoutEvents.id, event.id));
    // Move submission status to disputed so it surfaces in the creator's
    // Disputed tab + the admin queue (M3.6).
    await this.db
      .update(schema.submissions)
      .set({ status: "disputed", updatedAt: new Date() })
      .where(eq(schema.submissions.id, submissionId));
    // Notify the creator. No Slack webhook (CC1 D5 / M3.6 D5).
    const reasonNote = reason?.trim() ? `\n\nReason: ${reason.trim()}` : "";
    await this.notifications.create({
      userId: event.creatorId,
      type: "payout_released",
      title: "Payout disputed",
      message: `A clipper disputed a payout you marked sent. Review in the Disputed tab.${reasonNote}`,
      actionUrl: "/creator/inbox?tab=disputed",
    });
    return { ...event, disputedAt: new Date() };
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
            | "paid_off_platform"
            | "ready_to_pay"
            | "disputed"
            | "flagged",
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

    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, submission.campaignId))
      .limit(1);

    const now = new Date();
    const isPerSub = campaign?.payoutType === "per_subscriber";
    // Per-sub has no day-30 lock — accrual stops at campaign endsAt or when
    // the budget-cap cron flips the campaign early.
    const lockDate = isPerSub
      ? null
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await this.db
      .update(schema.submissions)
      .set({
        status: "approved",
        creatorDecisionAt: now,
        verificationStartedAt: now,
        lockDate,
        autoApproveAt: null,
        updatedAt: now,
      })
      .where(eq(schema.submissions.id, id));

    // M4.3 / M4.2 — mint Fanvue tracking link on approve for per-sub campaigns.
    // Idempotent: re-approving a submission that already has a link is a no-op.
    // For auto-mode applications the link was minted on apply; this branch
    // covers manual-mode approvals and per-views→per-sub edge cases.
    if (campaign && isPerSub && !submission.trackingLinkUuid) {
      await this.tryMintTrackingLink(submission, campaign);
    }

    await this.notifications.create({
      userId: submission.fanId,
      type: "approved",
      title: isPerSub ? "Application approved" : "Submission approved",
      message: isPerSub
        ? `You're in on "${campaign?.title}". Your tracking link is ready to share.`
        : `Your clip for "${campaign?.title}" was approved. 30-day view verification started.`,
      actionUrl: isPerSub ? "/submissions" : "/submissions?tab=approved",
    });

    return { success: true };
  }

  private async tryMintTrackingLink(
    submission: typeof schema.submissions.$inferSelect,
    campaign: typeof schema.campaigns.$inferSelect,
  ) {
    try {
      const [creator] = await this.db
        .select({
          accessToken: schema.users.fanvueAccessToken,
          scopes: schema.users.fanvueScopes,
        })
        .from(schema.users)
        .where(eq(schema.users.id, campaign.creatorId))
        .limit(1);
      if (!creator?.accessToken) {
        this.logger.warn(
          `Skipping tracking-link mint for submission ${submission.id}: creator has no Fanvue token`,
        );
        return;
      }
      if (!creator.scopes.includes("write:tracking_links")) {
        this.logger.warn(
          `Skipping tracking-link mint for submission ${submission.id}: creator missing write:tracking_links scope`,
        );
        return;
      }
      const [clipper] = await this.db
        .select({ handle: schema.users.handle })
        .from(schema.users)
        .where(eq(schema.users.id, submission.fanId))
        .limit(1);
      // v1.2 M2.7 — naming convention `<campaign> Clipper N` so creators
      // can identify links in their Fanvue dashboard. N = current count of
      // approved per-sub submissions on this campaign + 1 (the one we're
      // about to mint). Excludes the submission being minted from the
      // count to avoid double-incrementing if we re-enter via retry.
      const [{ count } = { count: 0 }] = await this.db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(schema.submissions)
        .where(
          and(
            eq(schema.submissions.campaignId, campaign.id),
            inArray(schema.submissions.status, [
              "approved",
              "auto_approved",
              "ready_to_pay",
              "paid_off_platform",
              "disputed",
            ]),
            sql`${schema.submissions.id} <> ${submission.id}`,
          ),
        );
      const ordinal = (count ?? 0) + 1;
      const handle = clipper?.handle ?? "clipper";
      const link = await this.fanvueLinks.createLink({
        accessToken: creator.accessToken,
        name: `${campaign.title} · Clipper ${ordinal} (@${handle})`,
        // Per-sub apply flow may have no platform yet — fall back to "other".
        platform:
          (submission.platform as "tiktok" | "instagram" | "youtube" | null) ??
          "other",
      });
      await this.db
        .update(schema.submissions)
        .set({
          trackingLinkUuid: link.uuid,
          trackingLinkSlug: link.linkUrl,
        })
        .where(eq(schema.submissions.id, submission.id));
      this.logger.log(
        `Minted tracking link ${link.uuid} (${link.linkUrl}) for submission ${submission.id}`,
      );
    } catch (err) {
      this.logger.error(
        `Tracking link mint failed for submission ${submission.id}: ${err}`,
      );
      // Swallow — approval flow must succeed even if Fanvue is rate-limited.
    }
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

    // Accrual freed — next cron window will see a larger pool automatically.
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

    // M4.2 D6 — banning a per-sub clipper revokes their tracking link so
    // attribution stops accruing. Best-effort: ban must succeed even if
    // Fanvue is rate-limited or the token was rotated.
    if (submission.trackingLinkUuid) {
      try {
        const [creator] = await this.db
          .select({ accessToken: schema.users.fanvueAccessToken })
          .from(schema.users)
          .where(eq(schema.users.id, creatorId))
          .limit(1);
        if (creator?.accessToken) {
          await this.fanvueLinks.deleteLink({
            accessToken: creator.accessToken,
            uuid: submission.trackingLinkUuid,
          });
        }
      } catch (err) {
        this.logger.error(
          `Failed to revoke tracking link ${submission.trackingLinkUuid} on ban: ${err}`,
        );
      }
    }

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
    // Run one last accrual window so day-30 earnings reflect the final view
    // count (subject to the campaign pool like every other window).
    if (views !== submission.lastViewCount) {
      await this.applyCampaignAccrual(submission.campaignId, [
        { submissionId: submission.id, newViewCount: views },
      ]);
    }

    // Re-read the now-up-to-date accrued amount.
    const [fresh] = await this.db
      .select({ pending: schema.submissions.pendingEarningsCents })
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submission.id))
      .limit(1);
    const payoutCents = fresh?.pending ?? 0;

    // v1.1: payouts move off-platform. Day-30 lock flips the submission
    // to 'ready_to_pay' and surfaces the accrued amount to the creator,
    // who marks it paid via the M2 mark-paid flow once they've sent funds
    // out-of-band. No in-app wallet credit, no escrow ledger writes.
    await this.db
      .update(schema.submissions)
      .set({
        status: "ready_to_pay",
        viewsAtDay30: views,
        payoutAmountCents: payoutCents,
        updatedAt: new Date(),
      })
      .where(eq(schema.submissions.id, submission.id));

    if (payoutCents > 0) {
      // Track committed budget so the campaign-level "spent" view stays
      // accurate. Once M2 ships the actual mark-paid flow, this column
      // moves to track confirmed off-platform payouts only; for now it
      // tracks day-30 commitments.
      await this.db
        .update(schema.campaigns)
        .set({
          budgetSpentCents: sql`${schema.campaigns.budgetSpentCents} + ${payoutCents}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.campaigns.id, submission.campaignId));

      await this.notifications.create({
        userId: submission.fanId,
        type: "payout_released",
        title: `Ready to pay: $${(payoutCents / 100).toFixed(2)}`,
        message: `Your 30-day window on "${campaign.title}" has closed. ${
          campaign.title
        }'s creator will pay you $${(payoutCents / 100).toFixed(
          2,
        )} off-platform.`,
        actionUrl: "/submissions",
      });
    }

    // Check if campaign budget is exhausted → mark completed
    await this.checkCampaignCompletion(submission.campaignId);

    return {
      views,
      payoutAmount: payoutCents / 100,
      status: "ready_to_pay",
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

    // M3.5: surface payout-event confirmation status alongside the
    // submission so the clipper UI knows whether to show the
    // confirm/dispute prompt or a "Confirmed" / "Under review" badge.
    const submissionIds = rows.map((r) => r.id);
    const payoutEvents =
      submissionIds.length > 0
        ? await this.db
            .select()
            .from(schema.payoutEvents)
            .where(inArray(schema.payoutEvents.submissionId, submissionIds))
        : [];
    const payoutEventsMap = new Map(
      payoutEvents.map((e) => [e.submissionId, e]),
    );

    // M3.7 — clipper trust score per row for the creator inbox.
    const clipperTrustMap = await this.trust.getTrustScoresByIds(fanIds);

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
        aiReviewResult: s.aiReviewResult ?? undefined,
        aiNotes: s.aiNotes ?? undefined,
        payoutEvent: (() => {
          const e = payoutEventsMap.get(s.id);
          if (!e) return null;
          return {
            id: e.id,
            method: e.method,
            amountCents: e.amountCents,
            createdAt: e.createdAt.toISOString(),
            confirmedAt: e.confirmedAt?.toISOString() ?? null,
            disputedAt: e.disputedAt?.toISOString() ?? null,
            disputeResolution: e.disputeResolution,
            txHash: e.txHash,
          };
        })(),
        fanTrust: (() => {
          const t = clipperTrustMap.get(s.fanId);
          if (!t) return null;
          return {
            ninetyDay: t.windows.ninetyDay,
            allTime: t.windows.allTime,
            lastPayoutAt: t.lastPayoutAt,
          };
        })(),
        trackingLinkUuid: s.trackingLinkUuid,
        trackingLinkSlug: s.trackingLinkSlug,
        trackingLinkUrl: s.trackingLinkSlug
          ? this.fanvueLinks.resolveTrackingUrl(s.trackingLinkSlug)
          : null,
        lastAcquiredSubs: s.lastAcquiredSubs ?? 0,
        lastClicks: s.lastClicks ?? 0,
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
