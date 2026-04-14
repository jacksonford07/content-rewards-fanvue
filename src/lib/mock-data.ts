import type { BudgetTransaction, Campaign, Creator, Submission } from "./types"

export const currentUser: Creator = {
  id: "u_current",
  name: "Alex Morgan",
  handle: "alexmorgan",
  avatarUrl:
    "https://api.dicebear.com/9.x/glass/svg?seed=alex&backgroundColor=d4a574",
  verified: true,
  followers: 48200,
}

const creators: Creator[] = [
  {
    id: "c_1",
    name: "Sophia Reyes",
    handle: "sophiareyes",
    avatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=sophia&backgroundColor=e8b4a0",
    verified: true,
    followers: 284000,
  },
  {
    id: "c_2",
    name: "Marcus Chen",
    handle: "mchenstudio",
    avatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=marcus&backgroundColor=b8a5d4",
    verified: true,
    followers: 512000,
  },
  {
    id: "c_3",
    name: "Luna Parker",
    handle: "lunaparker",
    avatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=luna&backgroundColor=a5c4d4",
    verified: false,
    followers: 98500,
  },
  {
    id: "c_4",
    name: "Jordan Blake",
    handle: "jordanblake",
    avatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=jordan&backgroundColor=d4c8a5",
    verified: true,
    followers: 1240000,
  },
  {
    id: "c_5",
    name: "Ivy Nakamura",
    handle: "ivynakamura",
    avatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=ivy&backgroundColor=d4a5c4",
    verified: true,
    followers: 367000,
  },
  {
    id: "c_6",
    name: "River Thompson",
    handle: "riverthompson",
    avatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=river&backgroundColor=a5d4c1",
    verified: false,
    followers: 72400,
  },
]

