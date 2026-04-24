import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ScrapersService } from "../scrapers/scrapers.service.js";
import { SubmissionsService } from "../submissions/submissions.service.js";

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @Inject(DB) private db: Database,
    private notifications: NotificationsService,
    private scrapers: ScrapersService,
    private submissions: SubmissionsService,
  ) {}

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

    let count = 0;
    for (const sub of pending) {
      // Check if campaign has available budget
      const [campaign] = await this.db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, sub.campaignId))
        .limit(1);

      if (!campaign) continue;

      // Skip paused/completed campaigns — don't auto-approve
      if (campaign.status !== "active") continue;

      const available =
        campaign.totalBudgetCents - campaign.budgetSpentCents;
      if (available <= 0) continue; // Skip — no budget left

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

      count++;
    }

    return { autoApproved: count };
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
        ),
      );

    let scraped = 0;
    let deleted = 0;
    let errors = 0;
    let skippedAge = 0;
    let skippedFresh = 0;
    let skippedFull = 0;
    const touchedCampaigns = new Set<string>();

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

      const [campaign] = await this.db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, sub.campaignId))
        .limit(1);
      if (!campaign) continue;

      // FIFO priority: skip scraping if earlier clippers already own the
      // campaign pool — we couldn't grow this submission's reservation even
      // if its view count went up, so the API call would be wasted.
      const ceiling = await this.submissions.getReservationCeilingCents(
        sub,
        campaign,
      );
      if (ceiling <= sub.pendingEarningsCents) {
        skippedFull++;
        continue;
      }

      try {
        const result = await this.scrapers.getViews(sub.postUrl);

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

        let viewsChanged = false;
        if (result.available && typeof result.viewCount === "number") {
          if (result.viewCount !== sub.lastViewCount) viewsChanged = true;
          update.lastViewCount = result.viewCount;
        }

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

        if (viewsChanged) touchedCampaigns.add(sub.campaignId);

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

    // Recompute FIFO-capped reservations once per campaign touched this run.
    for (const campaignId of touchedCampaigns) {
      await this.submissions.recomputeCampaignReservations(campaignId);
    }

    return {
      scraped,
      deleted,
      errors,
      skippedAge,
      skippedFresh,
      skippedFull,
      total: tracked.length,
    };
  }

  async finalizeViews() {
    return this.submissions.autoFinalizeDueSubmissions();
  }
}
