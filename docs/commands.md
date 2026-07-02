# Commands

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm db:local        # start local embedded postgres (dev only)
pnpm setup           # validate env, migrate, seed defaults, create first admin
pnpm dev             # start Next.js + worker concurrently
```

Open `http://localhost:3000`.

`pnpm setup` is the guided one-shot bootstrap — it runs `db:migrate` + `db:seed`,
then creates the first admin if `FIRST_ADMIN_EMAIL` (and optionally
`FIRST_ADMIN_NAME` / `FIRST_ADMIN_PASSWORD`) is set in `.env`. Safe to re-run.

If you'd rather do it manually, or need to create/promote an account later:

```bash
# Create a brand-new admin with a password — signs in immediately, no SMTP needed
pnpm create:admin you@example.com "Your Name" "a-strong-password"

# Create a magic-link-only admin (no password — requires SMTP to sign in)
pnpm create:admin you@example.com "Your Name"

# Promote an account that already signed in via magic link / Google
pnpm make:admin you@example.com
```

---

## Development

```bash
pnpm dev             # Next.js (turbopack) + pg-boss worker (concurrently)
pnpm dev:next        # Next.js only
pnpm worker          # pg-boss worker only (watch mode)
pnpm typecheck       # TypeScript type check
pnpm lint            # biome lint check
pnpm lint:fix        # biome lint + auto-fix
pnpm format          # biome format
```

---

## Database

```bash
pnpm db:local        # start embedded postgres for local dev
pnpm db:generate     # generate migration from schema changes
pnpm db:migrate      # apply pending migrations
pnpm db:seed         # seed default ticket statuses & categories (idempotent)
pnpm db:push         # push schema directly (dev only — skips migration file)
pnpm db:reset        # drop all tables + re-migrate (destroys all data)
```

---

## Docker

```bash
docker compose up -d           # start app + worker + postgres
docker compose down            # stop all services
docker compose logs -f app     # tail app logs
docker compose logs -f worker  # tail worker logs
```

Build the worker image separately:

```bash
docker build -f Dockerfile.worker -t support-tool-worker .
```
