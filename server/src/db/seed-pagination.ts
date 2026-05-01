import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

function hoursAgo(n: number) {
  return new Date(Date.now() - n * 3_600_000);
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  console.log("🌱 Seeding pagination data...");

  const [devClipper] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.handle, "dev_clipper"))
    .limit(1);
  const [devCreator] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.handle, "dev_creator"))
    .limit(1);

  if (!devClipper || !devCreator) {
    console.error(
      "❌ dev_clipper or dev_creator not found. Log in as Dev clipper and Dev creator once to create them, then re-run.",
    );
    process.exit(1);
  }

  console.log(`Found dev_clipper=${devClipper.id} dev_creator=${devCreator.id}`);

  const existingCreators = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, "creator"));

  const thumbs = [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800&q=80",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
    "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80",
    "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
  ];
  const platforms: ("tiktok" | "instagram" | "youtube")[] = [
    "tiktok",
    "instagram",
    "youtube",
  ];
  const statuses: (
    | "active"
    | "paused"
    | "completed"
    | "draft"
    | "pending_budget"
  )[] = ["active", "active", "active", "paused", "completed", "draft", "pending_budget"];

  // ─── Campaigns (dev_creator + additional active ones from other creators) ──
  console.log("Creating 25 campaigns...");
  const newCampaignRows: (typeof schema.campaigns.$inferInsert)[] = [];

  for (let i = 0; i < 15; i++) {
    const status = pick(statuses, i);
    const total = (200 + i * 50) * 100;
    const spent =
      status === "completed"
        ? total
        : status === "active" || status === "paused"
          ? Math.floor(total * (i / 30))
          : 0;
    newCampaignRows.push({
      creatorId: devCreator.id,
      title: `Dev Creator campaign #${i + 1}`,
      description: `Test campaign number ${i + 1} for pagination seeding.`,
      requirementsType: "native",
      requirementsText: "15-45 second clips, vertical format, minimal text overlays.",
      sourceContentUrl: "https://drive.google.com/file/d/seeded/view",
      sourceThumbnailUrl: pick(thumbs, i),
      allowedPlatforms: ["tiktok", "instagram", "youtube"],
      rewardRatePer1kCents: 200 + (i % 6) * 100,
      totalBudgetCents: status === "draft" || status === "pending_budget" ? 0 : total,
      budgetSpentCents: spent,
      minPayoutThreshold: 2000,
      maxPayoutPerClipCents: 20000 + (i % 4) * 10000,
      status,
      goesLiveAt:
        status === "draft" || status === "pending_budget" ? null : daysAgo(30 - i),
      createdAt: daysAgo(60 - i * 2),
    });
  }

  // 10 additional active campaigns from other creators so dev_clipper has options
  for (let i = 0; i < 10; i++) {
    const creator = existingCreators[i % existingCreators.length]!;
    if (creator.id === devClipper.id) continue;
    newCampaignRows.push({
      creatorId: creator.id,
      title: `${creator.displayName}'s extra campaign #${i + 1}`,
      description: `Seeded campaign from ${creator.displayName} for testing.`,
      requirementsType: "native",
      requirementsText: "Standard short-form clip requirements.",
      sourceContentUrl: "https://drive.google.com/file/d/seeded2/view",
      sourceThumbnailUrl: pick(thumbs, i + 3),
      allowedPlatforms: pick(
        [
          ["tiktok", "instagram", "youtube"],
          ["tiktok", "instagram"],
          ["youtube", "tiktok"],
          ["instagram", "youtube"],
        ],
        i,
      ),
      rewardRatePer1kCents: 250 + (i % 5) * 75,
      totalBudgetCents: (500 + i * 80) * 100,
      budgetSpentCents: (i * 30) * 100,
      minPayoutThreshold: 1500 + (i % 3) * 500,
      maxPayoutPerClipCents: 30000,
      status: "active",
      goesLiveAt: daysAgo(20 - i),
      createdAt: daysAgo(45 - i),
    });
  }

  const campaigns = await db
    .insert(schema.campaigns)
    .values(newCampaignRows)
    .returning();

  const devCreatorActiveCampaigns = campaigns.filter(
    (c) => c.creatorId === devCreator.id && c.status !== "draft" && c.status !== "pending_budget",
  );
  const allActiveCampaigns = campaigns.filter((c) => c.status === "active");

  // ─── Submissions ────────────────────────────────────────────────────────────
  // dev_clipper submits many clips to various active campaigns
  // Additional fan users (kai/nina/theo/maya/sam) submit to dev_creator's campaigns
  let fans = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, "clipper"));
  let otherFans = fans.filter((f) => f.id !== devClipper.id);

  // If there are no other clippers, create a handful so dev_creator's inbox has variety
  if (otherFans.length === 0) {
    const newFans = await db
      .insert(schema.users)
      .values(
        [
          { handle: "kai_test", name: "Kai Test", seed: "kai" },
          { handle: "nina_test", name: "Nina Test", seed: "nina" },
          { handle: "theo_test", name: "Theo Test", seed: "theo" },
          { handle: "maya_test", name: "Maya Test", seed: "maya" },
          { handle: "sam_test", name: "Sam Test", seed: "sam" },
        ].map((f) => ({
          email: `${f.handle}@seed.local`,
          handle: f.handle,
          displayName: f.name,
          avatarUrl: `https://api.dicebear.com/9.x/glass/svg?seed=${f.seed}&backgroundColor=b8a5d4`,
          role: "clipper" as const,
        })),
      )
      .returning();
    console.log(`✓ created ${newFans.length} test fan users`);
    fans = [...fans, ...newFans];
    otherFans = newFans;
  }

  console.log("Creating ~80 submissions...");
  const submissionRows: (typeof schema.submissions.$inferInsert)[] = [];

  // 45 submissions from dev_clipper across active campaigns
  for (let i = 0; i < 45; i++) {
    const campaign = pick(allActiveCampaigns, i);
    if (!campaign) break;
    const bucket = i % 5; // 0 pending, 1 approved, 2 verify-ready, 3 paid, 4 rejected
    const createdAt = daysAgo(40 - (i % 35));

    let status: "pending" | "approved" | "paid_off_platform" | "rejected" = "pending";
    let creatorDecisionAt: Date | null = null;
    let verificationStartedAt: Date | null = null;
    let lockDate: Date | null = null;
    let autoApproveAt: Date | null = null;
    let viewsAtDay30: number | null = null;
    let payoutAmountCents: number | null = null;
    let rejectionReason: string | null = null;

    switch (bucket) {
      case 0:
        status = "pending";
        autoApproveAt = hoursAgo(-24 - (i % 40));
        break;
      case 1: {
        // approved, still waiting (lockDate future)
        status = "approved";
        creatorDecisionAt = daysAgo(5 + (i % 10));
        verificationStartedAt = creatorDecisionAt;
        lockDate = new Date(creatorDecisionAt.getTime() + 30 * 86_400_000);
        break;
      }
      case 2: {
        // approved, ready to verify (lockDate past)
        status = "approved";
        creatorDecisionAt = daysAgo(40 + (i % 10));
        verificationStartedAt = creatorDecisionAt;
        lockDate = daysAgo(1);
        break;
      }
      case 3: {
        status = "paid_off_platform";
        creatorDecisionAt = daysAgo(45 + (i % 10));
        verificationStartedAt = creatorDecisionAt;
        lockDate = daysAgo(10 + (i % 5));
        viewsAtDay30 = 5000 + (i * 1500);
        payoutAmountCents = Math.min(
          Math.round(
            (viewsAtDay30 / 1000) * (campaign.rewardRatePer1kCents ?? 300),
          ),
          campaign.maxPayoutPerClipCents ?? 30000,
        );
        break;
      }
      case 4: {
        status = "rejected";
        creatorDecisionAt = daysAgo(3 + (i % 10));
        rejectionReason = pick(
          [
            "Off-brand content, please review the brief.",
            "Clip exceeds max length.",
            "Low production quality.",
            "Wrong aspect ratio.",
            "Music is copyright-flagged.",
          ],
          i,
        );
        break;
      }
    }

    submissionRows.push({
      campaignId: campaign.id,
      fanId: devClipper.id,
      postUrl: `https://www.${pick(platforms, i)}.com/@dev_clipper/post/${i + 100}`,
      platform: pick(platforms, i),
      status,
      autoApproveAt,
      creatorDecisionAt,
      verificationStartedAt,
      lockDate,
      viewsAtDay30,
      payoutAmountCents,
      rejectionReason,
      createdAt,
    });
  }

  // 35 submissions from other fans to dev_creator's active campaigns
  for (let i = 0; i < 35; i++) {
    const campaign = pick(devCreatorActiveCampaigns, i);
    if (!campaign) break;
    const fan = pick(otherFans, i);
    const bucket = i % 5;
    const createdAt = daysAgo(38 - (i % 32));

    let status: "pending" | "approved" | "paid_off_platform" | "rejected" = "pending";
    let creatorDecisionAt: Date | null = null;
    let verificationStartedAt: Date | null = null;
    let lockDate: Date | null = null;
    let autoApproveAt: Date | null = null;
    let viewsAtDay30: number | null = null;
    let payoutAmountCents: number | null = null;
    let rejectionReason: string | null = null;

    switch (bucket) {
      case 0:
        status = "pending";
        autoApproveAt = hoursAgo(-24 - (i % 40));
        break;
      case 1:
        status = "approved";
        creatorDecisionAt = daysAgo(4 + (i % 10));
        verificationStartedAt = creatorDecisionAt;
        lockDate = new Date(creatorDecisionAt.getTime() + 30 * 86_400_000);
        break;
      case 2:
        status = "approved";
        creatorDecisionAt = daysAgo(45 + (i % 5));
        verificationStartedAt = creatorDecisionAt;
        lockDate = daysAgo(1);
        break;
      case 3:
        status = "paid_off_platform";
        creatorDecisionAt = daysAgo(50 + (i % 5));
        verificationStartedAt = creatorDecisionAt;
        lockDate = daysAgo(15 + (i % 5));
        viewsAtDay30 = 3000 + i * 1200;
        payoutAmountCents = Math.min(
          Math.round(
            (viewsAtDay30 / 1000) * (campaign.rewardRatePer1kCents ?? 300),
          ),
          campaign.maxPayoutPerClipCents ?? 30000,
        );
        break;
      case 4:
        status = "rejected";
        creatorDecisionAt = daysAgo(2 + (i % 10));
        rejectionReason = pick(
          [
            "Off-brand content.",
            "Does not match the brief.",
            "Low quality or shaky footage.",
            "Wrong platform aspect ratio.",
          ],
          i,
        );
        break;
    }

    submissionRows.push({
      campaignId: campaign.id,
      fanId: fan!.id,
      postUrl: `https://www.${pick(platforms, i)}.com/@${fan!.handle}/post/${i + 200}`,
      platform: pick(platforms, i),
      status,
      autoApproveAt,
      creatorDecisionAt,
      verificationStartedAt,
      lockDate,
      viewsAtDay30,
      payoutAmountCents,
      rejectionReason,
      createdAt,
    });
  }

  await db.insert(schema.submissions).values(submissionRows);
  console.log(`✓ inserted ${submissionRows.length} submissions`);

  // ─── Campaign bans: simulate a few banned clippers ──────────────────────────
  // For dev_clipper — ban from 2 of dev_creator's campaigns that have a rejected sub from dev_clipper
  const devClipperRejectedSubs = submissionRows
    .filter((s) => s.fanId === devClipper.id && s.status === "rejected")
    .slice(0, 2);
  if (devClipperRejectedSubs.length > 0) {
    const banRows = devClipperRejectedSubs.map((s) => ({
      campaignId: s.campaignId,
      userId: s.fanId,
      createdAt: s.creatorDecisionAt as Date,
    }));
    await db
      .insert(schema.campaignBans)
      .values(banRows)
      .onConflictDoNothing();
    console.log(`✓ created ${banRows.length} bans`);
  }

  // ─── Notifications ─────────────────────────────────────────────────────────
  console.log("Creating 60 notifications...");
  const notifRows: (typeof schema.notifications.$inferInsert)[] = [];

  // 30 for dev_clipper
  for (let i = 0; i < 30; i++) {
    const kinds: (
      | "approved"
      | "rejected"
      | "payout_released"
      | "views_ready"
    )[] = ["approved", "rejected", "payout_released", "views_ready"];
    const type = pick(kinds, i);
    const createdAt = hoursAgo(i * 2);
    let title = "";
    let message = "";
    let actionUrl = "/submissions";
    switch (type) {
      case "approved":
        title = "Submission approved";
        message = `Your clip #${i + 1} was approved. 30-day view verification started.`;
        actionUrl = "/submissions?tab=approved";
        break;
      case "rejected":
        title = "Submission rejected";
        message = `Your clip #${i + 1} was rejected.`;
        actionUrl = "/submissions?tab=rejected";
        break;
      case "payout_released":
        title = `Payout released: $${(20 + i).toFixed(2)}`;
        message = "Your earnings have been credited to your wallet.";
        actionUrl = "/wallet";
        break;
      case "views_ready":
        title = "Views ready for verification";
        message = "Your clip has reached the 30-day view lock.";
        actionUrl = "/submissions?tab=approved";
        break;
    }
    notifRows.push({
      userId: devClipper.id,
      type,
      title,
      message,
      read: i > 5,
      actionUrl,
      createdAt,
    });
  }

  // 30 for dev_creator — mostly new_submission
  for (let i = 0; i < 30; i++) {
    notifRows.push({
      userId: devCreator.id,
      type: i % 5 === 0 ? "low_budget" : "new_submission",
      title:
        i % 5 === 0 ? "Low budget alert" : "New submission received",
      message:
        i % 5 === 0
          ? `Campaign #${i + 1} has less than 20% budget remaining.`
          : `A new clip was submitted to campaign #${i + 1}.`,
      read: i > 4,
      actionUrl:
        i % 5 === 0 ? "/creator/campaigns" : "/creator/inbox?tab=pending",
      createdAt: hoursAgo(i * 3),
    });
  }

  await db.insert(schema.notifications).values(notifRows);
  console.log(`✓ inserted ${notifRows.length} notifications`);

  console.log("✅ Pagination seed complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
