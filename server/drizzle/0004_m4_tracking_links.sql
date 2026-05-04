-- M4 — Tracking-link schema additions
--
-- Backwards-compatible additions only. Per-subscriber campaigns + per-clipper
-- tracking-link minting + sub-attribution cron all hang off these columns.

-- ── users: persist OAuth token + scope set ──────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fanvue_access_token" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fanvue_scopes" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint

-- ── campaigns: payout type toggle + per-sub rate ────────────────────────────
ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "payout_type" text DEFAULT 'per_1k_views' NOT NULL;
--> statement-breakpoint
ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "rate_per_sub_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- ── submissions: per-clipper tracking link + last sub count ─────────────────
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "tracking_link_uuid" text;
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "tracking_link_slug" text;
--> statement-breakpoint
ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "last_acquired_subs" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "submissions_tracking_link_uuid_idx"
  ON "submissions" ("tracking_link_uuid")
  WHERE "tracking_link_uuid" IS NOT NULL;
