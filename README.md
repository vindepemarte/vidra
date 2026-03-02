# Vidra

Vidra is a mobile-first creator operating system to build, plan, and scale AI influencer brands.

## Core Value

- `FREE`: launch and run one creator with a weekly content sprint, forever.
- `PRO`: unlock premium AI strategy, stronger hooks, and monthly growth cadence.
- `MAX`: run a multi-creator portfolio with campaign-grade outputs.

## Monorepo Layout

- `web/`: Next.js 14 dashboard + NextAuth UI
- `api/`: FastAPI backend + tier logic + Stripe webhook + generation APIs
- `life-framework-v1/`: OpenRouter-ready generation framework
- `docker-compose.yml`: single stack deployment for Coolify

## Tier Behavior

- `FREE`
  - up to 1 persona
  - 7-day generation window
  - offline generation only (zero external API calls)
- `PRO`
  - up to 3 personas
  - 30-day generation window
  - OpenRouter-enhanced strategy + caption quality
- `MAX`
  - up to 10 personas
  - 30-day generation window
  - OpenRouter-enhanced premium/monetization-oriented generation

## Deployment (Coolify)

Use one Docker Compose resource pointing to this repository.

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
- `STRIPE_PRICE_PRO=price_xxx`
- `STRIPE_PRICE_MAX=price_xxx`

Recommended for paid tiers:

- `OPENROUTER_API_KEY=...`
- `OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514` (or your preferred model)

Optional upgrade buttons in dashboard:

- `NEXT_PUBLIC_STRIPE_CHECKOUT_PRO_URL=https://checkout.stripe.com/...`
- `NEXT_PUBLIC_STRIPE_CHECKOUT_MAX_URL=https://checkout.stripe.com/...`

## API Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/personas`
- `POST /api/calendar/{persona_id}/generate`
- `GET /api/calendar/{persona_id}/{year}/{month}`
- `GET /api/export/{persona_id}/{year}/{month}/markdown`
- `GET /api/export/{persona_id}/{year}/{month}/json`
- `GET /api/plans`
- `GET /api/plans/me`
- `GET /api/dashboard/overview`
- `POST /api/billing/webhook`

## Notes

- API currently auto-creates tables on startup.
- Stripe tier mapping is driven by env (`STRIPE_PRICE_PRO`, `STRIPE_PRICE_MAX`).
- OpenRouter model configured in env is used by `PRO/MAX` paid generation logic.
