ALTER TABLE "drafts" DROP CONSTRAINT "drafts_campaign_id_campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "run_steps" DROP CONSTRAINT "run_steps_campaign_id_campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "goal" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "hashtags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drafts_campaign_platform_version_uidx" ON "drafts" USING btree ("campaign_id","platform","version");--> statement-breakpoint
CREATE INDEX "run_steps_campaign_created_idx" ON "run_steps" USING btree ("campaign_id","created_at");--> statement-breakpoint
-- Supabase PostgREST hardening: RLS on, no policies → anon/authenticated
-- see nothing. The server's direct Postgres role still bypasses RLS.
ALTER TABLE "brand_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "run_steps" ENABLE ROW LEVEL SECURITY;
