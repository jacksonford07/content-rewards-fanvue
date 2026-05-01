import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";
import type {
  ClipperPaymentMethod,
  ContactMethod,
  PaymentMethodType,
} from "../db/schema.js";

const VALID_CONTACT_METHODS: ContactMethod[] = [
  "telegram",
  "whatsapp",
  "phone",
  "email",
];

const VALID_PAYMENT_TYPES: PaymentMethodType[] = [
  "paypal",
  "wise",
  "usdc_eth",
  "usdc_sol",
  "btc",
  "bank_uk",
  "bank_us",
  "cashapp",
  "venmo",
];

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private db: Database) {}

  async updateMe(
    userId: string,
    data: {
      displayName?: string;
      avatarUrl?: string;
      role?: "clipper" | "creator";
      contactMethod?: ContactMethod | null;
      contactHandle?: string | null;
      paymentMethods?: ClipperPaymentMethod[];
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

    if (
      data.contactMethod !== undefined &&
      data.contactMethod !== null &&
      !VALID_CONTACT_METHODS.includes(data.contactMethod)
    ) {
      throw new BadRequestException("Invalid contact method");
    }

    let cleanPaymentMethods: ClipperPaymentMethod[] | undefined;
    if (data.paymentMethods !== undefined) {
      if (!Array.isArray(data.paymentMethods)) {
        throw new BadRequestException("paymentMethods must be an array");
      }
      cleanPaymentMethods = data.paymentMethods
        .filter(
          (m) =>
            m &&
            VALID_PAYMENT_TYPES.includes(m.type) &&
            typeof m.value === "string" &&
            m.value.trim().length > 0,
        )
        .map((m) => ({
          type: m.type,
          value: m.value.trim(),
          ...(m.note && typeof m.note === "string"
            ? { note: m.note.trim().slice(0, 200) }
            : {}),
        }));
    }

    const update: Partial<typeof schema.users.$inferInsert> = {};
    if (data.displayName !== undefined) update.displayName = data.displayName;
    if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl;
    if (data.role !== undefined) {
      update.role = data.role;
      update.isCreator = data.role === "creator";
    }
    if (data.contactMethod !== undefined) {
      update.contactMethod = data.contactMethod;
    }
    if (data.contactHandle !== undefined) {
      update.contactHandle = data.contactHandle?.trim() || null;
    }
    if (cleanPaymentMethods !== undefined) {
      update.paymentMethods = cleanPaymentMethods;
    }

    const [user] = await this.db
      .update(schema.users)
      .set(update)
      .where(eq(schema.users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    const { passwordHash: _, ...rest } = user;
    return { ...rest, walletBalance: rest.walletBalanceCents / 100 };
  }
}
