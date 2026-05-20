# Elewa Deployment — Critical Issues & Fixes

## Priority 1: CRITICAL (Blocking Deployment)

### Issue #1: Missing `/process` Endpoint in AI Service
**Severity:** BLOCKING — Complete integration failure  
**Location:** `ContentService.kt:96` calls `$aiServiceUrl/process`  
**Problem:** AI service has no `/process` endpoint. It has `/ai/simplify/text` and `/ai/simplify/image`.

**Impact:** Content upload will 404. No lesson generation. Demo broken.

**Fix Required:** Create a new endpoint in AI service OR change backend to call existing endpoints.

**Recommended Fix (simpler for demo):** Add `/process` endpoint to AI service that:
- Accepts `{"file_path": str, "sne_type": str}`
- Reads file from disk
- Extracts text (PDF/DOCX/TXT)
- Calls simplification pipeline with default profile
- Returns `{"simplified_text": str, "word_count": int}`

**Files to modify:**
- `ai-elewa/main.py` — add router for `/process`
- `ai-elewa/utils/ocr.py` — add `extract_text_from_file()` for PDF/DOCX/TXT
- `ai-elewa/endpoints/simplify.py` — refactor to reuse `_run_pipeline()`

---

### Issue #2: Environment Variable Name Mismatch
**Severity:** BLOCKING — Backend cannot find AI service config  
**Location:** `ContentService.kt:32-33` uses `@Value("\${ai.service.url}")` and `@Value("\${ai.internal-secret}")`  
**Problem:** `application.yaml` defines `ai.base-url` and `ai.internal-secret` (with dot), but code expects `ai.service.url` (different key).

**Impact:** Backend fails to start with `IllegalArgumentException: Could not resolve placeholder`.

**Fix:** Change `@Value` annotations to match `application.yaml`:
```kotlin
@Value("\${ai.base-url:http://localhost:8000}") private val aiServiceUrl: String,
@Value("\${ai.internal-secret}") private val internalSecret: String
```

---

### Issue #3: Database Connection String Mismatch (Docker)
**Severity:** BLOCKING — Backend cannot connect to Postgres  
**Location:** `backend/src/main/resources/application-docker.yml:3`  
**Problem:** Docker compose exposes postgres on `5433:5432`, but app-docker.yml uses port `5433` (correct). However `application.yaml` (default) uses Supabase URL with SSL required. When `SPRING_PROFILES_ACTIVE=docker` is set, it should load `application-docker.yml`, but the file name is `application-docker.yml` not `application-docker.yaml`. Spring Boot expects `.yml` or `.yaml` — both work, but need to confirm profile activation.

**Impact:** In Docker, backend may try to use default `application.yaml` (Supabase) instead of Docker Postgres.

**Fix:** Ensure `SPRING_PROFILES_ACTIVE=docker` is set in docker-compose.yml (it is). Rename `application-docker.yml` → `application-docker.yaml` for consistency, or ensure both files exist. Also fix datasource URL to use correct port.

---

### Issue #4: Frontend API Proxy Points to Localhost
**Severity:** BLOCKING — Frontend cannot reach backend in production  
**Location:** `frontend/next.config.ts:8`  
**Problem:** Proxy hardcodes `http://localhost:8080`. On Vercel, backend is on Render with different URL.

**Impact:** Production frontend makes requests to non-existent localhost:8080.

**Fix:** Use environment variable for API base URL:
```ts
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
// then { source: '/api/:path*', destination: `${apiBaseUrl}/api/:path*` }
```

---

### Issue #5: Cookie Security in Production
**Severity:** HIGH — Auth cookies may not work on Vercel  
**Location:** `AuthController.kt:98` sets `secure = true`  
**Problem:** `secure = true` means cookies only sent over HTTPS. Vercel uses HTTPS, so OK. But localhost dev needs `secure = false`.

**Fix:** Make cookie secure flag environment-aware:
```kotlin
val isProduction = System.getenv("SPRING_PROFILES_ACTIVE")?.contains("prod") == true
Cookie(name, value).apply {
  isHttpOnly = true
  secure = isProduction
  path = "/"
  maxAge = maxAge
}
```

---

## Priority 2: HIGH (Must Fix for Demo)

### Issue #6: CORS Origins Hardcoded to Localhost
**Severity:** HIGH — Frontend on Vercel will be blocked  
**Location:** `SecurityConfig.kt:29,65`  
**Problem:** `allowedOriginsRaw` defaults to `http://localhost:3000`. Production frontend URL not included.

