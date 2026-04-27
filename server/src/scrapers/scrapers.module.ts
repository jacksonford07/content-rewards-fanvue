import { Module } from "@nestjs/common";
import { InstagramScraperService } from "./instagram-scraper.service.js";
import { ScrapersService } from "./scrapers.service.js";
import { TikTokScraperService } from "./tiktok-scraper.service.js";
import { YouTubeScraperService } from "./youtube-scraper.service.js";
import { YouTubeDownloaderService } from "./youtube-downloader.service.js";

@Module({
  providers: [
    TikTokScraperService,
    InstagramScraperService,
    YouTubeScraperService,
    YouTubeDownloaderService,
    ScrapersService,
  ],
  exports: [ScrapersService],
})
export class ScrapersModule {}
