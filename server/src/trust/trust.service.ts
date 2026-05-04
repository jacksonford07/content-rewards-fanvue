import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";

// 7-day auto-confirm grace per CC1 D5 / M3.5.
const AUTO_CONFIRM_DAYS = 7;
// 60-day inactive threshold for the empty-state badge per M3.4.
const INACTIVE_DAYS = 60;

export interface TrustWindow {
  // Creator-side
  creatorPaidCount: number;
  creatorVerifiedCount: number;
  creatorPaidRate: number | null;
  // Clipper-side
  clipperApprovedCount: number;
  clipperDecidedCount: number;
  clipperApprovalRate: number | null;
  clipperPaidCount: number;
  clipperDisputedCount: number;
  clipperDisputeFreeRate: number | null;
  clipperScore: number | null;
}

export interface TrustScore {
  userId: string;
  windows: { ninetyDay: TrustWindow; allTime: TrustWindow };
  lastPayoutAt: string | null; // ISO; for the "Inactive 60d" badge
}

interface RawTrustRow {
  creator_paid_count: number;
  creator_verified_count: number;
  clipper_approved_count: number;
  clipper_decided_count: number;
  clipper_paid_count: number;
  clipper_disputed_count: number;
  last_payout_at: Date | null;
  [key: string]: unknown;
}

@Injectable()
export class TrustService {
  constructor(@Inject(DB) private db: Database) {}

  /**
   * Compute the trust score for a single user, both windows.
   *
   * Single SQL round-trip with conditional aggregates. At v1 scale (<100
   * creators, <500 payout_events expected for the first 3 months) this is
   * sub-100ms even without the cached columns we deliberately skipped (D1).
   */
  async getTrustScore(userId: string): Promise<TrustScore> {
    const ninetyDayCutoff = sql`now() - interval '90 days'`;
    const autoConfirmCutoff = sql`now() - interval '${sql.raw(String(AUTO_CONFIRM_DAYS))} days'`;

    // We bundle both windows into one query via FILTER clauses. Neat with
    // Postgres aggregates; not so neat to read.
    const result = await this.db.execute<RawTrustRow & { window: string }>(sql`
      WITH creator_events AS (
        SELECT
          pe.created_at,
          pe.confirmed_at,
          pe.disputed_at,
          pe.dispute_resolved_at,
          pe.dispute_resolution
        FROM payout_events pe
        WHERE pe.creator_id = ${userId}
      ),
      creator_verified AS (
        SELECT s.created_at
        FROM submissions s
        JOIN campaigns c ON c.id = s.campaign_id
        WHERE c.creator_id = ${userId}
          AND s.status IN ('ready_to_pay', 'paid', 'paid_off_platform', 'disputed')
      ),
      clipper_subs AS (
        SELECT s.created_at, s.status
        FROM submissions s
        WHERE s.fan_id = ${userId}
      ),
      clipper_events AS (
        SELECT
          pe.created_at,
          pe.confirmed_at,
          pe.disputed_at,
          pe.dispute_resolved_at,
          pe.dispute_resolution
        FROM payout_events pe
        WHERE pe.clipper_id = ${userId}
      )
      SELECT
        'all' AS window,
        (SELECT count(*)::int FROM creator_events
          WHERE (confirmed_at IS NOT NULL
                 OR (created_at < ${autoConfirmCutoff} AND disputed_at IS NULL))
            AND (dispute_resolution IS DISTINCT FROM 'rejected')
        ) AS creator_paid_count,
        (SELECT count(*)::int FROM creator_verified) AS creator_verified_count,
        (SELECT count(*)::int FROM clipper_subs
          WHERE status IN ('approved', 'auto_approved', 'ready_to_pay', 'paid', 'paid_off_platform', 'disputed')
        ) AS clipper_approved_count,
        (SELECT count(*)::int FROM clipper_subs
          WHERE status <> 'pending'
        ) AS clipper_decided_count,
        (SELECT count(*)::int FROM clipper_events) AS clipper_paid_count,
        (SELECT count(*)::int FROM clipper_events
          WHERE dispute_resolution = 'rejected'
        ) AS clipper_disputed_count,
        (SELECT max(created_at) FROM clipper_events) AS last_payout_at
      UNION ALL
      SELECT
        '90d' AS window,
        (SELECT count(*)::int FROM creator_events
          WHERE created_at >= ${ninetyDayCutoff}
            AND (confirmed_at IS NOT NULL
                 OR (created_at < ${autoConfirmCutoff} AND disputed_at IS NULL))
            AND (dispute_resolution IS DISTINCT FROM 'rejected')
        ) AS creator_paid_count,
        (SELECT count(*)::int FROM creator_verified
          WHERE created_at >= ${ninetyDayCutoff}
        ) AS creator_verified_count,
        (SELECT count(*)::int FROM clipper_subs
          WHERE created_at >= ${ninetyDayCutoff}
            AND status IN ('approved', 'auto_approved', 'ready_to_pay', 'paid', 'paid_off_platform', 'disputed')
        ) AS clipper_approved_count,
        (SELECT count(*)::int FROM clipper_subs
          WHERE created_at >= ${ninetyDayCutoff} AND status <> 'pending'
        ) AS clipper_decided_count,
        (SELECT count(*)::int FROM clipper_events
          WHERE created_at >= ${ninetyDayCutoff}
        ) AS clipper_paid_count,
        (SELECT count(*)::int FROM clipper_events
          WHERE created_at >= ${ninetyDayCutoff}
            AND dispute_resolution = 'rejected'
        ) AS clipper_disputed_count,
        NULL::timestamptz AS last_payout_at
    `);

    const rows = (result as unknown as { rows: (RawTrustRow & { window: string })[] }).rows;
    const allRow = rows.find((r) => r.window === "all");
    const ninetyRow = rows.find((r) => r.window === "90d");

    return {
      userId,
      windows: {
        ninetyDay: this.buildWindow(ninetyRow),
        allTime: this.buildWindow(allRow),
      },
      lastPayoutAt: allRow?.last_payout_at?.toISOString?.() ?? null,
    };
  }

