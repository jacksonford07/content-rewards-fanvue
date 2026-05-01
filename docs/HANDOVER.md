# Content Rewards — Handover Status

Snapshot of the codebase on the `handover/wip-payments-pivot` branch. Captures what shipped, what's mid-flight, what's still queued, and the known issues raised in the 2026‑05‑01 product call.

For file‑level review with bug citations, see [`CTO_REVIEW.md`](./CTO_REVIEW.md).

> **🚨 Read [`CTO_REVIEW.md`](./CTO_REVIEW.md) before merging.** The WIP currently leaks clipper PII + payment details (PayPal email, BTC address, bank details) via `GET /submissions/campaign/:campaignId` — no ownership check, and the `exposeContact` gate is tautological. There are also no Drizzle migrations on disk for the new columns; first prod request crashes without `db:push`. **Do not merge to `main` until C1‑C5 are fixed.**

---

## Stack

- **Frontend** — React 19 + Vite, TanStack Query, Tailwind v4, shadcn/radix UI primitives, react-router 7
- **Backend** — NestJS 11, Drizzle ORM, Neon (Postgres), Passport JWT
- **Auth** — Fanvue OAuth → JWT
- **AI** — `@anthropic-ai/sdk` for submission verification (Claude Sonnet 4.6)
- **Hosting** — Vercel (frontend), backend env via `VITE_API_URL`
- **Run locally** — `pnpm dev` from the project root (boots Nest API + Vite via `concurrently`)

---

## ✅ Done

### Creator surface
- Campaign hub: active campaigns, total clippers, total views, total spend, top‑performer leaderboard
- Campaign list (public + private) with detail drill‑in
- Submissions inbox with manual approval / rejection
- 48‑hour auto‑approve fallback for un‑actioned submissions
- Network‑effect view of other creators' campaigns
- Creator‑to‑creator browsing
- Creator analytics (active clippers, CPM, total spend, total views)
- Instagram trends deep‑link
- Ban‑clipper action (currently visible to creators)

### Clipper surface
- Campaigns browse page
- Submissions list with status
- Earnings page (read‑only, off‑platform model)
- Notifications inbox

### Backend
- NestJS API wired to the frontend (replaces earlier mock layer)
- View‑count verification + AI submission verification (Claude Sonnet 4.6)
- 30‑day rolling accrual window after a clip is posted
- Pro‑rata pool splits on shared campaigns
- Private campaigns + leaderboards
- Vercel SPA rewrite so client routes survive refresh
- Axios client routed via `VITE_API_URL`

### Infra
- Force Fanvue re‑auth on login + clear query cache on session switch (latest commit on `main` — `dbf31c7`)

---

## 🟡 Half done (what's on this WIP branch)

### Payment removal — gated behind `PAYMENTS_V1_ENABLED` flag
- New flag in `src/lib/feature-flags.ts` set to `false` for v1 launch
- Wallet, withdrawals, in‑app balance surfaces are being wrapped behind the flag rather than deleted (so we can flip billing back on without code archaeology)
- Submission states renamed (e.g. `paid` → `ready_to_pay`) to match an off‑platform payout model
- **Still TODO**: confirm every wallet/escrow/balance surface is actually gated, not just the obvious ones; remove "Become a creator" CTA (KYC requirement is gone now that payments are off‑platform)

### Off‑platform payout method selection
- New `src/lib/payment-methods.ts` defines the source‑of‑truth list: PayPal, Wise, USDC (ETH/Sol), BTC, bank UK/US, Cash App, Venmo + contact channels (Telegram/WhatsApp/phone/email)
- New `src/pages/payout-settings-page.tsx` (~274 LOC) — clipper enters which methods they accept
- Create‑campaign page extended (+134 LOC) to let creators pick which methods they'll pay in
- **Still TODO**: mark‑paid flow on the creator side, validation per method type (address checksum / IBAN / sort code), persistence and round‑trip from API

### Creator inbox payouts (~+192 LOC)
- "Ready to pay" verified state
- Per‑submission contact + payout method surfaced to creator
- **Still TODO**: confirm + log the off‑platform payment, drive the trust score from this event

### Instagram scraper
- View‑scraping reliability fixes
- New unit test file `instagram-scraper.service.spec.ts` (228 LOC)
- **Still TODO**: confirm the test actually runs in CI; finish the scraper retry/backoff path

---

## 🔴 Known issues from the product call (2026‑05‑01)

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | Breadcrumb on submission detail returns to **hub**, should return to **My Campaigns** | Low | Single nav fix |
| 2 | OAuth fails when switching between creator and non‑creator accounts | High | Session/cache leak across roles. Latest `main` has a force‑re‑auth attempt — verify it actually fixes it, especially in PWA mode |
| 3 | "Become a creator" CTA still rendered in topbar | Low | Drop entirely — payments are off‑platform, KYC no longer required |
| 4 | Platform selector on create‑campaign | Low | URL auto‑detection works; remove the manual select |
| 5 | "Shorts" platform option | Low | Drop — not a supported destination |
| 6 | Payment removal half‑state | Medium | Wallet UI still partially reachable in some flows |
| 7 | Filter density on creator inbox | Low | Aesthetic, not blocking |

---

## 🚧 Not started

1. **Tracking link system** — per‑clipper unique tracking links generated when a campaign is set up, gated on Fanvue creator API permissions; enables pay‑per‑subscriber and unlocks traffic sources beyond IG/TikTok
2. **Trust score / payout reliability ranking** — Upwork‑style "100% payout rate" badge, verified by clippers confirming receipt; influences campaign visibility
3. **PostHog analytics** — track payment completion rates, engagement, average generations (cross‑project metric for Prism)
4. **Per‑subscriber payout toggle** on campaign setup (depends on tracking links)

---

## 🔑 Handover credentials needed

Per the call, Jackson to share:
- Creator account on Fanvue (Jackson Ford — confirmed available)
- Fan / non‑creator account
- GitHub branch access (now available — see `handover/wip-payments-pivot`)

---

## How to run locally

```bash
cd content-rewards-fanvue
pnpm install                       # if node_modules is missing
cp server/.env.example server/.env # fill in DB_URL, JWT_SECRET, FANVUE_*, ANTHROPIC_API_KEY
pnpm dev                           # boots api + web concurrently
```

Frontend on Vite default (5173), API on Nest default (3000). API base URL is read from `VITE_API_URL`.

---

## Where to look first

| Topic | File |
|---|---|
| Payments feature flag | `src/lib/feature-flags.ts` |
| Off‑platform method catalog | `src/lib/payment-methods.ts` |
| Clipper payout settings | `src/pages/payout-settings-page.tsx` |
| Creator campaign creation (payout types in flight) | `src/pages/create-campaign-page.tsx` |
| Creator inbox / mark‑paid flow | `src/pages/creator-inbox-page.tsx` |
| Auth / role switching | `src/hooks/use-auth.ts`, `src/queries/auth.ts` |
| Submission verification | `server/src/submissions/submissions.service.ts` |
| Drizzle schema | `server/src/db/schema.ts` |
