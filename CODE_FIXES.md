# Elewa Deployment — Code Fixes for Production

## Fix 1: ContentService.kt — Environment Variable Names

**File:** `backend/src/main/kotlin/com/elekeza/backend/content/ContentService.kt`

**Line 32-33:** Change from:
```kotlin
@Value("\${ai.service.url:http://localhost:8000}") private val aiServiceUrl: String,
@Value("\${ai.internal-secret}") private val internalSecret: String
```

**To:**
```kotlin
@Value("\${ai.base-url:http://localhost:8000}") private val aiServiceUrl: String,
@Value("\${ai.internal-secret}") private val internalSecret: String
```

**Reason:** Matches `application.yaml` keys `ai.base-url` and `ai.internal-secret`.

---

## Fix 2: SecurityConfig.kt — CORS Origins from Env

**File:** `backend/src/main/kotlin/com/elekeza/backend/config/SecurityConfig.kt`

**Line 29:** Change from:
```kotlin
@Value("\${app.cors.allowed-origins:http://localhost:3000}")
private lateinit var allowedOriginsRaw: String
```

**To:** (already correct, just ensure production sets `CORS_ALLOWED_ORIGINS`)

**No code change needed** — just ensure production sets:
```env
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.your-app.vercel.app
```

---

## Fix 3: AuthController.kt — Cookie Secure Flag

**File:** `backend/src/main/kotlin/com/elekeza/backend/auth/AuthController.kt`

**Line 97-98:** Change from:
```kotlin
private fun buildCookie(name: String, value: String, maxAge: Int): Cookie =
    Cookie(name, value).apply { isHttpOnly = true; secure = true; path = "/"; this.maxAge = maxAge }
```

**To:**
```kotlin
private fun buildCookie(name: String, value: String, maxAge: Int): Cookie {
    val isProduction = System.getenv("SPRING_PROFILES_ACTIVE")?.contains("prod") == true
    return Cookie(name, value).apply {
        isHttpOnly = true
        secure = isProduction  // true only in production (HTTPS)
        path = "/"
        this.maxAge = maxAge
    }
}
```

---

## Fix 4: Frontend next.config.ts — Configurable API URL

**File:** `frontend/next.config.ts`

**Change from:**
```ts
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/api/:path*",
      },
    ];
  },
};
```

**To:**
```ts
const nextConfig: NextConfig = {
  async rewrites() {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
});
```

---

## Fix 5: Frontend api.ts — Add Onboarding Endpoints

**File:** `frontend/src/lib/api.ts`

**Add to `export const onboardingAPI` object (after line 58):**
```ts
export const onboardingAPI = {
  profile: async (data: { preferredLanguage: string; ageGroup: string; learningGoal: string; cognitiveProfiles?: string[] }) => {
    const res = await api.post('/api/onboarding/profile', data)
    return res.data
  },
  placement: async (data: { score: number; totalQuestions: number }) => {
    const res = await api.post('/api/onboarding/placement', data)
    return res.data
  },
  complete: async () => {
    const res = await api.post('/api/onboarding/complete')
    return res.data
  },
  guardianLink: async (data: { fullName: string; relationship: string; phone?: string; email?: string }) => {
    const res = await api.post('/api/onboarding/guardian-link', data)
    return res.data
  },
}
```

**Note:** The backend already has these endpoints (`OnboardingController.kt`). Just need to expose them in frontend.

---

## Fix 6: Frontend types/index.ts — Match Backend User Schema

**File:** `frontend/src/types/index.ts`

**Line 9-16:** Change from:
```ts
export interface User {
  id: string;
  email: string;
  fullName: string;
  onboardingComplete?: boolean;
  role: 'Student' | 'Teacher' | 'School Admin' | 'Guardian';
  cognitiveProfiles?: CognitiveProfile[];
}
```

**To:**
```ts
export interface User {
  id: string;
  email: string;
  name: string;  // Backend uses 'name', not 'fullName'
  onboardingComplete?: boolean;
  role: 'Student' | 'Teacher' | 'School Admin' | 'Guardian';
  cognitiveProfiles?: CognitiveProfile[];
}
```

