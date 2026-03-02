# Vidra

Mobile-first AI influencer platform with a FREE offline engine and scalable PRO/MAX architecture.

## Monorepo Layout

- `web/`: Next.js 14 dashboard + NextAuth
- `api/`: FastAPI backend + SQLAlchemy + Stripe webhook
- `life-framework-v1/`: imported life framework repository
- `docker-compose.yml`: single stack for Coolify

## Tiers

- `FREE`: offline-only Python generation (no external API calls)
- `PRO`: quality uplift with optional LLM/search integration
- `MAX`: multi-persona orchestration + advanced automation workflows

## Deployment (Coolify)

Use one Docker Compose resource pointing to this repo.

Required env vars:

- `NEXTAUTH_URL=https://vidra.hellolexa.space`
- `FRONTEND_URL=https://vidra.hellolexa.space`
- `NEXT_PUBLIC_API_URL=https://api.vidra.hellolexa.space`
- `NEXTAUTH_SECRET=...`
- `JWT_SECRET=...`
- `POSTGRES_USER=vidra`
- `POSTGRES_PASSWORD=...`
- `POSTGRES_DB=vidra`
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`

Optional for PRO/MAX:

- `OPENROUTER_API_KEY=...`
- `BRAVE_API_KEY=...`

## API Endpoints (MVP)

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/personas`
- `POST /api/calendar/{persona_id}/generate`
- `GET /api/calendar/{persona_id}/{year}/{month}`
- `GET /api/export/{persona_id}/{year}/{month}/markdown`
- `POST /api/billing/webhook`

## Notes

- This MVP intentionally auto-creates DB tables on API startup.
- Stripe price ID mapping for PRO/MAX is in `api/vidra_api/routes/billing.py`.
