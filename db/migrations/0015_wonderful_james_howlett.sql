CREATE TABLE "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"subject" text,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_type_unique" UNIQUE("type")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "portal_url_template" text;