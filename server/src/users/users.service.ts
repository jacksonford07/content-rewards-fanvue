import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private db: Database) {}

  async updateMe(
    userId: string,
    data: {
      displayName?: string;
      avatarUrl?: string;
      role?: "clipper" | "creator";
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

    const [user] = await this.db
      .update(schema.users)
      .set({
        ...data,
        ...(data.role ? { isCreator: data.role === "creator" } : {}),
      })
      .where(eq(schema.users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

}
