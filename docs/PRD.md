# PRD — Content Rewards v1.1 (Off‑Platform Payouts + Tracking + Trust)

| | |
|---|---|
| **Owner** | Jackson Ford (jackson.ford@fanvue.com) |
| **Status** | Draft — based on 2026‑05‑01 handover call |
| **Repo** | `jacksonford07/content-rewards-fanvue` |
| **Target** | v1 launch — small creator/clipper cohort, no in‑app payments |
| **Last updated** | 2026‑05‑01 |

---

## 1. Background

Content Rewards is a two‑sided marketplace built on top of Fanvue OAuth that connects **creators** (who post bounties) with **clippers** (who clip and repost their content for a cut of the views). The MVP shipped with an in‑app wallet, view‑based payouts, and a creator‑vs‑clipper role distinction tied to KYC.

Two things are forcing a pivot before public launch:

1. **Payments cannot stay in‑app.** Doing in‑app payouts requires KYC on both sides, which collapses the fan/creator distinction and adds friction we can't justify pre‑PMF. We're moving payouts off‑platform — creators pay clippers directly via PayPal / Wise / crypto / bank / etc., and the app records that the payment happened.
2. **Per‑view bounties limit traffic sources.** A per‑subscriber payout model unlocks Instagram, TikTok, X, YouTube and beyond, but it requires per‑clipper tracking links so attribution doesn't get muddled.

This PRD scopes the four workstreams that take v1 from "demoable" to "launchable", plus the bug fixes raised in the handover call.

## 2. Goals

- Remove all in‑app payment surfaces (wallet, withdrawals, balance) without deleting the code — feature‑flag it so billing can return.
- Let clippers declare which payout methods they accept; let creators declare which they pay in; only allow submissions where the two overlap.
- Generate per‑clipper Fanvue tracking links so we can run pay‑per‑subscriber campaigns alongside pay‑per‑view.
- Ship a trust/reputation signal so reliable payers rank higher in clipper‑facing campaign listings (and reliable clippers rank higher for creators).
- Stand up PostHog so we can actually measure payment completion, engagement, and (cross‑product) average generations for Prism benchmarking.

## 3. Non‑goals

- Re‑introducing in‑app payments / escrow.
- Automating off‑platform payouts (no PayPal API integration in this scope).
- Custodying funds or holding money on behalf of users.
- Multi‑currency display or FX conversion.
- Mobile native apps (PWA only).
- KYC on either side for v1.

## 4. Users

- **Creator** — Fanvue creator running a campaign. Wants distribution, willing to pay clippers, doesn't want to chase clippers down for receipts.
- **Agency** — Manages multiple creator accounts. Same UX as a creator for v1; no separate role distinction needed.
- **Clipper** — Anyone with an audience or distribution edge on IG/TikTok. Gets paid out per views or per sub. Cares about getting paid reliably — that's why trust score matters.

## 5. Scope — workstreams

### 5.1 Payment removal (finish the half‑done pivot)

**Problem.** v1 shipped with a wallet, but we're not doing in‑app payments at launch. The wallet UI is partially gated but still reachable in some flows.

**Solution.**

- Audit every wallet / balance / withdrawal / escrow surface; gate behind `PAYMENTS_V1_ENABLED` (already defined in `src/lib/feature-flags.ts`, currently `false`).
- Remove the **"Become a creator"** CTA — KYC requirement is gone, anyone can create a campaign.
- Remove unused stub data paths (test funds, infinite balance) but keep types/components so flag flip restores billing cleanly.
- Update copy on submission states from `paid` semantics to `ready_to_pay` / `paid_off_platform` / `disputed`.

**Acceptance.**

- [ ] No reachable wallet UI when `PAYMENTS_V1_ENABLED=false` (creator side or clipper side)
- [ ] "Become a creator" CTA removed from topbar
- [ ] Onboarding screen updated to reflect off‑platform model
- [ ] Flipping the flag to `true` restores all billing surfaces with no broken types

---

### 5.2 Off‑platform payout method selection

**Problem.** Without in‑app payments, we need a way for clippers to declare *how* they accept money and for creators to declare *how* they pay. A clipper shouldn't be able to submit to a campaign whose payout methods they don't support.

**Solution.**

