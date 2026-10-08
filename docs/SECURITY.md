# ELEKEZA — SECURITY

> Canonical security reference. Evidence: automated suites (278/278 backend) + live probe matrices
> executed this engagement (401/403/429/CSRF/IDOR) + prior audits (`docs/archive/` provenance).

## 1. Authentication (verified)

| Control | Implementation | Status |
|---|---|---|
| Access token | JWT HMAC-SHA256, claims email+role, `elewa_access` httpOnly cookie, `JWT_EXPIRATION_HOURS` (24h local default) | ✅ |
| Refresh tokens | opaque, **SHA-256 hashed in `refresh_tokens`**, revocable, **rotated on use**; reuse of rotated/revoked → 401 | ✅ unit-tested |
| Cookies | httpOnly; `Secure` per `SECURE_COOKIES` (default true base/prod; false only dev); access SameSite=Lax, refresh Strict | ✅ |
| Passwords | BCrypt; policy min 8 incl. letter+digit; reset via single-use expiring hashed token; consuming a reset revokes sessions | ✅ |
| Rate limiting | `LoginRateLimiter` (Bucket4j) 5/60s per email+IP → 429 (verified live: 5 bad logins then 429) | ✅ |
| Failed auth | uniform `401 Invalid email or password` — no user enumeration; forgot-password never reveals existence | ✅ |
| Registration | role hard-coded STUDENT; email regex + duplicate 409; terms enforced | ✅ |
| Google OAuth | does not exist (legacy comment only) — email+password only | ✅ (honest) |

## 2. Authorization & tenancy (verified)

- RBAC server-side on every protected endpoint (`JwtAuthFilter` + `@PreAuthorize`); frontend hides
  UI but never gates.
- Five roles: STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN. SCHOOL_ADMIN ≠ ADMIN.
- Object-level: `requireContentAccess` (content/quiz/adaptation), guardian ward-link checks, class
  session authorization, staff/student endpoints require `institutionId == caller.institutionId`
  (ADMIN exempt) — the two cross-tenant IDORs found in earlier audits are fixed and regression-
  probed (roster read + student import).
- **Live 403 matrix (this engagement):** cross-tenant `institutions/{id}/students|staff`, class
  session “Not authorized for this class”, guardian cross-family ward, content cross-school — all
  403. Zero 500s across the matrix.

## 3. Request hardening (verified)

| Control | Status | Evidence |
|---|---|---|
| CSRF double-submit | ✅ | enforced on all mutating POSTs; exempt: login/register/refresh/csrf/forgot/reset + `/api/payments/callback` (returns Safaricom ack shape idempotently) |
| CORS | ✅ | explicit origins, credentials on; wildcard refused at boot; evil-origin preflight → 403 no ACAO |
| Headers | ✅ | `Content-Security-Policy: frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `nosniff`, `X-Frame-Options: DENY`; HSTS at nginx (TLS deployment) |
| Input validation | ✅ | server-side everywhere; malformed JSON → 4xx generic body; no stack traces |
| SQL injection | ✅ | JPA parameterized only; no raw SQL |
| XSS | ✅ | React escaping; no `dangerouslySetInnerHTML` in learner flows |
| File uploads | ✅ | 10 MB cap, extension allow-list, MIME declared-type check, **path-traversal fix verified** (flattened UUID names) |
| SSRF | ✅ | fixed provider endpoints only; no user-supplied URLs |
| Actuator | ✅ | `health` only, `show-details: never`, `/actuator/env` → 403 |

## 4. M-Pesa callback integrity (verified, code)

State machine (`INITIATED → COMPLETED | FAILED`, terminal states final), amount binding, unknown
`CheckoutRequestID` rejection, duplicate replay no-op — 12 automated tests + live negative probes
(forged callback safely rejected `ResultCode: 1`). Signature verification at the edge remains a
deployment obligation once real credentials exist.

## 5. AI security — P0 FIXED (r3 ship authorization pending)

| Item | Status |
|---|---|
| Backend↔ai-elewa internal auth (`X-Internal-Key`) | ✅ mechanism verified both sides (live chain proof reached pipeline) |
| **`ai-elewa/security.py:10` — `INTERNAL_SECRET` defaults `""` → fail-open** | ✅ **FIXED + live-verified (2026-10-03 closure): fail-closed** (`key_valid = bool(INTERNAL_SECRET) and hmac.compare_digest(...)`). Probe with secret unset: every endpoint incl. `/docs` → **401** (pre-fix: no-key → 422). Valid key → auth passes. AI pytest 606 passed. Remaining: AI r3 release authorization to ship the fix. |
| Backend `dev-secret` fallbacks (`RealAiClient.kt:18`, `AiWebClientConfig.kt:15`) | ✅ **removed (2026-10-03 closure)** — `ai.internal-secret` now fail-fast at boot; prod/prod-docker yaml require `AI_INTERNAL_SECRET` with no default; dev profile keeps an explicitly-labelled dev fallback. Backend suite 278/278 after change |
| Prompt injection | mitigated: length limits, no direct prompt construction from user text, output schema-validated (`LessonJSON`/`QuizJSON`) |
| Output safety | `AdaptationSafety` rejects diagnostic phrasing, enforces key-term preservation + length floor; invalid AI output never shown |
| PII to provider | personalization path sends neutral learner context + content text only; legacy content pipeline forwards school-recorded SNE profile in real mode (documented deployment item) |
| Provider failure honesty | invalid Groq key → structured `SCHEMA_INVALID` + learner-safe message; no fake success anywhere |

## 6. Secrets & configuration

- No secrets in repo (audited: tracked files + history patterns); `.env.example` placeholders only.
- Prod profile fail-fasts on missing `DB_URL/DB_USER/DB_PASSWORD/JWT_SECRET/CORS_ALLOWED_ORIGINS/FRONTEND_URL`.
- Do-not-log rule respected: no passwords/tokens/secrets/learner content in logs (code-audited).
- Demo seed gated by `DEMO_SEED_ENABLED` (prod boots with users=0; demo login → 401 verified).

## 7. Child / learner data privacy (verified)

- Learners cannot see other learners (403); guardians only linked wards (403 cross-family); teachers
  institution-scoped; school admins own institution; platform ADMIN separate.
- APIs return minimal fields; logs contain no unnecessary PII; AI requests carry no labels
  (personalization) — content text only.
- Disability-related data never exposed to other learners; summaries screened for diagnostic terms
  (asserted in tests).
- Gap (documented): per-learner deletion workflow not yet implemented — required before scale.

## 8. Known risks (honest)

| Risk | Severity | State |
|---|---|---|
| ai-elewa fail-open without `INTERNAL_SECRET` | **P0** | **FIXED in repo (fail-closed, live-verified both directions 2026-10-03)** — remaining: AI r3 release authorization to ship |
| In-process rate limiting (resets on restart; single-instance assumption) | P2 | fine for pilot; Redis backing before multi-instance |
| No centralized security-event logging (auth failures, integration failures) | P1 | structured logging recommended before revenue |
| M-Pesa callback edge signature verification | P2 | deployment obligation with real credentials |
| Upload content sniffing is extension+declared-type | P3 | deep MIME scan post-pilot |
| CSP is frame-ancestors-only | P3 | full policy future work (inline scripts of Next) |
