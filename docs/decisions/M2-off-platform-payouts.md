# M2 — Off-Platform Payouts — Decisions

Decisions made while implementing M2, with the alternatives considered and the reason each was chosen.

## D1 — `clipper_payout_methods` as a separate table, not JSONB on `users`

**Decision:** New `clipper_payout_methods` table with `(user_id, method, value)`. Unique constraint on `(user_id, method)`.

**Alternatives considered:**
- **JSONB column on `users`** with shape `{ paypal: "x", btc: "y", ... }`. Single row read, no join.
- **Wide nullable columns** on `users`: `paypal_handle`, `btc_address`, etc. Most schema-rigid, ugliest to extend.

**Why a separate table:**
- The `OverlapGate` query (M2.3) needs to ask "does clipper X accept any of campaign Y's methods?" — that's `WHERE method = ANY(campaign.accepted_methods)`, trivial on a row-per-method table, awkward to express on JSONB.
- New methods (USDT, ALGO, whatever) ship as data, not migrations.
- Matches the `payout_events` ledger (M2.4b) which is also row-per-event — symmetrical schema.
- Slight cost: one extra join on profile reads. Trivial at v1 scale.

## D2 — Validators inline as regex + checksum, no library deps

**Decision:** `src/lib/payout-validators.ts` implements per-method validation with hand-written regex + checksums (mod-97 IBAN, EIP-55 ETH, base58 Solana, bech32 BTC). No `viem` / `@solana/web3.js` / `bitcoinjs-lib` / `iban` packages added.

**Alternatives considered:**
- **Pull `viem` + `@solana/web3.js` + `bitcoinjs-lib` + `iban`**. Robust, well-tested, future-proof. Adds ~600KB to the bundle.
- **Skip checksum validation, just regex shape**. Cheap but lets typos through (1-character flips slip past).
- **Server-side validation only**. Fine for security but UX is worse — user has to submit to find out the address is bad.

**Why hand-written:**
- The four validators we need are <100 lines each. A 600KB bundle hit for "is this string an ETH address" is overkill.
- Each validator returns `{ valid, error }` and is unit-testable.
- If a checksum implementation has a bug, swapping in a real library later is a ~30-line change per method.
- Trade-off: somewhat brittle if Bitcoin/ETH/Sol address formats evolve. They don't, in practice; address formats are extremely stable.

## D3 — Mark-paid recompute is synchronous (no queue)

**Decision:** When the creator marks a submission paid, the `payout_events` insert and trust-score recompute happen inline in the request, not queued.

**Alternatives considered:**
- **Background queue (BullMQ / pg-boss)**. Decouples request latency from recompute time. More moving parts.
- **Inline recompute (this decision)**. Simple, request blocks ~30ms, easy to reason about.

**Why synchronous:**
- Trust score math is one SQL query (covered in M3.1). Sub-100ms even at 10× v1 scale.
- v1 doesn't have the volume to need a queue. If we add one later it's two-line change in `markPaid`.
- Aligns with M3.6 dispute flow which also mutates state and recomputes — consistent pattern.

## D4 — `payout_events.amount_cents` snapshots the accrued amount at mark-paid time

**Decision:** When the creator marks a submission paid, the `amount` saved on the `payout_event` row is whatever the submission's `payoutAmountCents` was *at that moment*. Subsequent view-tracking changes don't mutate the historic event amount.

**Alternatives considered:**
- **Live link to `submissions.payoutAmountCents`** via JOIN at read time. "Current truth", but breaks if the submission gets modified after payout.
- **Snapshot-then-edit** allow the creator to amend the recorded amount.

**Why snapshot:**
- `payout_event` is an immutable ledger row. Once created, it represents "creator says they paid X on date Y" — historic fact.
- Trust score math reads `payout_events.amount_cents` directly, so the snapshot is what the score reflects.
- Edits land as new events (a "correction" event) in v2 if we ever need them.

## D5 — Mark-paid available **only** from the Ready-to-pay tab

**Decision:** The "Mark paid" button only appears on submissions in `ready_to_pay` state (i.e. day-30 lock has passed). Cannot mark paid before then.

**Alternatives considered:**
- **Allow mark-paid at any time post-approval**. Lets creators pre-pay early. But: distorts trust score timing, breaks the day-30 contract with clippers.
- **Allow mark-paid at any time including pre-approval**. Even worse — bypasses content review.

**Why ready-to-pay only:**
- The day-30 lock exists for a reason: views accumulate, AI verification finalises, dispute window closes. Before lock, the "amount due" is moving.
- v1 contract is "you get paid 30 days after publish, off-platform". Mark-paid before then breaks that contract.
- If a creator wants to settle early in special cases, that's a v2 manual-override feature.

## D6 — Blockchain Tier A (manual tx hash + explorer link) ships in M2

**Decision:** Tier A wired into the mark-paid modal as an optional "Transaction hash" field for crypto methods, with explorer-link rendering on submission detail.

**Alternatives considered:**
- **Skip Tier A**. CC1 explicitly said ship A; no.
- **Make tx hash mandatory** for crypto methods. Friction without enforcement value (a fake hash is still a fake hash).

**Why optional + UI rendering:**
- A tx hash is a strong soft-signal of payment (clickable Etherscan/Solscan/Mempool link both sides can verify themselves). Tier B (M2.6) makes it a hard signal via on-chain verification.
- Optional because creators using PayPal/bank/Cash App don't have one to enter.

## D7 — Tier B feasibility spike output is a markdown doc, not implementation

**Decision:** M2.6 produces `docs/spikes/M2.6-blockchain-tier-b.md` with the effort estimate, RPC provider analysis, and a ship-now/defer recommendation. No implementation in this PR.

**Alternatives considered:**
- **Implement Tier B for all chains during M2**. Adds 4–5 days. May not pencil out for v1 volumes.
- **Skip the spike entirely, defer all of Tier B to v1.2**. Loses the spike's option value.

**Why the doc-only spike:**
- The spike's output drives the in-scope/defer decision. Implementing first defeats the point.
- One markdown file → reviewable, clear, and the recommendation is acted on as a follow-up ticket if it lands "ship now".

## D8 — `campaigns.accepted_payout_methods` as `text[]` array

**Decision:** Add `accepted_payout_methods text[]` column to `campaigns`. Array of method enum values matching `clipper_payout_methods.method`.

**Alternatives considered:**
- **Join table `campaign_accepted_methods (campaign_id, method)`**. Symmetrical with `clipper_payout_methods` but adds complexity for read paths that already need the campaign row.
- **JSONB**. Same arguments as D1 against JSONB on users — but on campaigns the queries are simpler so it's closer to a wash.

**Why text[]:**
- The overlap check is one Postgres `&&` operator: `clipper_methods && campaign.accepted_payout_methods`. Done in a single SQL fragment.
- Arrays are first-class on Postgres; the existing schema already uses `allowedPlatforms: text[]` on the same table — consistency.
- Caveat: schema validation is at app level (no FK to a `methods` lookup table). Acceptable for a small fixed enum.

## D9 — Council not invoked for M2 either

**Decision:** No agent council needed for M2.

**Why:**
- D1, D2, D8 are schema choices that resolve cleanly from "fewest moving parts that satisfy v1 queries".
- D3, D5 are flow rules baked into the PRD (CC1).
- D4, D6, D7 are CC1 decisions executed on.
- Council reserved for M3 trust score weighting (if the dual-window math has a real fork) or M4 attribution edge cases.
