# Elewa — Docker & Deployment Troubleshooting

## 🐳 Docker Desktop Not Running (Windows)

**Error:**
```
unable to get image 'elewa-frontend': error during connect:
Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/images/elewa-frontend/json":
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

**Cause:** Docker Desktop is not running on Windows.

**Fix:**
1. Open **Docker Desktop** from Start Menu
2. Wait for the whale icon to show "Docker Desktop is running"
3. Open a **new PowerShell** (restart your terminal)
4. Run `docker --version` to confirm it's available
5. Then run: `docker-compose up --build -d`

---

## ⚠️ Environment Variable Warnings

**Warning:**
```
The "GROQ_API_KEY" variable is not set. Defaulting to a blank string.
```

**Cause:** You haven't created a `.env` file with your API keys.

**Fix:**

### Step 1 — Create `.env` file in project root
```bash
cd C:\Users\thrillerpark\Desktop\ELEWA
notepad .env
```

### Step 2 — Add these contents (replace with your actual keys):
```env
# Database
DB_PASSWORD=your-db-password-here

# AI Service
GROQ_API_KEY=gsk_your_groq_api_key_here

# Shared secret between backend and AI service (must match)
INTERNAL_SECRET=your-32-char-random-string-here-at-least-32-chars

# JWT (generate a random 32+ char string)
JWT_SECRET=another-32-char-random-string-here-minimum-32-characters

# Optional — Langfuse (if using)
# LANGFUSE_PUBLIC_KEY=pk-lf-...
# LANGFUSE_SECRET_KEY=sk-lf-...
# LANGFUSE_HOST=http://localhost:3000
```

**How to get GROQ_API_KEY:**
1. Go to https://console.groq.com
2. Sign up / log in
3. Go to "API Keys" page
4. Copy your key (starts with `gsk_`)

**How to generate JWT_SECRET:**
```bash
# In PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```
Or use any online random string generator (32+ characters).

---

## 🔐 Required Environment Variables Summary

### For `docker-compose.yml` (root .env file)
| Variable | Required? | Description |
|----------|-----------|-------------|
| `DB_PASSWORD` | Yes | Postgres password (any strong string) |
| `GROQ_API_KEY` | Yes | From console.groq.com |
| `INTERNAL_SECRET` | Yes | Shared secret between backend & AI service (32+ chars) |
| `JWT_SECRET` | Yes | JWT signing secret (32+ chars) |

### For `ai-elewa/.env` (if running AI service locally with uvicorn)
```env
AI_PROVIDER=groq
AI_API_KEY=gsk_your_groq_key_here
INTERNAL_SECRET=your-32-char-secret-here
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
LANGFUSE_HOST=http://localhost:3000
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

### For `backend/.env` (if running backend locally)
```env
SPRING_PROFILES_ACTIVE=local
DB_PASSWORD=your-db-password
DB_USERNAME=postgres
DB_NAME=accessibledocs
DB_HOST=localhost
DB_PORT=5433
JWT_SECRET=your-32-char-jwt-secret
AI_SERVICE_URL=http://localhost:8000
AI_INTERNAL_SECRET=your-32-char-shared-secret
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

---

## 🚀 Quick Start (Fresh Setup)

### 1. Install Prerequisites
- **Docker Desktop:** https://www.docker.com/products/docker-desktop/
- **Python 3.13:** https://www.python.org/downloads/
- **Node.js 20+:** https://nodejs.org/
- **Tesseract OCR (Windows):** https://github.com/UB-Mannheim/tesseract/wiki

### 2. Start Docker Desktop
- Launch Docker Desktop from Start Menu
- Wait for the whale icon in system tray to stop animating
- Open **new** PowerShell window

### 3. Create `.env` File
```powershell
cd C:\Users\thrillerpark\Desktop\ELEWA
notepad .env
```
Paste the env vars from above (with your actual keys).

### 4. Build & Start
```powershell
docker-compose up --build -d
```

**First build takes 3-5 minutes** (downloads base images, builds Gradle, installs Python deps).

### 5. Check Status
```powershell
docker-compose ps
```
Expected output:
```
NAME              STATUS              PORTS
elewa-postgres    Up (healthy)        5433/tcp
elewa-backend     Up (healthy)        8080/tcp
elewa-ai          Up (healthy)        8000/tcp
elewa-frontend    Up (healthy)        3000/tcp
```

### 6. View Logs
```powershell
# AI service
docker-compose logs ai-service -f

# Backend
docker-compose logs backend -f

# All services
docker-compose logs -f
```

---

## 🔍 Common Issues & Solutions

### Issue: "port is already allocated" (0.0.0.0:5433)
**Cause:** Another Postgres instance running on host.

**Fix:**
```powershell
# Find process using port 5433
netstat -ano | findstr :5433

# Kill it (replace PID)
taskkill /PID <PID> /F

# Or change host port in docker-compose.yml from "5433:5432" to "5434:5432"
```

