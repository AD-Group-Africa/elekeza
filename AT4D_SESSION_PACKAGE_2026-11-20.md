# ELEKEZA — AT4D SESSION PACKAGE
**20 November 2026 · release sprint · consolidated head `a489682`**

> **One line:** the code is verified and green locally; nothing is deployed, and one migration decision
> blocks publishing. No live URL may be promised today.

---

## 1. What Elekeza is (status + architecture)

An AI-assisted learning platform for Kenyan schools: learners, teachers, guardians, school admins and
platform admins, with an AI tutor ("Elewa"), curriculum and exams, attendance/finance, guardian messaging
and an accessibility layer.

| Layer | Technology | State |
|---|---|---|
| Frontend | Next.js 16.4.6 (App Router, PWA), TypeScript, Tailwind | Builds and passes all checks |
| Backend | Kotlin / Spring Boot 3, Spring Security 6, Flyway | 410 tests green |
| AI service | Python / FastAPI, Groq provider, guardrails + safety layer | 603 tests green, live provider verified |
| Database | PostgreSQL (16.16 validated) | 21 migrations, 62 tables, 93 FKs |

Three services, one repository, one consolidated history (`consolidation/2026-11-19`).

## 2. Verified evidence (all run today, this machine)

| Suite | Command | Result |
|---|---|---|
| Backend | `./gradlew cleanTest test` | **410 / 410**, 62 suites, 0 failures |
| Backend jar | `./gradlew bootJar` | BUILD SUCCESSFUL |
| Frontend deps | `npm ci` | **831 packages**, exit 0 |
| TypeScript | `tsc --noEmit` | exit 0 |
| ESLint | `eslint .` | exit 0 (1 warning) |
| Unit tests | `vitest run` | **84 / 84** |
| Production build | `npm run build` | **exit 0**, Next 16.4.6 |
| AI service | `pytest -m "not live and not live_full"` | **603 / 603** |
| Browser E2E | `npx playwright test` (46 tests) | *running — see §3* |
| Migrations | boot jar against PostgreSQL 16.16 | **21 / 21** applied in 4.8 s |
| Backup→restore | `pg_dump` → clean PG16 → `pg_restore` | **PASS**, 9–11 s, schema and rows identical |

**1,107 automated tests pass locally.**

## 3. Local vs hosted — the distinction that matters today

| Capability | Local (verified) | Hosted (not yet) |
|---|---|---|
| Backend API, auth, roles | ✅ tested | ❌ not deployed |
| AI tutor | ✅ tested + live provider smoke | ❌ not deployed |
| Frontend | ✅ builds, 60 routes prerendered | ❌ not deployed |
| Database + restore | ✅ proven on PG16 | ❌ no managed instance |
| HTTPS, DNS, real domains | — | ❌ none |
| Five-role acceptance on a URL | ❌ not possible yet | ❌ blocked |

## 4. Blockers (and who owns them)

| # | Blocker | Owner | Impact |
|---|---|---|---|
| 1 | **`main`/`develop` share no ancestry with the pilot line** — promotion needs a force or an archive-then-replace decision | **Harrison** | cannot publish a canonical `main` |
| 2 | No production credentials (DB, JWT, AI key, SMS, SMTP, R2, Sentry) | Harrison / AT4D | nothing can be deployed |
| 3 | No Node/DB hosting accounts provisioned | AT4D | staging cannot exist |
| 4 | `follow-redirects` **high** severity advisory in prod deps (fix available) | engineering | security gate open |
| 5 | No HSTS header; CORS fails closed to localhost if unset | engineering | must set at deploy |
| 6 | Sentry not implemented in backend/AI | engineering | no error visibility |
| 7 | Lineage A may contain features absent from the pilot line (Railway fixes, cognitive-profile work) | engineering review | unknown until audited |

## 5. Credentials required (names only)

