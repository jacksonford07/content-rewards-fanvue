import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  goesLiveAt: timestamp("goes_live_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
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

export const submissionsRelations = relations(submissions, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [submissions.campaignId],
    references: [campaigns.id],
  }),
  fan: one(users, {
    fields: [submissions.fanId],
    references: [users.id],
  }),
}));

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
