# REPOSITORY DISCOVERY REPORT

**Date:** 2026-11-19
**Scope:** local disk (workspace + sibling Elekeza folders) and the `AD-Group-Africa` GitHub organisation
**Constraint:** read-only. No branch, remote, or file was modified during discovery.

---

## 1. Executive summary

**There is exactly one Elekeza repository. There is no duplicate repository, no fork, and no competing source of truth at the repository level.**

The problem the team has been feeling is real, but it is **branch divergence**, not repository duplication:

- GitHub: `https://github.com/AD-Group-Africa/elekeza` — **only** Elekeza repository in the organisation, **`forks_count: 0`**, and a global GitHub repository search for `elekeza` returns **exactly 1** result.
- The "second upload" is **Victor's (CarribeanVickie) branch `Iyann`**, merged via **PR #7** into `feat/elekeza-pilot-completion` on **2026-11-15**. It is inside the canonical repo.
- That merge is the **newest work in the project** — and it is *ahead* of the branch the working copy currently sits on.

**Recommendation: `AD-Group-Africa/elekeza` is the canonical repository.** No repository migration, no new repo, no archiving is required.

---

## 2. Local inspection — evidence

### 2.1 The workspace is one repository, not a container of repos

| Check | Result |
|---|---|
| `git rev-parse --show-toplevel` | `C:/Users/thrillerpark/Desktop/Flagship Projects/Elekeza` |
| Nested `.git` in `backend/`, `frontend/`, `ai-elewa/`, `android/`, `shared/` | **none** |
| Git submodules (`.gitmodules`) | **none** |
| Remotes configured | `origin` → `https://github.com/AD-Group-Africa/elekeza.git` (fetch + push) |
| Worktrees | `Elekeza` → `sprint-3-safe-config`; `Elekeza-iyann-review` → `8cbf673` (detached, = `origin/Iyann`) |
| Local branches | **16** |
| Uncommitted changes | **24 modified**, **18 untracked** paths |
| Stashes | **4** (`stash@{0}` reconciliation WIP; `stash@{1}` filter-branch rewrite; `stash@{2}`/`{3}` staging WIP) |
| Tracked `.env` files | **none** — only `.env.example` and `ai-elewa/.env.example` |
| Tracked `.log` files | **none** |
| Repository size (GitHub) | **290,826 KB** (~284 MB) |

### 2.2 Sibling folders on disk — checked, not modified

