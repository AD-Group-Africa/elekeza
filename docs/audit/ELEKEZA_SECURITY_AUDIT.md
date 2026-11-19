# ELEKEZA — SECURITY & DATA-PROTECTION AUDIT

**Date:** 14 Nov 2026
**Branch:** `sprint-3-safe-config` @ `47d17f5` (reviewed commit) + uncommitted working-tree changes
**Framework references:** OWASP ASVS 4.0.3 (L1/L2), OWASP Top 10 (2021), Kenya Data Protection Act 2019
**Mode:** read-only static audit + evidence file inspection. No penetration testing was performed against a live host.

> **Scope honesty.** This audit reads code, configuration and existing test evidence. It is not a penetration test and it is not a legal opinion. "Control present in code" ≠ "control verified against a hostile attacker". Findings below state which of the two applies.

---

## 1. Summary

| Severity | Count | Meaning |
|---|---|---|
| **P0** | 3 | Critical security, privacy, data-integrity or availability issue. Blocks any external pilot. |
| **P1** | 5 | Major control gap on a core or child-facing surface. |
| **P2** | 6 | Important hardening / defence-in-depth. |
| **P3** | 4 | Hygiene and future-proofing. |

**What is genuinely strong** (do not lose this in remediation):

- Refresh tokens are **opaque UUIDs, stored only as SHA-256 hashes, rotated on every use, and revoked** on logout, on suspension, and on expiry. Verified in `AuthController.refresh` / `issueTokensAndRespond`.
- Access tokens are short-lived JWTs (default 15 min) in an `HttpOnly` cookie. `JwtAuthFilter` re-loads the user and **rejects suspended accounts even with a valid unexpired token**.
- Request-body registration (`RegisterRequest`) has **no role field**, and `AuthService.register` hard-codes `role = UserRole.STUDENT`. Platform roles are not self-assignable — verified.
- Login is rate-limited per `email + remoteAddr` **before** any user lookup, and wrong-password, suspended and unknown-account all return the identical `Invalid email or password`.
- The AI service fails **closed**: `ai-elewa/security.py` returns 401 for every authenticated path when `INTERNAL_SECRET` is unset, using `hmac.compare_digest`.
- File uploads are constrained by a 10 MB limit, an extension allowlist, flattened filenames and a UUID prefix (`ContentController`). Path traversal via `originalFilename` is not reachable.
- The demo dataset is gated by a Flyway placeholder on every `INSERT`, so it does not silently populate a production database under `prod`/`docker`.
- CSRF is enforced with a double-submit cookie for all state-changing endpoints except the provider callback and the auth entry points.
- Two prior P0/P1 issues are genuinely fixed in-tree and covered by tests: the suspension-bypass and the cross-tenant analytics leak (`05b31af`), and the M-Pesa callback verification (`c311ce6`, six payment test classes).

---

## 2. P0 findings — block external pilot

### SEC-P0-01 — No age gate, no parental consent, no date of birth on open self-registration

