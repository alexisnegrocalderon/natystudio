CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" varchar(200) NOT NULL,
	"amount_clp" integer NOT NULL,
	"category" varchar(60) DEFAULT 'otro' NOT NULL,
	"location_id" integer,
	"incurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_incurred_at_idx" ON "expenses" USING btree ("incurred_at");