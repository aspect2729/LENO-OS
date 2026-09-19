# AGENTS.md — Digital Distribution OS

Context for AI coding tools working in this repo. Read this before making changes.

## What this product does

Digital Distribution OS turns one campaign brief into on-brand, platform-native
social posts. An orchestrator agent plans the work, intelligence and platform
agents draft it, a critic agent scores it against a rubric, a human approves
it, and only then does plain deterministic code publish it. Performance
results feed back into future runs.

## Architecture

```
User/Team (chat + campaign builder)
 -> Orchestrator agent: Understand -> Define goal -> Create plan
    -> Select agents -> Execute -> Evaluate -> Iterate -> Deliver
 -> Intelligence agents: Brand/Audience, Research/Trend, Strategy
 -> Platform agents: X, LinkedIn, Instagram, Threads (Facebook later)
 -> Creative production (text, image, carousel)
 -> QA/Critic (brand, platform, quality, safety)
 -> Human approval (auto-publish is a later option)
 -> Publish/Schedule -> Analytics + Learning
```

Every agent shares the same company context: brand, positioning, audience,
products, competitors, tone, visual identity, guidelines, past content,
performance (see `src/memory/context.ts`).

**Agent loop:** campaign objective -> draft -> platform agent -> critic ->
score + feedback -> below threshold (0.8): revise and re-score, max 3 rounds,
then escalate to a human -> pass: done. See `src/agents/critic/index.ts` for
the rubric constants and `src/agents/orchestrator/index.ts` for the loop.

## Folder map

- `src/app/` — pages and route handlers (App Router)
- `src/agents/` — orchestrator, strategy, critic, and one module per
  platform (`agents/platforms/`). Brand/audience and research agents are
  planned but not built; don't leave empty stubs for them.
- `src/creative/templates/` — branded image templates (later)
- `src/tools/` — `llm.ts` (model registry), `social/bluesky.ts` (publish)
- `src/memory/context.ts` — loads the brand profile for agent prompts
- `src/workflows/campaign-run.ts` — starts a campaign run in the background
- `src/db/` — Drizzle schema (Postgres/pgTable), client, seed. Locked
 design in `docs/DATABASE.md`.
- `src/shared/` — `schemas.ts` (all zod schemas), `types.ts` (inferred
 types), `brand-card.ts` (the text every agent prompt is built from)
- `src/env.ts` — zod-validated environment variables
- `docker-compose.yml` / `Dockerfile` — production stack on EC2
 (migrate against Supabase + app); database is Supabase Postgres

## Hard rules

1. **Agents never publish.** Only plain, deterministic code (`tools/social/*`,
   called from `workflows/`) writes to a real platform, and only after a
   human has approved the draft.
2. **All LLM output is zod-validated.** Every writer/critic call must
   validate its result against a schema from `src/shared/schemas.ts` before
   the rest of the system trusts it.
3. **All schemas live in `src/shared/schemas.ts`.** Don't redeclare a shape
   elsewhere — import the schema and infer types from `src/shared/types.ts`.
4. **No new dependencies without asking.** The stack (Next.js, TypeScript,
 Tailwind, shadcn/ui, Drizzle + Supabase Postgres, Vercel AI SDK, zod,
 @atproto/api, Docker Compose) is intentionally fixed and free-tier. Ask
 before adding anything else. Do not add `@supabase/supabase-js` unless
 we need Auth/Realtime/Storage — the DB is just Postgres via `DATABASE_URL`.
5. **Small steps.** Ship one agent, one platform, or one schema at a time.
   Prefer a typed stub with a TODO over a half-finished implementation.
6. **DB route handlers run on Node.js, never edge.** postgres.js needs raw
   TCP sockets, which the edge runtime doesn't support — any route handler
   touching `src/db/client.ts` must set `export const runtime = "nodejs"`.

## Stack

Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui; Drizzle
ORM + drizzle-kit + `postgres` (postgres.js) on Supabase Postgres; Vercel AI
SDK (`ai`, `@ai-sdk/google` for the writer, `@ai-sdk/groq` for the critic);
zod for every schema; `@atproto/api` for Bluesky publishing (later); Docker
Compose on a single AWS EC2 instance for deployment (app + migrate; DB is
hosted on Supabase). npm only.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
