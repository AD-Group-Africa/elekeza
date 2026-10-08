# Elekeza — Full Project Production Audit

Date: 2026-09-04 · Branch: `release/v0.1.0`
Scope: authentication, authorization, multi-tenancy, content, AI safety,
personalization, curriculum integrity, lessons, quizzes, **exams (status)**,
payments/M-Pesa, subscriptions, guardian/teacher/admin scope, files, offline,
notifications, analytics, database, performance, production config, CI/CD,
accessibility, full E2E.

## 1. Executive summary

Elekeza was audited from the verified Phase 3 + personalization baseline
(108/108 backend, frontend build/typecheck/lint green). The audit executed
live probes and code review across every subsystem, found **three real
defects**, fixed all three with regression tests, hardened a fourth area
(login rate limiting semantics), and re-verified everything.

| Defect | Severity | Status |
| --- | --- | --- |
| File-upload path traversal via crafted multipart filename (`../../x.txt` resolved outside `uploads/`; unhandled → HTTP 500 leaking filesystem paths) | **P1** | Fixed + regression tests + live re-probe |
| Quiz score inflation: repeating the same question submission in `/complete` could push `score > 100%` | **P1** (assessment integrity) | Fixed + regression test |
| M-Pesa callback accepted forged/duplicate/terminal-state callbacks with no state machine, amount binding or unknown-id rejection | **P1** (payment integrity) | Fixed + 6 regression tests |
| Login rate limiter used greedy refill → lockout bypassed after ~333 ms and tests were timing-flaky | **P2** | Fixed (interval refill) + suite re-run ×3 deterministic |

All external-provider verification is explicitly **BLOCKED — no credentials**
(real AI, M-Pesa Daraja, SMS, email, R2, remote GitLab CI, staging host). No
result in this document claims otherwise.

### Tests

```
Backend (final):  117/117 green — 0 failures, 0 errors, 0 skipped
Frontend typecheck: PASS        ESLint (changed): PASS
Production build (next build --webpack + PWA): PASS (sw.js regenerated)
Live probes:       PASS (see E2E evidence)
```

## 2. Repository baseline

- Backend: Spring Boot 3.2.4 / Kotlin, JPA + Flyway (V1–V7), PostgreSQL in
  prod, H2 in dev/tests, mock external providers by default.
- Frontend: Next.js 16 (webpack), PWA (next-pwa/workbox), Tailwind.
- No exam engine exists: `/exam` and `/teacher/exams` are explicit
  "Coming Soon" pages (expected Q1 2027) — there are **no exam routes,
  endpoints, entities or graders to attack**. Exam integrity is N/A at this
  release and must not be claimed.
- No subscription/entitlement engine consumes M-Pesa transactions: payments
  are recorded for revenue/analytics; nothing grants or revokes access from a
  payment row. (Roadmap gap, not a live privilege boundary.)

## 3. User access matrix (roles actually implemented)

| Capability | Visitor | STUDENT | TEACHER | GUARDIAN | SCHOOL_ADMIN | ADMIN |
| --- | --- | --- | --- | --- | --- | --- |
| Register (self) | yes → STUDENT only | — | — | — | — | — |
| Login/logout/refresh | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Learner preferences / adaptations | — | own only | — | — | — | — |
| Teacher students/assignments/content | — | — | ✓ (institution) | — | ✓ | ✓ |
| Guardian wards/reports | — | — | — | linked wards only | — | ✓ |
| Institution admin | — | — | — | — | own institution | platform |
| Content upload text/file | — | **blocked (403)** | ✓ | — | ✓ | ✓ |
| M-Pesa STK push | — | — | — | — | ✓ | ✓ |
| M-Pesa revenue | — | — | — | — | — | ✓ |
| Analytics | — | own | institution | own wards | institution | platform |
| Actuator | health only | — | — | — | — | — |

## 4–6. Authentication, authorization, multi-tenancy

