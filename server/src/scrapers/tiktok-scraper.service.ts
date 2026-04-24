import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { extractTikTokVideoId, type ScrapeResult } from "./scrapers.types.js";

@Injectable()
export class TikTokScraperService {
  private readonly logger = new Logger(TikTokScraperService.name);

  constructor(private config: ConfigService) {}

  async scrape(url: string): Promise<ScrapeResult> {
    const videoId = extractTikTokVideoId(url);
    if (!videoId) {
      this.logger.warn(`Could not extract TikTok videoId from: ${url}`);
      return { viewCount: null, available: false };
    }

    const host = this.config.get<string>(
      "RAPIDAPI_TIKTOK_HOST",
      "tiktok-api23.p.rapidapi.com",
    );
    const key = this.config.get<string>("RAPIDAPI_KEY");
    if (!key) {
      this.logger.error("RAPIDAPI_KEY is not set");
      return { viewCount: null, available: false };
    }

    const endpoint = `https://${host}/api/post/detail?videoId=${videoId}`;

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
        this.logger.warn(`TikTok scrape HTTP ${res.status} for ${videoId}`);
        return { viewCount: null, available: false };
      }

      const body = (await res.json()) as Record<string, unknown>;
      const item = extractTikTokItem(body);
      if (!item) {
        return { viewCount: null, available: false };
      }

      const views = pickNumber(item, [
        "stats.playCount",
        "statsV2.playCount",
        "playCount",
      ]);
      const createdTs = pickNumber(item, ["createTime", "create_time"]);

      return {
        viewCount: views,
        available: views != null,
        postedAt:
          createdTs != null ? new Date(createdTs * 1000) : undefined,
      };
    } catch (err) {
      this.logger.error(`TikTok scrape error for ${videoId}: ${String(err)}`);
      return { viewCount: null, available: false };
    }
  }
}

function extractTikTokItem(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  const itemInfo = body.itemInfo as Record<string, unknown> | undefined;
  const itemStruct = itemInfo?.itemStruct as Record<string, unknown> | undefined;
  if (itemStruct) return itemStruct;

  const data = body.data as Record<string, unknown> | undefined;
  if (data && typeof data === "object") return data;

  if (body.id || body.stats) return body;
  return null;
}

function pickNumber(
  obj: Record<string, unknown>,
  paths: string[],
): number | null {
  for (const path of paths) {
    const parts = path.split(".");
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as object)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "number" && Number.isFinite(cur)) return cur;
    if (typeof cur === "string" && cur.trim() !== "") {
      const n = Number(cur);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
