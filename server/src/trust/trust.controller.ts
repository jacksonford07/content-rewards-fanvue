import { Controller, Get, Param } from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";
import { TrustService } from "./trust.service.js";

@Controller("trust")
export class TrustController {
  constructor(private trust: TrustService) {}

  // Public — anyone can view a user's trust score (it's the marketplace
  // signal; hiding it defeats the point).
  @Public()
  @Get("users/:id")
  getForUser(@Param("id") id: string) {
    return this.trust.getTrustScore(id);
  }
}