**Fix:** Use environment variable:
```kotlin
@Value("\${app.cors.allowed-origins:http://localhost:3000}")
private lateinit var allowedOriginsRaw: String
```
Then set `CORS_ALLOWED_ORIGINS=https://your-app.vercel.app` in production.

---

### Issue #7: Missing `/api/onboarding/*` Endpoints in Frontend API
**Severity:** HIGH — Onboarding flow broken  
**Location:** `frontend/src/lib/api.ts` has no onboarding endpoints  
**Problem:** Frontend expects `/api/onboarding/profile`, `/placement`, `/complete`, `/guardian-link` but these are not defined in `api.ts`.

**Fix:** Add to `api.ts`:
```ts
export const onboardingAPI = {
  profile: async (data) => await api.post('/api/onboarding/profile', data),
  placement: async (data) => await api.post('/api/onboarding/placement', data),
  complete: async () => await api.post('/api/onboarding/complete'),
  guardianLink: async (data) => await api.post('/api/onboarding/guardian-link', data),
}
```

---

### Issue #8: Frontend Uses Wrong Field Names
**Severity:** MEDIUM — Data mapping errors  
**Location:** `frontend/src/types/index.ts:12` uses `fullName`, backend `User.kt:31` uses `name`  
**Problem:** Type mismatch between frontend and backend user schemas.

**Fix:** Update frontend types to match backend:
```ts
export interface User {
  id: string
  email: string
  name: string  // not fullName
  // ...
}
```

Also `AuthResponse` should have `name` not `fullName`.

---

### Issue #9: Missing DTOs in Backend
**Severity:** MEDIUM — Compilation errors  
**Location:** `backend/src/main/kotlin/com/elekeza/backend/auth/dto/`  
**Problem:** Several DTOs referenced but not seen: `AuthResponse`, `LoginRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`, `toDto()` extension.

**Fix:** Create missing DTOs:
```kotlin
data class AuthResponse(val user: UserDto, val learnerId: UUID)
data class LoginRequest(val email: String, val password: String)
data class ForgotPasswordRequest(val email: String)
data class ResetPasswordRequest(val token: String, val newPassword: String)

fun User.toDto() = UserDto(
  id = id,
  email = email,
  name = name,
  role = role.name
)
```

---

### Issue #10: AI Service Port in Docker Compose
**Severity:** MEDIUM — Health check may fail  
**Location:** `docker-compose.yml:47` healthcheck uses `curl -f http://localhost:8000/health`  
**Problem:** Inside the ai-service container, `localhost:8000` is correct. But the healthcheck runs inside the container, so OK.

**No fix needed** — this is actually correct.

---

## Priority 3: MEDIUM (Improvements for Demo)

### Issue #11: No File Extraction in AI Service
**Severity:** MEDIUM — Image endpoint works but PDF/DOCX upload won't  
**Location:** `ai-elewa/utils/ocr.py` only handles images  
**Problem:** Backend `ContentService.upload()` saves PDF/DOCX/TXT and calls AI service with file path. AI service has no file text extraction.

**Fix:** Add `extract_text_from_file()` in `ocr.py` using:
- PDF: `PyPDF2` or `pdfplumber`
- DOCX: `python-docx`
- TXT: direct read

Add to `requirements.txt`:
```
PyPDF2==3.0.1
python-docx==1.1.0
```

---

### Issue #12: Backend Uses Wrong Quiz Endpoint Names
**Severity:** MEDIUM — Quiz flow broken  
**Location:** `QuizController.kt:23` uses `/api/quiz/generate/{contentId}` but frontend `api.ts:88` calls `/api/quiz/{lessonId}/start`  
**Problem:** Endpoint path mismatch.

**Fix:** Align backend controller with frontend API:
```kotlin
@GetMapping("/{lessonId}/start")
fun startQuiz(@PathVariable lessonId: Long, ...)
```

Also add `/answer` and `/complete` endpoints as per frontend.

---

### Issue #13: Missing `useAuth.tsx` File Reference
**Severity:** LOW — Import error  
**Location:** `frontend/src/app/page.tsx:5` imports `useAuth` from `@/hooks/useAuth`  
**Problem:** File is `useAuth.tsx` not `useAuth.ts`. Case-sensitive on some systems.

**Fix:** Rename file or update import to `useAuth.tsx`.

---

