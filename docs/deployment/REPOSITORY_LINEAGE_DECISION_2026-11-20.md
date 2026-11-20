# REPOSITORY LINEAGE DECISION — 2026-11-20

**Decision status: RECOMMENDED, NOT EXECUTED.** No protected branch has been moved, no history rewritten,
nothing deleted. The single open decision belongs to Harrison (section 8).

Every claim below is labelled one of:

- **[V] Verified** — produced by a command in this session; the command is quoted.
- **[O] Observation** — read from code or config, not exercised at runtime.
- **[A] Assumption** — believed but not proven here.
- **[R] Recommendation** — a judgement, not a fact.

---

## 1. The three-history problem, restated with current numbers

`git merge-base` returns **empty** for `HEAD` against each protected branch, so the repository holds three
unrelated root histories:

| Lineage | Root commit | Current refs | Tip |
|---|---|---|---|
| **A — original application** | `a374599` | `origin/main`, `origin/develop` | `a86e128`, `f65f436` |
| **B — pilot / sprint line** | `6a6ddfc` | `consolidation/2026-11-19` and every sprint branch | **`baed7f4`** |
| **C — staging snapshot** | `fd7cf09` | `origin/staging` | `3d8c738` |

**[V]** Reproduced this session:

```
$ git merge-base origin/main HEAD      → (no output)
$ git merge-base origin/develop HEAD   → (no output)
$ git rev-list --max-parents=0 HEAD    → 6a6ddfc…
$ git rev-list --max-parents=0 origin/main    → a374599…
$ git rev-list --max-parents=0 origin/staging → fd7cf09…
```

Divergence is large, not a stale pointer:

| Measure | Value |
|---|---|
| Commits in `origin/main` not in `HEAD` | **50** |
| Commits in `origin/develop` not in `HEAD` | **21** |
| Paths differing `origin/main` → `HEAD` | **1,290** |
| Paths differing `origin/develop` → `HEAD` | **1,513** |

**Consequence: no fast-forward exists for `main`, `develop` or `staging`.** Yesterday's migration plan assumed
one; that assumption is withdrawn (see `ANCESTRY_CORRECTION_2026-11-20.md`).

Local state is worth stating precisely because it is easy to misread: local `main`, `develop` and `staging`
already point at `a489682` (the consolidated tree at the time), while the **remote** branches still hold
lineage A and C. Nothing on the remote has changed this session.

---

## 2. What lineage A actually contains

### 2.1 The 50 commits unique to `origin/main`

Grouped by intent, from `git log --oneline --no-merges HEAD..origin/main`:

| Group | Commits | Subject |
|---|---|---|
| Railway/deploy repair | `fb2ecc7`, `f5bc472`, `00f8891`, `db4a0da`, `9b45a44` | "all startup errors resolved — ready for Railway deployment", repository-query fixes, boot errors (LearnerProfileRepository, fastapi props, Dockerfile), pre-refactor snapshot, Flyway + multipart config |
| Next.js URL wiring | `a86e128`, `6e907e9` | "Update next.config.ts", "url" |
| Cognitive profile | `992dfa4`, `a97fdcc`, `1f66fb3`, `f92870e` | default to `adhd` when unset, `toList()` over `toTypedArray()`, `ElementCollection` + V7 collection table, V5/V6 quiz corrections |
| Content pipeline | `db9ddc9` | `POST /api/content/upload/file` — PDF/DOCX/TXT extraction |
| AI pipeline | `317315d` | ai-elewa stage1–4, cognitive prompts, tests |
| Frontend UI | `df3f798`, `9eb83df`, `32026b6`, `d747fb6`, `b05abb8`, `942679f`, `44d9d4f`, `fb5d62c` | disability profile, quiz reviews, "new updates" ×2, frontend integration |
| Auth/onboarding | `a93ad22`, `cee52a7`, `965216f` | Phase 3 core learning loop, auth/onboarding/quiz/content/progress foundation |
| Repo hygiene | `f65f436`, `3b9251c`, `68223d0`, `8a399d5`, and the `Delete …` pair | IDE/env cleanup, `elewa` → `elekeza` rename |

### 2.2 The 21 commits unique to `origin/develop`

`origin/develop` shares lineage A with `origin/main` (`f65f436` is its tip) and is a strict subset in intent:
the same rename/cleanup/frontend/auth work, **without** the Railway, cognitive-profile and content-upload
commits. It carries no feature `main` lacks.

### 2.3 Where lineage A's file content went

