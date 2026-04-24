import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, ilike, inArray } from "drizzle-orm";
import * as schema from "./schema.js";

async function cleanSeed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  console.log("Cleaning seed data...");

  // Find all seed users (emails ending with @example.com)
  const seedUsers = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(ilike(schema.users.email, "%@example.com"));

  if (seedUsers.length === 0) {
    console.log("No seed data found.");
    return;
  }

  const seedUserIds = seedUsers.map((u) => u.id);
  console.log(`Found ${seedUsers.length} seed users:`, seedUsers.map((u) => u.email));

  // Find campaigns owned by seed users
  const seedCampaigns = await db
    .select({ id: schema.campaigns.id })
    .from(schema.campaigns)
    .where(inArray(schema.campaigns.creatorId, seedUserIds));

  const seedCampaignIds = seedCampaigns.map((c) => c.id);
  console.log(`Found ${seedCampaigns.length} seed campaigns`);

  // Delete in FK order
  if (seedCampaignIds.length > 0) {
    await db
      .delete(schema.campaignTransactions)
      .where(inArray(schema.campaignTransactions.campaignId, seedCampaignIds));
    console.log("Deleted seed campaign transactions");

    await db
      .delete(schema.campaignBans)
      .where(inArray(schema.campaignBans.campaignId, seedCampaignIds));
    console.log("Deleted seed campaign bans");

    // Delete snapshots for submissions tied to seed campaigns
    const subsToSeedCampaigns = await db
      .select({ id: schema.submissions.id })
      .from(schema.submissions)
      .where(inArray(schema.submissions.campaignId, seedCampaignIds));
    const subIdsToSeedCampaigns = subsToSeedCampaigns.map((s) => s.id);
    if (subIdsToSeedCampaigns.length > 0) {
      await db
        .delete(schema.submissionViewSnapshots)
        .where(
          inArray(
            schema.submissionViewSnapshots.submissionId,
            subIdsToSeedCampaigns,
          ),
        );
      console.log("Deleted snapshots for submissions to seed campaigns");
    }

    // Delete submissions TO seed campaigns (from any user)
    await db
      .delete(schema.submissions)
      .where(inArray(schema.submissions.campaignId, seedCampaignIds));
    console.log("Deleted submissions to seed campaigns");
  }

  // Delete snapshots for remaining submissions from seed users
  const subsFromSeedUsers = await db
    .select({ id: schema.submissions.id })
    .from(schema.submissions)
    .where(inArray(schema.submissions.fanId, seedUserIds));
  const subIdsFromSeedUsers = subsFromSeedUsers.map((s) => s.id);
  if (subIdsFromSeedUsers.length > 0) {
    await db
      .delete(schema.submissionViewSnapshots)
      .where(
        inArray(
          schema.submissionViewSnapshots.submissionId,
          subIdsFromSeedUsers,
        ),
      );
    console.log("Deleted snapshots for submissions from seed users");
  }

  // Delete submissions FROM seed users (to any campaign)
  await db
    .delete(schema.submissions)
    .where(inArray(schema.submissions.fanId, seedUserIds));
  console.log("Deleted submissions from seed users");

  // Delete notifications for seed users
  await db
    .delete(schema.notifications)
    .where(inArray(schema.notifications.userId, seedUserIds));
  console.log("Deleted seed notifications");

  // Delete wallet transactions for seed users
  await db
    .delete(schema.walletTransactions)
    .where(inArray(schema.walletTransactions.userId, seedUserIds));
  console.log("Deleted seed wallet transactions");

  // Delete seed campaigns
  if (seedCampaignIds.length > 0) {
    await db
      .delete(schema.campaigns)
      .where(inArray(schema.campaigns.id, seedCampaignIds));
    console.log("Deleted seed campaigns");
  }

  // Delete seed users
  await db
    .delete(schema.users)
    .where(inArray(schema.users.id, seedUserIds));
  console.log("Deleted seed users");

  console.log("Seed data cleanup complete!");
}

cleanSeed().catch(console.error);
