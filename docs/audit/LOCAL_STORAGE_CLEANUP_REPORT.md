# LOCAL STORAGE CLEANUP REPORT — Elekeza Master Mission

**Date:** 5 November 2026 · **Host:** Windows 10 (19045), drive C:
**Operator:** Buffy (Codebuff), preservation-first · **New data location:** `C:\Users\thrillerpark\Documents\AD-Development\` (8 subfolders created, empty, nothing moved into them yet)

---

## 1. Before / after

| Measure | Before session | After session | Change |
|---|---|---|---|
| Drive C free space | 7.3 GB (97 % used) | **11 GB** (96 % used) | **+3.7 GB** |
| Docker build cache | 22.93 GB | **0 B** | −22.93 GB (logical; host credit partly absorbed by WSL2 sparse VHD) |
| Docker images total | 28.48 GB | 8.06 GB | −20.4 GB (most "image" space was shared build-cache layers) |
| Playwright browsers | chromium ×2 versions | chromium-1243 only | ~0.5 GB |
| pip cache | 247 MB | purged | −247 MB |
| Elekeza `frontend/.next` | 275 MB | removed (regenerable build) | −275 MB |
| Elekeza repo working tree, branches, stashes | intact | **verified intact** | 0 |

Host-space detail: free space moved 7.3 GB → 9.6 GB immediately after Docker/pip cleanup, then to 11 GB after removing stale Playwright bundles and `.next`. Docker's WSL2 virtual disk only releases host space on compaction (see §5).

## 2. Largest consumers found (measured)

| Path | Size | Owner | Verdict / action |
|---|---|---|---|
| Docker build cache | 22.9 GB | shared | **Cleaned** — `docker builder prune -af` |
| Docker images (post-prune) | 8.06 GB | mixed | Partially reclaimable (3.7 GB): includes Elekeza's own stale images and old base images of other projects — **requires Harrison's approval** (§4) |
| `AppData\Local\Android` | 3.1 GB | Android SDK | **Kept** — Capacitor/Android phase ahead (README lists it as roadmap) |
| `Desktop\Flagship Projects\Elekeza` | 4.9 GB incl. deps | Elekeza | Kept (source protected; `frontend/node_modules` 995 MB and `backend/.gradle-user` 793 MB kept so the imminent test baseline doesn't re-download everything) |
| `.cache\codex-runtimes` | **2.0 GB** | OpenAI Codex agent runtime cache | ⚠ **Listed for Harrison** — regenerable cache but belongs to another tool |
| `AppData\Local\Google\Chrome` | 1.6 GB | Browser | Kept (contains profile data, not a cache-only target) |
| `AppData\Local\ms-playwright` | 1.4 GB → 0.9 GB | Playwright | Old version bundle (chromium-1234 + headless shell) **removed**; active 1.63.0 bundle kept |
| `frontend/node_modules` | 995 MB | Elekeza | Kept until after test run |
| `backend/.gradle-user` | 793 MB | Elekeza Gradle cache | Kept until after test run (re-download would cost ~1 GB + long network) |
| `AppData\Local\Temp` | 372 MB | Windows | 372 MB largely live system activity; old idle entries minimal (8 items >7d). **Left** — not worth the risk |
| `ai-elewa/.venv` | 252 MB | Elekeza | Kept — working Python venv for the AI service |
| PCEA / ClinIQ / Safiri / Trustmark / Madai / PCEA / AgriGrid Docker volumes & stopped containers | ~1 GB volumes + stopped containers | **Other projects** | 🛡 **Protected** — these hold database data of dormant projects (`safirisky-db`, `cliniq_db`, `pcea-*`, `trustmark-db`, `nestiq-db`, `safiri-db`, `madai-postgres`, `agrigrid-*`). Zero actions taken. Decisions reserved for Harrison |

## 3. Actions executed (exact)

1. `docker builder prune -af` → reported 22.93 GB logical; build cache now 0 B.
2. `docker image prune -f` (dangling only) → 0 B dangling found.
3. `pip cache purge` → 9 directories removed.
4. `npm cache clean --force` (cache was already ~1 MB).
5. Removed `ms-playwright\chromium-1234` and `chromium_headless_shell-1234` (superseded by 1243; Playwright auto-re-downloads if an old pinned project ever needs it).
6. Removed `frontend\.next` (verified no Elekeza server was serving; regenerable via `npm run build`).
7. Created `C:\Users\thrillerpark\Documents\AD-Development\{00..07}` structure (empty).
8. `Temp`, Recycle Bin, user Documents/Downloads/Desktop, personal files, WhatsApp data, other projects, credentials, `.env` files, workbooks: **untouched**.

**Cleanup failures: none.** No commands errored; the earlier 5-minute timeout of a broad `du` scan was the only interruption (retry was done scoped/backgrounded).

## 4. Items requiring Harrison's decision (untouched, quantified)

| Item | Size | What happens if approved |
|---|---|---|
| `.cache\codex-runtimes` | 2.0 GB | Deleted; the Codex CLI re-downloads runtimes on next use |
| Elekeza stale images `elekeza/frontend:local` (2.32 GB), `elekeza/ai:local` (1.04 GB), `elekeza/backend:local` (566 MB), 3× `ai-elewa-ai-service` tags (~1.9 GB if unique) | ~5.8 GB | Removed; regenerable via `docker compose build` from current source |
| Non-Elekeza old images (postgis 853 MB, mailhog 572 MB, postgres:15-alpine 392 MB, etc.) | ~2 GB | Removed only if the owning projects (PCEA, safiri, ClinIQ) confirm no value |
| Stopped containers + named volumes of dormant projects | ~1 GB volumes | **Only you should decide** — volumes likely hold real backends/data of dormant projects (ClinIQ DB, PCEA dev data, trustmark, safiri, nestiq, madai). Recommend: export/dump → then delete |
| Recycle Bin | unknown | Not checked contents; emptying needs your go-ahead |
| Docker WSL2 host-space compaction | recovers host GBs softly | Requires stopping Docker Desktop briefly (which stops the running demo-v1 stack) + `wsl --shutdown` + disk-partition compaction — schedule with you |

## 5. Verification after cleanup

- `git status`: 14 entries exactly as before cleanup (uncommitted deadline-security fix + new staged tests preserved byte-for-byte; plus our new audit docs).
- Branch: `sprint-3-safe-config` @ `c56df6b`; `git stash list`: 4 stashes intact; `git log -1` unchanged.
- `git fsck`: no missing/corrupt objects (only ordinary dangling blobs from history — retained, not garbage-collected).
- Docker: demo-v1 stack (other project) still up and healthy before/after.
- PCEA-connect dev server still serving port 3000 (it was identified as another project's; never touched).

## 6. Storage still tight — recommendation

Even at 11 GB free, a Disk-Days buffer is thin for CI-grade builds (Gradle + Playwright + Docker images). Recommendation when convenient: (a) approve the §4 image removals (+~7.8 GB), (b) move one dormant project's data to an external drive, or (c) add a secondary drive. Do **not** pursue further deletion of personal or other-project data to chase a number.

## 7. Maintenance practices going forward

- Run `docker builder prune -f` weekly; keep Elekeza `GRADLE_USER_HOME` project-local (already the convention) and prune it consciously per release.
- Never `git clean -fd` in this repo (untracked evidence dirs like `backups/`, `backend/flyway-validation/` are not ignored everywhere).
- Before any `docker system prune -a`, always diff named volumes against project names first.
