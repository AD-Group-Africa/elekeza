# SECURITY RESULTS — Production Security Gate (2026-10-02)

## Gate checklist

| Control | Status | Evidence |
|---|---|---|
| DEMO_SEED disabled in prod | ✅ | `application-prod.yaml` placeholder default `FALSE`; compose `DEMO_SEED_ENABLED:-FALSE`; V2 seed fully gated per-INSERT |
| Production secrets required | ✅ mostly | `JWT_SECRET`, `DB_PASSWORD`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL` have **no defaults** in prod yaml (boot fails without them) — verified by config inspection |
| INTERNAL_SECRET cannot default to empty | ❌ **PILOT BLOCKER** | `ai-elewa/security.py:10` defaults `""` → **fail-open** (live-verified: scratch instance without the var accepted an unauthenticated POST with 422-not-401). Frozen r2 → needs r3. Backend side: `${AI_INTERNAL_SECRET}` unresolvable ⇒ boot fail (good), but `RealAiClient.kt:18`/`AiWebClientConfig.kt:15` keep a `dev-secret` fallback (dead code today; remove) |
| CORS restricted | ✅ | prod: `${CORS_ALLOWED_ORIGINS}` (no default); local run locked to `http://localhost:3100` |
| Secure cookies | ✅ (config) | `SECURE_COOKIES` flag (true default in prod); false only in the local runbook environment |
| HTTPS enforced | ⚠️ topology | nginx 80/443 + certbot wiring exists in compose; actual domain/cert issuance is a deployment action (see deployment-checklist) |
| Rate limiting | ◑ | LoginRateLimiter: 5 bad logins → 429 (live-verified); waitlist limiter exists. No global API rate limiter (post-pilot) |
| Request validation | ✅ | 400/422 on malformed bodies verified (attendance statuses, quiz answer contract, JSON parse) |
| SQL safety | ✅ | JPA repositories + Flyway; no string-built SQL found in controllers |
| Authorization (role + object-level) | ✅ | 40 role-gated controllers; object-level live-verified this audit: institutions/{id}/students+staff 403 cross-tenant, class session 403 "Not authorized for this class", guardian ward 403 cross-family, learner content 403 cross-school |
| Audit logs | ✅ | `audit_logs` table + AuditLogService (STAFF_CREATED etc. verified in code paths) |
| Sensitive logs redacted | ✅ | tokens/cookies never logged; temp passwords appear only in create responses (documented contract) |
| AI key server-side only | ✅ | browser scans clean (content+localStorage+cookies); AI called backend-side with X-Internal-Key |
| Database backups | ✅ | backup + **restore drill PASSED** (16 migrations restored into disposable DB, dropped cleanly) |

## PILOT BLOCKERS vs POST-PILOT HARDENING

**Pilot blockers (must fix before internet-facing pilot):**
1. AI `INTERNAL_SECRET` fail-open (requires AI r3 release — code change is 3 lines + start script guard).
2. Domain/TLS execution (deployment action, not code).
3. Daraja live credentials IF real payments are in pilot scope (else mock-mode is honest and labelled).

**Post-pilot hardening (do NOT block pilot):**
- Backend `dev-secret` fallback removal (r3 rides along with the AI fix).
- Global API rate limiting; account lockout telemetry; password-reset email delivery (SMTP creds); observability keys; R2 storage; Redis cache layer.

## Live probe summary (full matrix: `../e2e-evidence/03-security/SECURITY-RESULTS.md`)

401 ×4 classes (no-cookie/garbage/alg-none/unsigned) · 403 ×7 role + 7 object-level · 404 ×3 · 400/422 ×5 ·
429 brute-force · CSRF exemption audit · M-Pesa callback tamper matrix · AI internal-key ×2 · zero 500s.