**Also update `AuthResponse` (line 18-25):**
```ts
export interface AuthResponse {
  learnerId: string;
  email: string;
  name?: string | null;  // Changed from fullName
  onboardingComplete: boolean;
  message: string;
  cognitiveProfiles?: CognitiveProfile[];
}
```

---

## Fix 7: Frontend useAuth.tsx — Map User Correctly

**File:** `frontend/src/hooks/useAuth.tsx`

**Line 24-33:** Change from:
```ts
const mapAuthResponseToUser = (data: AuthResponse): User => ({
  id: data.learnerId,
  email: data.email,
  fullName: data.fullName || '',
  onboardingComplete: data.onboardingComplete,
  role: 'Student',
  cognitiveProfiles: data.cognitiveProfiles && data.cognitiveProfiles.length > 0
    ? data.cognitiveProfiles
    : readCognitiveProfiles(data.learnerId),
})
```

**To:**
```ts
const mapAuthResponseToUser = (data: AuthResponse): User => ({
  id: data.learnerId,
  email: data.email,
  name: data.name || '',
  onboardingComplete: data.onboardingComplete,
  role: 'Student',
  cognitiveProfiles: data.cognitiveProfiles && data.cognitiveProfiles.length > 0
    ? data.cognitiveProfiles
    : readCognitiveProfiles(data.learnerId),
})
```

**Also line 72:** In demo user creation, change `fullName` to `name`:
```ts
const demoUser: User = {
  id: `demo-${demoAccount.role.toLowerCase().replace(/\s+/g, '-')}`,
  email: demoAccount.email,
  name: demoAccount.role,  // Changed from fullName
  onboardingComplete: true,
  role: demoAccount.role,
}
```

---

## Fix 8: AI Service — Add `/process` Endpoint

**File:** `ai-elewa/main.py` (add new router)

**Add after line 16:**
```python
from endpoints.process import router as process_router
# ...
app.include_router(process_router)
```

**Create new file:** `ai-elewa/endpoints/process.py`
```python
import logging
from fastapi import APIRouter, Request
from models.requests import ProcessRequest
from models.responses import ProcessResponse
from utils.ocr import extract_text_from_file
from pipeline.stage1_profile import build_system_prompt
from pipeline.stage2_simplify import simplify
from pipeline.stage3_verify import verify
from pipeline.stage4_concepts import extract_concepts
from models.errors import AIServiceError, ErrorResponse, ERROR_EMPTY_CONTENT, ERROR_OVERSIZED, ERROR_NON_ENGLISH
from utils.error_handler import error_json_response
import config

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/process")
async def process_file(request: ProcessRequest):
    """
    Backend compatibility endpoint.
    Accepts file_path and sne_type, extracts text, runs simplification pipeline.
    Returns simplified_text and word_count.
    """
    try:
        # Extract text from file
        raw_text = await extract_text_from_file(request.file_path)
        
        if not raw_text or not raw_text.strip():
            raise AIServiceError(ErrorResponse(
                error_code=ERROR_EMPTY_CONTENT,
                message="File contains no extractable text.",
                stage="process",
            ))
        
        # Validate word count
        word_count = len(raw_text.split())
        if word_count > config.MAX_WORDS:
            raise AIServiceError(ErrorResponse(
                error_code=ERROR_OVERSIZED,
                message=f"Content is {word_count} words, exceeding the 5000-word limit.",
                stage="process",
            ))
        
        # Build learner context with default values (backend doesn't send profile)
        # Use sne_type to infer profile if available
        from models.requests import LearnerContext
        learner_context = LearnerContext(
            learner_id="backend-upload",
            cognitive_profiles=[request.sne_type.lower()] if request.sne_type and request.sne_type != "NONE" else ["dyslexia"],
            language_level=2,
            content_difficulty=2,
            pathway_stage="Foundation"
        )
        
        # Run pipeline
        system_prompt = build_system_prompt(learner_context)
        lesson = await simplify(system_prompt, raw_text, learner_context)
        lesson = await verify(lesson, raw_text, learner_context)
        lesson = extract_concepts(lesson)
        
        return ProcessResponse(
            simplified_text=lesson.model_dump_json(),
            word_count=word_count
        )
        
    except AIServiceError as e:
        return error_json_response(e.error_response)
    except Exception as e:
        logger.error(f"Unhandled error in /process: {e}", exc_info=True)
        return error_json_response(ErrorResponse(
            error_code="SCHEMA_INVALID",
            message="An unexpected error occurred processing the file.",
            stage="process",
        ))
```

