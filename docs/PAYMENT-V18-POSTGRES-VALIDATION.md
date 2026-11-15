# V18 Flyway Migration — PostgreSQL Validation Evidence

**Date:** 2026-10-21 · **Server:** PostgreSQL 15.17 (x64 Windows, `localhost:5433`, admin via trust on loopback)
**Runner:** `backend/flyway-validation/PgRunner.java` — plain Flyway 9.22.3 + `org.postgresql:postgresql:42.6.2` (the exact versions Spring Boot 3.2.4 dependency management resolves; jars vendored from Maven Central in `backend/flyway-validation/vendor/`).
**Configuration mirrored from the app:** `filesystem:db/migration` (same SQL files packaged in the app), placeholder `demoSeedEnabled=FALSE` (production default), `baselineOnMigrate=true`, `validateOnMigrate=true` — identical to `application-prod.yaml`/`application.yaml`.

Commands (one line form shown; executed from `backend/flyway-validation`):

```
javac -cp "$CPW;." -d classes PgRunner.java
java -cp "<classes>;vendor/*" PgRunner jdbc:postgresql://localhost:5433/<db> postgres "" <target|ALL> <seed> <migrate|validate>
psql -h localhost -p 5433 -U postgres -d <db> -c "<inspection SQL>"
```

## A. Clean installation — PASS

1. `CREATE DATABASE elekeza_v18_clean`.
2. `PgRunner ... ALL FALSE migrate` → `FLYWAY-MIGRATE initialSchema=null targetSchema=18 applied=18`, `MIGRATE OK` (exit 0).
3. Flyway history: `version=18, description='payment integrity', success=t`, exactly **1** row (`SELECT COUNT(*) FROM flyway_schema_history WHERE version='18'` → 1).
4. Catalog inspection:
   - `verification_attempts integer NOT NULL DEFAULT 0`
   - `next_verification_at` / `last_verified_at timestamptz NULL`
   - `CREATE UNIQUE INDEX ux_mpesa_tx_checkout_request_id ON public.mpesa_transactions USING btree (checkout_request_id)`
   - `CREATE UNIQUE INDEX ux_payment_checkout_request_id ON public.payments USING btree (checkout_request_id)`
5. `PgRunner ... ALL FALSE validate` → `VALIDATE OK`.
6. **Schema ↔ JPA model:** started the packaged app (`elekeza-backend-0.0.1-SNAPSHOT.jar`, prod profile, `ddl-auto=validate`, `MPESA_ENVIRONMENT=sandbox`, AI mock) against this DB on port 18999. Log `v18-hibernate-validate2.log`: Flyway `Successfully validated 18 migrations` (already applied) then `Started ElekezaApplicationKt in 34.239 seconds` — Hibernate schema validation against the V18 schema passed.

## B. Upgrade from the preceding schema — PASS

1. New DB `elekeza_v18_upgrade`, migrate **target 17** → `applied=17`.
2. Inserted representative historical, valid rows (at V17 shape):
   - institutions: 1; users: 1; fee_items: 1
   - `payments`: 1 manual CASH payment, `checkout_request_id IS NULL`
   - `mpesa_transactions`: id 1 `ws_CO_HIST_PENDING` (INITIATED, no receipt) and id 2 `ws_CO_HIST_DONE` (COMPLETED, receipt, result_code 0)
3. Migrate `ALL` → `initialSchema=17 targetSchema=18 applied=1`, `MIGRATE OK`.
4. Verified: rows preserved (1 payment, 2 mpesa rows); `verification_attempts=0` and `last_verified_at IS NULL` on both historical rows; both `ux_*` indexes exist. No data mutated.

## C. Duplicate-data and failure cases — PASS

**C1 — duplicate `payments.checkout_request_id` (DB `elekeza_v18_c1`, fresh):**
- Fresh DB → V17 (17 applied) → seeded institution/user → **two** `payments` rows with `ws_CO_DUP_1` (confirmed `COUNT(*)=2` before migrating).
- `PgRunner ALL` → **exit 1**, log `c1_flyway.log`: `SQL State : 23505`, `ERROR: could not create unique index "ux_payment_checkout_request_id"`.
- Post-migration state: **0** rows in `pg_indexes WHERE indexname LIKE 'ux_%'`; **0** verification columns on `mpesa_transactions` — the entire V18 statement batch rolled back (PostgreSQL transactional DDL); `flyway_schema_history` shows 1..17 all `success=t`, **no** failed/partial 18 row. Financial rows untouched (2 duplicate rows remain for human reconciliation).

**C2 — duplicate `mpesa_transactions.checkout_request_id` (DB `elekeza_v18_c2`, fresh):** identical result — exit 1, `23505 could not create unique index "ux_mpesa_tx_checkout_request_id"`, both historical rows intact, no partial schema.

**Recovery procedure (documented in V18 header and repeated here):** identify duplicates with the pre-flight queries in the migration header; reconcile by hand (never auto-delete/merge); re-run Flyway. The failed DB remains at V17 with all data — simply fixing the data and re-running `migrate` completes the upgrade.

**No-duplicate control:** clean DB migrated fine (§A); a second fresh DB `elekeza_v18_dup_tx` was provisioned as a control but its scenario is the same statement path as C2 (NOT VERIFIED as a separate run — the C2 evidence covers the mpesa index branch).

**Re-run after success (DB `elekeza_v18_clean`):** second `migrate` → `initialSchema=18 targetSchema=null applied=0`, `MIGRATE OK`, exit 0, `flyway_schema_history` still has exactly 1 V18 row. No schema mutation.

**Constraint enforcement (live database):**
- `INSERT ... ('ws_CO_DUPTEST', ...)` twice into `mpesa_transactions` → second blocked: `ERROR: duplicate key value violates unique constraint "ux_mpesa_tx_checkout_request_id"`.
- `payments` equivalent blocked by `ux_payment_checkout_request_id`.
- **Multiple NULLs:** two rows with `checkout_request_id = NULL` inserted successfully (nullable key requirement of manual payments / pre-provider intents).

**Application-level concurrency:** covered by Sprint 1's `MpesaIdempotencyConcurrencyTest` (4 concurrent callbacks → exactly 1 payment/credit) — re-checked in the Phase 5 regression run, not re-run here on Postgres (test suite runs on H2); noted as an environment difference, NOT VERIFIED on Postgres.

## Summary table

| Scenario | Result |
|---|---|
| Clean install V1→V18 | PASS |
| Flyway validate + app Hibernate validate against V18 | PASS |
| Upgrade V17→V18 preserving historical rows | PASS |
| Duplicate payment idempotency key fails safely | PASS (exit 1, `23505`, full rollback, data intact) |
| Duplicate mpesa idempotency key fails safely | PASS (exit 1, `23505`, full rollback, data intact) |
| No automatic deletion/merge of duplicates | PASS (by design; rows preserved) |
| Re-run idempotence | PASS (applied=0) |
| Unique index rejects live duplicates / allows multi-NULL | PASS |
| Concurrent duplicate callbacks on Postgres | NOT VERIFIED (suite runs on H2; app-level proof is in the H2 concurrency test) |
