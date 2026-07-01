import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";
import { user } from "@/db/schema";
import { requireSession } from "@/lib/authz";
import { db } from "@/lib/db";

export default async function PostAuthPage() {
  const session = await requireSession();
  const [freshUser] = await db
    .select({ role: user.role, banned: user.banned })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!freshUser || freshUser.banned) redirect("/login");

  if (freshUser.role === ADMIN_ROLE) redirect("/tickets");
  if (freshUser.role === AGENT_ROLE) redirect("/tickets");

  // No role assigned yet — show a pending access page
  redirect("/unauthorized");
}
