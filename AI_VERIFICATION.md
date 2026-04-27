# AI Submission Verification

## What it does

When a clipper submits a clip URL on Content Rewards, the platform automatically asks Claude (Anthropic's Sonnet 4.6 model) whether the **person in the clip is the same person as the campaign's source video**. The result is one of two verdicts:

- **clean** — Claude is confident it's the same creator. The submission shows a green "AI: clean" badge in the creator's inbox and is safe to approve in one click.
- **flagged** — Claude is unsure, sees a different person, or couldn't see a face at all. The submission shows a yellow "AI: flagged" badge and is sent to the creator for manual approval. A short reason is shown on hover.

The verification runs in the background a few seconds after the clipper submits — it never blocks the submit form. Until it finishes, the inbox card shows no AI badge.

## How the pipeline works

1. **Clipper submits a URL** (TikTok, Instagram Reel, or YouTube Short).
2. **Platform scraper** resolves the post into a direct video URL. All three resolvers run on RapidAPI (different third-party APIs, one per platform):
   - TikTok → **TikTok API 23** (`tiktok-api23.p.rapidapi.com`).
   - Instagram → **Instagram Looter 2** (`instagram-looter2.p.rapidapi.com`).
   - YouTube → **yt-api** (`yt-api.p.rapidapi.com`) — a third-party downloader, because the official YouTube Data API v3 deliberately doesn't expose media links.
3. **Frame extraction (clipper's clip)** — ffmpeg streams the first 25 seconds and pulls one frame every 5 seconds at 768px max-side. Typically ~5 frames.
4. **Frame extraction (campaign's source)** — for the first verification on a given campaign, ffmpeg downloads a small prefix (≤10 MB) of the source video from Google Drive in chunked HTTP Range requests, then samples 4 evenly-spaced frames across the first 20 seconds at 512px max-side. The frames are cached on the campaign row in JSONB, so Drive is hit at most once per campaign — every subsequent submission re-uses them.
5. **Claude call** — all source frames are sent first (labelled `Source @ Ns`), followed by all clip frames (labelled `Clip @ Ns`), followed by an instruction to compare faces / persons across the two sets and reply with strict JSON: `{"verdict": "clean" | "flagged", "reason": "one short sentence"}`.
6. **Verdict + reason** are persisted on the submission and exposed in the creator inbox API.

## Why face-likeness, not scene matching

The campaign's source can be a long-form stream, vlog, or podcast (hours), while the clipper's submission is a 30–60 s reel. The two will rarely share opening seconds, scene composition, or backgrounds. Anchoring the judgement on **the person(s) shown** is far more reliable than trying to match scenery, captions, or timestamps. The prompt explicitly tells Claude to allow for different camera angles, makeup, filters, captions, zooms, and crops.

## Fallback behaviour

The pipeline is designed to never silently fail or auto-approve a submission it can't verify:

- **No direct media URL** (e.g. RapidAPI quota hit, throttled host, or YouTube downloader response missing a usable mp4 format) → the submission is **flagged** with a note that the platform did not expose a video URL, and goes to manual review.
- **Source frames couldn't be extracted** (Drive quota, file made private, link broken) → the call to Claude still runs with only the clip frames, and Claude is told to flag for manual review unless the clip is obviously off-brand. The campaign row is *not* poisoned — the next submission will try Drive again.
- **Claude returns an unparseable response** → defaults to **flagged** with the raw response stored in notes for debugging.
- **Transient infrastructure error** (network blip, ffmpeg timeout) → the submission is left in the "not yet verified" state. No badge is shown. The verification can be retried.

In every fallback case, the worst outcome for the creator is "you have to look at this one yourself" — never an unverified auto-approval.

## Cost & latency

- **Model:** `claude-sonnet-4-6`.
- **Tokens per call:** ~9 input images + ~250 text tokens in / ~50 tokens out. Roughly $0.02–$0.04 per submission depending on image sizes.
- **Wall-clock:** typically 6–12 seconds end-to-end for the *first* submission on a campaign (Drive download + ffmpeg + Claude). Subsequent submissions on the same campaign skip the Drive step and run in 3–6 s.
- **Caching:** source-video keyframes are stored on the campaign row in Postgres (`campaigns.source_keyframes` JSONB) and survive server restarts. If the creator changes the campaign's source URL, the cache is invalidated.

## Where it surfaces in the product

- **Creator inbox** — green `AI: clean` or yellow `AI: flagged` badge on each submission card. Hovering the flagged badge shows Claude's one-sentence reason.
- **Backend** — `submissions.ai_review_result` (`clean` | `flagged` | `null`) and `submissions.ai_notes` columns. These are returned on the inbox API and can be queried for analytics ("what % of submissions does AI mark clean?").

## What it does *not* do

- It does **not** detect view-count fraud, bot traffic, or stitched/duplicate uploads — that's a separate problem, handled by view-tracking heuristics later in the lifecycle.
- It does **not** auto-reject anything. A flagged verdict is a hint to the creator, not a decision.
- It does **not** lock a creator out — the creator can always approve a flagged submission manually.
- It does **not** verify watermarks, captions, or branded-content rules — those need a different model and prompt.

## External APIs used

| Purpose | Provider | API / host |
| --- | --- | --- |
| Face-likeness verdict | Anthropic | **Claude Messages API** — model `claude-sonnet-4-6` |
| Source video chunked download | Google | **Google Drive API v3** (`www.googleapis.com/drive/v3/files/<id>?alt=media`) |
| TikTok media URL + metadata | RapidAPI | **TikTok API 23** (`tiktok-api23.p.rapidapi.com`) |
| Instagram media URL + metadata | RapidAPI | **Instagram Looter 2** (`instagram-looter2.p.rapidapi.com`) |
| YouTube media URL (mp4 stream) | RapidAPI | **yt-api** (`yt-api.p.rapidapi.com`) |
| YouTube view counts (separate cron, not AI verification) | Google | **YouTube Data API v3** |

## Configuration

- `ANTHROPIC_API_KEY` — required. If absent, AI verification is silently skipped (every submission lands without a badge).
- `YOUTUBE_API_KEY` — Google API key. Used both for the YouTube Data API v3 (view-tracking cron) and as the Drive API v3 key for source-video downloads (same GCP project, both APIs enabled on it).
- `RAPIDAPI_KEY` — single key shared across all three RapidAPI hosts.
- `RAPIDAPI_TIKTOK_HOST` / `RAPIDAPI_INSTAGRAM_HOST` / `RAPIDAPI_YOUTUBE_HOST` — per-platform host overrides (defaults match the table above).
