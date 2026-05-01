# CTO Code Review — handover branch

> Review of the uncommitted WIP that's now on `handover/wip-payments-pivot`.
> Generated 2026‑05‑01 against the diff documented in [`HANDOVER.md`](./HANDOVER.md).

## Summary

Mid‑pivot from in‑app payments to off‑platform payouts. Adds `PAYMENTS_V1_ENABLED` flag to fence wallet/escrow/budget surfaces, introduces a clipper payout‑method profile + payout‑settings page, an off‑platform "mark paid" flow on the inbox, and `acceptedPaymentMethods` on campaigns. Also swaps the Instagram scraper to a new RapidAPI host with a unit test, and patches a long‑standing analytics bug where `viewsAtDay30` (only ever set at settle time) under‑reported lifetime views — totals now fall back to `lastViewCount` for live submissions.

**Not ready to merge** — there is a real privacy leak in the submissions API and the schema additions have no migration on disk.

## Verdict

**REQUEST CHANGES**

## 🚨 Critical Issues (Must Fix Before Merge)

### C1. Clipper contact + payment details leak via unauthenticated `byCampaign`
- `server/src/submissions/submissions.controller.ts:62-68`
- `server/src/submissions/submissions.service.ts:532-556`, `:1015-1050`

**Risk.** `GET /submissions/campaign/:campaignId` has no ownership check. Any logged‑in user can pass an arbitrary `campaignId`, and `enrichSubmissions` will return `fanContactMethod`, `fanContactHandle`, `fanPaymentMethods` (PayPal email, BTC address, bank details, @cashtag…), plus `paymentMethodUsed` and `paymentReference` for every approved/auto_approved/paid submission on that campaign. PII + financial‑instrument exposure.

**Fix.** Pass `req.user.id` into `byCampaign`, look up the campaign and 403 if `creatorId !== req.user.id`, and forward the requesting user id into `enrichSubmissions` so `exposeContact` compares against the **requester**, not against the campaign's own creator id (see C2).

---

### C2. `exposeContact` gate is structurally always true
- `server/src/submissions/submissions.service.ts:1019-1023`

**Risk.** `const isCreatorView = creator?.id === campaign?.creatorId` compares a value loaded by `creatorsMap.get(campaign.creatorId)` against `campaign.creatorId` — it's tautological. There is no actual check that the requester is the campaign owner. `paymentSentAt`, `paymentMethodUsed`, `paymentReference` (lines 1072‑1074) are returned **outside** the ternary unconditionally regardless of the gate.

**Fix.** Take a `requesterId` argument in `enrichSubmissions`, gate `exposeContact` on `requesterId === campaign?.creatorId`, and move the three `payment*` fields inside that gate.

---

### C3. No Drizzle migration committed for the new columns
- `server/src/db/schema.ts:67-71`, `:117-122`, `:181-184`
- `server/drizzle/` only contains `0000_hot_absorbing_man.sql`

**Risk.** `users.contactMethod`, `users.contactHandle`, `users.paymentMethods`, `campaigns.acceptedPaymentMethods`, `submissions.paymentSentAt | paymentMethodUsed | paymentReference` are referenced by select/insert/update queries. First `me()` call after deploy crashes (`column does not exist`) unless someone runs `db:push` against prod. Per project rules: migrations, not push.

**Fix.** `npx drizzle-kit generate` → commit the SQL → `migrate deploy` in CI. Don't ship without it.

---

### C4. `'verified'` is not a valid submission status (10 occurrences)
- `server/src/campaigns/campaigns.service.ts:193, 280, 313, 324, 367, 382, 834, 877`
- `server/src/analytics/analytics.service.ts:42, 115`

**Risk.** Every new SQL CASE filters `status IN ('approved','auto_approved','verified','paid')`. The submissions enum is `('pending','approved','rejected','auto_approved','paid','flagged')` — there is no `verified`. The branch is dead today and silently confusing tomorrow.

