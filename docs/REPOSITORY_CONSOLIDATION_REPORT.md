# REPOSITORY CONSOLIDATION REPORT

**Date:** 2026-11-19
**Author:** Buffy (release engineering)
**Status:** PLAN COMPLETE, MERGE NOT EXECUTED — awaiting owner approval
**Evidence:** `artifacts/audit-2026-11-19/`

---

## 1. Why consolidation is needed (and why it is small)

The project does not have a repository problem. It has a **head problem**: three refs each hold work the others do not.

| Ref | Tip | Holds | Missing |
|---|---|---|---|
| `sprint-3-safe-config` (current worktree) | `47d17f5` (+1 unpushed) | privacy/erasure module, county-scoped deadlines, V20/V21, guardian messaging fix, 8 new test classes | the entire 15-Nov frontend revamp |
| `feat/elekeza-pilot-completion` | `378579d` | merged PR #7/#8/#9: feature-folder frontend, `lib/api` client, design tokens, gamification, CI fixes | sprint-3 backend + uncommitted privacy work |
| `origin/staging` | `3d8c738` | 2 unique commits: "Phase 1 AI improvements (5–7) + Tutor endpoint", release-evidence, db-backup/restore/staging-gate scripts | everything else |

**Measured divergence between head A and head B:** `git rev-list --left-right --count sprint-3-safe-config...origin/feat/elekeza-pilot-completion` → **1 commit only on sprint-3, 25 commits only on pilot**. The two lines share almost all ancestry: `pilot` already contains `sprint-3-safe-config`'s parent (`c56df6b`). Consolidation is therefore a **fast-forward-shaped merge with a single conflict**, not a rewrite.

---

## 2. Merge simulation (executed, non-destructive)

```
git merge-tree --write-tree sprint-3-safe-config origin/feat/elekeza-pilot-completion
exit=1
CONFLICT (modify/delete):
  frontend/src/app/guardian/communication/page.tsx
  deleted in origin/feat/elekeza-pilot-completion and modified in sprint-3-safe-config.
  Version sprint-3-safe-config left in tree.
```

**Exactly one conflict, out of 379 changed files (+20,711 / −15,976).**

### The one conflict, explained

- `sprint-3-safe-config` (commit `47d17f5`) modified the guardian messaging page to make messaging accessible and verify delivery.
- `feat/elekeza-pilot-completion` **moved** it into the route-group structure at `frontend/src/app/(app)/guardian/communication/page.tsx`.
- Git sees a modify/delete, but the truth is a **move + edit**.

**Resolution (manual, 15 minutes):** port the sprint-3 messaging accessibility/delivery fix into `frontend/src/app/(app)/guardian/communication/page.tsx`, then `git rm frontend/src/app/guardian/communication/page.tsx`. Verify with the guardian messaging E2E spec.

**Do not** take either side wholesale. Taking `sprint-3`'s version loses the route-group refactor; taking `pilot`'s loses the messaging fix.

---

## 3. Unique implementations per source (must not be lost)