export const campaigns: Campaign[] = [
  {
    id: "cam_001",
    creator: creators[0],
    title: "Summer Beach Vibes — Lifestyle Clips",
    description:
      "High-energy beach lifestyle content. Looking for clips that feel cinematic, sun-drenched, and aspirational.",
    requirementsType: "native",
    requirementsText:
      "Looking for 15-45 second clips that capture the summer beach vibe. Must include at least one slow-motion sequence. Vertical format only. Keep text overlays minimal. No music with copyright strikes.",
    sourceContentUrl: "https://drive.google.com/file/d/abc123/view",
    sourceThumbnailUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    allowedPlatforms: ["tiktok", "instagram", "youtube"],
    rewardRatePer1k: 3.5,
    totalBudget: 5000,
    budgetSpent: 1820,
    minPayoutThreshold: 2000,
    maxPayoutPerClip: 250,
    status: "active",
    createdAt: "2026-03-20T10:00:00Z",
    goesLiveAt: "2026-03-21T00:00:00Z",
    endsAt: "2026-05-20T00:00:00Z",
    activeClippers: 24,
    totalViews: 521000,
    totalSubmissions: 38,
  },
  {
    id: "cam_002",
    creator: creators[1],
    title: "Studio Session Behind-the-Scenes",
    description:
      "Raw studio footage from recording sessions. Looking for clips that highlight the creative process.",
    requirementsType: "google_doc",
    requirementsUrl:
      "https://docs.google.com/document/d/xyz456/edit",
    sourceContentUrl: "https://drive.google.com/file/d/def456/view",
    sourceThumbnailUrl:
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80",
    allowedPlatforms: ["tiktok", "instagram"],
    rewardRatePer1k: 5.0,
    totalBudget: 8000,
    budgetSpent: 4350,
    minPayoutThreshold: 3000,
    maxPayoutPerClip: 400,
    status: "active",
    createdAt: "2026-03-15T10:00:00Z",
    goesLiveAt: "2026-03-16T00:00:00Z",
    activeClippers: 41,
    totalViews: 892000,
    totalSubmissions: 67,
  },
  {
    id: "cam_003",
    creator: creators[2],
    title: "Fitness Transformation Series",
    description:
      "Motivational fitness clips showing real transformations. Help me reach more people serious about change.",
    requirementsType: "native",
    requirementsText:
      "Focus on transformation reveals and key workout moments. Add upbeat captions. Keep clips under 30 seconds for best engagement.",
    sourceContentUrl: "https://drive.google.com/file/d/ghi789/view",
    sourceThumbnailUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
    allowedPlatforms: ["tiktok", "instagram", "youtube"],
    rewardRatePer1k: 2.75,
    totalBudget: 3000,
    budgetSpent: 2850,
    minPayoutThreshold: 2000,
    status: "active",
    createdAt: "2026-03-10T10:00:00Z",
    goesLiveAt: "2026-03-11T00:00:00Z",
    activeClippers: 18,
    totalViews: 1020000,
    totalSubmissions: 52,
  },
  {
    id: "cam_004",
    creator: creators[3],
    title: "Cooking Masterclass Clip Campaign",
    description:
      "Premium cooking tutorial footage. Looking for bite-sized recipe moments that make viewers hungry.",
    requirementsType: "native",
    requirementsText:
      "Highlight the 'money shot' — the final dish reveal or dramatic cooking moment. Use trending food audio.",
    sourceContentUrl: "https://drive.google.com/file/d/jkl012/view",
    sourceThumbnailUrl:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    allowedPlatforms: ["tiktok", "instagram", "youtube"],
    rewardRatePer1k: 4.25,
    totalBudget: 12000,
    budgetSpent: 3200,
    minPayoutThreshold: 2500,
    maxPayoutPerClip: 500,
    status: "active",
    createdAt: "2026-04-01T10:00:00Z",
    goesLiveAt: "2026-04-02T00:00:00Z",
    activeClippers: 52,
    totalViews: 650000,
    totalSubmissions: 89,
  },
  {
    id: "cam_005",
    creator: creators[4],
    title: "Travel Diary: Tokyo Nights",
    description:
      "Neon-soaked Tokyo street footage. Cinematic, moody, and immersive.",
    requirementsType: "google_doc",
    requirementsUrl:
      "https://docs.google.com/document/d/travel123/edit",
    sourceContentUrl: "https://drive.google.com/file/d/mno345/view",
    sourceThumbnailUrl:
      "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800&q=80",
    allowedPlatforms: ["tiktok", "youtube"],
    rewardRatePer1k: 6.0,
    totalBudget: 6500,
    budgetSpent: 980,
    minPayoutThreshold: 3000,
    maxPayoutPerClip: 600,
    status: "active",
    createdAt: "2026-04-05T10:00:00Z",
    goesLiveAt: "2026-04-06T00:00:00Z",
    activeClippers: 12,
    totalViews: 210000,
    totalSubmissions: 15,
  },
  {
    id: "cam_006",
    creator: creators[5],
    title: "Street Fashion Photography",
    description:
      "High-fashion street style captures. Looking for editorial-quality clips.",
    requirementsType: "native",
    requirementsText:
      "Focus on strong silhouettes and urban environments. Minimal text overlays — let the visuals speak.",
    sourceContentUrl: "https://drive.google.com/file/d/pqr678/view",
    sourceThumbnailUrl:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
    allowedPlatforms: ["instagram", "tiktok"],
    rewardRatePer1k: 3.0,
    totalBudget: 2500,
    budgetSpent: 200,
    minPayoutThreshold: 2000,
    status: "active",
    createdAt: "2026-04-07T10:00:00Z",
    goesLiveAt: "2026-04-08T00:00:00Z",
    activeClippers: 6,
    totalViews: 78000,
    totalSubmissions: 8,
  },
]