| Folder | What it actually is | Verdict |
|---|---|---|
| `Elekeza-iyann-review` | **Git worktree** of the same repo, detached at `8cbf673` (`origin/Iyann`, PR #7 head) | Working copy, not a repo |
| `Elekeza-preservation-20261013-224556` | **No `.git`.** Contains `staged-diff.patch` (168 MB), `unstaged-diff.patch` (103 MB), `git-status.txt`, `head.txt`, `tag-refs.txt` | Patch archive — a safety net, not a source of truth |
| `AD_Group_Showcase` | `index.html` + `FINAL_REPORT.md` — marketing showcase, not code | Not a candidate |

No further Elekeza copies were found among the other project folders in `Flagship Projects/`.

### 2.3 Current working state

- HEAD: `47d17f5` *"fix(elekeza): make guardian messaging accessible and verify delivery"* (2026-11-08)
- **+1 commit ahead** of `origin/sprint-3-safe-config` (`c56df6b`) — **unpushed**
- Uncommitted work is **substantial and not on any remote**: privacy consent/erasure module, `DeadlineVisibility`/`CountyKey`, `DemoSeedGuard`, and migrations **`V20__deadline_county_scope.sql`** / **`V21__privacy_consent_erasure_retention.sql`**, plus 8 new test classes.

> **Risk: this is the single most fragile asset in the project.** It exists only on one disk.

---

## 3. GitHub inspection — evidence

`gh` CLI is **not installed** on this machine (`gh: command not found`; not present in `Program Files` or on `PATH`). GitHub facts below were obtained through the **public GitHub REST API** and `git ls-remote`, which are equivalent for this purpose. Authenticated CLI operations (branch protection, default-branch change, PR approval) remain **unavailable** until `gh` is installed and authenticated.

### 3.1 Repository metadata

| Field | Value |
|---|---|
| Full name | `AD-Group-Africa/elekeza` |
| Description | "AI-powered adaptive accessible learning platform" |
| Default branch | **`staging`** ← notable |
| Created | 2026-03-25 |
| Last push | 2026-11-15T15:35:59Z |
| Forks | **0** |
| Open issues | **0** |
| Releases | **0** (tags exist, no GitHub Releases) |
| Topics | none |
| Size | 290,826 KB |

Organisation repositories (`AD-Group-Africa`): `elekeza`, `ClinIQ-Project`, `pcea-connect-project`, `ts`, `MnM-JuiceBar-Tigoni`. **Only one Elekeza repository.**

### 3.2 Contributors and authorship — who actually wrote the code

Commit authorship across **all refs** (local `git log --all`), which is more complete than the API's default-branch-only contributor list:

| Author identity | Commits | Interpretation |
|---|---|---|
| Harrison Muturi `<harryevansmuturi83@gmail.com>` | 203 | Owner — same person as ↓ |
| Harrison Muturi `<162571242+kaptanharry44@...>` | 124 | GitHub identity `kaptanharry44` |
| CarribeanVickie `<130764455+CarribeanVickie@...>` | 64 | **"Victor"** — frontend revamp; author of PRs #3, #7, #8, #9 |
| Alvin Muchiri / Nivlalvin `<saintnivla@gmail.com>` | 27 + 8 = 35 | Same person, two identities |
| Ian-qhamau `<kamauian118@gmail.com>` | 6 | "Iyann" — PR #7 branch author |
| google-labs-jules[bot] | 4 | Automated agent PR #6 |

The GitHub contributors API reports only `Nivlalvin` (2 contributions) because it counts **default-branch** commits only, and the default branch (`staging`) does not contain most of the project's history. **Do not use that API figure to judge authorship.**

### 3.3 Branch inventory (16 remote / 16 local)

| Branch | Tip | Last commit | Ahead / behind `origin/staging` | Classification |
|---|---|---|---|---|
| `feat/elekeza-pilot-completion` | `378579d` | 2026-11-15 | **+230 / −2** | **Contains newest frontend (PR #7/#8/#9)** |
| `sprint-3-safe-config` | `c56df6b` (remote) / `47d17f5` (local) | 2026-11-08 | **+205 / −2** | **Contains newest backend; local +1 unpushed** |
| `feature/ui-visibility-gamification` | `34cc00f` | 2026-11-12 | +? | Merged via PR #8 → safe |
| `integration/pr7-on-pilot-completion` | `9f383dd` | 2026-11-15 | | Merged via PR #9 → safe |
| `Iyann` | `8cbf673` | 2026-11-15 | | Merged via PR #7 → safe (keep as attribution) |
| `staging` | `3d8c738` | 2026-11-15 | 0 / 0 | **Divergent: 2 commits exist nowhere else; missing ~50 from `main`** |
| `main` | `a86e128` | — | +50 / −2 | Remote `main` ≠ local `main` |
| `develop` | `f65f436` | — | +21 / −2 | Stale integration branch |
| `release/v0.1.0` | `09e7f41` | 2026-10-09 | +191 / −2 | Historic baseline; tag source |
| `audit/sprint-2-payment-security` | `cca0706` | 2026-10-21 | | Merged (payment security) |
| `frontend/complete-system` | `1f33a94` | | | Superseded by pilot-completion |
| `frontend/revamp` | `24f47a4` | | | Superseded by pilot-completion |
| `feature/auth-onboarding-quiz` | `a93ad22` | | | Merged (PR #1/#2) |
| `feature/frontend-integration` | `b05abb8` | | | Merged (PR #3) |
| `jules-9509086085202126839-c3303c01` | `c628d20` | | | Merged (PR #6) |
| `Ai` | `ee197c7` | | +11 / −2 | AI-only historical line |
| **Local-only:** `feature/auth-onboarding-quiz`(local `3c822c0`), `feature/frontend-integration`(local `d2e7f77`), `backup/pre-staging-reconciliation-20260926`, `integration/staging-reconciliation`, `reconciliation-recovery-b139b8e`, 3 × `freebuff/*` | | | | Local snapshots — **never push** |

**Local `main`, `develop` and `staging` are all stale** relative to their remotes:
`main` local `21512cb` (2026-06-17, "Elekeza MVP initial commit") vs remote `a86e128`; `staging` local `ccf6362` (2026-07-29) vs remote `3d8c738`; `develop` local `c08b60c` (2026-04-08) vs remote `f65f436`.

### 3.4 The two commits that exist nowhere else

```
3d8c738  kotlin improvemets. Tests yet to be done.
fd7cf09  feat: v0.1.0 release + Phase 1 AI improvements (Improvements 5-7, Tutor endpoint, deliverables)
```

Reachable **only** from `origin/staging`. Their diff against the merge-base touches 676 files / +30,838 / −4,728 — including `release-evidence/`, `scripts/db-backup.sh`, `scripts/db-restore-drill.sh`, and `scripts/staging-gate.sh`. **These must be reconciled before `staging` is repurposed, or that work is lost.**

### 3.5 Pull requests, issues, releases

- **9 PRs, all closed:** #1–#2 (auth/onboarding, `kaptanharry44`), #3 (frontend UI, `CarribeanVickie`), #4–#5 (develop→main), #6 (JWT/AI-key fix, `kaptanharry44` — jules bot branch), #7 (`Iyann`, `IAN-QHAMAU`), #8 (ui-visibility-gamification, `CarribeanVickie`), #9 (PR#7 integration, `CarribeanVickie`).
- **0 open issues.** (The 9 "issues" in the API are the PR-linked mirrors.)
- **0 GitHub Releases**; tags exist: `v0.1.0-pilot`, `v0.1.0-pilot-final`, `v0.1.0-pilot-r2`, `v0.1.0-exhibition-rc2/3/4`.
- **1 workflow** (`.github/workflows/ci.yml`) with 4 jobs: `backend`, `frontend`, `e2e`, `ai-elewa`. It triggers on `push` to `main`/`release/**` and on every `pull_request`. Because work is happening on `sprint-3-safe-config` and `feat/*`, **the CI that exists rarely runs on the branches that matter**, and `main` is not the real branch.
- `.gitlab-ci.yml` also exists (legacy/dormant — the remote is GitHub).

---

## 4. Repository comparison

Only one repository exists, so the comparison required by the mandate is honestly reported as a **branch** comparison. Each field is backed by a command run in this session.

| Field | `AD-Group-Africa/elekeza` |
|---|---|
| Repository | https://github.com/AD-Group-Africa/elekeza |
| Owner | `AD-Group-Africa` (organisation) |
| Contributors | Harrison Muturi (`kaptanharry44`, 327 commits), `CarribeanVickie` (64), Alvin Muchiri (35), `Ian-qhamau` (6), jules bot (4) |
| Last update | 2026-11-15T15:35:59Z |
| Backend | **Complete** — 40 controllers, 21 migrations, 397/397 tests, `bootJar` OK (best on `sprint-3-safe-config`) |
| AI service | **Complete** — 4 endpoints, 4 providers, 603/603 tests (`ai-elewa`, equivalent on all live branches) |
| Frontend | **Complete** — 61 routes, build OK, 34/34 tests (best on `feat/elekeza-pilot-completion`) |
| Tests | Backend 397 pass; AI 603 pass; frontend 34 pass; **frontend lint 17 errors** |
| Unique features | Privacy/consent + erasure (`sprint-3-safe-config`); county-scoped deadlines; guardian messaging fix; frontend design-token revamp + gamification (`pilot-completion`); Phase-1 AI tutor endpoint (`staging` only) |
| Status | **CANONICAL — authoritative for all three services** |
| Duplicates | **None.** Zero forks, zero sibling repositories |

---

## 5. Recommended canonical strategy

1. **Canonical repository:** `AD-Group-Africa/elekeza` — unchanged. No migration.
2. **Canonical head:** merge `feat/elekeza-pilot-completion` into the current line (simulated: **1 conflict**), after committing the 42 uncommitted paths.
3. **Reconcile** the two `origin/staging`-only commits before repurposing `staging`.
4. **Branch policy:** `main` = production **and the GitHub default**; `develop` = integration; `staging` = release candidate.
5. **No archiving** of anything until the consolidated `main` has been independently verified (see `docs/REPOSITORY_CONSOLIDATION_REPORT.md`).

## 6. Missing functionality / gaps identified during discovery

| Gap | Impact |
|---|---|
| `gh` CLI not installed | Branch protection, default-branch change and PR workflows must be done in the web UI or after installing `gh` |
| No `render.yaml` (as found) | Deployment not reproducible — added today |
| Backend has **no Sentry SDK** | Production errors are invisible |
| GitHub default branch = `staging` | Newcomers and CI clone the wrong line |
| 42 uncommitted paths | Compliance functionality is unbacked |
| No GitHub Releases for existing tags | Release history is improvised |

---

*Raw command output for every claim: `artifacts/audit-2026-11-19/`.*
