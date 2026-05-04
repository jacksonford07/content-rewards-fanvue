import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export interface SourceKeyframe {
  atSeconds: number;
  base64: string;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export const PAYOUT_METHODS = [
  "paypal",
  "wise",
  "usdc_eth",
  "usdc_sol",
  "eth",
  "sol",
  "btc",
  "bank_uk",
  "bank_us",
  "bank_iban",
  "cashapp",
  "venmo",
] as const;

export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const CONTACT_CHANNELS = [
  "telegram",
  "whatsapp",
  "phone",
  "email",
] as const;

export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  fanvueId: text("fanvue_id").unique(),
  fanvueHandle: text("fanvue_handle"),
  fanvueAvatarUrl: text("fanvue_avatar_url"),
  role: text("role", { enum: ["clipper", "creator", "both"] })
    .default("clipper")
    .notNull(),
  // M2: clipper contact channel for off-platform payouts.
  contactChannel: text("contact_channel", { enum: CONTACT_CHANNELS }),
  contactValue: text("contact_value"),
  // M4: persisted Fanvue OAuth state for tracking-link calls.
  fanvueAccessToken: text("fanvue_access_token"),
  fanvueScopes: text("fanvue_scopes").array().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirementsType: text("requirements_type", {
    enum: ["native", "google_doc"],
  })
    .default("native")
    .notNull(),
  requirementsText: text("requirements_text"),
  requirementsUrl: text("requirements_url"),
  sourceContentUrl: text("source_content_url"),
  sourceThumbnailUrl: text("source_thumbnail_url"),
  allowedPlatforms: text("allowed_platforms")
    .array()
    .default([])
    .notNull(),
  rewardRatePer1kCents: integer("reward_rate_per_1k_cents")
    .default(0)
    .notNull(),
  totalBudgetCents: integer("total_budget_cents").default(0).notNull(),
  budgetSpentCents: integer("budget_spent_cents").default(0).notNull(),
  minPayoutThreshold: integer("min_payout_threshold").default(0).notNull(),
  maxPayoutPerClipCents: integer("max_payout_per_clip_cents"),
  // M2: which off-platform payout methods this campaign accepts.
  // Postgres array of PayoutMethod values; overlap with the clipper's
  // accepted methods gates submission (see M2.3 OverlapGate).
  acceptedPayoutMethods: text("accepted_payout_methods")
    .array()
    .$type<PayoutMethod[]>()
    .default([])
    .notNull(),
  // M4: per-1k-views or per-subscriber payout. Default per-1k-views
  // preserves the v1 model.
  payoutType: text("payout_type", {
    enum: ["per_1k_views", "per_subscriber"],
  })
    .default("per_1k_views")
    .notNull(),
  // M4: cents-per-sub rate when payoutType = per_subscriber.
  ratePerSubCents: integer("rate_per_sub_cents").default(0).notNull(),
  status: text("status", {
    enum: ["draft", "pending_budget", "active", "paused", "completed"],
  })
    .default("draft")
    .notNull(),
  isPrivate: boolean("is_private").default(false).notNull(),
  privateSlug: text("private_slug").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  goesLiveAt: timestamp("goes_live_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  // Pre-extracted keyframes from sourceContentUrl, base64 jpegs. Populated
  // on first AI verification for the campaign and re-used afterwards so we
  // hit Drive (or whichever host) at most once per source URL.
  sourceKeyframes: jsonb("source_keyframes").$type<SourceKeyframe[]>(),
});

// ─── Submissions ─────────────────────────────────────────────────────────────

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  fanId: uuid("fan_id")
    .notNull()
    .references(() => users.id),
  postUrl: text("post_url").notNull(),
  platform: text("platform", {
    enum: ["tiktok", "instagram", "youtube"],
  }).notNull(),
  aiReviewResult: text("ai_review_result", {
    enum: ["clean", "flagged"],
  }),
  aiNotes: text("ai_notes"),
  status: text("status", {
    enum: [
      "pending",
      "approved",
      "rejected",
      "auto_approved",
      "paid",
      "flagged",
      "ready_to_pay",
      "paid_off_platform",
      "disputed",
    ],
  })
    .default("pending")
    .notNull(),
  rejectionReason: text("rejection_reason"),
  viewsAtDay30: integer("views_at_day_30"),
  payoutAmountCents: integer("payout_amount_cents"),
  autoApproveAt: timestamp("auto_approve_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  creatorDecisionAt: timestamp("creator_decision_at", { withTimezone: true }),
  verificationStartedAt: timestamp("verification_started_at", {
    withTimezone: true,
  }),
  lockDate: timestamp("lock_date", { withTimezone: true }),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  lastViewCount: integer("last_view_count").default(0).notNull(),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  postDeletedAt: timestamp("post_deleted_at", { withTimezone: true }),
  platformUsername: text("platform_username"),
  pendingEarningsCents: integer("pending_earnings_cents").default(0).notNull(),
  // M4: Fanvue tracking-link minted per accepted clipper-per-campaign.
  // Populated on submission approve for per-subscriber campaigns.
  trackingLinkUuid: text("tracking_link_uuid"),
  // The slug returned by Fanvue (e.g. 'fv-123'). Surfaced to the clipper
  // alongside the resolved redirect URL.
  trackingLinkSlug: text("tracking_link_slug"),
  // Snapshot of acquired subscribers at the last attribution cron run.
  lastAcquiredSubs: integer("last_acquired_subs").default(0).notNull(),
});

