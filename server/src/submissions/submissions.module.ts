import { Module } from "@nestjs/common";
import { AiVerificationModule } from "../ai-verification/ai-verification.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ScrapersModule } from "../scrapers/scrapers.module.js";
import { TrustModule } from "../trust/trust.module.js";
import { SubmissionsController } from "./submissions.controller.js";
import { SubmissionsService } from "./submissions.service.js";

@Module({
  imports: [NotificationsModule, ScrapersModule, AiVerificationModule, TrustModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
