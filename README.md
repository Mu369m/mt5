## Railway Deployment

This repository deploys as two Railway services from the same GitHub repository:

1. **Backend:** use the root `railway.json`, with `Dockerfile.backend`. Add Railway PostgreSQL and Redis services, then set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, and `SUPER_ADMIN_KEY` in the backend service. The container runs `prisma migrate deploy` before starting the Express/WebSocket server and exposes `/health`.
2. **Frontend:** configure the service to use `railway.frontend.json` and `Dockerfile.frontend`. Set `BACKEND_URL` to the backend public URL, including the scheme, for example `https://mt5-backend.up.railway.app`. Nginx proxies `/api/*` and `/ws` to that service and serves the Vite SPA with history fallback.

Before the first production deploy, create and commit a Prisma migration for the current schema:

```bash
pnpm --filter @workspace/backend exec prisma migrate dev --name initial
```

Do not use `prisma db push` for production. Railway automatically redeploys both services when the `main` branch changes. Use the backend public URL for MT4/MT5 transport endpoints: `wss://<backend-domain>/ws`.

Required optional alert variables are documented in `.env.example`; leave them unset to disable external notifications.
