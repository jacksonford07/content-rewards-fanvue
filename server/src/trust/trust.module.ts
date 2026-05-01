import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { TrustController } from "./trust.controller.js";
import { TrustService } from "./trust.service.js";

@Module({
  imports: [DbModule],
  controllers: [TrustController],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}
