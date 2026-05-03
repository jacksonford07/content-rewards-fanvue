import { Controller, Get, Query, Req, Res, BadRequestException, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service.js";
import { FanvueOAuthService, NotACreatorError } from "./fanvue-oauth.service.js";
import { Public } from "./public.decorator.js";

@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private fanvueOAuth: FanvueOAuthService,
    private config: ConfigService,
  ) {}

  /**
   * Resolve the frontend origin that should receive the post-OAuth
   * redirect. We accept either an explicit `?return=` query param or the
   * Referer header, and validate against an allowlist so the callback
   * can't be redirected to an arbitrary host (open-redirect prevention).
   *
   * Allowlist source: FRONTEND_URL_ALLOWLIST env var (comma-separated).
   * If that's unset, fall back to a single-origin allowlist of FRONTEND_URL.
   *
   * Returns a fully-qualified origin (scheme + host[:port], no trailing
   * slash). Falls back to the FRONTEND_URL env var when nothing matches.
   */
  private resolveFrontendOrigin(req: Request, returnParam?: string): string {
    const fallback = this.config.get<string>(
      "FRONTEND_URL",
      "http://localhost:5173",
    );
    const allowlistRaw =
      this.config.get<string>("FRONTEND_URL_ALLOWLIST") ?? fallback;
    const allowlist = allowlistRaw
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);

    const candidates = [returnParam, req.get("origin"), req.get("referer")]
      .filter((v): v is string => Boolean(v))
      .map((v) => {
        try {
          const url = new URL(v);
          return `${url.protocol}//${url.host}`;
        } catch {
          return null;
        }
      })
      .filter((v): v is string => Boolean(v));

    for (const candidate of candidates) {
      if (allowlist.includes(candidate)) {
        return candidate;
      }
    }

    return fallback.replace(/\/$/, "");
  }

  @Public()
  @Get("fanvue")
  fanvueRedirect(
    @Req() req: Request,
    @Res() res: Response,
    @Query("return") returnParam?: string,
  ) {
    // Fanvue OAuth app is registered with /auth/fanvue/callback (no /api prefix)
    const redirectUri = `${req.protocol}://${req.get("host")}/auth/fanvue/callback`;
    // Resolve where to bounce the user *after* OAuth completes. Captured
    // from ?return=, Origin, or Referer (allowlist-checked) so a single
    // backend can serve both prod and preview frontends.
    const frontendOrigin = this.resolveFrontendOrigin(req, returnParam);
    this.logger.log(
      `[fanvue] Start OAuth → redirect_uri="${redirectUri}" frontend="${frontendOrigin}"`,
    );
    const url = this.fanvueOAuth.generateAuthUrl(redirectUri, [], frontendOrigin);
    res.redirect(url);
  }

  @Public()
  @Get("fanvue/callback")
  async fanvueCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Query("error_description") errorDescription: string,
    @Res() res: Response,
  ) {
    // Default fallback for the early-error case where we don't have a
    // PKCE entry yet to recover the frontend origin from.
    const fallbackFrontend = this.config.get<string>(
      "FRONTEND_URL",
      "http://localhost:5173",
    );

    this.logger.log(
      `[fanvue/callback] hit: code=${code ? "present" : "MISSING"} state=${state ? "present" : "MISSING"} error=${error ?? "none"} error_description=${errorDescription ?? "none"}`,
    );

    if (error || !code) {
      this.logger.error(
        `[fanvue/callback] Fanvue returned error="${error}" desc="${errorDescription}" — redirecting to /login?error=fanvue_rejected`,
      );
      const params = new URLSearchParams({
        error: "fanvue_rejected",
        reason: error ?? "no_code",
        ...(errorDescription ? { desc: errorDescription } : {}),
      });
      res.redirect(`${fallbackFrontend}/login?${params.toString()}`);
      return;
    }

    try {
      const { user, frontendOrigin } = await this.fanvueOAuth.handleCallback(
        code,
        state,
      );
      const jwt = this.authService.signToken(user.id);
      const target = frontendOrigin ?? fallbackFrontend;
      this.logger.log(
        `[fanvue/callback] Login OK for user=${user.id} → ${target}`,
      );

      const params = new URLSearchParams({ accessToken: jwt });
      res.redirect(`${target}/auth/fanvue/complete?${params.toString()}`);
    } catch (err) {
      if (err instanceof NotACreatorError) {
        this.logger.warn(`[fanvue/callback] Not a creator — redirecting to /login?error=not_creator`);
        res.redirect(`${fallbackFrontend}/login?error=not_creator`);
        return;
      }
      this.logger.error(
        `[fanvue/callback] Unexpected error during handleCallback: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      res.redirect(`${fallbackFrontend}/login?error=auth_failed`);
    }
  }

  /**
   * Dev-only: log in as a test user (clipper or creator).
   */
  @Public()
  @Get("dev-login")
  async devLogin(
    @Req() req: Request,
    @Query("role") role: string,
    @Res() res: Response,
  ) {
    const nodeEnv = this.config.get<string>("NODE_ENV", "development");
    if (nodeEnv !== "development") {
      throw new BadRequestException("Dev login is only available in development");
    }

    if (!role || !["clipper", "creator"].includes(role)) {
      throw new BadRequestException("Role must be 'clipper' or 'creator'");
    }

    const user = await this.authService.findOrCreateDevUser(role as "clipper" | "creator");
    const jwt = this.authService.signToken(user.id);

    const frontendUrl = this.resolveFrontendOrigin(req);
    const params = new URLSearchParams({ accessToken: jwt });
    res.redirect(`${frontendUrl}/auth/fanvue/complete?${params.toString()}`);
  }

  @Get("me")
  me(@Req() req: { user: { id: string } }) {
    return this.authService.me(req.user.id);
  }
}
