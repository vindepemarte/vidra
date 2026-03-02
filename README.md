# Vidra by Lexa AI

Vidra by Lexa AI is a mobile-first AI influencer operating system to build persona memory, run content strategy, and execute media workflows from one dashboard.

## Core Value

- `FREE`: one persona, offline generation, zero external API cost, forever.
- `PRO`: monthly AI-enhanced strategy, multi-persona workflows, image generation credits.
- `MAX`: portfolio-scale operations for high-output creator systems.

## Monorepo Layout

- `web/`: Next.js 14 dashboard + NextAuth UI
- `api/`: FastAPI backend + tier logic + Stripe + media APIs
- `life-framework-v1/`: OpenRouter-ready generation framework
- `docker-compose.yml`: single stack deployment for Coolify

## Tier Behavior

- `FREE`
  - up to 1 persona
  - 7-day generation window
  - offline generation only (no external API calls)
- `PRO`
  - up to 3 personas
  - 30-day generation window
  - OpenRouter-enhanced strategy
  - 500 included monthly credits
- `MAX`
  - up to 10 personas
  - 30-day generation window
  - OpenRouter-enhanced premium strategy
  - 2500 included monthly credits

## Deployment (Coolify)

Use one Docker Compose resource pointing to this repository.

Required base env vars:

- `NEXTAUTH_URL=https://vidra.life`
- `FRONTEND_URL=https://vidra.life`
- `NEXT_PUBLIC_API_URL=https://api.vidra.life`
- `NEXTAUTH_SECRET=...`
- `JWT_SECRET=...`
- `POSTGRES_USER=vidra`
- `POSTGRES_PASSWORD=...`
- `POSTGRES_DB=vidra`

Billing env vars:

- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`
- `STRIPE_PRICE_PRO=price_xxx`
- `STRIPE_PRICE_MAX=price_xxx`
- `STRIPE_PRICE_TOPUP_STARTER=price_xxx`
- `STRIPE_PRICE_TOPUP_GROWTH=price_xxx`
- `STRIPE_PRICE_TOPUP_SCALE=price_xxx`
- `STRIPE_SUCCESS_URL=https://vidra.life/dashboard?billing=success`
- `STRIPE_CANCEL_URL=https://vidra.life/dashboard?billing=cancel`
- `STRIPE_PORTAL_RETURN_URL=https://vidra.life/settings`

Recommended provider env vars:

- `OPENROUTER_API_KEY=...`
- `OPENROUTER_MODEL=anthropic/claude-sonnet-4-20250514` (or preferred model)
- `OPENROUTER_TIMEOUT_SECONDS=45`
- `OPENROUTER_MAX_RETRIES=1`
- `PROFILE_GENERATION_TIMEOUT_SECONDS=180`
- `CALENDAR_GENERATION_TIMEOUT_SECONDS=180`
- `FAL_API_KEY=...` (platform key, optional if BYOK only)
- `FAL_IMAGE_MODEL=fal-ai/flux/schnell`
- `FAL_EDIT_MODEL=fal-ai/flux-lora/image-edit`
- `FAL_IMAGE_COST_CREDITS=20`
- `FAL_EDIT_COST_CREDITS=12`

Security and policy env vars:

- `APP_POLICY_VERSION=1.0`
- `APP_ENCRYPTION_KEY=...` (recommended in production)
- `AUTO_CREATE_TABLES=true|false`
- `POSTHOG_HOST=` (optional, self-host URL like `https://posthog.yourdomain.com`)
- `POSTHOG_PROJECT_KEY=` (optional project key for event ingest)
- `NEXT_PUBLIC_APP_POLICY_VERSION=1.0`
- `NEXT_PUBLIC_LEGAL_OWNER=...`
- `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=...`
- `NEXT_PUBLIC_LEGAL_COUNTRY=Italy`

## API Endpoints

- Auth
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- Personas and calendar
  - `GET/POST /api/personas`
  - `GET/PUT/DELETE /api/personas/{persona_id}`
  - `POST /api/personas/{persona_id}/profile/generate`
  - `POST /api/calendar/{persona_id}/generate`
  - `GET /api/calendar/{persona_id}/{year}/{month}`
  - `GET /api/calendar/{persona_id}/months`
- Onboarding
  - `GET /api/onboarding/state`
  - `POST /api/onboarding/step`
  - `POST /api/onboarding/complete`
- Plans/dashboard
  - `GET /api/plans`
  - `GET /api/plans/me`
  - `GET /api/dashboard/overview`
- Billing/credits
  - `POST /api/billing/checkout`
  - `POST /api/billing/portal`
  - `POST /api/billing/webhook`
  - `GET /api/credits/wallet`
  - `GET /api/credits/ledger`
  - `POST /api/credits/topup/checkout`
- Account keys
  - `GET /api/account/api-keys`
  - `PUT /api/account/api-keys/{provider}`
  - `DELETE /api/account/api-keys/{provider}`
- Media
  - `POST /api/media/generate-image`
  - `POST /api/media/edit-image`
  - `GET /api/media/jobs/{job_id}`
  - `GET /api/media/persona/{persona_id}`
- Export/consent/events
  - `GET /api/export/{persona_id}/{year}/{month}/markdown`
  - `GET /api/export/{persona_id}/{year}/{month}/json`
  - `POST /api/consent/cookies`
  - `POST /api/events/track`

## Notes

- OpenRouter model configured in env is used for paid `PRO/MAX` strategy generation.
- fal routing logic: BYOK key first, then platform key + credit consumption.
- Docker deploy expects `web/public` to exist (included in repo).
- PostHog best practice: deploy PostHog as a separate Coolify resource/stack, then point `POSTHOG_HOST` and `POSTHOG_PROJECT_KEY` from Vidra API to it.
