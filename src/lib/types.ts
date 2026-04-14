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
  | "flagged"

export type AiReviewResult = "clean" | "flagged"

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
  minPayoutThreshold: number
  maxPayoutPerClip?: number
  status: CampaignStatus
  createdAt: string
  goesLiveAt: string
  endsAt?: string
  activeClippers: number
  totalViews: number
  totalSubmissions: number
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
  aiReviewResult: AiReviewResult
  aiNotes?: string
  status: SubmissionStatus
  viewsCurrent: number
  viewsAtDay30?: number
  payoutAmount?: number
  creatorDecisionAt?: string
  rejectionReason?: string
  verificationStartedAt?: string
  autoApproveAt?: string
  lockDate?: string
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
