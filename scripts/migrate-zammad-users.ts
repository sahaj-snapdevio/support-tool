/**
 * One-off migration: Zammad staff accounts → Support Tool `user` rows.
 *
 * Companion to migrate-zammad.ts, which deliberately skips agent accounts
 * (historical replies keep the agent's name as plain text, authorId stays
 * null). This script:
 *
 *   1. Finds every Zammad user with the Agent or Admin role (customers are
 *      left alone — they stay as inline name/email on tickets).
 *   2. Creates a Support Tool `user` row for each one that doesn't already
 *      exist (matched by email), with a SHARED DEFAULT PASSWORD — everyone
 *      lands as a plain agent regardless of their Zammad role; promote
 *      specific people to admin afterward with `pnpm make:admin <email>`.
 *   3. Backfills `ticket_comments.author_id` / `ticket_attachments.uploaded_by_id`
 *      for rows still missing one, matching on `author_name`/`uploaded_by_name`
 *      (only Zammad's display name was ever persisted per-comment, not a
 *      Zammad user id) — so this is a best-effort name match, not a wired
 *      Zammad-id join. Two different Zammad staff sharing a display name
 *      would misattribute; fine for a small team, logged either way.
 *
 * SECURITY NOTE: every created account shares MIGRATION_USER_PASSWORD
 * (default below). Tell the team to change it after first login — this
 * script does not email anyone or force a reset.
 *
 * IDEMPOTENT: safe to re-run — users are matched by email (skipped if they
 * already exist), and the backfill only ever touches rows where author_id /
 * uploaded_by_id is still null.
 *
 * Required env: ZAMMAD_BASE_URL, ZAMMAD_API_TOKEN  (+ the app's own DATABASE_URL etc.)
 * Optional env:
 *   MIGRATION_USER_PASSWORD   shared password for every created account
 *                             (default "debutify@123456")
 *   MIGRATION_DRY_RUN         "1" → read + log only, write nothing
 */

import { and, count, eq, isNull } from "drizzle-orm";
import { AGENT_ROLE } from "@/config/platform";
import { ticketAttachments, ticketComments, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db, dbClient } from "@/lib/db";

// Host/dev runs load .env via `tsx --env-file-if-exists=.env` (see the
// migrate:zammad:users script in package.json) — it must happen before this
// file's first import, since @/lib/db reads process.env.DATABASE_URL at
// module load time, and ESM imports are hoisted ahead of any top-level
// statement placed here.

// ── Config ──────────────────────────────────────────────────────────────────
const ZAMMAD_BASE_URL = (process.env.ZAMMAD_BASE_URL ?? "").replace(/\/+$/, "");
const ZAMMAD_API_TOKEN = process.env.ZAMMAD_API_TOKEN ?? "";
const DEFAULT_PASSWORD =
  process.env.MIGRATION_USER_PASSWORD ?? "debutify@123456";
const DRY_RUN = process.env.MIGRATION_DRY_RUN === "1";
const PER_PAGE = 100;

if (!(ZAMMAD_BASE_URL && ZAMMAD_API_TOKEN)) {
  console.error(
    "Missing ZAMMAD_BASE_URL and/or ZAMMAD_API_TOKEN. See the header of this file."
  );
  process.exit(1);
}