export const mySubmissions: Submission[] = [
  {
    id: "sub_001",
    campaignId: "cam_002",
    campaignTitle: "Studio Session Behind-the-Scenes",
    campaignCreator: "Marcus Chen",
    fanId: currentUser.id,
    fanName: currentUser.name,
    fanHandle: currentUser.handle,
    fanAvatarUrl: currentUser.avatarUrl,
    fanFollowers: currentUser.followers!,
    postUrl: "https://www.tiktok.com/@alexmorgan/video/7382940192",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&q=80",
    platform: "tiktok",
    submittedAt: "2026-04-08T14:22:00Z",
    aiReviewResult: "clean",
    status: "pending",
    viewsCurrent: 8400,
    autoApproveAt: "2026-04-10T14:22:00Z",
  },
  {
    id: "sub_002",
    campaignId: "cam_001",
    campaignTitle: "Summer Beach Vibes — Lifestyle Clips",
    campaignCreator: "Sophia Reyes",
    fanId: currentUser.id,
    fanName: currentUser.name,
    fanHandle: currentUser.handle,
    fanAvatarUrl: currentUser.avatarUrl,
    fanFollowers: currentUser.followers!,
    postUrl: "https://www.instagram.com/reel/Cxyz123/",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80",
    platform: "instagram",
    submittedAt: "2026-04-05T09:15:00Z",
    aiReviewResult: "clean",
    status: "approved",
    viewsCurrent: 42100,
    creatorDecisionAt: "2026-04-05T18:30:00Z",
    verificationStartedAt: "2026-04-05T18:30:00Z",
    lockDate: "2026-05-05T18:30:00Z",
  },
  {
    id: "sub_003",
    campaignId: "cam_003",
    campaignTitle: "Fitness Transformation Series",
    campaignCreator: "Luna Parker",
    fanId: currentUser.id,
    fanName: currentUser.name,
    fanHandle: currentUser.handle,
    fanAvatarUrl: currentUser.avatarUrl,
    fanFollowers: currentUser.followers!,
    postUrl: "https://www.youtube.com/shorts/abc123",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80",
    platform: "youtube",
    submittedAt: "2026-03-07T11:45:00Z",
    aiReviewResult: "clean",
    status: "paid",
    viewsCurrent: 156000,
    viewsAtDay30: 152400,
    payoutAmount: 419.1,
    creatorDecisionAt: "2026-03-07T20:10:00Z",
    verificationStartedAt: "2026-03-07T20:10:00Z",
    lockDate: "2026-04-06T20:10:00Z",
  },
  {
    id: "sub_004",
    campaignId: "cam_004",
    campaignTitle: "Cooking Masterclass Clip Campaign",
    campaignCreator: "Jordan Blake",
    fanId: currentUser.id,
    fanName: currentUser.name,
    fanHandle: currentUser.handle,
    fanAvatarUrl: currentUser.avatarUrl,
    fanFollowers: currentUser.followers!,
    postUrl: "https://www.tiktok.com/@alexmorgan/video/7382940193",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80",
    platform: "tiktok",
    submittedAt: "2026-04-03T16:00:00Z",
    aiReviewResult: "flagged",
    aiNotes: "Clip exceeds max length requirement — 52s vs 45s limit.",
    status: "rejected",
    viewsCurrent: 2100,
    creatorDecisionAt: "2026-04-04T08:20:00Z",
    rejectionReason:
      "Clip exceeds maximum length. Please re-edit to under 45 seconds and resubmit.",
  },
]

