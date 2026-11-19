# Elekeza — Backup & Restore

## 1. PostgreSQL Database Backup

### 1.1 Full Database Backup

**Command:**
```bash
pg_dump -h localhost -U elekeza_admin -d elekeza_prod \
  -F c -b -v -f /tmp/elekeza_prod_backup.dump
```

**Options explained:**
- `-F c`: Custom format (compressed; supports parallel restore)
- `-b`: Backup blobs (large objects; not typically used for standard tables)
- `-v`: Verbose mode — shows progress and included objects
- `-h localhost`: Database host
- `-U elekeza_admin`: Database user
- `-d elekeza_prod`: Database name

**Backup retention:** Keep last 3 backups; store off-server (e.g., `/backups/elekeza/`)

### 1.2 Schema-Only Backup

If you only need the schema (no data):

```bash
pg_dump -h localhost -U elekeza_admin -d elekeza_prod --schema-only \
  -F c -v -f /tmp/elekeza_schema_backup.dump
```

### 1.3 Data-Only Backup

```bash
pg_dump -h localhost -U elekeza_admin -d elekeza_prod --data-only \
  -F c -v -f /tmp/elekeza_data_backup.dump
```

## 2. Database Restore

### 2.1 Restore to Fresh Database

```bash
# Create the database (if not exists)
psql -U postgres -c "CREATE DATABASE elekeza_prod;"

# Restore from backup
pg_restore -U elekeza_admin -d elekeza_prod /tmp/elekeza_prod_backup.dump
```

### 2.2 Restore to Existing Database (Reset)

**Warning:** This will lose all data not in the backup.

```bash
# Using Flyway baseline + migrate
cd /path/to/elekeza/backend
./gradlew flywayBaseline  # First time only
./gradlew flywayMigrate   # Migrate to latest version

# Or restore from custom format backup, overwriting:
pg_restore -U elekeza_admin -d elekeza_prod --clean /tmp/elekeza_prod_backup.dump
```

### 2.2 Verify Restore

```bash
psql -U elekeza_admin -d elekeza_prod -c "
  SELECT 'users' AS table_name, count(*) AS row_count FROM users
  UNION ALL
  SELECT 'institutions', count(*) FROM institutions
  UNION ALL
  SELECT 'students', count(*) FROM students
  UNION ALL
  SELECT 'lessons', count(*) FROM lessons
  UNION ALL
  SELECT 'quiz_attempts', count(*) FROM quiz_attempts;
"
```

## 3. Flyway Migration Management

### 3.1 Current Migration State

The following Flyway migrations are present in `backend/src/main/resources/db/migration/`:

| Version | Description | Size |
| --- | --- | --- |
| V1 | Baseline schema — users, institutions, students, lessons, quiz infrastructure | 12,250 bytes |
| V2 | Seed demo data (admin, teacher, guardian, sample students) | 5,384 bytes |
| V3 | Quiz answers table and relationship to questions | 1,006 bytes |
| V4 | Support interventions deadlines and enforcement | 3,657 bytes |

**Total migrations:** 4

### 2.2 Adding a New Migration

```bash
# Naming convention: V{N+1}_description.sql
# Example: V5_add_guardian_notifications.sql

# Place in: backend/src/main/resources/db/migration/
# Run: ./gradlew flywayMigrate
```

### 2.2 Rolling Back a Migration

```bash
# Flyway does not support direct rollback.
# Instead: create a new migration that reverses the changes.
# Example: V5_rollback_V4_additions.sql

# Then: ./gradlew flywayMigrate
```

## 3. Application Configuration Backup

### 3.1 Environment Variables

**Critical variables to back up:**
- `DB_URL`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `AI_CLIENT_TYPE`, `AI_API_KEY`, `AI_INTERNAL_SECRET`
- `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`
- `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_SENDER_ID`
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`
- `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`
- `SENTRY_DSN_BACKEND`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`

**Backup method:**
```bash
# Save all critical vars
env | grep -E "DB_URL|JWT_SECRET|AI_CLIENT_TYPE|MPESA|AFRICA_TALKING|MAIL_|R2_|SENTRY|LANGFUSE" > /tmp/elekeza_env_backup.txt
```

## 4. Application JAR Backup

### 4.1 Backup the Built JAR

```bash
# After ./gradlew bootRun or build
cp backend/build/libs/*.jar /tmp/elekeza-app-backup.jar
```

**Note:** The JAR contains the compiled code and `application.yml` config. For true disaster recovery, also back up the environment variables.

## 5. Docker Image Backup

### 5.1 Backup Built Docker Image

```bash
# If Docker is running
docker save -o /tmp/elekeza-images.tar elekeza-backend elekeza-ai elekeza-frontend

# Or export individual images
docker save elekeza-backend > /tmp/elekeza-backend.tar
docker save elekeza-ai > /tmp/elekeza-ai.tar
docker save elekeza-frontend > /tmp/elekeza-frontend.tar
```

### 5.2 Restore Docker Images

```bash
docker load -i /tmp/elekeza-images.tar
```

## 5. Verification Checklist After Restore

- [ ] Health check passes: `curl -sf http://localhost:8080/actuator/health`
- [ ] Authentication works: login with test credentials
- [ ] Institution data present: query institutions table
- [ ] Student data present: query students table
- [ ] AI mode correct: verify `AI_CLIENT_TYPE` env var
- [ ] Payment mode correct: verify `MPESA_CONSUMER_KEY` is set (or mock mode)
- [ ] Sentry/DSN configured: check `SENTRY_DSN_BACKEND` is not empty
- [ ] No critical errors in application logs

---
---
---
**IMPORTANT:** Always test backups in a non-production environment first. 
Restore time objective (RTO) and recovery point objective (RPO) should be defined 
based on business requirements before disasters occur.