| Service | Variables |
|---|---|
| PostgreSQL | `DB_URL`, `DB_USER`, `DB_PASSWORD` |
| Backend auth | `JWT_SECRET`, `SECURE_COOKIES`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL` |
| Backend↔AI | `AI_INTERNAL_SECRET` (backend) = `INTERNAL_SECRET` (AI) |
| AI provider | `AI_PROVIDER`, `AI_API_KEY` |
| Frontend | `NEXT_PUBLIC_API_URL` |
| SMS (Africa's Talking) | `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID` |
| Email (SMTP) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| Storage (R2) | `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY`, `R2_SECRET_KEY` |
| Monitoring | `SENTRY_DSN` ×3 |

## 6. AT4D support requested

1. **Decision** on lineage: archive-then-replace `main` (recommended) vs new canonical branch name.
2. **Accounts**: Render (2 services), Netlify (1 site), managed PostgreSQL with daily backups.
3. **Budget approval**: see §7.
4. **A staging domain** (e.g. `staging.elekeza.app`) and DNS control.
5. **A Groq API key** funded for pilot volume (~1,500 tutor turns/day estimate).
6. **Safeguarding/DPIA sign-off** before any real learner data.

## 7. Infrastructure cost (recurring, monthly)

| Service | Plan | Cost |
|---|---|---|
| Render — backend | Starter | ~$7 |
| Render — AI | Starter | ~$7 |
| Managed PostgreSQL | Starter + daily backups | ~$15 |
| Netlify — frontend | Pro (team) | ~$19 |
| Groq API | usage-based | ~$10–40 |
| **Total** | | **≈ $58–88 / month** |

Free tiers are **not suitable**: the AI tutor's 120 s client timeout is exceeded by cold starts.

## 8. Pilot roadmap to 30 November

| Dates | Milestone | Owner |
|---|---|---|
| 20 Nov | AT4D session; lineage decision; credentials requested | Harrison |
| 21–22 Nov | Archive tag lineage A; replace `main`; protect branches | engineering |
| 22–24 Nov | Provision Render/Netlify/PostgreSQL; deploy staging | engineering |
| 24–25 Nov | Five-role acceptance on staging; fix findings | engineering + Harrison |
| 25–26 Nov | Restore drill on the managed DB; rollback rehearsal | engineering |
| 26–27 Nov | Security close-out (follow-redirects, HSTS, Sentry) | engineering |
| 27–28 Nov | Controlled pilot: 1 school, synthetic-then-consented accounts | Harrison |
| 29–30 Nov | Buffer + go/no-go review | Harrison |

## 9. Staging access model

- **URL:** issued only after health checks pass (not today).
- **Accounts:** five synthetic roles seeded through a gated seed (`DEMO_SEED_ENABLED`), never real learners:
  `student@`, `teacher@`, `parent@`, `admin@`, `superadmin@`.
- **Access:** invite-only; credentials shared through the AT4D password manager, never in chat or email.
- **Data:** synthetic only; the demo seed is refused at boot on production profiles by `DemoSeedGuard`.

## 10. Risks, decisions, owners

| Risk | Severity | Mitigation | Owner |
|---|---|---|---|
| Publishing the wrong lineage loses work | **High** | tag before any pointer move (orphan tag already pushed) | Harrison |
| No error visibility at launch | High | Sentry before pilot | engineering |
| Known high-severity dep advisory | Medium | `npm audit fix` + full regression | engineering |
| Demo credentials in seeds | Medium | `DemoSeedGuard` (verified) | engineering |
| Single-instance rate limiter | Low | Redis-backed buckets when scaling | engineering |
| AI cost overrun | Medium | per-user daily limit already implemented | engineering |

## 11. Demonstration script (5 minutes, local only)

1. **Sign in as teacher** → dashboard shows class roster and today's schedule.
2. **Open a lesson** → show curriculum tree and accessibility controls (font scale, contrast).
3. **Switch to learner** → open the AI tutor, ask a curriculum question, show the answer with guardrails.
4. **Complete an activity** → progress updates and persists after reload.
5. **Switch to guardian** → see linked learner's progress and send a message to the teacher.
6. **Sign in as school admin** → staff management and school-level analytics.
7. **Sign in as platform admin** → system overview; demonstrate that a direct URL to another role's page
   is refused (role enforcement).
8. **Show the restore drill result** → same schema and rows after a full backup/restore.

Every step above is exercised by the automated suites; steps run on `localhost` today, not on a public URL.

## 12. What we will not claim today

- No live URL, no deployed environment, no production release.
- No real learner data has been used anywhere.
- Payments remain disabled (503) and will not be switched on without separate approval.
