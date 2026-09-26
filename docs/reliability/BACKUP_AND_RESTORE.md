# Elekeza — Backup & Restore

**Status:** scripts implemented; first restore drill executed 2026-09-19 against
a real PostgreSQL 15 dump (see §6 for the recorded evidence). Retention, drill
schedule and off-server storage are pilot-phase operational commitments.

## 1. What exists

| Piece | Location | Notes |
| --- | --- | --- |
| Backup wrapper | `scripts/db-backup.sh` | custom-format `pg_dump -Fc`, verifies with `pg_restore --list`, prunes beyond `--keep` (default 7) |
| Restore drill | `scripts/db-restore-drill.sh` | restores into a **disposable** DB, verifies core tables + Flyway history, drops the drill DB |
| Production runbook | `docs/DEPLOYMENT_RUNBOOK.md` | nightly backup before migration days |

## 2. Backup procedure

```bash
PGPASSWORD='<db password>' scripts/db-backup.sh \
  --host localhost --port 5433 --user postgres --db elekeza_prod \
  --out /backups/elekeza/elekeza_prod.dump --keep 14
```

- Output is compressed custom format (`-Fc`) — restore with `pg_restore`.
- The wrapper refuses to declare success unless `pg_restore --list` can read
  the dump; a `.list` manifest is written next to every dump.
- Retention: the wrapper keeps the newest `--keep` dumps of that database and
  deletes older ones (plus their manifests/logs). Off-server copying is an
  operational step, not automated here — pilot hosting must provide it.

## 3. Restore procedure

```bash
# Planned restore into an existing database:
PGPASSWORD='<db password>' pg_restore -h <host> -p <port> -U <user> \
  -d elekeza_prod --clean --if-exists --no-owner --no-privileges backup.dump
```

Always rehearse with the drill first — it is the same code path without risk:

```bash
PGPASSWORD='<db password>' scripts/db-restore-drill.sh backup.dump --target elekeza_restore_drill
```

The drill restores into a throwaway database, runs verification queries
(`institutions`, `users`, `learners`, `lessons`, `flyway_schema_history`),
requires ≥1 successful Flyway migration, and drops the throwaway database.

## 4. Verification after a real restore

- [ ] `scripts/db-restore-drill.sh` (or equivalent queries) green
- [ ] Backend health: `curl -sf http://localhost:8080/actuator/health`
- [ ] Login round-trip works (seed or restored account)
- [ ] Flyway history matches the deployed migration set (V1–V15 currently)

## 5. Limitations (honest)

- Backups are **not** encrypted at rest by these scripts; enable volume/disk
  encryption or an encrypted object store at the hosting layer.
- No point-in-time recovery (WAL archiving) is configured; RPO = interval
  between runs of `db-backup.sh`. Nightly before migrations is the pilot
  commitment.
- Off-server/offsite copy is manual; schedule it in the hosting provider.
- Restore of the *live* database takes the app offline for the duration.

## 6. Executed drill record

- **2026-09-19** — `scripts/db-restore-drill.sh` run against a fresh
  `pg_dump -Fc` of the V1–V15 schema + seed data on PostgreSQL 15
  (localhost:5433). Result: restore completed, verification queries returned
  rows for all core tables, `flyway_schema_history` showed all migrations
  successful, drill database dropped. Transcript excerpt is retained in the
  repository history (commit message of the backup/restore workstream).
