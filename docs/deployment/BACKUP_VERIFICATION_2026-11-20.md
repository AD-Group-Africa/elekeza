# BACKUP VERIFICATION REPORT — 2026-11-20

Verified before any remote mutation. Everything below was executed, not inferred.

## Backup branches (local)

| Ref | SHA | Meaning |
|---|---|---|
| `backup/main-mvp-21512cb` | `21512cb` | MVP state |
| `backup/staging-orphan-3d8c738` | `3d8c738` | orphan snapshot (now also tagged on origin) |
| `backup/develop-pre-consolidation` | `c08b60c` | develop before consolidation |

## Mirror clone

| Check | Result |
|---|---|
| `git --git-dir=elekeza-mirror.git fsck --full` | **exit 0** (dangling blobs only — normal) |
| Refs recorded | **49** |
| Size | 329 MB+ working tree; mirror HEAD `c4e9082` (pre-dates the security commit) |

## Bundles

| Bundle | `git bundle verify` |
|---|---|
| `elekeza-all-refs.bundle` | **"The bundle records a complete history."** |
| `staging-orphan.bundle` | **"The bundle records a complete history."** |

## Patches and archives

| Artifact | Check | Result |
|---|---|---|
| `tracked-changes.patch` | `git apply --check --reverse` | applies in reverse cleanly → content provably present in HEAD |
| `staging-orphan-vs-consolidated.patch` | `diff --git` count | **1,077** file diffs |
| `staging-orphan-files.txt` | line count | **1,077** — matches the patch exactly |
| `untracked-files.tgz` | `tar -tzf` | **93** entries |

## SHA-256 checksums

```
dd3558dcb37a7b53b44ff790c43d46ccdc8c6aa9195d96abbb4ed14fd4009422  elekeza-all-refs.bundle
8f173f21f387bcd2f1dfdb394261ebfdd436aef0f1f8d57413f6d1acde616889  staging-orphan.bundle
782a7904b5cbeb46838aa1c5933ddb5c36a4bc4671283cdaa64f074d193827d4  tracked-changes.patch
d7f8ccccbbd5e7e3aff00f07df6163904892b77b7ea151d5a574557f8b886560  untracked-files.tgz
20b4e00f41b9b4fda446ecf8bbfcee1996dbb55ac9a5edff764616d2994eb6d0  staging-orphan-vs-consolidated.patch
403cdad0009a1ecacf7aff9918b6d162d07ecc2187534b6a710bde7f83e41b1d  staging-orphan-files.txt
19361b76d31d4331a343428b03ae6c195ec9344976a7cb9f5d58530cc05a6470  untracked-root-files/Make-ClaudeAuditZip.ps1
89f41bedf4181facd45393bd9e686078f340428942affc312b65663f3588dada  untracked-root-files/Push-Sprint2.ps1
0ee91a87c0ed5ec6219f8374b904fbae184f1fc5fab21b7d2da865c7a1f8723d  untracked-root-files/ignal.
45d727f8e006b9f73c7c2c756913009d0e686d6ee20073171953e5e9f65c2f30  drill-backup.pgdump
e1918795ccb2bb332299b063b93fa851fba1f8431c04c09f9d0aeae673254a81  drill-backup-seeded.pgdump
```

## The three unexplained untracked files

| File | Size | Verdict |
|---|---|---|
| `Make-ClaudeAuditZip.ps1` | 3,848 B | Packaging helper: zips source for an external audit, excludes secrets/lockfiles. **No secret patterns found.** Harmless; keep or delete. |
| `Push-Sprint2.ps1` | 9,057 B | One-off helper that commits and pushes `audit/sprint-2-payment-security`. **No secret patterns found.** All five docs it targets already exist in HEAD — carries no unique work. |
| `ignal.` | 15,043 B | A captured **`less` help screen** (backspace control characters). Junk from a mistyped redirect. |

All three are preserved in `backups/consolidation-2026-11-19/untracked-root-files/` and remain untracked;
none was committed.

**Verdict: backups complete. Safe to proceed (and the stop came from the ancestry check, not the backup).**
