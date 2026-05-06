import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const FANVUE_API_URL = "https://api.fanvue.com";
const FANVUE_API_VERSION = "2025-06-26";

// Documented enum from POST /tracking-links request body.
export type FanvueExternalSocialPlatform =
  | "facebook"
  | "instagram"
  | "other"
  | "reddit"
  | "snapchat"
  | "tiktok"
  | "twitter"
  | "youtube";

export interface FanvueTrackingLink {
  uuid: string;
  name: string;
  linkUrl: string; // short slug like 'fv-123'
  externalSocialPlatform: FanvueExternalSocialPlatform;
  createdAt: string;
  clicks: number;
  engagement: {
    acquiredSubscribers: number;
    acquiredFollowers: number;
    totalSubscribers: number;
    totalFollowers: number;
  };
  earnings: {
    totalGross: number;
    totalNet: number;
  } | null;
}

export class FanvueAuthError extends Error {
  constructor(message = "Fanvue OAuth token rejected") {
    super(message);
    this.name = "FanvueAuthError";
  }
}

/** v1.2 M3.4 — Fanvue returned 404 for a tracking link we believed was
 * minted. Surfaces creator-side deletion of a link from the Fanvue
 * dashboard so the app can auto-revoke the linked submission. */
export class FanvueNotFoundError extends Error {
  constructor(public path: string) {
    super(`Fanvue resource not found: ${path}`);
    this.name = "FanvueNotFoundError";
  }
}

export class FanvueScopeError extends Error {
  constructor(public requiredScope: string) {
    super(`Missing Fanvue scope: ${requiredScope}`);
    this.name = "FanvueScopeError";
  }
}

@Injectable()
export class FanvueTrackingLinksService {
  private readonly logger = new Logger(FanvueTrackingLinksService.name);

  constructor(private config: ConfigService) {}

  /**
   * POST /tracking-links — mint a new tracking link.
   *
   * @throws FanvueAuthError on 401 (token invalid/revoked) — caller should
   *         prompt the creator to re-auth with `read:tracking_links
   *         write:tracking_links`.
   * @throws FanvueScopeError on 403 with scope missing (token lacks the
   *         `write:tracking_links` scope).
   */
  async createLink(args: {
    accessToken: string;
    name: string;
    platform: FanvueExternalSocialPlatform;
  }): Promise<FanvueTrackingLink> {
    return this.fetch<FanvueTrackingLink>("POST", "/tracking-links", args.accessToken, {
      name: args.name,
      externalSocialPlatform: args.platform,
    });
  }

  /**
   * GET /tracking-links — list the creator's links (cursor-paginated).
   * Fetches all pages and returns a flat array. Used by the attribution cron
   * to walk one creator's links per run.
   */
  async listAllLinks(args: {
    accessToken: string;
  }): Promise<FanvueTrackingLink[]> {
    const all: FanvueTrackingLink[] = [];
    let cursor: string | null = null;
    do {
      const params = new URLSearchParams({ limit: "100" });
      if (cursor) params.set("cursor", cursor);
      const res: { data: FanvueTrackingLink[]; nextCursor: string | null } =
        await this.fetch<{
          data: FanvueTrackingLink[];
          nextCursor: string | null;
        }>("GET", `/tracking-links?${params.toString()}`, args.accessToken);
      all.push(...res.data);
      cursor = res.nextCursor;
    } while (cursor);
    return all;
  }

  /** DELETE /tracking-links/{uuid}. Used when a creator bans a clipper. */
  async deleteLink(args: { accessToken: string; uuid: string }): Promise<void> {
    await this.fetch<void>(
      "DELETE",
      `/tracking-links/${args.uuid}`,
      args.accessToken,
    );
  }

  /**
   * Resolve a `linkUrl` slug (e.g. 'fv-123') to the full redirect URL the
   * clipper pastes into their post. M4.0 has an open question with Fanvue
   * about the exact format; this helper centralises the assumption so
   * a single change adapts the whole app once we hear back.
   */
  resolveTrackingUrl(slug: string): string {
    const base =
      this.config.get<string>("FANVUE_TRACKING_LINK_BASE") ??
      "https://fanvue.com/?ref=";
    return `${base}${encodeURIComponent(slug)}`;
  }

  /** Map our internal Platform enum to Fanvue's externalSocialPlatform enum. */
  static mapPlatform(
    platform: "tiktok" | "instagram" | "youtube",
  ): FanvueExternalSocialPlatform {
    return platform; // happens to align 1:1 today; keep the indirection
  }

  private async fetch<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    accessToken: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${FANVUE_API_URL}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Fanvue-API-Version": FANVUE_API_VERSION,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      throw new FanvueAuthError();
    }
    if (res.status === 404) {
      throw new FanvueNotFoundError(path);
    }
    if (res.status === 403) {
      // Fanvue uses 403 for both forbidden-resource and missing-scope. Treat
      // any 403 on a tracking-link path as a scope problem — for v1 there's
      // no other reason a creator-token-holder would get 403.
      throw new FanvueScopeError(
        method === "GET" ? "read:tracking_links" : "write:tracking_links",
      );
    }
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(
        `Fanvue ${method} ${path} failed: ${res.status} ${text}`,
      );
      throw new Error(`Fanvue API error: ${res.status}`);
    }

    if (method === "DELETE" || res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
