import { existsSync } from "node:fs";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { ADMIN_ROLE } from "@/config/platform";

if (existsSync(".env")) {
  process.loadEnvFile();
}

async function main() {
  const email = process.argv[2];
  const name = process.argv[3];

  if (!email || !name) {
    console.error("Usage: pnpm create:admin <email> <name>");
    console.error('Example: pnpm create:admin admin@example.com "Jane Smith"');
    process.exit(1);
  }

  const [{ db }, { user }] = await Promise.all([
    import("@/lib/db"),
    import("@/db/schema"),
  ]);

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing) {
    console.error(`A user with email ${email} already exists. Use pnpm make:admin to promote them.`);
    process.exit(1);
  }

  const now = new Date();
  const [created] = await db
    .insert(user)
    .values({
      id: createId(),
      email,
      name,
      emailVerified: true,
      role: ADMIN_ROLE,
      banned: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ email: user.email, name: user.name, role: user.role });

  console.log(`Created admin: ${created.name} <${created.email}>`);
  console.log("They can sign in at /login using a magic link.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
