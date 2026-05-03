import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq, inArray, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";

function adminEmails(): string[] {
  // Default allowlist: prod admins + the dev-admin Dev Login fixture.
  // Override via ADMIN_EMAILS env var (comma-separated).
  const raw =
    process.env.ADMIN_EMAILS ??
    "jackson.ford@fanvue.com,iniaki.boudiaf@fanvue.com,dev-admin@test.local";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

@Injectable()
export class AdminService {
  constructor(@Inject(DB) private db: Database) {}

  async assertAdmin(userId: string) {
    const [user] = await this.db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!user) throw new ForbiddenException();
    const allowed = adminEmails();
    if (!allowed.includes(user.email.toLowerCase())) {
      throw new ForbiddenException("Admin only");
    }
  }

  async listDisputes(userId: string, filter: "open" | "resolved" | "all") {
    await this.assertAdmin(userId);

    const conditions = [];
    if (filter === "open") {
      conditions.push(sql`${schema.payoutEvents.disputedAt} IS NOT NULL`);
      conditions.push(sql`${schema.payoutEvents.disputeResolvedAt} IS NULL`);
    } else if (filter === "resolved") {
      conditions.push(sql`${schema.payoutEvents.disputeResolvedAt} IS NOT NULL`);
    } else {
      conditions.push(sql`${schema.payoutEvents.disputedAt} IS NOT NULL`);
    }

    const events = await this.db
      .select()
      .from(schema.payoutEvents)
      .where(sql.join(conditions, sql` AND `))
      .orderBy(sql`${schema.payoutEvents.disputedAt} DESC`)
      .limit(100);

    if (events.length === 0) return [];

    const userIds = [
      ...new Set(events.flatMap((e) => [e.creatorId, e.clipperId])),
    ];
    const submissionIds = events.map((e) => e.submissionId);

    const users = await this.db
      .select()
      .from(schema.users)
      .where(inArray(schema.users.id, userIds));
    const submissions = await this.db
      .select()
      .from(schema.submissions)
      .where(inArray(schema.submissions.id, submissionIds));
    const campaignIds = [...new Set(submissions.map((s) => s.campaignId))];
    const campaigns = await this.db
      .select()
      .from(schema.campaigns)
      .where(inArray(schema.campaigns.id, campaignIds));

    const usersMap = new Map(users.map((u) => [u.id, u]));
    const submissionsMap = new Map(submissions.map((s) => [s.id, s]));
    const campaignsMap = new Map(campaigns.map((c) => [c.id, c]));

    return events.map((e) => {
      const submission = submissionsMap.get(e.submissionId);
      const campaign = submission
        ? campaignsMap.get(submission.campaignId)
        : null;
      return {
        id: e.id,
        submissionId: e.submissionId,
        amountCents: e.amountCents,
        method: e.method,
        valueSnapshot: e.valueSnapshot,
        reference: e.reference,
        txHash: e.txHash,
        createdAt: e.createdAt.toISOString(),
        disputedAt: e.disputedAt?.toISOString() ?? null,
        disputeResolvedAt: e.disputeResolvedAt?.toISOString() ?? null,
        disputeResolution: e.disputeResolution,
        creator: {
          id: e.creatorId,
          displayName: usersMap.get(e.creatorId)?.displayName ?? "",
          handle: usersMap.get(e.creatorId)?.handle ?? "",
        },
        clipper: {
          id: e.clipperId,
          displayName: usersMap.get(e.clipperId)?.displayName ?? "",
          handle: usersMap.get(e.clipperId)?.handle ?? "",
          contactChannel: usersMap.get(e.clipperId)?.contactChannel ?? null,
          contactValue: usersMap.get(e.clipperId)?.contactValue ?? null,
        },
        campaign: {
          id: campaign?.id ?? "",
          title: campaign?.title ?? "",
        },
        postUrl: submission?.postUrl ?? "",
      };
    });
  }

  async resolveDispute(
    userId: string,
    eventId: string,
    resolution: "confirmed" | "rejected",
  ) {
    await this.assertAdmin(userId);
    if (resolution !== "confirmed" && resolution !== "rejected") {
      throw new BadRequestException("Invalid resolution");
    }

    const [event] = await this.db
      .select()
      .from(schema.payoutEvents)
      .where(eq(schema.payoutEvents.id, eventId))
      .limit(1);
    if (!event) throw new NotFoundException("Event not found");
    if (!event.disputedAt) {
      throw new BadRequestException("Event isn't disputed");
    }
    if (event.disputeResolvedAt) {
      throw new BadRequestException("Dispute already resolved");
    }

    await this.db
      .update(schema.payoutEvents)
      .set({
        disputeResolvedAt: new Date(),
        disputeResolution: resolution,
      })
      .where(eq(schema.payoutEvents.id, eventId));

    // Move the submission status forward based on the resolution.
    // confirmed = admin sided with creator (payment did happen) → keep paid_off_platform
    // rejected  = admin sided with clipper (payment did NOT happen) → submission stays disputed
    if (resolution === "confirmed") {
      await this.db
        .update(schema.submissions)
        .set({ status: "paid_off_platform", updatedAt: new Date() })
        .where(eq(schema.submissions.id, event.submissionId));
    }

    return { resolved: true, resolution };
  }
}
