ALTER TABLE "platform_settings" ADD COLUMN "password_login_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "magic_link_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "google_login_enabled" boolean DEFAULT true NOT NULL;