// Standalone end-to-end test for the AI verification pipeline.
//
// Usage:
//   cd server
//   node test-ai-verify.mjs <clip-url> --source <source-video-url>
//
// Examples:
//   # Source = Google Drive video, Clip = Instagram reel from same person
//   node test-ai-verify.mjs \
//     https://www.instagram.com/reels/DXMqoL4DOh-/ \
//     --source "https://drive.google.com/file/d/1ABCxyz/view"
//
//   # Source = direct mp4 URL, Clip = TikTok
//   node test-ai-verify.mjs https://www.tiktok.com/@me/video/123 \
//     --source https://example.com/streamcut.mp4
//
// Optional flags:
//   --keep       keep the temp frames dir so you can inspect the JPEGs
//   --no-claude  skip the Claude call (just dump scrape + frames)
//
// What it does (mirrors the production pipeline):
//   1. Detects platform from clip URL.
//   2. Calls the RapidAPI scraper to get a direct video CDN URL for the clip.
//   3. ffmpeg-streams ~5 keyframes from the first 25s of the clip.
//   4. ffmpeg-streams ~4 keyframes from the source video.
//   5. Sends both sets to Claude Sonnet 4.6 with the face-likeness prompt.
//   6. Prints Claude's verdict.

import { config } from "dotenv";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import Anthropic from "@anthropic-ai/sdk";

// Drive (and some IG/TikTok CDNs) reject ffmpeg's default User-Agent.
const HTTP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// override:true so a stale ANTHROPIC_API_KEY in the parent shell can't
// shadow the fresh value in server/.env.
config({ override: true });

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a, i) => {
  if (a.startsWith("--")) return false;
  // Skip the value following --source
  if (args[i - 1] === "--source") return false;
  return true;
});
const clipUrl = positional[0];

const sourceFlagIdx = args.indexOf("--source");
const sourceUrl = sourceFlagIdx >= 0 ? args[sourceFlagIdx + 1] : null;

const KEEP = flags.has("--keep");
const NO_CLAUDE = flags.has("--no-claude");

if (!clipUrl) {
  console.error("Usage: node test-ai-verify.mjs <clip-url> --source <source-video-url>");
  process.exit(1);
}
if (!sourceUrl) {
  console.error(
    "Pass the campaign's source video with --source <url>. The face-likeness check needs both.",
  );
  process.exit(1);
}

// ---- helpers ----

function detectPlatform(url) {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
  return null;
}

