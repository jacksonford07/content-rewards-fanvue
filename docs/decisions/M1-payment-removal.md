# M1 — Payment Removal & Polish — Decisions

Decisions made while implementing M1, with the alternatives considered and the reason each was chosen. Source of truth for "why is this shaped this way?" when reviewing the M1 PR.

## D1 — Delete wallet code, do not feature-flag

**Decision:** Delete wallet/KYC code outright. No feature flag.

**Alternatives considered:**
- **Feature-flag behind `PAYMENTS_V1_ENABLED`** (the original PRD §5 M1.1 plan). Keep types and components so a flag flip restores billing.
- **Soft-delete by commenting out routes**. Leaves dead code lying around to be picked up later.

**Why deletion:**
- In-app billing is not realistic in <6 months (decided 2026-05-01 with Iniaki). Gated dead code rots — dependencies drift, types stop matching, the flag never gets flipped back, and review noise piles up around code nobody owns.
- Git history is the rollback mechanism: `git revert` of M1.1/M1.2/M1.3 is a clean restore if billing returns.
- Tracker decision logged in CC1.

## D2 — Three sequential commits for wallet removal (UI → API → DB)

**Decision:** Three discrete commits inside the M1 PR — `M1.1` (UI), `M1.2` (API), `M1.3` (DB drop) — instead of one squashed commit.

**Alternatives considered:**
- **Single squashed commit "remove the wallet"**. Cleaner SHA to point at, but loses incremental rollback.
- **Three separate PRs**. Goes against the "one PR per milestone" rule the user set.

**Why three commits in one PR:**
- Each commit leaves the app functional (UI gone but backend serves dead routes; backend gone but DB still has unused tables).
- If `git bisect` finds a regression, it lands on the right layer.
- The destructive `DROP TABLE` (M1.3) is the last commit, so a "stop before this if anything looks wrong" point exists in history.
- Single PR for milestone-level review still works — reviewer reads commits in order.

## D3 — Remove the "Fund campaign" step from create-campaign flow

**Decision:** Step 6 ("Fund — Escrow payment") of the campaign creation flow is removed. Campaigns publish directly to `status = "active"` after step 5.

**Alternatives considered:**
- **Keep step 6 but rebrand it as "Review"**. Would still be a step, just no payment. Adds a click for no reason.
- **Punt the create-campaign refactor to M2**. Would leave step 6 calling the dead `/campaigns/:id/fund` endpoint between M1.1 and M1.2.

**Why removal now:**
- The escrow funding step only existed because we held money in-app. v1.1 doesn't, so the step is meaningless.
- `handlePublish` now calls `saveCampaign("active")` directly. No `fundMutation`, no wallet check, no top-up dialog.
- Stepper drops from 6 steps to 5 (Basics → Requirements → Source → Platforms → Rewards). The publish CTA moves to step 5.

## D4 — `pending_budget` campaign status retained on the enum (frontend), backfilled in DB

**Decision:** Don't remove `pending_budget` from the `campaigns.status` enum yet. Backfill any existing rows to `active` in M1.3. Code stops *writing* the value but the enum keeps it for historical row safety.

**Alternatives considered:**
- **Drop `pending_budget` from the enum in M1.3**. Cleaner schema but requires every existing row first to be backfilled atomically inside the same migration, and a Drizzle enum drop on Postgres is awkward (need to recreate the type).
- **Keep `pending_budget` in code forever**. Cruft that confuses future readers.

**Why backfill-but-keep-enum-value:**
- M1.3 backfills `pending_budget` → `active`. After backfill, no rows reference the value, so the enum value is unused.
- A follow-up cleanup PR (M2 or v1.2) can drop the enum value when it's clearly orphaned. Doing it inside the destructive M1.3 migration adds risk for low payoff.

## D5 — Campaign budget page kept but trimmed; not deleted

**Decision:** `src/pages/campaign-budget-page.tsx` stays. Removed: "Add funds" button + dialog, "Complete & refund" button + dialog, the 4-card budget panel. Remaining: a simplified header with total budget + paused state, plus a placeholder for off-platform payout history that M2/M3 will fill in.

**Alternatives considered:**
- **Delete the page entirely**. Would orphan inbound links from creator-campaigns kebab menus. Existing campaigns reference `/creator/campaigns/:id/budget` URLs.
- **Replace with a redirect to inbox**. Loses the page as a future home for off-platform payout tracking.

