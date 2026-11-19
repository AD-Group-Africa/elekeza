# ELEKEZA — Pre-Pilot Audit

**Date:** 15 November 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5` · no commit, push or deploy.

**Method:** this audit inspects the repository as it actually is. Where a claim could be checked by reading code or running something, it was; where it could only be inherited from an earlier document, it is marked as such. Nothing here is upgraded to "verified" because a previous report said so.

**Severity:** P0 blocks any real-user pilot · P1 must be closed before the affected workflow is piloted · P2 needs a documented mitigation and owner · P3 can follow the pilot if safe.

---

## 1. What the product actually is

| Measure | Value | How established |
|---|---|---|
| Backend controllers | 38 | file count in `backend/src/main/kotlin` |
| HTTP endpoints | 176 (93 GET, 69 POST, 7 PUT, 4 DELETE, 3 PATCH across 44 route groups) | annotation grep |
| Frontend routes | 61 pages | `find frontend/src/app -name page.tsx` |
| Roles | STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN | `UserRole.kt` |
| Services | Spring Boot backend, Next.js frontend, FastAPI `ai-elewa`, PostgreSQL, Redis, nginx | `docker-compose.yml` |

Functional areas present in code (controllers): auth, accessibility profiles, analytics, assignments, attendance, billing, competency progress, content, country config, curriculum, deadlines, devices, engagement, exams, finance, gamification, guardian (schedule, reports, ward detail, digest, link lifecycle), health, institutions, mastery, messages, M-Pesa, onboarding, progress, quizzes, staff management, student progress, support, teacher, timetable, tutor, waitlist.

**Assessment:** this is not a prototype shell — the surface is broad and the guardian/deadline/county paths are demonstrably working against a real database. What is **not** established is how much of that breadth works end-to-end for a real school day. Breadth is not readiness.

## 2. Roles and authorization

| Check | Status | Evidence |
|---|---|---|
| Five roles exist and are enforced via `@PreAuthorize`/route rules | VERIFIED (code) | `SecurityConfig`, controller annotations |
| Registration always creates STUDENT | VERIFIED | `AuthService.register`; live 201 + `role: STUDENT` |
| Login / session / `/me` | VERIFIED (live, both PG majors) | 200/200/200 |
| Anonymous access refused on guardian endpoints | VERIFIED | 401 live |
| Non-guardian refused on guardian schedule | VERIFIED | 403 in the 37/37 contract |
| Revoked and expired guardian links expose nothing | VERIFIED | contract §5–6 |
| Cross-county deadline isolation | VERIFIED | contract §3–4 |
| Logout, password reset, account activation | PARTIALLY VERIFIED | endpoints exist (`/forgot-password`, `/reset-password`); not exercised end-to-end in this programme |
| MFA | NOT VERIFIED — **absent** | no TOTP/MFA code exists |
| Cross-school isolation beyond deadlines/guardians | PARTIALLY VERIFIED | enforced in query scoping; no exhaustive multi-tenant test |

## 3. Core workflows

| Journey | Status | Note |
|---|---|---|
| Guardian: link → see only linked learners → progress → school dates | VERIFIED | 37/37 live contract on PG16, plus H2 lifecycle suites |
| Guardian: revoked/expired links, county-less institution fails closed | VERIFIED | contract §5–8 |
| Learner: read deadlines / content | PARTIALLY VERIFIED | `/api/deadlines` 200 for an authenticated student; full lesson journey not exercised |
| Learner: complete activities, receive feedback | NOT VERIFIED | quiz/progress controllers exist; no end-to-end run |
| Teacher: classes, assignments, progress recording | NOT VERIFIED | controllers exist (`TeacherController`, `AssignmentController`); no live run |
| School admin: staff, learners, institutional reports | NOT VERIFIED | controllers exist; no live run |
| Platform admin: platform functions, school isolation | PARTIALLY VERIFIED | admin login and county-wide reads exercised |

**This is the audit's most important gap.** The guardian journey — the one that carries the pilot's promise — is proven. Teacher and learner journeys are implemented but have not been demonstrated end to end.

## 4. Accessibility and inclusive learning

Present in code: `useTextToSpeech.ts`, `components/accessibility/ReadingToolbar.tsx`, `useAccessibilitySettings.tsx`, and server-side `AccessibilityProfileController` + entity.

| Check | Status |
|---|---|
| Text-to-speech implementation exists | VERIFIED (code) |
| Accessibility profile persisted per learner | VERIFIED (code) |
| Screen-reader correctness, contrast ratios, touch-target sizes, keyboard order | **NOT VERIFIED** — no assistive-technology test performed |
| Kiswahili support | PARTIALLY VERIFIED — localisation exists in parts of the UI; not audited for coverage |
| Low-bandwidth / older Android behaviour | NOT VERIFIED |

**No WCAG conformance is claimed.** For a product aimed at SNE learners this is a P1 and is not a paperwork exercise: it needs testing with a screen reader and a low-spec device.

## 5. Security and privacy

| Area | Status | Detail |
|---|---|---|
| CSRF | VERIFIED (config) | `CookieCsrfTokenRepository.withHttpOnlyFalse()`, exemptions limited to auth + csrf endpoints (documented in `SecurityConfig`) |
| Session cookies | VERIFIED (config) | `secure-cookies: ${SECURE_COOKIES:true}` — secure by default in prod |
| CORS | VERIFIED (config) | driven by `app.cors.allowed-origins`; not wildcarded |
| Login rate limiting | VERIFIED (code) | `LoginRateLimiter`; waitlist has its own. **Not global** — see P2 |
| File upload | VERIFIED (code) | size cap, extension allowlist, path-traversal sanitisation, UUID filename, `hasAnyRole('TEACHER','SCHOOL_ADMIN','ADMIN')` |
| JWT handling | VERIFIED (tests) | `JwtTokenTypeTest` 3/3 |
| SQL injection | PARTIALLY VERIFIED | JPA/derived queries throughout; no bespoke SQL audit, no scanner run |
| Dependency vulnerabilities | PARTIALLY VERIFIED | driver upgraded to a security patch (42.7.14); no automated CVE scan of the full tree |
| Penetration test / external review | **NOT PERFORMED** |
| Personal-data logging | NOT VERIFIED | no log-content audit performed |
| **Consent capture** | **CLOSED 2026-11-15** | as audited: no consent feature in the backend. Now `POST /api/privacy/consent` with versioned wording — see `docs/operations/ELEKEZA_PRIVACY_CONSENT_ERASURE_RETENTION.md` |
| **Account deletion / data erasure** | **CLOSED 2026-11-15** | as audited: no user-deletion endpoint. Now `POST /api/privacy/erasure` anonymises, revokes access and deactivates the account |
| **Retention / disposal policy** | **CLOSED 2026-11-15** | as audited: absent in code and docs. Now a daily 03:30 sweep with `retention_runs` evidence and an admin dry run |
| Child-data legal basis | **NOT ASSESSED** — requires Kenyan DPA/DPIA review, not a technical audit |
| Error reporting (Sentry) | PARTIALLY VERIFIED | `SENTRY_DSN` is passed by compose, but no Sentry wiring is visible in backend resources |

**Privacy is the second decisive gap.** Elekeza can technically hold children's data; it has no consent capture, no erasure path and no retention rule, and no legal review has taken place.

> **Update 2026-11-15:** the three engineering items above are now implemented, tested and exercised on PostgreSQL 16 — see `docs/operations/ELEKEZA_PRIVACY_CONSENT_ERASURE_RETENTION.md`. The legal position is unchanged: no DPIA, no reviewed consent wording, and no guardian-facing consent screen exists yet, so this gap is reduced, not closed.

## 6. Performance and reliability

| Check | Status | Measurement |
|---|---|---|
| Backend cold start | VERIFIED (observational) | 32–105 s on an 8 GB developer laptop under load; not a benchmark |
| Health endpoint | VERIFIED | 200 on both majors |
| Migration time | VERIFIED | V1–V20 in 4.7–9.9 s on an empty database |
| Query performance at scale | NOT VERIFIED | datasets were 4–9 rows |
| Load / concurrency | NOT VERIFIED | never tested |
| Memory behaviour | PARTIALLY VERIFIED | one Node build died at 826 MB free host memory; JVM steady-state memory not measured |
| Timeout/retry behaviour, AI latency, Redis behaviour | NOT VERIFIED |

No scalability claim is made. The stack has never been run with realistic data volumes or concurrent users.

## 7. Integrations

| Integration | Status | Evidence |
|---|---|---|
| SMS | **MOCK** by default | `MockSmsProvider`, `AfricaTalkingSmsProvider`; compose default `SMS_PROVIDER=mock` |
| Email | **MOCK** by default | `MockEmailProvider`; `EMAIL_PROVIDER=mock` |
| Storage | **MOCK** by default | `MockStorageProvider`, `CloudflareR2Provider`; `STORAGE_PROVIDER=mock` |
| AI | **MOCK** available | `MockAiClient`; FastAPI service exists (`main.py`, `ai_client.py`, `langfuse_client.py`) |
| M-Pesa / Daraja | Code present, **not exercised here** | `MpesaController`; `FEES_MPESA_MODE=mock` default. Earlier sandbox docs exist but were not re-run |
| Error tracking | DSN wired in compose, wiring unverified (§5) | — |

No live messages, payments or external calls were made during this programme. **No integration is production-tested.**

## 8. Operations

| Item | Status |
|---|---|
| Hosted environment | **BLOCKED** (no account/approval) |
| Backups | Tooling verified; **no schedule, no off-site copy, no encryption** |
| Restore | Verified on developer databases; not rehearsed on a host |
| Migration strategy | Forward-only Flyway; rollback = restore pre-deploy dump (documented) |
| Monitoring/alerting | Not configured beyond compose healthchecks |
| Incident process, escalation, support rota | **ABSENT** |
| Runbooks | Backup/restore and hosting runbook now exist; nothing else |

---

## 9. Findings register

| ID | Finding | Severity | Owner |
|---|---|---|---|
| A-01 | No hosted staging environment exists; the product cannot be demonstrated or validated over HTTPS | **P0** | Founder + engineering |
| A-02 | No legal/privacy review (DPIA) for children's data; Kenyan DPA obligations unassessed | **P0** | Founder + legal adviser |
| A-03 | No consent capture, no account erasure, no retention rule | **P0** | Backend |
| A-04 | Backups are unscheduled, host-local and unencrypted; a host loss loses all data | **P0** | Operations |
| A-05 | Teacher and learner journeys have not been demonstrated end to end | P1 | Engineering |
| A-06 | No accessibility assessment with assistive technology for an SNE-focused product | P1 | Frontend + accessibility specialist |
| A-07 | No penetration test or independent security review | P1 | Security |
| A-08 | Integrations are mock/local; no sandbox verification in this programme, no production credentials | P1 | Integrations |
| A-09 | Password reset and activation flows unexercised; no MFA | P2 | Backend |
| A-10 | Rate limiting only on login and waitlist; other endpoints unthrottled | P2 | Backend |
| A-11 | No load or performance evidence; dataset sizes trivial | P2 | Engineering |
| A-12 | Sentry DSN passed but wiring unverified; no centralised logs or alerting | P2 | Operations |
| A-13 | Upload stores to local disk rather than R2; no content sniffing/malware scan | P2 | Backend |
| A-14 | No incident process, support rota or escalation path | P2 | Founder |
| A-15 | Flyway 12/13 blocked by Spring Boot 3.2.4 | P3 | Engineering |
| A-16 | Test suite is H2-based; PostgreSQL coverage depends on the contract script | P3 | Engineering |

## 10. Minimum pilot scope (recommendation)

The first school contact should see — and only see — what has been proven:

**In scope:** guardian account creation and linking; guardian visibility of linked learners only; school dates/deadlines with county scoping; learner viewing of assigned content and deadlines; teacher viewing assigned classes and assigning reading; accessibility settings (TTS, reading toolbar) as *optional aids*, not a compliance claim.

**Out of scope for the first contact:** fee payments (keep `FEES_MPESA_MODE=mock`), SMS/WhatsApp messaging to guardians, AI tutor in front of children, exams/analytics dashboards, device management, multi-school administration.

This is deliberately narrow. Expanding scope before the teacher and learner journeys are proven is how pilots fail in front of the people they are meant to convince.

## 11. What would change this verdict

1. A hosted staging environment with HTTPS, isolated database and scheduled off-site backups.
2. A Kenyan data-protection review with a DPIA, plus consent/erasure/retention implemented.
3. End-to-end demonstration of teacher and learner journeys on staging.
4. One accessibility pass with a real screen reader and a low-end Android device.
5. A penetration test or at minimum an external review of the auth and guardian paths.

Four of those five are within the team's control.
