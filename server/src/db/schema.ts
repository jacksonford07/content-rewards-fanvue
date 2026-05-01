import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export interface SourceKeyframe {
  atSeconds: number;
  base64: string;
}

/**
 * Off-platform payment methods a clipper can accept and a creator can pay in.
 * v1 launches without in-app payments — these power the manual handoff.
 */
export type PaymentMethodType =
  | "paypal"
  | "wise"
  | "usdc_eth"
  | "usdc_sol"
  | "btc"
  | "bank_uk"
  | "bank_us"
  | "cashapp"
  | "venmo";

export interface ClipperPaymentMethod {
  type: PaymentMethodType;
  /** Free-form value: paypal email, crypto address, bank ref, @cashtag, etc. */
  value: string;
  /** Optional human note (e.g. "USDC only on Polygon", "preferred"). */
  note?: string;
}

export type ContactMethod = "telegram" | "whatsapp" | "phone" | "email";

// ─── Users ───────────────────────────────────────────────────────────────────

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
  isCreator: boolean("is_creator").default(false).notNull(),
  role: text("role", { enum: ["clipper", "creator", "both"] })
    .default("clipper")
    .notNull(),
  kycStatus: text("kyc_status", {
    enum: ["not_started", "in_progress", "verified", "rejected"],
  })
    .default("not_started")
    .notNull(),
  walletBalanceCents: integer("wallet_balance_cents").default(0).notNull(),
  // Off-platform payout coordination. Clippers fill these in so creators know
  // how to reach them and how to send the manual payout.
  contactMethod: text("contact_method", {
    enum: ["telegram", "whatsapp", "phone", "email"],
  }),
  contactHandle: text("contact_handle"),
  paymentMethods: jsonb("payment_methods")
    .$type<ClipperPaymentMethod[]>()
    .default([])
    .notNull(),
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
  status: text("status", {
    enum: ["draft", "pending_budget", "active", "paused", "completed"],
  })
    .default("draft")
    .notNull(),
  isPrivate: boolean("is_private").default(false).notNull(),
  privateSlug: text("private_slug").unique(),
  // Methods this creator is willing to use for off-platform payouts. v1
  // surfaces this on the campaign brief so clippers can self-select.
  acceptedPaymentMethods: text("accepted_payment_methods")
    .array()
    .$type<PaymentMethodType[]>()
    .default([])
    .notNull(),
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
    enum: ["pending", "approved", "rejected", "auto_approved", "paid", "flagged"],
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
  // Set when creator marks the off-platform payment as sent. v1 replaces the
  // in-app payout flow with a manual ledger entry.
  paymentSentAt: timestamp("payment_sent_at", { withTimezone: true }),
  paymentMethodUsed: text("payment_method_used"),
  paymentReference: text("payment_reference"),
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

// ─── Wallet Transactions ─────────────────────────────────────────────────────

export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
  type: text("type", {
    enum: ["payout", "withdrawal", "topup", "escrow_lock", "refund"],
  }).notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status", { enum: ["completed", "pending"] })
    .default("completed")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Campaign Transactions ───────────────────────────────────────────────────

export const campaignTransactions = pgTable("campaign_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  type: text("type", {
    enum: ["escrow_lock", "payout_release", "topup", "refund"],
  }).notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status", { enum: ["completed", "pending"] })
    .default("completed")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
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
  walletTransactions: many(walletTransactions),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  creator: one(users, {
    fields: [campaigns.creatorId],
    references: [users.id],
  }),
  submissions: many(submissions),
  transactions: many(campaignTransactions),
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

export const walletTransactionsRelations = relations(
  walletTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [walletTransactions.userId],
      references: [users.id],
    }),
  }),
);

export const campaignTransactionsRelations = relations(
  campaignTransactions,
  ({ one }) => ({
    campaign: one(campaigns, {
      fields: [campaignTransactions.campaignId],
      references: [campaigns.id],
    }),
  }),
);
