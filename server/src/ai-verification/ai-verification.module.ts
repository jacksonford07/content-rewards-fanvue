import { Module } from "@nestjs/common";
import { AiVerificationService } from "./ai-verification.service.js";
import { FrameExtractorService } from "./frame-extractor.service.js";
import { DbModule } from "../db/db.module.js";
import { ScrapersModule } from "../scrapers/scrapers.module.js";

@Module({
  imports: [DbModule, ScrapersModule],
  providers: [AiVerificationService, FrameExtractorService],
  exports: [AiVerificationService],
})
export class AiVerificationModule {}
