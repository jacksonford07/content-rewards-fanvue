import { Global, Module } from "@nestjs/common";
import { PosthogService } from "./posthog.service.js";

// Global so any service can inject PosthogService without per-feature
// module wiring. PostHog is a single shared client; one provider, used
// everywhere.
@Global()
@Module({
  providers: [PosthogService],
  exports: [PosthogService],
})
export class PosthogModule {}