export const inboxSubmissions: Submission[] = [
  {
    id: "isub_001",
    campaignId: "cam_own_1",
    campaignTitle: "My Fitness Campaign",
    campaignCreator: currentUser.name,
    fanId: "f_101",
    fanName: "Kai Thompson",
    fanHandle: "kaiclips",
    fanAvatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=kai&backgroundColor=c4b8a5",
    fanFollowers: 34200,
    postUrl: "https://www.tiktok.com/@kaiclips/video/739172612",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80",
    platform: "tiktok",
    submittedAt: "2026-04-09T10:22:00Z",
    aiReviewResult: "clean",
    status: "pending",
    viewsCurrent: 12400,
    autoApproveAt: "2026-04-11T10:22:00Z",
  },
  {
    id: "isub_002",
    campaignId: "cam_own_1",
    campaignTitle: "My Fitness Campaign",
    campaignCreator: currentUser.name,
    fanId: "f_102",
    fanName: "Nina Velasquez",
    fanHandle: "ninav",
    fanAvatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=nina&backgroundColor=d4a5a5",
    fanFollowers: 82100,
    postUrl: "https://www.instagram.com/reel/NinaVClip/",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80",
    platform: "instagram",
    submittedAt: "2026-04-09T08:15:00Z",
    aiReviewResult: "clean",
    status: "pending",
    viewsCurrent: 4800,
    autoApproveAt: "2026-04-11T08:15:00Z",
  },
  {
    id: "isub_003",
    campaignId: "cam_own_1",
    campaignTitle: "My Fitness Campaign",
    campaignCreator: currentUser.name,
    fanId: "f_103",
    fanName: "Theo Wright",
    fanHandle: "theoclips",
    fanAvatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=theo&backgroundColor=a5a5d4",
    fanFollowers: 12400,
    postUrl: "https://www.youtube.com/shorts/theo_001",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80",
    platform: "youtube",
    submittedAt: "2026-04-08T20:00:00Z",
    aiReviewResult: "flagged",
    aiNotes: "Unusual view velocity detected. Possible bot inflation.",
    status: "flagged",
    viewsCurrent: 22100,
    autoApproveAt: "2026-04-10T20:00:00Z",
  },
  {
    id: "isub_004",
    campaignId: "cam_own_1",
    campaignTitle: "My Fitness Campaign",
    campaignCreator: currentUser.name,
    fanId: "f_104",
    fanName: "Maya Okafor",
    fanHandle: "mayaokafor",
    fanAvatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=maya&backgroundColor=a5d4a5",
    fanFollowers: 156000,
    postUrl: "https://www.tiktok.com/@mayaokafor/video/maya_001",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80",
    platform: "tiktok",
    submittedAt: "2026-04-07T14:00:00Z",
    aiReviewResult: "clean",
    status: "approved",
    viewsCurrent: 48200,
    creatorDecisionAt: "2026-04-07T22:10:00Z",
    verificationStartedAt: "2026-04-07T22:10:00Z",
    lockDate: "2026-05-07T22:10:00Z",
  },
  {
    id: "isub_005",
    campaignId: "cam_own_1",
    campaignTitle: "My Fitness Campaign",
    campaignCreator: currentUser.name,
    fanId: "f_105",
    fanName: "Sam Pierce",
    fanHandle: "sampierce",
    fanAvatarUrl:
      "https://api.dicebear.com/9.x/glass/svg?seed=sam&backgroundColor=d4d4a5",
    fanFollowers: 6400,
    postUrl: "https://www.instagram.com/reel/SamPiercelip/",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80",
    platform: "instagram",
    submittedAt: "2026-04-06T09:00:00Z",
    aiReviewResult: "flagged",
    aiNotes: "Clip does not match campaign requirements.",
    status: "rejected",
    viewsCurrent: 1200,
    creatorDecisionAt: "2026-04-06T18:00:00Z",
    rejectionReason: "Off-brand content. Please review the brief.",
  },
]

export const myCampaigns: Campaign[] = [
  {
    id: "cam_own_1",
    creator: currentUser,
    title: "My Fitness Campaign",
    description: "My own fitness transformation content.",
    requirementsType: "native",
    requirementsText:
      "Vertical clips only, 15-45 seconds. Highlight transformation moments.",
    sourceContentUrl: "https://drive.google.com/file/d/own123/view",
    sourceThumbnailUrl:
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
    allowedPlatforms: ["tiktok", "instagram", "youtube"],
    rewardRatePer1k: 4.0,
    totalBudget: 5000,
    budgetSpent: 1830,
    minPayoutThreshold: 2000,
    maxPayoutPerClip: 300,
    status: "active",
    createdAt: "2026-03-25T10:00:00Z",
    goesLiveAt: "2026-03-26T00:00:00Z",
    activeClippers: 31,
    totalViews: 458000,
    totalSubmissions: 47,
  },
  {
    id: "cam_own_2",
    creator: currentUser,
    title: "Morning Routine Clips",
    description: "Aesthetic morning routine footage.",
    requirementsType: "native",
    requirementsText: "Warm, cozy aesthetic. Good lighting required.",
    sourceContentUrl: "https://drive.google.com/file/d/own456/view",
    sourceThumbnailUrl:
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80",
    allowedPlatforms: ["tiktok", "instagram"],
    rewardRatePer1k: 3.25,
    totalBudget: 2000,
    budgetSpent: 420,
    minPayoutThreshold: 2000,
    status: "active",
    createdAt: "2026-04-01T10:00:00Z",
    goesLiveAt: "2026-04-02T00:00:00Z",
    activeClippers: 8,
    totalViews: 129000,
    totalSubmissions: 12,
  },
  {
    id: "cam_own_3",
    creator: currentUser,
    title: "Podcast Highlights Reel",
    description: "Best moments from my podcast episodes.",
    requirementsType: "google_doc",
    requirementsUrl: "https://docs.google.com/document/d/podcast/edit",
    sourceContentUrl: "https://drive.google.com/file/d/own789/view",
    sourceThumbnailUrl:
      "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80",
    allowedPlatforms: ["tiktok", "instagram", "youtube"],
    rewardRatePer1k: 2.5,
    totalBudget: 1500,
    budgetSpent: 0,
    minPayoutThreshold: 1500,
    status: "draft",
    createdAt: "2026-04-08T10:00:00Z",
    goesLiveAt: "",
    activeClippers: 0,
    totalViews: 0,
    totalSubmissions: 0,
  },
]

