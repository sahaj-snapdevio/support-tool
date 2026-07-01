import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings } from "@/db/schema/settings";

export async function getPlatformSettings() {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, "default"))
    .limit(1);
  return row ?? { theme: "default", appearanceMode: "auto" as const };
}
