# Elekeza deployment runbook

> **Pilot context (2026-09-17):** this runbook deploys the pilot stack. Pilot-specific
> operations (orientation, escalation map, feedback capture) live in
> `docs/PILOT_RUNBOOK.md`; readiness verdict in `docs/PILOT_READINESS.md`.

## Release scope and prerequisite (updated 2026-09-17)

Attendance (V10) and school fees/payments (V11) are now real production domains and ship in this release. The finance domain layers on top of the M-Pesa integration ledger: a Daraja callback creates a **Payment** idempotently (provider transaction id is the idempotency key), which is then **allocated** to learner charges; balances are always derived server-side. M-Pesa modes: `mock` (deterministic, demos/tests), `sandbox` (real sandbox credentials), `production` (real Daraja credentials + public HTTPS `MPESA_CALLBACK_URL`). If production credentials are absent the UI explicitly reports "Production M-Pesa not configured" — deploy it that way rather than faking it.

This runbook starts the existing application. Do not deploy with the `dev` profile, demo accounts, or placeholder secrets.

Required environment values are `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and the build-time `NEXT_PUBLIC_API_URL`. Use PostgreSQL in production. The backend must use Flyway migrations and `ddl-auto=validate` (never `update`).

Optional integration values are `AI_SERVICE_URL`, `AI_INTERNAL_SECRET`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, SMTP settings, R2 settings, and Africa's Talking settings. Leave an integration disabled rather than inventing credentials. M-Pesa callbacks need a public HTTPS URL and provider-side signature verification at the edge.

## Deploy

1. Back up PostgreSQL and verify a restore procedure before a production change.
2. Create the database and a least-privilege application user. Keep the database port private.
3. Set the production environment values in the deployment secret store; do not put them in Git or frontend variables.
4. Build the backend with `gradlew.bat bootJar` from `backend`, then run the JAR with the production profile.
5. Build the frontend from `frontend` with `NEXT_PUBLIC_API_URL` set to the public API origin, then run `npm run build` and `npm start`.
6. Terminate TLS at the configured reverse proxy, redirect HTTP to HTTPS, and set the production API and frontend origins explicitly.
7. Confirm Flyway completed, `/actuator/health` is healthy, and application logs contain no secret values.

## Smoke test

Use only synthetic/demo accounts in a pre-production environment. Verify login, learner lesson/quiz submission, teacher learner view, guardian ward isolation, Tutor fallback, logout, and a failed M-Pesa configuration response. Do not represent M-Pesa as live without real provider credentials and a verified callback endpoint.

## Operations

Monitor health checks, failed logins, authorization failures, background processing, database capacity, and provider callback failures. Back up PostgreSQL before every migration and rehearse restore. Roll back application code only after checking migration compatibility; applied Flyway migrations are not deleted or edited.
