# Railway deployment

This repository deploys as two Railway services backed by Railway PostgreSQL and Redis plugins.

## Backend service

1. Create a Railway project and add PostgreSQL and Redis services. Link both services to the backend service so `DATABASE_URL` and `REDIS_URL` are injected. If entering variables manually, use Railway's service reference such as `${{Redis.REDIS_URL}}`, never `redis://localhost:6379`.
2. Add a service from this GitHub repository and set its root directory to `/`.
3. Keep the backend service using `railway.json`, which selects `Dockerfile.backend`. The container runs committed Prisma migrations before starting the API and WebSocket server.
4. Set `JWT_SECRET`, `ENCRYPTION_KEY`, `SUPER_ADMIN_KEY`, `NODE_ENV=production`, and `FRONTEND_ORIGIN` as encrypted variables. Railway supplies `PORT`.
5. Generate a public domain. The health check is `https://<backend-domain>/health`.

The terminal endpoints are:

```text
wss://<backend-domain>/ws/master
wss://<backend-domain>/ws/slave
```

The existing authenticated REST copier endpoint remains available at `/api/copier`.

## Frontend service

1. Add a second service from the same repository and set its config path to `railway.frontend.json`.
2. Set `BACKEND_URL=https://<backend-domain>` on the frontend service. The nginx image proxies `/api` and `/ws` to that backend and serves the SPA fallback.
3. Set `VITE_WS_URL=wss://<backend-domain>/ws` before building if the frontend reads the variable directly.
4. Generate a frontend public domain and use it as `FRONTEND_ORIGIN` on the backend service.

## Continuous deployment

Enable GitHub source deployment for both services in Railway. Each push to `main` triggers a build for the relevant service; Railway health checks stop an unhealthy release from receiving traffic. Run `pnpm install --frozen-lockfile` locally before pushing changes that alter the lockfile.

## Local verification

```text
pnpm install --frozen-lockfile
pnpm run build
```

Do not commit `.env`; use `.env.example` as the variable checklist.