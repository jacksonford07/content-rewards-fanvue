import { Module } from "@nestjs/common";
import { TrustModule } from "../trust/trust.module.js";
import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsService } from "./campaigns.service.js";

@Module({
  imports: [TrustModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
