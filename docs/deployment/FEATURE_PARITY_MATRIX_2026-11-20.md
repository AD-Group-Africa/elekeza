# FEATURE PARITY MATRIX — lineage A vs consolidated line B

**Baseline compared:** `origin/main` `a86e128`, `origin/develop` `f65f436`, `origin/staging` `3d8c738`
→ versus **`baed7f4`** (`consolidation/2026-11-19`).

**Method.** Commit subjects, full path diffs (`git diff --name-status`), and — where a path-level difference
could hide a functional one — the actual source on both sides. API parity was checked by extracting every
route literal from both trees (`git grep -oE '@(Get|Post|Put|Patch|Delete)Mapping\("[^"]*"'`, 40 distinct in A,
149 in B) and resolving each A-only literal to its replacement.

Classification: **Integrated** · **Superseded** · **Missing-required** · **Missing-non-essential** ·
**Obsolete** · **Unclear**.

| # | Feature / change | Lineage A | Lineage B (`baed7f4`) | Difference | Risk | Verdict |
|---|---|---|---|---|---|---|
| 1 | Cognitive / disability profile on learner | `Learner.cognitiveProfile` as `ElementCollection` + `V7__add_cognitive_profile.sql` | `learner/Learner.kt`, `LearnerProfile.kt`, `OnboardingService`, `AiDtos.cognitiveProfile`; `V7__personalization.sql` | Same concept, different column modelling and migration number | Low | **Integrated** |
| 2 | Default cognitive profile when unset (`adhd`) | `992dfa4` | Onboarding requires a placement/profile; AI pipeline has a `none.txt` prompt so an unset profile is a supported state rather than silently defaulting | B is stricter and avoids labelling a child by default | Low | **Superseded** (better) |
| 3 | PDF/DOCX/TXT extraction pipeline | `content/FileUploadService.kt`, `FileUploadController`, `V10__content_upload_table.sql` | `content/TextExtractor.kt` (PDFBox + DOCX + TXT), `ContentProcessingService`, `ContentController` `POST /api/content/upload/file`; 3 dedicated regression tests | Same capability; B adds title handling, size caps and authorization tests | Low | **Integrated** |
| 4 | M-Pesa initiation and callback | `payments/Mpesa.kt`, routes `/api/payments/mpesa/initiate`, `/mpesa/callback`, `/status/{checkoutRequestId}` | `finance/MpesaGateway.kt`, `payments/MpesaService.kt`, `MpesaStatusVerifier.kt`, `MpesaReconciliationService.kt`, `MpesaPaymentFinalizer.kt`, `V18__payment_integrity.sql`; routes `/api/payments/stkpush`, `/api/payments/callback` | B verifies status out-of-band and reconciles; status is no longer a browser-facing endpoint | Low | **Superseded** (stronger) |
| 5 | Content generation endpoint | `POST /api/content/generate/{contentId}` | Generation happens inside `upload/text` and `upload/file`; `content/status/{id}` reports progress | B folded generation into ingestion | Low | **Superseded** |
| 6 | Quiz start / answer / submit | `/{lessonId}/start`, `/{quizId}`, `/{quizId}/submit` | `/{lessonId}/start`, `/{quizId}/answer`, `/{quizId}/complete`, `/{quizId}/review` | Renamed and split; B adds a replay guard (409) and review surface | Low | **Superseded** |
| 7 | Learner progress + stats | `/api/learner/progress`, `/progress/{contentId}`, `/stats` | `/api/progress/dashboard`, `/api/progress/lessons`, `learner/LessonProgress`, `analytics/student` | Re-homed; `stats` folded into the dashboard/analytics payloads | Low | **Superseded** |
| 8 | Quiz history | `QuizService` history route | `analytics` + `progress/lessons` + gamification (`LearningStreak`, badges) | History is now part of the dashboards; no standalone route | Low | **Superseded** |
| 9 | Adaptive UI config | `learner/AdaptiveUIService.kt` → `GET /api/learner/config`, `GET /config/preview` with `UIConfig(fontSize, spacing, contrast, animations, layoutDensity, assistiveMode)` | `accessibility/AccessibilityProfile` + `GET|PUT /api/accessibility-profiles/{userId}` with an enforced contract: `theme`, `textScale` 0.9–2.0, `reducedMotion`, `highContrastFocus`, `ttsEnabled`, `ttsRate`, `plainLanguage` | B's contract is validated server-side and per-user; **`spacing` and `layoutDensity` have no equivalent** | Low | **Superseded**, with two **missing-non-essential** controls |
| 10 | Google / OAuth2 sign-in | `security/OAuth2SuccessHandler.kt` + `oauth2:` block | Handler removed; `OAuth2ClientAutoConfiguration` excluded when no credentials; `JwtUtil` keeps a legacy comment | No frontend surface in either line ever called it (`git grep -i "google\|oauth" -- frontend/src` → 0 hits in B) | None in practice | **Obsolete** |
| 11 | Hardcoded Railway backend URL | `frontend/next.config.ts` rewrite to `https://elekeza-production-38db.up.railway.app` | `NEXT_PUBLIC_API_URL`, and the build **fails** if unset in a production build | B cannot be accidentally deployed pointing at a dead host | Low | **Superseded** (better) |
| 12 | Railway boot fixes (repos, FastAPI props, Dockerfile) | `fb2ecc7`, `f5bc472`, `00f8891` | B ships its own `backend/Dockerfile`, `application-{dev,prod}.yaml`, and boots successfully against PostgreSQL 16 | Those specific defects do not exist in B's code | None | **Obsolete** (knowledge retained) |
| 13 | Frontend page set | ~30 flat routes under `src/app/**` | 60 routes under `src/app/(app)/**` and `(public)/**`, plus `redirects()` for `/dashboard`, `/dashboard/history`, `/document/:id`, `/upload`, `/guardian/settings` | Superset; retired URLs still resolve | Low | **Superseded** |
| 14 | Accessibility toolbar | `components/AccessibilityToolbar.tsx`, `hooks/useAccessibilitySettings.tsx`, `hooks/useCognitiveProfile.tsx` | Theme system (`theme`, calm mode), TTS, `textScale`, `reducedMotion`, `plainLanguage` via the accessibility profile API | Same intent, server-persisted in B | Low | **Superseded** |
| 15 | Auth / onboarding / placement / guardian link | `cee52a7`, `a93ad22`, `965216f` | `auth/*`, `learner/OnboardingService`, `OnboardingController`, `GuardianLinkLifecycleController`, lifecycle tests | B is a superset with tests | Low | **Integrated** |
| 16 | `elewa` → `elekeza` rename | `3b9251c` | Complete in B (`com.elekeza.backend`) | B even dropped A's stale compiled `com/elewa` classes | None | **Integrated** |
| 17 | Tracked environment files | `backend/.env`, `Accessible-docs/.env`, `ai-elewa/.env.backup` | Absent | **Security improvement** — but the values survive in A's history | **Medium** (see lineage doc §6) | **Superseded** (must stay removed; rotate values) |
| 18 | Flyway migration chain | `V1__initial_schema` … `V14__seed_test_accounts` | `V1__baseline_schema` … `V21__privacy_consent_erasure_retention` | Incompatible chains: an A-era database cannot be adopted by B | **Medium** for any existing A database | **Divergent — see §3** |
| 19 | Backend test suite | none comparable | 417 tests, 64 suites, 0 failures (`2026-11-20`) | — | — | **Integrated** (B only) |
| 20 | AI service | `317315d` introduced stage1–4 | 603 tests, `none.txt` profile, tutor endpoint, fail-closed internal auth | B extends A's pipeline | — | **Integrated** |
| 21 | Staging snapshot content (lineage C) | — | — | 1,077-file delta, older attempt at the same product; no unique product capability identified | None | **Obsolete** (retained as provenance) |

