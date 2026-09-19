/**
 * ALL zod schemas for the app live in this file. Do not define schemas
 * elsewhere — import from here (and from `@/shared/types` for the
 * inferred TypeScript types) instead of redeclaring shapes.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const PlatformIdSchema = z.enum([
  "x",
  "linkedin",
  "instagram",
  "threads",
  "facebook",
]);

export const CampaignStatusSchema = z.enum([
  "queued",
  "running",
  "needs_human",
  "ready",
  "failed",
]);

export const DraftStatusSchema = z.enum([
  "draft",
  "needs_human",
  "approved",
  "rejected",
  "published",
]);

// ---------------------------------------------------------------------------
// Company context
// ---------------------------------------------------------------------------

/** How many example posts a brand profile carries. The form renders this many. */
export const EXAMPLE_POST_COUNT = 5;

export const BrandProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  one_liner: z.string(),
  positioning: z.string(),
  audience: z.string(),
  products: z.array(z.string()),
  competitors: z.array(z.string()),
  tone_words: z.array(z.string()),
  dos: z.array(z.string()),
  donts: z.array(z.string()),
  example_posts: z.array(z.string()).length(EXAMPLE_POST_COUNT),
  primary_color: z.string(),
  secondary_color: z.string(),
  updated_at: z.string(),
});

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * What the /brand form actually accepts: BrandProfile minus the fields the
 * server owns (id, updated_at), with the validation rules the UI enforces.
 */
export const BrandProfileInputSchema = z.object({
  name: z.string().trim().min(1, "Required").max(80, "80 characters max"),
  one_liner: z
    .string()
    .trim()
    .min(1, "Required")
    .max(160, "160 characters max"),
  positioning: z.string().trim().min(1, "Required"),
  audience: z.string().trim().min(1, "Required"),
  products: z.array(z.string().trim().min(1)).max(10, "10 items max"),
  competitors: z.array(z.string().trim().min(1)).max(10, "10 items max"),
  tone_words: z
    .array(z.string().trim().min(1))
    .min(3, "At least 3 tone words")
    .max(6, "At most 6 tone words"),
  dos: z
    .array(z.string().trim().min(1))
    .min(1, "At least 1 item")
    .max(10, "10 items max"),
  donts: z
    .array(z.string().trim().min(1))
    .min(1, "At least 1 item")
    .max(10, "10 items max"),
  example_posts: z
    .array(z.string().trim().min(20, "At least 20 characters"))
    .length(EXAMPLE_POST_COUNT, `Exactly ${EXAMPLE_POST_COUNT} example posts`),
  primary_color: z
    .string()
    .regex(HEX_COLOR_REGEX, "Must be a hex color like #1A2B3C"),
  secondary_color: z
    .string()
    .regex(HEX_COLOR_REGEX, "Must be a hex color like #1A2B3C"),
});

// ---------------------------------------------------------------------------
// Orchestrator: plan + strategy
// ---------------------------------------------------------------------------

/** The brief a human submits to start a campaign. */
export const CampaignBriefSchema = z.object({
  brief: z
    .string()
    .trim()
    .min(20, "Brief must be at least 20 characters")
    .max(2000, "Brief must be at most 2000 characters"),
});

export const PlanSchema = z.object({
  goal: z.string(),
  audience: z.string(),
  key_message: z.string(),
  /** Only platforms whose playbook is enabled; enforced in agents/orchestrator/plan.ts. */
  platforms: z.array(PlatformIdSchema).min(1),
});

/**
 * Per-platform angle notes. Spelled out key by key rather than as a
 * z.record so the JSON Schema handed to Gemini stays a plain object with
 * named properties — structured output is far more reliable that way.
 */
export const PlatformNotesSchema = z.object({
  x: z.string().optional(),
  linkedin: z.string().optional(),
  instagram: z.string().optional(),
  threads: z.string().optional(),
  facebook: z.string().optional(),
});

export const StrategySchema = z.object({
  angle: z.string(),
  hooks: z.array(z.string()).length(3),
  cta: z.string(),
  platform_notes: PlatformNotesSchema,
});

// ---------------------------------------------------------------------------
// Creative production
// ---------------------------------------------------------------------------

export const DraftSchema = z.object({
  platform: PlatformIdSchema,
  body: z.string(),
  hashtags: z.array(z.string()),
});

export const DraftSetSchema = z.object({
  drafts: z.array(DraftSchema),
});

// ---------------------------------------------------------------------------
// QA / Critic
// ---------------------------------------------------------------------------

export const CritiqueScoresSchema = z.object({
  brand_voice: z.number().min(0).max(1),
  goal_fit: z.number().min(0).max(1),
  platform_fit: z.number().min(0).max(1),
  craft: z.number().min(0).max(1),
});

/**
 * What the critic model is allowed to return. It scores and criticises —
 * it never does the arithmetic and never decides pass/fail.
 */
export const CritiqueLLMSchema = z.object({
  platform: PlatformIdSchema,
  scores: CritiqueScoresSchema,
  fix_list: z
    .array(z.string())
    .max(5, "At most 5 fixes")
    .describe("Specific, actionable fixes. Quote the exact phrase at fault."),
  rationale: z.string(),
});

export const CritiqueLLMSetSchema = z.object({
  critiques: z.array(CritiqueLLMSchema),
});

/** The critique after code adds the hard gates, weighted score and verdict. */
export const CritiqueSchema = CritiqueLLMSchema.extend({
  weighted: z.number().min(0).max(1),
  gate_failures: z.array(z.string()),
  pass: z.boolean(),
});

/**
 * What we persist on `drafts.critic_notes`. Keeps gate failures, the fix
 * list, and the rationale together instead of flattening to a string[].
 */
export const CriticNotesSchema = z.object({
  fix_list: z.array(z.string()),
  gate_failures: z.array(z.string()),
  rationale: z.string(),
});