async function resolveShortTikTok(url) {
  if (!/(?:vm|vt)\.tiktok\.com|tiktok\.com\/t\//.test(url)) return url;
  const res = await fetch(url, { method: "HEAD", redirect: "manual" }).catch(
    () => null,
  );
  const loc = res?.headers.get("location");
  return loc?.split("?")[0] ?? url;
}

function pickString(obj, paths) {
  for (const path of paths) {
    let cur = obj;
    for (const p of path.split(".")) {
      if (cur == null) {
        cur = undefined;
        break;
      }
      if (Array.isArray(cur)) {
        const i = Number(p);
        cur = Number.isFinite(i) ? cur[i] : undefined;
      } else if (typeof cur === "object" && p in cur) {
        cur = cur[p];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur.trim()) return cur;
  }
  return null;
}

function normalizeDriveUrl(url) {
  // Use Drive API v3 alt=media with our existing GCP API key (Drive API
  // enabled on the same project). The web endpoint serves an HTML page
  // for open-ended Range requests, which ffmpeg can't handle.
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com")) return url;
    const m = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const key = process.env.YOUTUBE_API_KEY; // same GCP project
    if (!m?.[1] || !key) return url;
    return `https://www.googleapis.com/drive/v3/files/${m[1]}?alt=media&key=${key}`;
  } catch {
    return url;
  }
}

async function scrapeInstagram(url) {
  const host =
    process.env.RAPIDAPI_INSTAGRAM_HOST || "instagram-looter2.p.rapidapi.com";
  const r = await fetch(`https://${host}/post?url=${encodeURIComponent(url)}`, {
    headers: {
      "x-rapidapi-host": host,
      "x-rapidapi-key": process.env.RAPIDAPI_KEY,
    },
  });
  if (!r.ok) throw new Error(`IG HTTP ${r.status}`);
  const body = await r.json();
  return {
    viewCount: body.video_view_count ?? body.video_play_count ?? null,
    videoUrl: typeof body.video_url === "string" ? body.video_url : null,
  };
}

function pickAwemeUrl(item) {
  const list = item?.video?.bitrateInfo;
  if (!Array.isArray(list)) return null;
  for (const br of list) {
    const urls = br?.PlayAddr?.UrlList;
    if (!Array.isArray(urls)) continue;
    for (const u of urls) {
      if (typeof u === "string" && u.includes("/aweme/v1/play")) return u;
    }
  }
  return null;
}

async function scrapeYouTube(url) {
  const id = extractYouTubeId(url);
  if (!id) throw new Error(`Could not extract YouTube id from ${url}`);
  const host =
    process.env.RAPIDAPI_YOUTUBE_HOST || "yt-api.p.rapidapi.com";
  const r = await fetch(`https://${host}/dl?id=${id}`, {
    headers: {
      "x-rapidapi-host": host,
      "x-rapidapi-key": process.env.RAPIDAPI_KEY,
    },
  });
  if (!r.ok) throw new Error(`YouTube downloader HTTP ${r.status}`);
  const body = await r.json();
  const formats = body.formats ?? body.adaptiveFormats ?? [];
  // Prefer combined-stream mp4 of lowest quality (small + has audio).
  const mp4 = formats
    .filter(
      (f) =>
        typeof f.url === "string" &&
        typeof f.mimeType === "string" &&
        f.mimeType.startsWith("video/mp4") &&
        /codecs=".*,/.test(f.mimeType),
    )
    .sort((a, b) => (a.height ?? 9999) - (b.height ?? 9999));
  const fallback = formats.find(
    (f) =>
      typeof f.url === "string" &&
      typeof f.mimeType === "string" &&
      f.mimeType.startsWith("video/mp4"),
  );
  return {
    viewCount: null, // we don't fetch view count here
    videoUrl: mp4[0]?.url ?? fallback?.url ?? null,
  };
}

function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0];
    if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
    if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2];
    if (u.pathname.startsWith("/live/")) return u.pathname.split("/")[2];
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

async function scrapeTikTok(url) {
  const m = url.match(/\/(?:video|photo)\/(\d+)/);
  if (!m) throw new Error(`Could not extract TikTok videoId from ${url}`);
  const host =
    process.env.RAPIDAPI_TIKTOK_HOST || "tiktok-api23.p.rapidapi.com";
  const r = await fetch(`https://${host}/api/post/detail?videoId=${m[1]}`, {
    headers: {
      "x-rapidapi-host": host,
      "x-rapidapi-key": process.env.RAPIDAPI_KEY,
    },
  });
  if (!r.ok) throw new Error(`TikTok HTTP ${r.status}`);
  const body = await r.json();
  const item = body.itemInfo?.itemStruct ?? body.data ?? body;
  return {
    viewCount: item.stats?.playCount ?? null,
    // Prefer aweme/v1/play URL (public stream) over playAddr (403 outside session).
    videoUrl:
      pickAwemeUrl(item) ??
      pickString(item, [
        "video.playAddr",
        "video.downloadAddr",
        "video.bitrateInfo.0.PlayAddr.UrlList.0",
      ]),
  };
}

