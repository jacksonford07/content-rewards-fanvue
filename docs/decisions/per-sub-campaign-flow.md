# Per-Subscriber Campaign Flow — Decisions

Materially different from per-1k-views: no clip artefact, tracking link is the deliverable, creator sees live progress, settlement can happen any time.

## Spec (from 2026-05-04 alignment)

- **A.** Per-campaign choice: `application_mode = auto | manual`. Auto-grant = link minted on apply. Manual = creator has 24h to approve/deny; auto-denies on timeout.
- **B.** End date required for per-sub; default `+30 days`. Accrual stops at `ends_at`.
- **C.** Ban a clipper → `DELETE /tracking-links/{uuid}` so attribution stops.
- **D.** Per-views flow untouched. Only per-sub uses this new path.
- **E.** Campaign end fires on either `ends_at` passing or a creator-triggered close. All active per-sub submissions flip to `ready_to_pay`. A frequent budget-cap cron also flips them early if accrued earnings would exceed the campaign budget.

## Decisions

### D1 — Submission state reuse, no new enum values
- per-sub auto: clipper applies → `approved` (link minted, accruing).
- per-sub manual: clipper applies → `pending` (creator has 24h) → `approved` (mint + accrue) or `rejected` (auto-deny or manual deny).
- Either path → `ready_to_pay` → `paid_off_platform` / `disputed`.

Reuses existing states. No DB enum churn.

### D2 — `post_url` and `platform` become nullable
Per-sub has no clip artefact. Drop NOT NULL. Per-views still requires both at the API layer.

### D3 — `auto_approve_at` is overloaded by campaign type
- per-views, status=`pending`: timeout → auto-approve at 48h.
- per-sub manual, status=`pending`: timeout → auto-reject at 24h.

Same column, semantics depend on `campaigns.payout_type`. Cron checks the join.

### D4 — Apply endpoint is `POST /campaigns/:id/apply`
Distinct from `POST /submissions` (which stays per-views). Cleaner than overloading submit with a discriminator.

### D5 — Two new cron jobs
- `POST /api/cron/sweep-campaign-end` (hourly): finds campaigns with `payout_type = per_subscriber` AND `ends_at < now` AND `status != completed`, flips all active per-sub submissions on those campaigns to `ready_to_pay` + marks campaign completed.
- `POST /api/cron/check-budget-cap` (every 30 min): per active per-sub campaign, sums `pending_earnings_cents` across active submissions; if `total_pending + budget_spent > total_budget`, freezes the campaign by flipping active submissions to `ready_to_pay` early.

Existing `sync-subscribers` cron stays (every 6h) — it skips submissions whose campaign has ended.

### D6 — Banning revokes the tracking link
`SubmissionsService.ban` for a per-sub submission also calls `FanvueTrackingLinksService.deleteLink` with the saved `uuid`. Failures logged but not blocking (so the ban itself always succeeds).

### D7 — Creator dashboard: extend `/creator/campaigns/:id/budget`
Add a "Clippers" panel listing each per-sub applicant with handle, slug, acquired subs, projected earnings, status, and a Mark paid button. Same page already shows budget — natural home.

### D8 — Council not invoked
Spec was crisp, decisions follow from the spec. Reserve council for future v1.2 features where the spec is ambiguous.

## Out of scope for this PR

- Per-sub view-count display (irrelevant — sub count is the metric)
- Public/searchable directory of "currently accepting applications" filter
- Per-sub-specific trust score weighting
- Tier B blockchain verification (tracked separately in M2.6 spike)
