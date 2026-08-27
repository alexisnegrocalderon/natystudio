ALTER TABLE "services" ADD COLUMN "deposit_percent" integer DEFAULT 60 NOT NULL;
--> statement-breakpoint
-- Backfill desde el monto fijo anterior: donde había un abono y un precio
-- reales, se calcula el % equivalente (acotado 1-100); el resto se queda en
-- el default de 60%.
UPDATE "services"
SET "deposit_percent" = LEAST(100, GREATEST(1, ROUND("deposit_clp"::numeric / NULLIF("price_clp", 0) * 100)))
WHERE "deposit_clp" > 0 AND "price_clp" > 0;
--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "deposit_clp";
--> statement-breakpoint
CREATE TABLE "appointment_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"price_clp" integer NOT NULL,
	"deposit_percent" integer NOT NULL,
	"duration_min" integer NOT NULL,
	"buffer_min" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "appointment_services_appointment_idx" ON "appointment_services" USING btree ("appointment_id");
--> statement-breakpoint
-- Backfill: toda cita existente hasta ahora tenía exactamente un servicio
-- (appointments.service_id), así que se refleja acá con el precio/duración
-- que ya tenía guardados la propia cita — no hace falta ir a buscar el
-- precio actual del servicio, que puede haber cambiado desde entonces.
INSERT INTO "appointment_services" ("appointment_id", "service_id", "price_clp", "deposit_percent", "duration_min", "buffer_min")
SELECT a."id", a."service_id", a."price_clp", COALESCE(s."deposit_percent", 60), COALESCE(EXTRACT(EPOCH FROM (a."ends_at" - a."starts_at")) / 60, s."duration_min")::int, s."buffer_min"
FROM "appointments" a
JOIN "services" s ON s."id" = a."service_id";
