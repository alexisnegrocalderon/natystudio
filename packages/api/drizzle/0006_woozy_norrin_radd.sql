CREATE TABLE "mercado_pago_connection" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"seller_access_token" varchar(300) NOT NULL,
	"seller_refresh_token" varchar(300) NOT NULL,
	"seller_user_id" varchar(60) NOT NULL,
	"seller_email" varchar(320),
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fee_clp" integer DEFAULT 0 NOT NULL;