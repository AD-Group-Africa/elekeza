# ELEKEZA — FINAL DECISION TABLE & PILOT READINESS

2026-10-02 · HEAD `b139b8e` (frozen r2 untouched; fix-loop + pilot-readiness fixes in working tree, uncommitted)

## Decision table

| Area | Status | Evidence | Blocker? | Owner |
|---|---|---|---|---|
| Frontend | **GREEN** | 31/31 E2E, 4 role journeys, tsc clean, 59-route prod build (prior) | No | Agent |
| Backend | **GREEN** | 278/278 tests incl. new credential fixes; acceptance journey end-to-end | No | Agent |
| Database | **GREEN** | zero orphans/duplicates, V16 migrations, backup+restore drill PASSED | No | Agent |
| Auth | **GREEN** | 401/403/404/422/429 matrix + object-level cross-tenant denials all correct | No | Agent |
| Learn (lessons/progress/a11y) | **GREEN** | learner journey 22/22 incl. persistence loop | No | Agent |
| Quiz | **GREEN** | start→answer→complete score=20.0 on fresh AI lesson; 409 duplicate guard | No | Agent |
| Attendance | **AMBER** | works for seeded classes; **new schools blocked — no class-creation endpoint** (EL-F-007) | Yes (EL-F-007) | Harry decision → Agent build |
| AI | **GREEN** code / **RED** deploy-default | live Groq from FE, graceful degradation; **P0 fail-open when INTERNAL_SECRET unset** | Yes (PILOT-01) | Harry (r3 authorization) |
| ERP (staff/students/finance/analytics) | **GREEN** | staff OTP handover fixed+verified; students/analytics live | class-creation gap only | Agent/Harry |
| Guardian | **GREEN** view / **AMBER** messaging | ward isolation 403s; messages persist sender-only (EL-NEW-02) | No (for pilot) | Harry (design) |
| Safiri | **RED — not implemented** | repo-wide verification; no routes/vehicles/trips/boarding code | Yes (PILOT-05) | Harry (build-or-descope) |
| Notifications | **AMBER** | in-app channel functional+persisted; email/SMS = mock (labelled) | No (pilot) | Harry (creds) |
| M-Pesa | **AMBER** | full mock chain idempotent+tamper-proof; live blocked on Daraja creds | Only if live payments in scope | Harry (creds) |
| Security | **GREEN** locally / **P0** one config default | security-results.md gate | Yes (PILOT-01) | Agent fix + Harry release |
| Deployment | **AMBER** | compose+nginx+certbot wired; staging-gate PASSED; execution pending | Domain/TLS | Harry |
| Domain/DNS/TLS | **RED** | nothing provisioned | Yes | Harry |
| E2E | **GREEN** | 31/31 + 4 journeys + AI degradation + acceptance script | No | Agent |

## MUST FIX BEFORE PILOT

| # | File/Service | Exact problem | Severity | Proposed fix | Dependency | Effort | Test required | Harry needed? |
|---|---|---|---|---|---|---|---|---|
| 1 | `ai-elewa/security.py:10` (+ start command) | `INTERNAL_SECRET` defaults to `""` → unauthenticated `/ai/*` accepted (fail-open, live-verified) | **P0 security** | Fail fast at startup when empty; optionally r3 tag | AI release decision (repo frozen at r2) | 0.5 d | Fail-closed probe: no-key POST → 401; with key → 200; backend tutor round-trip | **Yes — authorize r3** (no credential needed) |
| 2 | Backend (no endpoint) + `frontend/src/app/admin/*` | New schools cannot create classes → attendance impossible (EL-F-007) | **P1 product gap** | `POST /api/institutions/{id}/classes` + FE form; reuse existing class model | Product decision on scope | 1–2 d | Create class → enroll → attendance session → learner history | **Yes — decide scope** |
| 3 | Safiri (absent) | Transportation/safety module does not exist | **P0 scope** | EITHER minimal clearly-labelled pilot module (routes/vehicles/trips/boarding/arrival + notifications + audit; 1 migration + 1 controller + 2 screens) OR descope from pilot | Harry decision | 5–8 d build / 0 descope | Trip → boarding → guardian notification → arrival → audit trail | **Yes — build or descope** |
| 4 | Registrar + `infrastructure/nginx` + server `.env` | No domain/DNS/TLS; prod yaml AI host is a placeholder | **P1 deployment** | Execute deployment-checklist.md (records, certbot, secrets, gate re-run) | Domain access, server | 0.5–1 d | `staging-gate.sh` against live origin + HTTPS probes | **Yes — provide domain/server** |
| 5 | Server `.env` (Daraja) | Live payments impossible (mock works, labelled) | P1 **conditional** | Set MPESA_* + `FEES_MPESA_MODE=live` + edge signature verification | Daraja credentials | 0.5 d config | STK push → callback → payment row → duplicate ignored | Only if live payments are in pilot scope |

## CAN FIX DURING PILOT

| # | File/Service | Problem | Sev | Fix | Effort | Harry? |
|---|---|---|---|---|---|---|
| 6 | Backend finance/content error paths | Internal AI host:port + provider JSON visible in degradation copy (EL-NEW-03) | P2 | Sanitize for non-dev profiles | 0.5 d | No |
| 7 | `student-home/page.tsx` | "N points to Level X" wording (EL-NEW-05) | P3 | Copy tweak | 0.25 d | No |
| 8 | `.env` templates | Dead Google OAuth config (EL-NEW-06) | P3 | Remove or implement | 0.25 d remove | Decide |
| 9 | `MessageController.kt` | Two-way message delivery (EL-NEW-02) | P2 | Routing design → recipient-addressed rows + thread reads | 2–3 d | Design approval |
| 10 | `backend/.env` (MAIL_*/AT) | Password-reset + notification emails/SMS (providers implemented, inert) | P2 | Credentials only; UI handover already works (OTP fix) | 0.5 d config | **Creds** |
| 11 | Server `.env` (R2) | External storage switch | P3 | Config; provider implemented | 0.5 d | Creds |
| 12 | Observability | Langfuse/Sentry keys | P3 | Config only | 0.25 d | Creds |

## POST-PILOT

- Global API rate limiter (beyond login/waitlist) · remove backend `dev-secret` AI fallback (rides r3)
- Redis enablement · audit-log viewer UI · password rotation policy · CSV import UX hardening (templated errors, bulk guardian invites)
- Real-device (Android tablet) field acceptance · offline sync expansions · billing/eTIMS · multi-school admin tooling

## Commits (rule 13 — prepared, NOT executed)

No commits made (frozen release; mixed user WIP in tree). Coherent commit sets ready on request:
1. `fix(institution): return one-time credentials in CSV import + staff create` — InstitutionService.kt, StaffManagementService.kt, school/import/page.tsx, admin/staff/page.tsx + tests
2. `fix(frontend): closure-loop a11y/UX fixes` — lesson/[id], attendance, quiz/[lessonId], admin/staff loading, assignments
3. `test(ai): port from env` — ai-elewa/tests/test_edge_cases.py
4. `docs: pilot-readiness evidence pack` — the 3 root docs + CHANGELOG + release-evidence/ + e2e-evidence/ + scripts
