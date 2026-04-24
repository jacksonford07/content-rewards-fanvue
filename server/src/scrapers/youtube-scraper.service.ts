import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  extractYouTubeVideoId,
  type ScrapeResult,
} from "./scrapers.types.js";

@Injectable()
export class YouTubeScraperService {
  private readonly logger = new Logger(YouTubeScraperService.name);

  constructor(private config: ConfigService) {}

  async scrape(url: string): Promise<ScrapeResult> {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      this.logger.warn(`Could not extract YouTube videoId from: ${url}`);
      return { viewCount: null, available: false };
    }

    const key = this.config.get<string>("YOUTUBE_API_KEY");
    if (!key) {
      this.logger.error("YOUTUBE_API_KEY is not set");
      return { viewCount: null, available: false };
    }

    const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`;

    try {
      const res = await fetch(endpoint, { method: "GET" });

      if (!res.ok) {
        this.logger.warn(
          `YouTube scrape HTTP ${res.status} for ${videoId}`,
        );
        return { viewCount: null, available: false };
      }

      const body = (await res.json()) as Record<string, unknown>;
      const items = body.items as unknown[] | undefined;

      // Empty items array → video deleted, private, or doesn't exist
      if (!Array.isArray(items) || items.length === 0) {
        return { viewCount: null, available: false };
      }

      const item = items[0] as Record<string, unknown>;
      const statistics = item.statistics as Record<string, unknown> | undefined;
      const snippet = item.snippet as Record<string, unknown> | undefined;

      const viewCount = pickNumber(statistics, ["viewCount"]);

      const publishedAtRaw = snippet?.publishedAt;
      const postedAt =
        typeof publishedAtRaw === "string"
          ? new Date(publishedAtRaw)
          : undefined;

      const channelTitle = snippet?.channelTitle;
      const platformUsername =
        typeof channelTitle === "string" && channelTitle.trim() !== ""
          ? channelTitle
          : undefined;

      return {
        viewCount,
        available: true,
        postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : undefined,
        platformUsername,
      };
    } catch (err) {
      this.logger.error(
        `YouTube scrape error for ${videoId}: ${String(err)}`,
      );
      return { viewCount: null, available: false };
    }
  }
}

function pickNumber(
  obj: Record<string, unknown> | undefined,
  keys: string[],
): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