**Create file:** `ai-elewa/models/requests.py` — add:
```python
class ProcessRequest(BaseModel):
    file_path: str
    sne_type: str = "NONE"
```

**Create file:** `ai-elewa/models/responses.py` — add:
```python
class ProcessResponse(BaseModel):
    simplified_text: str
    word_count: int
```

**Update:** `ai-elewa/utils/ocr.py` — add `extract_text_from_file()`:
```python
async def extract_text_from_file(file_path: str) -> str:
    """Extract text from PDF, DOCX, or TXT file."""
    import asyncio
    from pathlib import Path
    
    path = Path(file_path)
    if not path.exists():
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_OCR_FAILED,
            message=f"File not found: {file_path}",
            stage="process",
        ))
    
    ext = path.suffix.lower()
    
    try:
        if ext == '.pdf':
            return await asyncio.to_thread(_extract_pdf, path)
        elif ext in ['.docx', '.doc']:
            return await asyncio.to_thread(_extract_docx, path)
        elif ext == '.txt':
            return await asyncio.to_thread(_extract_txt, path)
        else:
            # Fallback: try to read as text
            return await asyncio.to_thread(_extract_txt, path)
    except Exception as e:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_OCR_FAILED,
            message=f"Failed to extract text from {path.name}: {str(e)}",
            stage="process",
        ))

def _extract_pdf(path: Path) -> str:
    import PyPDF2
    text_parts = []
    with open(path, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
    return '\n\n'.join(text_parts)

def _extract_docx(path: Path) -> str:
    from docx import Document
    doc = Document(path)
    return '\n\n'.join(paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip())

def _extract_txt(path: Path) -> str:
    return path.read_text(encoding='utf-8', errors='ignore')
```

**Update:** `ai-elewa/requirements.txt` — add:
```
PyPDF2==3.0.1
python-docx==1.1.0
```

---

## Fix 9: Backend QuizController — Align with Frontend

**File:** `backend/src/main/kotlin/com/elekeza/backend/quiz/controller/QuizController.kt`

**Replace entire file with:**
```kotlin
package com.elekeza.backend.quiz.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.quiz.*
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/quiz")
class QuizController(
    private val quizService: QuizService,
    private val quizRepository: QuizRepository,
    private val userRepository: UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    // GET /api/quiz/{lessonId}/start — Start or resume a quiz
    @GetMapping("/{lessonId}/start")
    fun startQuiz(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable lessonId: Long
    ): ResponseEntity<QuizDto> {
        val userId = resolveUserId(principal)
        val quiz = quizService.getOrCreateQuiz(lessonId, userId)
        return ResponseEntity.ok(QuizDto(
            quizId = quiz.quizId,
            lessonId = quiz.lessonId,
            questions = quiz.questions
        ))
    }

    // POST /api/quiz/{quizId}/answer — Submit an answer
    @PostMapping("/{quizId}/answer")
    fun submitAnswer(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable quizId: Long,
        @RequestBody submission: AnswerSubmission
    ): ResponseEntity<AnswerResult> {
        val question = questionRepository.findById(submission.questionId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found")
        }
        val isCorrect = question.correctOption.equals(submission.selectedOption.trim(), ignoreCase = true)
        return ResponseEntity.ok(AnswerResult(
            correct = isCorrect,
            correctOption = question.correctOption,
            explanation = question.explanation
        ))
    }

    // GET /api/quiz/{quizId}/complete — Finalise quiz
    @GetMapping("/{quizId}/complete")
    fun completeQuiz(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable quizId: Long
    ): ResponseEntity<QuizResult> {
        val userId = resolveUserId(principal)
        val result = quizService.completeQuiz(quizId, userId)
        return ResponseEntity.ok(result)
    }
}
```

