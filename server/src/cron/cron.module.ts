import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { CronController } from "./cron.controller.js";
import { CronService } from "./cron.service.js";

@Module({
  imports: [NotificationsModule],
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}
