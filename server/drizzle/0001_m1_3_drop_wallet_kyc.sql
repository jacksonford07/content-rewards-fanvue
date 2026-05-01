-- M1.3 — Drop wallet & KYC tables/columns + backfill stale enum values
--
-- Sequenced to be safe under partial failure: data backfill first (so a
-- subsequent drop never strands rows in unreadable states), then the
-- destructive drops.
--
-- Backwards-compatibility note: the `submissions.status = 'paid'` value
-- and the `campaigns.status = 'pending_budget'` value remain valid TEXT
-- inputs because Drizzle uses TEXT-with-enum constraints (no Postgres
-- ENUM type), so the backfill is a simple UPDATE — no enum surgery.

-- ── Backfill submission states ──────────────────────────────────────────────
UPDATE "submissions"
   SET "status" = 'paid_off_platform'
 WHERE "status" = 'paid';
--> statement-breakpoint

-- ── Backfill campaign states ────────────────────────────────────────────────
UPDATE "campaigns"
   SET "status" = 'active',
       "goes_live_at" = COALESCE("goes_live_at", now())
 WHERE "status" = 'pending_budget';
--> statement-breakpoint

-- ── Drop wallet/transaction tables (FKs go with them) ───────────────────────
DROP TABLE IF EXISTS "wallet_transactions";
--> statement-breakpoint
DROP TABLE IF EXISTS "campaign_transactions";
--> statement-breakpoint

-- ── Drop dead columns on users ──────────────────────────────────────────────
ALTER TABLE "users" DROP COLUMN IF EXISTS "wallet_balance_cents";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "kyc_status";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "is_creator";
