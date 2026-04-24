import { Injectable, Logger } from "@nestjs/common";
import { InstagramScraperService } from "./instagram-scraper.service.js";
import { TikTokScraperService } from "./tiktok-scraper.service.js";
import { YouTubeScraperService } from "./youtube-scraper.service.js";
import { detectPlatform, type ScrapeResult } from "./scrapers.types.js";

@Injectable()
export class ScrapersService {
  private readonly logger = new Logger(ScrapersService.name);

  constructor(
    private tiktok: TikTokScraperService,
    private instagram: InstagramScraperService,
    private youtube: YouTubeScraperService,
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
}
