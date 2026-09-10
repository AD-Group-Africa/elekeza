# Elekeza — Backup & Recovery

## Database (PostgreSQL)

### Nightly logical backup

```bash
docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "backups/elekeza-$(date +%F).sql.gz"
```

Schedule via cron/systemd timer on the host; keep **30 days** of dailies plus 12 monthlies off-host (object storage or another machine).

### Restore drill (run quarterly — an untested backup is not a backup)

```bash
# 1. Provision an empty database
docker compose exec db createdb -U "$DB_USER" elekeza_restore_test

# 2. Restore
gunzip -c backups/elekeza-2026-09-01.sql.gz \
  | docker compose exec -T db psql -U "$DB_USER" -d elekeza_restore_test

# 3. Boot the backend against the restored copy (SPRING_PROFILES_ACTIVE=prod,
#    datasource pointed at elekeza_restore_test) and verify:
#    /actuator/health = UP, login works, a learner's preferences + progress present.
```

Verified during this sprint: fresh-database migration path (Flyway V1–V7) plus backup/restore mechanics on PostgreSQL 16.

## Uploaded files

- With `STORAGE_PROVIDER=mock`: uploads live in the backend container's `uploads/` directory — **include it in host-level backups** and remember container storage is ephemeral across redeploys.
- With `STORAGE_PROVIDER=cloudflare_r2`: objects live in R2 with provider-managed durability; keep bucket versioning enabled.

## Recovery objectives (pilot sizing)

- RPO: 24 h (nightly dump) — tighten to WAL archiving if schools require less loss.
- RTO: < 1 h — redeploy images, restore dump, boot; Flyway is a no-op on an existing schema.

## Data protection rules for backups

- Backups contain learner PII → encrypt at rest, restrict access to operators, never leave dumps in web-reachable paths.
- Backups of the personalization tables (`learner_preferences`, `adaptation_events`) inherit the same privacy rules as live data.
