# Elekeza — Security Posture

Status: verified by automated suites (117 backend tests) plus live attack probes (`.freebuff/live_journey.py`, `docs/acceptance/FULL_PROJECT_PRODUCTION_AUDIT.md`).

## Authentication

- Passwords hashed with BCrypt; never logged; never returned by any API.
- Access token: JWT in `HttpOnly`, `SameSite=Lax`, `Secure` (prod) cookie, 15-minute TTL.
- Refresh token: opaque random value stored hashed (SHA-256) server-side, `HttpOnly`, `SameSite=Strict`, 7-day TTL, **rotated on every refresh and revoked at logout**.
- Login rate limiting: interval-based per-identity window (hard lock until the window passes) returning HTTP 429.
- Registration role is server-hardcoded to `STUDENT`; `ADMIN`/`SCHOOL_ADMIN` exist only as separate deliberate flows.

## Authorization & tenancy

- Role model: `STUDENT`, `TEACHER`, `GUARDIAN`, `ADMIN` (platform), `SCHOOL_ADMIN` (institution). Self-registered schools get `SCHOOL_ADMIN`, never platform `ADMIN`.
- Every institution-scoped call re-derives the tenant server-side (`requireInstitutionAccess`); client-supplied IDs are never trusted.
- Live two-institution IDOR matrix returns 403 for cross-tenant roster/content/profile reads and writes.
- Learner preferences: teacher/guardian guidance cannot overwrite learner-explicit keys (HTTP 409).

## CSRF / CORS / headers

- Cookie-to-header CSRF on all non-GET endpoints (single-use tokens); both frontend API clients fetch fresh tokens from `/api/auth/csrf`.
- CORS: explicit origin allowlist (wildcards rejected at startup), credentials enabled.
- Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `Referrer-Policy: no-referrer`.

## Input & file security

- Malformed JSON → 400 with a generic body (no stack traces, no internals).
- Uploads: filenames flattened to `UUID-<sanitized>` (path traversal verified dead by live probe), absolute-path writes inside `uploads/`, storage failures map to 400.
- Quiz scoring is server-authoritative; duplicate question submissions cannot inflate scores.
- M-Pesa callbacks: public but state-machine-bound (INITIATED/PENDING → COMPLETED|FAILED only), amount-matched, unknown transaction IDs rejected, replays ignored.

## Privacy

- The personalization AI path sends a neutral learner context — never SNE/diagnostic labels or unnecessary PII.
- Diagnostics-free language policy enforced in UI and summaries ("benefits from shorter sections", never medical conclusions).
- Guardian access is limited to explicitly linked wards; teachers see institution-scoped learners only.

## Residual obligations (operational, not code)

- Real-provider verification (Daraja callbacks, SMTP, R2, AI) once credentials are provisioned — see `external-integrations.md`.
- TLS/HSTS configuration happens at the nginx layer; verify with an external scanner after go-live.
