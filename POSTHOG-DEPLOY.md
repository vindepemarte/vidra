# PostHog Deploy for Vidra (Recommended)

## Decision

Deploy PostHog as a **separate** Coolify resource/stack.

Do not place PostHog inside the same Vidra Docker Compose stack.

## Why

- PostHog has heavy stateful dependencies and different scaling profile.
- Isolating it protects Vidra deployments from analytics-related failures.
- Backup/restore and upgrades are cleaner when separated.

## Steps

1. Deploy PostHog in Coolify as its own service/stack (official PostHog self-host recipe/template).
2. Configure a domain, for example: `posthog.vidra.life`.
3. Get the PostHog project key.
4. Set these env vars in Vidra API:
   - `POSTHOG_HOST=https://posthog.vidra.life`
   - `POSTHOG_PROJECT_KEY=<your_project_key>`
5. Redeploy Vidra.

## Tracked Flow in Vidra

Frontend sends product events to `POST /api/events/track`.
API stores events in `product_events` and forwards them to PostHog if configured.

## Consent

Frontend event tracking is consent-aware (analytics cookie toggle).
No optional analytics event is sent until analytics consent is granted.