## Priority 4: LOW (Nice to Have)

### Issue #14: Hardcoded Secrets in application.yaml
**Severity:** LOW — Security risk long-term  
**Problem:** JWT secret, DB credentials hardcoded in `application.yaml`.

**Fix:** Move to environment variables:
```yaml
jwt:
  secret: ${JWT_SECRET}
datasource:
  url: ${DATABASE_URL}
  username: ${DATABASE_USERNAME}
  password: ${DATABASE_PASSWORD}
```

---

### Issue #15: No Health Endpoint in AI Service for Docker
**Severity:** LOW — Already has `/health`  
**Status:** OK

---

## Summary: Top 5 Must-Fix Before Deployment

| # | Issue | File(s) to Change | Effort |
|---|-------|-------------------|--------|
| 1 | Add `/process` endpoint to AI service | `ai-elewa/main.py`, `ai-elewa/endpoints/simplify.py`, `ai-elewa/utils/ocr.py` | 2h |
| 2 | Fix env var names in ContentService | `backend/src/main/kotlin/.../ContentService.kt` | 5min |
| 3 | Fix frontend API proxy URL | `frontend/next.config.ts` | 5min |
| 4 | Add onboarding endpoints to frontend api.ts | `frontend/src/lib/api.ts` | 5min |
| 5 | Fix frontend User type mismatch | `frontend/src/types/index.ts` | 5min |

**Total estimated fix time:** 3–4 hours

---

## Minimal Demo Scope (Auth + Dashboard Only)

To launch TODAY with a working demo:

**Phase 1 — Must work:**
1. User registers/logs in (JWT cookies)
2. User sees dashboard (protected route)
3. Dashboard shows "Welcome, [name]"

**Phase 2 — Nice to have:**
4. Onboarding flow (profile → placement → complete)
5. Content upload (text only, no AI processing)
6. Dashboard shows uploaded content list

**Phase 3 — Skip for now:**
- Quiz generation
- AI simplification
- OCR/image upload
- Adaptive learning

---

## Recommended Deployment Order

1. **Fix backend** (Issues #1–#2) — AI service integration
2. **Fix frontend** (Issues #3–#5) — API proxy + onboarding endpoints
3. **Add `/process` endpoint** to AI service (Issue #1)
4. **Test locally** with `docker-compose up` — all three services
5. **Deploy to Render** (backend) + **Vercel** (frontend) + **Railway/Supabase** (Postgres)
6. **Update environment variables** for production URLs
7. **Smoke test:** Register → Login → Dashboard

---

## Production Environment Variables

### Backend (Render)
```env
SPRING_PROFILES_ACTIVE=prod
DB_PASSWORD=<from-supabase>
DB_USER=<from-supabase>
DB_NAME=<from-supabase>
DB_HOST=<supabase-host>
DB_PORT=5432
JWT_SECRET=<32+ char random>
AI_SERVICE_URL=http://ai-service:8000  # if AI on same network, or external URL
AI_INTERNAL_SECRET=<same-as-ai-service>
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
MAIL_USERNAME=<smtp-user>
MAIL_PASSWORD=<smtp-pass>
```

### Frontend (Vercel)
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### AI Service (Render/Railway)
```env
AI_PROVIDER=groq
AI_API_KEY=<your-groq-key>
INTERNAL_SECRET=<same-as-backend>
LANGFUSE_PUBLIC_KEY=<if-using>
LANGFUSE_SECRET_KEY=<if-using>
LANGFUSE_HOST=<langfuse-url>
TESSERACT_CMD=  # leave empty on Linux
```

---

## Files That Need Changes

**Backend (Kotlin):**
- `ContentService.kt` — fix `@Value` keys (2 min)
- `QuizController.kt` — align endpoints with frontend (10 min)
- Add missing DTOs in `auth/dto/` (15 min)

**Frontend (TypeScript):**
- `next.config.ts` — make API URL configurable (5 min)
- `src/lib/api.ts` — add onboarding endpoints (5 min)
- `src/types/index.ts` — fix User type (2 min)

**AI Service (Python):**
- `main.py` — add `/process` endpoint (20 min)
- `utils/ocr.py` — add file extraction (30 min)
- `requirements.txt` — add PyPDF2, python-docx (0 min)

**Config:**
- Create `backend/src/main/resources/application-prod.yaml` (10 min)
- Update `docker-compose.yml` env vars (5 min)

**Total:** ~2 hours of coding + 1 hour testing