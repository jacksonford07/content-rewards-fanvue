import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { and, desc, eq, gt, ilike, inArray, not, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";
import { TrustService, type TrustScore } from "../trust/trust.service.js";

function generatePrivateSlug(): string {
  return randomBytes(9)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

const SOURCE_STATUS_TTL_MS = 5 * 60 * 1000;
const sourceStatusCache = new Map<string, { available: boolean; at: number }>();

async function probeDriveFile(fileId: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w100`,
      { method: "GET", redirect: "follow", signal: controller.signal },
    );
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

@Injectable()
export class CampaignsService {
  constructor(
    @Inject(DB) private db: Database,
    private trust: TrustService,
  ) {}

  async sourceStatus(id: string): Promise<{ available: boolean }> {
    const [campaign] = await this.db
      .select({ url: schema.campaigns.sourceContentUrl })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .limit(1);
    if (!campaign) throw new NotFoundException("Campaign not found");

    const fileId = extractDriveFileId(campaign.url);
    // Non-Drive sources aren't probed — treat as available so the UI still renders.
    if (!fileId) return { available: true };

    const cached = sourceStatusCache.get(fileId);
    if (cached && Date.now() - cached.at < SOURCE_STATUS_TTL_MS) {
      return { available: cached.available };
    }

    const available = await probeDriveFile(fileId);
    sourceStatusCache.set(fileId, { available, at: Date.now() });
    return { available };
  }

  async list(filters: {
    platforms?: string[];
    min_rate?: number;
    has_budget?: boolean;
    sort?: string;
    search?: string;
    viewerId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 12));
    const offset = (page - 1) * limit;
    const conditions = [
      eq(schema.campaigns.status, "active"),
      eq(schema.campaigns.isPrivate, false),
      // Hide campaigns whose pool is fully committed (spent + reserved >=
      // total). Clippers who'd submit here can't earn — FIFO priority is
      // already locked in by earlier submissions.
      sql`(${schema.campaigns.totalBudgetCents} - ${schema.campaigns.budgetSpentCents} - COALESCE((
        SELECT SUM(${schema.submissions.pendingEarningsCents})
        FROM ${schema.submissions}
        WHERE ${schema.submissions.campaignId} = ${schema.campaigns.id}
          AND ${schema.submissions.status} IN ('pending','approved','auto_approved')
      ), 0)) > 0`,
    ];

    if (filters.viewerId) {
      // Hide viewer's own campaigns — creators browse their own in /creator/campaigns.
      conditions.push(not(eq(schema.campaigns.creatorId, filters.viewerId)));

      const banned = await this.db
        .select({ campaignId: schema.campaignBans.campaignId })
        .from(schema.campaignBans)
        .where(eq(schema.campaignBans.userId, filters.viewerId));
      const bannedIds = banned.map((b) => b.campaignId);
      if (bannedIds.length > 0) {
        conditions.push(not(inArray(schema.campaigns.id, bannedIds)));
      }
    }

    if (filters.platforms && filters.platforms.length > 0) {
      const platformConditions = filters.platforms.map(
        (p) => sql`${p} = ANY(${schema.campaigns.allowedPlatforms})`,
      );
      conditions.push(sql`(${sql.join(platformConditions, sql` OR `)})`);
    }

    if (filters.min_rate) {
      const minCents = Math.round(filters.min_rate * 100);
      conditions.push(gt(schema.campaigns.rewardRatePer1kCents, minCents - 1));
    }

    if (filters.has_budget) {
      conditions.push(
        gt(
          sql`${schema.campaigns.totalBudgetCents} - ${schema.campaigns.budgetSpentCents}`,
          0,
        ),
      );
    }

    if (filters.search) {
      conditions.push(ilike(schema.campaigns.title, `%${filters.search}%`));
    }

    // M3.3 — default sort by creator trust descending. Tiebreakers:
    // 90-day count desc, then total_budget_cents desc, then created_at
    // desc (final stable ordering).
    //
    // The score we sort on is the count of confirmed payouts within the
    // window — see CC1/D4 for why we don't sort on rate.
    const trustOrderClauses = sql.join(
      [
        sql`(SELECT count(*) FROM ${schema.payoutEvents} pe
              WHERE pe.creator_id = ${schema.campaigns.creatorId}
                AND (pe.confirmed_at IS NOT NULL
                     OR (pe.created_at < now() - interval '7 days' AND pe.disputed_at IS NULL))
                AND (pe.dispute_resolution IS DISTINCT FROM 'rejected')
            ) DESC`,
        sql`(SELECT count(*) FROM ${schema.payoutEvents} pe
              WHERE pe.creator_id = ${schema.campaigns.creatorId}
                AND pe.created_at >= now() - interval '90 days'
                AND (pe.confirmed_at IS NOT NULL
                     OR (pe.created_at < now() - interval '7 days' AND pe.disputed_at IS NULL))
                AND (pe.dispute_resolution IS DISTINCT FROM 'rejected')
            ) DESC`,
        sql`${schema.campaigns.totalBudgetCents} DESC`,
        sql`${schema.campaigns.createdAt} DESC`,
      ],
      sql`, `,
    );

    let orderBy;
    switch (filters.sort) {
      case "rate_high":
      case "highest_rate":
        orderBy = desc(schema.campaigns.rewardRatePer1kCents);
        break;
      case "most_popular":
        orderBy = desc(schema.campaigns.budgetSpentCents);
        break;
      case "newest":
        orderBy = desc(schema.campaigns.createdAt);
        break;
      case "budget_high":
        orderBy = desc(
          sql`${schema.campaigns.totalBudgetCents} - ${schema.campaigns.budgetSpentCents}`,
        );
        break;
      default:
        orderBy = trustOrderClauses;
    }

    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.campaigns)
      .where(and(...conditions));
    const totalItems = totalResult?.count ?? 0;

    const rows = await this.db
      .select()
      .from(schema.campaigns)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const campaignIds = rows.map((r) => r.id);
    const creatorIds = [...new Set(rows.map((r) => r.creatorId))];

    const creators =
      creatorIds.length > 0
        ? await this.db
            .select()
            .from(schema.users)
            .where(inArray(schema.users.id, creatorIds))
        : [];

    const submissionStats =
      campaignIds.length > 0
        ? await this.db
            .select({
              campaignId: schema.submissions.campaignId,
              totalSubmissions: sql<number>`count(*)::int`,
              activeClippers:
                sql<number>`count(distinct ${schema.submissions.fanId})::int`,
              totalViews:
                sql<number>`coalesce(sum(${schema.submissions.viewsAtDay30}), 0)::int`,
            })
            .from(schema.submissions)
            .where(inArray(schema.submissions.campaignId, campaignIds))
            .groupBy(schema.submissions.campaignId)
        : [];

    const creatorsMap = new Map(creators.map((c) => [c.id, c]));
    const statsMap = new Map(submissionStats.map((s) => [s.campaignId, s]));
    const reservedMap = await this.loadReservedMap(campaignIds);
    const trustMap = await this.trust.getTrustScoresByIds(creatorIds);

    return {
      data: rows.map((c) =>
        this.serialize(c, creatorsMap, statsMap, reservedMap, trustMap),
      ),
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    };
  }

  // Sum of pending-earnings across submissions that will still be paid
  // from the campaign budget (pending/approved/auto_approved, not yet
  // finalized). Deleted-post submissions stay in the reserve because the
  // frozen view count is still paid at day-30 per spec.
  private async loadReservedMap(
    campaignIds: string[],
  ): Promise<Map<string, number>> {
    if (campaignIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        campaignId: schema.submissions.campaignId,
        reservedCents: sql<number>`coalesce(sum(${schema.submissions.pendingEarningsCents}), 0)::int`,
      })
      .from(schema.submissions)
      .where(
        and(
          inArray(schema.submissions.campaignId, campaignIds),
          inArray(schema.submissions.status, [
            "pending",
            "approved",
            "auto_approved",
          ]),
        ),
      )
      .groupBy(schema.submissions.campaignId);
    return new Map(rows.map((r) => [r.campaignId, r.reservedCents]));
  }

  async getById(id: string) {
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .limit(1);

    if (!campaign) throw new NotFoundException("Campaign not found");

    return this.hydrate(campaign);
  }

  async getBySlug(slug: string) {
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.privateSlug, slug))
      .limit(1);

    if (!campaign) throw new NotFoundException("Campaign not found");

    return this.hydrate(campaign);
  }

  private async hydrate(campaign: typeof schema.campaigns.$inferSelect) {
    const [creator] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, campaign.creatorId))
      .limit(1);

    const [stats] = await this.db
      .select({
        totalSubmissions: sql<number>`count(*)::int`,
        activeClippers:
          sql<number>`count(distinct ${schema.submissions.fanId})::int`,
        totalViews:
          sql<number>`coalesce(sum(${schema.submissions.viewsAtDay30}), 0)::int`,
        openSubmissions: sql<number>`count(*) filter (where ${schema.submissions.status} in ('pending','approved','auto_approved'))::int`,
      })
      .from(schema.submissions)
      .where(eq(schema.submissions.campaignId, campaign.id));

    const creatorsMap = new Map([[creator!.id, creator!]]);
    const statsMap = new Map([[campaign.id, stats!]]);
    const reservedMap = await this.loadReservedMap([campaign.id]);
    const trustMap = await this.trust.getTrustScoresByIds([campaign.creatorId]);

    return this.serialize(
      campaign,
      creatorsMap,
      statsMap,
      reservedMap,
      trustMap,
    );
  }

  async topCampaigns(limit = 10, viewerId?: string) {
    const max = Math.min(50, Math.max(1, limit));

    const conditions = [
      eq(schema.campaigns.status, "active"),
      eq(schema.campaigns.isPrivate, false),
      sql`(${schema.campaigns.totalBudgetCents} - ${schema.campaigns.budgetSpentCents} - COALESCE((
        SELECT SUM(${schema.submissions.pendingEarningsCents})
        FROM ${schema.submissions}
        WHERE ${schema.submissions.campaignId} = ${schema.campaigns.id}
          AND ${schema.submissions.status} IN ('pending','approved','auto_approved')
      ), 0)) > 0`,
    ];
    if (viewerId) {
      conditions.push(not(eq(schema.campaigns.creatorId, viewerId)));
    }

    const rows = await this.db
      .select({
        campaign: schema.campaigns,
        totalViews: sql<number>`coalesce(sum(${schema.submissions.viewsAtDay30}), 0)::int`,
        totalSubmissions: sql<number>`count(${schema.submissions.id})::int`,
      })
      .from(schema.campaigns)
      .leftJoin(
        schema.submissions,
        eq(schema.submissions.campaignId, schema.campaigns.id),
      )
      .where(and(...conditions))
      .groupBy(schema.campaigns.id)
      .orderBy(
        desc(sql`coalesce(sum(${schema.submissions.viewsAtDay30}), 0)`),
        desc(schema.campaigns.createdAt),
      )
      .limit(max);

    const creatorIds = [...new Set(rows.map((r) => r.campaign.creatorId))];
    const creators =
      creatorIds.length > 0
        ? await this.db
            .select()
            .from(schema.users)
            .where(inArray(schema.users.id, creatorIds))
        : [];
    const creatorsMap = new Map(creators.map((c) => [c.id, c]));

    return rows.map((r) => {
      const creator = creatorsMap.get(r.campaign.creatorId);
      return {
        id: r.campaign.id,
        title: r.campaign.title,
        sourceThumbnailUrl: r.campaign.sourceThumbnailUrl,
        rewardRatePer1k: r.campaign.rewardRatePer1kCents / 100,
        totalViews: r.totalViews,
        totalSubmissions: r.totalSubmissions,
        creator: creator
          ? {
              id: creator.id,
              name: creator.displayName,
              handle: creator.handle,
              avatarUrl: creator.avatarUrl ?? "",
            }
          : null,
      };
    });
  }

  async topClippers(limit = 10) {
    const max = Math.min(50, Math.max(1, limit));

    const rows = await this.db
      .select({
        user: schema.users,
        earningsCents: sql<number>`coalesce(sum(${schema.submissions.payoutAmountCents}), 0)::int`,
        totalViews: sql<number>`coalesce(sum(${schema.submissions.viewsAtDay30}), 0)::int`,
        submissionCount: sql<number>`count(${schema.submissions.id})::int`,
      })
      .from(schema.submissions)
      .innerJoin(schema.users, eq(schema.users.id, schema.submissions.fanId))
      .where(
        inArray(schema.submissions.status, [
          "approved",
          "auto_approved",
          "paid",
        ]),
      )
      .groupBy(schema.users.id)
      .orderBy(
        desc(sql`coalesce(sum(${schema.submissions.payoutAmountCents}), 0)`),
        desc(sql`coalesce(sum(${schema.submissions.viewsAtDay30}), 0)`),
      )
      .limit(max);

    return rows.map((r) => ({
      id: r.user.id,
      name: r.user.displayName,
      handle: r.user.handle,
      avatarUrl: r.user.avatarUrl ?? "",
      earnings: r.earningsCents / 100,
      totalViews: r.totalViews,
      submissionCount: r.submissionCount,
    }));
  }

  async create(
    creatorId: string,
    data: {
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
    // v1.1: no escrow / wallet — campaigns publish directly to "active"
    // when the creator hits Publish; otherwise stay as "draft".
    const requestedStatus = data.status;
    const status: "draft" | "active" =
      requestedStatus === "active" ? "active" : "draft";
    if (status === "active") {
      if (
        !data.acceptedPayoutMethods ||
        data.acceptedPayoutMethods.length === 0
      ) {
        throw new BadRequestException(
          "Pick at least one payout method before publishing",
        );
      }
    }
    const isPrivate = data.isPrivate === true;
    const [campaign] = await this.db
      .insert(schema.campaigns)
      .values({
        creatorId,
        title: data.title || "Untitled draft",
        description: data.description || "",
        requirementsType:
          (data.requirementsType as "native" | "google_doc") ?? "native",
        requirementsText: data.requirementsText,
        requirementsUrl: data.requirementsUrl,
        sourceContentUrl: data.sourceContentUrl,
        sourceThumbnailUrl: data.sourceThumbnailUrl,
        allowedPlatforms: data.allowedPlatforms ?? [],
        acceptedPayoutMethods:
          (data.acceptedPayoutMethods as schema.PayoutMethod[]) ?? [],
        rewardRatePer1kCents: Math.round((data.rewardRatePer1k ?? 0) * 100),
        totalBudgetCents: Math.round((data.totalBudget ?? 0) * 100),
        minPayoutThreshold: Math.round(data.minPayoutThreshold ?? 0),
        maxPayoutPerClipCents: data.maxPayoutPerClip
          ? Math.round(data.maxPayoutPerClip * 100)
          : null,
        status,
        isPrivate,
        privateSlug: isPrivate ? generatePrivateSlug() : null,
        goesLiveAt: status === "active" ? new Date() : null,
      })
      .returning();

    return this.serializeSingle(campaign!);
  }

  async update(
    id: string,
    creatorId: string,
    data: {
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
    },
  ) {
    const [existing] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .limit(1);

    if (!existing) throw new NotFoundException("Campaign not found");
    if (existing.creatorId !== creatorId) throw new ForbiddenException();

    const isDraftLike =
      existing.status === "draft" || existing.status === "pending_budget";

    // Title, description, and requirements are always editable
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.requirementsType !== undefined)
      updateData.requirementsType = data.requirementsType;
    if (data.requirementsText !== undefined)
      updateData.requirementsText = data.requirementsText;
    if (data.requirementsUrl !== undefined)
      updateData.requirementsUrl = data.requirementsUrl;

    // All fields editable for draft/pending_budget campaigns
    if (isDraftLike) {
      if (data.sourceContentUrl !== undefined) {
        updateData.sourceContentUrl = data.sourceContentUrl;
        // Source URL changed — drop cached AI keyframes so the next
        // verification re-extracts from the new source.
        if (data.sourceContentUrl !== existing.sourceContentUrl) {
          updateData.sourceKeyframes = null;
        }
      }
      if (data.sourceThumbnailUrl !== undefined)
        updateData.sourceThumbnailUrl = data.sourceThumbnailUrl;
      if (data.allowedPlatforms !== undefined)
        updateData.allowedPlatforms = data.allowedPlatforms;
      if (data.rewardRatePer1k !== undefined)
        updateData.rewardRatePer1kCents = Math.round(
          data.rewardRatePer1k * 100,
        );
      if (data.totalBudget !== undefined)
        updateData.totalBudgetCents = Math.round(data.totalBudget * 100);
      if ((data as { acceptedPayoutMethods?: string[] }).acceptedPayoutMethods !== undefined) {
        updateData.acceptedPayoutMethods = (data as { acceptedPayoutMethods?: string[] }).acceptedPayoutMethods;
      }
      if (data.minPayoutThreshold !== undefined)
        updateData.minPayoutThreshold = Math.round(data.minPayoutThreshold);
      if (data.maxPayoutPerClip !== undefined)
        updateData.maxPayoutPerClipCents = data.maxPayoutPerClip
          ? Math.round(data.maxPayoutPerClip * 100)
          : null;
      if (data.isPrivate !== undefined) {
        updateData.isPrivate = data.isPrivate;
        if (data.isPrivate && !existing.privateSlug) {
          updateData.privateSlug = generatePrivateSlug();
        } else if (!data.isPrivate) {
          updateData.privateSlug = null;
        }
      }
      if (data.status === "active") {
        updateData.status = "active";
        if (!existing.goesLiveAt) updateData.goesLiveAt = new Date();
      }
    }

    const [campaign] = await this.db
      .update(schema.campaigns)
      .set(updateData)
      .where(eq(schema.campaigns.id, id))
      .returning();

    return this.serializeSingle(campaign!);
  }

  async togglePause(id: string, creatorId: string) {
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .limit(1);

    if (!campaign) throw new NotFoundException("Campaign not found");
    if (campaign.creatorId !== creatorId) throw new ForbiddenException();

    if (campaign.status !== "active" && campaign.status !== "paused") {
      throw new BadRequestException("Only active or paused campaigns can be toggled");
    }

    const newStatus = campaign.status === "paused" ? "active" : "paused";
    await this.db
      .update(schema.campaigns)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(schema.campaigns.id, id));

    return { status: newStatus };
  }

  async mine(
    creatorId: string,
    filters?: {
      search?: string;
      status?: string[];
      sort?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 20));
    const offset = (page - 1) * limit;
    const conditions = [eq(schema.campaigns.creatorId, creatorId)];

    if (filters?.search) {
      conditions.push(ilike(schema.campaigns.title, `%${filters.search}%`));
    }

    const validStatuses = [
      "draft",
      "pending_budget",
      "active",
      "paused",
      "completed",
    ] as const;
    type StatusEnum = (typeof validStatuses)[number];
    if (filters?.status && filters.status.length > 0) {
      const selected = filters.status.filter((s): s is StatusEnum =>
        (validStatuses as readonly string[]).includes(s),
      );
      if (selected.length > 0) {
        conditions.push(inArray(schema.campaigns.status, selected));
      }
    }

    let orderBy;
    switch (filters?.sort) {
      case "highest_spend":
        orderBy = desc(schema.campaigns.budgetSpentCents);
        break;
      case "highest_budget":
        orderBy = desc(schema.campaigns.totalBudgetCents);
        break;
      case "newest":
      default:
        orderBy = desc(schema.campaigns.createdAt);
    }

    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.campaigns)
      .where(and(...conditions));
    const totalItems = totalResult?.count ?? 0;

    const rows = await this.db
      .select()
      .from(schema.campaigns)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const campaignIds = rows.map((r) => r.id);

    const submissionStats =
      campaignIds.length > 0
        ? await this.db
            .select({
              campaignId: schema.submissions.campaignId,
              totalSubmissions: sql<number>`count(*)::int`,
              activeClippers:
                sql<number>`count(distinct ${schema.submissions.fanId})::int`,
              totalViews:
                sql<number>`coalesce(sum(${schema.submissions.viewsAtDay30}), 0)::int`,
            })
            .from(schema.submissions)
            .where(inArray(schema.submissions.campaignId, campaignIds))
            .groupBy(schema.submissions.campaignId)
        : [];

    const [creator] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, creatorId))
      .limit(1);

    const creatorsMap = new Map([[creatorId, creator!]]);
    const statsMap = new Map(submissionStats.map((s) => [s.campaignId, s]));
    const reservedMap = await this.loadReservedMap(campaignIds);

    return {
      data: rows.map((c) => this.serialize(c, creatorsMap, statsMap, reservedMap)),
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    };
  }

  async mineStats(creatorId: string) {
    const creatorCampaigns = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.creatorId, creatorId));

    const campaignIds = creatorCampaigns.map((c) => c.id);

    const [submissionStats] =
      campaignIds.length > 0
        ? await this.db
            .select({
              totalClippers:
                sql<number>`count(distinct ${schema.submissions.fanId})::int`,
              totalViews:
                sql<number>`coalesce(sum(${schema.submissions.viewsAtDay30}), 0)::int`,
            })
            .from(schema.submissions)
            .where(inArray(schema.submissions.campaignId, campaignIds))
        : [{ totalClippers: 0, totalViews: 0 }];

    const totalSpentCents = creatorCampaigns.reduce(
      (s, c) => s + c.budgetSpentCents,
      0,
    );

    return {
      activeCampaigns: creatorCampaigns.filter((c) => c.status === "active")
        .length,
      totalClippers: submissionStats?.totalClippers ?? 0,
      totalViews: submissionStats?.totalViews ?? 0,
      totalSpend: totalSpentCents / 100,
    };
  }

  async remove(id: string, creatorId: string) {
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, id))
      .limit(1);

    if (!campaign) throw new NotFoundException("Campaign not found");
    if (campaign.creatorId !== creatorId) throw new ForbiddenException();
    if (campaign.status !== "draft" && campaign.status !== "pending_budget") {
      throw new BadRequestException("Only draft/unfunded campaigns can be deleted");
    }

    await this.db
      .delete(schema.campaigns)
      .where(eq(schema.campaigns.id, id));

    return { success: true };
  }

  async checkCompletion(campaignId: string) {
    const [campaign] = await this.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);

    if (!campaign) return;
    if (campaign.status !== "active") return;

    const available =
      campaign.totalBudgetCents - campaign.budgetSpentCents;
    if (available <= 0) {
      await this.db
        .update(schema.campaigns)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(schema.campaigns.id, campaignId));
    }
  }

  private serialize(
    c: typeof schema.campaigns.$inferSelect,
    creatorsMap: Map<string, typeof schema.users.$inferSelect>,
    statsMap: Map<
      string,
      {
        totalSubmissions: number;
        activeClippers: number;
        totalViews: number;
        openSubmissions?: number;
      }
    >,
    reservedMap?: Map<string, number>,
    trustMap?: Map<string, TrustScore>,
  ) {
    const creator = creatorsMap.get(c.creatorId);
    const stats = statsMap.get(c.id);
    const reservedCents = reservedMap?.get(c.id) ?? 0;
    const availableCents = Math.max(
      c.totalBudgetCents - c.budgetSpentCents - reservedCents,
      0,
    );
    const trust = trustMap?.get(c.creatorId);
    return {
      id: c.id,
      creator: creator
        ? {
            id: creator.id,
            name: creator.displayName,
            handle: creator.handle,
            avatarUrl: creator.avatarUrl ?? "",
            verified: true,
            trust: trust
              ? {
                  ninetyDay: trust.windows.ninetyDay,
                  allTime: trust.windows.allTime,
                  lastPayoutAt: trust.lastPayoutAt,
                }
              : null,
          }
        : null,
      title: c.title,
      description: c.description,
      requirementsType: c.requirementsType,
      requirementsText: c.requirementsText,
      requirementsUrl: c.requirementsUrl,
      sourceContentUrl: c.sourceContentUrl,
      sourceThumbnailUrl: c.sourceThumbnailUrl,
      allowedPlatforms: c.allowedPlatforms,
      acceptedPayoutMethods: c.acceptedPayoutMethods,
      rewardRatePer1k: c.rewardRatePer1kCents / 100,
      totalBudget: c.totalBudgetCents / 100,
      budgetSpent: c.budgetSpentCents / 100,
      budgetReserved: reservedCents / 100,
      budgetAvailable: availableCents / 100,
      minPayoutThreshold: c.minPayoutThreshold,
      maxPayoutPerClip: c.maxPayoutPerClipCents
        ? c.maxPayoutPerClipCents / 100
        : undefined,
      status: c.status,
      isPrivate: c.isPrivate,
      privateSlug: c.privateSlug,
      createdAt: c.createdAt.toISOString(),
      goesLiveAt: c.goesLiveAt?.toISOString() ?? "",
      endsAt: c.endsAt?.toISOString(),
      activeClippers: stats?.activeClippers ?? 0,
      totalViews: stats?.totalViews ?? 0,
      totalSubmissions: stats?.totalSubmissions ?? 0,
      openSubmissions: stats?.openSubmissions ?? 0,
    };
  }

  private serializeSingle(c: typeof schema.campaigns.$inferSelect) {
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      requirementsType: c.requirementsType,
      requirementsText: c.requirementsText,
      requirementsUrl: c.requirementsUrl,
      sourceContentUrl: c.sourceContentUrl,
      sourceThumbnailUrl: c.sourceThumbnailUrl,
      allowedPlatforms: c.allowedPlatforms,
      acceptedPayoutMethods: c.acceptedPayoutMethods,
      rewardRatePer1k: c.rewardRatePer1kCents / 100,
      totalBudget: c.totalBudgetCents / 100,
      budgetSpent: c.budgetSpentCents / 100,
      minPayoutThreshold: c.minPayoutThreshold,
      maxPayoutPerClip: c.maxPayoutPerClipCents
        ? c.maxPayoutPerClipCents / 100
        : undefined,
      status: c.status,
      isPrivate: c.isPrivate,
      privateSlug: c.privateSlug,
      createdAt: c.createdAt.toISOString(),
      goesLiveAt: c.goesLiveAt?.toISOString() ?? "",
      endsAt: c.endsAt?.toISOString(),
      activeClippers: 0,
      totalViews: 0,
      totalSubmissions: 0,
    };
  }
}
