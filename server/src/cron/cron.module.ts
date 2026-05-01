import { Module } from "@nestjs/common";
import { FanvueModule } from "../fanvue/fanvue.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ScrapersModule } from "../scrapers/scrapers.module.js";
import { SubmissionsModule } from "../submissions/submissions.module.js";
import { CronController } from "./cron.controller.js";
import { CronService } from "./cron.service.js";

@Module({
  imports: [NotificationsModule, ScrapersModule, SubmissionsModule, FanvueModule],
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}
