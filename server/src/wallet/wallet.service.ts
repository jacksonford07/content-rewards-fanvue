import {
  BadRequestException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { desc, eq, sql, and, inArray } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";

@Injectable()
export class WalletService {
  constructor(@Inject(DB) private db: Database) {}

  async getWallet(userId: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    // Calculate pending payouts (approved submissions not yet paid)
    const [pending] = await this.db
      .select({
        pendingCents: sql<number>`coalesce(sum(
          CASE WHEN ${schema.submissions.status} IN ('approved', 'auto_approved')
          THEN ${schema.campaigns.rewardRatePer1kCents}
          ELSE 0 END
        ), 0)::int`,
      })
      .from(schema.submissions)
      .innerJoin(
        schema.campaigns,
        eq(schema.submissions.campaignId, schema.campaigns.id),
      )
      .where(
        and(
          eq(schema.submissions.fanId, userId),
          inArray(schema.submissions.status, ["approved", "auto_approved"]),
        ),
      );

    return {
      balance: (user?.walletBalanceCents ?? 0) / 100,
      pendingPayouts: (pending?.pendingCents ?? 0) / 100,
    };
  }

  async getTransactions(
    userId: string,
    params?: { page?: number; limit?: number },
  ) {
    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 20));
    const offset = (page - 1) * limit;

    const txns = await this.db
      .select()
      .from(schema.walletTransactions)
      .where(eq(schema.walletTransactions.userId, userId))
      .orderBy(desc(schema.walletTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.walletTransactions)
      .where(eq(schema.walletTransactions.userId, userId));

    const totalItems = totalResult?.count ?? 0;

    return {
      data: txns.map((t) => ({
        id: t.id,
        type: t.type,
        description: t.description,
        amount: t.amountCents / 100,
        at: t.createdAt.toISOString(),
        status: t.status,
        campaignId: t.campaignId ?? undefined,
      })),
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    };
  }

  async topup(userId: string, amountDollars: number) {
    const amountCents = Math.round(amountDollars * 100);
    if (amountCents <= 0) throw new BadRequestException("Invalid amount");

    await this.db
      .update(schema.users)
      .set({
        walletBalanceCents: sql`${schema.users.walletBalanceCents} + ${amountCents}`,
      })
      .where(eq(schema.users.id, userId));

    await this.db.insert(schema.walletTransactions).values({
      userId,
      type: "topup",
      description: `Wallet top-up: $${amountDollars.toFixed(2)}`,
      amountCents,
    });

    return { success: true };
  }

  async withdraw(userId: string, amountDollars: number) {
    const amountCents = Math.round(amountDollars * 100);
    if (amountCents < 2000)
      throw new BadRequestException("Minimum withdrawal is $20");

    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new BadRequestException("User not found");
    if (user.walletBalanceCents < amountCents)
      throw new BadRequestException("Insufficient balance");

    await this.db
      .update(schema.users)
      .set({
        walletBalanceCents: sql`${schema.users.walletBalanceCents} - ${amountCents}`,
      })
      .where(eq(schema.users.id, userId));

    await this.db.insert(schema.walletTransactions).values({
      userId,
      type: "withdrawal",
      description: `Withdrawal: $${amountDollars.toFixed(2)}`,
      amountCents: -amountCents,
    });

    return { success: true };
  }
}