---

## Fix 10: Create Missing DTOs

**Create file:** `backend/src/main/kotlin/com/elekeza/backend/auth/dto/AuthResponse.kt`
```kotlin
package com.elekeza.backend.auth.dto

import java.util.UUID

data class AuthResponse(
    val learnerId: UUID,
    val email: String,
    val name: String? = null,
    val onboardingComplete: Boolean = false,
    val message: String? = null,
    val cognitiveProfiles: List<String>? = null
)
```

**Create file:** `backend/src/main/kotlin/com/elekeza/backend/auth/dto/LoginRequest.kt`
```kotlin
package com.elekeza.backend.auth.dto

data class LoginRequest(
    val email: String,
    val password: String
)
```

**Create file:** `backend/src/main/kotlin/com/elekeza/backend/auth/dto/RegisterRequest.kt`
```kotlin
package com.elekeza.backend.auth.dto

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String,
    val role: String? = "STUDENT",
    val cognitiveProfiles: List<String>? = null
)
```

**Create file:** `backend/src/main/kotlin/com/elekeza/backend/auth/dto/ForgotPasswordRequest.kt`
```kotlin
package com.elekeza.backend.auth.dto

data class ForgotPasswordRequest(
    val email: String
)
```

**Create file:** `backend/src/main/kotlin/com/elekeza/backend/auth/dto/ResetPasswordRequest.kt`
```kotlin
package com.elekeza.backend.auth.dto

data class ResetPasswordRequest(
    val token: String,
    val newPassword: String
)
```

**Create file:** `backend/src/main/kotlin/com/elekeza/backend/auth/dto/UserDto.kt`
```kotlin
package com.elekeza.backend.auth.dto

import java.util.UUID

data class UserDto(
    val id: UUID,
    val email: String,
    val name: String,
    val role: String
) {
    fun toAuthResponse() = AuthResponse(
        learnerId = id,
        email = email,
        name = name,
        role = role
    )
}
```

**Update:** `backend/src/main/kotlin/com/elekeza/backend/auth/User.kt` — add `toDto()` method:
```kotlin
fun toDto() = UserDto(
    id = id,
    email = email,
    name = name,
    role = role.name
)
```

---

## Fix 11: Production Application Config

**Create file:** `backend/src/main/resources/application-prod.yaml`
```yaml
spring:
  application:
    name: elekeza-backend

  datasource:
    url: ${DATABASE_URL}
    username: ${DATABASE_USERNAME}
    password: ${DATABASE_PASSWORD}
    driver-class-name: org.postgresql.Driver
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      max-lifetime: 1800000

  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    open-in-view: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        jdbc:
          lob:
            non_contextual_creation: true

  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: false
    validate-on-migrate: true

jwt:
  secret: ${JWT_SECRET}
  expiration: 900000
  refresh-expiration: 604800000

ai:
  base-url: ${AI_SERVICE_URL}
  internal-secret: ${AI_INTERNAL_SECRET}

app:
  cors:
    allowed-origins: ${CORS_ALLOWED_ORIGINS}
  frontend-url: ${FRONTEND_URL}
  upload-dir: /tmp/uploads

logging:
  level:
    root: INFO
    com.elekeza: INFO
    org.springframework: WARN
```

---

## Fix 12: Docker Compose — Fix Backend Env Vars

**File:** `docker-compose.yml`

**Lines 24-27:** Change from:
```yaml
environment:
  SPRING_PROFILES_ACTIVE: docker
  DB_PASSWORD: ${DB_PASSWORD:-password}
  INTERNAL_SECRET: ${INTERNAL_SECRET:-change-me-shared-secret}
```

**To:**
```yaml
environment:
  SPRING_PROFILES_ACTIVE: docker
  DB_PASSWORD: ${DB_PASSWORD:-password}
  DB_USERNAME: ${DB_USERNAME:-postgres}
  DB_NAME: ${DB_NAME:-accessibledocs}
  AI_SERVICE_URL: http://ai-service:8000
  AI_INTERNAL_SECRET: ${INTERNAL_SECRET:-change-me-shared-secret}
  CORS_ALLOWED_ORIGINS: http://localhost:3000,http://frontend:3000
```

