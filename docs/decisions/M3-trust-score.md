# M3 — Trust Score — Decisions

## D1 — Compute on demand, no cached columns on users

**Decision:** Trust score is computed by SQL on each read (campaign list query, inbox query, profile API), not cached on the `users` table.

**Alternatives considered:**
- **Cached columns on users + recompute trigger** on every payout_event insert/confirm/dispute. Faster reads, more correctness surface (trigger ordering, race conditions, daily cron to age the 90-day window).
- **Materialized view** refreshed on payout_event change. Same trade-offs as cached columns, slightly cleaner.

**Why on-demand:**
- v1 scale: <100 creators, <500 payout_events expected in the first 3 months. Even unoptimised SQL with subqueries is sub-100ms.
- Cached columns add 8 numeric columns + a `trust_last_recomputed_at` to users; that's schema noise we can avoid.
- The 90-day window is a moving target — caching means a daily cron job. Computing means `WHERE created_at >= now() - interval '90 days'` and Postgres handles it.
- Indexes on `payout_events(creator_id)`, `(clipper_id)`, `(created_at)` (added in M2 migration) make the queries cheap.
- If v1.2 needs cached columns, easy to add.

## D2 — "Confirmed" payout includes 7-day auto-confirm

**Decision:** A `payout_event` counts as "confirmed" for trust-score math when:
1. `confirmed_at IS NOT NULL` (clipper explicitly confirmed), OR
2. `created_at < now() - 7 days AND disputed_at IS NULL` (auto-confirmed because clipper didn't act).

**Alternatives considered:**
- **Only explicit confirmations count.** Penalises creators when clippers ghost the confirmation prompt — that's not a creator failure.
- **All non-disputed payouts count immediately.** Skips the 7-day grace and weakens the trust signal.

**Why 7-day auto-confirm:**
- Mirrors CC1 D5 / M3.5 spec exactly. If the clipper had a problem, they had a week to flag it.
- A clipper who never confirms but never disputes is signalling indirectly that the payment landed (otherwise they'd have raised a dispute to recover).

## D3 — Trust scores are zero-population safe

**Decision:** Score returns `null` for the relevant window when there is no data, not 0%. UI renders empty states ("No reviews yet", "Inactive 60d") instead of falsy "0%".

**Alternatives considered:**
- **Default to 100%** for new accounts. Misleading.
- **Default to 0%**. Penalises new accounts forever — they'd never climb the hub sort.
- **Null + UI fallback** (this decision). Honest representation; sort treats null as "neutral" via the budget tiebreaker.

## D4 — Hub sort: `all_time_paid_count DESC, 90d_paid_count DESC, total_budget_cents DESC`

**Decision:** Default campaign-hub sort is by `all_time_paid_count` first, then `90d_paid_count` as tiebreaker, then `total_budget_cents` final tiebreaker.

**Alternatives considered:**
- **Sort by `paid_rate` instead of count.** A creator with 1/1 payouts (100% rate) outranks one with 95/100 (95%) — wrong: small samples are noisy.
- **Use a Bayesian average** to handle small-sample creators. Overkill for v1.
- **Don't sort by trust at all.** Loses the marketplace self-regulation goal.

**Why count over rate:**
- Volume is the strongest signal of "this creator actually pays". A high rate with low count is just a small sample.
- 90d count as tiebreaker rewards recent activity over dormant accounts.
- Budget as final tiebreaker means well-funded campaigns surface in ties.
- New creators (`all_time_paid_count = 0`) fall to budget-only sort, which keeps them ranked but not at the bottom forever.

## D5 — Disputes route to a DB-backed admin queue (no Slack)

**Decision:** Per CC1 D4 + M3.6 ticket revision, disputes write a `payout_events.disputed_at = now()` row and surface in `/admin/disputes` (email-gated). No Slack webhook, no email, no notification infra.

**Alternatives considered:** see CC1 D4. User explicitly pushed back on Slack webhooks for solo-dev review volume.

## D6 — Clipper trust score is `approval_rate × dispute_free_rate`

**Decision:** Per M3.7 ticket. Both factors in `[0, 1]`; product gives a single `[0, 1]` clipper score.

- `approval_rate` = `(approved + auto_approved) / decided` where decided = total - pending
- `dispute_free_rate` = `(payouts - rejected_disputes) / payouts`, or 1 when payouts = 0

**Alternatives considered:**
- **Sum / average** instead of product. Less punitive — a clipper with 50% approval and 50% dispute-free still gets 50% rather than 25%. Wrong incentives: dispute-prone clippers should rank lower.
- **Weighted average**. Adds a tuning parameter we don't have data to set.

**Why product:** if either dimension is bad, the clipper is bad. Multiplying enforces that.

## D7 — Council not invoked for M3

**Decision:** No council needed.

The contested M3 forks resolved cleanly:
- D1 (on-demand vs cached): obvious from v1 scale
- D2 (auto-confirm): mirrors PRD spec
- D3 (null vs zero): obvious from the user's "no reviews yet" empty-state ask
- D4 (sort order): user gave the rule explicitly in the scoping call
- D6 (product vs sum): basic statistics

If something turns out to be controversial during M3 implementation, will spin up the council then.
