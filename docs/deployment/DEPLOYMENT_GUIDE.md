# DEPLOYMENT GUIDE

**Date:** 2026-11-19
**Target topology:** Netlify (frontend) + Render (backend, AI service) + managed PostgreSQL
**Status:** configuration prepared, **nothing deployed or verified remotely.**

---

## 1. Architecture as deployed

```
Browser / PWA ──► Netlify  (Next.js 16.3.3, @netlify/plugin-nextjs)
                     │
                     │  /api/*  (Next rewrite → NEXT_PUBLIC_API_URL)
                     ▼
              Render: elekeza-backend  (Spring Boot 3.2.4, Docker, JDK 17)
                     │                    ├── PostgreSQL 16  (Flyway V1–V21)
                     │                    └── object storage (R2 or mock)
                     ▼
              Render: elekeza-ai  (FastAPI, Docker, uvicorn)
                     ▼
              AI provider (Groq / OpenAI / Anthropic / Google)
```

The browser never calls the AI service directly. All AI traffic crosses the backend, which attaches `AI_INTERNAL_SECRET`. **Do not expose the AI service to the frontend** — that would make the internal secret a public credential.

---

## 2. Frontend — Netlify

### Current `frontend/netlify.toml`
```toml
[build]
  command = "npm run build"
  publish = ".next"
[build.environment]
  NETLIFY_NEXT_PLUGIN = "true"
[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Settings to confirm in the Netlify UI
| Setting | Value |
|---|---|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `.next` |
| Node version | **20** (matches CI; the build was verified locally on Node 24 and on CI's 20) |
| Plugin | `@netlify/plugin-nextjs` (present in `devDependencies`) |

### Required environment variables
`NEXT_PUBLIC_API_URL` (bare origin, **no `/api`**), `NEXT_PUBLIC_SENTRY_DSN`.

> `NEXT_PUBLIC_*` is inlined at **build** time. Changing the backend URL requires a **redeploy**, not just an env edit.

### Verified locally
`npm run build` → exit **0**, Next 16.3.3 (webpack), PWA service worker emitted to `public/sw.js` (scope `/`), all 61 routes compiled. Build ran with `NEXT_PUBLIC_API_URL=http://localhost:8085`.

### PWA / routing notes
- `next-pwa` generates `sw.js`; ensure Netlify does not cache `sw.js` aggressively (add `Cache-Control: no-cache` for `/sw.js`).
- All role routes are client-gated; a direct URL to a role page without a session must redirect to `/login`, not render an empty shell. **Verify after the first deploy.**

---

## 3. Backend — Render

### `render.yaml` (added today)
Declares `elekeza-backend`: Docker runtime, `rootDir: backend`, `plan: starter`, `healthCheckPath: /actuator/health`, `autoDeploy: false`, and every variable with `sync: false` (Render prompts; no secrets in the file).

### Dockerfile facts (existing, unchanged)
- Build stage `gradle:8.5-jdk17`; runtime `eclipse-temurin:17-jre-jammy`.
- `gradle build --no-daemon -x test` — **tests are skipped inside the image**; run them in CI instead.
- Non-root user `elekeza`; `curl` installed for the health check.
- `JAVA_OPTS="-Xms128m -Xmx400m -XX:+UseContainerSupport -XX:MaxRAMPercentage=75"` — sized for a 512 MB free tier. **On `starter` (2 GB) raise `-Xmx` to ~1200m**, otherwise you are paying for memory the JVM will not use.

### Startup / migration strategy
- `SPRING_PROFILES_ACTIVE=prod` → Flyway **enabled**, `ddl-auto=validate`.
- Migrations V1–V21 apply on boot. **Take a database dump before the first production boot.**
- The app fails fast if `JWT_SECRET`, `AI_INTERNAL_SECRET`, `CORS_ALLOWED_ORIGINS` or `FRONTEND_URL` are unset. This is deliberate — do not add fallbacks.

