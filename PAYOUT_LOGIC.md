# How Clipper Payouts Work

## The big picture
A creator sets up a campaign with a budget (e.g. $1000) and a rate (e.g. $3 per 1000 views). Clippers make videos, post them on TikTok / Instagram / YouTube, and submit the links. We automatically track views for 30 days and pay out the clippers at the end.

## Step 1. Clipper submits a video
The clipper pastes the URL. We immediately hit the platform API to check the current view count. The 30-day timer starts from this moment.

## Step 2. Creator reviews
The creator opens their inbox and hits **Approve** or **Reject**. If they don't react within 48 hours, the submission auto-approves.

## Step 3. We track the views
Every 6 hours we call the platform API and check how many views the video has. We save the results in the database and build a chart.

## Step 4. Incremental earnings (the fair-share model)
We don't reserve money upfront. Instead, every 6 hours we scrape new view counts for all active clips and grow each clipper's **earned-so-far** balance by whatever they added since the last scrape.

**Pro-rata fairness when the pool runs out:**
Each 6-hour window has its own mini-budget: the remaining campaign pool (`total − already paid − already earned by everyone`). If the sum of all clips' new earnings this window is *less than* the remaining pool, everyone gets full credit. If it's *more* than the pool, everyone gets scaled down proportionally to how much they grew.

Example: pool has $100 left, and this window three clips grew by $30, $40, $60 (total $130). Each gets `$100 × their_share`: $23, $31, $46. Everyone takes a proportional hit — nobody is "first in line".

This means: clippers who rack up views at the same time share the squeeze together. Posting earlier doesn't give you priority; what matters is the time window each chunk of views lands in.

## Step 5. Creator protection
When creating a campaign, the creator can set:
- **Min views** — below this view threshold, no payout (filters out dead videos).
- **Max payout per clip** — ceiling for a single video (prevents one viral clip from eating the whole budget).

## Step 6. Payout on day 30
30 days after the video was **published** we automatically:
- Do one last scrape + accrual window so the final view count is reflected.
- Transfer the clipper's accumulated earnings to their wallet.
- The clip moves from "earning" to "paid", and those dollars move from the campaign's "pending" bucket into "spent".

Multiple clips from the same clipper each have their own 30-day clock starting from the publish date of each video.

## What if...

**...the clipper deletes the video before day 30?**
We pay out based on the views the video had at the moment it went down. The clipper still gets what they earned, but it stops growing.

**...the budget runs out before day 30?**
The campaign is automatically hidden from the public hub, and the creator sees a "Funds exhausted" badge. Once the pool is exhausted, no new views earn anything — every clipper stops accruing together from that moment on. Already-accrued earnings still get paid out on day 30.

**...the creator wants to add more budget?**
"Add funds" button on the Budget management page. Funds go straight into escrow.

## When is a campaign considered fully completed?

A campaign can land in the `completed` state in two ways:

1. **Auto-completion — budget fully paid out.** Once every dollar of the budget has been paid to clippers (`spent ≥ total budget`), the system flips the campaign to `completed` automatically. This happens on day 30 of the last active submission.

2. **Creator-triggered close with refund.** If some budget is left unspent (for example, the campaign didn't attract enough views to use it all), the creator can hit **Complete campaign** on the Budget management page. This is allowed only when **every submission has already been paid out or rejected** — nothing pending, approved, or in the 30-day verification window. On close:
   - The unspent amount (`total − spent`) is refunded to the creator's wallet.
   - A refund transaction is recorded in the campaign's ledger and the creator's wallet history.
   - The campaign is marked `completed` and locked — no more submissions or payouts.

### Typical timeline
`draft → active → (optional: paused) → (optional: funds exhausted) → completed`

**Funds exhausted** is a transient display state, not a separate DB status — it means `spent + pending ≥ total budget`, so no new earnings can accrue. The campaign is hidden from the public hub and tagged with a "Funds exhausted" badge until the last 30-day window closes and everyone is paid.

### Suggested creator flow for winding down early
If the creator wants to end a campaign that still has free budget and new clippers keep joining:
1. **Pause** the campaign — blocks new submissions while existing ones keep ticking toward their 30-day payout.
2. Wait for all active submissions to finalize naturally on their 30-day marks.
3. Hit **Complete campaign** — leftover budget is refunded back to the wallet.

## What the creator sees
- **Budget management**: 4 cards — Total / Spent / Pending / Available — plus **Add funds** and **Complete campaign** buttons.
- **Campaign list**: how much is available out of the total budget + a progress bar (solid = paid out, translucent = pending). Kebab menu gives **Pause / Resume** and **Complete & refund**.
- **Inbox**: one row per submission. For active clips — live view count + **`$X earned`** (what this clipper has accumulated so far). For paid clips — **`$Y paid`** (the actual payout that was released). Tabs: Pending · Approved · Ready to verify · Paid · Rejected · Banned.

## What the clipper sees
- For each submission: current views, current projected earnings, and a "paid at day 30" countdown.
- View growth chart.
- If banned by the creator — sees "Banned" status.

## Supported platforms
TikTok, Instagram Reels, YouTube (Shorts / regular videos). Each has a dedicated API integration that returns view count and publish date.
