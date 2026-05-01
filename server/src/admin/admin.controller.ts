import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { AdminService } from "./admin.service.js";

@Controller("admin")
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get("disputes")
  list(
    @Req() req: { user: { id: string } },
    @Query("filter") filter?: string,
  ) {
    const f = filter === "resolved" ? "resolved" : filter === "all" ? "all" : "open";
    return this.admin.listDisputes(req.user.id, f);
  }

  @Post("disputes/:id/resolve")
  resolve(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
    @Body() body: { resolution: "confirmed" | "rejected" },
  ) {
    return this.admin.resolveDispute(req.user.id, id, body.resolution);
  }
}
