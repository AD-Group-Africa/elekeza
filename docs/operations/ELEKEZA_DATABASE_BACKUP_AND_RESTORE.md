# ELEKEZA — Database Backup and Restore

**Status of this document:** verified against PostgreSQL 15.17 and 16.16 on 15 November 2026. Every command and number below was executed; see §8 for evidence.

---

## 1. Why this exists

PostgreSQL's `pg_dump` and `pg_restore` refuse to talk to a **newer** major server version:

```
pg_dump: error: aborting because of server version mismatch
pg_dump: detail: server version: 16.16; pg_dump version: 15.17
```

Elekeza runs PostgreSQL **16** in `docker-compose.yml` (`postgres:16-alpine`) and PostgreSQL **15** on the development machine. The previous scripts hard-coded `/c/Program Files/PostgreSQL/15/bin`, so backups silently became impossible on the deployment target.

## 2. Tools available

| Script | Purpose |
|---|---|
| `scripts/db-backup.sh` | Create a custom-format dump, verify it, apply retention |
| `scripts/db-restore-drill.sh` | Restore into a disposable database and verify the result |
| `scripts/lib/pg-client.sh` | Client discovery shared by both (internal) |

Requirements: `bash`, `docker` (only for `--docker` mode), `pg_dump`/`pg_restore`/`psql` of a **matching or newer** major version than the server.

## 3. Backup procedure

### 3.1 Native client (client installed on the host)

```bash
PGPASSWORD='***' scripts/db-backup.sh --host localhost --port 5433 \
  --user postgres --db elekeza_pg16_bk
```

### 3.2 Container client (recommended when the database runs in Docker)

```bash
scripts/db-backup.sh --docker elekeza-pg16 --db elekeza_pg16_bk
```

`--docker` runs `psql`/`pg_dump`/`pg_restore` **inside the database container**, so the client always matches the server and no database password is needed or exposed.

### 3.3 What the script does

1. **Discovers the server version** (`current_setting('server_version_num')`) — it never guesses.
2. **Selects a compatible client**: an exact major match if available, otherwise the lowest sufficient major. A client older than the server is never used. `--pg-bin DIR` / `$ELEKEZA_PG_BIN` are honoured first but still version-checked.
3. **Fails safely** with exit **3** and install instructions when no compatible client exists — no dump is attempted.
4. **Writes to `<file>.partial`** and only renames on success, so an interrupted run leaves no file that looks like a backup.
5. **Checks the file is non-empty** and that `pg_restore --list` can read it, and that at least one table definition is present.
6. **Applies retention** (`--keep N`, default 7) to `<DB>-*.dump` in the output directory only. Custom `--out` names are never pruned.

### 3.4 Exit codes

| Code | Meaning |
|---|---|
| 0 | Backup created and verified |
| 2 | Bad usage |
| 3 | No PostgreSQL client compatible with the server major version |
| 4 | Cannot reach the server / authenticate (password never printed) |
| 5 | `pg_dump` failed or produced an empty file |
| 6 | The dump could not be read back — **not** a usable backup |

## 4. Restore procedure

```bash
# verify only, disposable target dropped afterwards
PGPASSWORD='***' scripts/db-restore-drill.sh backups/elekeza_pg16_bk-20261115-113000.dump \
  --target elekeza_restore_drill

# keep the restored database for application testing
scripts/db-restore-drill.sh backups/file.dump --docker elekeza-pg16 \
  --target elekeza_restore_pg16 --keep-target
```

The drill:

1. Verifies the archive is readable **before** touching anything.
2. Refuses any `--target` that does not start with `elekeza_restore` (typo protection).
3. Drops/creates the target, restores with `--no-owner --no-privileges`.
4. Treats `pg_restore` **errors in the log** as failure even when the exit code is 0.
5. Verifies tables, columns, indexes, foreign keys, Flyway history (successful count, max version, zero failures) and core-table row counts.
6. Drops the target unless `--keep-target` was given.

## 5. Configuration

