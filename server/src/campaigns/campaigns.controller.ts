import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";
import { CampaignsService } from "./campaigns.service.js";

@Controller("campaigns")
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Get("mine")
  mine(
    @Req() req: { user: { id: string } },
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("sort") sort?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.campaignsService.mine(req.user.id, {
      search,
      status: status ? status.split(",") : undefined,
      sort,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("mine/stats")
  mineStats(@Req() req: { user: { id: string } }) {
    return this.campaignsService.mineStats(req.user.id);
  }

  @Get()
  list(
    @Req() req: { user: { id: string } },
    @Query("platforms") platforms?: string,
    @Query("min_rate") minRate?: string,
    @Query("has_budget") hasBudget?: string,
    @Query("sort") sort?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.campaignsService.list({
      platforms: platforms ? platforms.split(",") : undefined,
      min_rate: minRate ? parseFloat(minRate) : undefined,
      has_budget: hasBudget === "true",
      sort,
      search,
      viewerId: req.user.id,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("top")
  top(
    @Req() req: { user: { id: string } },
    @Query("limit") limit?: string,
  ) {
    return this.campaignsService.topCampaigns(
      limit ? parseInt(limit, 10) : 10,
      req.user.id,
    );
  }

  @Get("top-clippers")
  topClippers(@Query("limit") limit?: string) {
    return this.campaignsService.topClippers(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Public()
  @Get("by-slug/:slug")
  getBySlug(@Param("slug") slug: string) {
    return this.campaignsService.getBySlug(slug);
  }

  @Public()
  @Get(":id/source-status")
  sourceStatus(@Param("id") id: string) {
    return this.campaignsService.sourceStatus(id);
  }

  @Public()
  @Get(":id")
  getById(@Param("id") id: string) {
    return this.campaignsService.getById(id);
  }

  @Post()
  create(
    @Req() req: { user: { id: string } },
    @Body()
    body: {
      title?: string;
      description?: string;
      requirementsType?: string;
      requirementsText?: string;
      requirementsUrl?: string;
      sourceContentUrl?: string;
      sourceThumbnailUrl?: string;
      allowedPlatforms?: string[];
      rewardRatePer1k?: number;
      totalBudget?: number;
      minPayoutThreshold?: number;
      maxPayoutPerClip?: number;
      status?: string;
      isPrivate?: boolean;
      acceptedPayoutMethods?: string[];
    },
  ) {
    return this.campaignsService.create(req.user.id, body);
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
    @Body() body: Record<string, unknown>,
  ) {
    return this.campaignsService.update(
      id,
      req.user.id,
      body as Parameters<CampaignsService["update"]>[2],
    );
  }

  @Post(":id/pause")
  pause(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.campaignsService.togglePause(id, req.user.id);
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.campaignsService.remove(id, req.user.id);
  }
}