if (DEFAULT_PASSWORD.length < 8) {
  console.error("MIGRATION_USER_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

// ── Zammad REST client (global fetch) ─────────────────────────────────────────
const ZAMMAD_HEADERS = {
  Authorization: `Token token=${ZAMMAD_API_TOKEN}`,
  "Content-Type": "application/json",
};

async function zammadGet<T>(
  pathname: string,
  params?: Record<string, string | number>
): Promise<T> {
  const url = new URL(`${ZAMMAD_BASE_URL}/api/v1${pathname}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: ZAMMAD_HEADERS });
  if (!res.ok) {
    throw new Error(`Zammad GET ${pathname} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

// ── Zammad shapes (only the fields we read) ───────────────────────────────────
interface ZRole {
  id: number;
  name: string;
}
interface ZUser {
  email?: string;
  firstname?: string;
  id: number;
  lastname?: string;
  login?: string;
  role_ids?: number[];
}

function zUserName(u: ZUser): string {
  const name = `${u.firstname ?? ""} ${u.lastname ?? ""}`.trim();
  return name || u.email || u.login || `Zammad user ${u.id}`;
}

// Zammad role name → id. Falls back to the stock seed ids (1 Admin, 2 Agent)
// if the roles endpoint is unreachable — same defensive pattern as
// migrate-zammad.ts's loadStateMap/loadPriorityMap.
async function resolveStaffRoleIds(): Promise<Set<number>> {
  try {
    const roles = await zammadGet<ZRole[]>("/roles");
    const ids = roles
      .filter((r) => /admin|agent/i.test(r.name))
      .map((r) => r.id);
    if (ids.length > 0) {
      return new Set(ids);
    }
  } catch (err) {
    console.warn(`  ! could not fetch Zammad roles: ${(err as Error).message}`);
  }
  return new Set([1, 2]);
}

async function* iterateZammadUsers(): AsyncGenerator<ZUser> {
  let page = 1;
  for (;;) {
    const batch = await zammadGet<ZUser[]>("/users", {
      page,
      per_page: PER_PAGE,
    });
    if (!Array.isArray(batch) || batch.length === 0) {
      return;
    }
    for (const u of batch) {
      yield u;
    }
    if (batch.length < PER_PAGE) {
      return;
    }
    page += 1;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface StaffMember {
  email: string;
  name: string;
  // null only in dry-run for a user that doesn't exist yet (no id to assign).
  userId: string | null;
}

async function main() {
  console.log(
    `\nZammad → Support Tool user migration${DRY_RUN ? " (DRY RUN — no writes)" : ""}`
  );
  console.log(`  source: ${ZAMMAD_BASE_URL}\n`);

  const staffRoleIds = await resolveStaffRoleIds();

  let seen = 0;
  let created = 0;
  let skippedExisting = 0;
  let skippedNoEmail = 0;
  const staff: StaffMember[] = [];

  for await (const zUser of iterateZammadUsers()) {
    const roleIds = zUser.role_ids ?? [];
    if (!roleIds.some((id) => staffRoleIds.has(id))) {
      continue; // not agent/admin in Zammad — leave as an inline ticket customer
    }
    seen += 1;

    const email = (zUser.email ?? "").trim().toLowerCase();
    const name = zUserName(zUser);

    if (!email) {
      console.warn(
        `  ! skipping "${name}" (Zammad id ${zUser.id}) — no email.`
      );
      skippedNoEmail += 1;
      continue;
    }

    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existing) {
      skippedExisting += 1;
      staff.push({ name, email, userId: existing.id });
      console.log(
        `  = ${name} <${email}> already exists — will still backfill.`
      );
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] would create ${name} <${email}> as agent.`);
      created += 1;
      staff.push({ name, email, userId: null });
      continue;
    }

    const result = await auth.api.signUpEmail({
      body: { email, name, password: DEFAULT_PASSWORD },
    });
    await db
      .update(user)
      .set({ role: AGENT_ROLE, emailVerified: true, updatedAt: new Date() })
      .where(eq(user.id, result.user.id));

    staff.push({ name, email, userId: result.user.id });
    created += 1;
    console.log(`  ✓ created ${name} <${email}>`);
  }

  // ── Backfill: connect historical comments/attachments to the new users ──────
  // Dry run previews the same match (count only, no write) so the operator can
  // see what a real run would connect before committing to it.
  let commentsConnected = 0;
  let attachmentsConnected = 0;

  for (const s of staff) {
    const nameMatch = eq(ticketComments.authorName, s.name);
    const attachmentNameMatch = eq(ticketAttachments.uploadedByName, s.name);

    if (DRY_RUN || !s.userId) {
      const [{ n: commentCount }] = await db
        .select({ n: count() })
        .from(ticketComments)
        .where(
          and(
            isNull(ticketComments.authorId),
            eq(ticketComments.authorRole, AGENT_ROLE),
            nameMatch
          )
        );
      const [{ n: attachmentCount }] = await db
        .select({ n: count() })
        .from(ticketAttachments)
        .where(
          and(
            isNull(ticketAttachments.uploadedById),
            eq(ticketAttachments.uploadedByRole, AGENT_ROLE),
            attachmentNameMatch
          )
        );

      commentsConnected += commentCount;
      attachmentsConnected += attachmentCount;
      if (commentCount > 0 || attachmentCount > 0) {
        console.log(
          `  [dry-run] would connect ${s.name}: ${commentCount} comment(s), ` +
            `${attachmentCount} attachment(s)`
        );
      }
      continue;
    }

    const connectedComments = await db
      .update(ticketComments)
      .set({ authorId: s.userId })
      .where(
        and(
          isNull(ticketComments.authorId),
          eq(ticketComments.authorRole, AGENT_ROLE),
          nameMatch
        )
      )
      .returning({ id: ticketComments.id });

    const connectedAttachments = await db
      .update(ticketAttachments)
      .set({ uploadedById: s.userId })
      .where(
        and(
          isNull(ticketAttachments.uploadedById),
          eq(ticketAttachments.uploadedByRole, AGENT_ROLE),
          attachmentNameMatch
        )
      )
      .returning({ id: ticketAttachments.id });

    commentsConnected += connectedComments.length;
    attachmentsConnected += connectedAttachments.length;

    if (connectedComments.length > 0 || connectedAttachments.length > 0) {
      console.log(
        `  ↳ ${s.name}: connected ${connectedComments.length} comment(s), ` +
          `${connectedAttachments.length} attachment(s)`
      );
    }
  }

  console.log("\n──────── Summary ────────");
  console.log(`  Zammad staff seen:        ${seen}`);
  console.log(`  users created:            ${created}`);
  console.log(`  skipped (already existed):${skippedExisting}`);
  console.log(`  skipped (no email):       ${skippedNoEmail}`);
  console.log(`  comments connected:       ${commentsConnected}`);
  console.log(`  attachments connected:    ${attachmentsConnected}`);
  if (!DRY_RUN && created > 0) {
    console.log(
      "\n  Every created account shares the password set in MIGRATION_USER_PASSWORD " +
        `(default "debutify@123456") — tell the team to change it after first login.`
    );
  }
  console.log("");
}

main()
  .then(async () => {
    await dbClient.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("\nMigration aborted:", err);
    await dbClient.end().catch(() => undefined);
    process.exit(1);
  });

/*
 * ──────────────────────────── HOW TO RUN ────────────────────────────
 *
 * 1) DRY RUN first (reads Zammad, writes nothing — verify counts):
 *
 *    docker compose exec \
 *      -e ZAMMAD_BASE_URL="https://your-zammad.example.com" \
 *      -e ZAMMAD_API_TOKEN="your-admin-api-token" \
 *      -e MIGRATION_DRY_RUN=1 \
 *      app pnpm migrate:zammad:users
 *
 * 2) REAL run (safe to re-run — existing users are skipped, not duplicated):
 *
 *    docker compose exec \
 *      -e ZAMMAD_BASE_URL="https://your-zammad.example.com" \
 *      -e ZAMMAD_API_TOKEN="your-admin-api-token" \
 *      app pnpm migrate:zammad:users
 *
 *    Optional: different shared password →
 *      -e MIGRATION_USER_PASSWORD="something-else-8-chars-plus"
 *
 * Not using Docker (host / dev, with the app's .env present):
 *    ZAMMAD_BASE_URL=... ZAMMAD_API_TOKEN=... pnpm migrate:zammad:users
 */
