import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";
import {
  type ContactChannel,
  type PayoutMethod,
  PAYOUT_METHODS,
  CONTACT_CHANNELS,
  validatePayoutMethod,
  validateContact,
} from "./payout-validators.js";

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private db: Database) {}

  async updateMe(
    userId: string,
    data: {
      displayName?: string;
      avatarUrl?: string;
      role?: "clipper" | "creator";
      fanvuePageSubPriceCents?: number | null;
    },
  ) {
    // Role is a one-time choice. Once set to clipper or creator, it cannot
    // be changed. A Fanvue account registered as a clipper cannot become a
    // creator and vice versa.
    if (data.role) {
      const [current] = await this.db
        .select({ role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (current && (current.role === "clipper" || current.role === "creator")) {
        if (current.role !== data.role) {
          throw new BadRequestException(
            "Role is locked to your Fanvue account and cannot be changed.",
          );
        }
      }
    }

    // v1.2 M2.5 — basic sanity on the price. Negative = nope.
    if (
      data.fanvuePageSubPriceCents !== undefined &&
      data.fanvuePageSubPriceCents !== null &&
      data.fanvuePageSubPriceCents < 0
    ) {
      throw new BadRequestException("Page price must be 0 or positive cents");
    }

    const [user] = await this.db
      .update(schema.users)
      .set({ ...data })
      .where(eq(schema.users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  // ── Payout settings (M2.1) ─────────────────────────────────────────────

  async getPayoutSettings(userId: string) {
    const [user] = await this.db
      .select({
        contactChannel: schema.users.contactChannel,
        contactValue: schema.users.contactValue,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const methods = await this.db
      .select()
      .from(schema.clipperPayoutMethods)
      .where(eq(schema.clipperPayoutMethods.userId, userId));

    return {
      contactChannel: user?.contactChannel ?? null,
      contactValue: user?.contactValue ?? null,
      methods: methods.map((m) => ({
        method: m.method,
        value: m.value,
        updatedAt: m.updatedAt.toISOString(),
      })),
    };
  }

  async updatePayoutSettings(
    userId: string,
    data: {
      methods?: { method: PayoutMethod; value: string }[];
      contactChannel?: ContactChannel | null;
      contactValue?: string | null;
    },
  ) {
    if (data.methods) {
      const seen = new Set<string>();
      for (const m of data.methods) {
        if (!PAYOUT_METHODS.includes(m.method)) {
          throw new BadRequestException(`Unknown method: ${m.method}`);
        }
        if (seen.has(m.method)) {
          throw new BadRequestException(`Duplicate method: ${m.method}`);
        }
        seen.add(m.method);
        const result = validatePayoutMethod(m.method, m.value);
        if (!result.valid) {
          throw new BadRequestException(`${m.method}: ${result.error}`);
        }
      }
    }
    if (
      data.contactChannel !== undefined &&
      data.contactChannel !== null
    ) {
      if (!CONTACT_CHANNELS.includes(data.contactChannel)) {
        throw new BadRequestException(
          `Unknown contact channel: ${data.contactChannel}`,
        );
      }
      if (!data.contactValue || !data.contactValue.trim()) {
        throw new BadRequestException("Contact value required");
      }
      const cr = validateContact(data.contactChannel, data.contactValue);
      if (!cr.valid) throw new BadRequestException(cr.error);
    }

    if (
      data.contactChannel !== undefined ||
      data.contactValue !== undefined
    ) {
      await this.db
        .update(schema.users)
        .set({
          contactChannel: data.contactChannel ?? null,
          contactValue: data.contactValue ?? null,
        })
        .where(eq(schema.users.id, userId));
    }

    if (data.methods) {
      const desired = new Map(data.methods.map((m) => [m.method, m.value]));
      const existing = await this.db
        .select()
        .from(schema.clipperPayoutMethods)
        .where(eq(schema.clipperPayoutMethods.userId, userId));
      const existingByMethod = new Map(existing.map((m) => [m.method, m]));

      for (const m of existing) {
        if (!desired.has(m.method)) {
          await this.db
            .delete(schema.clipperPayoutMethods)
            .where(
              and(
                eq(schema.clipperPayoutMethods.userId, userId),
                eq(schema.clipperPayoutMethods.method, m.method),
              ),
            );
        }
      }

      for (const [method, value] of desired) {
        const prev = existingByMethod.get(method);
        if (prev) {
          if (prev.value !== value) {
            await this.db
              .update(schema.clipperPayoutMethods)
              .set({ value, updatedAt: new Date() })
              .where(eq(schema.clipperPayoutMethods.id, prev.id));
          }
        } else {
          await this.db
            .insert(schema.clipperPayoutMethods)
            .values({ userId, method, value });
        }
      }
    }

    return this.getPayoutSettings(userId);
  }
}