- **Clipper side** — Payout settings page (already scaffolded at `src/pages/payout-settings-page.tsx`) where clippers enter their accepted methods (PayPal, Wise, USDC ETH/Sol, BTC, UK bank, US bank, Cash App, Venmo) plus a contact channel (Telegram / WhatsApp / phone / email). Each method takes a typed value field with per‑method validation.
- **Creator side** — On campaign create, a multi‑select of payout methods this campaign will pay in. Default = all methods the creator has previously paid with.
- **Submission gate** — On the clipper's view of a campaign, hide / disable submit if there's no overlap between their accepted methods and the campaign's offered methods. Show "this creator pays in X, Y — add one of these to your payout settings to submit" inline.
- **Mark‑paid flow** — When a creator marks a submission paid, they pick which method they used (from the overlap), the value/handle they sent it to, and optional reference. Persisted as a `payout_event` row.

**Acceptance.**

- [ ] Clipper can save and update accepted payout methods + contact info
- [ ] Per‑method value validation (BTC checksum, sort code format, email shape, etc.)
- [ ] Campaign create requires ≥1 payout method selected
- [ ] Clipper sees clear blocked state on campaigns with no method overlap
- [ ] Mark‑paid records method, value snapshot, timestamp, by whom
- [ ] Mark‑paid event triggers the trust‑score recompute (see 5.4)

---

### 5.3 Per‑clipper tracking links (pay‑per‑subscriber)

**Problem.** We currently only support pay‑per‑view, which is mostly an IG/TikTok play. To unlock pay‑per‑subscriber and broader traffic sources, we need attribution that survives the share — and that means per‑clipper tracking links.

**Solution.**

- On campaign create, a toggle: **Payout type — per 1k views | per subscriber**.
- If per‑subscriber: requires the creator to have granted Fanvue tracking‑link permissions during OAuth scope. If the scope is missing, prompt re‑auth.
- When a clipper joins the campaign, the API mints a unique Fanvue tracking link via the creator's permissions and surfaces it in the clipper's submission page.
- Subscribers attributed to that link count toward the clipper's payout.
- Tracking persists for 30 days from clip post (consistent with existing accrual window).

**Dependencies.**

- Fanvue API: tracking‑link create endpoint + scope on OAuth.
- Need confirmation on attribution window and cookie/parameter behavior — see open questions.

**Acceptance.**

- [ ] Creator can choose payout type at campaign create
- [ ] Per‑subscriber campaigns require creator‑level Fanvue scope; missing scope prompts re‑auth
- [ ] Each accepted clipper gets a unique tracking link bound to their submission
- [ ] Subscriber count + earnings calculation correct against test cohort
- [ ] Per‑view path unchanged (no regression)

---

### 5.4 Trust score / payout reliability

**Problem.** With payouts off‑platform, clippers have no way to know which creators actually pay. Conversely, creators have no signal on which clippers are reliable. Without this, the marketplace doesn't function.

**Solution.** An Upwork‑style trust model.

- **Creator score** = `paid_submissions / verified_submissions` over a rolling window (suggest 90 days), shown as e.g. "100% payout rate · 24 paid".
- **Clipper score** = approval rate × dispute‑free rate, shown on the creator's submissions list.
- Verification: when a creator marks a submission paid, the clipper gets a "Did you receive payment?" confirmation. Both confirmed → counts toward score. Dispute → flagged for manual review (low‑volume, manual is fine for v1).
- Display: badge on creator profile cards, on the creator's campaign listings (so high‑payout creators show first), and on the clipper's submission row.
- Default ranking on the campaign browse page is sorted by creator trust score (with budget tiebreaker).

**Acceptance.**

- [ ] Trust score visible on creator profile + campaign cards
- [ ] Clipper confirmation flow on receipt of payment
- [ ] Dispute path (flag for review, hides score temporarily)
- [ ] Campaign list sort respects trust score

---

### 5.5 Bug fixes & polish (raised in call)

