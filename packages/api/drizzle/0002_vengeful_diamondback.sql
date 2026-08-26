CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" varchar(140) NOT NULL,
	"city" varchar(120) NOT NULL,
	"region" varchar(120) NOT NULL,
	"street_address" varchar(240) DEFAULT '' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"whatsapp" varchar(200),
	"note" varchar(200),
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
-- Sedes iniciales: Valparaíso (la que ya existía) y Providencia (nueva).
-- Se siembran acá, antes de agregar location_id, para poder rellenar las
-- filas existentes de business_hours/time_off/appointments sin dejar
-- ninguna en null.
INSERT INTO "locations" ("slug", "name", "city", "region", "street_address", "latitude", "longitude", "sort_order")
VALUES
  ('valparaiso', 'Valparaíso', 'Valparaíso', 'Región de Valparaíso', '', -33.0472, -71.6127, 0),
  ('providencia', 'Providencia', 'Providencia', 'Región Metropolitana', '', NULL, NULL, 1);
--> statement-breakpoint
DROP INDEX "business_hours_weekday_idx";--> statement-breakpoint
-- location_id se agrega nullable primero: agregarla NOT NULL de una en una
-- tabla con filas existentes (horarios ya cargados) rompería la migración.
ALTER TABLE "appointments" ADD COLUMN "location_id" integer;--> statement-breakpoint
ALTER TABLE "business_hours" ADD COLUMN "location_id" integer;--> statement-breakpoint
ALTER TABLE "time_off" ADD COLUMN "location_id" integer;--> statement-breakpoint
-- Todo lo que existía hasta ahora era, por definición, de la sede de
-- Valparaíso: es la única que había.
UPDATE "appointments" SET "location_id" = (SELECT "id" FROM "locations" WHERE "slug" = 'valparaiso') WHERE "location_id" IS NULL;--> statement-breakpoint
UPDATE "business_hours" SET "location_id" = (SELECT "id" FROM "locations" WHERE "slug" = 'valparaiso') WHERE "location_id" IS NULL;--> statement-breakpoint
UPDATE "time_off" SET "location_id" = (SELECT "id" FROM "locations" WHERE "slug" = 'valparaiso') WHERE "location_id" IS NULL;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "location_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "business_hours" ALTER COLUMN "location_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "time_off" ALTER COLUMN "location_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_hours_location_weekday_idx" ON "business_hours" USING btree ("location_id","weekday");
