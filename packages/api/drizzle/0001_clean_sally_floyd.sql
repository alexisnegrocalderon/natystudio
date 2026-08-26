ALTER TYPE "public"."email_job_kind" ADD VALUE 'payment_received';--> statement-breakpoint
ALTER TYPE "public"."email_job_kind" ADD VALUE 'manual_message';--> statement-breakpoint
ALTER TABLE "email_jobs" ADD COLUMN "payload" text;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_email_service_key" ON "leads" USING btree ("email","service_id");--> statement-breakpoint
CREATE INDEX "payments_status_updated_idx" ON "payments" USING btree ("status","updated_at");