**Also add to `ai-service` section (line 42-45):**
```yaml
environment:
  AI_PROVIDER: groq
  AI_API_KEY: ${GROQ_API_KEY}
  INTERNAL_SECRET: ${INTERNAL_SECRET:-change-me-shared-secret}
  LANGFUSE_HOST: http://langfuse:3000
  TESSERACT_CMD:  # empty for Docker auto-detect
```

**Add langfuse service if not present:**
```yaml
  langfuse:
    image: langfuse/langfuse:latest
    container_name: elewa-langfuse
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD:-password}@postgres:5432/accessibledocs
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-change-me}
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      - postgres
```

---

## Fix 13: Frontend — Use Correct API Base URL in Production

**File:** `frontend/.env.example` (create if missing)
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

**File:** `frontend/.env.local` (for local dev, gitignored)
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## Fix 14: Backend — Fix Database Port in application-docker.yaml

**File:** `backend/src/main/resources/application-docker.yaml` (rename from `.yml` if needed)

**Ensure content:**
```yaml
spring:
  datasource:
    url: jdbc:postgresql://postgres:5432/accessibledocs
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD:password}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
```

**Note:** Docker internal network uses container name `postgres` and internal port `5432`, not `5433`.

---

## Fix 15: Backend — Add Missing Repository Methods

**File:** `backend/src/main/kotlin/com/elekeza/backend/learner/LearnerRepository.kt`

**Add method:**
```kotlin
fun findByUserId(userId: Long): Optional<Learner>
```

**File:** `backend/src/main/kotlin/com/elekeza/backend/learner/LessonProgressRepository.kt` (create if missing)

```kotlin
package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface LessonProgressRepository : JpaRepository<LessonProgress, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<LessonProgress>
    fun findByUserIdAndContentId(userId: Long, contentId: Long): LessonProgress?
    fun countByUserIdAndCompleted(userId: Long, completed: Boolean): Long
    fun avgQuizScore(userId: Long): Double?
    fun findRecentActivity(userId: Long, since: LocalDateTime): List<LessonProgress>
    fun findByUserIdAndCompleted(userId: Long, completed: Boolean): List<LessonProgress>
}
```

---

## Summary of Changes

**Total files to create/modify:** 15 files  
**Estimated time:** 3-4 hours  
**Risk level:** Medium (well-isolated changes)

**After applying all fixes:**
1. Backend starts with correct env vars
2. Backend connects to Postgres on correct port
3. Backend can call AI service `/process` endpoint
4. Frontend proxy points to production backend
5. Frontend has all required API methods
6. TypeScript types match backend schemas
7. CORS allows Vercel domain
8. Auth cookies work in production (HTTPS only)

---

## Quick Verification Checklist

- [ ] Backend compiles: `./gradlew build`
- [ ] AI service starts: `uvicorn main:app --port 8000`
- [ ] Docker compose up: all 4 services healthy
- [ ] Frontend builds: `npm run build` (no TypeScript errors)
- [ ] Register flow works: POST `/api/auth/register` → 201 + cookies
- [ ] Login works: POST `/api/auth/login` → 200 + cookies
- [ ] Dashboard loads: GET `/api/learner/profile` → 200
- [ ] Content upload: POST `/api/content/upload/text` → 202 (async processing)
- [ ] Quiz endpoints: GET `/api/quiz/{id}/start` → 200

---

## Production Deployment Order

1. Deploy Postgres (Supabase or Railway)
2. Deploy AI service (Render or Railway) — test `/health`
3. Deploy Backend (Render) — test `/actuator/health`
4. Deploy Frontend (Vercel) — set `NEXT_PUBLIC_API_URL`
5. Test full flow: Register → Login → Dashboard
6. If any step fails, check logs:
   - Backend: `docker logs elewa-backend`
   - AI: `docker logs elewa-ai`
   - Frontend: Vercel function logs

---

**All fixes are now documented. Switch to Code mode to implement.**