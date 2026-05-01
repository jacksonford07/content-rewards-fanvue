import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private db: Database,
    private jwt: JwtService,
  ) {}

  async me(userId: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  signToken(userId: string) {
    return this.jwt.sign({ sub: userId });
  }

  async findOrCreateDevUser(role: "clipper" | "creator") {
    const email = role === "creator"
      ? "dev-creator@test.local"
      : "dev-clipper@test.local";

    const [existing] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [user] = await this.db
      .insert(schema.users)
      .values({
        email,
        handle: role === "creator" ? "dev_creator" : "dev_clipper",
        displayName: role === "creator" ? "Dev Creator" : "Dev Clipper",
        role,
        fanvueId: `dev-${role}`,
        fanvueHandle: role === "creator" ? "dev_creator" : "dev_clipper",
      })
      .returning();

    return user!;
  }

  private sanitize(user: typeof schema.users.$inferSelect) {
    const { passwordHash: _, ...rest } = user;
    return rest;
  }
}
