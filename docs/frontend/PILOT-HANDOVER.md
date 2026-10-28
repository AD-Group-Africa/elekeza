# Elekeza frontend: pilot handover

Branch `Iyann` in `AD-Group-Africa/elekeza`, built on `frontend/revamp` (24f47a4) with `sprint-3-safe-config` (c56df6b) merged in. Scope is the frontend and how it integrates with the existing backend. No backend code was changed.

## What this workstream delivered

| Area | Change |
|---|---|
| Merge | sprint-3 merged into the revamp. Sprint-3's frontend fixes (attendance period and empty state, platform admin guard) were carried into the revamp's feature folders. |
| Themes | Role colour x mode system (`docs/frontend/THEME-SYSTEM.md`): learners purple, teachers moss green, guardians fresh green, school and platform admins light blue. Dark, warm cream light, and calm (SNE) modes. Fixes the invisible light-mode Login button. |
| Theme persistence | Saved on the device and restored before first paint (no flash). Mirrored to the account (`/api/accessibility-profiles`) and now **restored on sign-in**, so it follows the user to other devices and shared tablets. Works offline from the device copy. |
| Role guard | Every signed-in page has an access rule (`config/routes.ts`). Opening another role's page shows "This page isn't part of your account" with a link home. The screen does not render, so it sends no requests the backend would refuse. The backend's own role checks remain the real enforcement. |
| Error states | One shared rule for an unreachable API (offline, gateway 502/503/504, proxy 500): "We can't reach Elekeza right now…". It replaces generic messages such as "Registration failed" on every screen. Validation errors now show the first field message. |
| Tests | Unit tests for themes, role palettes, account theme restore, route access and error messages. New end-to-end spec `e2e/theme-and-access.spec.ts`. |

## Verification

All results are from 2026-10-27, run against the real backend (dev profile, H2, seeded demo data).

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npx vitest run` | 75/75 passed |
| `npm run build` (production) | compiled successfully, 56 routes |
| Playwright e2e (whole suite, final clean run on the finished code) | **46/46 passed, 0 retries, 0 flaky** (14.9 min), including 8 new theme and access tests |
| API contract map | all 118 frontend API calls match a real backend route (method + path), including 9 built from helpers and checked by hand |
| Five-role browser crawl on the **production build** (learner, teacher, guardian, school admin created through the real school registration, platform admin) | 56 pages, each fully loaded within 1.9 s, with **0 failed API calls, 0 console errors, 0 stuck loaders, 0 crashes**. The only error is the expected 401 from the session check before sign-in. |
| Cross-role access | 29 cross-role visits: 25 show the guard panel and fire no refused requests. 4 are allowed by design (admins on teacher pages the admin dashboard links to); a new school's admin sees only its own school's data there. |
| Theme contrast (production build) | 12 role x mode combinations x 9 text/button pairs: all 108 >= 4.5:1 (WCAG AA). The lowest is 4.64. |
| Theme persistence | correct `data-theme` and `data-role` before hydration, after hydration and after reload, for all 12 combinations |

Evidence (screenshots, crawl report) is attached to the review message.

## Roles and access

| Role | Home | Can open |
|---|---|---|
| STUDENT | `/student-home` | learner pages, lessons, quizzes, exams, progress, preferences |
| TEACHER | `/teacher` | teacher pages, classwork, attendance, lesson preview |
| GUARDIAN | `/guardian` | guardian pages (wards, fees, reports, schedule, messages) |
| SCHOOL_ADMIN | `/admin` | admin, staff, import, finance, attendance, engagement, and teacher pages the admin dashboard links to |
| ADMIN (platform) | `/admin` | everything a school admin can, plus `/super-admin` |

Profile, settings, notifications and the coming-soon pages are open to every signed-in role.

## Environment variables

**Frontend (build time)**

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes for production builds | Backend origin. `/api/*` is proxied there, so cookies stay first-party. The build fails without it. |
| `CAPACITOR_SERVER_URL` | Android app only | |

`NEXT_PUBLIC_SENTRY_DSN` is listed in `.env.example`, but frontend error monitoring is **not wired**: `sentry.client.config.ts` and `sentry.server.config.ts` are empty and no Sentry package is installed.

**Backend (production profile) the pilot depends on:** `SPRING_PROFILES_ACTIVE=prod`, `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS` (the frontend origin), `FRONTEND_URL`, `SECURE_COOKIES=true`, `AI_SERVICE_URL`, `AI_INTERNAL_SECRET` (must match the AI service's `INTERNAL_SECRET`; the AI service now refuses all requests when it is unset).

## Still mocked or needing credentials

| Integration | Default | To make it real |
|---|---|---|
| M-Pesa fee payments | **mock** (`fees.mpesa-mode=mock`; screens label it) | set `FEES_MPESAMODE=live` (not mapped in `application-prod.yaml`, so it must be set explicitly) plus `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_ENVIRONMENT`. Live callbacks are verified with Safaricom before completion (sprint 3). Not testable without Daraja credentials. |
| AI adaptation, quiz generation, tutor | mock in dev, `real` in prod | AI service deployed with `AI_PROVIDER`, `AI_API_KEY`, `INTERNAL_SECRET`. The tutor falls back to deterministic answers when no provider is configured. |
| SMS (Africa's Talking) | mock | `SMS_PROVIDER=africa_talking`, `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_SENDER_ID` |
| Email (password reset links) | mock | `EMAIL_PROVIDER=javamail`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` |
| File storage | local/mock | `STORAGE_PROVIDER=cloudflare_r2` and the `CLOUDFLARE_R2_*` keys |
| Error monitoring | none on the frontend | add Sentry (package + config) if wanted |

## Not built in the frontend yet

- **Coming-soon placeholders:** `/marketplace`, `/government`, `/therapist`, `/teacher/plans`, `/teacher/schedule`.
- **Backend features with no screen yet:** billing plans and subscriptions, device management, curriculum tree and competency progress, deadlines, feature-flag and audit-log admin, system health and metrics, waitlist admin, exam integrity reports, guardian exam results, personalised lesson variants (`/api/content/lessons/{id}/adapted`) and lesson feedback.

## Known issues and risks

- **Screen styling:** about 550 legacy palette classes remain in screens. A compatibility layer keeps them readable in every mode (contrast verified on the shared tokens), but screens should move to the semantic classes over time.
- **Lesson body text** renders in the role colour rather than near-black. It is readable, and will be fixed when the lesson screen is migrated.
- **Shared-device theme flash:** on a shared device, the previous user's theme shows on the sign-in page until the next user signs in. Their account theme is then applied.
- **Dev-only slowness:** in dev mode the first visit to a page takes 6 to 12 s while Next compiles it. Production builds do not have this.

## Earlier review findings, re-checked on this branch (by reading code)

- **Forged M-Pesa callbacks:** fixed. Live mode verifies status with the provider before completing.
- **AI service accepting requests when its secret is unset:** fixed (fail-closed).
- **Password reset:** implemented end to end (token endpoint + reset screen).

