import { Controller, Get, Query, Req } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service.js";

@Controller("analytics")
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get("dashboard")
  dashboard(
    @Req() req: { user: { id: string } },
    @Query("campaignId") campaignId?: string,
  ) {
    return this.analyticsService.dashboard(req.user.id, campaignId);
  }

  @Get("campaigns")
  campaigns(
    @Req() req: { user: { id: string } },
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.analyticsService.campaignBreakdown(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
