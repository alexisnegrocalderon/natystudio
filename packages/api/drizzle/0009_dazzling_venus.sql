CREATE TABLE IF NOT EXISTS "sale_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"kind" varchar(20) NOT NULL,
	"payload" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'sale_events'::regclass AND contype = 'f'
	) THEN
		ALTER TABLE "sale_events" ADD CONSTRAINT "sale_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sale_events_payment_kind_key" ON "sale_events" USING btree ("payment_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_events_pending_idx" ON "sale_events" USING btree ("sent_at","next_attempt_at");