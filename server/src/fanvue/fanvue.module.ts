import { Module } from "@nestjs/common";
import { FanvueTrackingLinksService } from "./fanvue-tracking-links.service.js";

@Module({
  providers: [FanvueTrackingLinksService],
  exports: [FanvueTrackingLinksService],
})
export class FanvueModule {}
