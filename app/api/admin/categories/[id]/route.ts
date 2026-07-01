import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ticketCategories, tickets } from "@/db/schema";
import { requireAdminFromRequest } from "@/lib/authz";

// PATCH — admin only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { requireAdminFromRequest(request); } catch (e) { return e as Response; }

  const { id } = await params;

  let body: { label?: string; color?: string; sortOrder?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(ticketCategories)
    .where(eq(ticketCategories.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const now = new Date();
  const updateData: Partial<typeof ticketCategories.$inferInsert> & { updatedAt: Date } = {
    updatedAt: now,
  };
  if (body.label !== undefined) updateData.label = body.label.trim();
  if (body.color !== undefined) updateData.color = body.color;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

  const [updated] = await db
    .update(ticketCategories)
    .set(updateData)
    .where(eq(ticketCategories.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE — admin only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { requireAdminFromRequest(request); } catch (e) { return e as Response; }

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(ticketCategories)
    .where(eq(ticketCategories.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Check ticket usage
  const [{ total: ticketCount }] = await db
    .select({ total: count() })
    .from(tickets)
    .where(eq(tickets.category, existing.slug));

  if (Number(ticketCount) > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${ticketCount} ticket(s) use this category.` },
      { status: 400 }
    );
  }

  // Check if it's the last category
  const [{ total: catCount }] = await db
    .select({ total: count() })
    .from(ticketCategories);
  if (Number(catCount) <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the only category." },
      { status: 400 }
    );
  }

  await db.delete(ticketCategories).where(eq(ticketCategories.id, id));
  return NextResponse.json({ ok: true });
}
