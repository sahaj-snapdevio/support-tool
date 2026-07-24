import { and, eq, notExists } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { session as sessionTable, user } from "@/db/schema";
import { audit } from "@/lib/audit";
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

// POST /api/users/[id]/resend-invite — resend the invitation email to a
// user who hasn't accepted (signed in) yet (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let adminUser;
  try {
    adminUser = requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const { id } = await params;

  const [target] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(
      and(
        eq(user.id, id),
        notExists(
          db
            .select({ id: sessionTable.id })
            .from(sessionTable)
            .where(eq(sessionTable.userId, id))
        )
      )
    )
    .limit(1);

  if (!target) {
    return NextResponse.json(
      { error: "Invitation not found or already accepted." },
      { status: 404 }
    );
  }

  const settings = await getPlatformSettings();
  const appName = resolveBrandName(settings.brandName);
  const logoUrl = resolveLogoUrl(settings.logoKey, true);
  const signInUrl = `${env.NEXT_PUBLIC_APP_URL}/login`;
  const passwordSetupUrl = settings.passwordLoginEnabled
    ? `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${await createPasswordSetupToken(target.id)}`
    : undefined;

  const { html, text } = await userInvitedTemplate({
    inviteeName: target.name,
    role: target.role,
    signInUrl,
    appName,
    logoUrl,
    passwordSetupUrl,
  });

  await enqueueEmail({
    to: target.email,
    subject: `You've been invited to ${appName}`,
    html,
    text,
  });

  await audit({
    action: "user.invite_resent",
    actorEmail: adminUser.email,
    actorId: adminUser.id,
    description: `Invitation resent to ${target.email}`,
    entityId: target.id,
    entityType: "user",
    metadata: { email: target.email },
  });

  return NextResponse.json({ ok: true });
}
