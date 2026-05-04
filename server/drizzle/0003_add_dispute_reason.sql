-- Adds payout_events.dispute_reason — clipper-supplied free text the
-- admin queue surfaces when reviewing the dispute.
ALTER TABLE "payout_events" ADD COLUMN IF NOT EXISTS "dispute_reason" text;
