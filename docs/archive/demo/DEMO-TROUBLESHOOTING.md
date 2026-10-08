# Elekeza — Demo-Day Troubleshooting

## Nothing loads at all

- Check backend: `curl http://127.0.0.1:8082/actuator/health` → must be UP.
  If down: `.freebuff/start-backend-preview.ps1`, wait ~40 s, re-check.
- Check frontend: `curl -o /dev/null -w "%{http_code}" http://localhost:3000/`.
  If down: `.freebuff/start-fe-preview.ps1`, wait ~20 s, re-check.
- Frontend must be started with the launcher (it pins `NEXT_PUBLIC_API_URL=127.0.0.1:8082`);
  a bare `npm run dev` may proxy to the wrong port.

## Login fails for a demo account

- Dev DB reseeds on backend restart — accounts always exist after boot.
- Wrong-password lockout: wait 60 s (rate limiter window) or restart the backend (reseeds limiter).
- If all else fails: register a fresh school live and use that admin (Act 1 fallback).

## "Could not save" / 403 in the UI after idling

The CSRF token is single-use and rotates. Refresh the page once and repeat the
action. This is protection working, not a defect.

## Lesson shows "not authorized"

The teacher assignment row was lost (fresh dev DB). As teacher, assign
"The Water Cycle" to Juma again (one click), then reload the learner view.

## AI/adaptation looks non-AI

By design: the demo runs deterministic, curriculum-preserving adaptation with
mock AI — it never depends on an external provider being reachable. Say:
"personalization works with or without AI; the AI provider is pluggable."

## Payments page / M-Pesa

Do not demo live payments. If asked: show the integration status — callback
state machine, amount binding, idempotency are implemented and unit-tested;
the real Daraja sandbox is a documented activation step, not demo content.

## Browser cache shows stale UI

Hard refresh (Ctrl+Shift+R). The service worker caches lesson content for
offline use; a hard refresh pulls the latest shell.

## Internet dies mid-demo

Nothing in Acts 1–5 requires internet: backend, frontend, database and
personalization run locally. Continue; mention offline-first as a feature.