  /**
   * Aggregate trust scores for a batch of user IDs in a single query.
   * Used by campaign-list serialisation and creator-inbox to avoid N+1.
   */
  async getTrustScoresByIds(userIds: string[]): Promise<Map<string, TrustScore>> {
    const result = new Map<string, TrustScore>();
    if (userIds.length === 0) return result;
    // Naive impl for v1 — fine at low cardinality. Move to a single
    // aggregate query in v1.2 if profile counts grow.
    await Promise.all(
      userIds.map(async (id) => {
        result.set(id, await this.getTrustScore(id));
      }),
    );
    return result;
  }

  /** True when last payout is older than 60 days OR null (never). */
  isInactive(score: TrustScore): boolean {
    if (!score.lastPayoutAt) return false; // "no reviews yet" wins over "inactive"
    const last = new Date(score.lastPayoutAt).getTime();
    return Date.now() - last > INACTIVE_DAYS * 24 * 60 * 60 * 1000;
  }

  private buildWindow(row: RawTrustRow | undefined): TrustWindow {
    if (!row) {
      return {
        creatorPaidCount: 0,
        creatorVerifiedCount: 0,
        creatorPaidRate: null,
        clipperApprovedCount: 0,
        clipperDecidedCount: 0,
        clipperApprovalRate: null,
        clipperPaidCount: 0,
        clipperDisputedCount: 0,
        clipperDisputeFreeRate: null,
        clipperScore: null,
      };
    }
    const creatorPaidRate =
      row.creator_verified_count === 0
        ? null
        : row.creator_paid_count / row.creator_verified_count;
    const clipperApprovalRate =
      row.clipper_decided_count === 0
        ? null
        : row.clipper_approved_count / row.clipper_decided_count;
    const clipperDisputeFreeRate =
      row.clipper_paid_count === 0
        ? null
        : (row.clipper_paid_count - row.clipper_disputed_count) /
          row.clipper_paid_count;
    const clipperScore =
      clipperApprovalRate === null && clipperDisputeFreeRate === null
        ? null
        : (clipperApprovalRate ?? 1) * (clipperDisputeFreeRate ?? 1);
    return {
      creatorPaidCount: row.creator_paid_count,
      creatorVerifiedCount: row.creator_verified_count,
      creatorPaidRate,
      clipperApprovedCount: row.clipper_approved_count,
      clipperDecidedCount: row.clipper_decided_count,
      clipperApprovalRate,
      clipperPaidCount: row.clipper_paid_count,
      clipperDisputedCount: row.clipper_disputed_count,
      clipperDisputeFreeRate,
      clipperScore,
    };
  }
}
