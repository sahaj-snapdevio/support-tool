import { randomUUID } from "node:crypto";
import { emailOutbox } from "@/db/schema";
import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/worker/enqueue";
import { JOB_NAMES } from "@/lib/worker/job-types";

export interface SendEmailOptions {
  html: string;
  subject: string;
  text?: string;
  to: string;
}

export async function enqueueEmail(options: SendEmailOptions) {
  // Dev convenience: surface any links inside the email in the server console
  // so you can click them without opening your inbox. Never runs in production.
  if (process.env.NODE_ENV !== "production") {
    logEmailLinks(options);
  }

  const [row] = await db
    .insert(emailOutbox)
    .values({
      idempotencyKey: randomUUID(),
      payload: options,
      status: "queued",
    })
    .returning({ id: emailOutbox.id });

  await enqueueJob(JOB_NAMES.EMAIL_SEND, { outboxId: row.id });
}

function logEmailLinks({ to, subject, html, text }: SendEmailOptions) {
  const links = new Set<string>();

  // Bare URLs in the plain-text part (templates put the actionable link here).
  for (const m of (text ?? "").matchAll(/https?:\/\/[^\s<>"')]+/g)) {
    links.add(m[0]);
  }
  // href="..." targets in the HTML part (fallback / extra coverage).
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    links.add(m[1]);
  }

  if (links.size === 0) return;

  console.log(
    `\n📧 [email] "${subject}" → ${to}\n` +
      [...links].map((l) => `   🔗 ${l}`).join("\n") +
      "\n"
  );
}
