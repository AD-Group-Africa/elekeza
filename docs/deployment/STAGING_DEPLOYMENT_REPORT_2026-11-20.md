# STAGING DEPLOYMENT REPORT — 2026-11-20

**Status: BLOCKED ON CREDENTIALS AND COST APPROVAL.** No hosting account was accessed, no service was
provisioned, no DNS was touched. Everything below is either a verified readiness fact about the repository or
an exact, reproducible procedure for the person who owns the accounts.

Labelling: **[V] verified**, **[O] observed in config/code**, **[A] assumption**, **[R] recommendation**.

---

## 1. What exists today

| Item | State |
|---|---|
| Hosted staging | **Does not exist.** No URL, no account, no database. |
| `render.yaml` (backend + AI blueprint) | **[O]** present, now corrected (§3) |
| `frontend/netlify.toml` | **[O]** present, HSTS added (§3) |
| `backend/Dockerfile`, `ai-elewa/Dockerfile` | **[O]** present |
| Health endpoints | **[O]** `/actuator/health` (backend), `/health` (AI) |
| Migrations | **[V]** 21/21 apply cleanly on PostgreSQL 16 |
| Deployment SHA | **`baed7f4`** on `origin/consolidation/2026-11-19` |

The repository is deployment-*ready*. It is not deployment-*tested*: nothing here proves Render or Netlify
will build it, because neither has been run.

---

## 2. Blockers, in the order they must be cleared

| # | Blocker | Owner | Unblocks |
|---|---|---|---|
| 1 | Canonical branch decision (lineage A/B/C) | Harrison | which ref staging deploys from |
| 2 | GitHub repo + Render + Netlify account access (or an invitation) | Harrison | everything below |
| 3 | Cost approval: **≈ $56–75/month** (§4) | Harrison / finance | provisioning |
| 4 | Generation and storage of the secrets in §5 | Harrison | backend/AI boot |
| 5 | Domain or acceptance of `*.onrender.com` / `*.netlify.app` URLs | Harrison | CORS, cookies, HSTS verification |
| 6 | AI provider key funded (Groq paid tier recommended for >30 RPM) | Harrison | AI journeys |

**[A]** The 30 November release target is still reachable *if* blockers 1–4 clear by ~24 November: provisioning
and hosted acceptance together are roughly two working days.

---

## 3. Configuration changes made this session (before any deploy)

| File | Change | Why |
|---|---|---|
| `render.yaml` | backend `plan: starter` → **`standard`** | The file claimed "starter = 2 GB". Checked against Render's pricing on 2026-11-20: **Starter is 0.5 CPU / 512 MB**, Standard is 1 CPU / 2 GB ($25/mo). With `-Xmx1200m` the backend would OOM-loop on Starter. |
| `render.yaml` | AI service `plan: starter` → **`standard`** | Tesseract OCR + Python data stack does not fit 512 MB either. |
| `render.yaml` | added `HSTS_ENABLED=true` | Render always serves `*.onrender.com` over HTTPS with a valid certificate. |
| `frontend/netlify.toml` | added `Strict-Transport-Security` | Netlify does **not** apply HSTS by default, contrary to the old comment. |
| `backend application-prod.yaml` | added `server.forward-headers-strategy: framework` | Without it `request.isSecure()` is false and `request.remoteAddr` is the proxy, which suppresses HSTS and collapses per-IP rate limiting onto one bucket. |

`autoDeploy: false` is already set on both Render services — deploys are deliberate, not on every push. Keep
it that way for a release candidate.

---

## 4. Recurring cost (list prices checked 2026-11-20)

| Service | Plan | Why this size | USD/month |
|---|---|---|---|
| Render web — backend (Docker, JVM) | Standard 1 CPU / 2 GB | 512 MB cannot hold Spring Boot + Hibernate | **25** |
| Render web — AI (Docker, FastAPI + Tesseract) | Standard 1 CPU / 2 GB | OCR + LLM client; free tier spins down and blows the 120 s backend timeout | **25** |
| Render PostgreSQL | Basic 256 MB | sufficient for staging volume; **upgrade to 1 GB ($19) if PITR/backup retention requires it** | **6** |
| Netlify frontend | Free (300 credits) | enough for a review audience; Personal $9/mo if builds exceed credits | **0** |
| Render workspace | Hobby | 1 seat, 5 GB bandwidth | **0** |
| AI provider (Groq) | free tier 30 RPM / paid 600 RPM | free tier is fine for review; paid required before real users | 0 → usage |
| **Total to stand up staging** | | | **≈ $56/month** |
| **With Postgres 1 GB + Netlify Personal** | | | **≈ $78/month** |

Sources: render.com/pricing and netlify.com/pricing, read 2026-11-20. **[A]** Prices change and are
region/credit dependent; confirm in the provider dashboard at the moment of creation. **No paid resource may
be created until Harrison approves this figure.**

---

## 5. Secret and configuration inventory (names only — never values)

### Backend (Render → Environment)

