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

  @Public()
  @Get("fanvue")
  fanvueRedirect(@Req() req: Request, @Res() res: Response) {
    // Fanvue OAuth app is registered with /auth/fanvue/callback (no /api prefix)
    const redirectUri = `${req.protocol}://${req.get("host")}/auth/fanvue/callback`;
    this.logger.log(`[fanvue] Start OAuth → redirect_uri="${redirectUri}"`);
    const url = this.fanvueOAuth.generateAuthUrl(redirectUri);
    this.logger.log(`[fanvue] Redirecting to Fanvue auth URL`);
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
    const frontendUrl = this.config.get<string>(
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
      res.redirect(`${frontendUrl}/login?${params.toString()}`);
      return;
    }

    try {
      const user = await this.fanvueOAuth.handleCallback(code, state);
      const jwt = this.authService.signToken(user.id);
      this.logger.log(`[fanvue/callback] Login OK for user=${user.id}`);

      const params = new URLSearchParams({ accessToken: jwt });
      res.redirect(`${frontendUrl}/auth/fanvue/complete?${params.toString()}`);
    } catch (err) {
      if (err instanceof NotACreatorError) {
        this.logger.warn(`[fanvue/callback] Not a creator — redirecting to /login?error=not_creator`);
        res.redirect(`${frontendUrl}/login?error=not_creator`);
        return;
      }
      this.logger.error(
        `[fanvue/callback] Unexpected error during handleCallback: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }

  /**
   * Dev-only: log in as a test user (clipper or creator).
   */
  @Public()
  @Get("dev-login")
  async devLogin(
    @Query("role") role: string,
    @Res() res: Response,
  ) {
    const nodeEnv = this.config.get<string>("NODE_ENV", "development");
    if (nodeEnv !== "development") {
      throw new BadRequestException("Dev login is only available in development");
    }

    if (!role || !["clipper", "creator", "admin"].includes(role)) {
      throw new BadRequestException("Role must be 'clipper', 'creator', or 'admin'");
    }

    const user = await this.authService.findOrCreateDevUser(role as "clipper" | "creator" | "admin");
    const jwt = this.authService.signToken(user.id);

    const frontendUrl = this.config.get<string>("FRONTEND_URL", "http://localhost:5173");
    const params = new URLSearchParams({ accessToken: jwt });
    res.redirect(`${frontendUrl}/auth/fanvue/complete?${params.toString()}`);
  }

  @Get("me")
  me(@Req() req: { user: { id: string } }) {
    return this.authService.me(req.user.id);
  }
}
