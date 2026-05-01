import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CampaignsModule } from "./campaigns/campaigns.module.js";
import { CronModule } from "./cron/cron.module.js";
import { DbModule } from "./db/db.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { SubmissionsModule } from "./submissions/submissions.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthModule,
    UsersModule,
    CampaignsModule,
    SubmissionsModule,
    NotificationsModule,
    AnalyticsModule,
    CronModule,
  ],
})
export class AppModule {}
