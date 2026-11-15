# Payment Security Sprint 2 — Baseline (Phase 0)

**Date:** 2026-10-21
**Repo:** Elekeza · Branch: `feat/elekeza-pilot-completion` · HEAD at start: `1299c5bebbc2bb0a82c072b4fde347e04a73a27b` (verified with `git rev-parse HEAD`)

## 1. Verified starting state

`git status --short` (21 entries) at turn start:

- **Modified (tracked, pre-existing, PRESERVED — untouched):**
  - `backend/src/main/kotlin/com/elekeza/backend/finance/FinanceEntities.kt`
  - `backend/src/main/kotlin/com/elekeza/backend/payments/MpesaEntities.kt`
  - `backend/src/main/kotlin/com/elekeza/backend/payments/MpesaService.kt`
  - `docs/AUDIT_2026-10-15_FINAL_PILOT_READINESS.md`
  - `frontend/src/app/super-admin/page.tsx`
- **Untracked (Sprint 1 additions, PRESERVED):**
  - `backend/src/main/kotlin/com/elekeza/backend/payments/MpesaStatusVerifier.kt`
  - `backend/src/main/kotlin/com/elekeza/backend/payments/MpesaPaymentFinalizer.kt`
  - `backend/src/main/kotlin/com/elekeza/backend/payments/MpesaReconciliationService.kt`
  - `backend/src/main/resources/db/migration/V18__payment_integrity.sql`
  - Test classes: `MpesaCallbackVerificationTest`, `MpesaIdempotencyConcurrencyTest`, `MpesaReconciliationTest`, `PaymentUniquenessConstraintTest`, governance test dir
  - Sprint 1 + governance docs incl. `docs/PAYMENT-SECURITY-REMEDIATION-2026-10-16.md`

Sprint 2 did not commit, push or stage anything.

## 2. Implementation inspection (summarised)

- `V18__payment_integrity.sql`: two `CREATE UNIQUE INDEX` statements (payments, mpesa_transactions on `checkout_request_id`) + 3 reconciliation columns with DEFAULT 0; includes pre-flight duplicate query and rollback notes. Indexes are nullable-multi-NULL-safe (standard Postgres behaviour, verified below).
- `MpesaStatusVerifier.kt`: `ConfigurableMpesaStatusVerifier` (mode gate; live without credentials → `Unavailable` ⇒ fail closed) + `LiveMpesaStatusVerifier` (OAuth `/oauth/v1/generate`, STK Push Query `/mpesa/stkpushquery/v1/query`, bearer auth, base64 short-code password, `ResultCode` mapping, exception → `Unavailable`).
- `MpesaReconciliationService.kt`: per-row transactional worker + scheduler; backoff (capped 1h, base 30s), max attempts 8 → `REQUIRES_REVIEW`; no-op unless `isLive`.
- `MpesaPaymentFinalizer.kt`: single credit gate after a conditional `UPDATE` win; credit failure rolls back the transition.
- Flyway configuration: enabled only outside `dev` (`application.yaml`, `application-prod.yaml`, `ddl-auto: validate` in prod). Postgres driver pinned 42.6.2, Flyway 9.22.3 (Spring Boot 3.2.4 dependency management).
- Test infrastructure: H2-in-memory (dev/test profiles); no Testcontainers / Postgres test harness existed.

## 3. Infrastructure actually available on this machine

| Resource | State |
|---|---|
| Docker (29.2.1) | installed, daemon NOT running (Docker Desktop not started) |
| PostgreSQL 15.17 | **validating server on localhost:5433**, trust-auth as `postgres`; used for validation DBs `elekeza_v18_*` |
| PostgreSQL 15/17 EDB installs | `C:\Program Files\PostgreSQL\15` binaries; 17 dir lacks bin |
| Java | Temurin 21.0.9 |

Validation DBs created for this sprint (disposable, no user data):
`elekeza_v18_clean`, `elekeza_v18_upgrade`, `elekeza_v18_c1`, `elekeza_v18_c2`, `elekeza_v18_dup_pay` (accidental V18-applied control), `elekeza_v18_dup_tx` (control).rowCountSummary: clean/upgrade/c1/c2 are the evidence DBs.

Reproducible runner: `backend/flyway-validation/` (`PgRunner.java`, `vendor/*` jars pinned to Boot versions, `db/migration` copy of the real SQL, logs `c1_flyway.log`, `c2_flyway.log`, `d_rerun.log`, `v18-hibernate-validate*.log`). Runs outside the repo build; adds no dependencies to the app.

## 4. Environment incidents (documented for the record)

- The C: drive was at 0 bytes free at sprint start; with user approval, `C:\Dev\gradle\caches` and `~/.gradle/caches` were deleted (dependency caches, re-downloadable). One Gradle daemon (PID 61020) was killed to release locks. 1.3 GB freed; disks return to 100% pressure on full rebuilds.
- Port 18080 had a pre-existing listener (PID 90472, not owned by this sprint) — ignored; validation used 18999.

## 5. Known limitations mapped to sprint tasks

| Sprint 1 limitation | Sprint 2 task | Status |
|---|---|---|
| V18 never executed on Postgres | Phase 1 validation | **DONE (PASS)** — see `docs/PAYMENT-V18-POSTGRES-VALIDATION.md` |
| Live Daraja sandbox unverified | Phase 2 sandbox verification | **BLOCKED** (no authorised sandbox credentials exist in this environment) — protocol conformance proven by scripted HTTP tests; see `docs/PAYMENT-DARAJA-SANDBOX-VERIFICATION.md` |
| Edge IP allowlisting not enforced | Phase 3 operational definition | **NOT ENFORCED** — edge block prepared and shipped inert; see `docs/PAYMENT-EDGE-ALLOWLIST-OPERATIONS.md` |
| Payment initiation audit coverage | Phase 4 audit events | **DONE** — 14 lifecycle events implemented and asserted; see `docs/PAYMENT-EVENT-AUDIT.md` |

Sprint 2 outcome summary (regression + verdict): `docs/PAYMENT-SECURITY-SPRINT-2-REPORT.md`.
