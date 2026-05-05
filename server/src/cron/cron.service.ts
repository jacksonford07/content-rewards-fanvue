import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";
import { CampaignsService } from "../campaigns/campaigns.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ScrapersService } from "../scrapers/scrapers.service.js";
import { SubmissionsService } from "../submissions/submissions.service.js";
import {
  FanvueAuthError,
  FanvueScopeError,
  FanvueTrackingLinksService,
} from "../fanvue/fanvue-tracking-links.service.js";

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @Inject(DB) private db: Database,
    private notifications: NotificationsService,
    private scrapers: ScrapersService,
    private submissions: SubmissionsService,
    private fanvueLinks: FanvueTrackingLinksService,
    private campaigns: CampaignsService,
  ) {}

  /**
   * M4.5 — Subscriber attribution cron.
   *
   * Once per cron run (every 6h alongside the view-tracking cron),
   * iterates per creator that owns at least one active per-subscriber
   * submission, fetches the creator's tracking links from Fanvue, and
   * applies pro-rata pool accrual on the delta of acquired_subscribers
   * since the last scrape.
   *
   * Skips per-view campaigns entirely.
   */
  async syncSubscriberAttribution() {
    // Pull every active per-sub submission with a minted link.
    const rows = await this.db
      .select({
        submission: schema.submissions,
        campaign: schema.campaigns,
      })
      .from(schema.submissions)
      .innerJoin(
        schema.campaigns,
        eq(schema.campaigns.id, schema.submissions.campaignId),
      )
      .where(
        and(
          eq(schema.campaigns.payoutType, "per_subscriber"),
          eq(schema.campaigns.status, "active"),
          inArray(schema.submissions.status, [
            "approved",
            "auto_approved",
          ]),
          sql`${schema.submissions.trackingLinkUuid} IS NOT NULL`,
        ),
      );

    if (rows.length === 0) {
      return { updated: 0, errors: 0 };
    }

    // Group by creator so we make at most one GET /tracking-links call per
    // creator per run.
    const byCreator = new Map<
      string,
      { campaign: typeof schema.campaigns.$inferSelect; submissions: typeof schema.submissions.$inferSelect[] }[]
    >();
    for (const r of rows) {
      const list = byCreator.get(r.campaign.creatorId) ?? [];
      const existingGroup = list.find(
        (g) => g.campaign.id === r.campaign.id,
      );
      if (existingGroup) {
        existingGroup.submissions.push(r.submission);
      } else {
        list.push({ campaign: r.campaign, submissions: [r.submission] });
      }
      byCreator.set(r.campaign.creatorId, list);
    }

    let updated = 0;
    let errors = 0;

    for (const [creatorId, groups] of byCreator) {
      try {
        const [creator] = await this.db
          .select({ accessToken: schema.users.fanvueAccessToken })
          .from(schema.users)
          .where(eq(schema.users.id, creatorId))
          .limit(1);
        if (!creator?.accessToken) continue;

        const links = await this.fanvueLinks.listAllLinks({
          accessToken: creator.accessToken,
        });
        const linksByUuid = new Map(links.map((l) => [l.uuid, l]));

        for (const group of groups) {
          for (const sub of group.submissions) {
            if (!sub.trackingLinkUuid) continue;
            const link = linksByUuid.get(sub.trackingLinkUuid);
            if (!link) continue;
            const acquired = Math.floor(link.engagement.acquiredSubscribers);
            // v1.2 M2.2 — also snapshot click count. Clicks do not accrue
            // earnings on their own (per-sub rate is on acquired subs);
            // we just need the snapshot for promoter workspace + roster
            // delta display.
            const clicks = Math.max(0, Math.floor(link.clicks ?? 0));
            const subDelta = Math.max(0, acquired - sub.lastAcquiredSubs);
            const clickDelta = Math.max(0, clicks - sub.lastClicks);
            if (subDelta === 0 && clickDelta === 0) continue;
            const earnedCents = Math.round(
              subDelta * group.campaign.ratePerSubCents,
            );
            // Cap by remaining budget — pro-rata pool model.
            const remainingCents = Math.max(
              group.campaign.totalBudgetCents -
                group.campaign.budgetSpentCents,
              0,
            );
            const creditCents = Math.min(earnedCents, remainingCents);
            await this.db
              .update(schema.submissions)
              .set({
                lastAcquiredSubs: acquired,
                lastClicks: clicks,
                pendingEarningsCents: sql`${schema.submissions.pendingEarningsCents} + ${creditCents}`,
                updatedAt: new Date(),
              })
              .where(eq(schema.submissions.id, sub.id));
            updated++;
          }
        }
      } catch (err) {
        if (err instanceof FanvueAuthError) {
          this.logger.warn(
            `Fanvue token rejected for creator ${creatorId}; skipping until re-auth`,
          );
        } else if (err instanceof FanvueScopeError) {
          this.logger.warn(
            `Creator ${creatorId} missing scope ${err.requiredScope}`,
          );
        } else {
          this.logger.error(
            `Sub attribution failed for creator ${creatorId}: ${err}`,
          );
        }
        errors++;
      }
    }

    return { updated, errors };
  }

  async autoApprove() {
    const now = new Date();
    const pending = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.status, "pending"),
          lt(schema.submissions.autoApproveAt, now),
        ),
      );

    let approved = 0;
    let rejected = 0;
    for (const sub of pending) {
      const [campaign] = await this.db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, sub.campaignId))
        .limit(1);

      if (!campaign) continue;
      if (campaign.status !== "active") continue;

      const available =
        campaign.totalBudgetCents - campaign.budgetSpentCents;
      if (available <= 0) continue;

      // M4.2 D3 — auto_approve_at semantics depend on campaign type:
      //  - per-views, pending: auto-approve at 48h
      //  - per-sub manual, pending: auto-REJECT at 24h
      //  - per-sub auto: never lands here (status starts as approved)
      if (campaign.payoutType === "per_subscriber") {
        await this.db
          .update(schema.submissions)
          .set({
            status: "rejected",
            rejectionReason: "Auto-rejected: creator did not respond within 24h",
            creatorDecisionAt: now,
            updatedAt: now,
          })
          .where(eq(schema.submissions.id, sub.id));
        await this.notifications.create({
          userId: sub.fanId,
          type: "rejected",
          title: "Application timed out",
          message: `Your application to "${campaign.title}" was auto-rejected after 24h with no creator response.`,
          actionUrl: "/submissions?tab=rejected",
        });
        rejected++;
        continue;
      }

      const lockDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await this.db
        .update(schema.submissions)
        .set({
          status: "auto_approved",
          creatorDecisionAt: now,
          verificationStartedAt: now,
          lockDate,
          updatedAt: now,
        })
        .where(eq(schema.submissions.id, sub.id));

      await this.notifications.create({
        userId: sub.fanId,
        type: "approved",
        title: "Submission auto-approved",
        message: "Your submission was auto-approved after 48h. View verification has started.",
        actionUrl: "/submissions",
      });

      approved++;
    }

    return { autoApproved: approved, autoRejected: rejected };
  }

  async sendViewsReadyReminders() {
    const now = new Date();
    const ready = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          inArray(schema.submissions.status, ["approved", "auto_approved"]),
          lt(schema.submissions.lockDate, now),
        ),
      );

    let count = 0;
    for (const sub of ready) {
      const [campaign] = await this.db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, sub.campaignId))
        .limit(1);

      if (!campaign) continue;

      // Send reminder notification to campaign creator
      await this.notifications.create({
        userId: campaign.creatorId,
        type: "views_ready",
        title: "Time to verify views",
        message: `The 30-day verification period has ended for a clip in "${campaign.title}". Please check the views and enter them to release payout.`,
        actionUrl: "/creator/inbox",
      });

      count++;
    }

    return { reminders: count };
  }

  async trackViews() {
    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const sixHoursMs = 6 * 60 * 60 * 1000;

    const tracked = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          inArray(schema.submissions.status, [
            "pending",
            "approved",
            "auto_approved",
          ]),
          isNull(schema.submissions.postDeletedAt),
          isNull(schema.submissions.viewsAtDay30),
          // Per-sub apply submissions have no clip URL — skip scraping them.
          sql`${schema.submissions.postUrl} IS NOT NULL`,
        ),
      );

    let scraped = 0;
    let deleted = 0;
    let errors = 0;
    let skippedAge = 0;
    let skippedFresh = 0;
    // scrapes that brought new view data, grouped by campaign — fed into the
    // campaign-wide accrual at the end so the pool splits fairly across all
    // clips that grew this window.
    const scrapesByCampaign = new Map<
      string,
      { submissionId: string; newViewCount: number }[]
    >();

    for (const sub of tracked) {
      const anchor = sub.postedAt ?? sub.createdAt;
      if (anchor.getTime() + thirtyDaysMs < now.getTime()) {
        // Past 30d window; finalization cron handles payout, no more scrapes
        skippedAge++;
        continue;
      }

      // Throttle: only scrape if last scrape is >= 6h ago (or never)
      const lastScraped = sub.lastScrapedAt?.getTime() ?? 0;
      if (now.getTime() - lastScraped < sixHoursMs) {
        skippedFresh++;
        continue;
      }

      try {
        const result = await this.scrapers.getViews(sub.postUrl!);

        await this.db.insert(schema.submissionViewSnapshots).values({
          submissionId: sub.id,
          viewCount: result.viewCount ?? 0,
          available: result.available,
          capturedAt: now,
        });

        const update: Partial<typeof schema.submissions.$inferInsert> = {
          lastScrapedAt: now,
          updatedAt: now,
        };

        if (!sub.postedAt && result.postedAt) {
          update.postedAt = result.postedAt;
          // Realign lockDate to postedAt + 30d (overrides creator-decision anchor)
          update.lockDate = new Date(
            result.postedAt.getTime() + thirtyDaysMs,
          );
        }

        if (!sub.platformUsername && result.platformUsername) {
          update.platformUsername = result.platformUsername;
        }

        await this.db
          .update(schema.submissions)
          .set(update)
          .where(eq(schema.submissions.id, sub.id));

        // Queue for accrual if the view count actually grew — same delta
        // semantics as every other clip that grew this window.
        if (
          result.available &&
          typeof result.viewCount === "number" &&
          result.viewCount > sub.lastViewCount
        ) {
          const arr = scrapesByCampaign.get(sub.campaignId) ?? [];
          arr.push({
            submissionId: sub.id,
            newViewCount: result.viewCount,
          });
          scrapesByCampaign.set(sub.campaignId, arr);
        }

        if (!result.available) {
          // Mark deleted only on two consecutive unavailable snapshots
          const recent = await this.db
            .select()
            .from(schema.submissionViewSnapshots)
            .where(eq(schema.submissionViewSnapshots.submissionId, sub.id))
            .orderBy(desc(schema.submissionViewSnapshots.capturedAt))
            .limit(2);

          if (
            recent.length >= 2 &&
            recent.every((s) => !s.available)
          ) {
            await this.db
              .update(schema.submissions)
              .set({ postDeletedAt: now, updatedAt: now })
              .where(eq(schema.submissions.id, sub.id));
            deleted++;
          }
        }

        scraped++;
      } catch (err) {
        this.logger.error(
          `Failed to track submission ${sub.id}: ${String(err)}`,
        );
        errors++;
      }
    }

    // Apply accruals once per campaign: each campaign's pool is split
    // pro-rata across all submissions that grew this window.
    for (const [campaignId, scrapes] of scrapesByCampaign) {
      await this.submissions.applyCampaignAccrual(campaignId, scrapes);
    }

    return {
      scraped,
      deleted,
      errors,
      skippedAge,
      skippedFresh,
      total: tracked.length,
    };
  }

  async finalizeViews() {
    return this.submissions.autoFinalizeDueSubmissions();
  }

  /**
   * M4.2 D5 — sweep per-sub campaigns whose `ends_at` has passed.
   *
   * Hourly cron. Flips active per-sub campaigns past their end date to
   * `completed` and rolls every still-accruing submission to `ready_to_pay`
   * (with the pending earnings frozen as the payout).
   */
  async sweepCampaignEnd() {
    const now = new Date();
    const due = await this.db
      .select()
      .from(schema.campaigns)
      .where(
        and(
          eq(schema.campaigns.payoutType, "per_subscriber"),
          eq(schema.campaigns.status, "active"),
          isNotNull(schema.campaigns.endsAt),
          lt(schema.campaigns.endsAt, now),
        ),
      );

    let swept = 0;
    let totalSettledCents = 0;
    for (const c of due) {
      try {
        const result = await this.campaigns.sweepToReadyToPay(c.id);
        swept++;
        totalSettledCents += result.totalSettledCents;
      } catch (err) {
        this.logger.error(
          `Failed to sweep campaign ${c.id} on ends_at: ${err}`,
        );
      }
    }
    return { swept, totalSettledCents };
  }

  /**
   * M4.2 D5 — budget-cap watchdog. Every 30 min, sums pending earnings on
   * each active per-sub campaign; if the projected total exceeds the budget,
   * flips the campaign early so we never accrue past the creator's spend cap.
   */
  async checkBudgetCap() {
    const rows = await this.db
      .select({
        campaignId: schema.campaigns.id,
        totalBudgetCents: schema.campaigns.totalBudgetCents,
        budgetSpentCents: schema.campaigns.budgetSpentCents,
        pendingTotalCents: sql<number>`coalesce(sum(${schema.submissions.pendingEarningsCents}), 0)::int`,
      })
      .from(schema.campaigns)
      .leftJoin(
        schema.submissions,
        and(
          eq(schema.submissions.campaignId, schema.campaigns.id),
          inArray(schema.submissions.status, [
            "pending",
            "approved",
            "auto_approved",
          ]),
        ),
      )
      .where(
        and(
          eq(schema.campaigns.payoutType, "per_subscriber"),
          eq(schema.campaigns.status, "active"),
        ),
      )
      .groupBy(schema.campaigns.id);

    let frozen = 0;
    let totalSettledCents = 0;
    for (const r of rows) {
      const projected = r.budgetSpentCents + r.pendingTotalCents;
      if (projected < r.totalBudgetCents) continue;
      try {
        const result = await this.campaigns.sweepToReadyToPay(r.campaignId);
        frozen++;
        totalSettledCents += result.totalSettledCents;
        this.logger.log(
          `Froze campaign ${r.campaignId} — projected ${projected}c >= budget ${r.totalBudgetCents}c`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to freeze campaign ${r.campaignId} on budget cap: ${err}`,
        );
      }
    }
    return { frozen, totalSettledCents };
  }
}
