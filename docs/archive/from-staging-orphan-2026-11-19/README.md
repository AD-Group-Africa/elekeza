# Preserved from the `origin/staging` orphan branch

**Date:** 2026-11-19
**Source ref:** `origin/staging` @ `3d8c738` (orphan history, root `fd7cf09`, no shared ancestor)

`origin/staging` is a 2-commit snapshot import, not part of the project's history. When the
consolidated tree was built it could not be merged. A full diff, file manifest and Git bundle
are kept in `backups/consolidation-2026-11-19/`.

Of the 117 files present only in that snapshot, 106 were the **retired `frontend/src/app/*`
structure** superseded by the pilot line's `(app)/` route groups and `features/` modules.
The genuinely unique items are preserved here:

| File | Why it is kept |
|---|---|
| `AI_STRATEGY.md` | Strategy document, absent from every other branch |
| `AI_COST_MODEL.md` | Provider cost modelling; relevant to the paid-instance decision |
| `FINANCIAL_MODEL.md` | Unit economics |
| `DECIMAL_MIGRATION.md` | Migration planning notes |
| `reliability/BACKUP_AND_RESTORE.md` | Operational runbook |
| `reliability/FAILURE_MODES.md` | Failure catalogue |
| `reliability/RECOVERY_PROCEDURES.md` | Recovery procedures |
| `ai-pipeline/stage3b_readability.py.notimported` | Abandoned AI pipeline module. Unreferenced in this tree (commit `35ccdda` reverted an import of a module that did not exist), so it is archived **outside** the Python import path |

These are archived references, not active code. Review before promoting any of them.
