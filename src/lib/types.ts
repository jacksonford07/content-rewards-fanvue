import type {
  ClipperPaymentMethod,
  ContactMethod,
  PaymentMethodType,
} from "./payment-methods"

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

export type RequirementsType = "native" | "google_doc"

export interface Creator {
  id: string
  name: string
  handle: string
  avatarUrl: string
  verified?: boolean
  followers?: number
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
  acceptedPaymentMethods?: PaymentMethodType[]
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
  campaignAcceptedPaymentMethods?: PaymentMethodType[]
  fanContactMethod?: ContactMethod | null
  fanContactHandle?: string | null
  fanPaymentMethods?: ClipperPaymentMethod[]
  paymentSentAt?: string
  paymentMethodUsed?: string
  paymentReference?: string
}

export interface SubmissionSnapshot {
  capturedAt: string
  viewCount: number
  available: boolean
}

export type KycStatus = "not_started" | "in_progress" | "verified" | "rejected"

export interface BudgetTransaction {
  id: string
  type: "escrow_lock" | "payout_release" | "topup" | "refund"
  description: string
  amount: number
  at: string
  status: "completed" | "pending"
}
