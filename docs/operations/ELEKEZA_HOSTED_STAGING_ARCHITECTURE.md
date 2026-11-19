# ELEKEZA — Hosted Staging: Architecture, Provisioning and Rollback

**Status: BLOCKED — nothing was provisioned.** No provider account, payment method, DNS control or approval existed for this work, so this document is the prepared position, not a record of an environment. Every acceptance item in §7 is therefore unrun.

**Date:** 15 November 2026

---

## 1. What the application actually needs

Read from `docker-compose.yml` and the service Dockerfiles, not assumed:

| Service | Image / build | Declared limits | Exposure |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 2 CPU / 4 GB | `127.0.0.1:5432` only |
| `redis` | `redis:7-alpine` | 0.5 CPU / 512 MB, 256 MB LRU | internal |
| `backend` | Spring Boot 3.2.4, JVM | 2 CPU / 2 GB | internal:8080 |
| `ai-service` | FastAPI (python) | 2 CPU / 1.5 GB | internal:8000 |
| `frontend` | Next.js 14 production | 1 CPU / 1 GB | internal:3000 |
| `nginx` | `nginx:1.27-alpine` | 0.5 CPU / 256 MB | **80/443 public** |

Aggregate declared ceilings: **~8 vCPU / 9.25 GB**. For a pilot (tens to low hundreds of concurrent users) a **4 vCPU / 8 GB** host runs the stack with headroom; 2 vCPU / 4 GB is the floor and would swap under load. Persistent volumes: `postgres_data`, `redis_data`, `certbot_data`.

Runtime dependencies outside the host: Cloudflare R2 (object storage), Africa's Talking (SMS), SMTP (email), Daraja/M-Pesa, an LLM provider for `ai-service`, Sentry, Langfuse. All are optional at boot — the code ships mock providers — but a demonstration environment should have SMS/email/storage at least in sandbox.

## 2. Options considered

| Option | Fit | Cost (rough) | Ops burden | Notes |
|---|---|---|---|---|
| **A. Single VPS + existing docker compose** (recommended) | Excellent — the repo already ships the full stack | ~US$40–80/month for 4 vCPU/8 GB + block storage + snapshots | Low: one host, `docker compose up`, certbot on host | Everything the team already knows works; rollback is `git checkout` + compose up |
| B. Managed container platform + managed PostgreSQL | Good isolation, managed backups | ~US$80–200/month | Medium: registry, secrets, two providers | Managed Postgres removes the restore rehearsal from your hands but also from your control |
| C. Per-service PaaS (separate backend/frontend/DB tiers) | Poor fit — six services, internal-only networking | US$120+/month | High: six dashboards | Over-engineered for a pilot |

**Costs above are engineering estimates for planning only, not quotes.** No provider has been contacted; confirm actual pricing at provisioning. The free internal service lookup returned no VPS/container-hosting candidates, so these options come from the deployment requirements in §1 rather than from a catalogue.

### Recommendation

**Option A**: one Ubuntu LTS VPS in the closest reliable region to the pilot school, running the existing `docker-compose.yml` unchanged, with TLS from certbot and backups to object storage. It matches the artefacts that have actually been tested (the staging gate, the backup/restore drill), keeps one host to reason about, and can be abandoned cheaply.

**Region choice is a legal question, not only a latency question.** Kenyan schools hold children's data; where that data may be processed and stored needs confirmation from a Kenyan data-protection adviser before the first real learner is onboarded. Latency-wise, a Nairobi or Johannesburg region is preferable to Europe; do not finalise the region until §10 of the pre-pilot audit is closed.

## 3. Configuration model

Four environments, each with its own configuration file and secret store:

| Environment | Profile | Database | Seed | Notes |
|---|---|---|---|---|
| Local development | `dev` | local H2/PostgreSQL | demo seed permitted | `application-dev.yaml` |
| Automated test | `test` | H2 | demo fixtures | `application-test.yml` |
| **Hosted staging** | `docker` (or `prod` if run natively) | PostgreSQL 16, isolated | `DEMO_SEED_ENABLED=FALSE` | production-like; no real learner data |
| Production (future) | `prod` | PostgreSQL 16 | `DEMO_SEED_ENABLED=FALSE` | not provisioned |

Hard rules for staging:

- **`DEMO_SEED_ENABLED=FALSE`.** `DemoSeedGuard` refuses to start with demo seeding on a non-dev/test profile; keep it that way. Demo accounts are a public-administrator hazard.
- **`SECURE_COOKIES=true`** (the production default). The local gate sets it false only because it serves plaintext HTTP on loopback; a TLS staging host must not copy that.
- **No database port published.** `postgres` binds `127.0.0.1:5432` in compose; keep it internal and reach it through `docker exec` for backups.
- **Secrets from the host environment**, never committed. `docs/operations/ELEKEZA_STAGING_ENV_TEMPLATE.env` lists every variable with placeholders only.
- **Synthetic data only.** Namespaced fixtures (`v20.*@staging.local`) and gate-generated accounts.

