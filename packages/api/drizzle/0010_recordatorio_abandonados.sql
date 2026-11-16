CREATE TABLE IF NOT EXISTS "lead_reminders" (
	"lead_id" integer PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminder_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"abandoned_enabled" boolean DEFAULT true NOT NULL,
	"abandoned_delay_hours" integer DEFAULT 24 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'lead_reminders'::regclass AND contype = 'f'
	) THEN
		ALTER TABLE "lead_reminders" ADD CONSTRAINT "lead_reminders_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
