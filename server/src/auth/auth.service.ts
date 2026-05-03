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

  async findOrCreateDevUser(role: "clipper" | "creator" | "admin") {
    // The "admin" pseudo-role is just a creator with a known email that's
    // in ADMIN_EMAILS — admin status itself is not a column on users, it's
    // an email-allowlist check (see admin.service.assertAdmin).
    const fixtures: Record<
      "clipper" | "creator" | "admin",
      { email: string; handle: string; displayName: string; userRole: "clipper" | "creator" }
    > = {
      clipper: {
        email: "dev-clipper@test.local",
        handle: "dev_clipper",
        displayName: "Dev Clipper",
        userRole: "clipper",
      },
      creator: {
        email: "dev-creator@test.local",
        handle: "dev_creator",
        displayName: "Dev Creator",
        userRole: "creator",
      },
      admin: {
        email: "dev-admin@test.local",
        handle: "dev_admin",
        displayName: "Dev Admin",
        userRole: "creator",
      },
    };
    const fixture = fixtures[role];

    const [existing] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, fixture.email))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [user] = await this.db
      .insert(schema.users)
      .values({
        email: fixture.email,
        handle: fixture.handle,
        displayName: fixture.displayName,
        role: fixture.userRole,
        fanvueId: `dev-${role}`,
        fanvueHandle: fixture.handle,
      })
      .returning();

    return user!;
  }

  private sanitize(user: typeof schema.users.$inferSelect) {
    const { passwordHash: _, ...rest } = user;
    return rest;
  }
}
