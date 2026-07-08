# Elekeza – Technical Architecture

## System Overview

Elekeza is a modular, multi‑school learning platform composed of four main services:
┌──────────────────────────────────────────────────┐
│ Client (PWA) │
│ Next.js 15 · Tailwind · next-pwa · TTS · A11y │
│ Port: 3000 (dev) / Vercel (prod) │
└───────────────┬──────────────────────────────────┘
│ HTTPS (Nginx)
┌───────────────▼──────────────────────────────────┐
│ Spring Boot 3.2 (Kotlin) │
│ JWT Auth · RBAC · REST API · File Upload │
│ Port: 9090 (dev) / Render/Railway (prod) │
│ ┌───────────┐ ┌──────────┐ ┌───────────────┐ │
│ │ Content │ │ Quiz │ │ Guardian │ │
│ │ Upload + │ │ Adaptive │ │ Ward Progress │ │
│ │ AI Pipe │ │ Engine │ │ │ │
│ └───────────┘ └──────────┘ └───────────────┘ │
│ ┌───────────┐ ┌──────────┐ ┌───────────────┐ │
│ │ Teacher │ │Institut. │ │ Notification │ │
│ │ Dashboard │ │ Mgmt │ │ Service │ │
│ └───────────┘ └──────────┘ └───────────────┘ │
└───────┬───────────────────────┬─────────────────┘
│ │
┌───────▼──────────┐ ┌───────▼──────────────────┐
│ PostgreSQL 16 │ │ FastAPI AI Service │
│ Flyway V1‑V24 │ │ Groq/OpenAI/Anthropic │
│ Redis 7 (cache) │ │ 4‑Stage Simplification │
└──────────────────┘ └──────────────────────────┘

text

## Data Flow

1. **Teacher** uploads document → `ContentController` extracts text (PDFBox/POI) → calls **AI Service** (`/process`) → simplified JSON stored in `content.simplified_text`.
2. **Student** requests lesson → `GET /content/lessons/{id}` → parsed sections, TTS triggers → quiz link.
3. **Student** answers quiz → `QuizController` checks answer, AI adaptive feedback, final score saved to `quiz_attempts` and `lesson_progress`.
4. **Guardian** logs in → `GuardianController` queries `guardian_links` + `lesson_progress` → ward progress display.

## Security

- **Authentication:** JWT (access + refresh tokens). Access token in `Authorization: Bearer` header or `elekeza_access` cookie.
- **Refresh:** HttpOnly, SameSite=Strict cookie at `/api/auth`. Rotation on use.
- **RBAC:** Five roles (STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN). Controllers protected with `@PreAuthorize`.
- **Internal AI Service:** HMAC header (`X-Internal-Key`) verified by FastAPI middleware.
- **CORS:** Configured per environment. Dev allows all origins.
- **Rate Limiting:** Bucket4j dependency added; ready for configuration.

## Database

- **Schema:** 18+ tables including users, learner_profiles, institutions, guardian_links, contents, quizzes, quiz_questions, quiz_attempts, lesson_progress, notifications.
- **Migrations:** Flyway, auto‑applied on startup. H2 in‑memory for dev; PostgreSQL for staging/prod.
- **Seed Data:** `DataInitializer` runs in `dev` profile, creates demo teacher, student, parent, guardian link, lesson, and quiz.

## AI Pipeline (Core IP)
Teacher Document (PDF/DOCX/TXT)
↓
Text Extraction (PDFBox / Apache POI)
↓
Stage 1: Learner profile build (SNE type → cognitive parameters)
↓
Stage 2: Content simplification (Groq/OpenAI – profile‑adapted)
↓
Stage 3: Verification (readability, accuracy check)
↓
Stage 4: Concept extraction (key terms, objectives)
↓
Quiz generation (5 adaptive questions)
↓
Stored as structured JSON in content.simplified_text

text

## Deployment Architecture

### Development
- **Backend:** `./gradlew bootRun` (port 9090, H2)
- **Frontend:** `npm run dev` (port 3000)
- **AI Service:** Optional; mock AI used if not running.

### Docker
- `docker compose up -d` starts PostgreSQL, Redis, backend, AI service, frontend, and Nginx.
- Nginx acts as reverse proxy with SSL termination and WebSocket support.

### Production
- **Frontend:** Vercel (Next.js build → static + serverless)
- **Backend:** Render Web Service or Railway (Java 21, `java -jar`)
- **AI Service:** Railway (Python, uvicorn)
- **Database:** Managed PostgreSQL (Supabase/Railway/AWS RDS)

## Key Packages

- **Backend:** Spring Boot 3.2, Spring Security, Hibernate, Flyway, JWT (jjwt), Bucket4j, PDFBox, Apache POI, OpenCSV
- **AI Service:** FastAPI, Groq SDK, OpenAI, Anthropic, Loguru
- **Frontend:** Next.js 15, Tailwind CSS, next-pwa, TypeScript, Axios

## Current Limitations & Future

| Area | Current | Future |
|------|---------|--------|
| Notifications | Service skeleton; in‑app only | SMS/WhatsApp (Africa's Talking) |
| Analytics | WIP module (needs package fix) | Full dashboards |
| CBT Exams | Not started | KNEC‑compatible exam module |
| Payments | Stub only | M‑Pesa integration |
| Multi‑language | AI prompts ready | Kiswahili, French, Amharic |
| Offline AI | Cloud‑dependent | Edge‑deployed models |

---

*Last updated: July 2026. Maintained by AD Group Africa.*