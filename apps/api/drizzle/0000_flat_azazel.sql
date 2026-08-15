CREATE TYPE "public"."appointment_status" AS ENUM('pending_payment', 'pending_approval', 'confirmed', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."email_job_kind" AS ENUM('booking_received', 'booking_confirmed', 'reminder_24h', 'reminder_2h', 'rescheduled', 'cancelled', 'admin_new_booking');--> statement-breakpoint
CREATE TYPE "public"."email_job_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('deposit', 'full', 'balance');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'rejected', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."service_kind" AS ENUM('service', 'course');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" varchar(32) NOT NULL,
	"customer_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"blocked_until" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'pending_approval' NOT NULL,
	"price_clp" integer NOT NULL,
	"amount_paid_clp" integer DEFAULT 0 NOT NULL,
	"cancel_token" varchar(64) NOT NULL,
	"customer_notes" text,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(120) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "email_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer,
	"kind" "email_job_kind" NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"status" "email_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(120),
	"phone" varchar(20),
	"service_id" integer,
	"step" varchar(40) NOT NULL,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"external_id" varchar(64),
	"kind" "payment_kind" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount_clp" integer NOT NULL,
	"raw_payload" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(120) NOT NULL,
	"title" varchar(160) NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"cover_image_url" varchar(500),
	"meta_title" varchar(70),
	"meta_description" varchar(160),
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "scheduling_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"slot_granularity_min" integer DEFAULT 30 NOT NULL,
	"min_lead_time_hours" integer DEFAULT 12 NOT NULL,
	"max_advance_days" integer DEFAULT 60 NOT NULL,
	"auto_approve" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(140) NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"long_description" text,
	"kind" "service_kind" DEFAULT 'service' NOT NULL,
	"duration_min" integer NOT NULL,
	"buffer_min" integer DEFAULT 0 NOT NULL,
	"price_clp" integer DEFAULT 0 NOT NULL,
	"deposit_clp" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"image_url" varchar(500),
	"meta_title" varchar(70),
	"meta_description" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "time_off" (
	"id" serial PRIMARY KEY NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "totp_challenges" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" text,
	"role" "role" DEFAULT 'user' NOT NULL,
	"password_hash" varchar(120),
	"totp_secret" varchar(120),
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"backup_codes" text[],
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_signed_in" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "totp_challenges" ADD CONSTRAINT "totp_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_starts_at_idx" ON "appointments" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "appointments_status_starts_at_idx" ON "appointments" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_customer_idx" ON "appointments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "business_hours_weekday_idx" ON "business_hours" USING btree ("weekday");--> statement-breakpoint
CREATE INDEX "email_jobs_pending_idx" ON "email_jobs" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "email_jobs_appointment_kind_key" ON "email_jobs" USING btree ("appointment_id","kind");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "payments_appointment_idx" ON "payments" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "posts_published_idx" ON "posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "services_active_sort_idx" ON "services" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX "time_off_range_idx" ON "time_off" USING btree ("starts_at","ends_at");