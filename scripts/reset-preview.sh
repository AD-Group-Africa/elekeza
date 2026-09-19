#!/bin/bash
set -e
echo "=== ELEKEZA CLEAN & REBUILD ==="
cd "$(dirname "$0")"
echo "killing frontend on 3005..."
powershell -NoProfile -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { \$(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -eq 3005).Count -gt 0 } | Stop-Process -Force -ErrorAction SilentlyContinue" || true
echo "killing backend on 8082..."
powershell -NoProfile -Command "Get-Process javaw -ErrorAction SilentlyContinue | Where-Object { \$(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -eq 8082).Count -gt 0 } | Stop-Process -Force -ErrorAction SilentlyContinue" || true
sleep 2
echo "building backend boot jar..."
cd backend
./gradlew -q bootJar
cd ..
echo "clearing stale cookie jar..."
rm -f /tmp/cc.txt
echo "starting frontend dev server on :3005..."
cd frontend
npm run dev -- -p 3005 > frontend-stdout.log 2> frontend-stderr.log &
FRONTEND_PID=$!
echo "frontend launched pid=$FRONTEND_PID"
cd ..
echo "waiting for frontend to be ready..."
for i in $(seq 1 20); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3005 | grep -q 200; then
    echo "frontend ready after ~$i checks"
    break
  fi
  sleep 1
done
echo "frontend status:"
curl -s -o /dev/null -w "frontend http=%{http_code}\n" http://localhost:3005
echo "=== READY ==="
