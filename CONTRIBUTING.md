# Contributing to Support Tool

Thanks for your interest in contributing! This is an open-source, self-hostable
customer support ticketing system built with Next.js, Drizzle ORM, and Postgres.

## Getting started

**Prerequisites:** Node.js 22+, pnpm 11+, and either Docker or a local Postgres.

```bash
git clone <your-fork-url>
cd support-tool
pnpm install
cp .env.example .env          # fill in APP_SECRET (32+ chars) and NEXT_PUBLIC_APP_URL
```

You can run Postgres locally without Docker using the embedded dev database:

```bash
pnpm db:local                 # starts an embedded Postgres on port 54329
pnpm db:migrate               # apply migrations
pnpm db:seed                  # seed default statuses & categories
pnpm create:admin you@example.com "Your Name"
pnpm dev                      # runs Next.js + the background worker together
```

Open http://localhost:3000.

## Project layout

```
app/            Next.js App Router
  (customer)/   public customer portal (submit / track tickets)
  (agent)/      agent portal (ticket queue, detail, dashboard)
  (admin)/      admin portal (users, appearance, ticket config)
  api/          REST API route handlers
components/     UI (shadcn/ui primitives in components/ui)
db/             Drizzle schema + migrations
lib/            db client, auth, email, storage, worker
scripts/        setup, seed, admin, worker entrypoints
docs/           product specs — read the relevant doc before changing a feature
```

## Conventions

- **TypeScript everywhere.** Run `pnpm typecheck` before pushing — it must pass.
- **Lint/format with Biome:** `pnpm lint` (check) / `pnpm lint:fix` (autofix).
- **UI:** use shadcn/ui components; cards/dialogs use `rounded-xl`, buttons/inputs `rounded-md`.
- **Colors are theme tokens** (`bark`, `sand`, `stone`, `cream`, `bg-public`) — don't hardcode hex so the admin theme + dark mode keep working.
- **Statuses & categories are dynamic** — never hardcode status slugs like `"closed"`;
  use the `isClosedState` / `isDefault` flags (see `lib/ticket-config.ts`).
- **Database:** add a schema file under `db/schema/`, then `pnpm db:generate` and
  `pnpm db:migrate`. All IDs are generated app-side; tables carry `createdAt`/`updatedAt`.
- **API:** check auth first, return `{ error: string }` with the right status, never leak internal errors.

## Making a change

1. Create a branch off `main`.
2. Make your change; keep it focused. Add/adjust the relevant doc in `docs/` if behavior changes.
3. Run `pnpm typecheck` and `pnpm lint`.
4. Open a pull request describing **what** changed and **why**. Screenshots help for UI.

## Reporting bugs / requesting features

Open an issue with clear steps to reproduce (for bugs) or the problem you're trying
to solve (for features). Please check existing issues first.

By contributing, you agree your contributions are licensed under the same license as this project.
