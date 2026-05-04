-- M4.2 — Per-subscriber campaign apply flow
--
-- Per-sub campaigns no longer need a clip URL/platform: clippers apply, get a
-- tracking link, accrual runs against the link. Applications can be auto- or
-- manually approved depending on the campaign setting.

-- ── campaigns: application_mode (auto-grant link vs manual 24h approval) ────
ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "application_mode" text DEFAULT 'auto' NOT NULL;
--> statement-breakpoint

-- ── submissions: post_url and platform are no longer required ───────────────
-- Per-views still validates both at the API layer; per-sub apply flow stores
-- nulls for these.
ALTER TABLE "submissions" ALTER COLUMN "post_url" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "platform" DROP NOT NULL;
