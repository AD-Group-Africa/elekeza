# Elekeza — Monitoring & Operations

## Health & readiness

- `GET /actuator/health` — the only exposed actuator endpoint; returns aggregate UP/DOWN including database connectivity. Wire this into compose healthchecks and the load balancer.
- Frontend readiness: `GET /` returning 200 (the container serves after build output exists).

## Error tracking

- Backend + AI service: set `SENTRY_DSN_BACKEND` / `SENTRY_DSN_AI`.
- Frontend: set `NEXT_PUBLIC_SENTRY_DSN`.
- Without Sentry, rely on structured stdout logs collected by the container runtime.

## AI observability

- Langfuse integration is optional (`LANGFUSE_HOST`, keys in `.env.example`).
- Adaptation metrics worth watching: adaptation requests vs cache hits, fallback-to-original rate, AI failure rate, latency of first adapted view.

## Business events to alert on

- Login 429 rate spikes (credential-stuffing attempt).
- M-Pesa callbacks rejected (state-machine or amount mismatch) — indicates misconfiguration or attack.
- `ddl-auto=validate` failures after a deploy — schema drift, block the rollout.
- Upload 400 rate spikes — clients sending bad files or an attack in progress.

## Logging rules

- Never log passwords, tokens, cookies, or learner content.
- Server-side stack traces stay in server logs; API errors return generic bodies.
- Keep log retention aligned with the privacy policy (see `docs/privacy/`).

## Backup & recovery

See `backup-and-recovery.md`. Short version: nightly `pg_dump`, 30-day retention, quarterly restore drill, uploads directory synced to object storage when R2 is enabled.
