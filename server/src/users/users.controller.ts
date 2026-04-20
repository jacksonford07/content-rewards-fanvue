import { Body, Controller, Patch, Req } from "@nestjs/common";
import { UsersService } from "./users.service.js";

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
    },
  ) {
    return this.usersService.updateMe(req.user.id, body);
  }

}
