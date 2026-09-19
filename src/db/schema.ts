import {
  pgTable,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  CampaignStatus,
  CriticNotes,
  CritiqueScores,
  DraftStatus,
  Plan,
} from "@/shared/types";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow();

const CAMPAIGN_STATUSES = [
  "queued",
  "running",
  "needs_human",
  "ready",
  "failed",
] as const;

const DRAFT_STATUSES = [
  "draft",
  "needs_human",
  "approved",
  "rejected",
  "published",
] as const;

// ---------------------------------------------------------------------------
// brand_profile — the company context shared by every agent
// ---------------------------------------------------------------------------

export const brandProfile = pgTable("brand_profile", {
  id: id(),
  name: text("name").notNull(),
  one_liner: text("one_liner").notNull(),
  positioning: text("positioning").notNull(),
  audience: text("audience").notNull(),
  products: jsonb("products").notNull().$type<string[]>(),
  competitors: jsonb("competitors").notNull().$type<string[]>(),
  tone_words: jsonb("tone_words").notNull().$type<string[]>(),
  dos: jsonb("dos").notNull().$type<string[]>(),
  donts: jsonb("donts").notNull().$type<string[]>(),
  example_posts: jsonb("example_posts")
    .notNull()
    .$type<[string, string, string, string, string]>(),
  primary_color: text("primary_color").notNull(),
  secondary_color: text("secondary_color").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// campaigns — one campaign brief driving one orchestrator run
// ---------------------------------------------------------------------------

export const campaigns = pgTable("campaigns", {
  id: id(),
  brief: text("brief").notNull(),
  /** Denormalized plan.goal for display/filter; full plan is in `plan`. */
  goal: text("goal"),
  plan: jsonb("plan").$type<Plan | null>(),
  status: text("status", { enum: CAMPAIGN_STATUSES })
    .notNull()
    .$type<CampaignStatus>()
    .default("queued"),
  created_at: createdAt(),
});

// ---------------------------------------------------------------------------
// drafts — one row per platform per revision round
// ---------------------------------------------------------------------------

export const drafts = pgTable(
  "drafts",
  {
    id: id(),
    campaign_id: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    version: integer("version").notNull().default(1),
    /** Post text without hashtags. Publish path composes with `hashtags`. */
    body: text("body").notNull(),
    hashtags: jsonb("hashtags").notNull().$type<string[]>().default([]),
    image_url: text("image_url"),
    score: real("score"),
    scores: jsonb("scores").$type<CritiqueScores | null>(),
    critic_notes: jsonb("critic_notes").$type<CriticNotes | null>(),
    status: text("status", { enum: DRAFT_STATUSES })
      .notNull()
      .$type<DraftStatus>()
      .default("draft"),
    /** Approver note when rejecting; fed into the next revision. */
    review_note: text("review_note"),
    scheduled_at: timestamp("scheduled_at", {
      withTimezone: true,
      mode: "string",
    }),
    published_url: text("published_url"),
    created_at: createdAt(),
  },
  (t) => [
    uniqueIndex("drafts_campaign_platform_version_uidx").on(
      t.campaign_id,
      t.platform,
      t.version,
    ),
  ],
);

// ---------------------------------------------------------------------------
// run_steps — an append-only log of every orchestrator/agent step
// ---------------------------------------------------------------------------

export const runSteps = pgTable(
  "run_steps",
  {
    id: id(),
    campaign_id: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    step: text("step").notNull(),
    model: text("model").notNull(),
    output: jsonb("output").notNull().$type<unknown>(),
    duration_ms: integer("duration_ms").notNull().default(0),
    created_at: createdAt(),
  },
  (t) => [
    index("run_steps_campaign_created_idx").on(t.campaign_id, t.created_at),
  ],
);
