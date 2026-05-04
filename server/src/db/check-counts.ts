import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import * as schema from "./schema.js";

async function main() {
  const neonSql = neon(process.env.DATABASE_URL!);
  const db = drizzle(neonSql, { schema });

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
    console.log("❌ dev users not found");
    return;
  }

  console.log(`dev_clipper id: ${devClipper.id}`);
  console.log(`dev_creator id: ${devCreator.id}\n`);

  const [campaignsMine] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.creatorId, devCreator.id));
  const [mySubs] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.submissions)
    .where(eq(schema.submissions.fanId, devClipper.id));
  const [notifClipper] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, devClipper.id));
  const [notifCreator] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, devCreator.id));
  const [totalCampaigns] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.campaigns);
  const [totalSubmissions] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.submissions);

  console.log("─── Totals ───");
  console.log(`campaigns (all):               ${totalCampaigns?.n}`);
  console.log(`submissions (all):             ${totalSubmissions?.n}`);
  console.log("");
  console.log("─── dev_creator ───");
  console.log(`campaigns owned:               ${campaignsMine?.n}`);
  console.log(`notifications:                 ${notifCreator?.n}`);
  console.log("");
  console.log("─── dev_clipper ───");
  console.log(`submissions:                   ${mySubs?.n}`);
  console.log(`notifications:                 ${notifClipper?.n}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