`git diff --name-status origin/main HEAD` reports **109** paths that exist in A and not in B. They are not 109
lost features; they fall into four buckets:

| Bucket | Example paths | Verdict |
|---|---|---|
| Flat App-Router pages, replaced by feature-based tree | `src/app/dashboard/page.tsx`, `src/app/admin/users/page.tsx`, `src/app/teacher/students/page.tsx` | **Superseded** — B serves the same journeys under `src/app/(app)/…` (60 `page.tsx` routes) plus `redirects()` for the retired URLs (`/dashboard`, `/upload`, `/document/:id`, …) |
| `com.elekeza.backend.<feature>` files re-laid out into feature packages | `content/ContentService.kt`, `payments/Mpesa.kt`, `quiz/QuizService.kt` | **Superseded** — same responsibilities, richer implementations (see §3) |
| Notices, helper scripts, stray logs | `backend/FIX*.ps1`, `MASTER_FIX.ps1`, `bootrun-check.*.log`, `ELEWA_full_structure.txt` | **Obsolete** — scratch repair scripts, not product code |
| **Tracked secrets** | `backend/.env`, `Accessible-docs/.env`, `ai-elewa/.env.backup` | **Deliberately removed in B — keep it that way.** History still contains them; rotation policy required (§6) |

`origin/develop`'s extra 300 paths are almost entirely build output and IDE state that B correctly ignores:
`backend/build/classes/…` (compiled `.class` files including a stale `com/elewa/backend` package),
`backend/.gradle/**`, `backend/.idea/**`, `spring.log`, `backend/.gradle-user-home/…`.

---

## 3. Feature-by-feature verdicts

Detail and evidence live in `FEATURE_PARITY_MATRIX_2026-11-20.md`. Summary:

| Capability | Verdict |
|---|---|
| Cognitive profile / disability profile | **Already integrated** — `learner/Learner.kt`, `OnboardingService`, `AiDtos.cognitiveProfile` |
| PDF/DOCX/TXT extraction | **Already integrated** — `content/TextExtractor.kt` + `ContentController` `/upload/file` |
| M-Pesa | **Superseded by a stronger implementation** — A had one `Mpesa.kt`; B has gateway, status verifier, reconciler, finalizer and an integrity migration |
| Adaptive UI config endpoint | **Superseded, with two cosmetic losses** — B's `accessibility/AccessibilityProfile` contract covers theme, textScale, reducedMotion, highContrastFocus, ttsEnabled, ttsRate, plainLanguage; A's `spacing` and `layoutDensity` have no equivalent |
| Google OAuth sign-in | **Obsolete** — A's `OAuth2SuccessHandler` existed but no frontend surface ever called it; B removed the handler and disables OAuth2 autoconfiguration |
| Railway deploy fixes | **Obsolete as code, valuable as knowledge** — B deploys via `render.yaml`; the Railway URL was hardcoded in A's `next.config.ts` and is now `NEXT_PUBLIC_API_URL` (B throws at build time if unset in production) |
| Auth/onboarding/quiz foundation | **Already integrated and extended** |
| Frontend journeys, five roles | **Already integrated and extended** |

**No lineage-A functionality was found that is missing from the consolidated tree and needed for the pilot.**
Two cosmetic accessibility controls are the only genuine gaps.

---

## 4. Lineage C (staging snapshot `3d8c738`)

**[V]** Preserved three ways: local branch `backup/staging-orphan-3d8c738`, annotated tag
`v0.1.0-orphan-snapshot` pushed to origin, and `backups/consolidation-2026-11-19/staging-orphan.bundle`
("records a complete history"). Its 1,077-file delta against the consolidated tree is enumerated in
`staging-orphan-files.txt` (1,077 lines) and `staging-orphan-vs-consolidated.patch` (1,077 `diff --git` blocks).

**[O]** Lineage C is a *snapshot of an older attempt at the same product*: Kotlin backend, earlier frontend,
no test suite comparable to B's 417 backend / 603 AI tests. Nothing in it is product-relevant that B lacks.
It is valuable as provenance, not as a source.

---

## 5. Recommended canonical strategy

**[R] Option 4 — archive-then-replace.** Keep B as the canonical line; make the protected names point at it
only after every lineage is archived and discoverable.

Sequence (executed by Harrison, not by this agent):

