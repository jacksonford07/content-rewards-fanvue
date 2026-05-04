# M4 — Tracking Links — Decisions

## D1 — Implement against documented spec without live testing

**Decision:** M4 ships against the Fanvue tracking-link API as documented in `https://api.fanvue.com/docs/llms-full.txt`. Live testing waits for the user's Fanvue API key + a per-clipper test creator account.

**Why:**
- User explicitly approved this trade-off ("we can just assume that it's fine") to keep momentum.
- The 5 endpoints have full OpenAPI schemas — implementation is mechanical.
- Three open Q's still pending Fanvue team:
  1. Full redirect URL format for `fv-123`-style slugs
  2. Sandbox URL (probably none — production only)
  3. Rate limits
- For (1), a `formatTrackingUrl()` helper with a config-driven base will adapt to whatever shape Fanvue returns. Default assumes `https://fanvue.com/?ref=<slug>`.

## D2 — Store tokens on users; refresh-on-401 not refresh-tokens

**Decision:** Persist the Fanvue access token + scope list on the user row. On 401 from a tracking-link call, prompt the user to re-auth via the existing OAuth flow.

**Alternatives considered:**
- **Full OAuth refresh-token flow.** Cleaner; survives expiry without user interaction. Adds complexity Fanvue's `/oauth2/token` endpoint may not even support today.
- **Don't store tokens; ask the user to re-auth on every per-sub campaign create.** Worse UX.

**Why store + re-auth on 401:**
- Simplest path that works. v1 volumes are low; users will see at most one or two re-auth prompts.
- When Fanvue confirms refresh-token support, we add it as a follow-up.

## D3 — Mint links lazily, on submission `approve`, not on `accept`

**Decision:** A tracking link is minted at the moment the creator approves a submission (or auto-approval fires), not when the clipper submits. The link surfaces on the clipper's submission detail page after approval.

**Alternatives considered:**
- **Mint at submit time.** Wastes API calls on submissions that get rejected.
- **Mint on demand from the clipper's UI.** Adds a click; clipper has to visit the page to "claim" their link.

**Why on-approve:**
- One link per accepted clipper per campaign. Rejected submissions never get a link.
- The approval action is server-side and synchronous — clean place to call `POST /tracking-links` and persist the response.
- Re-approve / dev-fast-forward flows are idempotent (existing submission row's `tracking_link_uuid` is reused).

## D4 — Per-subscriber rate stored as cents-per-sub

**Decision:** Add `campaigns.rate_per_sub_cents` (integer). The per-1k-views rate stays as `reward_rate_per_1k_cents`. Only one is meaningful per campaign, picked by `payout_type`.

**Alternatives considered:**
- **Reuse `reward_rate_per_1k_cents`** for both, divided by 1000 to mean "per sub". Confusing — the unit changes per `payout_type`.
- **Single union field.** Loses validation distinctness.

**Why a separate column:** schema clarity. Costs 4 bytes per row. Different validation rules — per-sub rates are typically larger numbers (whole dollars per sub), per-view rates fractions of a dollar.

## D5 — Cron polls every 6h, mirrors view-tracking cadence

**Decision:** New cron job inside `server/src/cron/` that runs every 6 hours, fetches `GET /tracking-links` for each creator with at least one active per-sub campaign, computes deltas in `engagement.acquiredSubscribers` since last scrape, and applies pro-rata pool accrual identical to view-based math.

**Alternatives considered:**
- **More frequent polling** (1h). Better UX for clippers seeing earnings. Cost: 6× more API calls; rate-limit risk before we know the limits.
- **Webhook-driven.** Fanvue API doesn't document webhooks for tracking-link events.

**Why 6h:** mirrors the existing view cron and Fanvue's rate-limit posture (free tier–like behaviour assumed). Easy to tighten later.

## D6 — Per-link state lives on `submissions`, not a new table

**Decision:** Add `tracking_link_uuid` and `tracking_link_slug` columns to `submissions` directly.

**Alternatives considered:**
- **`tracking_links` join table.** More normalised but redundant — one submission = one tracking link in v1.

**Why on submissions:** 1:1 relationship; the join table would have the same row-cardinality. Save the schema noise.

## D7 — Council not invoked

**Decision:** No council needed.

The contested forks resolved cleanly:
- D1 (test without key): user-approved
- D2 (re-auth-on-401): simplest correct path
- D3 (mint on approve): obvious from "one link per accepted clipper"
- D4 (separate rate column): schema clarity wins over column reuse
- D5 (6h cron): mirrors existing pattern
- D6 (no join table): 1:1 cardinality

If Fanvue API behaviour surprises us during live testing (e.g. attribution model differs from documented first-click), spin up the council then.
