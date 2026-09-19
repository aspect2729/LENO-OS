# Architecture

## What it does

Digital Distribution OS takes one campaign brief and turns it into on-brand,
platform-native social posts across X, LinkedIn, Instagram, and Threads
(Facebook later). Every draft is reviewed by a critic agent against a
weighted rubric, revised automatically if it falls short, and escalated to a
human when it doesn't improve fast enough. Nothing goes out to a real
platform until a human approves it. Once published, performance data feeds
back into future runs.

## Company context

Every agent in the system — orchestrator, intelligence, platform, and critic
— reads from the same company context rather than each keeping its own
copy:

- brand: name, one-liner, positioning
- audience
- products
- competitors
- tone (words, dos, don'ts)
- visual identity (primary/secondary color, image templates)
- guidelines and example past posts
- performance history (later)

This lives in the `brand_profile` table and is loaded through
`src/memory/context.ts`'s `getCompanyContext()`.

## Pipeline

```
User/Team (chat + campaign builder)
 -> Orchestrator agent
      Understand -> Define goal -> Create plan -> Select agents
      -> Execute -> Evaluate -> Iterate -> Deliver
 -> Intelligence agents: Brand/Audience, Research/Trend, Strategy
 -> Platform agents: X, LinkedIn, Instagram, Threads (Facebook later)
 -> Creative production (text, image, carousel)
 -> QA/Critic (brand, platform, quality, safety)
 -> Human approval (auto-publish is a later option)
 -> Publish/Schedule -> Analytics + Learning
```

## Agent loop

For each campaign objective, and for each enabled platform:

1. A platform agent drafts a post from the campaign's plan/strategy and the
   company context.
2. The critic agent scores it against the rubric (brand voice, goal fit,
   craft, platform fit) after two hard gates run first in plain code:
   platform limits (`agents/platforms/index.ts` `validateDraft`) and banned
   terms.
3. If the weighted score is at or above the pass threshold (0.8), the draft
   is done.
4. If not, the platform agent revises using the critic's fix list and the
   draft is re-scored. This repeats up to 3 rounds.
5. If it still hasn't passed after 3 rounds, the campaign is marked
   `needs_human` and a person reviews it directly.

A human always makes the final publish decision; auto-publish above the
threshold is a possible later option, not the default.

## Hard rule: agents never publish

Every step above — drafting, critiquing, revising — is agent (LLM) logic.
Publishing is not. Only plain, deterministic code in `tools/social/*`,
invoked from `workflows/campaign-run.ts`, writes to a real platform, and
only for a draft with `status = 'approved'`.

## Folder map

- `src/app/` — pages (`/`, `/brand`, `/campaigns/new`, `/campaigns/[id]`) and
  API route handlers (`/api/campaigns`, `/api/campaigns/[id]`, `/api/health`)
- `src/agents/orchestrator/` — the loop described above, plus `plan.ts`
- `src/agents/strategy/` — angle, hooks and CTA for a planned campaign
- `src/agents/critic/` — rubric constants and the critique function
- `src/agents/platforms/` — one typed playbook per platform, a registry,
  `validateDraft()`, and `draft.ts` (writes and revises every platform)
- Brand/audience and research agents are described above but not built yet
- `src/creative/templates/` — branded image templates (later)
- `src/tools/llm.ts` — writer/critic model registry, read from env
- `src/tools/social/bluesky.ts` — the only code allowed to publish
- `src/memory/context.ts` — loads the brand profile for prompts
- `src/workflows/campaign-run.ts` — starts a campaign run in the background
  via `after()`
- `src/db/` — Drizzle schema (`brand_profile`, `campaigns`, `drafts`,
  `run_steps`) on Supabase Postgres, client, and seed script. Locked
  design: `docs/DATABASE.md`.
- `src/shared/schemas.ts` / `src/shared/types.ts` — every zod schema in the
  app, and the types inferred from them
- `Dockerfile`, `docker-compose.yml` — the container image and the
  production Compose stack (migrate + app; DB is Supabase)

## Local setup

Create a Supabase project and copy its Database connection URI into
`.env` as `DATABASE_URL` (Session/Direct for migrations; Transaction
pooler is fine for the Next.js app).

```bash
npm run db:migrate  # apply drizzle/ migrations to Supabase
npm run db:seed     # insert the demo brand profile
npm run dev
```

## Deploy to EC2

The production stack is two Docker Compose services on one AWS EC2
instance (ARM, `t4g.small`): `migrate` (a one-shot job that runs
`drizzle-kit migrate` against Supabase and exits), and `app` (the Next.js
standalone server), wired so `app` only starts once `migrate` has
completed successfully. Postgres lives in Supabase — nothing listens on
5432 on the EC2 host.

1. Launch a `t4g.small` instance (Amazon Linux or Ubuntu ARM64). In its
   security group, allow port 22 from your IP only, and ports 80/443 from
   anywhere.
2. Install Docker and the Compose plugin, and add swap (the instance only
   has 2 GB RAM):
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
3. Clone the repo and create `.env` from `.env.example`, setting
   `DATABASE_URL` to your Supabase URI and the model/API keys.
4. Start the stack:
   ```bash
   docker compose up -d --build
   ```
5. Confirm `curl http://localhost/api/health` (or the instance's public
   address) returns `{"ok":true}`.

Supabase provides managed backups in the dashboard. Optionally run
`scripts/backup.sh` on the EC2 host (`pg_dump` via `DATABASE_URL`, gzip
into `backups/`, keep the last 7).
