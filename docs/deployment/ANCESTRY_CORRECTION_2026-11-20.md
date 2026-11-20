# CORRECTION — repository ancestry (2026-11-20)

**Status:** the migration plan published yesterday (`docs/deployment/PR_MIGRATION_PLAN.md`) rested on a
false premise. This document records the verified truth and what it changes.

## What was claimed

> "Because `main` and `develop` are strict ancestors of the consolidated head, promoting them is a
> **fast-forward** — no history is rewritten. `staging` is the only ref that cannot fast-forward."

## What is actually true (verified)

`git merge-base` returns **empty** for `HEAD` against `origin/main`, `origin/develop` and
`origin/staging`. The repository contains **three unrelated histories**, identified by their root commits:

| Lineage | Root commit | Refs |
|---|---|---|
| **A — original application** | `a374599` | `origin/main` (`a86e128`), `origin/develop` (`f65f436`) |
| **B — pilot / sprint line (consolidated)** | `6a6ddfc` | `consolidation/2026-11-19` (`a489682`), `sprint-3-safe-config`, `feat/elekeza-pilot-completion`, `Iyann`, `integration/pr7-on-pilot-completion`, `release/v0.1.0`, `feature/ui-visibility-gamification`, `frontend/revamp`, `frontend/complete-system`, `audit/sprint-2-payment-security` |
| **C — staging snapshot** | `fd7cf09` | `origin/staging` (`3d8c738`) |

Additional facts:

- `origin/main` and `origin/develop` **do** share lineage A with each other (common ancestor `f65f436`).
- `origin/develop` has **21 commits** and `origin/main` has **50 commits** that are not in the consolidated line.
- `git diff --stat origin/develop HEAD` = **1,510 files changed**, which is what a parallel lineage looks like, not a stale pointer.

## Consequence

**No fast-forward is possible for `main`, `develop` or `staging`.** My yesterday's plan and the
`FINAL_RELEASE_GATE_REPORT.md` statement that promotion is a fast-forward were **wrong**; both are corrected
here and in the files themselves. Exactly the same class of error as the earlier mirror-backup claim, and it
was caught the same way: by testing the assertion instead of assuming it.

Moving any of the three protected branches to `a489682` therefore requires **one** of:

| Option | Exact operation | Nature |
|---|---|---|
| **1. Force-update (prohibited without approval)** | `git push --force-with-lease origin a489682:main` (and `:develop`, `:staging`) | rewrites the branch pointer; lineage A/C commits remain reachable only via tags/reflog unless tagged first |
| **2. Unrelated-histories merge via PR** | open a PR `consolidation/2026-11-19` → `main`; GitHub offers a merge; a merge commit joins both roots | not a force, but produces a tree with **two complete copies of the project** unless one side is `-s ours`-style resolved; expect mass conflicts |
| **3. Publish under a new canonical name** | keep `main`/`develop` untouched; make `release/pilot-2026-11` (or similar) the canonical branch and change repo docs to point at it | no history touched, no force, but the familiar branch names keep pointing at lineage A |
| **4. Archive-then-replace** | tag lineage A/C first (`v0.1.0-mvp-archive`, `v0.1.0-orphan-snapshot` ✔ already pushed), then Option 1 | safest force variant: nothing becomes unreachable |

**Recommendation: 4**, executed by Harrison. It is the only option that both preserves every lineage and
gives the team a canonical `main`.

## What was executed before the stop

Both operations are additive and reversible; neither alters an existing ref:

| Action | Result |
|---|---|
| Push `consolidation/2026-11-19` | ✅ `a489682` now on `origin` |
| Tag `v0.1.0-orphan-snapshot` → `3d8c738` | ✅ pushed (`ee6f6f8`, annotated) |
| Move `develop` / `main` / `staging` | ❌ **NOT DONE** — stopped at the precondition check |

## Open question for Harrison

Lineage A (`main`/`develop`, 50 + 21 commits) contains work the consolidated line does not: Railway
deployment fixes, `next.config.ts` url work, cognitive-profile fixes, an auth/onboarding-quiz branch merge,
and a frontend-integration merge. I have **not** verified whether any of that functionality is *absent* from
the consolidated tree at the feature level (the suites are green, but green tests do not prove feature parity
with an unmerged lineage). This must be reviewed before lineage A is retired.
