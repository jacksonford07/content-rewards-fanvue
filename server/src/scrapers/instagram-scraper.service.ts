import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ScrapeResult } from "./scrapers.types.js";

@Injectable()
export class InstagramScraperService {
  private readonly logger = new Logger(InstagramScraperService.name);

  constructor(private config: ConfigService) {}

  async scrape(url: string): Promise<ScrapeResult> {
    const host = this.config.get<string>(
      "RAPIDAPI_INSTAGRAM_HOST",
      "instagram-looter2.p.rapidapi.com",
    );
    const key = this.config.get<string>("RAPIDAPI_KEY");
    if (!key) {
      this.logger.error("RAPIDAPI_KEY is not set");
      return { viewCount: null, available: false };
    }

    const endpoint = `https://${host}/post?url=${encodeURIComponent(url)}`;

    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          "x-rapidapi-host": host,
          "x-rapidapi-key": key,
        },
      });

      if (res.status === 404) {
        return { viewCount: null, available: false };
      }
      if (!res.ok) {
        this.logger.warn(`Instagram scrape HTTP ${res.status} for ${url}`);
        return { viewCount: null, available: false };
      }

      const body = (await res.json()) as Record<string, unknown>;

      // Looter returns { status: false, errorMessage: "..." } for deleted/missing posts
      if (body.status === false) {
        return { viewCount: null, available: false };
      }

      const viewCount = pickNumber(body, [
        "video_view_count",
        "video_play_count",
      ]);

      const takenRaw = body.taken_at_timestamp;
      const postedAt =
        typeof takenRaw === "number" ? new Date(takenRaw * 1000) : undefined;

      const owner = body.owner as Record<string, unknown> | undefined;
      const username =
        typeof owner?.username === "string" ? owner.username : undefined;

      const videoUrl =
        typeof body.video_url === "string" ? body.video_url : undefined;

      return {
        viewCount,
        available: true,
        postedAt,
        platformUsername: username,
        videoUrl,
      };
    } catch (err) {
      this.logger.error(`Instagram scrape error for ${url}: ${String(err)}`);
      return { viewCount: null, available: false };
    }
  }
}

function pickNumber(
  obj: Record<string, unknown>,
  keys: string[],
): number | null {
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
