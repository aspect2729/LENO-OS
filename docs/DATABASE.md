# Database architecture (decided)

This is the locked design for Digital Distribution OS. It starts from the
four-table layout already in `src/db/schema.ts`, keeps what the pipeline
actually uses, and closes the gaps that would break publishing, review, or
Supabase security.

## Access model

| Concern | Decision |
| --- | --- |
| Engine | PostgreSQL on Supabase (free tier) |
| App access | Next.js server only, via Drizzle + `postgres` (postgres.js) |
| Connection | Transaction pooler URL at runtime (`prepare: false`); Session/Direct URL for `drizzle-kit migrate` |
| Browser | Never talks to Postgres or PostgREST for app data |
| Environments | Two Supabase projects: **dev** (local/CI) and **demo** (live). Same schema; different `DATABASE_URL` / `SUPABASE_*` |
| Ownership | One shared database. Agents do not own tables — the orchestrator and plain query helpers read/write everything |

Credentials stay in server-side `.env` only (`DATABASE_URL`, `SUPABASE_*`). Never ship them to the client.

## Tables

Four tables. No per-agent schemas.

### `brand_profile` — company context (one active brand)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK (UUID) | |
| `name`, `one_liner`, `positioning`, `audience` | text | |
| `products`, `competitors`, `tone_words`, `dos`, `donts` | jsonb string[] | tone_words 3–6 at the zod layer |
| `example_posts` | jsonb | exactly 5 strings |
| `primary_color`, `secondary_color` | text | `#RRGGBB` |
| `updated_at` | timestamptz | |

Loaded for every agent prompt through `getCompanyContext()` → `buildBrandCard()`.

### `campaigns` — one brief, one run

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK (UUID) | |
| `brief` | text | 20–2000 chars (zod) |
| `goal` | text, nullable | Denormalized `plan.goal` for display/filter; set when the plan step lands |
| `plan` | jsonb `Plan`, nullable | `{ goal, audience, key_message, platforms }` |
| `status` | text | `queued` \| `running` \| `needs_human` \| `ready` \| `failed` |
| `created_at` | timestamptz | |

Strategy is **not** a campaign column. It lives in `run_steps` (`step = 'strategy'`) so the audit trail stays the source of truth without duplicating a large jsonb on every campaign.

### `drafts` — one row per platform per version

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK (UUID) | |
| `campaign_id` | text FK → campaigns, **ON DELETE CASCADE** | |
| `platform` | text | `x` \| `linkedin` \| `instagram` \| `threads` (facebook reserved in zod, playbook disabled) |
| `version` | integer | 1 = first draft, +1 each revision |
| `body` | text | Post text **without** hashtags |
| `hashtags` | jsonb string[] | Stored separately so char limits and revisions stay accurate |
| `image_url` | text, nullable | Instagram / LinkedIn creative (later) |
| `score` | real, nullable | Weighted critic score 0–1 |
| `scores` | jsonb, nullable | `{ brand_voice, goal_fit, platform_fit, craft }` |
| `critic_notes` | jsonb, nullable | `{ fix_list, gate_failures, rationale }` — not a flat string list |
| `status` | text | `draft` \| `needs_human` \| `approved` \| `rejected` \| `published` |
| `review_note` | text, nullable | Approver note on reject; fed into the next revision |
| `scheduled_at` | timestamptz, nullable | |
| `published_url` | text, nullable | |
| `created_at` | timestamptz | |

**Unique:** `(campaign_id, platform, version)`.

Publish path composes `body` + `hashtags` in code (`composePost`); the DB never stores the merged string as the only representation.

### `run_steps` — append-only agent audit / live timeline

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK (UUID) | |
| `campaign_id` | text FK → campaigns, **ON DELETE CASCADE** | |
| `step` | text | `plan` \| `strategy` \| `draft` \| `critique` \| `revise` \| `error` |
| `model` | text | Model id that answered; `"-"` on error rows |
| `output` | jsonb | Validated step payload, or `{ message }` on error |
| `duration_ms` | integer | |
| `created_at` | timestamptz | |

**Index:** `(campaign_id, created_at)` for the campaign timeline.

## Relationships

```
brand_profile          standalone (read by every agent)
campaigns 1 ───< drafts      4 platforms × N versions
campaigns 1 ───< run_steps   ordered audit trail
```

## Lifecycle

```
campaign:  queued → running → ready
                          → needs_human
                          → failed

draft:     draft → approved → published
                 → rejected  (+ review_note) → new version
                 → needs_human → approved / rejected
```

Hard rule: agents never publish. Only `tools/social/*` after `status = 'approved'`.

## Who reads / writes

| Actor | Reads | Writes |
| --- | --- | --- |
| Brand UI | `brand_profile` | `brand_profile` |
| Orchestrator (plan) | brand + brief | `campaigns.goal/plan`, `run_steps` |
| Strategy | plan + brand card | `run_steps` only |
| Platform writer | plan + strategy + brand | `drafts` (new version), `run_steps` |
| Critic | drafts + plan + brand | `drafts.score/scores/critic_notes`, `run_steps` |
| Human approval UI | latest drafts | `drafts.status`, `review_note`; edits → new version |
| Publisher (code) | approved drafts | `status = published`, `published_url` |

## Security

1. Enable **Row Level Security** on all four tables with **no policies**.
2. PostgREST (`anon` / `authenticated`) then sees nothing.
3. The server’s direct Postgres role still works (RLS is not `FORCE`d).
4. Do not expose `DATABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Explicit non-goals (for now)

- No `@supabase/supabase-js` until Auth / Realtime / Storage is needed.
- No per-agent tables or schemas.
- No `campaigns.strategy` column (use `run_steps`).
- No multi-tenant / multi-brand rows yet — one brand profile per environment.
- No performance / analytics tables yet.

## Diff vs the earlier proposal draft

| Proposal | Decision |
| --- | --- |
| `campaigns.goal` as jsonb Plan | **text** — store `plan.goal` only; full plan stays in `plan` |
| `critic_notes` as vague jsonb | **structured** `{ fix_list, gate_failures, rationale }` |
| `hashtags` / `review_note` “recommended” | **in schema now** — pipeline already emits hashtags; approval needs the note |
| Unique + indexes listed | **in schema** |
| Cascade deletes | **yes** |
| RLS, no policies | **yes** (SQL migration) |
| Body stores composed post | **no** — store body + hashtags separately |

Schema source of truth: `src/db/schema.ts`. Zod shapes: `src/shared/schemas.ts`.
