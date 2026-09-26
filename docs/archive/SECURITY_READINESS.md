# SECURITY_READINESS — Elekeza

## Verified controls (test-backed)

| Control | Evidence |
| --- | --- |
| Authentication | JWT (cookie-based access/refresh), BCrypt hashing — `AuthAndInputSecurityTest` (15 tests) |
| Password recovery | `/auth/forgot-password` — no account enumeration; non-existent accounts 404 identically; provider delivery attempted — `ForgotPasswordEndpointTest` (5 tests) |
| Rate limiting | Login brute-force protection (auth rate limiter) |
| CSRF | Enforced on all writes |
| CORS | Explicit origin allow-list; no wildcard |
| Tenant isolation | Institution scoping server-side — `MultiTenantAuthorizationTest` (11), `ContentAuthorizationTest` (3), `GuardianRelationshipTest` (3) |
| Role authorization | Teacher/guardian/admin surfaces — `SupportAuthorizationTest` (9), `GuardianAnalyticsAuthorizationTest` |
| Duplicate/abuse registration | `DuplicateAdminRegistrationTest` (2), `InstitutionRegistrationTest` (3) |
| Content upload safety | `ContentUploadSecurityTest` (2) |
| Payment integrity | M-Pesa state machine + idempotency + callback verification — `MpesaCallbackTest` (6), `MpesaCallbackEndToEndTest` (6) |
| Exam integrity | Server-authoritative timing, immutable submissions — `ExamApiTest` (18) |
| Secrets management | Env-var only; prior Groq key exposure redacted (see `docs/SECURITY_REMEDIATION.md`) |
| AI safety boundaries | Adaptation output validated; diagnostic phrasing rejected; no private learner data in prompts — `PersonalizationDomainTest` (13), `PersonalizationIntegrationTest` (17) |

**Suite total at this gate: 151 tests, 0 failures, 0 skipped** (`./gradlew test`, XML-verified).

## Security tests NOT yet written (gaps, honest)

- IDOR sweep across every id-bearing endpoint (partial coverage via tenant/authorization tests, not exhaustive)
- XSS/injection fuzzing beyond framework guarantees (JPA parameterization + React escaping are in place; no dedicated fuzz suite)
- Dependency audit (OWASP dependency-check / npm audit) not wired into CI
- API abuse/rate-limit coverage beyond login
- Session fixation and concurrent-session policy tests

## Deployment security posture

- All secrets via environment variables (`JWT_SECRET` with a dev-only default; production requires real values — documented in `docs/DEPLOYMENT.md`)
- `NEXT_PUBLIC_API_URL` enforced at production build time (build fails without it — verified this gate)
- Docker + docker-compose + GitLab CI stages exist; staging deployment and a backup/restore drill remain unexercised

## Verdict

**Pilot-ready with known limitations** (YELLOW): the authorization core is strongly tested; the remaining work is breadth (exhaustive IDOR/fuzz/dependency automation) and operational (staging, backup drill, incident response runbook exercise).