**Fix.** Remove `'verified'` from all 10 occurrences (or replace with `'flagged'` if that was the intent — but flagged probably shouldn't count toward reported views).

---

### C5. `markPaid` does not enforce campaign budget cap
- `server/src/submissions/submissions.service.ts:669-769`
- gated only client‑side at `src/pages/creator-inbox-page.tsx:478-482`

**Risk.** Concurrent paying creators (or inflated views) can drive `budgetSpentCents` past `totalBudgetCents`. With payments off‑platform there's no real money at risk, but analytics ("Total spend", remaining budget, completion logic) silently lie and `checkCampaignCompletion` may misbehave.

**Fix.** Server‑side cap check before update. Either clamp `payoutCents` to remaining budget, or 400 with a clear error and let the UI surface it.

---

### C6. `useEffect` hydration depends on `user?.id` but reads other user fields
- `src/pages/payout-settings-page.tsx:47-52`

**Risk.** `useEffect(() => { … }, [user?.id])` won't re‑hydrate when `user.paymentMethods` changes from elsewhere (other tab, refetch after invalidate). Local state silently goes stale.

**Fix.** Depend on the actual fields, or stringify: `[user?.id, user?.contactMethod, user?.contactHandle, JSON.stringify(user?.paymentMethods)]`.

---

## ⚠️ Warnings (Should Fix Soon)

- **`paymentMethodUsed` is the human label, not the type** — `src/pages/creator-inbox-page.tsx:495-498` sends `paymentMethodLabel(payMethod)` (e.g. "PayPal"). Server stores that label verbatim. Audit/reporting later will need the canonical type. Send the `PaymentMethodType` enum value; render the label client‑side.
- **Server‑side type assertion drops validation** — `server/src/campaigns/campaigns.service.ts:444-445`, `:533-535`. `data.acceptedPaymentMethods as schema.PaymentMethodType[]` accepts any string array from the API. If a creator posts `["btc","shitcoin"]`, it lands in the DB. Validate against `VALID_PAYMENT_TYPES` like `users.service.ts` already does (lift that constant out into a shared validator).
- **`status` query param cast in `byCampaign` includes `'paid'` twice** — `server/src/submissions/submissions.service.ts:543-544`. Cosmetic + missing `'flagged'`. Replace with a `const STATUSES` literal‑tuple.
- **`postedAt` removed from Instagram scrape result** — `server/src/scrapers/instagram-scraper.service.ts` no longer populates `postedAt` (the new API doesn't expose `taken_at_timestamp`). Anything downstream relying on `postedAt` for IG (e.g., 30‑day lock‑date math, freshness checks) silently degrades. Audit consumers; if dropping is intentional, document it.
- **`useUpdateMe` invalidates auth, but `payout-settings-page` calls `refresh()` too** — `src/pages/payout-settings-page.tsx:105`. Double refetch, cosmetic.
- **No empty‑state or loading state on payout‑settings page** — `src/pages/payout-settings-page.tsx:115`. If `user` is undefined the page renders an empty form bound to `""`. Add a skeleton or early return.
- **`"Become a creator on Fanvue"` still on the login page** — `src/pages/login-page.tsx:277`. Meeting bug #3 — KYC is gone but the marketing string persists.
- **Server `package.json` jest mapper is correct** for the ESM `.js` import style, but CI doesn't yet have a `test:scrapers` script. The new spec is the only test file that matters today — make sure CI runs it.

## 💡 Suggestions

- Lift `VALID_PAYMENT_TYPES` / `VALID_CONTACT_METHODS` out of `users.service.ts` into `db/schema.ts` (or a `validation.ts`) so `campaigns.service.ts` can reuse them — one source of truth.
- `feature-flags.ts` is a single hard‑coded const — fine for v1, but you'll get bitten when you want it per‑environment. Read from `import.meta.env.VITE_PAYMENTS_V1_ENABLED` with a default.
- The `inboxStats` change (`creator-inbox-page.tsx:525-528`) reuses `filterInboxByTab` which still references `'paid'` — make sure the "paid" tab count drives the off‑platform "Ready to pay" badge correctly.
- `markPaid` notification copy `"Payout sent: $X"` lies if the creator hasn't actually sent it yet. Consider "Marked as paid by <creator>".
- `paymentReference` is stored truncated to 200 chars in `markPaid` (good) but the column has no length constraint. Add `varchar(200)` or document the truncation.
- The off‑platform branch in `campaign-card.tsx` (`{available} of {totalBudget}`) reads as available‑out‑of‑total but is calculated using `budgetSpent`, which is meaningless without payments. Either show "Budget cap: $X" alone, or show progress toward cap based on `markPaid` totals.

## 🐞 Known Meeting Bugs — Status in this Diff

| # | Bug | Status | Evidence |
|---|---|---|---|
| 1 | Breadcrumb on My Campaigns navigates to hub | **unfixed** | `src/components/page-header.tsx` has no breadcrumb at all; `creator-campaigns-page.tsx:206` uses `PageHeader` without a breadcrumb prop. The bug lives wherever the actual breadcrumb component is — not touched here. |
| 2 | OAuth fails when switching creator/non‑creator | **unfixed** | No changes in `server/src/auth/*` or the cookie/JWT flow. `auth.controller.ts:68-70` still hard‑rejects with `NotACreatorError`. (`main` has commit `dbf31c7` "Force Fanvue re‑auth on login and clear query cache on session switch", but it's not on this WIP branch yet.) |
| 3 | "Become a creator" button still present | **unfixed** | `src/pages/login-page.tsx:277` still ships the string. |
| 4 | Platform dropdown should be removed (auto‑detect from URL) | **unfixed** | `src/pages/create-campaign-page.tsx:625-660` still renders the explicit platform multi‑select. URL detection (`detectPlatform` in `scrapers.types.ts`) exists server‑side but isn't wired here. |
| 5 | "Shorts" should be removed from platform options | **unfixed** | `src/pages/hub-page.tsx:47` and `src/lib/mock-data.ts:4` still say `"YouTube Shorts"`; `login-page.tsx:81,104` reference Shorts in marketing. |
| 6 | Payment removal half‑done | **mostly addressed** | `PAYMENTS_V1_ENABLED=false` gates wallet sidebar/topbar, budget routes, fund step, "Total spend" KPIs, "Complete & refund". **But** `campaign-card.tsx` still computes spent/reserved from old fields, the create‑campaign step‑6 escrow UI is dead‑code‑fenced rather than removed, and `users.service.ts`/auth still hand out `walletBalance`. The fence is acceptable for "flip back on" but is not "removed". |

## ✅ What's Good

- The Instagram scraper rewrite is small, focused, and lands with a real spec covering URL parsing, fallbacks, deleted‑post detection, and 4xx/5xx/network errors. Good unit‑test discipline.
- The `viewsAtDay30 → COALESCE(viewsAtDay30, lastViewCount)` correction is a meaningful analytics fix — totals were under‑reporting live submissions before this.
- `PAYMENTS_V1_ENABLED` as a single source‑of‑truth flag (instead of deleting components) is the right call for a fast pivot. Reversibility matters.
- Server‑side validation in `users.service.ts updateMe` filters payment methods, trims values, caps note length. Properly defensive.
- `inbox` correctly scopes to creator‑owned campaigns and quietly returns empty for stale URLs (line 458‑466) — sensible UX.
- Clear, comment‑driven intent throughout the diff (e.g., the publish docstring, the `exposeContact` rationale). Future‑you will thank present‑you, **once the actual gate works**.

## ❓ Questions for Author

- **Migration story** — running `drizzle-kit push` in prod, or generating SQL? If the former, please switch — schema has no audit trail.
- Why does `acceptedPaymentMethods` allow editing on active campaigns (`campaigns.service.ts:534-537`) but not via the `update` happy‑path? Branching logic is duplicated; one path skips other validations.
- Should `markPaid` enforce `lockDate <= now` like the verify‑views path does, or is the off‑platform flow intentionally bypassing the 30‑day lock?
- Is `paymentReference` ever shown back to the clipper? Currently only on the creator‑side detail block — confirm whether the clipper should see "tx hash: 0x…" as proof of payment.
