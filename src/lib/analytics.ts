import posthog from "posthog-js"

let initialized = false

/**
 * Initialise PostHog. Idempotent. Called once from main.tsx.
 *
 * Configuration choices (M5 D1):
 * - autocapture: false — we use explicit event capture only
 * - capture_pageview: true — pageviews are the cheap "is the app being used" signal
 * - persistence: localStorage+cookie — survives full reloads
 *
 * No-op when VITE_POSTHOG_KEY is unset (e.g. local dev without analytics).
 */
export function initAnalytics() {
  if (initialized) return
  const key = import.meta.env.VITE_POSTHOG_KEY
  const host = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com"
  if (!key) return
  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: false,
    persistence: "localStorage+cookie",
  })
  initialized = true
}

export function identify(userId: string) {
  if (!initialized) return
  posthog.identify(userId)
}

export function resetIdentity() {
  if (!initialized) return
  posthog.reset()
}

// ── Event capture wrappers — frozen schemas (M5 D4) ──────────────────────────

interface CampaignCreatedProps {
  campaign_id: string
  payout_type: "per_1k_views" | "per_subscriber"
  accepted_payout_methods: string[]
  is_private: boolean
  total_budget: number
}

interface SubmissionCreatedProps {
  submission_id: string
  campaign_id: string
  platform: string
}

interface SubmissionApprovedProps {
  submission_id: string
  campaign_id: string
  payout_type: "per_1k_views" | "per_subscriber"
}

interface SubmissionMarkedPaidProps {
  submission_id: string
  campaign_id: string
  method: string
  amount: number
  has_tx_hash: boolean
}

interface PaymentConfirmedProps {
  submission_id: string
  campaign_id: string
}

interface PaymentDisputedProps {
  submission_id: string
  campaign_id: string
  method: string
}

interface TrackingLinkMintedProps {
  submission_id: string
  campaign_id: string
  slug: string
}

interface PayoutSettingsSavedProps {
  methods_count: number
  has_contact: boolean
}

function safeCapture(event: string, props: object) {
  if (!initialized) return
  try {
    posthog.capture(event, props as Record<string, unknown>)
  } catch {
    // PostHog client errors must not break the app
  }
}

export const analytics = {
  campaignCreated: (p: CampaignCreatedProps) =>
    safeCapture("campaign_created", p),
  submissionCreated: (p: SubmissionCreatedProps) =>
    safeCapture("submission_created", p),
  submissionApproved: (p: SubmissionApprovedProps) =>
    safeCapture("submission_approved", p),
  submissionMarkedPaid: (p: SubmissionMarkedPaidProps) =>
    safeCapture("submission_marked_paid", p),
  paymentConfirmed: (p: PaymentConfirmedProps) =>
    safeCapture("payment_confirmed", p),
  paymentDisputed: (p: PaymentDisputedProps) =>
    safeCapture("payment_disputed", p),
  trackingLinkMinted: (p: TrackingLinkMintedProps) =>
    safeCapture("tracking_link_minted", p),
  payoutSettingsSaved: (p: PayoutSettingsSavedProps) =>
    safeCapture("payout_settings_saved", p),
}
