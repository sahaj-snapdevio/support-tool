import { createId } from "@paralleldrive/cuid2";
import { APIError } from "better-auth/api";
import { count, eq, ilike, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdminFromRequest } from "@/lib/authz";
import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email";
import { userInvitedTemplate } from "@/lib/email/templates/user-invited";
import { env } from "@/lib/env";
import { createPasswordSetupToken } from "@/lib/password-setup-token";
import {
  getPlatformSettings,
  resolveBrandName,
  resolveLogoUrl,
} from "@/lib/settings";

// GET /api/users — list all users (admin only)
export async function GET(request: NextRequest) {
  try {
    requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10)
  );
  const PAGE_SIZE = 25;

  const where = q
    ? or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`))
    : undefined;

  const [users, [{ total }]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(where)
      .orderBy(user.createdAt)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(user).where(where),
  ]);

  return NextResponse.json({
    users,
    total,
    page,
    pageCount: Math.ceil(total / PAGE_SIZE),
  });
}

// POST /api/users — invite a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  let body: { name?: string; email?: string; role?: string; password?: string };
  try {
    body = (await request.json()) as {
      name?: string;
      email?: string;
      role?: string;
      password?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const role = body.role?.trim() ?? AGENT_ROLE;
  const password = body.password;

  if (!name || name.length < 2 || name.length > 100) {
    return NextResponse.json(
      { error: "Name must be 2–100 characters." },
      { status: 400 }
    );
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address." },
      { status: 400 }
    );
  }
  if (role !== AGENT_ROLE && role !== ADMIN_ROLE) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const settings = await getPlatformSettings();

  // A password can be set directly instead of emailing an invite — the
  // primary use case is deployments with no SMTP configured, where an
  // emailed invite would never arrive and the agent could never sign in.
  if (password !== undefined) {
    if (!settings.passwordLoginEnabled) {
      return NextResponse.json(
        { error: "Password sign-in is disabled." },
        { status: 403 }
      );
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: "Password must be 8–128 characters." },
        { status: 400 }
      );
    }
  }

  // Check for duplicate email
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists." },
      { status: 409 }
    );
  }

  const now = new Date();
  const newId = createId();

  await db.insert(user).values({
    id: newId,
    name,
    email,
    emailVerified: true,
    role,
    banned: false,
    createdAt: now,
    updatedAt: now,
  });

  if (password !== undefined) {
    try {
      await auth.api.setUserPassword({
        headers: request.headers,
        body: { userId: newId, newPassword: password },
      });
    } catch (e) {
      // Roll back the user row so the failed attempt doesn't leave behind
      // a password-less pending user the admin didn't ask for.
      await db.delete(user).where(eq(user.id, newId));
      if (e instanceof APIError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.statusCode }
        );
      }
      return NextResponse.json(
        { error: "Failed to set password." },
        { status: 500 }
      );
    }
    return NextResponse.json({ id: newId }, { status: 201 });
  }

  // Send invitation email (fire-and-forget). If password login is enabled,
  // the primary CTA sets up a password (the invitee has no credential
  // account yet) via the same verification-row mechanism Better Auth's own
  // reset-password flow uses — see lib/password-setup-token.ts. Otherwise
  // (magic-link/Google-only shops) the plain /login link already works
  // since the user row itself is enough for those methods to find them.
  const signInUrl = `${env.NEXT_PUBLIC_APP_URL}/login`;
  (async () => {
    const appName = resolveBrandName(settings.brandName);
    const logoUrl = resolveLogoUrl(settings.logoKey, true);
    const passwordSetupUrl = settings.passwordLoginEnabled
      ? `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${await createPasswordSetupToken(newId)}`
      : undefined;

    const { html, text } = await userInvitedTemplate({
      inviteeName: name,
      role,
      signInUrl,
      appName,
      logoUrl,
      passwordSetupUrl,
    });

    await enqueueEmail({
      to: email,
      subject: `You've been invited to ${appName}`,
      html,
      text,
    });
  })().catch((err) => console.error("[user.invited email]", err));

  return NextResponse.json({ id: newId }, { status: 201 });
}