| Source | Unique functionality | Where it must land |
|---|---|---|
| `sprint-3-safe-config` + worktree | `privacy/` module (consent, erasure, retention), `V21__privacy_consent_erasure_retention.sql` | `develop` — currently **uncommitted** |
| | `DeadlineVisibility`, `CountyKey`, `V20__deadline_county_scope.sql` | `develop` — currently **uncommitted** |
| | `DemoSeedGuard` (production seed protection) | `develop` — currently **untracked** |
| | Guardian deadline-link lifecycle + tests | `develop` |
| | Guardian messaging accessibility fix (`47d17f5`) | `develop` (the 1 conflict) |
| `feat/elekeza-pilot-completion` | Frontend feature-folder architecture, `lib/api/{client,errors,index}.ts`, `lib/roles.ts`, design tokens, gamification UI, PWA/CI fixes | `develop` |
| `origin/staging` | "Phase 1 AI improvements 5–7", Tutor endpoint work, `release-evidence/`, `scripts/db-backup.sh`, `db-restore-drill.sh`, `staging-gate.sh` | **Must be diffed and cherry-picked/merged before `staging` is repurposed** |
| `origin/Iyann` (`8cbf673`) | Theme system, role guard, account theme sync (PR #7) | Already inside `pilot` — **keep branch as attribution** |
| `stash@{0}` | 299 files of 2026-10-08 reconciliation WIP | **Do not drop.** Archive as a patch before touching stashes |

---

## 4. Incompatible dependencies / config reconciliation

| Item | Finding | Action |
|---|---|---|
| Next.js version | `frontend/package.json` → `next@16.3.3`, React 19.2.3 | Identical on both lines — no conflict |
| Tailwind | v4 postcss plugin **and** `tailwindcss@^3.4.19` dev dependency present | Inconsistent; confirm intended major before launch (cosmetic risk only, build passes) |
| Backend JVM | `build.gradle.kts` targets **17**; CI uses Temurin 17; local machine runs **21** | Both work (build+tests passed on 21). Dockerfile pins `gradle:8.5-jdk17` + `eclipse-temurin:17-jre` → **keep 17 in prod** |
| PostgreSQL driver / Flyway | Deliberately pinned (42.7.14 / 11.20.3) with in-repo rationale | **Preserve** — do not "upgrade" casually |
| Flyway versions | V1–V19 on both lines; **V20/V21 only in the uncommitted worktree** | Commit before merge so numbering cannot collide |
| `.github/workflows/ci.yml` | Sprint-3 version lacks the AI env + backend-JAR-for-e2e fixes from `34cc00f` | Take the **pilot** version (it supersedes) |
| `application-prod.yaml` | `AI_SERVICE_URL` already defaults to `https://elekeza-ai.onrender.com` | Align with the actual Render service name in `render.yaml` |
| `.env.example` | 48 keys at root + 7 in `ai-elewa` | Preserve; see `docs/deployment/ENVIRONMENT_VARIABLES.md` |

---

## 5. Execution procedure (requires Harrison's approval)

> Steps 1–5 are **local and reversible**. Steps 6–7 touch the **remote** and are gated on explicit approval.

```bash
# 0. Safety: full mirror backup of the canonical repo (never touched again)
git clone --mirror https://github.com/AD-Group-Africa/elekeza.git backups/elekeza-mirror-20261119.git

# 1. Preserve the stashes and the uncommitted work as patches (belt and braces)
git stash list > backups/stashes-20261119.txt
git diff > backups/uncommitted-20261119.patch

# 2. Commit the 42 uncommitted paths on a dedicated branch (do NOT `git add .`)
git checkout -b consolidation/2026-11-19
git add backend/src/main/kotlin/com/elekeza/backend/privacy \
        backend/src/main/resources/db/migration/V20__deadline_county_scope.sql \
        backend/src/main/resources/db/migration/V21__privacy_consent_erasure_retention.sql \
        backend/src/main/kotlin/com/elekeza/backend/calendar/CountyKey.kt \
        backend/src/main/kotlin/com/elekeza/backend/calendar/DeadlineVisibility.kt \
        backend/src/main/kotlin/com/elekeza/backend/config/seed/DemoSeedGuard.kt \
        backend/src/test/kotlin/com/elekeza/backend/privacy \
        backend/src/test/kotlin/com/elekeza/backend/calendar/DeadlineCountyMigrationTest.kt
# review every remaining modified file individually, then commit
git commit -m "feat(privacy,calendar): consent/erasure module, county-scoped deadlines, V20/V21"

# 3. Bring in the 15-Nov frontend line
git merge origin/feat/elekeza-pilot-completion
#   resolve the single conflict per §2, then:
cd frontend && npx tsc --noEmit && npx vitest run && npm run build

# 4. Reconcile the staging-only work (inspect first, then cherry-pick or merge)
git log --oneline origin/staging --not HEAD          # expect fd7cf09, 3d8c738
git diff $(git merge-base origin/staging HEAD) origin/staging -- ai-elewa backend scripts

# 5. Verify the consolidated tree BEFORE any push
cd backend && ./gradlew test bootJar      # expect 397+ tests, 0 failures
cd ../frontend && npx vitest run && npm run build
cd ../ai-elewa && pytest tests -m "not live and not live_full"

# 6. Push integration branch, then promote (REMOTE — APPROVAL REQUIRED)
git push -u origin consolidation/2026-11-19
git push origin consolidation/2026-11-19:develop
git push origin consolidation/2026-11-19:main

# 7. Repoint the GitHub default branch to `main` (web UI or gh), then protect it
```

### Branch cleanup — classification (nothing deleted without approval)

| Branch | Class | Action |
|---|---|---|
| `Iyann` | Merged (PR #7) — **keep for attribution** | Keep |
| `feature/ui-visibility-gamification` | Merged (PR #8) | Optional delete after backup |
| `integration/pr7-on-pilot-completion` | Merged (PR #9) | Optional delete after backup |
| `feature/auth-onboarding-quiz`, `feature/frontend-integration` | Merged (PRs #1/#2/#3) | Optional delete after backup |
| `jules-9509086085202126839-c3303c01` | Merged (PR #6) | Optional delete after backup |
| `audit/sprint-2-payment-security` | Merged into the sprint-3 line | Keep until post-launch audit |
| `frontend/complete-system`, `frontend/revamp` | Superseded by `pilot-completion` | Backup, then review |
| `Ai` | Historical AI-only line | Keep (cheap, explains provenance) |
| `release/v0.1.0` | Tagged baseline | Keep |
| **`staging`** | **Divergent — 2 unique commits** | **DO NOT delete.** Reconcile first, then repurpose |
| 8 local-only snapshots (`freebuff/*`, `backup/*`, `reconciliation-*`, `integration/staging-reconciliation`) | Local history safety nets | **Never push.** Keep on disk |

---

## 6. History, attribution, and consequences

- **No history rewriting is required.** The merge preserves all 25 pilot commits and the sprint-3 commits; authorship stays intact for Harrison, CarribeanVickie, Alvin Muchiri and Ian-qhamau.
- **`git subtree` is unnecessary** — the services already live in one repo (`backend/`, `frontend/`, `ai-elewa/`). Adopting the `apps/` layout would rewrite every path and break Dockerfiles, CI working-directories and the Android build. **Recommendation: keep the existing top-level layout** and document the deviation (the mandate permits this; see `docs/ARCHITECTURE.md`).
- If the uncommitted privacy work were lost, **the only recovery path is the patch in `backups/uncommitted-20261119.patch`** — take it in step 1.
- Force-push is **not** part of this plan and must not be used on `main`, `develop` or `staging`.

---

## 7. Post-consolidation GitHub hygiene checklist

| Item | Current | Target |
|---|---|---|
| Default branch | `staging` | **`main`** |
| Branch protection | unknown/absent | required on `main`: PR + 1 review + CI green |
| README | `ELEKEZA_README.md` (47 KB) at root | trimmed `README.md` pointing at `docs/` (pending) |
| PR template / issue templates | none | add `.github/PULL_REQUEST_TEMPLATE.md`, issue forms |
| CODEOWNERS | none | add for `backend/`, `frontend/`, `ai-elewa/` |
| Security scanning | none | Dependabot + `dependency-review-action` |
| Releases | 0 (tags only) | create `v0.2.0-launch` Release on the consolidated `main` |
| CI triggers | `push: [main, release/**]` | add `develop`, `staging`, `consolidation/**` |
| CONTRIBUTING | none | add branch policy + local run instructions |

---

## 8. Verification gate before the remote is touched

- [ ] Mirror backup exists and is readable
- [ ] Uncommitted patch written and non-empty
- [ ] Consolidated tree: backend tests green, frontend typecheck+unit+build green, AI suite green
- [ ] The guardian messaging conflict resolved in the **(app)** route and E2E green
- [ ] V20/V21 present and `flyway.info` reports 21 migrations
- [ ] `git status` clean on the consolidation branch
- [ ] Owner approval recorded for the push and the default-branch change

---

# EXECUTION RECORD — 2026-11-19 (consolidation performed)

**Status:** COMPLETE LOCALLY. Nothing pushed; no remote branch or default branch changed.

## 1. Executed

| Step | Result |
|---|---|
| Mirror backup | `backups/consolidation-2026-11-19/elekeza-mirror.git` |
| Working-tree safety net | `tracked-changes.patch` (2,210 lines) + `untracked-files.tgz` (292 KB) |
| Preservation commits | 5 commits covering 34 modified + 38 untracked paths (junk excluded) |
| Merge | `88ad23f` |
| Conflicts | 6 found, 6 resolved |
| Lint gate | `302d32e` — 1 error, not 17 |
| Permanent branches | `main`, `develop`, `staging` all at consolidated head (local) |
| Old tips preserved | `backup/main-mvp-21512cb`, `backup/staging-orphan-3d8c738`, `backup/develop-pre-consolidation` |

## 2. Commit hashes

| Commit | Purpose |
|---|---|
| `47d17f5` | Previous tip of `sprint-3-safe-config` (unchanged) |
| `31bffb9` | feat(privacy) consent/erasure/retention + V21 |
| `7d4bcc9` | feat(calendar) county-scoped deadlines + V20 |
| `1727d4f` | fix(backend) token types, DemoSeedGuard, config |
| `7de019b` | feat(frontend) nav config + role layouts (partly superseded) |
| `dd1caca` | docs(deploy) audit set, Render blueprint, script hardening |
| **`88ad23f`** | **merge: sprint-3 backend + 15-Nov frontend revamp** |
| **`302d32e`** | **fix(frontend) stale eslint-disable -> lint green (consolidated head)** |

## 3. Why 6 conflicts, not the 1 predicted

The simulation compared branch tips; the preservation commits then edited files the pilot line had deleted. All six were resolved by accepting pilot's side **because pilot had independently implemented the same intents**:

| File | Resolution evidence |
|---|---|
| `app/guardian/communication/page.tsx` | Pilot's `features/messaging/screens/GuardianMessagesScreen.tsx` already has `aria-label="Send message"` |
| `app/guardian/schedule/page.tsx` | Pilot's `ScheduleScreen.tsx` already says "View your children" (not "wards' classes") |
| `components/Sidebar.tsx` | Learner `/upload` link already absent from `config/navigation.ts`; `/upload` redirects to `/teacher/content` |
| `components/layout/SidebarLayout.tsx` | Superseded by `AppShell` + `SidebarNav` |
| `public/sw.js` | Generated by `npm run build` |
| `next.config.ts` | Pilot's kept; `allowedDevOrigins` re-added |

Removed as structurally dead (imported the retired shell): `navConfig.ts`, `navConfig.test.ts`, `appShell.test.ts`, 5 section `layout.tsx`.

**No unique implementation was discarded.**

## 4. Discovery: `origin/staging` is an orphan branch

```
$ git rev-list --count origin/staging
2
$ git merge-base HEAD origin/staging
(none - unrelated histories)
```

It is a 2-commit orphan history (root `fd7cf09`) holding a full project snapshot — **1,077 files, +30,838/−4,728** — with **no shared ancestor**. Not mergeable. Preserved as:

- `staging-orphan-vs-consolidated.patch` (105,982 lines)
- `staging-orphan-files.txt` (1,077 paths)
- `staging-orphan.bundle` (fetchable Git bundle)
- local branch `backup/staging-orphan-3d8c738`

**The GitHub default branch must not move until that snapshot is reviewed** — its unique value appears limited to `release-evidence/` screenshots and older `scripts/db-*` variants.

## 5. Verification of `302d32e`

| Check | Result |
|---|---|
| backend `./gradlew test` | 410 / 410, 0 failures (62 classes) |
| backend `bootJar` | BUILD SUCCESSFUL |
| frontend `tsc` | exit 0 |
| frontend `eslint` | exit 0 |
| frontend `vitest` | 84 / 84 |
| Flyway on PostgreSQL 16.16 | 21 / 21 migrations |
| AI live provider | 3 / 3 |
| frontend `npm run build` | **BLOCKED — disk full (ENOSPC)** |
| AI full suite (post-merge) | **BLOCKED — disk full (ENOSPC)** |

## 6. Not done, by instruction

No push. No branch deleted. No history rewrite. No force-push. GitHub default branch unchanged (`staging`). No deployment. Live payments untouched. No real learner data — PG16 verification used a throwaway container, and demo seeding was blocked by `DemoSeedGuard`.
