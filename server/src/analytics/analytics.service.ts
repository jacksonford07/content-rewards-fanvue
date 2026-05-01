import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql, inArray, notInArray } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DB) private db: Database) {}

  async dashboard(creatorId: string, campaignId?: string) {
    const conditions = [eq(schema.campaigns.creatorId, creatorId)];
    if (campaignId) {
      conditions.push(eq(schema.campaigns.id, campaignId));
    } else {
      conditions.push(
        notInArray(schema.campaigns.status, ["draft", "pending_budget"]),
      );
    }

    const creatorCampaigns = await this.db
      .select()
      .from(schema.campaigns)
      .where(and(...conditions));

    const campaignIds = creatorCampaigns.map((c) => c.id);

    if (campaignIds.length === 0) {
      return {
        totalViews: 0,
        totalSpend: 0,
        totalClippers: 0,
        averageCpm: 0,
        activeCampaigns: 0,
        totalSubmissions: 0,
        campaignTitle: null,
      };
    }

    const [stats] = await this.db
      .select({
        totalViews:
          sql<number>`coalesce(sum(case when ${schema.submissions.status} in ('approved','auto_approved','verified','paid') then coalesce(${schema.submissions.viewsAtDay30}, ${schema.submissions.lastViewCount}) else 0 end), 0)::int`,
        totalClippers:
          sql<number>`count(distinct ${schema.submissions.fanId})::int`,
        totalSubmissions: sql<number>`count(*)::int`,
      })
      .from(schema.submissions)
      .where(inArray(schema.submissions.campaignId, campaignIds));

    const totalSpentCents = creatorCampaigns.reduce(
      (sum, c) => sum + c.budgetSpentCents,
      0,
    );

    const totalViews = stats?.totalViews ?? 0;
    const averageCpm =
      totalViews > 0 ? (totalSpentCents / totalViews) * 1000 : 0;

    return {
      totalViews,
      totalSpend: totalSpentCents / 100,
      totalClippers: stats?.totalClippers ?? 0,
      averageCpm: Math.round(averageCpm) / 100,
      activeCampaigns: creatorCampaigns.filter((c) => c.status === "active")
        .length,
      totalSubmissions: stats?.totalSubmissions ?? 0,
      campaignTitle: campaignId ? creatorCampaigns[0]?.title ?? null : null,
    };
  }

  async campaignBreakdown(
    creatorId: string,
    params?: { page?: number; limit?: number },
  ) {
    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 20));
    const offset = (page - 1) * limit;

    const where = and(
      eq(schema.campaigns.creatorId, creatorId),
      notInArray(schema.campaigns.status, ["draft", "pending_budget"]),
    );

    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.campaigns)
      .where(where);
    const totalItems = totalResult?.count ?? 0;

    const creatorCampaigns = await this.db
      .select()
      .from(schema.campaigns)
      .where(where)
      .orderBy(desc(schema.campaigns.createdAt))
      .limit(limit)
      .offset(offset);

    const campaignIds = creatorCampaigns.map((c) => c.id);
    const meta = {
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    };

    if (campaignIds.length === 0) return { data: [], meta };

    const submissionStats = await this.db
      .select({
        campaignId: schema.submissions.campaignId,
        totalSubmissions: sql<number>`count(*)::int`,
        activeClippers:
          sql<number>`count(distinct ${schema.submissions.fanId})::int`,
        totalViews:
          sql<number>`coalesce(sum(case when ${schema.submissions.status} in ('approved','auto_approved','verified','paid') then coalesce(${schema.submissions.viewsAtDay30}, ${schema.submissions.lastViewCount}) else 0 end), 0)::int`,
      })
      .from(schema.submissions)
      .where(inArray(schema.submissions.campaignId, campaignIds))
      .groupBy(schema.submissions.campaignId);

    const statsMap = new Map(submissionStats.map((s) => [s.campaignId, s]));

    return {
      data: creatorCampaigns.map((c) => {
        const stats = statsMap.get(c.id);
        const views = stats?.totalViews ?? 0;
        const spent = c.budgetSpentCents / 100;
        return {
          id: c.id,
          title: c.title,
          status: c.status,
          sourceThumbnailUrl: c.sourceThumbnailUrl ?? "",
          totalBudget: c.totalBudgetCents / 100,
          budgetSpent: spent,
          totalViews: views,
          totalSubmissions: stats?.totalSubmissions ?? 0,
          activeClippers: stats?.activeClippers ?? 0,
          cpm:
            views > 0 ? Math.round((spent / views) * 1000 * 100) / 100 : 0,
        };
      }),
      meta,
    };
  }
}
