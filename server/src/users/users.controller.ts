import { Body, Controller, Get, Patch, Put, Req } from "@nestjs/common";
import { UsersService } from "./users.service.js";
import type {
  ContactChannel,
  PayoutMethod,
} from "./payout-validators.js";

@Controller()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Patch("users/me")
  updateMe(
    @Req() req: { user: { id: string } },
    @Body()
    body: {
      displayName?: string;
      avatarUrl?: string;
      role?: "clipper" | "creator";
      // v1.2 M2.5 — creator-reported Fanvue page subscription price (cents).
      // null clears it; 0 = free page; >0 = paid page monthly cost.
      fanvuePageSubPriceCents?: number | null;
    },
  ) {
    return this.usersService.updateMe(req.user.id, body);
  }

  @Get("users/me/payout-methods")
  getPayoutMethods(@Req() req: { user: { id: string } }) {
    return this.usersService.getPayoutSettings(req.user.id);
  }

  @Put("users/me/payout-methods")
  updatePayoutMethods(
    @Req() req: { user: { id: string } },
    @Body()
    body: {
      methods?: { method: PayoutMethod; value: string }[];
      contactChannel?: ContactChannel | null;
      contactValue?: string | null;
    },
  ) {
    return this.usersService.updatePayoutSettings(req.user.id, body);
  }
}
