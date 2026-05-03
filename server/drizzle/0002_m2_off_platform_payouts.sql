-- M2 — Off-platform payouts schema additions
--
-- Adds the three pieces M2 needs:
--   1. clipper_payout_methods (M2.1) — clipper's accepted methods
--   2. users.contact_channel/value (M2.1d) — how the creator reaches them
--   3. campaigns.accepted_payout_methods (M2.2) — which methods this
--      campaign offers
--   4. payout_events (M2.4b) — append-only ledger of mark-paid actions

-- ── users: contact channel ──────────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contact_channel" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contact_value" text;
--> statement-breakpoint

-- ── campaigns: accepted payout methods ──────────────────────────────────────
ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "accepted_payout_methods" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint

-- ── clipper_payout_methods ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "clipper_payout_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "method" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "clipper_payout_methods_user_method_pk" UNIQUE ("user_id", "method")
);
--> statement-breakpoint
ALTER TABLE "clipper_payout_methods"
  ADD CONSTRAINT "clipper_payout_methods_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ── payout_events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payout_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL,
  "creator_id" uuid NOT NULL,
  "clipper_id" uuid NOT NULL,
  "method" text NOT NULL,
  "value_snapshot" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "reference" text,
  "tx_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confirmed_at" timestamp with time zone,
  "disputed_at" timestamp with time zone,
  "dispute_resolved_at" timestamp with time zone,
  "dispute_resolution" text
);
--> statement-breakpoint
ALTER TABLE "payout_events"
  ADD CONSTRAINT "payout_events_submission_id_submissions_id_fk"
  FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payout_events"
  ADD CONSTRAINT "payout_events_creator_id_users_id_fk"
  FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payout_events"
  ADD CONSTRAINT "payout_events_clipper_id_users_id_fk"
  FOREIGN KEY ("clipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- ── Useful indexes for trust-score queries (M3.1) ───────────────────────────
CREATE INDEX IF NOT EXISTS "payout_events_creator_id_idx" ON "payout_events" ("creator_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_events_clipper_id_idx" ON "payout_events" ("clipper_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_events_created_at_idx" ON "payout_events" ("created_at");
