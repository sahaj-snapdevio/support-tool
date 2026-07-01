# Commands

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm db:local        # start local embedded postgres (dev only)
pnpm db:migrate      # apply all pending migrations
pnpm dev             # start Next.js + worker concurrently
```

Open `http://localhost:3000`.

Promote an account to admin after signing in:

```bash
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