---

## 1. Missing-and-required

**None identified.** Every capability exercised by the five-role acceptance journeys exists in `baed7f4`.

## 2. Missing but non-essential

| Loss | Impact | Recommendation |
|---|---|---|
| `spacing` control (normal / wide / very-wide) | Learners who benefit from wider letter/line spacing cannot set it explicitly | Defer to post-pilot; if requested by AT4D practitioners, add `spacing` to `ALLOWED_KEYS` (one enum + one CSS class) |
| `layoutDensity` (normal / low / structured) | No explicit density control | Same as above; `textScale` + `reducedMotion` cover the common cases |

Both are additive enum values in `AccessibilityProfile.ALLOWED_KEYS`, not architectural work. They are
**not** in scope for the pilot and did not justify holding the consolidation.

## 3. The one migration risk that matters

If any deployed environment was migrated by lineage A, its `flyway_schema_history` contains
`V1__initial_schema`, `V2__onboarding_schema`, … which do not exist in B. Pointing B at that database fails
validation immediately (by design — `validate-on-migrate: true`).

Correct handling: dump the A-era database, create a clean B schema with B's 21 migrations, then transfer data
with an explicit column mapping script. Never disable `validate-on-migrate` to force it through.
**[A]** No such environment is known to exist today; the only databases seen in this session were created
fresh by B during the restore drill.

## 4. How this matrix could be wrong

- Route extraction compares **literal strings**, so two endpoints can be "different" purely by prefix. Each
  A-only literal above was resolved manually to a B equivalent, but a subtle behavioural difference inside a
  resolved endpoint would not show up in this method.
- Commit subjects were treated as intent, not proof; where a subject promised something (e.g. "all startup
  errors resolved") the claim was checked against B's actual code only for the rows listed.
- B's green suites prove *B works*, not that B reproduces A. The feature-level reading above is what closes
  that gap, and it is a code review, not a test.
