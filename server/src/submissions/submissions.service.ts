import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";
import { NotificationsService } from "../notifications/notifications.service.js";

type EnrichedSubmission = {
  status: string;
  lockDate?: string;
  isBanned?: boolean;
};

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
  constructor(
    @Inject(DB) private db: Database,
    private notifications: NotificationsService,
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

    const [submission] = await this.db
      .insert(schema.submissions)
      .values({
        campaignId: data.campaignId,
        fanId,
        postUrl: data.postUrl,
        platform: data.platform as "tiktok" | "instagram" | "youtube",
        status: "pending",
        autoApproveAt,
      })
      .returning();

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
    params?: { tab?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 20));

    const creatorCampaigns = await this.db
      .select({ id: schema.campaigns.id })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.creatorId, creatorId));

    const campaignIds = creatorCampaigns.map((c) => c.id);
    if (campaignIds.length === 0) {
      return {
        data: [],
        meta: { page, limit, totalItems: 0, totalPages: 1 },
      };
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

  async inboxStats(creatorId: string) {
    const creatorCampaigns = await this.db
      .select({ id: schema.campaigns.id })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.creatorId, creatorId));

    const campaignIds = creatorCampaigns.map((c) => c.id);
    if (campaignIds.length === 0) {
      return { pending: 0, approved: 0, verify: 0, rejected: 0, banned: 0 };
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

    // Calculate payout: (views / 1000) * rate
    let payoutCents = Math.round(
      (views / 1000) * campaign.rewardRatePer1kCents,
    );

    // Check min threshold
    if (views < campaign.minPayoutThreshold) {
      payoutCents = 0;
    }

    // Cap by maxPayoutPerClip
    if (campaign.maxPayoutPerClipCents && payoutCents > campaign.maxPayoutPerClipCents) {
      payoutCents = campaign.maxPayoutPerClipCents;
    }

    // Cap by remaining budget
    const remainingBudget =
      campaign.totalBudgetCents - campaign.budgetSpentCents;
    if (payoutCents > remainingBudget) {
      payoutCents = remainingBudget;
    }

    // Update submission
    await this.db
      .update(schema.submissions)
      .set({
        status: "paid",
        viewsAtDay30: views,
        payoutAmountCents: payoutCents,
        updatedAt: new Date(),
      })
      .where(eq(schema.submissions.id, id));

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
      };
    });
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
