# Part 34 — Deployment Runbook

## Target
Existing Render pipeline: FastAPI backend + Next.js frontend. No production deployment is performed by this Part.

## Required Render configuration
1. Backend service root: `backend`
2. Backend build: create venv and install `backend/requirements.txt`
3. Backend start: Uvicorn on `$PORT`
4. Backend health: `/api/v1/health`
5. Frontend service root: `frontend`
6. Frontend build: `npm install && npm run build`
7. Frontend start: `npm run start`
8. Frontend health: `/`

## Production secrets
Configure in Render Secret Environment Variables, never commit them:
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `BACKEND_CORS_ORIGINS`
- AI/provider secrets when enabled
- Telegram/WhatsApp secrets when enabled

`BACKEND_CORS_ORIGINS` must contain the exact trusted frontend origin(s); `*` is forbidden in production.

## Release sequence
Local validation → Git commit/review → Render test/deploy → health check → smoke/E2E test → production promotion.

Do not run database reset/seed commands against production. Do not deploy directly from an unreviewed working tree.

## Preflight
Run:
`python scripts/deploy_preflight.py`

The preflight only validates configuration; it does not deploy or modify infrastructure.