export interface Notification {
  id: string
  type:
    | "new_submission"
    | "approved"
    | "rejected"
    | "payout_released"
    | "low_budget"
  title: string
  message: string
  createdAt: string
  read: boolean
  actionUrl?: string
}

export const notifications: Notification[] = [
  {
    id: "n_001",
    type: "new_submission",
    title: "New submission received",
    message: "Kai Thompson submitted a new clip to My Fitness Campaign",
    createdAt: "2026-04-09T10:22:00Z",
    read: false,
    actionUrl: "/creator/inbox",
  },
  {
    id: "n_002",
    type: "approved",
    title: "Submission approved",
    message:
      "Your clip for 'Summer Beach Vibes' was approved. 30-day view verification started.",
    createdAt: "2026-04-05T18:30:00Z",
    read: false,
    actionUrl: "/submissions",
  },
  {
    id: "n_003",
    type: "payout_released",
    title: "Payout released: $419.10",
    message:
      "Your earnings from the Fitness Transformation Series have been credited to your wallet.",
    createdAt: "2026-04-06T20:10:00Z",
    read: true,
    actionUrl: "/wallet",
  },
  {
    id: "n_004",
    type: "low_budget",
    title: "Low budget alert",
    message:
      "My Fitness Campaign has less than 20% budget remaining. Top up to keep it active.",
    createdAt: "2026-04-04T09:00:00Z",
    read: true,
    actionUrl: "/creator/campaigns",
  },
  {
    id: "n_005",
    type: "rejected",
    title: "Submission rejected",
    message:
      "Your clip for 'Cooking Masterclass' was rejected. See reason inside.",
    createdAt: "2026-04-04T08:20:00Z",
    read: true,
    actionUrl: "/submissions",
  },
]

export const campaignTransactions: Record<string, BudgetTransaction[]> = {
  cam_own_1: [
    {
      id: "btx_001",
      type: "escrow_lock",
      description: "Initial budget escrowed",
      amount: -5000,
      at: "Mar 25, 2026 · 10:00 AM",
      status: "completed",
    },
    {
      id: "btx_002",
      type: "payout_release",
      description: "Payout to Maya Okafor — 48.2K views",
      amount: -192.8,
      at: "Apr 7, 2026 · 10:10 PM",
      status: "completed",
    },
    {
      id: "btx_003",
      type: "payout_release",
      description: "Payout to Kai Thompson — 34.1K views",
      amount: -136.4,
      at: "Apr 5, 2026 · 3:20 PM",
      status: "completed",
    },
    {
      id: "btx_004",
      type: "topup",
      description: "Budget top-up via wallet",
      amount: 1000,
      at: "Apr 3, 2026 · 9:00 AM",
      status: "completed",
    },
    {
      id: "btx_005",
      type: "payout_release",
      description: "Payout to Sam Pierce — 18.5K views",
      amount: -74.0,
      at: "Apr 1, 2026 · 6:00 PM",
      status: "pending",
    },
  ],
  cam_own_2: [
    {
      id: "btx_010",
      type: "escrow_lock",
      description: "Initial budget escrowed",
      amount: -2000,
      at: "Apr 1, 2026 · 10:00 AM",
      status: "completed",
    },
    {
      id: "btx_011",
      type: "payout_release",
      description: "Payout to clipper — 12.8K views",
      amount: -41.6,
      at: "Apr 8, 2026 · 2:30 PM",
      status: "completed",
    },
  ],
}

export const platformLabels: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  youtube: "YouTube Shorts",
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)
}

export function timeAgo(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString()
}

export function timeUntil(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((date.getTime() - now.getTime()) / 1000)
  if (diff <= 0) return "expired"
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`
  if (diff < 86400)
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m left`
  return `${Math.floor(diff / 86400)}d left`
}
