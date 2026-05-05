// v1.2 M4 — PostHog frontend integration.
//
// Initialised at app startup (see main.tsx). Auto-capture is OFF — every
// event is fired explicitly by `track(...)`. Identified on user login.
//
// Gated on VITE_POSTHOG_KEY: when unset (e.g. local dev without analytics),
// `track` and `identify` are no-ops so the app still runs.

import posthog from "posthog-js"

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com"

let initialised = false

export function initAnalytics() {
  if (initialised || !KEY) return
  posthog.init(KEY, {
    api_host: HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    persistence: "localStorage+cookie",
    loaded: () => {
      // No-op; keep the loaded callback in case we want gating later.
    },
  })
  initialised = true
}

export function identify(userId: string, properties?: Record<string, unknown>) {
  if (!KEY) return
  posthog.identify(userId, properties)
}

export function reset() {
  if (!KEY) return
  posthog.reset()
}

/** Frontend-originated events go through here. Backend emits its own
 *  events from posthog-node so we don't double-send. The only frontend
 *  event in PRD §S5 is `tracking_link_copied`. */
export type ClientEvent = "tracking_link_copied"

export function track(
  event: ClientEvent,
  properties?: Record<string, unknown>,
) {
  if (!KEY) return
  posthog.capture(event, properties)
}