- **Component:** `/register`, `AuthService.register`, `RegisterRequest`, `V1__baseline_schema.sql`
- **Description:** Elekeza is a service for learners aged 7–16, but public self-registration accepts any person with an email address. Neither the form, the DTO, nor the user model records a date of birth, an age band, a guardian assertion or a verifiable parental-consent record. The only consent captured is a boolean `termsAccepted`.
- **Evidence:** `RegisterRequest(email, password, name, gender, phone, termsAccepted)`. `AuthService.register` validates email, password length, name and `termsAccepted`; it stores `role = STUDENT`. No `date_of_birth`/`dob`/`age` field exists anywhere in the registration path (`grep` over `auth/` returns none). `V1__baseline_schema.sql` has no age or consent-verification column.
- **Reproduction:** `POST /api/auth/register {"email":"child@example.test","password":"abc12345","name":"A","termsAccepted":true}` → `201` with a working learner session. No age question is asked.
- **Expected:** A child-directed service either (a) requires an age declaration and routes under-18 sign-ups through a guardian-consented flow, or (b) is invitation/teacher-provisioned only. Verifiable parental consent must be recorded with timestamp, method and scope.
- **Actual:** Any email address becomes an active `STUDENT` account with access to an AI tutor, file storage and messaging surfaces.
- **Why P0:** This is the single highest-risk item in the product: it is a lawful-basis failure under the Kenya DPA 2019 (processing a child's data without verified guardian consent), and it is not fixable by configuration. It also makes every downstream "parent visibility" claim unenforceable, because no relationship to a guardian is ever established for self-registered learners.
- **Remediation:**
  1. Add `dateOfBirth` (or explicit age band) as a required registration field and persist it.
  2. For declared age < 18, replace direct account activation with a guardian-consent handshake (invite email to guardian, consent record with timestamp/IP/method, activation only on consent).
  3. Store a `consent_records` row (`subject_user_id`, `granted_by`, `scope`, `version`, `granted_at`, `method`, `revoked_at`).
  4. Publish a child-appropriate privacy notice in plain language.
- **Dependencies:** Privacy policy + DPIA (SEC-P0-03). Legal review of the consent wording.
- **Acceptance criteria:** A registration attempt declaring age 12 cannot obtain a session until a guardian consent record exists; the consent record is queryable and attributable; a minor's data can be deleted on request with a documented path.

### SEC-P0-02 — No privacy policy, DPIA, retention schedule or subject-access/deletion procedure

- **Component:** repository-wide (`docs/`), ODPC compliance artefacts
- **Description:** Elekeza stores children's names, contact details, educational records, uploaded documents, assessment results, attendance and guardian–teacher messages. None of the mandatory accountability artefacts exist: no privacy policy, no record-of-processing, no DPIA, no retention schedule, no data-subject-request procedure, no processor register, no cross-border transfer basis.
- **Evidence:** `ls docs/` shows product, architecture, security and payment documents, but no privacy/DPIA/retention artefact. The existing release gate already records `Data protection (DPA 2019) — FAIL / BLOCKED`. `docs/audit/ELEKEZA_DEPLOYMENT_READINESS.md` blocker #7 lists the same gap.
- **Reproduction:** Not applicable (absence finding). `grep -ril "privacy policy\|DPIA\|retention" docs/` returns only meta-references stating the artefacts are missing.
- **Expected:** Before real learner data is collected: privacy notice per audience (learner/parent/school), DPIA covering the AI tutor and document processing, defined retention per data class, documented DSAR and erasure path, processor list (Groq/OpenAI-class AI provider, M-Pesa/Safaricom, Africa's Talking SMS, SMTP, Cloudflare R2, Sentry), and a cross-border transfer position.
- **Actual:** None present. The system is technically capable of storing child data with no lawful-basis paperwork.
- **Remediation:** Produce the artefacts; register with ODPC as a data controller; add a documented erasure/anonymisation routine (currently there is no user-deletion endpoint at all — see SEC-P1-03).
- **Dependencies:** Legal advice; Harrison sign-off; provider DPAs.
- **Acceptance criteria:** A school's data-protection officer can be handed a DPIA, a retention table and a DSAR runbook that name every processor and every data class in this repo.

### SEC-P0-03 — Platform `ADMIN` and `SCHOOL_ADMIN` demo accounts exist in a versioned migration with repo-known passwords, default-enabled on the base profile

- **Component:** `V2__seed_demo.sql`, `application.yaml`
- **Description:** `V2__seed_demo.sql` inserts five accounts including `superadmin@elekeza.app` (`ADMIN`, platform-wide) and `admin@elekeza.app` (`SCHOOL_ADMIN`) with **bcrypt hashes committed in the repository**, and their plaintext passwords are documented in the same file's header comment. The gate is `WHERE UPPER('${demoSeedEnabled}') = 'TRUE'`.
- **Evidence:** The gate is respected for `prod` (`application-prod.yaml`, default `FALSE`) and `docker` (`application-docker.yml`, default `FALSE`) — correct. **But the base `application.yaml` sets `demoSeedEnabled: "TRUE"`.** Any run that does not activate `prod` or `docker` (a new profile, an empty `SPRING_PROFILES_ACTIVE`, a mis-typed profile, a bare `java -jar`) silently creates a platform super-admin with a password published in git history.
- **Reproduction:** `SPRING_PROFILES_ACTIVE=none java -jar build/libs/*.jar` against a fresh database → Flyway applies V2 with `demoSeedEnabled=TRUE` → login as `superadmin@elekeza.app` succeeds with the documented password.
- **Expected:** The secure value is the default everywhere; demo seeding must be impossible without an explicit, visible opt-in.
- **Actual:** The insecure value is the default, and the guard depends on profile selection being correct.
- **Remediation:** Invert the base default to `FALSE`; require `DEMO_SEED_ENABLED=TRUE` explicitly for `dev`/`test`/E2E too. Add a startup guard that **refuses to boot** when `demoSeedEnabled=TRUE` and the active profile is not `dev` or `test`. Do not rotate the committed hashes as a substitute — the accounts must never be created outside dev.
- **Dependencies:** `application-dev.yaml`/`application-test.yml` must set it explicitly; E2E and backend tests depend on these accounts.
- **Acceptance criteria:** Boot with any non-dev profile and no explicit flag leaves the `users` table without demo rows; a unit test asserts the guard fires; `grep` of the boot log shows which seed mode is active.

---

## 3. P1 findings

### SEC-P1-01 — Ineffective default for admin-visible `anyRequest().authenticated()` is fine; the real gap is **no separation between platform admin and school admin**

- **Component:** `SecurityConfig`, `UserRole`, `/super-admin`, `/admin/staff`
- **Description:** The role enum is `STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN`. There is no `SUPER_ADMIN` and no national/government role. `ADMIN` **is** the platform super-admin (the seed names it `Demo Super Admin`), and `SidebarLayout` comments that `ADMIN` "can access super-admin". Consequently `hasAnyRole("ADMIN")` grants platform-wide reach, and `SCHOOL_ADMIN` is only distinguished by `institutionId` scoping inside controllers.
- **Evidence:** `UserRole.kt` (5 values). `SidebarLayout`: `case 'SCHOOL_ADMIN': return adminItems.filter(i => i.href !== '/super-admin'); case 'ADMIN': return adminItems;`. `/super-admin/page.tsx` guards on `user.role !== 'ADMIN'`.
- **Impact:** Cannot express the requested hierarchy (Super / Platform / National / School). A government oversight role cannot be created without giving it `ADMIN`, i.e. full platform control. Least privilege is structurally impossible at the top.
- **Remediation:** Introduce `SUPER_ADMIN`, `PLATFORM_ADMIN`, `NATIONAL_ADMIN` (scoped to a region/ministry), keep `SCHOOL_ADMIN`. Migrate existing `ADMIN` rows to `SUPER_ADMIN` deliberately (not by blanket UPDATE). Add an explicit scope concept (`platform` | `national:<region>` | `institution:<id>`) and enforce it in one place. See `ELEKEZA_ROLE_PERMISSION_MATRIX.md`.
- **Acceptance criteria:** A national admin can read aggregate, anonymised reporting and cannot open an individual learner record via API; a platform admin cannot read learner content without a documented, audited elevation.

### SEC-P1-02 — No user-facing data-subject deletion or export path

- **Component:** no controller exposes deletion; `User` has `active` but no erasure
- **Description:** Accounts can be deactivated, but there is no erasure, anonymisation or export endpoint. Children's records therefore cannot be removed on request.
- **Evidence:** `near-zero` occurrences of `delete.*user` / `anonimi` in controllers; `StaffManagementController` offers `active` toggling only. `logout` deletes refresh tokens, not data.
- **Impact:** DPA 2019 access/erasure rights cannot be honoured except by manual DBA work — an untracked, unauditable process.
- **Remediation:** Add `POST /api/admin/users/{id}/erase` (ADMIN, audited) performing a documented cascade or anonymisation, and `GET /api/me/export` returning the subject's own data as JSON. Log both to the audit trail.
- **Acceptance criteria:** An erasure leaves no directly identifying rows for the subject; the audit log records who erased what and when; export returns only the requesting subject's data.

### SEC-P1-03 — Login rate limiting is keyed on `remoteAddr`, which is the reverse proxy behind nginx

- **Component:** `AuthController.login`, `LoginRateLimiter`, `infrastructure/nginx/nginx.conf`
- **Description:** The limiter key is `login:<email>:<request.remoteAddr>`. nginx sets `X-Real-IP`/`X-Forwarded-For` but Spring is not configured with `server.forward-headers-strategy=framework` in the inspected configuration, so `remoteAddr` is the nginx container address for **all** internet traffic.
- **Evidence:** `nginx.conf` sets `proxy_set_header X-Real-IP` and `X-Forwarded-For`. No `forward-headers-strategy` in `application*.yaml`. Key construction: `"login:${req.email...}:${request.remoteAddr ?: "unknown"}"`.
- **Impact:** Two effects, both bad: (a) a single attacker can lock a **victim's email** out of login by exhausting that email's quota from the shared proxy IP (a targeted denial of service against a named learner/parent); (b) all attackers share one bucket per email, so the per-attacker limit no longer throttles distributed attempts meaningfully.
- **Remediation:** Set `server.forward-headers-strategy: framework` and use the left-most untrusted `X-Forwarded-For` (or nginx `real_ip` module) for the limiter key; keep the email component only for anti-enumeration, and add a coarse IP-wide bucket so one IP cannot exhaust many emails.
- **Acceptance criteria:** A test with two different `X-Forwarded-For` values shows independent buckets; exhausting bucket A does not 429 bucket B for the same email.

### SEC-P1-04 — Uploaded files are validated by extension only: no content sniffing, no malware scanning, no storage isolation

- **Component:** `ContentController.uploadFile`
- **Description:** The upload path checks size (10 MB), extension allowlist, and filename flattening. It never inspects magic bytes/content type, never scans for malware, and writes to a local `uploads/` directory on the application container — despite `STORAGE_PROVIDER`/R2 being configured in compose.
- **Evidence:** `uploadFile` steps 1–4 (size, extension, sanitised name, `transferTo`). No `Tika`, no `Files.probeContentType`, no ClamAV/scanning dependency in `build.gradle.kts`. Storage target is `File("uploads")`.
- **Impact:** A `.pdf` that is actually an HTML/JS or an executable is accepted and later served to teachers and (intended) learners. Files live inside the app container's writable layer, so they are lost on redeploy and are not isolated from the application process. No retention/deletion policy exists for uploaded documents.
- **Remediation:** Sniff content (`Apache Tika` or magic bytes) and reject mismatches; enforce server-side `Content-Disposition: attachment` and a restrictive `Content-Type` on retrieval; move to object storage (R2) with per-tenant key prefixes and short-lived signed URLs; add a scanning hook (async) before a document becomes visible; define retention and deletion.
- **Acceptance criteria:** Uploading an HTML file renamed `.pdf` is rejected 415; a stored object is only retrievable by an authorised owner via a signed URL; a retention job deletes documents past policy.

### SEC-P1-05 — Learners cannot upload or open their own learning documents; the learner `/upload` page is a dead end

- **Component:** `/upload`, `POST /api/content/upload/file`, `ContentController`
- **Description:** The brief requires a learner to "upload relevant learning documents". The endpoint is `@PreAuthorize("hasAnyRole('TEACHER','SCHOOL_ADMIN','ADMIN')")`, while the learner shell links every student to `/upload` ("Upload" is in `Sidebar.tsx` for all users).
- **Evidence:** `ContentController` annotation above `uploadFile`. `Sidebar.tsx` menu includes `{ label: 'Upload', href: '/upload' }` with no role filter, and `Sidebar` is used by `DashboardLayout`, which wraps learner pages. `/upload/page.tsx` posts to `/content/upload/file`.
- **Impact:** A learner following their own navigation receives 403. This is simultaneously a security-adjacent design error (a UI affordance the API forbids) and a missing capability central to the product thesis.
- **Remediation:** Either add a learner-scoped upload endpoint (`POST /api/learner/documents`) with owner-only visibility and quota, or remove `/upload` from the learner shell. Do not simply widen the existing endpoint — it writes to institution content.
- **Acceptance criteria:** A learner can upload a PDF and ask the tutor about it; another learner receives 404/403 for that document id; the document is visible to the guardian only if ownership says so.

---

## 4. P2 findings

### SEC-P2-01 — nginx `add_header` inheritance silently drops HSTS and `nosniff` on cached asset responses
`nginx.conf` sets HSTS, `X-Frame-Options`, `X-Content-Type-Options` and `Referrer-Policy` in the `server` block, then `/sw.js` and `/_next/static/` define their own `add_header Cache-Control`. In nginx, a child block that declares **any** `add_header` discards the parent's entire set. Those responses therefore ship without HSTS/nosniff. Fix: repeat the security headers in each `location`, or use a shared `include` snippet.

### SEC-P2-02 — Spring security headers are minimal; no HSTS or Permissions-Policy on the app itself
`SecurityConfig` adds only `frame-ancestors 'none'` and `no-referrer`. TLS/HSTS is assumed to come from nginx (see SEC-P2-01). Add `Strict-Transport-Security` (with `preload` only when justified), a real `Content-Security-Policy`, and `Permissions-Policy` (camera/mic/geolocation denied by default).

### SEC-P2-03 — `JwtUtil.validateToken` never checks the `type` claim; a dead `generateRefreshToken` remains
`validateToken` only verifies signature and expiry. Today the refresh token is an opaque UUID, so no JWTs of type `refresh` exist and there is **no live exploit** — but `generateRefreshToken` still exists and, if ever called, would mint a 7-day JWT that `JwtAuthFilter` would accept as a full access token. Delete the dead generator, or assert `type == "access"` in the filter.

### SEC-P2-04 — Access tokens cannot be revoked before expiry; logout is cookie-only for the access leg
`logout` revokes refresh tokens and clears cookies, but an already-issued access JWT (≤15 min) stays valid if replayed. Acceptable for a short window, but there is no denylist and no `jti`. Document the 15-minute residual window explicitly as an accepted risk, and add `jti` + a short-TTL denylist if a stronger guarantee is needed.

### SEC-P2-05 — Rate limiting exists for login only; no limits on AI tutor, upload, or messaging
`LoginRateLimiter` is the only limiter found. `TutorController`/`ai-elewa` and `POST /api/guardian/messages`, `/api/notifications/send` and content upload have no per-user quota. Combined with `AI usage quotas ABSENT` in the existing release gate, this is a cost-abuse and spam vector, and directly relevant to the commercial model.

### SEC-P2-06 — `backend/flyway-validation/` and evidence archives are untracked but not ignored
`git status` shows `backend/flyway-validation/` (4.6 MB, includes vendored JARs and `.class` files), `.cloud-attachments/` (~15 MB, includes an imported-conversation JSON) and several log files as untracked and **not** gitignored. A single `git add .` would commit compiled binaries and possibly conversation content. Add ignore rules before the next commit.

---

## 5. P3 findings

### SEC-P3-01 — Password policy is length + character-class only
Minimum 8 characters with one letter and one digit (`AuthService`). No maximum length (bcrypt truncates at 72 bytes — reject > 72 rather than silently truncate), no breached-password screening, no reuse check. For a child audience, prefer a passphrase-friendly policy plus breached-password rejection over complexity rules.

### SEC-P3-02 — No email verification on registration
An account is usable immediately with any syntactically valid email. Password reset delivery therefore defines whether an address is real, and support cannot prove ownership. Add a verification link (and use it as the guardian-consent channel from SEC-P0-01).

### SEC-P3-03 — Payment callback has no enforced IP allowlist
Documented in-tree as `SPRINT 3 TODO — P1: /api/payments/callback has NO enforced IP allowlist here`. The prepared nginx template exists but is disabled pending Safaricom ranges. Verification of the callback payload is implemented and tested (six payment test classes), so this is defence-in-depth rather than the primary control — but it is still an open P1 item owned by infra, not by application code.

### SEC-P3-04 — Misleading stale comment in `JwtAuthFilter`
The file carries a "Copy this file to…" instruction and a package-mismatch post-mortem in its header. Harmless, but it invites a future contributor to move the file and break the import. Reduce to a one-line purpose statement.

---

## 6. Access control — what was actually verified

Verified by reading enforcement points and existing test coverage (not by live adversarial testing):

| Attack | Result | Basis |
|---|---|---|
| Student reads another student's records | Blocked | `@PreAuthorize` + ownership checks; `MultiTenantAuthorizationTest`, `GuardianRelationshipTest` |
| Guardian reads an unrelated child | Blocked | `GuardianLink.currentlyActive()` filtering; `GuardianRelationshipTest` |
| Teacher reads an unauthorised class | Blocked at filter + controller | `hasAnyRole(TEACHER, SCHOOL_ADMIN, ADMIN)` + institution scoping; `TeacherStudentsApiTest` |
| School admin reads another school | Blocked | `institutionId` derived from principal, never from request body; `MultiTenantAuthorizationTest`, `StaffManagementApiTest` |
| School admin elevates to platform admin | Blocked | `SCHOOL_ADMIN` must pass `/api/institutions/**` **and** the staff endpoint validates the requested role against an allowlist; `DuplicateAdminRegistrationTest` |
| Anonymous access to any `/api/**` | Blocked | `anyRequest().authenticated()` + JSON 401 entry point |
| Suspended user with a live token | Blocked | `JwtAuthFilter` re-loads and checks `user.active` |
| Cross-tenant analytics | Blocked (fixed in `05b31af`) | `GuardianAnalyticsAuthorizationTest` |

**Not verified (and should not be claimed):** any control against a live deployed environment; request smuggling, HTTP desync, or infrastructure-level attacks; the effectiveness of the CSRF token under unusual proxy configurations; secret strength in any real environment.

---

## 7. Secret-management assessment

- No credential value was found in the two reviewed frontend files, the audit documents, or controller sources.
- `.env`, `frontend/.env`, `backend/.env` are all matched by `.gitignore`.
- `docker-compose.yml` correctly reads secrets from the environment with **no inline defaults** for `JWT_SECRET`, `AI_INTERNAL_SECRET`, `DB_PASSWORD`, `REDIS_PASSWORD`, the R2 keys or the M-Pesa credentials — good.
- Demo bcrypt hashes for five accounts are intentionally committed in `V2__seed_demo.sql`; that is only acceptable while those accounts cannot be created outside dev (see SEC-P0-03).
- `Push-Sprint2.ps1` contains one token-like line; inspection shows it is a **secret-scanning pattern list**, not a credential. No action needed.
- No secrets manager is in use: production secrets are plain environment variables in a host `.env`. Acceptable for a pilot VPS if the file is root-owned, `0600`, and never copied into an image.

---

## 8. What remains legally and operationally open

Technical controls do not create compliance. The following are **outstanding and non-technical**:

1. ODPC registration as data controller/processor.
2. A DPIA specific to the AI tutor, document processing and messaging.
3. Guardian-consent capture with a defensible standard of "verifiable".
4. Processor agreements with the AI provider, Safaricom (M-Pesa), SMS, email, object storage and error tracking.
5. A cross-border transfer position for AI inference and error telemetry.
6. Retention periods per data class, agreed with schools.
7. A subject-access and erasure runbook with a named owner.
8. A breach-notification procedure and timeline.

Until 1–4 exist, **no real learner data should enter any environment, including a pilot**.
