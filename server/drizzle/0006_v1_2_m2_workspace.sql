-- v1.2 M2 — promoter workspace + creator roster schema additions
--
-- New columns:
--   campaigns.traffic_rules         — markdown rules surfaced in promoter workspace
--   submissions.last_clicks         — snapshot for click-delta computation in cron
--
-- Neither column is required at API time; both default to safe values.

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "traffic_rules" text;
--> statement-breakpoint

ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "last_clicks" integer DEFAULT 0 NOT NULL;
