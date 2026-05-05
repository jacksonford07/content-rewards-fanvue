// v1.2 M4 — PostHog backend integration.
//
// One service that knows how to capture events. Inject it into any service
// that needs to emit one of the PRD §S5 events. Auto-capture is N/A on the
// Node SDK; we send each event explicitly.
//
// Gated on POSTHOG_KEY env var. When unset, every method no-ops so prod
// can ship the code before the env var lands.

import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PostHog } from "posthog-node";

export type ServerEvent =
  | "campaign_created"
  | "subscriber_campaign_created"
  | "submission_created"
  | "tracking_link_minted"
  | "tracking_link_revoked"
  | "submission_marked_paid"
  | "payment_confirmed"
  | "payment_disputed"
  | "dispute_resolved"
  | "payout_settings_saved"
  | "oauth_scope_upgrade_completed"
  | "subscriber_attribution_synced";

@Injectable()
export class PosthogService implements OnModuleDestroy {
  private readonly logger = new Logger(PosthogService.name);
  private client: PostHog | null = null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>("POSTHOG_KEY");
    if (!key) {
      this.logger.log("POSTHOG_KEY not set — analytics events will no-op");
      return;
    }
    const host =
      this.config.get<string>("POSTHOG_HOST") ?? "https://us.i.posthog.com";
    this.client = new PostHog(key, {
      host,
      // PRD §S5: manual events only.
      flushAt: 20,
      flushInterval: 5000,
    });
  }

  capture(
    event: ServerEvent,
    distinctId: string,
    properties?: Record<string, unknown>,
  ) {
    if (!this.client) return;
    try {
      this.client.capture({
        event,
        distinctId,
        properties,
      });
    } catch (err) {
      this.logger.warn(`PostHog capture failed (${event}): ${err}`);
    }
  }

  async onModuleDestroy() {
    if (!this.client) return;
    await this.client.shutdown();
  }
}
