import { Injectable, Logger } from "@nestjs/common";
import { InstagramScraperService } from "./instagram-scraper.service.js";
import { TikTokScraperService } from "./tiktok-scraper.service.js";
import { YouTubeScraperService } from "./youtube-scraper.service.js";
import { YouTubeDownloaderService } from "./youtube-downloader.service.js";
import { detectPlatform, type ScrapeResult } from "./scrapers.types.js";

@Injectable()
export class ScrapersService {
  private readonly logger = new Logger(ScrapersService.name);

  constructor(
    private tiktok: TikTokScraperService,
    private instagram: InstagramScraperService,
    private youtube: YouTubeScraperService,
    private youtubeDl: YouTubeDownloaderService,
  ) {}

  async getViews(url: string): Promise<ScrapeResult> {
    const platform = detectPlatform(url);
    switch (platform) {
      case "tiktok":
        return this.tiktok.scrape(url);
      case "instagram":
        return this.instagram.scrape(url);
      case "youtube":
        return this.youtube.scrape(url);
      default:
        this.logger.warn(`Unknown platform for URL: ${url}`);
        return { viewCount: null, available: false };
    }
  }

  /**
   * Returns a direct mp4 URL ffmpeg can stream. For Instagram and TikTok
   * this is just the `videoUrl` already returned by `getViews()`. For
   * YouTube we hit a paid downloader API (Data API doesn't expose media
   * links). Called only by AI verification, not by the view-tracking cron.
   */
  async getMediaUrl(url: string): Promise<string | null> {
    const platform = detectPlatform(url);
    if (platform === "youtube") {
      return this.youtubeDl.getMediaUrl(url);
    }
    const scrape = await this.getViews(url);
    return scrape.videoUrl ?? null;
  }
}
