# Coolify Deploy Checklist (Vidra by Lexa AI)

## 1. Create Resource

- Type: `Docker Compose`
- Repo: `https://github.com/vindepemarte/vidra`
- Compose file: `docker-compose.yml`

## 2. Domains (HTTPS only)

- Web service domain: `vidra.life`
- API service domain: `api.vidra.life`

Set these environment variables:

- `NEXTAUTH_URL=https://vidra.life`
- `FRONTEND_URL=https://vidra.life`
- `NEXT_PUBLIC_API_URL=https://api.vidra.life`

## 3. Core Environment Variables

Required:

- `POSTGRES_PASSWORD`
- `NEXTAUTH_SECRET`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_MAX`
- `STRIPE_PRICE_TOPUP_STARTER`
- `STRIPE_PRICE_TOPUP_GROWTH`
- `STRIPE_PRICE_TOPUP_SCALE`
- `STRIPE_SUCCESS_URL=https://vidra.life/dashboard?billing=success`
- `STRIPE_CANCEL_URL=https://vidra.life/dashboard?billing=cancel`
- `STRIPE_PORTAL_RETURN_URL=https://vidra.life/settings`

Recommended:

- `OPENROUTER_API_KEY` (for PRO/MAX strategy)
- `OPENROUTER_MODEL`
- `OPENROUTER_TIMEOUT_SECONDS=45`
- `OPENROUTER_MAX_RETRIES=1`
- `PROFILE_GENERATION_TIMEOUT_SECONDS=180`
- `CALENDAR_GENERATION_TIMEOUT_SECONDS=180`
- `FAL_API_KEY` (platform fallback for image generation)
- `APP_ENCRYPTION_KEY` (recommended for BYOK key encryption)
- `APP_POLICY_VERSION=1.0`
- `POSTHOG_HOST` (optional analytics endpoint, e.g. `https://posthog.yourdomain.com`)
- `POSTHOG_PROJECT_KEY` (optional project key)
- `NEXT_PUBLIC_APP_POLICY_VERSION=1.0`
- `NEXT_PUBLIC_LEGAL_OWNER`
- `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`
- `NEXT_PUBLIC_LEGAL_COUNTRY=Italy`

## 4. SSL

Enable Let's Encrypt on both domains.

## 5. Deploy

- Deploy stack.
- Confirm health checks pass.
- Create first user at `/signup`.
- Complete onboarding at `/onboarding`.

## 6. Stripe Webhook

Point Stripe webhook URL to:

- `https://api.vidra.life/api/billing/webhook`

Events to send:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

This single endpoint handles both subscription plan sync and credit top-up sync.

## 7. PostHog (Best Approach)

Use a separate Coolify resource/stack for PostHog, not inside the Vidra app stack.

- Reason: PostHog brings heavy stateful dependencies and separate scaling/backup needs.
- Vidra stack remains lean and safer for deploy rollbacks.
- After PostHog is live, set `POSTHOG_HOST` and `POSTHOG_PROJECT_KEY` in Vidra env.
