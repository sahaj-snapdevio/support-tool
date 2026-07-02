/**
 * Guided first-run setup.
 *
 *   pnpm setup
 *
 * Validates required environment variables, runs database migrations, seeds the
 * default ticket statuses & categories, and (optionally) creates the first admin
 * user from FIRST_ADMIN_EMAIL / FIRST_ADMIN_NAME / FIRST_ADMIN_PASSWORD.
 *
 * Safe to re-run: migrations and seeds are idempotent.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile();
}

function run(cmd: string) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  const REQUIRED = [
    "DATABASE_URL",
    "APP_SECRET",
    "NEXT_PUBLIC_APP_URL",
  ] as const;
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `\n✗ Missing required environment variables: ${missing.join(", ")}\n` +
        "  Copy .env.example to .env and fill these in (APP_SECRET must be at least 32 characters)."
    );
    process.exit(1);
  }

  console.log("→ Running database migrations…");
  run("pnpm db:migrate");

  console.log("\n→ Seeding default statuses & categories…");
  run("pnpm db:seed");

  const adminEmail = process.env.FIRST_ADMIN_EMAIL;
  const adminName = process.env.FIRST_ADMIN_NAME ?? "Admin";
  const adminPassword = process.env.FIRST_ADMIN_PASSWORD;

  if (adminEmail) {
    console.log(`\n→ Creating first admin (${adminEmail})…`);
    // Called in-process (not shelled out to `pnpm create:admin`) so a
    // password with shell-special characters can never be mangled by
    // argument quoting — this bit us on Windows with execFileSync+shell.
    try {
      const { createAdminUser } = await import("@/lib/bootstrap-admin");
      await createAdminUser({
        email: adminEmail,
        name: adminName,
        password: adminPassword,
      });
      console.log(`  Created admin: ${adminName} <${adminEmail}>.`);
    } catch (error) {
      console.log(
        `  Admin already exists or could not be created — skipping. (${error instanceof Error ? error.message : error})`
      );
    }
  } else {
    console.log(
      "\nℹ No FIRST_ADMIN_EMAIL set. Create an admin later with:\n" +
        '  pnpm create:admin you@example.com "Your Name" "your-password"'
    );
  }

  console.log(
    "\n✅ Setup complete. Start the app with `pnpm start` (and the worker with `pnpm worker:start`)."
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
