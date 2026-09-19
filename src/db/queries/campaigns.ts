import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import type { CampaignStatus, Plan } from "@/shared/types";

export type Campaign = typeof campaigns.$inferSelect;

export async function insertCampaign(brief: string): Promise<Campaign> {
  const [row] = await db
    .insert(campaigns)
    .values({ brief, status: "queued" })
    .returning();
  return row;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus,
): Promise<void> {
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
}

/**
 * The planner produces one Plan. `goal` stores the goal statement for
 * display/filter; `plan` stores the full object.
 */
export async function saveCampaignPlan(id: string, plan: Plan): Promise<void> {
  await db
    .update(campaigns)
    .set({ goal: plan.goal, plan })
    .where(eq(campaigns.id, id));
}
