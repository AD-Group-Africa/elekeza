# PULL-REQUEST MIGRATION PLAN (remote, not executed)

**Date:** 2026-11-19
**Constraint:** no force-push, no history rewrite, no remote branch deletion, no default-branch change — all of these require Harrison's explicit approval at execution time.

---

## 1. Current state (verified)

| Ref | Local | Remote | Note |
|---|---|---|---|
| `main` | `c4e9082`+ | `a86e128` | remote is the June MVP commit |
| `develop` | `c4e9082`+ | `f65f436` | remote is stale integration |
| `staging` | `c4e9082`+ | `3d8c738` | **orphan history** — 2 commits, no shared ancestor |
| `consolidation/2026-11-19` | `c4e9082`+ | — | local only, not pushed |
| `feat/elekeza-pilot-completion` | — | `378579d` | merged into the consolidated line |
| `sprint-3-safe-config` | — | `c56df6b` | ancestor of the consolidated line |
| `Iyann` | — | `8cbf673` | merged via PR #7; keep for attribution |

Backups (verified this session): mirror repo with **49 refs and clean `fsck`**, all-refs bundle reporting a **complete history**, orphan bundle (`3d8c738`, complete), tracked-changes patch (34 files), untracked archive (93 entries).

Because `main` and `develop` are strict ancestors of the consolidated head, promoting them is a **fast-forward** — no history is rewritten. `staging` is the only ref that cannot fast-forward, because it is unrelated to everything.

---

## 2. Recommended sequence (PR-based, reviewable)

### Step 1 — Publish the consolidation branch (no protected branch touched)

```bash
git push -u origin consolidation/2026-11-19
```

Open a **draft PR**: `consolidation/2026-11-19` → `develop`. Reviewers see all 9 commits, 6 conflict resolutions and the lint fix. CI runs on the PR (`ci.yml` triggers on `pull_request`).

### Step 2 — Promote `develop` (fast-forward, via PR)

```bash
# after the PR is approved and CI is green
git push origin consolidation/2026-11-19:develop
```

`develop` moves `f65f436` → consolidated head as a fast-forward. No merge commit, no rewrite.

### Step 3 — Promote `main` (fast-forward, via PR)

Open PR `develop` → `main` and merge it (or push `develop` to `main`). `main` moves `a86e128` → consolidated head as a fast-forward.

### Step 4 — Handle `staging` deliberately (the only non-trivial one)

`origin/staging` cannot be merged or fast-forwarded. Choose **one** of:

| Option | Command | Consequence |
|---|---|---|
| **A. Retire as a release line** (recommended) | `git push origin consolidation/2026-11-19:staging --force-with-lease` | `staging` becomes a release candidate pointer. **This is a force update — needs explicit approval.** Its old tip survives locally (`backup/staging-orphan-3d8c738`) and inside three backup artifacts. |
| **B. Keep the orphan, add a new branch** | `git push origin consolidation/2026-11-19:release-candidate` | Nothing is overwritten; `staging` stays a stale snapshot. Slower to understand, zero risk. |
| **C. Archive then replace** | create a GitHub Release/tag `v0.1.0-orphan-snapshot` on `3d8c738`, then Option A | Best of both: the snapshot is discoverable in the UI before the pointer moves. |

**Recommendation: C.** It preserves the orphan in a discoverable place, then makes `staging` meaningful again.

### Step 5 — Change the default branch (approval required)

Only after Steps 1–4 are verified on GitHub: **Settings → Branches → Default branch → `main`**. Then protect `main` (require PR + 1 review + CI) and `develop` (require CI).

### Step 6 — Clean up the other branches (never delete without review)

| Branch | Safe to delete? |
|---|---|
| `Iyann`, `feature/ui-visibility-gamification`, `integration/pr7-on-pilot-completion`, `feature/auth-onboarding-quiz`, `feature/frontend-integration`, `jules-…` | Merged into the consolidated line — yes, **after** the backups are confirmed readable |
| `audit/sprint-2-payment-security`, `Ai`, `release/v0.1.0` | Keep (provenance / tag anchors) |
| `frontend/complete-system`, `frontend/revamp` | Superseded — back up first |
| `sprint-3-safe-config` | Ancestor of the consolidated line — keep until after launch |

---

## 3. Why not simply force-push everything?

Because force-pushing `main`/`develop` rewrites nothing useful here (they fast-forward), and force-pushing `staging` destroys the only remote copy of the orphan snapshot. The sequence above keeps every original object reachable **before** any pointer moves.

## 4. Pre-push checklist

- [ ] `git log --oneline main..consolidation/2026-11-19` is empty (proves fast-forward)
- [ ] `git diff --stat main consolidation/2026-11-19` reviewed
- [ ] CI green on the draft PR
- [ ] Backups readable: mirror `fsck` clean, both bundles `verify` OK
- [ ] Owner approval recorded for Step 4 (force) and Step 5 (default branch)
