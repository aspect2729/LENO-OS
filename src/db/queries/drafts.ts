import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { drafts } from "@/db/schema";
import type {
  Critique,
  DraftStatus,
  PlatformId,
} from "@/shared/types";

export type DraftRow = typeof drafts.$inferSelect;

export type NewDraft = {
  campaign_id: string;
  platform: PlatformId;
  version: number;
  body: string;
  hashtags: string[];
};

export async function insertDrafts(rows: NewDraft[]): Promise<DraftRow[]> {
  if (rows.length === 0) return [];
  return db.insert(drafts).values(rows).returning();
}

/** Stores the critic's verdict against one draft version. */
export async function updateDraftCritique(
  id: string,
  critique: Critique,
  status: DraftStatus,
): Promise<void> {
  await db
    .update(drafts)
    .set({
      score: critique.weighted,
      scores: critique.scores,
      critic_notes: {
        fix_list: critique.fix_list,
        gate_failures: critique.gate_failures,
        rationale: critique.rationale,
      },
      status,
    })
    .where(eq(drafts.id, id));
}

export async function updateDraftStatus(
  id: string,
  status: DraftStatus,
): Promise<void> {
  await db.update(drafts).set({ status }).where(eq(drafts.id, id));
}

export async function getDraftsForCampaign(
  campaignId: string,
): Promise<DraftRow[]> {
  return db
    .select()
    .from(drafts)
    .where(eq(drafts.campaign_id, campaignId))
    .orderBy(drafts.platform, desc(drafts.version));
}

/** Newest revision of each platform's post — what a human would review. */
export async function getLatestDraftsByPlatform(
  campaignId: string,
): Promise<DraftRow[]> {
  return db
    .selectDistinctOn([drafts.platform])
    .from(drafts)
    .where(eq(drafts.campaign_id, campaignId))
    .orderBy(drafts.platform, desc(drafts.version));
}