| # | Issue | Acceptance |
|---|---|---|
| B1 | Breadcrumb on submission detail returns to hub instead of "My Campaigns" | "My Campaigns" → submission detail → back returns to "My Campaigns" |
| B2 | OAuth fails when switching between creator and non‑creator accounts | Sign‑out fully clears Fanvue session + query cache; second login completes; verified in incognito + PWA |
| B3 | "Become a creator" CTA shouldn't be there | Removed |
| B4 | Platform selector on campaign create is redundant (URL auto‑detects) | Removed |
| B5 | "Shorts" should be removed from platform options | Removed |
| B6 | "Ban clipper" visible to creators | Decision: keep (creator's choice) — close as won't‑fix unless feedback says otherwise |
| B7 | Filter density on creator inbox | Aesthetic; revisit post‑launch |

---

### 5.6 Analytics — PostHog

**Problem.** We have no visibility into the payment‑completion funnel, nor cross‑product engagement metrics (Prism integration cares about average generations / user).

**Solution.**

- Stand up a Fanvue PostHog team / project.
- Identify on Fanvue user ID (cross‑product link).
- Events: `campaign_created`, `submission_created`, `submission_approved`, `submission_marked_paid`, `payment_confirmed`, `payment_disputed`, `tracking_link_minted`, `payout_settings_saved`.
- Dashboards: payment completion rate, time‑to‑payment, top creators by trust, clipper retention.

**Acceptance.**

- [ ] PostHog client wired in (`posthog-js`) with auto‑capture off, manual events only
- [ ] Identify on login, reset on logout
- [ ] Dashboard with the five core funnel events

> Note: per the call, this is "slightly premature" relative to user volume but worth doing now so we have signal at launch.

---

## 6. Action items checklist (from call)

- [ ] Fix breadcrumb navigation — "My Campaigns" button returns to campaigns page, not hub
- [ ] Fix OAuth login when switching between creator and non‑creator accounts
- [ ] Remove "Become a creator" button (no longer relevant)
- [ ] Remove platform selection dropdown on create‑campaign (auto‑detected from URL)
- [ ] Remove "Shorts" as a platform option
- [ ] Complete payment removal across the platform
- [ ] Add toggle/dropdown for payout type — per 1k views vs per subscriber
- [ ] Build tracking link system that mints per‑clipper links per campaign
- [ ] Implement trust score / reputation ranking based on payout history
- [ ] Add payout method selection to campaign setup (PayPal, crypto, bank, Wise, etc.)
- [ ] Set up PostHog for user behavior + payment completion tracking
- [ ] Jackson — share GitHub branch + creator + fan account creds
- [ ] Jackson — create project page and tickets from this PRD

## 7. Out of scope (for v1)

- Automated payouts via PayPal / Wise APIs
- Custodial wallet / escrow
- Multi‑currency
- Native mobile apps
- KYC
- Discord / Telegram bots for notifications

## 8. Open questions

1. **Fanvue tracking link API** — what's the scope name? Does it survive re‑auth? Are tracking links revocable per clipper if they're banned?
2. **Trust window** — 90 days, or all‑time with decay? What happens to a brand new account?
3. **Disputes** — manual review by whom for v1? Inbox to Jackson? A simple queue?
4. **Crypto payouts** — do we want USDC on Base too, or stick to ETH + Solana for now?
5. **Bank fields** — UK sort code + account is fine. Do we want IBAN for EU, or punt to Wise for non‑UK Europe?
6. **PostHog vs Amplitude** — Fanvue is migrating off Amplitude to PostHog. Confirm we're on PostHog only, no dual‑write.

## 9. Risks

- **OAuth role switching bug** — if it persists in PWA mode after the latest fix, it'll block dual‑account testing. Owner: verify fix on `dbf31c7` works in incognito + PWA.
- **Trust gaming** — colluding creator/clipper pairs could fake high trust scores. Mitigation: low volume manual review for v1, formalize in v1.1.
- **Tracking link permissions** — depends on Fanvue API team; if blocked, per‑subscriber ships behind per‑view.
- **Half‑done payment removal regressions** — anywhere we missed the flag, users can hit dead ends. Mitigation: explicit audit checklist in 5.1.

## 10. Milestones (suggested)

- **M1 — Polish & remove (1 week)** — bug fixes B1‑B5, finish payment removal (5.1)
- **M2 — Off‑platform payouts (1‑2 weeks)** — payout methods + mark‑paid (5.2)
- **M3 — Trust score (1 week)** — trust score + ranking (5.4)
- **M4 — Tracking links (2+ weeks, gated on Fanvue API)** — per‑clipper tracking + per‑sub payouts (5.3)
- **M5 — Analytics (parallelisable)** — PostHog (5.6)

## 11. Appendix — meeting context

- Source call: 2026‑05‑01 handover from external dev to Jackson
- Current state: WIP branch `handover/wip-payments-pivot` pushed to `jacksonford07/content-rewards-fanvue`
- Companion docs: `docs/HANDOVER.md` (status), `docs/CTO_REVIEW.md` (file‑level bug review)
- Tooling notes: build tracker exists for detailed task management; this PRD becomes the parent page; tickets to be sliced from §5.1‑5.6 acceptance criteria
