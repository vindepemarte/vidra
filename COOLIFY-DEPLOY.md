# Coolify Deploy Checklist (Vidra)

## 1. Create Resource

- Type: `Docker Compose`
- Repo: `https://github.com/vindepemarte/vidra`
- Compose file: `docker-compose.yml`

## 2. Set Environment Variables

Copy from `.env.example` and fill:

- `POSTGRES_PASSWORD`
- `NEXTAUTH_SECRET`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_MAX`
- `OPENROUTER_API_KEY` (for PRO/MAX generation)
- `OPENROUTER_MODEL` (the exact model you want to run)
- `NEXT_PUBLIC_STRIPE_CHECKOUT_PRO_URL` (optional, dashboard upgrade button)
- `NEXT_PUBLIC_STRIPE_CHECKOUT_MAX_URL` (optional, dashboard upgrade button)

Domain variables:

- `NEXTAUTH_URL=https://vidra.hellolexa.space`
- `FRONTEND_URL=https://vidra.hellolexa.space`
- `NEXT_PUBLIC_API_URL=https://api.vidra.hellolexa.space`

## 3. Domains

- Web service domain: `vidra.hellolexa.space`
- API service domain: `api.vidra.hellolexa.space`

## 4. SSL

Enable Let's Encrypt on both domains.

## 5. First Run

- Deploy stack.
- Confirm health checks pass.
- Create first user via `/signup`.
- Create persona and generate first month from dashboard.

## 6. Stripe Webhook

Point Stripe webhook URL to:

- `https://api.vidra.hellolexa.space/api/billing/webhook`

Events to send:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
