import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { SubmissionsService } from "./submissions.service.js";
import type { PayoutMethod } from "../users/payout-validators.js";

@Controller("submissions")
export class SubmissionsController {
  constructor(private submissionsService: SubmissionsService) {}

  @Post()
  submit(
    @Req() req: { user: { id: string } },
    @Body()
    body: { campaignId: string; postUrl: string; platform: string },
  ) {
    return this.submissionsService.submit(req.user.id, body);
  }

  @Get("mine")
  mine(
    @Req() req: { user: { id: string } },
    @Query("tab") tab?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("campaignId") campaignId?: string,
  ) {
    return this.submissionsService.mine(req.user.id, {
      tab,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      campaignId,
    });
  }

  @Get("mine/stats")
  mineStats(@Req() req: { user: { id: string } }) {
    return this.submissionsService.mineStats(req.user.id);
  }

  @Get("inbox")
  inbox(
    @Req() req: { user: { id: string } },
    @Query("tab") tab?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("campaignId") campaignId?: string,
  ) {
    return this.submissionsService.inbox(req.user.id, {
      tab,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      campaignId,
    });
  }

  @Get("inbox/stats")
  inboxStats(
    @Req() req: { user: { id: string } },
    @Query("campaignId") campaignId?: string,
  ) {
    return this.submissionsService.inboxStats(req.user.id, campaignId);
  }

  @Get("campaign/:campaignId")
  byCampaign(
    @Param("campaignId") campaignId: string,
    @Query("status") status?: string,
  ) {
    return this.submissionsService.byCampaign(campaignId, status);
  }

  @Post(":id/approve")
  approve(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.submissionsService.approve(id, req.user.id);
  }

  @Post(":id/reject")
  reject(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
    @Body() body: { reason: string },
  ) {
    return this.submissionsService.reject(id, req.user.id, body.reason);
  }

  @Post(":id/ban")
  ban(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
    @Body() body: { reason: string },
  ) {
    return this.submissionsService.ban(id, req.user.id, body.reason);
  }

  @Post(":id/verify-views")
  verifyViews(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
    @Body() body: { views: number },
  ) {
    return this.submissionsService.verifyViews(id, req.user.id, body.views);
  }

  @Post(":id/dev-fast-forward")
  devFastForward(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.submissionsService.devFastForwardLockDate(id, req.user.id);
  }

  @Get(":id/snapshots")
  snapshots(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.submissionsService.getSnapshots(id, req.user.id);
  }

  // M2.4 — Off-platform payout context for the mark-paid modal.
  // Returns clipper's saved payout methods + contact and the campaign's
  // accepted methods so the UI can pre-fill the form.
  @Get(":id/payout-context")
  payoutContext(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.submissionsService.getPayoutContext(id, req.user.id);
  }

  @Post(":id/mark-paid")
  markPaid(
    @Param("id") id: string,
    @Req() req: { user: { id: string } },
    @Body()
    body: {
      method: PayoutMethod;
      value: string;
      reference?: string;
      txHash?: string;
    },
  ) {
    return this.submissionsService.markPaid(id, req.user.id, body);
  }
}
