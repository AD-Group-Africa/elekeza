# ELEKEZA — Readiness Register (Executive)

**Date:** 15 November 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5` · no commit, push or deploy performed.

One page for anyone who needs to know where Elekeza actually stands without reading the technical reports. Detail: `ELEKEZA_DATABASE_AND_STAGING_READINESS.md`, `ELEKEZA_PRE_PILOT_AUDIT.md`, `ELEKEZA_END_TO_END_PRE_PILOT_READINESS.md`.

| Area | Status | Evidence | Remaining action |
|---|---|---|---|
| **PostgreSQL 15** | VERIFIED | Fresh 20/20 and V19→V20 on 15.17; schema and county contract pass | None for development use |
| **PostgreSQL 16** | VERIFIED | Fresh install, in-place upgrade, contract 37/37, gate ×2 on 16.16 (docker) | Re-run on the real pilot host |
| **Migrations** | VERIFIED | V1–V20 apply clean from empty on both majors; V20 schema assertions; checksums identical across Flyway 9→11 and PG15→PG16 | None |
| **JDBC/Flyway** | VERIFIED | pgJDBC 42.7.14 (vendor CI covers PG 9.1–17); Flyway 11.20.3 + PG module 11.20.3 | Flyway 12/13 blocked by Spring Boot 3.2.4 — schedule a Boot upgrade |
| **Backup** | VERIFIED | `db-backup.sh` exits 0 on PG15 (native) and PG16 (`--docker`); fails safely with exit 3 without a compatible client; interrupted run leaves no artifact | Schedule it; add off-site destination and encryption |
| **Restoration** | VERIFIED | `db-restore-drill.sh` restores into a separate DB on both majors; schema, data and Flyway checksums identical; app boots, health 200, login 200 against restored data | Rehearse on the pilot host; record a measured RTO |
| **Staging gate** | VERIFIED | PASS ×2 on PG16, ×3 on PG15, exit 0; ownership marker, zero admin accounts, cleanup proven | Extend to the docker-compose stack once hosted |
| **Authentication** | PARTIALLY VERIFIED | register/login/session/logout covered on a real server; rate limiting on login; CSRF with documented exemptions | Password reset, MFA and session expiry not exercised end-to-end; no hosted run |
| **Security** | PARTIALLY VERIFIED | Role checks, CSRF, CORS from config, secure cookies by default, login rate limiter, JWT token typing | No penetration test; no external review; dependency scan not automated |
| **Hosted staging** | **BLOCKED** | Architecture, templates and procedures written and reviewed | Needs an authorised provider account, payment approval and DNS control |
| **Pre-pilot audit** | VERIFIED (document) | `ELEKEZA_PRE_PILOT_AUDIT.md`, `ELEKEZA_PILOT_READINESS_MATRIX.md` | Close the P0/P1 items it lists |
| **Privacy / child data** | **PARTIALLY VERIFIED** | Consent capture, account erasure and a scheduled retention sweep are implemented and tested (`V21`, `docs/operations/ELEKEZA_PRIVACY_CONSENT_ERASURE_RETENTION.md`); no legal or DPIA review exists and no consent screen calls the API yet | Kenya DPA review, DPIA, guardian consent UI, confirmed erase-vs-retain position |
| **Accessibility** | PARTIALLY VERIFIED | TTS hook, reading toolbar, accessibility profiles exist in code | Specialist assessment with assistive tech; no WCAG claim is made |
| **School validation** | **NOT STARTED** | Plans and instruments written (`docs/pilot/`) | Requires authorisation and a named partner school; nothing was sent |
| **Guardian validation** | **NOT STARTED** | Plan written | Follows school validation |
| **Pilot readiness** | **NOT READY** | See final decision | Close P0/P1, unblock hosting and legal |

## Reading this register correctly

- **VERIFIED** means a command was run and its output is retained. It does not mean "production proven".
- **PARTIALLY VERIFIED** means the mechanism exists and is partly exercised; the gaps are named.
- **BLOCKED** means work is prepared but a permission, account or authority is missing — not that the work failed.
- Nothing here is a commercial claim: no school, guardian or revenue commitment exists.

## The three questions that decide a pilot

1. **Can we host it safely?** Not yet — no hosted environment exists.
2. **Can we recover data?** Yes on a developer machine, proven; not yet on the pilot host with off-site copies.
3. **Are we allowed to hold children's data?** Unknown — no legal/privacy review has been done.
