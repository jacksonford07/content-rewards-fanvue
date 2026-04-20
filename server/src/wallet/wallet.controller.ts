import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { WalletService } from "./wallet.service.js";

@Controller("wallet")
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  getWallet(@Req() req: { user: { id: string } }) {
    return this.walletService.getWallet(req.user.id);
  }

  @Get("transactions")
  getTransactions(
    @Req() req: { user: { id: string } },
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.walletService.getTransactions(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post("topup")
  topup(
    @Req() req: { user: { id: string } },
    @Body() body: { amount: number },
  ) {
    return this.walletService.topup(req.user.id, body.amount);
  }

  @Post("withdraw")
  withdraw(
    @Req() req: { user: { id: string } },
    @Body() body: { amount: number },
  ) {
    return this.walletService.withdraw(req.user.id, body.amount);
  }
}