function runFfmpeg(args) {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

async function extractClipFrames(videoUrl, dir) {
  // Clip = clipper's short reel: 1 frame every 5s for first 25s.
  // TikTok's aweme/v1/play endpoint 302's only when a tiktok.com Referer
  // is present. Harmless for other CDNs.
  const args = [
    "-y",
    "-loglevel",
    "error",
    "-user_agent",
    HTTP_UA,
    "-headers",
    "Referer: https://www.tiktok.com/\r\n",
    "-t",
    "25",
    "-i",
    videoUrl,
    "-vf",
    `fps=1/5,scale='min(768,iw)':-2`,
    "-f",
    "image2",
    "-q:v",
    "5",
    join(dir, `clip-%03d.jpg`),
  ];
  const { code, stderr } = await runFfmpeg(args);
  if (code !== 0) {
    console.error("ffmpeg stderr:", stderr.split("\n").slice(-5).join("\n"));
    throw new Error(`ffmpeg exited ${code} for clip`);
  }
  const files = (await readdir(dir))
    .filter((f) => f.startsWith("clip-") && f.endsWith(".jpg"))
    .sort();
  return Promise.all(
    files.map(async (f, i) => ({
      name: f,
      bytes: await readFile(join(dir, f)),
      atSeconds: i * 5,
    })),
  );
}

async function downloadPrefix(url, outPath, { chunkSize, maxBytes }) {
  // Drive caps open-ended Range requests at ~2MB and serves HTML for the
  // rest. We do small closed-range chunks ourselves and stop on EOF.
  const fs = await import("node:fs");
  const out = fs.createWriteStream(outPath);
  let written = 0;
  let cur = 0;
  try {
    while (cur < maxBytes) {
      const end = Math.min(cur + chunkSize - 1, maxBytes - 1);
      const res = await fetch(url, {
        headers: { "User-Agent": HTTP_UA, Range: `bytes=${cur}-${end}` },
      });
      if (res.status !== 206 && res.status !== 200) break;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) break;
      await new Promise((resolve, reject) => {
        out.write(buf, (err) => (err ? reject(err) : resolve()));
      });
      written += buf.length;
      cur += buf.length;
      if (buf.length < chunkSize) break; // EOF
    }
  } finally {
    await new Promise((resolve) => out.end(resolve));
  }
  return written;
}

async function extractSourceFrames(videoUrl, dir) {
  // Strategy: 4 evenly-spaced frames in the first 20s, sampled from a
  // partial download we control byte-by-byte (so Drive plays nicely).
  const localFile = join(dir, "source.mp4");
  const downloaded = await downloadPrefix(videoUrl, localFile, {
    chunkSize: 1_500_000,
    maxBytes: 10_000_000,
  });
  if (downloaded === 0) return { frames: [], downloaded: 0 };

  const numFrames = 4;
  const segment = 20 / numFrames;
  const timestamps = Array.from({ length: numFrames }, (_, i) => segment * (i + 0.5));

  const frames = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const out = join(dir, `source-${String(i + 1).padStart(3, "0")}.jpg`);
    const args = [
      "-y",
      "-loglevel",
      "error",
      "-ss",
      ts.toFixed(2),
      "-i",
      localFile,
      "-frames:v",
      "1",
      "-vf",
      `scale='min(512,iw)':-2`,
      "-q:v",
      "6",
      out,
    ];
    const { code } = await runFfmpeg(args);
    if (code !== 0) continue;
    try {
      const bytes = await readFile(out);
      frames.push({
        name: `source-${String(i + 1).padStart(3, "0")}.jpg`,
        bytes,
        atSeconds: ts,
      });
    } catch {
      // skip
    }
  }
  return { frames, downloaded };
}

async function askClaude(sourceFrames, clipFrames) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  const content = [];
  for (const f of sourceFrames) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: f.bytes.toString("base64"),
      },
    });
    content.push({ type: "text", text: `↑ Source @ ${f.atSeconds}s` });
  }
  for (const f of clipFrames) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: f.bytes.toString("base64"),
      },
    });
    content.push({ type: "text", text: `↑ Clip @ ${f.atSeconds}s` });
  }
  content.push({
    type: "text",
    text: [
      "You are verifying that a short-form video clip is genuinely derived from a creator's source content.",
      "The campaign's source video can be long (a stream, vlog, podcast). The clipper's submission is a short reel — the timestamps will not line up.",
      "Anchor your judgement on FACE / PERSON likeness, not on scene composition or background.",
      "",
      `I showed you ${sourceFrames.length} keyframe(s) from the SOURCE video, then ${clipFrames.length} keyframe(s) from the CLIPPER's clip.`,
      "",
      "Decide: is the main person/people in the clip the same person(s) shown in the source? Allow for different camera angles, makeup, filters, captions, zooms, and crops.",
      "",
      'Reply with strictly valid JSON: {"verdict": "clean" | "flagged", "reason": "one short sentence"}',
    ].join("\n"),
  });

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 250,
    messages: [{ role: "user", content }],
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// ---- main ----

