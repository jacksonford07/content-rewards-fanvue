import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

// Drive (and some IG/TikTok CDNs) reject ffmpeg's default User-Agent. We
// pretend to be a regular browser so the HTTP demuxer gets real bytes
// instead of an HTML interstitial.
const HTTP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface ExtractedFrame {
  /** PNG bytes, base64-encoded for direct embedding in Claude messages. */
  base64: string;
  /** Timestamp in seconds within the source clip. */
  atSeconds: number;
}

export interface FrameExtractionOptions {
  /** Cap how much of the clip we touch (Jackson: first 20–30s). */
  durationSeconds: number;
  /** Frame stride — pick 1 frame every N seconds. Jackson: 2–4s. */
  intervalSeconds: number;
  /** Resize hint to keep token cost down (longest side, in px). */
  maxSide: number;
}

@Injectable()
export class FrameExtractorService {
  private readonly logger = new Logger(FrameExtractorService.name);

  /**
   * Source-video frame strategy: 4 frames evenly spaced across the first
   * 20 seconds, sampled from a partial download we control.
   *
   * Why partial download instead of streaming the URL into ffmpeg?
   *   ffmpeg's HTTP demuxer issues `Range: bytes=0-` (open-ended) on the
   *   first connect. Drive (and Drive API) cap that and return an HTML
   *   warning / 403 quota — ffmpeg can't recover. We work around it by
   *   driving the HTTP layer ourselves: small closed Range chunks (≤1.5MB)
   *   that Drive serves happily. We stop at ~8MB or EOF — plenty for 20s
   *   even at 1080p bitrates.
   *
   * Frame quality is tuned for face-match (Sonnet doesn't need 1080p): we
   * cap longest-side at `opts.maxSide` and use moderate JPEG compression.
   */
  async extractSourceFirst20s(
    videoUrl: string,
    opts: { numFrames: number; maxSide: number },
  ): Promise<ExtractedFrame[]> {
    if (!ffmpegPath) {
      this.logger.error("ffmpeg-static binary path is not available");
      return [];
    }

    const dir = await mkdtemp(join(tmpdir(), "src-prefix-"));
    const localFile = join(dir, "source.mp4");
    try {
      const downloadedBytes = await downloadPrefix(videoUrl, localFile, {
        chunkSize: 1_500_000, // Drive serves up to ~2MB closed ranges; 1.5MB is the safe ceiling.
        maxBytes: 10_000_000, // ~10MB ≥ 20s at 1080p. Stops earlier on EOF.
      });
      if (downloadedBytes === 0) {
        this.logger.warn(`Could not download source prefix from ${videoUrl}`);
        return [];
      }

      // Evenly-spaced timestamps centred in N equal segments of 20s.
      // For numFrames=4: 2.5s, 7.5s, 12.5s, 17.5s.
      const n = Math.max(1, opts.numFrames);
      const segment = 20 / n;
      const timestamps = Array.from(
        { length: n },
        (_, i) => segment * (i + 0.5),
      );

      const frames: ExtractedFrame[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const out = join(dir, `f-${String(i + 1).padStart(3, "0")}.jpg`);
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
          `scale='min(${opts.maxSide},iw)':-2`,
          "-q:v",
          "6",
          out,
        ];
        const code = await runProcess(ffmpegPath, args);
        if (code !== 0) continue;
        try {
          const buf = await readFile(out);
          frames.push({ base64: buf.toString("base64"), atSeconds: ts });
        } catch {
          // skip
        }
      }
      return frames;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Pulls keyframes from the START of a remote video — used for the
   * clipper's clip, which is short by definition (≤60s on TikTok / Reels).
   * We let ffmpeg stream-read the URL directly (no full download to disk)
   * and write a handful of JPEGs to a temp dir, then read them back as
   * base64. Temp dir is wiped before returning.
   */
  async extractFromUrl(
    videoUrl: string,
    opts: FrameExtractionOptions,
  ): Promise<ExtractedFrame[]> {
    if (!ffmpegPath) {
      this.logger.error("ffmpeg-static binary path is not available");
      return [];
    }

    const dir = await mkdtemp(join(tmpdir(), "clip-frames-"));
    try {
      const args = [
        "-y",
        "-loglevel",
        "error",
        "-user_agent",
        HTTP_USER_AGENT,
        // TikTok's aweme/v1/play endpoint 302's only when Referer is set.
        // Harmless for IG/YouTube CDNs which ignore it.
        "-headers",
        "Referer: https://www.tiktok.com/\r\n",
        "-t",
        String(opts.durationSeconds),
        "-i",
        videoUrl,
        // 1 frame every `intervalSeconds`
        "-vf",
        `fps=1/${opts.intervalSeconds},scale='min(${opts.maxSide},iw)':-2`,
        "-f",
        "image2",
        "-q:v",
        "5",
        join(dir, "f-%03d.jpg"),
      ];

      const code = await runProcess(ffmpegPath, args);
      if (code !== 0) {
        this.logger.warn(`ffmpeg exited ${code} for ${videoUrl}`);
        return [];
      }

      const files = (await readdir(dir))
        .filter((f) => f.startsWith("f-") && f.endsWith(".jpg"))
        .sort();

      const frames: ExtractedFrame[] = [];
      for (const file of files) {
        const buf = await readFile(join(dir, file));
        const idx = Number(file.match(/f-(\d+)/)?.[1] ?? "0");
        // ffmpeg's first frame index is 1, so atSeconds = (idx-1) * interval.
        frames.push({
          base64: buf.toString("base64"),
          atSeconds: Math.max(0, (idx - 1) * opts.intervalSeconds),
        });
      }
      return frames;
    } catch (err) {
      this.logger.error(`Frame extraction failed: ${String(err)}`);
      return [];
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Downloads the prefix of a remote video to a local file using closed-range
 * HTTP chunks. Stops when we reach `maxBytes` or the server signals EOF
 * (returns less than the requested chunk size). Drive's web download and
 * Drive API both reject open-ended Range requests for large files, so we
 * keep each chunk well below their ~2MB cap.
 *
 * Returns total bytes written. 0 means "couldn't fetch anything" — caller
 * should treat as failure and fall back.
 */
async function downloadPrefix(
  url: string,
  outPath: string,
  opts: { chunkSize: number; maxBytes: number },
): Promise<number> {
  const out = createWriteStream(outPath);
  let written = 0;
  let cur = 0;
  try {
    while (cur < opts.maxBytes) {
      const end = Math.min(cur + opts.chunkSize - 1, opts.maxBytes - 1);
      const res = await fetch(url, {
        headers: {
          "User-Agent": HTTP_USER_AGENT,
          Range: `bytes=${cur}-${end}`,
        },
      });
      if (res.status !== 206 && res.status !== 200) {
        // First chunk failure means the URL isn't usable at all. Mid-stream
        // failure — give up but keep what we have so ffmpeg can still try.
        break;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) break;
      await new Promise<void>((resolve, reject) => {
        out.write(buf, (err) => (err ? reject(err) : resolve()));
      });
      written += buf.length;
      cur += buf.length;
      // Server returned fewer bytes than asked → end of file.
      if (buf.length < opts.chunkSize) break;
    }
  } finally {
    await new Promise<void>((resolve) => out.end(resolve));
  }
  return written;
}

/**
 * Probes a video's duration using `ffmpeg -i` (ffmpeg-static doesn't ship
 * ffprobe). ffmpeg writes "Duration: HH:MM:SS.SS" to stderr at startup,
 * then exits with code 1 because we provided no output. We parse stderr.
 */
function probeDuration(
  ffmpegBin: string,
  videoUrl: string,
): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn(
      ffmpegBin,
      ["-hide_banner", "-user_agent", HTTP_USER_AGENT, "-i", videoUrl],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr?.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", () => resolve(null));
    child.on("close", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!m) return resolve(null);
      const seconds =
        Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
    });
    setTimeout(() => {
      child.kill("SIGKILL");
      resolve(null);
    }, 15_000).unref();
  });
}

function runProcess(bin: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", () => resolve(1));
    child.on("close", (code) => {
      if (code !== 0 && stderr) {
        // Bubble ffmpeg's last few lines for debugging without spamming.
        const tail = stderr.split("\n").slice(-3).join(" | ");
        console.warn(`[ffmpeg stderr] ${tail}`);
      }
      resolve(code ?? 1);
    });
    // Hard cap so a hung URL can't lock the worker.
    setTimeout(() => {
      child.kill("SIGKILL");
      resolve(124);
    }, 60_000).unref();
  });
}
