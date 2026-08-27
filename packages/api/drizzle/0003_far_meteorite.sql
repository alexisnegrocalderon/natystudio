CREATE TABLE "date_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"day" varchar(10) NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "date_overrides" ADD CONSTRAINT "date_overrides_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "date_overrides_location_day_idx" ON "date_overrides" USING btree ("location_id","day");