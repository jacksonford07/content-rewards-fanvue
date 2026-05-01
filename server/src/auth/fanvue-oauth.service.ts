import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import * as schema from "../db/schema.js";

const FANVUE_AUTH_URL = "https://auth.fanvue.com/oauth2/auth";
const FANVUE_TOKEN_URL = "https://auth.fanvue.com/oauth2/token";
const FANVUE_API_URL = "https://api.fanvue.com";

interface PkceEntry {
  verifier: string;
  redirectUri: string;
  createdAt: number;
}

export class NotACreatorError extends Error {
  constructor() {
    super("Fanvue account is not a creator");
    this.name = "NotACreatorError";
  }
}

@Injectable()
export class FanvueOAuthService {
  private readonly logger = new Logger(FanvueOAuthService.name);
  private readonly pkceVerifiers = new Map<string, PkceEntry>();

  constructor(
    @Inject(DB) private db: Database,
    private config: ConfigService,
  ) {
    // Clean expired PKCE entries every 5 minutes
    setInterval(() => this.cleanExpiredPkce(), 5 * 60 * 1000);
  }

  private base64URLEncode(buffer: Buffer): string {
    return buffer
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  /**
   * Build the Fanvue authorization URL with PKCE and store verifier.
   */
  generateAuthUrl(redirectUri: string): string {
    const clientId = this.config.getOrThrow("FANVUE_CLIENT_ID");

    const verifier = this.base64URLEncode(randomBytes(32));
    const challenge = this.base64URLEncode(
      createHash("sha256").update(verifier).digest(),
    );

    const state = this.base64URLEncode(randomBytes(32));
    this.pkceVerifiers.set(state, {
      verifier,
      redirectUri,
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "read:self read:creator",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "login consent",
    });

    return `${FANVUE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback: validate state, exchange code, fetch profile, find/create user.
   */
  async handleCallback(code: string, state: string) {
    const stored = this.pkceVerifiers.get(state);
    if (!stored) {
      throw new BadRequestException("Invalid or expired OAuth state");
    }
    this.pkceVerifiers.delete(state);

    // 15-minute expiry
    if (Date.now() - stored.createdAt > 15 * 60 * 1000) {
      throw new BadRequestException("OAuth state expired");
    }

    const tokenData = await this.exchangeCodeForToken(code, stored);
    const profile = await this.fetchUserProfile(tokenData.access_token);
    return this.findOrCreateUser(profile);
  }

  /**
   * Exchange authorization code for Fanvue access token.
   */
  private async exchangeCodeForToken(
    code: string,
    stored: { verifier: string; redirectUri: string },
  ) {
    const clientId = this.config.getOrThrow("FANVUE_CLIENT_ID");
    const clientSecret = this.config.getOrThrow("FANVUE_CLIENT_SECRET");

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: stored.redirectUri,
      code_verifier: stored.verifier,
    });

    const res = await fetch(FANVUE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Token exchange failed: ${res.status} ${text}`);
      throw new BadRequestException("Failed to exchange authorization code");
    }

    return (await res.json()) as { access_token: string };
  }

  /**
   * Fetch the authenticated user's profile from Fanvue API.
   */
  private async fetchUserProfile(accessToken: string) {
    const res = await fetch(`${FANVUE_API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Fanvue-API-Version": "2025-06-26",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Fanvue profile fetch failed: ${res.status} ${text}`);
      throw new BadRequestException("Failed to fetch Fanvue user profile");
    }

    const data = (await res.json()) as {
      uuid: string;
      email: string;
      handle: string;
      displayName?: string;
      avatarUrl?: string;
      isCreator: boolean;
    };

    return data;
  }

  /**
   * Find or create a local user by their Fanvue ID.
   */
  private async findOrCreateUser(profile: {
    uuid: string;
    email: string;
    handle: string;
    displayName?: string;
    avatarUrl?: string;
    isCreator: boolean;
  }) {
    // v1.1: KYC and the creator-only gate are gone — anyone signed into
    // Fanvue can use the app, with role decided in the role-select screen.
    // Try to find by fanvueId
    const [existing] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.fanvueId, profile.uuid))
      .limit(1);

    if (existing) {
      // Update profile info on each login
      const [updated] = await this.db
        .update(schema.users)
        .set({
          fanvueHandle: profile.handle,
          fanvueAvatarUrl: profile.avatarUrl ?? null,
          displayName: profile.displayName ?? existing.displayName,
          avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
        })
        .where(eq(schema.users.id, existing.id))
        .returning();

      return updated!;
    }

    // Create new user — role "both" is a sentinel meaning "not yet chosen".
    // User picks clipper/creator on /select-role and the choice is locked.
    const [newUser] = await this.db
      .insert(schema.users)
      .values({
        email: profile.email,
        handle: profile.handle,
        displayName: profile.displayName ?? profile.handle,
        avatarUrl: profile.avatarUrl ?? null,
        fanvueId: profile.uuid,
        fanvueHandle: profile.handle,
        fanvueAvatarUrl: profile.avatarUrl ?? null,
        role: "both",
      })
      .returning();

    return newUser!;
  }

  private cleanExpiredPkce() {
    const now = Date.now();
    for (const [state, entry] of this.pkceVerifiers) {
      if (now - entry.createdAt > 15 * 60 * 1000) {
        this.pkceVerifiers.delete(state);
      }
    }
  }
}
