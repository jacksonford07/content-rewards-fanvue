import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ScrapersModule } from "../scrapers/scrapers.module.js";
import { SubmissionsModule } from "../submissions/submissions.module.js";
import { CronController } from "./cron.controller.js";
import { CronService } from "./cron.service.js";

@Module({
  imports: [NotificationsModule, ScrapersModule, SubmissionsModule],
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}
