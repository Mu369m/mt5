# BRP MT5 Trade Router SaaS

Multi-tenant MT5/MT4 execution bridge, dealer rule processor, and institutional admin dashboard.

## Run & Operate

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `SUPER_ADMIN_KEY`
2. `pnpm install`
3. `pnpm db:push` — push Prisma schema to PostgreSQL
4. `pnpm dev` — starts backend (port 5000) and frontend (port 3000) in parallel

Individual services:
- `pnpm dev:backend` — Express API + WebSocket telemetry on `/ws`
- `pnpm dev:frontend` — Vite React dashboard (proxies `/api` and `/ws`)

## Stack

- pnpm workspaces, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind v4, Wouter, Framer Motion
- Backend: Express 5, Prisma ORM, PostgreSQL, WebSocket
- Bridge: `mt-bridge/` execution engine (routing, netting, news shield, smart LP)
- Shared: `shared/types.ts`, `shared/math.ts`, `shared/constants.ts`

## Architecture

- **shared/** — USD/USC math, lot divisor scaling, type contracts
- **backend/** — REST API, JWT + license key auth, tenant licensing, metering
- **mt-bridge/** — Order routing pipeline, markup injection, B-Book netting
- **frontend/** — Cyber-dark admin UI with Super Admin CMS customizer

## First-time setup

1. Register Super Admin: `POST /api/auth/register` with `superAdminCode` matching `SUPER_ADMIN_KEY`
2. Or register a tenant at `/register` (auto-provisions license + 1-year expiry)
3. Super Admin: issue licenses at `/super-admin`, customize theme, impersonate tenants

## Gotchas

- Super Admin must use **Login as Tenant** before accessing tenant LP/rules pages
- WebSocket telemetry connects to `ws://localhost:5000/ws` (proxied via Vite in dev)
- Tenant API access: pass `x-api-key: <license_key>` header for programmatic bridge calls

