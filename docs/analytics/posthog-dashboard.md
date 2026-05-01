# PostHog dashboard — Content Rewards v1.1

This document lists the recommended PostHog Insights to set up post-launch.
Pre-built configuration isn't committed (PostHog dashboards are built in the
PostHog UI, not via code), but anyone with access can recreate the panels
from the queries below.

## Panels

### 1. Off-platform payment funnel
**Purpose:** does the payment loop close end-to-end?

Funnel:
1. `submission_approved`
2. `submission_marked_paid`
3. `payment_confirmed`

Metrics: conversion rate at each step, time-to-step.

### 2. Time-to-payment
**Purpose:** how long does a clipper wait between approval and confirmed payment?

Insight type: trends.
Series: time between `submission_approved` (per submission_id) and `payment_confirmed` (same submission_id).
Aggregation: median, P75, P95.

### 3. Top creators by trust
**Purpose:** which creators are paying reliably at v1?

Source: SQL Insight against the events stream — group `submission_marked_paid` and `payment_confirmed` by `campaign_id`, look up creator, sort by confirmed-rate.

(Or query the DB directly via `payout_events`. PostHog isn't the source of truth for trust score.)

### 4. Clipper retention curve
**Purpose:** how many clippers come back after their first submission?

Insight type: retention.
Cohort: users who fired `submission_created` for the first time.
Return event: `submission_created` (any subsequent).

### 5. Average submissions per clipper (Prism benchmark)
**Purpose:** signal for the Prism benchmarking metric the user mentioned during scoping.

Aggregation: count `submission_created` per distinct_id, average.

### 6. Dispute rate
**Purpose:** v1 sanity check on the off-platform model — are payments actually landing?

Trend: ratio of `payment_disputed` to `submission_marked_paid` over time.

### 7. Tracking link uptake
**Purpose:** are per-subscriber campaigns viable in v1?

Trend: count of `tracking_link_minted` per week.
Drill: by `campaign_id`.

### 8. Payout method distribution
**Purpose:** which methods are creators actually paying with?

Insight type: breakdown.
Event: `submission_marked_paid`.
Breakdown: `method`.

## Source events

Each panel above is built from the eight events instrumented in M5.2. Property schemas are frozen — see `docs/decisions/M5-analytics.md` D4 for the canonical list.

## Owners

- Initial dashboard build: deferred until after the first ~50 events have flowed (avoid pre-shaping queries with no data).
- Day-to-day dashboard owner: TBD post-launch.
