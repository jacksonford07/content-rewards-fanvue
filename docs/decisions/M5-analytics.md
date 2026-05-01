# M5 — Analytics (PostHog) — Decisions

## D0 — Scope flipped from deferred to v1

**Original CC1 D7:** PostHog deferred entirely; no analytics in v1.
**Change:** User instructed to "complete M2, M3, M4, M5" — all milestones now in scope. Implementing v1 PostHog wiring now rather than as a post-launch sweep.

The risk noted at CC1 ("off-platform payment funnel will be unmeasured at launch") was real; landing M5 inside v1.1 retires it.

## D1 — Manual capture, auto-capture off

**Decision:** PostHog initialised with `autocapture: false`. Events fire only via explicit `posthog.capture()` calls at the 8 trigger points listed in the M5.2 ticket.

**Why:**
- Auto-capture surfaces a flood of click/pageview noise we don't need at v1 scale and the privacy posture costs aren't worth it for the marketplace funnel data we actually want.
- 8 explicit events with documented property schemas → reproducible queries; no event-shape drift over time.

## D2 — Client-side only; no Node-side telemetry

**Decision:** All capture calls fire from the frontend. No PostHog Node SDK on the server.

**Alternatives considered:**
- **Server-side capture** for events triggered by background jobs (e.g. `tracking_link_minted` happens server-side on submission approve). More accurate.
- **Mixed** — server-side for backend-only events, client for user-action events. Adds two SDKs to maintain.

**Why client-only:**
- Most of the 8 events have a corresponding client-side trigger (mutation `onSuccess`). The exceptions are `tracking_link_minted` (mints server-side on approve) and possibly auto-confirm timeouts (M3.5 7-day grace fires server-side).
- For `tracking_link_minted` we fire the event client-side when the clipper *first sees* the link in their submissions list (deduped via localStorage). Lossy compared to server-side, but acceptable at v1 volumes.
- Auto-confirms aren't worth instrumenting — they're a count we'll derive from `payout_events` SQL when we need it.

## D3 — `identify` on every auth refresh; `reset` on logout

**Decision:** PostHog `identify(user.id)` fires on `useAuth` resolving a user (including after refreshes). `reset()` fires on logout.

**Why both calls every refresh:** identify is idempotent. Calling it on auth refresh ensures the distinct_id stays correctly tied even if PostHog drops state (e.g. localStorage cleared). No-op when distinct_id matches.

## D4 — Property schemas frozen now

**Decision:** Each of the 8 events ships with a fixed property schema. Future additions land as new properties, never renames.

| Event | Properties |
|---|---|
| `campaign_created` | campaign_id, payout_type, accepted_payout_methods (string[]), is_private, total_budget |
| `submission_created` | submission_id, campaign_id, platform |
| `submission_approved` | submission_id, campaign_id, payout_type |
| `submission_marked_paid` | submission_id, campaign_id, method, amount, has_tx_hash |
| `payment_confirmed` | submission_id, campaign_id |
| `payment_disputed` | submission_id, campaign_id, method |
| `tracking_link_minted` | submission_id, campaign_id, slug |
| `payout_settings_saved` | methods_count, has_contact |

**Why freeze now:** rename-happy event schemas make funnel queries break. Adding properties later is forward-compatible; renaming isn't.

## D5 — Dashboard ships as a Notion checklist, not a PostHog dashboard

**Decision:** M5.3 (dashboard) ships as a documented list of recommended PostHog Insights to set up post-launch, not pre-built configuration.

**Why:**
- PostHog dashboards are configured via UI, not committed code.
- Pre-building dashboards with zero data is busywork; the actual queries shake out once real events flow.
- Documented in `docs/analytics/posthog-dashboard.md` so anyone can recreate.

## D6 — Council not invoked

**Decision:** No council needed.

The contested forks resolved cleanly:
- D1 (auto-capture off): obvious from "explicit funnel events" PRD spec
- D2 (client-only): 80/20 simplicity bet, acceptable lossiness
- D3 (always-identify): obvious from PostHog idempotency
- D4 (frozen property schemas): obvious from "events without rename" hygiene
