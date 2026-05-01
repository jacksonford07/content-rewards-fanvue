import type { PayoutMethod } from "@/lib/payout-validators"

export type Platform = "tiktok" | "instagram" | "youtube"

export type CampaignStatus =
  | "draft"
  | "pending_budget"
  | "active"
  | "paused"
  | "completed"

export type SubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "auto_approved"
  | "paid"
  | "ready_to_pay"
  | "paid_off_platform"
  | "disputed"

export type RequirementsType = "native" | "google_doc"

export interface TrustWindow {
  creatorPaidCount: number
  creatorVerifiedCount: number
  creatorPaidRate: number | null
  clipperApprovedCount: number
  clipperDecidedCount: number
  clipperApprovalRate: number | null
  clipperPaidCount: number
  clipperDisputedCount: number
  clipperDisputeFreeRate: number | null
  clipperScore: number | null
}

export interface TrustScore {
  ninetyDay: TrustWindow
  allTime: TrustWindow
  lastPayoutAt: string | null
}

export interface Creator {
  id: string
  name: string
  handle: string
  avatarUrl: string
  verified?: boolean
  followers?: number
  trust?: TrustScore | null
}

export interface Campaign {
  id: string
  creator: Creator
  title: string
  description: string
  requirementsType: RequirementsType
  requirementsText?: string
  requirementsUrl?: string
  sourceContentUrl: string
  sourceThumbnailUrl: string
  allowedPlatforms: Platform[]
  rewardRatePer1k: number
  totalBudget: number
  budgetSpent: number
  budgetReserved?: number
  budgetAvailable?: number
  minPayoutThreshold: number
  maxPayoutPerClip?: number
  status: CampaignStatus
  isPrivate?: boolean
  privateSlug?: string | null
  acceptedPayoutMethods: PayoutMethod[]
  payoutType: "per_1k_views" | "per_subscriber"
  ratePerSub: number
  createdAt: string
  goesLiveAt: string
  endsAt?: string
  activeClippers: number
  totalViews: number
  totalSubmissions: number
  openSubmissions?: number
}

export interface Submission {
  id: string
  campaignId: string
  campaignTitle: string
  campaignCreator: string
  fanId: string
  fanName: string
  fanHandle: string
  fanAvatarUrl: string
  fanFollowers: number
  postUrl: string
  thumbnailUrl: string
  platform: Platform
  submittedAt: string
  status: SubmissionStatus
  viewsAtDay30?: number
  payoutAmount?: number
  rewardRatePer1k: number
  maxPayoutPerClip?: number
  minPayoutThreshold: number
  campaignBudgetRemaining?: number
  creatorDecisionAt?: string
  rejectionReason?: string
  isBanned?: boolean
  verificationStartedAt?: string
  autoApproveAt?: string
  lockDate?: string
  lastViewCount?: number
  lastScrapedAt?: string
  postedAt?: string
  postDeletedAt?: string
  platformUsername?: string
  pendingEarnings?: number
  aiReviewResult?: "clean" | "flagged"
  aiNotes?: string
  payoutEvent?: PayoutEventSummary | null
  fanTrust?: TrustScore | null
  trackingLinkUuid?: string | null
  trackingLinkSlug?: string | null
  trackingLinkUrl?: string | null
}

export interface PayoutEventSummary {
  id: string
  method: PayoutMethod
  amountCents: number
  createdAt: string
  confirmedAt: string | null
  disputedAt: string | null
  disputeResolution: "confirmed" | "rejected" | null
  txHash: string | null
}

export interface SubmissionSnapshot {
  capturedAt: string
  viewCount: number
  available: boolean
}