Verified by automated suites (`AuthAndInputSecurityTest`, `MultiTenantAuthorizationTest`,
`ContentAuthorizationTest`, `GuardianAnalyticsAuthorizationTest`, `SupportAuthorizationTest`,
`PersonalizationIntegrationTest`, `QuizReviewTest`) plus live probes:

- Registration: role is hard-coded `STUDENT` (no role escalation); email
  regex + duplicate → 409 (generic); password ≥ 8 with letter+digit; name and
  terms required; email normalised lower-case.
- Login rate limiting: per-account+IP token buckets, interval refill
  (hard lock until window passes); account-existence not revealed (401 for
  wrong password and unknown user; 429 on quota).
- JWT access cookies + rotating refresh tokens; malformed/forged claims are
  not trusted (server resolves the principal); CSRF token required for every
  state change (live: no-token PUT → 403); CORS allowlist with credentials
  (live: `https://evil.example` preflight → 403, no allow-origin).
- IDOR/tenant matrix is encoded in tests: cross-institution and cross-role
  reads/writes on profiles, progress, lessons, adaptations, quiz results,
  support signals and guardian wards return 403.
- New security headers verified live: `Content-Security-Policy:
  frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, plus Spring
  defaults (`nosniff`, `X-Frame-Options: DENY`).

## 7–8. Content & AI safety

- Learners cannot create content (403 on both upload paths, enforced
  server-side with `@PreAuthorize` — automated tests).
- No edit/delete/publish endpoints exist beyond upload → list → read →
  assign; no attack surface there.
- AI: every external call goes through `AiClient`; with `ai.client.type=mock`
  (all verified environments) nothing leaves the process. Real mode is
  **BLOCKED (no provider)**. The personalization adaptation path sends only a
  neutral learner context (no SNE/diagnostic labels) + content text; output is
  validated (diagnostic phrase blacklist, key-term preservation, length floor)
  before caching, with deterministic fallback. Legacy content/quiz pipeline
  still forwards the school-recorded SNE profile in real mode — pre-existing
  contract, documented as a deployment checklist item.
- Lesson content is rendered as escaped text (no `dangerouslySetInnerHTML`),
  limiting stored-XSS via teacher content.
- Content safety (violence/hate/self-harm etc.): no moderation pipeline exists;
  content is teacher-authored and AI is mock today. When real AI is enabled, a
  moderation/curriculum gate is a deployment requirement (documented).

## 9–12. Personalization, privacy, safety, curriculum integrity

Verified live and by tests: per-student profiles with source precedence
EXPLICIT > TEACHER > GUARDIAN > OBSERVED > SYSTEM; teacher guidance cannot
override an explicit learner choice (409 live); cache keys are learner-scoped
(Student B can never receive Student A's adaptation — 403 live); summaries
never contain diagnostic terms (asserted in tests); adaptations preserve every
source sentence by construction and the original stays available. All flows
re-verified green in the final suite.

## 13–14. Lessons / assignments / quizzes

- Assignment = institution-scoped `LessonProgress` rows; teacher assignment
  list is real (verified live: assign → row appears).
- Quiz scoring is server-authoritative; answer key never returned while
  answering (test); review requires own completed attempt; question IDs are
  bound to the quiz in the path; **NEW: duplicate question submissions can no
  longer inflate the score** (regression test: repeats of a correct answer on
  a 2-question quiz still score 50).
- Progress writes are server-derived from attempts (no client score).

## 15–17. Exams

**Not implemented.** Learner and teacher exam pages are "Coming Soon"
placeholders; there are no exam controllers, entities, migrations, or graders.
Nothing to attack, nothing to fix; scored N/A at this release with the Q1-2027
roadmap noted. Assessment-integrity rules apply to the shipped quiz engine.

## 18–21. Payments / M-Pesa / subscriptions

- STK push: ADMIN/SCHOOL_ADMIN only; positive amount enforced; unconfigured
  provider → 503.
- Callback: **hardened** — state machine (INITIATED/PENDING → COMPLETED |
  FAILED), terminal states are final (duplicate and FAILED→COMPLETED replays
  ignored), callback amount must match the initiated amount, unknown
  CheckoutRequestIDs rejected; all six regression tests pass. Signature
  verification with Safaricom's public key is still a deployment requirement
  once real credentials exist (documented in code + this report).
- Subscriptions/entitlements: not implemented — nothing consumes transaction
  status to grant access (documented gap, not exploitable today).
- Revenue endpoint: ADMIN-only aggregate.

## 22. File upload security

- **Fixed P1 path traversal**: stored names are now flattened
  (`UUID + sanitized`) with separators removed and absolute write target;
  storage failures map to 400 with server-side logging (no path leak).
  Live re-probe: `../../pwned.txt` now stored safely inside `uploads/` as a
  flat name; nothing escaped.
- Extension allow-list (PDF/doc/docx/txt/rtf/odt/images), 10 MB cap, UUID
  storage names. Serving files by URL is not implemented (no public file
  route), so no accidental public exposure exists.

## 23–26. API hardening / frontend / CSRF / headers

- Malformed JSON, invalid IDs/enums → 400 via the global handler with
  consistent error bodies (tests); no stack traces in responses.
- Frontend: httpOnly JWT cookie flow; CSRF via per-request token fetch;
  axios 401 redirect; route guards; no risky HTML rendering.
- CSRF enforced live (403); evil-origin CORS rejected live (403, no ACAO).
- Security headers verified live (CSP frame-ancestors, no-referrer, nosniff,
  DENY). No HSTS (no TLS terminated in this environment — deployment
  requirement behind a real proxy).

## 27–29. Offline / notifications / analytics

- PWA service worker (workbox): app shell precache; NetworkFirst for
  `/api/content/*` (lessons + adaptations), quizzes, progress, notifications,
  and (new) `/api/learner/preferences`. Offline: cached lesson/adaptation
  shown; no cached adaptation → original lesson; learning never blocked.
  Preference writes offline are not queued for sync (documented limitation).
- Notifications: ownership enforced on mark-read (no cross-user mutation);
  Phase 3 fixed link navigation (V6 migration) stays green in the suite.
- Analytics: role- and institution-scoped; guardian analytics restricted to
  linked wards; Phase 3 removed N+1s; teacher/student scoping tests green.

## 30–32. Guardian / teacher / admin privacy

All enforced at the service/repository level and covered by green tests:
guardians see only linked wards (live: 403 on another ward), teachers only
their institution's students, SCHOOL_ADMIN scoped to own institution on
student/analytics endpoints, platform ADMIN separate.

## 33–36. Database / retention / error handling / performance

- Migrations additive (V6, V7); `ddl-auto=validate`; entities have indexes
  on lookup paths; no orphan-producing cascades found in audited paths.
- Minimal learner data stored; adaptations are content transforms of lessons
  already stored; events attributable (learner, content, type) with no lesson
  text logged; no sensitive content in logs.
- Graceful degradation: AI failures, provider outages and notification
  failures all fall back or degrade without breaking learning/payment flows
  (code-verified; real provider outages not injectable here).
- Performance: adaptation cache prevents repeated AI/regeneration; profile
  reads are single JSONB lookups; per-request queries in teacher/guardian
  lists are bounded by repository filters; no unbounded `findAll` on
  learner-facing paths (revenue/audit aggregations are ADMIN-only).

## 37–38. Production config / CI-CD

- No committed secrets (all via env, `.env.example` reviewed earlier);
  production profile requires DB/JWT/CORS env; dev profile is H2+Flyway-off
  and cannot leak into prod; actuator = health only; secure-cookies default
  true (dev false via dev profile); CORS explicit.
- External providers all default to `mock` and fail closed when credentials
  are absent.
- CI: full local rehearsal executed (compile, backend suite, FE typecheck,
  lint, production build incl. PWA). Actual GitLab runner execution:
  **CI REHEARSAL VERIFIED — ACTUAL REMOTE RUN NOT AVAILABLE.**

## 39. Browser / device matrix

Live verification on desktop Chrome-equivalent (preview) covered learner,
teacher and guardian journeys at desktop and mobile-narrow layouts
(responsive tables/cards). Keyboard-only and screen-reader automation is not
in CI — see Accessibility below.

## 40. Full business flow (live)

`register is STUDENT-only → demo admin institution exists → teacher@elekeza.app
assigns content → student@elekeza.app personalizes profile → opens lesson →
profile-driven adaptation + feedback → teacher sees learning-support summary +
guidance precedence → guardian@elekeza.app sees ward plain-language card →
logout/relogin persists profile`. Quiz flow exercised by the quiz test suite
(start → answer → complete → review). Payment/subscription/exam flows are
provider-blocked or not implemented (documented).

## 41–43. Failure injection & defect register

| ID | Class | Severity | Status |
| --- | --- | --- | --- |
| F-1 | Upload path traversal / 500 + path leak | P1 | Fixed + tests + live re-probe |
| F-2 | Quiz duplicate-submission score inflation | P1 | Fixed + regression test |
| F-3 | M-Pesa callback integrity (state/amount/duplicates) | P1 | Fixed + 6 tests |
| F-4 | Login limiter greedy refill (lockout bypass/flake) | P2 | Fixed + deterministic |
| F-5 | No exam engine | Roadmap | N/A (placeholder pages) |
| F-6 | No subscription/entitlement engine | Roadmap | N/A (documented) |
| F-7 | Real-provider + CI + staging verification | External | BLOCKED — no credentials/infra |
| F-8 | Full axe/keyboard WCAG automation in CI | P3 | Documented gap |
| F-9 | CSP limited to frame-ancestors (no full policy) | P3 | Documented; next.js inline-script safe policy is future work |
| F-10 | Guardian/teacher pages show legacy recorded SNE chip | P3 | Pre-existing; personalization never derives from it |

No P0 remains. No P1 remains after this audit's fixes.

## 44. Final scorecard

```
AUTHENTICATION              READY
AUTHORIZATION               READY
MULTI-TENANCY               READY
CONTENT                     READY
AI SAFETY                   READY (mock verified; real provider BLOCKED)
PERSONALIZATION             READY
CURRICULUM INTEGRITY        READY
LESSONS                     READY
QUIZZES                     READY
EXAMS                       NOT APPLICABLE (not implemented — Q1 2027)
PAYMENTS                    READY (code) — real Daraja BLOCKED
M-PESA                      READY (code, hardened) — real callbacks BLOCKED
SUBSCRIPTIONS               NOT APPLICABLE (not implemented)
GUARDIAN                    READY
TEACHER                     READY
ADMIN                       READY
FILES                       READY (traversal fixed + tested)
OFFLINE                     READY (cached reads; no queued offline writes)
NOTIFICATIONS               READY
ANALYTICS                   READY
ACCESSIBILITY               READY (WCAG-oriented; axe automation P3)
PERFORMANCE                 READY
PRODUCTION CONFIG           READY
CI/CD                       REHEARSED LOCALLY — remote runner BLOCKED
FULL E2E                    READY (within available local infrastructure)
```

## Final decision

```
CODE:        GO
SECURITY:    GO
PRODUCT:     GO
OPERATIONAL: BLOCKED (real AI / M-Pesa / SMS / email / R2 credentials,
              remote GitLab CI runner, staging host, DNS/TLS not available in
              this environment — nothing was fabricated)
OVERALL:     CONDITIONAL GO — CODE GO, OPERATIONAL GO BLOCKED BY EXTERNAL
              INFRASTRUCTURE
```

Release checklist before flip to OPERATIONAL GO: provision + test real
providers (AI, Daraja with callback signature verification enabled, SMS,
email, R2), run the acceptance pipeline on a real GitLab runner, deploy to a
staging host behind TLS with HSTS, and execute the exam roadmap item when the
exam engine ships.
