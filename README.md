# topEleven-gamepress

A Top Eleven-style football tournament admin platform — group draw, group
stage, knockout rounds, public standings. Monorepo with **Next.js** (web) +
**Elysia + tRPC** (server) + **Drizzle/PostgreSQL** (DB) + **Better-Auth**,
running on **Bun**.

---

## 1. Environment setup

**Requirements:** Bun `1.4.2` (see `packageManager` in `package.json`),
Node.js `20.x`, PostgreSQL `14+`.

Install Bun: Windows — `irm bun.sh/install.ps1 | iex` · macOS/Linux — `curl -fsSL https://bun.sh/install | bash`.

```bash
git clone https://github.com/jonny-tran/topeleven-gamepress.git
cd topEleven-gamepress
bun install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example      apps/web/.env
```

Running `bun install` at the root installs dependencies for every workspace
under `apps/*` and `packages/*`.

### Required variables

`apps/server/.env`:


| Variable             | Description                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Postgres connection string.                                                                              |
| `BETTER_AUTH_SECRET` | ≥ 32 chars. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`. |
| `BETTER_AUTH_URL`    | Base URL of the server. Local: `http://localhost:3000`.                                                  |
| `CORS_ORIGIN`        | Base URL of the web. Local: `http://localhost:3001`.                                                     |
| `NODE_ENV`           | `development` / `production` / `test`.                                                                   |


`apps/web/.env`:


| Variable                 | Description                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SERVER_URL` | Where the web app calls the backend. Local: `http://localhost:3000`. On Vercel: `/api`. |


All variables are strictly validated by `packages/env/src/{server,web}.ts` —
missing or wrong-typed values cause the server to fail fast at boot.

> The `.env.example` templates intentionally **omit** `ADMIN_EMAILS` /
> `PASSWORD_ADMIN`. `ADMIN_EMAILS` defaults to an empty list ⇒ no one is
> promoted to admin via the fallback allowlist. `PASSWORD_ADMIN` is only
> needed if you run the seed script.

---

## 2. Database guide

The repo ships without a database. Create an empty Postgres instance and paste
its connection string into `DATABASE_URL`:

- **Neon** (recommended for dev): [https://neon.tech](https://neon.tech) → create a project →
copy the `Connection string` (`main` branch, `neondb_owner` role).
- **Supabase**: `Project Settings → Database → Connection string`.

> Any old Neon connection string you see in git history is from a temporary
> database that expired on 11/09/2026 — always create your own. Production
> uses the `Dockerfile` at the repo root; you don't need it for dev.

Push the schema (reads `apps/server/.env` through
`packages/db/drizzle.config.ts`):

```bash
bun run db:push        # on the first run, type `y` to confirm each change
# or use migrations:
bun run db:generate
bun run db:migrate
```

**Optional:**

```bash
bun run db:studio      # web UI to view/edit data
bun run db:seed        # create 5 sample admin accounts — requires
                       # PASSWORD_ADMIN in apps/server/.env (not in template)
```

---

## 3. Web + Server source guide

```
topEleven-gamepress/
├── apps/
│   ├── web/                # Next.js 16 + React 19 + TanStack Query
│   └── server/             # Elysia + tRPC + Better-Auth  (entry: src/index.ts)
└── packages/
    ├── api/                # tRPC routers + access control
    ├── auth/               # Better-Auth setup (Drizzle adapter)
    ├── db/                 # Drizzle schema + seed + migrations
    ├── env/                # Env validation (Zod)
    ├── ui/                 # Shared shadcn/ui components
    └── config/             # tsconfig presets
```

**Request flow:** Browser → Next.js (`:3001`, UI only) → Elysia (`:3000`,
mounts `/api/auth/*` for Better-Auth and `/trpc/*` for tRPC) → Drizzle
(Postgres).

**Key entry points:**

- `apps/server/src/index.ts` — boots Elysia, mounts routes, reads
`CORS_ORIGIN` / `PORT`.
- `apps/web/src/app/` — App Router; each folder is a route segment.
- `packages/api/src/routers/` — `{tournament,team,match,draw,knockout,ranking}.ts`.
- `packages/api/src/context.ts` — resolves viewer + admin role (reads
`ADMIN_EMAILS`).
- `packages/db/src/schema/` — table schemas.
- `packages/env/src/{server,web}.ts` — fail-fast env validation.

To change ports: web — edit `apps/web/package.json` (`next dev --port <port>`);
server — set `PORT=...` in `apps/server/.env`.

---

## 4. Run locally

```bash
bun run dev
```

Turbo starts web + server in parallel. Once both are up:


| Service | URL                                                                  |
| ------- | -------------------------------------------------------------------- |
| Web     | [http://localhost:3001](http://localhost:3001)                       |
| Server  | [http://localhost:3000](http://localhost:3000)                       |
| tRPC    | [http://localhost:3000/trpc](http://localhost:3000/trpc)             |
| Auth    | [http://localhost:3000/api/auth/*](http://localhost:3000/api/auth/*) |


Open [http://localhost:3001](http://localhost:3001), sign up or log in — if the `/admin` page renders
for your account, everything is wired up correctly.

```bash
bun run dev:web        # web only
bun run dev:server     # server only
bun run check-types    # tsc --noEmit across the monorepo
bun run build          # build everything
```

**Common errors:** `BETTER_AUTH_SECRET` shorter than 32 chars → regenerate
with `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.
`DATABASE_URL is not set` → make sure `apps/server/.env` exists and the
variable is non-empty. CORS / Failed to fetch on the web → `CORS_ORIGIN`
must match the host:port you opened (default `http://localhost:3001`).