// ─── Submission View Snapshots ───────────────────────────────────────────────

export const submissionViewSnapshots = pgTable("submission_view_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => submissions.id),
  capturedAt: timestamp("captured_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  viewCount: integer("view_count").notNull(),
  available: boolean("available").default(true).notNull(),
});

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type", {
    enum: [
      "new_submission",
      "approved",
      "rejected",
      "payout_released",
      "low_budget",
      "views_ready",
    ],
  }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Clipper Payout Methods (M2.1) ───────────────────────────────────────────

export const clipperPayoutMethods = pgTable(
  "clipper_payout_methods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    method: text("method", { enum: PAYOUT_METHODS }).notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  // One row per user-per-method (id stays the PK; (user_id, method) is
  // a uniqueness constraint so upserts hit the right row).
  (table) => [
    unique("clipper_payout_methods_user_method_uq").on(table.userId, table.method),
  ],
);

// ─── Payout Events (M2.4 — off-platform payment ledger) ──────────────────────
//
// Append-only ledger written when a creator marks a submission paid. Trust
// score (M3) reads from this table; clipper confirmation (M3.5) and dispute
// (M3.6) flip the corresponding timestamp columns.

export const payoutEvents = pgTable("payout_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id),
  clipperId: uuid("clipper_id")
    .notNull()
    .references(() => users.id),
  method: text("method", { enum: PAYOUT_METHODS }).notNull(),
  // Snapshot of the clipper's saved value at mark-paid time. We don't
  // live-link to clipperPayoutMethods because that row can change later.
  valueSnapshot: text("value_snapshot").notNull(),
  // Snapshot of the submission's accrued payout at mark-paid time.
  amountCents: integer("amount_cents").notNull(),
  // Optional free-text reference (e.g. PayPal transaction ID, bank ref).
  reference: text("reference"),
  // M2.5 Tier A: optional on-chain transaction hash for crypto methods.
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // M3.5: clipper confirmed receipt. NULL = pending.
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  // M3.6: clipper raised a dispute. NULL = no dispute.
  disputedAt: timestamp("disputed_at", { withTimezone: true }),
  // M3.6: clipper-supplied reason for the dispute (free text).
  disputeReason: text("dispute_reason"),
  // M3.6 admin resolution. NULL = open or never disputed.
  disputeResolvedAt: timestamp("dispute_resolved_at", { withTimezone: true }),
  disputeResolution: text("dispute_resolution", {
    enum: ["confirmed", "rejected"],
  }),
});

// ─── Campaign Bans ───────────────────────────────────────────────────────────

export const campaignBans = pgTable(
  "campaign_bans",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.userId] })],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  campaigns: many(campaigns),
  submissions: many(submissions),
  notifications: many(notifications),
  payoutMethods: many(clipperPayoutMethods),
}));

export const clipperPayoutMethodsRelations = relations(
  clipperPayoutMethods,
  ({ one }) => ({
    user: one(users, {
      fields: [clipperPayoutMethods.userId],
      references: [users.id],
    }),
  }),
);

export const payoutEventsRelations = relations(payoutEvents, ({ one }) => ({
  submission: one(submissions, {
    fields: [payoutEvents.submissionId],
    references: [submissions.id],
  }),
  creator: one(users, {
    fields: [payoutEvents.creatorId],
    references: [users.id],
  }),
  clipper: one(users, {
    fields: [payoutEvents.clipperId],
    references: [users.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  creator: one(users, {
    fields: [campaigns.creatorId],
    references: [users.id],
  }),
  submissions: many(submissions),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [submissions.campaignId],
    references: [campaigns.id],
  }),
  fan: one(users, {
    fields: [submissions.fanId],
    references: [users.id],
  }),
  viewSnapshots: many(submissionViewSnapshots),
}));

export const submissionViewSnapshotsRelations = relations(
  submissionViewSnapshots,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [submissionViewSnapshots.submissionId],
      references: [submissions.id],
    }),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

