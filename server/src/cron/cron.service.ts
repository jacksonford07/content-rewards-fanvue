import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, lt } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";
import { NotificationsService } from "../notifications/notifications.service.js";

@Injectable()
export class CronService {
  constructor(
    @Inject(DB) private db: Database,
    private notifications: NotificationsService,
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
}
