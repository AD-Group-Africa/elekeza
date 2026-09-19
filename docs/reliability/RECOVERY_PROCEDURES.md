# Elekeza — Recovery Procedures

## 1. Database Recovery

### 1.1 PostgreSQL Backup & Restore

**Prerequisites:**
- `pg_dump` installed and accessible
- PostgreSQL superuser credentials
- Target database exists (or will be created)

**Backup:**
```bash
pg_dump -U <superuser> -d <source_db> -F c -b -v -f backup.dump
# or for SQL format:
pg_dump -U <superuser> -d <source_db> -f backup.sql
```

**Restore to Fresh Database:**
```bash
# Create new database
createdb -U <superuser> <target_db>

# Restore from custom format backup
pg_restore -U <superuser> -d <target_db> backup.dump

# Or from SQL format:
psql -U <superuser> -d <target_db> -f backup.sql
```

**Verify Restoration:**
```bash
psql -U <superuser> -d <target_db> -c "SELECT count(*) FROM users;"
psql -U <superuser> -d <target_db> -c "SELECT count(*) FROM institutions;"
psql -U <superuser> -d <target_db> -c "SELECT count(*) FROM students;"
```

### 1.2 Flyway Migration Reset

If Flyway needs to be reset on a fresh database:

```bash
# Baseline (first run only)
./gradlew flywayBaseline

# Migrate all the way
./gradlew flywayMigrate

# Info (show applied migrations)
./gradlew flywayInfo
```

## 2. Application Configuration Recovery

**Recover All Environment Variables:**
```bash
# From .env.example or documentation
cat > .env << 'EOF'
DB_URL=jdbc:postgresql://localhost:5432/elekeza_prod
DB_USER=elekeza_admin
DB_PASSWORD=secure_password
JWT_SECRET=replace-with-strong-32-plus-characters
AI_CLIENT_TYPE=mock
MPESA_CONSUMER_KEY=replace-with-daraja-key
MPESA_CONSUMER_SECRET=replace-with-daraja-secret
MPESA_PASSKEY=replace-with-daraja-passkey
MPESA_SHORTCODE=174379
# ... other vars from HUMAN_SETUP_CHECKLIST.md
EOF
```

**Redeploy:**
```bash
# Using Gradle
./gradlew bootRun -Dspring.profiles.active=docker

# Or using Docker
docker compose down
docker compose up -d
```

## 3. AI Service Recovery

### 3.1 Switching Between Real and Mock

**To switch from real (Groq) to mock:**
```bash
export AI_CLIENT_TYPE=mock
# Or via application.yml profile
# spring:
#   profiles:
#     active: mock
```

**To switch from mock to real:**
```bash
export AI_CLIENT_TYPE=real
export GROQ_API_KEY=your-groq-key
# Ensure AI_INTERNAL_SECRET is set for the Python service
```

### 3.2 Manual AI Fallback

If AI service is temporarily unavailable:
- The circuit breaker opens after 5 failures
- Requests fail fast with "Service temporarily unavailable"
- After 30s reset timeout, circuit moves to HALF-OPEN
- One test request allowed through to verify recovery
- If successful, circuit CLOSES; if failed, back to OPEN

## 4. SMS/Email/Storage Recovery

### 4.1 Switching Providers

**To switch SMS provider:**
```bash
export sms.provider=mock  # or africa_talking
```

**To switch Email provider:**
```bash
export email.provider=mock  # or javamail
```

**To switch Storage provider:**
```bash
export storage.provider=mock  # or cloudflare_r2
```

## 5. Network/Connection Recovery

### 5.1 Circuit Breaker States

| State | Behavior | Transition |
| --- | --- | --- |
| CLOSED | Normal flow; failures counted (threshold: 5) | → OPEN after threshold |
| OPEN | Fast-fail; requests fail immediately; 30s reset timer | → HALF-OPEN after timeout |
| HALF-OPEN | One test request allowed; success → CLOSED; failure → OPEN | → CLOSED or OPEN |

**Circuit Breaker Configuration:**
- Failure threshold: 5
- Reset timeout: 30,000 ms (30 seconds)
- Retry exponential backoff: 1s, 2s, 4s via `RetryUtil`

### 5.2 Manual Circuit Reset

No manual reset required — automatic after timeout. If immediate reset is needed, restart the Spring application.

## 5.3 Health Check Verification

```bash
# Check all dependencies
curl -sf http://localhost:8080/actuator/health

# Expected response (with all deps):
# {"status":"up","components":{"postgres":{"status":"up"},"redis":{"status":"up"}}}

# With only PostgreSQL:
# {"status":"up","components":{"postgres":{"status":"up"}}}
```

## 6. Payment Recovery

### 6.1 Manual Transaction Reconciliation

If M-Pesa callbacks are lost or duplicated:

```bash
# Check current transaction state
curl -sf http://localhost:8080/api/payments/revenue

# Check specific transaction status
# (would need to query the mpesa_transactions table directly)

# Manual reconciliation steps:
1. Query mpesa_transactions table for incomplete entries
2. Re-play lost callbacks with correct ResultCode/ResultDesc
3. Verify mpesa_receipt_number and transactionDate are populated
4. Confirm revenue endpoint reflects correct totals
```

### 6.2 Duplicate Callback Handling

The system is idempotent — if the same `CheckoutRequestId` is posted twice:
- First call: transaction created with status based on `ResultCode`
- Subsequent calls: `processCallback()` finds existing transaction; updates status only if `resultCode` differs; returns `{"ResultCode": 0, "ResultDesc": "Success"}`

No double-charging occurs.

## 7. Authentication Recovery

### 7.1 Password Reset

```bash
# User flow:
1. POST /api/auth/password-reset with { "email": "user@elekeza.app" }
2. System sends verification email (or DB notification if email not configured)
3. User clicks verification link or uses verification code
4. POST /api/auth/reset-password with { "code": "...", "newPassword": "new_secure_password" }
5. User can now login with new password
```

### 7.2 Account Unlock

If account is locked (consecutive failed login attempts — not yet implemented, but planned):
```bash
# Admin reset via direct DB update or re-registration
# Or: user re-registers with same email (if uniqueness enforcement allows)
```

## 8. Full System Recovery

### 8.1 Complete Recovery Script

```bash
#!/bash
# Elekeza Full Recovery Script
set -e

echo "=== Elekeza Full Recovery ==="

# Step 1: Restore database
echo "1. Restoring database..."
pg_restore -U elekeza_admin -d elekeza_prod backup.dump

# Step 2: Redeploy application
echo "2. Redeploying application..."
docker compose down
docker compose up -d

# Step 3: Verify health
echo "3. Verifying health..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo "   Application healthy after attempt $i"
    break
  fi
  echo "   Attempt $i failed; waiting 10s..."
  sleep 10
done

# Step 4: Check AI mode
echo "4. Checking AI mode..."
if [ "$AI_CLIENT_TYPE" = "mock" ]; then
  echo "   AI running in mock mode"
else
  echo "   AI running in real mode (Groq configured)"
fi

# Step 5: Check payment mode
echo "5. Checking payment mode..."
if [ -z "$MPESA_CONSUMER_KEY" ]; then
  echo "   M-Pesa not configured (will show 503 for payment features)"
else
  echo "   M-Pesa configured"
fi

echo "=== Recovery Complete ==="