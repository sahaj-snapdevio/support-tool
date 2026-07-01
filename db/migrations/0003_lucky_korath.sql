ALTER TABLE "tickets" ADD COLUMN "awaiting_reply" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "pending_replies" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "tickets_awaiting_reply_idx" ON "tickets" USING btree ("awaiting_reply");--> statement-breakpoint
-- Backfill: flag open tickets whose latest public message is from the customer,
-- and count unanswered customer messages since the last agent reply.
UPDATE "tickets" t SET
  "awaiting_reply" = true,
  "pending_replies" = GREATEST(1, (
    SELECT count(*) FROM "ticket_comments" c
    WHERE c."ticket_id" = t."id"
      AND c."is_internal" = false
      AND c."author_role" = 'customer'
      AND c."created_at" > COALESCE((
        SELECT max(c2."created_at") FROM "ticket_comments" c2
        WHERE c2."ticket_id" = t."id"
          AND c2."is_internal" = false
          AND c2."author_role" IN ('agent', 'admin')
      ), '-infinity')
  ))
WHERE t."status" NOT IN (SELECT "slug" FROM "ticket_statuses" WHERE "is_closed_state" = true)
  AND COALESCE((
    SELECT c."author_role" FROM "ticket_comments" c
    WHERE c."ticket_id" = t."id" AND c."is_internal" = false
    ORDER BY c."created_at" DESC LIMIT 1
  ), 'customer') = 'customer';