import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/db/schema/auth";

// GET — agent/admin can read (middleware already enforced access)
export async function GET(_request: NextRequest) {
  const agents = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(or(eq(user.role, "agent"), eq(user.role, "admin")));

  return NextResponse.json(agents);
}