| Knob | Default | Notes |
|---|---|---|
| `--host` / `--port` | `localhost` / `5433` | 5433 is the local development cluster; the compose stack uses 5432 |
| `--user` / `--db` | `postgres` / `elekeza_prod` | |
| `PGPASSWORD` | required in native mode | never logged, never echoed |
| `ELEKEZA_PG_BIN` | unset | extra client directory to consider first |
| `--pg-bin DIR` | unset | same, per invocation |
| `--docker CONTAINER` | unset | container-backed clients; ignores `PGPASSWORD` |
| `--keep N` | 7 | retention count |
| `--out FILE` | `backups/<db>-<timestamp>.dump` | |

## 6. Verification and recovery expectations

A backup counts as trustworthy only when a dump has been restored into a **separate** database and verified — the drill does exactly that.

**Recovery expectations are deliberately unquantified.** No RPO or RTO is stated here because none has been measured against an approved operational target. What is measured:

- A 208 KB dump of a 59-table schema restores in a few seconds on this machine.
- The application starts against the restored database and serves authenticated requests.

Any RPO/RTO commitment for the pilot must come from a measured run on the pilot host with production-sized data, agreed by the school-facing owner.

## 7. Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `aborting because of server version mismatch` | client major < server major | use `--docker <container>` or install matching client tools |
| `FATAL: no compatible pg_dump for a PostgreSQL 16 server` | as above | same |
| `FATAL: cannot connect ...` (exit 4) | server down, wrong host/port, bad password | check the server, `PGPASSWORD` |
| `FATAL: dump lists no tables` (exit 6) | dumped an empty or wrong database | check `--db`; this guard is what caught an empty `elekeza` database during testing |
| `FATAL: refusing to use target '…'` | target name not prefixed `elekeza_restore` | use a drill name, or `--allow-any-target` deliberately |
| `pg_restore: error:` in `<dump>.restore.log` | missing role/extension | inspect the log; the drill already fails the run |

## 8. Verification performed (15 Nov 2026)

| Test | Result |
|---|---|
| PG15 native backup (`elekeza_v20_upgrade`) | exit **0**, 208 KB, 118 table definitions |
| PG15 restore drill | exit **0** — 59 tables, 505 columns, 176 indexes, 93 FKs, 20 migrations, v20, 0 failed |
| PG15 restored schema vs source | identical (tables/columns/indexes/FKs/sequences/version) |
| PG15 restored data | users 8, institutions 3, guardian_links 6, deadlines 9 — identical to source |
| PG15 Flyway checksums source vs restored | identical |
| PG15 application against restored DB | Flyway "Schema is up to date", health **200**, login **200**, `/api/auth/me` **200**, `/api/deadlines` **200** |
| PG16 backup via `--docker` | exit **0**, 208 KB, 118 table definitions |
| PG16 restore drill via `--docker` | exit **0** — same schema counts, v20, 0 failed |
| PG16 restored data | identical to source; app boots, health **200**, login **200** |
| PG15 vs PG16 migration checksums | identical across both majors |
| Incompatible client (PG16 server, PG15-only host) | exit **3**, no artifact created |
| Unsafe restore target (`--target elekeza`) | exit **2**, refused |
| Invalid archive | exit **2**, refused before any database was touched |
| Empty database | exit **6** (guard) |
| Interrupted backup (partial at 2.1 MB, SIGTERM) | partial removed, no final file, non-zero exit |

Not exercised: exit **4** (unreachable server) — the local PG15 cluster accepts connections regardless of password (trust auth) and no native PG16 client exists on this host, so that branch could not be triggered honestly. Exit **5** (dump failure mid-stream) was not forced; the interruption test covers the same cleanup path.

## 9. Known limitations

1. **No scheduled backup yet.** The scripts are manual; scheduling belongs with hosted staging (Workstream 4, currently blocked).
2. **Backups are host-local.** `backups/` is on the same machine as the database; there is no off-site copy, so a host loss loses both. Acceptable for local verification, not for a pilot.
3. **No encryption at rest** for dump files. They contain personal data once real users exist; that must be addressed before the pilot.
4. **Retention deletes without archiving.** Older dumps are removed, not moved.
5. **`--docker` requires the database container to be running**; it cannot back up a stopped database.
