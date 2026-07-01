import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { tickets } from "@/db/schema";
import { env } from "@/lib/env";
import { signEmailToken } from "@/lib/customer-access";

export async function POST(request: NextRequest) {
  let body: { email?: string } = {};
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  // Fetch non-closed tickets for this email
  const customerTickets = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      status: tickets.status,
      customerToken: tickets.customerToken,
    })
    .from(tickets)
    .where(eq(tickets.customerEmail, email));

  // TODO: enqueue email job containing the single "My Tickets" list link.
  // For now: silently succeed (prevents email enumeration).
  console.log(`[my-tickets] ${customerTickets.length} ticket(s) found for ${email}`);
  if (customerTickets.length > 0) {
    const listUrl = `${env.NEXT_PUBLIC_APP_URL}/my-tickets/${signEmailToken(email)}`;
    console.log(`[my-tickets] list link for ${email} → ${listUrl}`);
  }

  // Always return the same response regardless of whether tickets exist
  return NextResponse.json({ ok: true });
}
