import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { extractYouTubeVideoId } from "./scrapers.types.js";

/**
 * Resolves a YouTube clip URL into a direct mp4 stream URL via a third-party
 * RapidAPI endpoint. This is paid territory (the official YouTube Data API
 * deliberately doesn't expose download links), so we only call it during AI
 * verification — never from the view-tracking cron.
 *
 * Wire-up:
 *   - Subscribe to a YouTube downloader on RapidAPI (default: `yt-api`).
 *   - Set `RAPIDAPI_KEY` (already shared with TikTok/Instagram scrapers).
 *   - Optionally override host via `RAPIDAPI_YOUTUBE_HOST`.
 */
@Injectable()
export class YouTubeDownloaderService {
  private readonly logger = new Logger(YouTubeDownloaderService.name);

  constructor(private config: ConfigService) {}

  async getMediaUrl(url: string): Promise<string | null> {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      this.logger.warn(`Could not extract YouTube videoId from: ${url}`);
      return null;
    }

    const host = this.config.get<string>(
      "RAPIDAPI_YOUTUBE_HOST",
      "yt-api.p.rapidapi.com",
    );
    const key = this.config.get<string>("RAPIDAPI_KEY");
    if (!key) {
      this.logger.warn("RAPIDAPI_KEY not set — YouTube downloader skipped.");
      return null;
    }

    const endpoint = `https://${host}/dl?id=${videoId}`;
    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          "x-rapidapi-host": host,
          "x-rapidapi-key": key,
        },
      });
      if (!res.ok) {
        this.logger.warn(`YouTube downloader HTTP ${res.status} for ${videoId}`);
        return null;
      }
      const body = (await res.json()) as Record<string, unknown>;
      return pickPlayableMp4(body);
    } catch (err) {
      this.logger.error(`YouTube downloader error for ${videoId}: ${String(err)}`);
      return null;
    }
  }
}

/**
 * `yt-api` returns a `formats` (and/or `adaptiveFormats`) array. We want the
 * lowest-quality combined-mp4 format (small bytes, fast for ffmpeg) that has
 * BOTH audio and video so face-match keyframes are easy to extract. Falls back
 * to any mp4 URL if nothing better is found.
 */
function pickPlayableMp4(body: Record<string, unknown>): string | null {
  const formats = (body.formats ?? body.adaptiveFormats) as
    | unknown[]
    | undefined;
  if (!Array.isArray(formats)) return null;

  type Fmt = {
    url?: string;
    mimeType?: string;
    qualityLabel?: string;
    height?: number;
    contentLength?: string;
  };

  const mp4Combined = formats
    .map((f) => f as Fmt)
    .filter(
      (f) =>
        typeof f.url === "string" &&
        typeof f.mimeType === "string" &&
        f.mimeType.startsWith("video/mp4") &&
        // Combined formats include both video+audio codecs — they're the ones
        // ffmpeg can decode without a separate audio stream merge.
        /codecs=".*,/.test(f.mimeType),
    )
    .sort((a, b) => (a.height ?? 9999) - (b.height ?? 9999));

  if (mp4Combined.length > 0) return mp4Combined[0].url ?? null;

  // Fallback: any mp4 url.
  const anyMp4 = formats
    .map((f) => f as Fmt)
    .find(
      (f) =>
        typeof f.url === "string" &&
        typeof f.mimeType === "string" &&
        f.mimeType.startsWith("video/mp4"),
    );
  return anyMp4?.url ?? null;
}
