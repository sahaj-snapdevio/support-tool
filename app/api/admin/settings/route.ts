import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { platformSettings } from "@/db/schema/settings";
import { requireAdminFromRequest } from "@/lib/authz";

const VALID_THEMES = new Set(["default", "ocean", "forest", "sunset", "indigo", "slate"]);
const VALID_APPEARANCES = new Set(["light", "dark", "auto"]);

// GET — agent/admin can read (middleware already enforced access)
export async function GET(_request: NextRequest) {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, "default"))
    .limit(1);

  return NextResponse.json({
    theme: row?.theme ?? "default",
    appearanceMode: row?.appearanceMode ?? "auto",
  });
}

// PATCH — admin only
export async function PATCH(request: NextRequest) {
  try { requireAdminFromRequest(request); } catch (e) { return e as Response; }

  let body: { theme?: string; appearanceMode?: string };
  try {
    body = (await request.json()) as { theme?: string; appearanceMode?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const theme = body.theme ?? "default";
  const appearanceMode = body.appearanceMode ?? "auto";

  if (!VALID_THEMES.has(theme)) {
    return NextResponse.json({ error: "Invalid theme." }, { status: 400 });
  }
  if (!VALID_APPEARANCES.has(appearanceMode)) {
    return NextResponse.json({ error: "Invalid appearance mode." }, { status: 400 });
  }

  const now = new Date();

  await db
    .insert(platformSettings)
    .values({ id: "default", theme, appearanceMode, updatedAt: now })
    .onConflictDoUpdate({
      target: platformSettings.id,
      set: { theme, appearanceMode, updatedAt: now },
    });

  return NextResponse.json({ theme, appearanceMode });
}
