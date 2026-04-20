import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, and, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private db: Database) {}

  async create(data: {
    userId: string;
    type: "new_submission" | "approved" | "rejected" | "payout_released" | "low_budget" | "views_ready";
    title: string;
    message: string;
    actionUrl?: string;
  }) {
    const [notif] = await this.db
      .insert(schema.notifications)
      .values(data)
      .returning();
    return notif;
  }

  async list(userId: string, params?: { page?: number; limit?: number }) {
    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 20));
    const offset = (page - 1) * limit;

    const items = await this.db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId));

    const [unreadResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.read, false),
        ),
      );

    const totalItems = totalResult?.count ?? 0;

    return {
      notifications: items.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount: unreadResult?.count ?? 0,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    };
  }

  async markRead(id: string, userId: string) {
    await this.db
      .update(schema.notifications)
      .set({ read: true })
      .where(
        and(
          eq(schema.notifications.id, id),
          eq(schema.notifications.userId, userId),
        ),
      );
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.db
      .update(schema.notifications)
      .set({ read: true })
      .where(eq(schema.notifications.userId, userId));
    return { success: true };
  }
}
