import { Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";

@Controller("notifications")
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  list(
    @Req() req: { user: { id: string } },
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.notificationsService.list(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post(":id/read")
  markRead(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Post("read-all")
  markAllRead(@Req() req: { user: { id: string } }) {
    return this.notificationsService.markAllRead(req.user.id);
  }
}