## 4. Provisioning runbook (to run only after approval)

```bash
# 0. Preconditions: approved provider, payment method, DNS control, SSH key
# 1. Host
ssh root@<host>            # Ubuntu 24.04 LTS, 4 vCPU / 8 GB, 80 GB SSD
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin certbot git ufw
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

# 2. Deploy user and code
adduser --system --group elekeza && usermod -aG docker elekeza
su - elekeza; git clone <repo> elekeza && cd elekeza
git checkout <approved-commit>          # never deploy an uncommitted working tree

# 3. Secrets
cp docs/operations/ELEKEZA_STAGING_ENV_TEMPLATE.env .env
chmod 600 .env && chown elekeza:elekeza .env
# edit .env: real DB/Redis/JWT/AI secrets, NEXT_PUBLIC_API_URL, CORS origin, SMTP/SMS sandbox

# 4. TLS (see docker-compose.tls.yml header)
certbot certonly --webroot -w /srv/elekeza/certbot -d <domain> --agree-tos -m <email>
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build

# 5. Verify
curl -fsS https://<domain>/api/actuator/health      # expect 200
curl -fsS -o /dev/null -w '%{http_code}\n' https://<domain>/   # expect 200
docker compose ps                                   # all healthy
docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME \
  -c "select max(version::int), count(*) filter (where success=false) from flyway_schema_history;"

# 6. Scheduled backup + off-host copy (host cron)
#  15 3 * * * cd /home/elekeza/elekeza && ./scripts/db-backup.sh \
#     --docker elekeza-postgres-1 --db $DB_NAME --keep 14 >> /var/log/elekeza-backup.log 2>&1
#  then sync backups/ to object storage, and run the restore drill weekly
```

## 5. Rollback

1. **Application**: `git checkout <previous-tag> && docker compose up -d --build` (images are built from source; the previous commit is the previous release).
2. **Database**: Flyway migrations are forward-only — **a schema rollback requires restoring the pre-deploy dump**, not a down-migration. Take a backup immediately before every deploy:
   `scripts/db-backup.sh --docker <pg-container> --db <db> --out backups/predeploy-<stamp>.dump`
   then `scripts/db-restore-drill.sh backups/predeploy-<stamp>.dump --docker <pg-container> --target elekeza_restore_verify` to prove the dump is usable *before* relying on it.
3. **Host loss**: rebuild from the runbook, restore the latest verified dump, restart the stack.
4. **DNS**: keep the previous A record until the new host answers `/api/actuator/health` with 200.

## 6. Logging, monitoring and error visibility

- Container logs: `docker compose logs -f --tail=200` (json-file, 50 MB × 3 per service, already configured).
- Sentry DSNs are wired for backend, frontend and AI service (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`) and are the intended error channel.
- Health endpoints: `/actuator/health` (backend), `/health` (ai-service), `/` (frontend) — all three are already used as compose healthchecks.
- Nothing centralises logs yet; for a pilot, forwarding to the provider's log service or a single `journald`-plus-object-storage job is sufficient.

## 7. Acceptance checklist (all UNRUN — environment does not exist)

| # | Requirement | Status |
|---|---|---|
| 1 | Public frontend over HTTPS | NOT RUN |
| 2 | Backend health | NOT RUN |
| 3 | AI service health | NOT RUN |
| 4 | Database connectivity from the app | NOT RUN |
| 5 | Redis connectivity | NOT RUN |
| 6 | Authentication (register/login/session) | NOT RUN |
| 7 | Role-based authorization | NOT RUN |
| 8 | Cross-role isolation on the host | NOT RUN |
| 9 | Core workflows (learner/teacher/guardian) | NOT RUN |
| 10 | File upload/download via R2 | NOT RUN |
| 11 | Logging and error visibility | NOT RUN |
| 12 | Backup operation on the host | NOT RUN |
| 13 | Restore feasibility on the host | NOT RUN |
| 14 | Deployment repeatability | NOT RUN |
| 15 | Rollback procedure | NOT RUN |

**No hosted URL exists and none should be quoted.**

## 8. Authorisation required before provisioning

| Item | Needed from |
|---|---|
| Provider account + payment method | Founder/owner |
| DNS record control for the staging domain | Domain owner |
| Region decision (data residency) | Legal/data-protection adviser |
| Approval to create paid resources | Founder/owner |
| Credentials for SMS/email/storage/AI sandboxes | Service owners (keep out of the repo) |

Until each is supplied, this workstream stays **BLOCKED**. Prepared artefacts — the env template, the runbook above, the rollback procedure and the existing backup/restore tooling — are ready to execute the day approval arrives.