(async () => {
  const platform = detectPlatform(clipUrl);
  if (!platform) {
    console.error(`Unknown platform for: ${clipUrl}`);
    process.exit(1);
  }
  console.log(`[1/5] Clip platform: ${platform}`);

  const resolvedClipUrl =
    platform === "tiktok" ? await resolveShortTikTok(clipUrl) : clipUrl;
  if (resolvedClipUrl !== clipUrl) console.log(`      Resolved → ${resolvedClipUrl}`);

  console.log(`[2/5] Scraping platform API for direct clip URL…`);
  let scrape;
  try {
    if (platform === "instagram") scrape = await scrapeInstagram(resolvedClipUrl);
    else if (platform === "tiktok") scrape = await scrapeTikTok(resolvedClipUrl);
    else if (platform === "youtube") scrape = await scrapeYouTube(resolvedClipUrl);
  } catch (err) {
    console.error("Clip scrape failed:", err.message);
    process.exit(1);
  }
  console.log(`      views: ${scrape.viewCount}`);
  console.log(
    `      clip videoUrl: ${scrape.videoUrl ? scrape.videoUrl.slice(0, 100) + "…" : "(none)"}`,
  );
  if (!scrape.videoUrl) {
    console.error("Scraping API didn't return a direct video URL — pipeline would fall back to flagged.");
    process.exit(1);
  }

  const dir = await mkdtemp(join(tmpdir(), "ai-verify-"));
  console.log(`[3/5] Extracting CLIP keyframes via ffmpeg → ${dir}…`);
  let clipFrames = [];
  try {
    clipFrames = await extractClipFrames(scrape.videoUrl, dir);
    console.log(
      `      got ${clipFrames.length} clip frame(s):`,
      clipFrames
        .map((f) => `${f.name} @${f.atSeconds}s (${(f.bytes.length / 1024).toFixed(1)}KB)`)
        .join(", "),
    );
  } catch (err) {
    console.error("Clip frame extraction failed:", err.message);
    if (!KEEP) await rm(dir, { recursive: true, force: true }).catch(() => {});
    process.exit(1);
  }

  console.log(`[4/5] Extracting SOURCE keyframes from ${sourceUrl}…`);
  const normalizedSource = normalizeDriveUrl(sourceUrl);
  if (normalizedSource !== sourceUrl)
    console.log(`      Drive URL normalised → ${normalizedSource}`);
  let sourceFrames = [];
  try {
    const { frames, downloaded } = await extractSourceFrames(normalizedSource, dir);
    sourceFrames = frames;
    console.log(`      downloaded ${(downloaded / 1024 / 1024).toFixed(2)} MB prefix`);
    console.log(
      `      got ${sourceFrames.length} source frame(s):`,
      sourceFrames
        .map((f) => `${f.name} @${f.atSeconds.toFixed(1)}s (${(f.bytes.length / 1024).toFixed(1)}KB)`)
        .join(", "),
    );
  } catch (err) {
    console.error("Source frame extraction failed:", err.message);
    if (!KEEP) await rm(dir, { recursive: true, force: true }).catch(() => {});
    process.exit(1);
  }

  if (!NO_CLAUDE && clipFrames.length && sourceFrames.length) {
    console.log(
      `[5/5] Sending ${sourceFrames.length} source + ${clipFrames.length} clip frame(s) to Claude Sonnet 4.6…`,
    );
    try {
      const verdict = await askClaude(sourceFrames, clipFrames);
      console.log("\n=== Claude verdict ===");
      console.log(verdict);
      console.log("======================");
    } catch (err) {
      console.error("Claude call failed:", err.message);
    }
  }

  if (KEEP) console.log(`\nFrames kept at: ${dir}`);
  else await rm(dir, { recursive: true, force: true }).catch(() => {});
})();