### Health check
`GET /actuator/health` → `{"status":"UP"}` (aggregate, includes DB). Only `/actuator/health` is exposed; keep it that way.

### Rollback
Render keeps previous deploys. Rollback = **Deploys → choose last good → Redeploy**. Because Flyway migrations are forward-only, **only roll back across a migration boundary after restoring the database dump taken pre-deploy.**

---

## 4. AI service — Render

- `rootDir: ai-elewa`, Dockerfile `python:3.11-slim`, command `uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`.
- Health check `GET /health` → `{"status":"ok"}` (verified locally: HTTP 200).
- **Plan must be paid/always-on.** A cold start exceeds the backend's 120 s AI timeout.
- Boot fails fast without `AI_PROVIDER` (supported set) and `AI_API_KEY` — verified: `config.py` raises at import.
- OCR needs `tesseract` in the image (`TESSERACT_CMD`). **Verify the image actually contains it** — `simplify_image` will 422 otherwise. Not verified in this session.

### Resource assessment
| Concern | Assessment |
|---|---|
| Cold start | Fatal on free tier. Paid required. |
| Memory | Python + FastAPI + OCR ≈ 400–700 MB. `starter` (2 GB) is comfortable. |
| Timeout | Backend 120 s. A `live_full` matrix run must not be used as a health indicator. |
| Cost | 2 paid Render services ≈ the dominant recurring cost. Budget decision for Harrison. |

---

## 5. Database

| Item | Detail |
|---|---|
| Engine | PostgreSQL 16 (compose uses `postgres:16-alpine`) |
| Driver / Flyway | Pinned `42.7.14` / `11.20.3` — deliberate, documented in `build.gradle.kts`; do not casually upgrade |
| Migrations | V1–V21 in `backend/src/main/resources/db/migration/` |
| Backups | `scripts/db-backup.sh`, `scripts/db-restore-drill.sh`; existing dumps in `backups/` (`elekeza_v20_upgrade-pre-v20.dump`, `elekeza_pg16_upgrade2-pre-v20.dump`) |
| Restore rehearsal | script exists; **not executed in this session** |

**Before first production boot:** `pg_dump` the target DB, then boot and confirm Flyway reports 21 applied migrations (`/actuator/health` plus logs).

---

## 6. Cross-service verification checklist (not yet executed)

1. `GET /actuator/health` on the backend → `UP`.
2. `GET /health` on the AI service → `ok`.
3. Sign in on the Netlify origin as `STUDENT` → `/student-home` renders live data.
4. Repeat for `TEACHER`, `GUARDIAN`, `SCHOOL_ADMIN`, `ADMIN`.
5. **Guardian must see linked learners** (`/api/guardian/wards` non-empty) — the historic concern.
6. A guardian must get **403** for a learner they are not linked to.
7. `POST /api/tutor` returns `source: "provider"` (proves backend → AI → provider).
8. A mutation without `X-XSRF-TOKEN` returns **403**; a request from a foreign `Origin` returns **403**.
9. HTTP→HTTPS redirect works; `Secure` cookies present.
10. `/sw.js` served as JavaScript with no long-lived cache.

---

## 7. Rollback summary

| Layer | Action |
|---|---|
| Frontend | Netlify → Deploys → **Publish deploy** on the previous build |
| Backend | Render → Deploys → **Redeploy** previous; if a migration ran, restore the pre-deploy dump first |
| AI service | Render → Deploys → **Redeploy** previous |
| Database | Restore the pre-deploy dump into a fresh instance, then repoint `DB_URL` |

---

## 8. Deployment gates (do not deploy until all true)

- [ ] Consolidated branch pushed and CI green (frontend lint currently **red**)
- [ ] Backend tests, frontend build, AI suite re-run on the **merged** tree
- [ ] Production secrets set in Render and Netlify
- [ ] Pre-deploy database dump taken
- [ ] `CORS_ALLOWED_ORIGINS` exactly matches the Netlify origin
- [ ] `DEMO_SEED_ENABLED=FALSE`
- [ ] **Owner has approved the production deployment**