**Why trim:**
- M3 (trust score + dispute admin) and M2 (payout_events) need a creator-side place to view per-campaign payout history. This page is the natural home — leaving it in place avoids a route shuffle later.
- For v1.1 it shows: campaign title, total declared budget, status, no-op transaction history. Visually intentional ("nothing has been paid out yet, off-platform tracking arrives in M2").

## D6 — `isCreator`, `kyc_status`, `wallet_balance_cents` columns dropped in M1.3

**Decision:** All three columns dropped in the M1.3 migration. `isCreator` was redundant with `role === "creator"`. KYC status and wallet balance are dead.

**Alternatives considered:**
- **Keep `isCreator` as a denormalized cache for query speed**. Premature optimization — the app already filters on `role` everywhere except the seed scripts and one fanvue-oauth check.
- **Soft-deprecate columns by writing nulls only**. Same dead-code problem D1 rejected.

**Why drop now:**
- `seed.ts` and `fanvue-oauth.service.ts` are the only places writing these columns; both are updated as part of M1.2/M1.3.
- Backfill is trivial — no rows depend on these values for runtime decisions; everything reads from `role` instead.

## D7 — Bug fixes B1, B4, B5 in the same M1 PR

**Decision:** Bundle B1 (breadcrumb), B4 (platform selector), B5 (Shorts label) into the M1 PR after the wallet-removal commits.

**Alternatives considered:**
- **Separate `fix/M1-bugs` PR**. More granular review but doubles the merge ceremony for ~30 lines of changes.
- **Defer to M2**. Bugs reported pre-launch should land before any complex feature work.

**Why bundle:**
- All three bugs are in scope for the M1 milestone per CC1 / PRD §5 M6.
- They're independent enough to be reviewed commit-by-commit even within one PR.
- Each bug fix is one self-contained commit at the tail end of the PR — easy to skip if needed.

## D8 — B4 removes the manual platform Select on submit, not the campaign-create platform multi-select

**Decision:** B4 removes the redundant **single-platform Select dropdown** that appears in the clipper's "Submit clip" dialog (`campaign-detail-page.tsx`). The campaign-create platform multi-select (which platforms the creator allows clips on) stays — it's a real choice, not redundant.

**Alternatives considered:**
- **Read B4 as "remove the platform multi-select on campaign create"**. The PRD wording ("Remove platform selector on campaign create") is ambiguous, but creators legitimately need to declare allowed platforms — removing that breaks the campaign model.
- **Keep both selectors**. Status quo, but the per-submission Select is provably redundant since `detectedPlatform` already auto-fills it from URL parsing.

**Why removal of the submit-dialog Select only:**
- The post URL → platform inference is deterministic (`tiktok.com` / `instagram.com` / `youtube.com|youtu.be`). The current code auto-fills the Select and shows an error if the user contradicts it — i.e. the Select is decorative.
- The campaign-create multi-select represents a creator preference, not a duplicate of URL inference. Different concern, different ticket.
- If anyone disagrees with this read, the change is one commit to revert.

## D9 — B5 keeps `/shorts/` regex in the YouTube scraper

**Decision:** B5 changes user-facing copy from "YouTube Shorts" to "YouTube" in `platformLabels`, hub filter chips, and onboarding marketing. The `/shorts/` URL pattern in the YouTube scraper regex stays.

**Alternatives considered:**
- **Treat /shorts/ URLs as their own platform**. The whole point of B5 is to *not* do this.
- **Strip `/shorts/` from the regex**. Would break submissions of YouTube Shorts URLs, which are legitimate YouTube videos.

**Why keep the regex:**
- "YouTube Shorts" is a distribution surface within YouTube — not a separate platform. The URL regex needs to match `/shorts/` because that's where Shorts content lives.
- The user-facing label should not separate them — a clipper posting to YouTube Shorts should select "YouTube".

## D10 — Council not invoked for any M1 decisions

**Decision:** No agent council needed for M1.

**Why:**
- Every fork above resolves cleanly from CC1 (the 2026-05-01 scoping log) plus the principle "minimum surface area, simplest correct path".
- The council is reserved for moments where the principles don't pick a winner. M1 didn't produce one. M2 (validators library, schema design for crypto fields) is more likely to.
