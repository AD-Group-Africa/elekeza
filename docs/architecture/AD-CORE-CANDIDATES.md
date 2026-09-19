# AD CORE CANDIDATES

Candidates for extraction into a shared AD Group platform layer. **Deliberately NOT extracted during the Elekeza completion sprint** — premature extraction risks destabilizing a pilot-ready product. Each candidate records where it already exists and the proven patterns to lift later.

| # | Capability | Where it exists today (Elekeza) | Maturity | Notes for future extraction |
| - | ---------- | ------------------------------- | -------- | --------------------------- |
| 1 | Authentication (JWT access + refresh rotation/revocation) | `auth/` — BCrypt, HttpOnly cookies, refresh-token table, revocation on logout | **High — proven in production-shaped tests** | Lift as-is; the refresh-rotation + blacklist pattern is the portfolio reference implementation |
| 2 | RBAC (role + scope) | `User.userRole`, `@PreAuthorize`, institution-scoped repositories, SCHOOL_ADMIN ≠ ADMIN separation | **High** | Generalize "institutionId" → "tenantId/orgId"; keep server-side enforcement as the only enforcement |
| 3 | Multi-tenancy / institution isolation | Institution-scoped queries everywhere; two-institution IDOR live-probe suite (40/40 journey) | **High** | The tenant-scoping discipline (every query filtered by tenant, negative tests mandatory) is the reusable asset |
| 4 | Rate limiting / brute-force protection | `auth/LoginRateLimiter.kt` (429s, live-verified) | Medium-High | Small, self-contained — first easy extraction |
| 5 | CSRF + security headers | `SecurityConfig` — single-use tokens, CSRF-exempt server-to-server callback pattern, header hardening | **High** | The "server-to-server callback exempt from CSRF, everything else tokened" pattern is portfolio-wide relevant |
| 6 | Payments (M-Pesa STK + callback state machine) | `payments/` — INITIATED→SUCCESS/FAILED, amount binding, idempotency, 12 regression tests | **High (code) / pending provider credentials** | The idempotent callback + amount-binding state machine is directly reusable by DukaPro/ClinIQ |
| 7 | Notifications | `notification/` — ownership-enforced in-app notifications, unread counts | Medium | In-app core is portable; SMS/email adapters still mock — extract with pluggable provider interface |
| 8 | File upload security | Upload validation (MIME/size), storage isolation, traversal-probe tested | Medium-High | Reusable for any vertical with documents |
| 9 | Guardian/relationship model (role + relationship-type) | `GuardianLink` with canonical relationship enum + normalization | Medium | Generalizes to any "authorized related adult/party" model — useful beyond schools |
| 10 | AI client abstraction (mock/real, fail-safe fallback) | `personalization/ContentAdaptationService` + mock client; `ai-elewa` FastAPI service | Medium | The "AI unavailable → deterministic fallback, never block core flows" contract is the portfolio AI gateway seed |
| 11 | Audit events | Business-event logging on auth/payments/content actions | Medium | Formalize into an `audit_log` table + service before extraction |
| 12 | Global exception handling (no stack traces to clients) | `common/GlobalExceptionHandler` — mapped conflicts, catch-all | **High** | Trivially portable |
| 13 | CSV import framework (template-aligned parsing, credential issuance) | `InstitutionService` learner/guardian import | Medium | Generalize to "bulk onboarding with per-row errors + generated credentials" |
| 14 | Live journey test harness pattern | `.freebuff/live_journey.py` (40 checks, CSRF-aware, multi-tenant probes) | **High** | Re-target per product; the harness architecture is the reusable piece |

## Extraction sequencing (when AD Core work is funded)

1. **Wave 1 (low risk, high reuse):** rate limiter · global exception handler · CSRF/security config · live-journey harness pattern.
2. **Wave 2 (core):** auth + refresh rotation · RBAC/tenancy discipline · notifications core.
3. **Wave 3 (differentiating):** payments state machine · file upload security · AI gateway contract · audit logging.

## Rule

No extraction happens inside an Elekeza stabilization window. AD Core extraction is its own workstream with its own test suite; Elekeza consumes it as a dependency only after parity tests pass.
