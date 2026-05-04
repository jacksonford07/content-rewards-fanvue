import {
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../auth/public.decorator.js";
import { CronService } from "./cron.service.js";

@Controller("cron")
export class CronController {
  constructor(
    private cronService: CronService,
    private config: ConfigService,
  ) {}

  @Public()
  @Post("auto-approve")
  autoApprove(@Headers("x-cron-secret") secret: string) {
    this.verifySecret(secret);
    return this.cronService.autoApprove();
  }

  @Public()
  @Post("lock-views")
  sendViewsReadyReminders(@Headers("x-cron-secret") secret: string) {
    this.verifySecret(secret);
    return this.cronService.sendViewsReadyReminders();
  }

  @Public()
  @Post("track-views")
  trackViews(@Headers("x-cron-secret") secret: string) {
    this.verifySecret(secret);
    return this.cronService.trackViews();
  }

  @Public()
  @Post("finalize-views")
  finalizeViews(@Headers("x-cron-secret") secret: string) {
    this.verifySecret(secret);
    return this.cronService.finalizeViews();
  }

  @Public()
  @Post("sync-subscribers")
  syncSubscribers(@Headers("x-cron-secret") secret: string) {
    this.verifySecret(secret);
    return this.cronService.syncSubscriberAttribution();
  }

  private verifySecret(secret: string) {
    const expected = this.config.get<string>("CRON_SECRET", "cron-secret");
    if (secret !== expected) {
      throw new UnauthorizedException("Invalid cron secret");
    }
  }
}