| Variable | Required | Notes |
|---|---|---|
| `DB_URL` | yes | `jdbc:postgresql://<host>:5432/<db>?sslmode=require` — external managed Postgres requires TLS |
| `DB_USER` / `DB_PASSWORD` | yes | from the Render Postgres instance |
| `JWT_SECRET` | yes | **fresh value** — lineage A's old value is compromised (§7) |
| `AI_INTERNAL_SECRET` | yes | must equal the AI service's `INTERNAL_SECRET` exactly |
| `AI_SERVICE_URL` | yes | `https://elekeza-ai.onrender.com` |
| `AI_CLIENT_TYPE` | yes | `real` |
| `CORS_ALLOWED_ORIGINS` | yes | exact Netlify origin, **no trailing slash, no `*`** (the app refuses `*`) |
| `FRONTEND_URL` | yes | same origin |
| `SECURE_COOKIES` | yes | `true` |
| `HSTS_ENABLED` | yes | `true` on an HTTPS host |
| `DEMO_SEED_ENABLED` | yes | `FALSE` for staging with synthetic accounts created explicitly |
| `SPRING_PROFILES_ACTIVE` | preset | `prod` |

### AI service

| Variable | Required | Notes |
|---|---|---|
| `AI_PROVIDER` | preset | `groq` |
| `AI_API_KEY` | yes | provider key — set in the dashboard, never in git |
| `INTERNAL_SECRET` | yes | identical to the backend's `AI_INTERNAL_SECRET` |
| `TESSERACT_CMD` | preset | `/usr/bin/tesseract` |

### Frontend (Netlify)

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | **bare backend origin, no `/api` suffix.** Baked in at build time; `next.config.ts` throws if it is missing in a production build |
| Base directory | UI setting | set to `frontend` in Netlify (the `netlify.toml` deliberately does not set `base`) |

### Optional — do NOT set during staging

`AFRICA_TALKING_*`, `MAIL_*` (SMTP), `CLOUDFLARE_R2_*`, `MPESA_*`, `LANGFUSE_*`, `SENTRY_DSN`.
`render.yaml` declares them `sync: false`, so Render will prompt for them; **leave them blank**. Providers
default to mock, which is the correct staging posture — and no live financial activation is authorised.

---

## 6. Provisioning sequence

```bash
# 0. Confirm the deploy SHA is the one that passed the suites
git rev-parse origin/consolidation/2026-11-19     # expect baed7f4… (or the approved successor)

# 1. Render: New → Blueprint → this repository → branch consolidation/2026-11-19
#    Render reads render.yaml. Supply every sync:false variable from §5.
#    Do NOT enable autoDeploy.

# 2. Render Postgres: create the instance first so DB_URL exists before the first backend boot.
#    Enable automated backups + PITR. Record the retention window in DATABASE_RESTORE_RUNBOOK.md §2.2.

# 3. Backend boots → Flyway applies 21 migrations automatically.
#    Expect "Successfully applied 21 migrations" in the deploy log.

# 4. AI service boots → GET /health returns 200.

# 5. Netlify: import repo, base directory `frontend`, set NEXT_PUBLIC_API_URL, deploy.

# 6. Cross-wire: set CORS_ALLOWED_ORIGINS / FRONTEND_URL to the final Netlify origin and redeploy the
#    backend. CORS must be exact; a mismatch shows up as a 403 on every API call from the browser.
```

### Order matters

- **Database before backend**, or the first boot fails on `DB_URL`.
- **Backend before frontend**, or the first page load logs a failed `/api/auth/me`.
- **CORS after the frontend URL exists**, then redeploy the backend — the value is read at startup.

---

## 7. Staging acceptance record (to be filled when it exists)

| Item | Required evidence | Status |
|---|---|---|
| Frontend URL | `https://…netlify.app` | ☐ |
| Backend health | `curl -sI https://…onrender.com/actuator/health` → 200, `{"status":"UP"}` | ☐ |
| AI health | `curl -sI https://…onrender.com/health` → 200 | ☐ |
| Migrations | deploy log shows 21 applied, `flyway_schema_history` 21 rows | ☐ |
| HTTPS | valid certificate, HTTP → HTTPS redirect | ☐ |
| HSTS | `curl -sI` shows `strict-transport-security: max-age=31536000` | ☐ |
| Deployment SHA | build log shows `baed7f4` | ☐ |
| Secure cookies | login response `Set-Cookie` carries `Secure; HttpOnly; SameSite` | ☐ |
| Build + runtime logs | captured, no stack traces, no secret values | ☐ |
| Smoke test | sign-in as one synthetic account of each role | ☐ |
| CORS | browser call from the Netlify origin succeeds; a foreign origin is rejected | ☐ |
| Secrets rotated | lineage A's old values replaced (§7 below) | ☐ |

A green build is **not** acceptance. Every row above is a separate observation.

---

## 8. Risk notes specific to this deployment

1. **Compromised lineage-A credentials.** Before staging goes live, `JWT_SECRET`, `AI_INTERNAL_SECRET`,
   `DB_PASSWORD` and every provider key must be **newly generated**, because A's old `.env` files remain in
   git history. Deploying with a value that ever sat in a tracked file would be a real exposure.
2. **The Android wrapper points at whatever `CAPACITOR_SERVER_URL` says** at build time. A staging APK must
   be built after the staging URL is known, not before.
3. **Single instance.** Rate limiting and the in-memory PWA cache assume one backend instance. Do not enable
   autoscaling on staging while validating the five roles; the login limiter would reset per instance.
4. **AI cost.** Uncapped AI endpoints mean staging traffic spends real provider credits. Put a spend cap on
   the provider key.
5. **Network egress on the free Netlify tier** is 100 GB/month; a synthetic-data acceptance run is nowhere
   near it. **[A]**

---

## 9. What I did not do

No account created, no card entered, no DNS record changed, no production anything. The blueprint edit in §3
changes a *declared* plan size; it provisions nothing until someone runs step 1 with approval.