### Issue: Backend fails with "Could not resolve placeholder 'ai.base-url'"
**Cause:** `application-docker.yml` not being loaded or wrong profile.

**Fix:** Ensure backend uses `docker` profile:
```yaml
# docker-compose.yml
environment:
  SPRING_PROFILES_ACTIVE: docker  # This loads application-docker.yml
```

### Issue: AI service fails to start — "pytesseract not installed"
**Cause:** Tesseract binary missing (Windows local only).

**Fix (Windows local):**
1. Install Tesseract from https://github.com/UB-Mannheim/tesseract/wiki
2. Default path: `C:\Program Files\Tesseract-OCR\tesseract.exe`
3. Set in `.env`: `TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe`

**Fix (Docker):** Tesseract is installed in the Docker image via Dockerfile. Leave `TESSERACT_CMD=` empty in `.env`.

### Issue: Frontend shows "Failed to fetch" errors
**Cause:** Backend not running or CORS blocking.

**Fix:**
1. Check backend is up: `curl http://localhost:8080/actuator/health`
2. Check CORS allowed origins includes `http://localhost:3000`
3. Check browser console for exact error

### Issue: 401 Unauthorised on every API call
**Cause:** `INTERNAL_SECRET` mismatch between backend and AI service.

**Fix:** Ensure both `.env` files (root and `ai-elewa/.env`) have the **same** `INTERNAL_SECRET` value.

### Issue: "connection refused" when backend calls AI service
**Cause:** AI service not ready when backend starts.

**Fix:** Docker `depends_on` with healthcheck should handle this. Check logs:
```powershell
docker-compose logs backend
```
If AI service failed to start, fix its errors first.

### Issue: Frontend build fails — "cannot find module"
**Cause:** Node modules not installed.

**Fix:** Rebuild frontend image:
```powershell
docker-compose build frontend
docker-compose up -d frontend
```

---

## 🧪 Testing the Installation

### Test 1: Health Checks
```powershell
# AI service
curl http://localhost:8000/health
# Expected: {"status":"ok"}

# Backend
curl http://localhost:8080/actuator/health
# Expected: {"status":"UP"}
```

### Test 2: Register a User
```powershell
curl -X POST http://localhost:8080/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@test.com","password":"Test123!","name":"Test User"}'
```
Expected: `201 Created` with `Set-Cookie` headers.

### Test 3: Upload Text
```powershell
# First login to get cookies (save as login.ps1)
$login = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"test@test.com","password":"Test123!"}'

# Extract cookies
$cookies = $login.Headers["Set-Cookie"]

# Upload
Invoke-WebRequest -Uri "http://localhost:8080/api/content/upload/text" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"text":"The water cycle is how water moves around Earth.","subject":"Science"}' `
  -Headers @{"Cookie"=$cookies}
```
Expected: `202 Accepted` with content ID.

---

## 📁 Project Structure Recap

```
ELEWA/
├── docker-compose.yml          # Orchestrates all 4 services
├── .env                        # ← YOU NEED TO CREATE THIS
├── ai-elewa/                   # Python AI service
│   ├── main.py
│   ├── endpoints/
│   │   ├── simplify.py
│   │   ├── quiz.py
│   │   └── process.py          # ← NEW
│   ├── utils/
│   │   └── ocr.py              # ← UPDATED with file extraction
│   ├── models/
│   │   ├── requests.py         # ← Added ProcessRequest
│   │   └── responses.py        # ← Added ProcessResponse
│   └── requirements.txt        # ← Added PyPDF2, python-docx
├── backend/                    # Spring Boot backend
│   └── src/main/
│       ├── kotlin/...
│       └── resources/
│           ├── application-docker.yml  # ← Fixed port 5432
│           └── applicationprod.yaml    # ← Created
└── frontend/                   # Next.js frontend
    └── src/
        ├── lib/api.ts          # ← Added onboarding endpoints
        └── types/index.ts       # ← Fixed User.fullName → User.name
```

---

## 🆘 Still Stuck?

1. **Check Docker is running:**
   ```powershell
   docker --version
   docker info
   ```
   If fails → Start Docker Desktop.

2. **Check .env file exists:**
   ```powershell
   Get-Content .env
   ```
   Should show your keys.

3. **Recreate containers from scratch:**
   ```powershell
   docker-compose down -v  # WARNING: deletes data
   docker-compose up --build -d
   ```

4. **View all logs:**
   ```powershell
   docker-compose logs --tail=100
   ```

5. **Restart Docker Desktop:**
   - Right-click Docker whale icon → "Restart"
   - Wait 2 minutes
   - Try `docker-compose up` again

---

## 📞 Support

If issues persist after following this guide:
1. Take screenshot of `docker-compose ps` output
2. Take screenshot of `docker-compose logs` (last 50 lines)
3. Share your `.env` file (redact actual API keys)
4. Describe what you expected vs what happened

**Note:** Never commit `.env` to Git. It's in `.gitignore`.