```bash
# 1. Freeze the evidence (additive only — safe, and partially done already)
git tag -a v0.1.0-mvp-archive  origin/main    -m "Lineage A (main) before consolidation"
git tag -a v0.1.0-develop-archive origin/develop -m "Lineage A (develop) before consolidation"
git push origin v0.1.0-mvp-archive v0.1.0-develop-archive
#    v0.1.0-orphan-snapshot → 3d8c738 is ALREADY pushed

# 2. Verify every tag resolves before any pointer moves
git rev-parse v0.1.0-mvp-archive v0.1.0-develop-archive v0.1.0-orphan-snapshot

# 3. Replace the pointers (requires Harrison's explicit approval — this is the step forbidden today)
git push --force-with-lease=main:a86e128    origin baed7f4:main
git push --force-with-lease=develop:f65f436 origin baed7f4:develop
git push --force-with-lease=staging:3d8c738 origin baed7f4:staging

# 4. Only after 3 succeeds: set the default branch to `main`
```

Why not the alternatives:

| Option | Why rejected |
|---|---|
| 1. Bare force-update | Same end state as 4 but lineage A/C become reachable only through reflogs and local branches — one `gc` away from invisible |
| 2. Unrelated-histories merge via PR | Produces a tree containing two complete copies of the project; every path collides; the result is unreviewable and would need one side discarded anyway |
| 3. New canonical branch name | Zero risk, but the names everyone clones by default keep pointing at an abandoned lineage — the confusion persists indefinitely |

`--force-with-lease` is used with the **expected old value**, so the command fails rather than clobbering if
anyone pushed to those branches in the meantime.

### Rollback

Every step is reversible and no object is destroyed:

```bash
# Undo step 3 entirely:
git push --force-with-lease=main:baed7f4    origin a86e128:main
git push --force-with-lease=develop:baed7f4 origin f65f436:develop
git push --force-with-lease=staging:baed7f4 origin 3d8c738:staging
```

Independent recovery paths if even the tags were lost: `backups/consolidation-2026-11-19/elekeza-mirror.git`
(49 refs, `fsck --full` exit 0), `elekeza-all-refs.bundle` and `staging-orphan.bundle` (both "complete
history"), plus three local `backup/*` branches. SHA-256 sums for all eleven artifacts are in
`BACKUP_VERIFICATION_2026-11-20.md`.

---

## 6. Residual risks created by the history itself

1. **Secrets in history.** Lineage A tracked `backend/.env`, `Accessible-docs/.env` and
   `ai-elewa/.env.backup`. **[O]** They are deleted in B, but they remain in A's history and will stay
   fetchable as long as A's commits are reachable. Removing them requires a history rewrite, which is
   prohibited. **Mitigation: treat every value that ever appeared in those files as compromised and rotate it
   before staging goes live** — specifically `JWT_SECRET`, `AI_INTERNAL_SECRET`, `DB_PASSWORD`, any
   `GROQ_API_KEY`/`AI_API_KEY`, `LANGFUSE_*`, `MPESA_*`, `AFRICA_TALKING_API_KEY`, `CLOUDFLARE_R2_*`,
   `MAIL_PASSWORD`. I have not read the values and will not print them.
2. **Divergent migration numbering.** A's Flyway chain is `V1__initial_schema` … `V14__seed_test_accounts`;
   B's is `V1__baseline_schema` … `V21__privacy_consent_erasure_retention`. A database migrated by lineage A
   **cannot** be adopted by lineage B (Flyway checksum/description mismatch on every overlapping version).
   Any existing A-era database must be dumped, migrated by B onto a clean schema, and the data moved by
   script — not by pointing B at it.
3. **Default branch.** `origin/HEAD → origin/staging`, which currently means lineage C. Until step 3 above,
   a fresh clone lands on an orphan snapshot. This is a trap for new contributors.

---

## 7. What was NOT done, deliberately

| Action | Status |
|---|---|
| Force-push any protected branch | **Not executed** — prohibited without approval |
| Delete any branch, tag or backup | **Not executed** |
| Rewrite history to purge the old `.env` files | **Not executed** — prohibited |
| Repoint the GitHub default branch | **Not executed** — follows step 3 |

---

## 8. Decision required from Harrison

One question, one answer:

> **Approve Option 4** (tag `v0.1.0-mvp-archive` + `v0.1.0-develop-archive`, then `--force-with-lease`
> `main`/`develop`/`staging` to `baed7f4`, then set the default branch to `main`), **or** choose Option 3
> (leave the protected names alone and declare `release/pilot-2026-11` canonical).

If Option 4 is approved, the four commands in §5 are the complete operation. If Option 3 is approved, I will
rename the consolidation branch and update the docs that reference it — no force, no rewrite.

**[A]** Neither option affects the staging deployment plan: both deploy from `baed7f4` either way.
