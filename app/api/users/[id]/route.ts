import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { user, session, account } from "@/db/schema";
import { tickets } from "@/db/schema/tickets";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";
import { requireAdminFromRequest } from "@/lib/authz";

async function getAdminCount() {
  const [{ total }] = await db
    .select({ total: count() })
    .from(user)
    .where(eq(user.role, ADMIN_ROLE));
  return total;
}

// PATCH /api/users/[id] — update role or ban status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let adminUser;
  try { adminUser = requireAdminFromRequest(request); } catch (e) { return e as Response; }

  const { id } = await params;

  const [target] = await db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  let body: { role?: string; banned?: boolean; banReason?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const now = new Date();

  // Role change
  if (body.role !== undefined) {
    if (body.role !== AGENT_ROLE && body.role !== ADMIN_ROLE) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    // Last admin protection: cannot demote the only admin
    if (target.role === ADMIN_ROLE && body.role !== ADMIN_ROLE) {
      const adminCount = await getAdminCount();
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last admin. Promote another user first." },
          { status: 422 }
        );
      }
    }

    await db.update(user).set({ role: body.role, updatedAt: now }).where(eq(user.id, id));
    return NextResponse.json({ ok: true });
  }

  // Ban / unban
  if (body.banned !== undefined) {
    // Cannot ban yourself
    if (id === adminUser.id && body.banned) {
      return NextResponse.json({ error: "You cannot ban yourself." }, { status: 422 });
    }

    await db
      .update(user)
      .set({
        banned: body.banned,
        banReason: body.banned ? (body.banReason ?? null) : null,
        updatedAt: now,
      })
      .where(eq(user.id, id));

    // Revoke all active sessions on ban
    if (body.banned) {
      await db.delete(session).where(eq(session.userId, id));
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "No valid field to update." }, { status: 400 });
}

// DELETE /api/users/[id] — hard delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { requireAdminFromRequest(request); } catch (e) { return e as Response; }

  const { id } = await params;

  const [target] = await db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Last admin protection
  if (target.role === ADMIN_ROLE) {
    const adminCount = await getAdminCount();
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last admin." },
        { status: 422 }
      );
    }
  }

  // Unassign tickets
  await db
    .update(tickets)
    .set({ assignedAgentId: null, updatedAt: new Date() })
    .where(eq(tickets.assignedAgentId, id));

  // Delete sessions, accounts, then user (cascade handles sessions + accounts too, but explicit is clearer)
  await db.delete(session).where(eq(session.userId, id));
  await db.delete(account).where(eq(account.userId, id));
  await db.delete(user).where(eq(user.id, id));

  return NextResponse.json({ ok: true });
}
