CREATE TABLE "user_ticket_table_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"columns" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_ticket_table_prefs" ADD CONSTRAINT "user_ticket_table_prefs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;