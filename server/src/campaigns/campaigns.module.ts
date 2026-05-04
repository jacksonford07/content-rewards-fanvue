import { Module, forwardRef } from "@nestjs/common";
import { TrustModule } from "../trust/trust.module.js";
import { SubmissionsModule } from "../submissions/submissions.module.js";
import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsService } from "./campaigns.service.js";

@Module({
  imports: [TrustModule, forwardRef(() => SubmissionsModule)],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
