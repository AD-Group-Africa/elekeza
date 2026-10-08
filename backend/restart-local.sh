#!/usr/bin/env bash
# Canonical local backend start — prod profile on :8097 (see ELEKEZA_RUNBOOK.md).
# Usage: bash backend/restart-local.sh [jarPath]
set -u
cd "$(dirname "$0")"
JAR="${1:-build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar}"
PID=$(netstat -ano 2>/dev/null | grep ":8097" | grep -i listen | awk '{print $5}' | head -1)
if [ -n "${PID:-}" ]; then
  echo "Stopping existing backend pid $PID"
  taskkill //F //PID "$PID" 2>&1 | head -1
  sleep 2
fi
set -a
. <(tr -d '\r' < .env) || echo "(warning: some .env lines could not be sourced; continuing)"
set +a
export DB_URL="jdbc:postgresql://localhost:5433/elekeza_chain_scratch"
export JWT_SECRET="${SECURITY_JWT_SECRET}"
export AI_SERVICE_URL="http://localhost:8001"
export AI_INTERNAL_SECRET="$(grep -E '^INTERNAL_SECRET=' ../ai-elewa/.env | cut -d= -f2- | tr -d '\r')"
export CORS_ALLOWED_ORIGINS="http://localhost:3100"
export FRONTEND_URL="http://localhost:3100"
export SECURE_COOKIES=false
export SERVER_PORT=8097
export DEMO_SEED_ENABLED=FALSE
export EMAIL_PROVIDER=mock SMS_PROVIDER=mock STORAGE_PROVIDER=mock
nohup java -jar "$JAR" --spring.profiles.active=prod > chain-backend2.log 2>&1 &
disown
echo "backend starting (log: chain-backend2.log)"
