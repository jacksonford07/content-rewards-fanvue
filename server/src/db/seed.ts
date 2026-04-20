import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as bcrypt from "bcrypt";
import * as schema from "./schema.js";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // ─── Users ─────────────────────────────────────────────────────────────────
  const [currentUser] = await db
    .insert(schema.users)
    .values({
      email: "alex@example.com",
      passwordHash,
      handle: "alexmorgan",
      displayName: "Alex Morgan",
      avatarUrl:
        "https://api.dicebear.com/9.x/glass/svg?seed=alex&backgroundColor=d4a574",
      isCreator: true,
      role: "both",
      kycStatus: "verified",
      walletBalanceCents: 125000, // $1250
    })
    .returning();

  const creatorData = [
    {
      email: "sophia@example.com",
      handle: "sophiareyes",
      displayName: "Sophia Reyes",
      avatarUrl:
        "https://api.dicebear.com/9.x/glass/svg?seed=sophia&backgroundColor=e8b4a0",
      kycStatus: "verified" as const,
    },
    {
      email: "marcus@example.com",
      handle: "mchenstudio",
      displayName: "Marcus Chen",
      avatarUrl:
        "https://api.dicebear.com/9.x/glass/svg?seed=marcus&backgroundColor=b8a5d4",
      kycStatus: "verified" as const,
    },
    {
      email: "luna@example.com",
      handle: "lunaparker",
      displayName: "Luna Parker",
      avatarUrl:
        "https://api.dicebear.com/9.x/glass/svg?seed=luna&backgroundColor=a5c4d4",
      kycStatus: "not_started" as const,
    },
    {
      email: "jordan@example.com",
      handle: "jordanblake",
      displayName: "Jordan Blake",
      avatarUrl:
        "https://api.dicebear.com/9.x/glass/svg?seed=jordan&backgroundColor=d4c8a5",
      kycStatus: "verified" as const,
    },
    {
      email: "ivy@example.com",
      handle: "ivynakamura",
      displayName: "Ivy Nakamura",
      avatarUrl:
        "https://api.dicebear.com/9.x/glass/svg?seed=ivy&backgroundColor=d4a5c4",
      kycStatus: "verified" as const,
    },
    {
      email: "river@example.com",
      handle: "riverthompson",
      displayName: "River Thompson",
      avatarUrl:
        "https://api.dicebear.com/9.x/glass/svg?seed=river&backgroundColor=a5d4c1",
      kycStatus: "not_started" as const,
    },
  ];

  const creators = await db
    .insert(schema.users)
    .values(
      creatorData.map((c) => ({
        ...c,
        passwordHash,
        isCreator: true,
        role: "creator" as const,
        walletBalanceCents: 500000,
      })),
    )
    .returning();

  // Fan users for inbox submissions
  const fanData = [
    { email: "kai@example.com", handle: "kaiclips", displayName: "Kai Thompson", avatarUrl: "https://api.dicebear.com/9.x/glass/svg?seed=kai&backgroundColor=c4b8a5" },
    { email: "nina@example.com", handle: "ninav", displayName: "Nina Velasquez", avatarUrl: "https://api.dicebear.com/9.x/glass/svg?seed=nina&backgroundColor=d4a5a5" },
    { email: "theo@example.com", handle: "theoclips", displayName: "Theo Wright", avatarUrl: "https://api.dicebear.com/9.x/glass/svg?seed=theo&backgroundColor=a5a5d4" },
    { email: "maya@example.com", handle: "mayaokafor", displayName: "Maya Okafor", avatarUrl: "https://api.dicebear.com/9.x/glass/svg?seed=maya&backgroundColor=a5d4a5" },
    { email: "sam@example.com", handle: "sampierce", displayName: "Sam Pierce", avatarUrl: "https://api.dicebear.com/9.x/glass/svg?seed=sam&backgroundColor=d4d4a5" },
  ];

  const fans = await db
    .insert(schema.users)
    .values(
      fanData.map((f) => ({
        ...f,
        passwordHash,
        role: "clipper" as const,
        walletBalanceCents: 5000,
      })),
    )
    .returning();

  console.log(`Created ${1 + creators.length + fans.length} users`);

  // ─── Campaigns (from other creators) ───────────────────────────────────────
  const campaignsFromOthers = await db
    .insert(schema.campaigns)
    .values([
      {
        creatorId: creators[0]!.id,
        title: "Summer Beach Vibes — Lifestyle Clips",
        description: "High-energy beach lifestyle content. Looking for clips that feel cinematic, sun-drenched, and aspirational.",
        requirementsType: "native",
        requirementsText: "Looking for 15-45 second clips that capture the summer beach vibe. Must include at least one slow-motion sequence. Vertical format only. Keep text overlays minimal. No music with copyright strikes.",
        sourceContentUrl: "https://drive.google.com/file/d/abc123/view",
        sourceThumbnailUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
        allowedPlatforms: ["tiktok", "instagram", "youtube"],
        rewardRatePer1kCents: 350,
        totalBudgetCents: 500000,
        budgetSpentCents: 182000,
        minPayoutThreshold: 2000,
        maxPayoutPerClipCents: 25000,
        status: "active",
        goesLiveAt: new Date("2026-03-21T00:00:00Z"),
        endsAt: new Date("2026-05-20T00:00:00Z"),
        createdAt: new Date("2026-03-20T10:00:00Z"),
      },
      {
        creatorId: creators[1]!.id,
        title: "Studio Session Behind-the-Scenes",
        description: "Raw studio footage from recording sessions. Looking for clips that highlight the creative process.",
        requirementsType: "google_doc",
        requirementsUrl: "https://docs.google.com/document/d/xyz456/edit",
        sourceContentUrl: "https://drive.google.com/file/d/def456/view",
        sourceThumbnailUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80",
        allowedPlatforms: ["tiktok", "instagram"],
        rewardRatePer1kCents: 500,
        totalBudgetCents: 800000,
        budgetSpentCents: 435000,
        minPayoutThreshold: 3000,
        maxPayoutPerClipCents: 40000,
        status: "active",
        goesLiveAt: new Date("2026-03-16T00:00:00Z"),
        createdAt: new Date("2026-03-15T10:00:00Z"),
      },
      {
        creatorId: creators[2]!.id,
        title: "Fitness Transformation Series",
        description: "Motivational fitness clips showing real transformations. Help me reach more people serious about change.",
        requirementsType: "native",
        requirementsText: "Focus on transformation reveals and key workout moments. Add upbeat captions. Keep clips under 30 seconds for best engagement.",
        sourceContentUrl: "https://drive.google.com/file/d/ghi789/view",
        sourceThumbnailUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
        allowedPlatforms: ["tiktok", "instagram", "youtube"],
        rewardRatePer1kCents: 275,
        totalBudgetCents: 300000,
        budgetSpentCents: 285000,
        minPayoutThreshold: 2000,
        status: "active",
        goesLiveAt: new Date("2026-03-11T00:00:00Z"),
        createdAt: new Date("2026-03-10T10:00:00Z"),
      },
      {
        creatorId: creators[3]!.id,
        title: "Cooking Masterclass Clip Campaign",
        description: "Premium cooking tutorial footage. Looking for bite-sized recipe moments that make viewers hungry.",
        requirementsType: "native",
        requirementsText: "Highlight the 'money shot' — the final dish reveal or dramatic cooking moment. Use trending food audio.",
        sourceContentUrl: "https://drive.google.com/file/d/jkl012/view",
        sourceThumbnailUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
        allowedPlatforms: ["tiktok", "instagram", "youtube"],
        rewardRatePer1kCents: 425,
        totalBudgetCents: 1200000,
        budgetSpentCents: 320000,
        minPayoutThreshold: 2500,
        maxPayoutPerClipCents: 50000,
        status: "active",
        goesLiveAt: new Date("2026-04-02T00:00:00Z"),
        createdAt: new Date("2026-04-01T10:00:00Z"),
      },
      {
        creatorId: creators[4]!.id,
        title: "Travel Diary: Tokyo Nights",
        description: "Neon-soaked Tokyo street footage. Cinematic, moody, and immersive.",
        requirementsType: "google_doc",
        requirementsUrl: "https://docs.google.com/document/d/travel123/edit",
        sourceContentUrl: "https://drive.google.com/file/d/mno345/view",
        sourceThumbnailUrl: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800&q=80",
        allowedPlatforms: ["tiktok", "youtube"],
        rewardRatePer1kCents: 600,
        totalBudgetCents: 650000,
        budgetSpentCents: 98000,
        minPayoutThreshold: 3000,
        maxPayoutPerClipCents: 60000,
        status: "active",
        goesLiveAt: new Date("2026-04-06T00:00:00Z"),
        createdAt: new Date("2026-04-05T10:00:00Z"),
      },
      {
        creatorId: creators[5]!.id,
        title: "Street Fashion Photography",
        description: "High-fashion street style captures. Looking for editorial-quality clips.",
        requirementsType: "native",
        requirementsText: "Focus on strong silhouettes and urban environments. Minimal text overlays — let the visuals speak.",
        sourceContentUrl: "https://drive.google.com/file/d/pqr678/view",
        sourceThumbnailUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
        allowedPlatforms: ["instagram", "tiktok"],
        rewardRatePer1kCents: 300,
        totalBudgetCents: 250000,
        budgetSpentCents: 20000,
        minPayoutThreshold: 2000,
        status: "active",
        goesLiveAt: new Date("2026-04-08T00:00:00Z"),
        createdAt: new Date("2026-04-07T10:00:00Z"),
      },
    ])
    .returning();

  // ─── Current user's own campaigns ──────────────────────────────────────────
  const ownCampaigns = await db
    .insert(schema.campaigns)
    .values([
      {
        creatorId: currentUser!.id,
        title: "My Fitness Campaign",
        description: "My own fitness transformation content.",
        requirementsType: "native",
        requirementsText: "Vertical clips only, 15-45 seconds. Highlight transformation moments.",
        sourceContentUrl: "https://drive.google.com/file/d/own123/view",
        sourceThumbnailUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
        allowedPlatforms: ["tiktok", "instagram", "youtube"],
        rewardRatePer1kCents: 400,
        totalBudgetCents: 500000,
        budgetSpentCents: 183000,
        minPayoutThreshold: 2000,
        maxPayoutPerClipCents: 30000,
        status: "active",
        goesLiveAt: new Date("2026-03-26T00:00:00Z"),
        createdAt: new Date("2026-03-25T10:00:00Z"),
      },
      {
        creatorId: currentUser!.id,
        title: "Morning Routine Clips",
        description: "Aesthetic morning routine footage.",
        requirementsType: "native",
        requirementsText: "Warm, cozy aesthetic. Good lighting required.",
        sourceContentUrl: "https://drive.google.com/file/d/own456/view",
        sourceThumbnailUrl: "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80",
        allowedPlatforms: ["tiktok", "instagram"],
        rewardRatePer1kCents: 325,
        totalBudgetCents: 200000,
        budgetSpentCents: 42000,
        minPayoutThreshold: 2000,
        status: "active",
        goesLiveAt: new Date("2026-04-02T00:00:00Z"),
        createdAt: new Date("2026-04-01T10:00:00Z"),
      },
      {
        creatorId: currentUser!.id,
        title: "Podcast Highlights Reel",
        description: "Best moments from my podcast episodes.",
        requirementsType: "google_doc",
        requirementsUrl: "https://docs.google.com/document/d/podcast/edit",
        sourceContentUrl: "https://drive.google.com/file/d/own789/view",
        sourceThumbnailUrl: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80",
        allowedPlatforms: ["tiktok", "instagram", "youtube"],
        rewardRatePer1kCents: 250,
        totalBudgetCents: 0,
        budgetSpentCents: 0,
        minPayoutThreshold: 1500,
        status: "pending_budget",
        createdAt: new Date("2026-04-08T10:00:00Z"),
      },
      {
        creatorId: currentUser!.id,
        title: "Winter Cozy Lookbook",
        description: "Cozy winter outfit clips — campaign ended, budget fully spent.",
        requirementsType: "native",
        requirementsText: "Warm aesthetic, layered outfits, cozy vibes.",
        sourceContentUrl: "https://drive.google.com/file/d/own999/view",
        sourceThumbnailUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
        allowedPlatforms: ["tiktok", "instagram"],
        rewardRatePer1kCents: 350,
        totalBudgetCents: 100000,
        budgetSpentCents: 100000,
        minPayoutThreshold: 2000,
        status: "completed",
        goesLiveAt: new Date("2026-02-01T00:00:00Z"),
        createdAt: new Date("2026-01-30T10:00:00Z"),
      },
    ])
    .returning();

  console.log(`Created ${campaignsFromOthers.length + ownCampaigns.length} campaigns`);

  // ─── Current user's submissions (as clipper) ───────────────────────────────
  await db.insert(schema.submissions).values([
    {
      campaignId: campaignsFromOthers[1]!.id, // Studio Session
      fanId: currentUser!.id,
      postUrl: "https://www.tiktok.com/@alexmorgan/video/7382940192",
      platform: "tiktok",
      aiReviewResult: "clean",
      status: "pending",
      autoApproveAt: new Date("2026-04-10T14:22:00Z"),
      createdAt: new Date("2026-04-08T14:22:00Z"),
    },
    {
      campaignId: campaignsFromOthers[0]!.id, // Summer Beach
      fanId: currentUser!.id,
      postUrl: "https://www.instagram.com/reel/Cxyz123/",
      platform: "instagram",
      aiReviewResult: "clean",
      status: "approved",
      creatorDecisionAt: new Date("2026-04-05T18:30:00Z"),
      verificationStartedAt: new Date("2026-04-05T18:30:00Z"),
      lockDate: new Date("2026-05-05T18:30:00Z"),
      createdAt: new Date("2026-04-05T09:15:00Z"),
    },
    {
      campaignId: campaignsFromOthers[2]!.id, // Fitness Transformation
      fanId: currentUser!.id,
      postUrl: "https://www.youtube.com/shorts/abc123",
      platform: "youtube",
      aiReviewResult: "clean",
      status: "paid",
      viewsAtDay30: 152400,
      payoutAmountCents: 41910,
      creatorDecisionAt: new Date("2026-03-07T20:10:00Z"),
      verificationStartedAt: new Date("2026-03-07T20:10:00Z"),
      lockDate: new Date("2026-04-06T20:10:00Z"),
      createdAt: new Date("2026-03-07T11:45:00Z"),
    },
    {
      campaignId: campaignsFromOthers[3]!.id, // Cooking Masterclass
      fanId: currentUser!.id,
      postUrl: "https://www.tiktok.com/@alexmorgan/video/7382940193",
      platform: "tiktok",
      aiReviewResult: "flagged",
      aiNotes: "Clip exceeds max length requirement — 52s vs 45s limit.",
      status: "rejected",
      rejectionReason: "Clip exceeds maximum length. Please re-edit to under 45 seconds and resubmit.",
      creatorDecisionAt: new Date("2026-04-04T08:20:00Z"),
      createdAt: new Date("2026-04-03T16:00:00Z"),
    },
  ]);

  // ─── Inbox submissions (fans submitting to currentUser's campaigns) ────────
  await db.insert(schema.submissions).values([
    {
      campaignId: ownCampaigns[0]!.id,
      fanId: fans[0]!.id, // Kai
      postUrl: "https://www.tiktok.com/@kaiclips/video/739172612",
      platform: "tiktok",
      aiReviewResult: "clean",
      status: "pending",
      autoApproveAt: new Date("2026-04-11T10:22:00Z"),
      createdAt: new Date("2026-04-09T10:22:00Z"),
    },
    {
      campaignId: ownCampaigns[0]!.id,
      fanId: fans[1]!.id, // Nina
      postUrl: "https://www.instagram.com/reel/NinaVClip/",
      platform: "instagram",
      aiReviewResult: "clean",
      status: "pending",
      autoApproveAt: new Date("2026-04-11T08:15:00Z"),
      createdAt: new Date("2026-04-09T08:15:00Z"),
    },
    {
      campaignId: ownCampaigns[0]!.id,
      fanId: fans[2]!.id, // Theo
      postUrl: "https://www.youtube.com/shorts/theo_001",
      platform: "youtube",
      aiReviewResult: "flagged",
      aiNotes: "Unusual view velocity detected. Possible bot inflation.",
      status: "flagged",
      autoApproveAt: new Date("2026-04-10T20:00:00Z"),
      createdAt: new Date("2026-04-08T20:00:00Z"),
    },
    {
      campaignId: ownCampaigns[0]!.id,
      fanId: fans[3]!.id, // Maya
      postUrl: "https://www.tiktok.com/@mayaokafor/video/maya_001",
      platform: "tiktok",
      aiReviewResult: "clean",
      status: "approved",
      creatorDecisionAt: new Date("2026-04-07T22:10:00Z"),
      verificationStartedAt: new Date("2026-04-07T22:10:00Z"),
      lockDate: new Date("2026-05-07T22:10:00Z"),
      createdAt: new Date("2026-04-07T14:00:00Z"),
    },
    {
      campaignId: ownCampaigns[0]!.id,
      fanId: fans[4]!.id, // Sam
      postUrl: "https://www.instagram.com/reel/SamPiercelip/",
      platform: "instagram",
      aiReviewResult: "flagged",
      aiNotes: "Clip does not match campaign requirements.",
      status: "rejected",
      rejectionReason: "Off-brand content. Please review the brief.",
      creatorDecisionAt: new Date("2026-04-06T18:00:00Z"),
      createdAt: new Date("2026-04-06T09:00:00Z"),
    },
  ]);

  console.log("Created submissions");

  // ─── Notifications ─────────────────────────────────────────────────────────
  await db.insert(schema.notifications).values([
    {
      userId: currentUser!.id,
      type: "new_submission",
      title: "New submission received",
      message: "Kai Thompson submitted a new clip to My Fitness Campaign",
      read: false,
      actionUrl: "/creator/inbox",
      createdAt: new Date("2026-04-09T10:22:00Z"),
    },
    {
      userId: currentUser!.id,
      type: "approved",
      title: "Submission approved",
      message: "Your clip for 'Summer Beach Vibes' was approved. 30-day view verification started.",
      read: false,
      actionUrl: "/submissions",
      createdAt: new Date("2026-04-05T18:30:00Z"),
    },
    {
      userId: currentUser!.id,
      type: "payout_released",
      title: "Payout released: $419.10",
      message: "Your earnings from the Fitness Transformation Series have been credited to your wallet.",
      read: true,
      actionUrl: "/wallet",
      createdAt: new Date("2026-04-06T20:10:00Z"),
    },
    {
      userId: currentUser!.id,
      type: "low_budget",
      title: "Low budget alert",
      message: "My Fitness Campaign has less than 20% budget remaining. Top up to keep it active.",
      read: true,
      actionUrl: "/creator/campaigns",
      createdAt: new Date("2026-04-04T09:00:00Z"),
    },
    {
      userId: currentUser!.id,
      type: "rejected",
      title: "Submission rejected",
      message: "Your clip for 'Cooking Masterclass' was rejected. See reason inside.",
      read: true,
      actionUrl: "/submissions",
      createdAt: new Date("2026-04-04T08:20:00Z"),
    },
  ]);

  console.log("Created notifications");

  // ─── Campaign Transactions ─────────────────────────────────────────────────
  await db.insert(schema.campaignTransactions).values([
    {
      campaignId: ownCampaigns[0]!.id,
      type: "escrow_lock",
      description: "Initial budget escrowed",
      amountCents: -500000,
      status: "completed",
      createdAt: new Date("2026-03-25T10:00:00Z"),
    },
    {
      campaignId: ownCampaigns[0]!.id,
      type: "payout_release",
      description: "Payout to Maya Okafor — 48.2K views",
      amountCents: -19280,
      status: "completed",
      createdAt: new Date("2026-04-07T22:10:00Z"),
    },
    {
      campaignId: ownCampaigns[0]!.id,
      type: "payout_release",
      description: "Payout to Kai Thompson — 34.1K views",
      amountCents: -13640,
      status: "completed",
      createdAt: new Date("2026-04-05T15:20:00Z"),
    },
    {
      campaignId: ownCampaigns[0]!.id,
      type: "topup",
      description: "Budget top-up via wallet",
      amountCents: 100000,
      status: "completed",
      createdAt: new Date("2026-04-03T09:00:00Z"),
    },
    {
      campaignId: ownCampaigns[0]!.id,
      type: "payout_release",
      description: "Payout to Sam Pierce — 18.5K views",
      amountCents: -7400,
      status: "pending",
      createdAt: new Date("2026-04-01T18:00:00Z"),
    },
    {
      campaignId: ownCampaigns[1]!.id,
      type: "escrow_lock",
      description: "Initial budget escrowed",
      amountCents: -200000,
      status: "completed",
      createdAt: new Date("2026-04-01T10:00:00Z"),
    },
    {
      campaignId: ownCampaigns[1]!.id,
      type: "payout_release",
      description: "Payout to clipper — 12.8K views",
      amountCents: -4160,
      status: "completed",
      createdAt: new Date("2026-04-08T14:30:00Z"),
    },
  ]);

  // ─── Wallet Transactions ───────────────────────────────────────────────────
  await db.insert(schema.walletTransactions).values([
    {
      userId: currentUser!.id,
      type: "topup",
      description: "Wallet top-up: $2,000.00",
      amountCents: 200000,
      status: "completed",
      createdAt: new Date("2026-03-20T10:00:00Z"),
    },
    {
      userId: currentUser!.id,
      type: "escrow_lock",
      description: 'Budget funded for "My Fitness Campaign"',
      amountCents: -500000,
      status: "completed",
      createdAt: new Date("2026-03-25T10:00:00Z"),
    },
    {
      userId: currentUser!.id,
      type: "payout",
      description: 'Payout for "Fitness Transformation Series" — 152.4K views',
      amountCents: 41910,
      status: "completed",
      createdAt: new Date("2026-04-06T20:10:00Z"),
    },
  ]);

  console.log("Created transactions");
  console.log("Seed complete!");
}

seed().catch(console.error);
