# Elekeza – AI-Powered Inclusive Learning Platform

**Elekeza** *(meaning "to understand" in Swahili)* is an AI-powered, accessibility-first learning platform designed for the Kenyan CBC curriculum. Built for learners with Special Educational Needs (SNE) and mainstream education.

**Status:** Pilot-ready. Institution module, CSV import, teacher dashboards, bulk assignment, parent portal, accessibility suite, and offline PWA all working.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start (Local Dev)](#quick-start-local-dev)
- [Demo Accounts](#demo-accounts)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [API Summary](#api-summary)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [License](#license)
- [Team](#team)
- [Acknowledgments](#acknowledgments)

---

## Features

- **AI Content Simplification** – Upload PDF/DOCX/TXT; AI adapts for Dyslexia, ADHD, Autism, Intellectual Disability
- **Accessibility-First Design** – 40+ toggles: OpenDyslexic font, TTS, line spacing, focus mode, contrast control
- **Role-Based Dashboards** – Teacher (student management, bulk assignment), Student (lessons, progress), Parent (ward progress)
- **Adaptive Quiz Engine** – Auto-generates questions, tracks progress per student
- **Offline-First PWA** – Installable; lessons + quizzes cached; IndexedDB sync queue for offline answers
- **Institution Management** – Register schools, CSV bulk import with automatic guardian linking
- **Parent Engagement** – Guardian portal, progress tracking, notification hooks ready for SMS/WhatsApp
- **Multi-School Ready** – Institution-scoped teacher views, class/grade grouping
- **M‑Pesa Payments** – Payment integration for premium features (infrastructure ready)
- **SMS Notifications** – Via Africa's Talking API (integration hooks in place)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS, Capacitor, next-pwa |
| **Backend** | Spring Boot 3.2, Kotlin, JWT auth (HTTP-only cookies) |
| **AI Service** | FastAPI, Groq/OpenAI/Anthropic/Google LLMs |
| **Database** | PostgreSQL 16 (production), H2 (development) |
| **Migrations** | Flyway |
| **Cache/Queue** | Redis (optional) |
| **Deployment** | Docker, Fly.io (backend), Netlify (frontend) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Frontend (Port 3000)                │
│        PWA - installable, offline-capable, mobile-first         │
└────────────────────────────┬──────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│          Spring Boot Backend (Port 9090) – Kotlin               │
│  ├── Auth (JWT + HTTP-only cookies)                            │
│  ├── Institution Management (school registration, CSV import) │
│  ├── Content Pipeline (upload → AI simplification)             │
│  ├── Quiz Engine (generation, progress tracking)               │
│  ├── Learner Profiles & Progress Tracking                      │
│  ├── Teacher Dashboard (institution-scoped)                    │
│  ├── Guardian Portal (ward linking, progress)                  │
│  └── Notification Service (SMS/email hooks)                    │
└────┬──────────────────────┬──────────────────────┬─────────────┘
     │                      │                      │
     │ X-Internal-Key       │ SQL                  │ (optional)
     │ (internal secret)    │                      │
     ▼                      ▼                      ▼
┌──────────────────┐  ┌─────────────────┐  ┌─────────────┐
│ FastAPI AI       │  │ PostgreSQL 16   │  │ Redis Cache │
│ Service          │  │ (Flyway migr.)  │  │             │
│ (Port 8000)      │  │ H2 (dev)        │  └─────────────┘
│                  │  │                 │
│ 4-Stage Pipeline:│  └─────────────────┘
│ 1. Profile build │
│ 2. Simplify      │
│ 3. Verify        │
│ 4. Extract terms │
└──────────────────┘
```

---

## Quick Start (Local Dev)

### Prerequisites
- **Java 21**
- **Node.js 18+** with npm
- **Python 3.13** (for AI service)
- **Docker Desktop** (for PostgreSQL, Redis, Langfuse)
- **Groq API Key** (free at [console.groq.com](https://console.groq.com))

### 1. Backend (Spring Boot)

```bash
cd backend

# Start only the database via Docker
cd ..
docker compose up postgres -d
cd backend

# Run backend (uses H2 in dev by default, or Postgres if you configure it)
./gradlew bootRun --args='--spring.profiles.active=dev'

# Backend runs on http://localhost:9090
# H2 console: http://localhost:9090/h2-console
# JDBC URL: jdbc:h2:mem:elekeza
```

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev

# Open http://localhost:3000
```

### 3. AI Service (FastAPI)

```bash
cd ai-elewa

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Configure .env (copy from .env.example and add your Groq API key)
cp .env.example .env

# Start Langfuse (for observability) and Postgres
docker compose up langfuse postgres -d

# Start the service
uvicorn main:app --reload --port 8000

# Verify: http://localhost:8000/health
# Swagger UI: http://localhost:8000/docs
```

### 4. Full Stack (Docker Compose)

```bash
# From root directory
docker compose up -d

# Services running:
# - postgres: localhost:5432
# - redis: localhost:6379
# - backend: localhost:9090
# - frontend: localhost:3000
# - ai-service: localhost:8000
# - nginx: localhost:80
```

---

## Demo Accounts

Pre-seeded in the `dev` profile (DataInitializer) and by the `V2__seed_demo.sql` Flyway migration for pilot databases.

| Role | Email | Password |
|------|-------|----------|
| **Teacher** | teacher@elekeza.app | teacher123 |
| **Student** | student@elekeza.app | student123 |
| **Guardian** | parent@elekeza.app | parent123 |
| **School Admin** | admin@elekeza.app | admin123 |
| **Super Admin** | superadmin@elekeza.app | superadmin123 |

> Demo credentials are for pilot/testing only — never use them in a public production launch. Public registration always creates a `STUDENT` account; school admins are created through the institution registration flow, and the platform `ADMIN` (super admin) role is assigned operationally, never through self-registration.

## Pilot Data Seed

After deploying, create the pilot cohort with [seed-pilot.ps1](seed-pilot.ps1). It requires a teacher account already attached to the pilot institution, then creates five varied-SNE learners, assigns the Water Cycle lesson, completes its quiz, links a guardian, and creates a school-admin account.

```powershell
.\seed-pilot.ps1 `
  -ApiBaseUrl https://your-api.fly.dev `
  -TeacherEmail teacher@your-school.example `
  -TeacherPassword '<teacher-password>' `
  -LessonId 1
```

---

## Environment Variables

### Critical (Backend)

```env
# JWT & Security
JWT_SECRET=<32+ char random string>
JWT_EXPIRATION_HOURS=24

# Database (Production – H2 used in dev)
DB_URL=jdbc:postgresql://localhost:5432/elekeza
DB_USER=postgres
DB_PASSWORD=<password>

# AI Service
AI_SERVICE_URL=http://localhost:8000
AI_INTERNAL_SECRET=<same value as INTERNAL_SECRET in ai-elewa>
```

| Variable | Required | Purpose | Example / safe default |
|---|---:|---|---|
| `SPRING_PROFILES_ACTIVE` | Yes | Enables the production profile | `prod` |
| `DB_URL` | Yes | PostgreSQL JDBC connection URL | `jdbc:postgresql://host:5432/elekeza` |
| `DB_USER` / `DB_PASSWORD` | Yes | PostgreSQL credentials | Platform-provided credentials |
| `JWT_SECRET` | Yes | 32+ character JWT signing secret | Random secret, never committed |
| `AI_SERVICE_URL` | Yes | Deployed FastAPI AI-service URL | `https://elekeza-ai.onrender.com` |
| `AI_INTERNAL_SECRET` | Yes | Shared backend/AI request secret | Random secret matching the AI service |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | Yes for first deploy | Schema mode for a fresh database | `update`, then consider `validate` |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated allowed frontend origins | `https://your-site.netlify.app` |
| `FRONTEND_URL` | Yes | Public frontend origin for links/cookies | `https://your-site.netlify.app` |
| `SECURE_COOKIES` | Yes | Send refresh cookies only over HTTPS | `true` |
| `MPESA_CALLBACK_URL` | If payments enabled | Public Daraja callback endpoint | `https://your-api.fly.dev/api/payments/callback` |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE` | If payments enabled | Safaricom Daraja credentials | Production secrets |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` | If email enabled (`EMAIL_PROVIDER=javamail`) | SMTP delivery | Provider credentials |
| `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_SENDER_ID` | If SMS enabled (`SMS_PROVIDER=africa_talking`) | Africa's Talking notifications | Provider credentials |
| `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | If R2 uploads enabled (`STORAGE_PROVIDER=cloudflare_r2`) | Cloudflare R2 object storage | Provider credentials |

Start production explicitly with `SPRING_PROFILES_ACTIVE=prod`. The production profile reads only environment-backed secrets; keep them in Fly.io/Netlify secret stores rather than repository files.

### Critical (AI Service)

```env
AI_PROVIDER=groq
AI_API_KEY=<your Groq API key>
INTERNAL_SECRET=<same value as AI_INTERNAL_SECRET in backend>
LANGFUSE_PUBLIC_KEY=<from Langfuse settings>
LANGFUSE_SECRET_KEY=<from Langfuse settings>
LANGFUSE_HOST=http://localhost:3000
```

### Optional

```env
# M‑Pesa (Safaricom)
MPESA_API_URL=<Safaricom sandbox/production URL>
MPESA_CONSUMER_KEY=<Safaricom API consumer key>
MPESA_CONSUMER_SECRET=<Safaricom API consumer secret>

# SMS (Africa's Talking) — used when SMS_PROVIDER=africa_talking
AFRICA_TALKING_API_KEY=<Africa's Talking API key>
AFRICA_TALKING_SENDER_ID=Elekeza

# Object storage — used when STORAGE_PROVIDER=cloudflare_r2
CLOUDFLARE_R2_ACCOUNT_ID=<account id>
CLOUDFLARE_R2_BUCKET_NAME=elekeza-uploads
CLOUDFLARE_R2_ACCESS_KEY_ID=<access key id>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<secret access key>

# Email
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=<email>
MAIL_PASSWORD=<app password>
```

---

## Deployment

### Backend (Fly.io)

```bash
# Install Fly CLI: https://fly.io/docs/getting-started/installing-flyctl/

flyctl auth login
flyctl launch --dockerfile backend/Dockerfile

# Deploy
flyctl deploy
```

Set the backend secrets before the first deployment:

```bash
flyctl secrets set SPRING_PROFILES_ACTIVE=prod DB_URL=... DB_USER=... DB_PASSWORD=... JWT_SECRET=... AI_SERVICE_URL=... AI_INTERNAL_SECRET=... CORS_ALLOWED_ORIGINS=https://your-site.netlify.app FRONTEND_URL=https://your-site.netlify.app
```

Schema is owned by Flyway (baseline `V1__baseline_schema.sql` + `V2__seed_demo.sql`);
`ddl-auto` defaults to `validate` in production — never `update`.

See [Fly.io Docs](https://fly.io/docs/) and the production runbooks:
[`docs/PRODUCTION.md`](docs/PRODUCTION.md) · [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`docs/SMOKE-TEST.md`](docs/SMOKE-TEST.md).

### Frontend (Netlify)

```bash
# Connect your repo at https://app.netlify.com
# Netlify auto-detects Next.js

# Build command: npm run build
# Publish directory: frontend/.next
# Environment: add NEXT_PUBLIC_API_URL=<your backend URL>/api
```

See [Netlify Docs](https://docs.netlify.com/) for full guidance.

### Database (Supabase or Railway)

```bash
# Create PostgreSQL instance
# Run migrations (Flyway auto-runs on backend startup)
# Update DB_URL in backend environment
```

---

## API Summary

All endpoints require a valid JWT token (set as `elewa_access` cookie) except `/api/auth/*`.

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, returns JWT + HttpOnly cookie |
| POST | `/api/auth/refresh` | No | Refresh token |
| GET | `/api/auth/me` | Bearer | Current user info |

### Institution Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/institutions/register` | No | Register school |
| POST | `/api/institutions/{id}/students/import` | SCHOOL_ADMIN | CSV bulk import |
| GET | `/api/institutions/{id}/students` | SCHOOL_ADMIN | List students |

### Content & Lessons

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/content/upload/file` | Bearer | Upload document (PDF/DOCX/TXT) |
| GET | `/api/content/lessons/{id}` | Bearer | Read AI-simplified lesson |
| PATCH | `/api/content/lessons/{id}/sections/{sectionId}/progress` | Bearer | Update time spent |
| POST | `/api/content/lessons/{id}/term-tap` | Bearer | Record key term interaction |

### Quiz Engine

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/quiz/{lessonId}/start` | Bearer | Start quiz (returns questions, never the answer key) |
| POST | `/api/quiz/{quizId}/answer` | Bearer | Submit answer — server-side graded, per-question answer persisted |
| POST | `/api/quiz/{quizId}/complete` | Bearer | Finalize, get score + post-quiz feedback |
| GET | `/api/quiz/{quizId}/review` | Bearer | Post-completion review (own completed attempt only) |

### Teacher & Guardian

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/teacher/students` | TEACHER | Teacher's institution students |
| POST | `/api/teacher/content/assign` | TEACHER | Bulk assign lesson |
| GET | `/api/guardian/wards` | GUARDIAN | View linked children |
| GET | `/api/guardian/wards/{id}` | GUARDIAN | Ward detail (progress, recent quizzes) — linked ward only |
| GET | `/api/guardian/reports` | GUARDIAN | Per-ward progress reports |
| GET | `/api/guardian/schedule` | GUARDIAN | Wards' pending assigned lessons |

### Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/progress/dashboard` | Bearer | Learner progress dashboard |
| GET | `/api/analytics/teacher/quiz-results` | TEACHER | Per-question quiz results for the teacher's students (completed attempts only) |

---

## Project Structure

```
elekeza/
│
├── frontend/                        # Next.js 16 PWA
│   ├── src/app/
│   │   ├── login/                  # JWT login with cookie support
│   │   ├── student-home/           # Learner dashboard
│   │   ├── lesson/[id]/            # AI‑simplified lesson with TTS
│   │   ├── quiz/[id]/              # Adaptive quiz engine
│   │   ├── teacher/                # Teacher dashboard (institution‑scoped)
│   │   ├── guardian/               # Parent portal (ward progress)
│   │   ├── school/onboarding/      # School registration form
│   │   ├── school/import/          # CSV student import
│   │   ├── components/             # Reusable UI components
│   │   └── api/                    # API routes (optional)
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── capacitor.config.ts         # Capacitor for mobile
│   └── Dockerfile
│
├── backend/                         # Spring Boot 3.2 (Kotlin)
│   ├── src/main/kotlin/com/elekeza/backend/
│   │   ├── auth/                   # JWT, User, SecurityConfig, Filters
│   │   ├── config/                 # AppConfig, DataInitializer (seed)
│   │   ├── content/                # Document upload, AI pipeline, lessons
│   │   ├── quiz/                   # Quiz generation, answering, progress
│   │   ├── learner/                # Learner profiles, progress tracking
│   │   ├── teacher/                # Teacher controller (institution‑scoped)
│   │   ├── guardian/               # Guardian controller (ward linking)
│   │   ├── institution/            # School registration, CSV import, student mgmt
│   │   ├── payments/               # M‑Pesa stkPush + callback integration
│   │   ├── notification/           # Notification service (SMS/email hooks)
│   │   └── common/                 # Utilities, error handling, interceptors
│   ├── src/main/resources/
│   │   ├── db/migration/           # Flyway migrations (V1 baseline … V5 raw text)
│   │   ├── application.yaml        # Spring config
│   │   └── h2-schema.sql           # H2 schema (dev)
│   ├── build.gradle.kts
│   ├── Dockerfile
│   └── README.md
│
├── ai-elewa/                        # FastAPI AI Service
│   ├── main.py                     # FastAPI app
│   ├── config.py                   # Provider selection
│   ├── pipeline/
│   │   ├── stage1_profile.py       # Build system prompt
│   │   ├── stage2_simplify.py      # AI simplification
│   │   ├── stage3_verify.py        # Verification pass
│   │   └── stage4_concepts.py      # Concept extraction
│   ├── endpoints/
│   │   ├── simplify.py             # /ai/simplify/* endpoints
│   │   └── quiz.py                 # /ai/quiz/* endpoints
│   ├── prompts/
│   │   ├── dyslexia.txt            # Profile templates
│   │   ├── adhd.txt
│   │   ├── autism.txt
│   │   ├── intellectual_disability.txt
│   │   └── COMORBID_RULES.md
│   ├── models/
│   │   ├── requests.py             # Pydantic schemas
│   │   ├── responses.py            # Response models
│   │   └── errors.py               # Error handling
│   ├── tests/                      # Unit & integration tests
│   ├── tools/                      # Performance audit, prompt review
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── README.md
│
├── infrastructure/                  # DevOps
│   ├── nginx.conf                  # Nginx reverse proxy config
│   └── docker-compose.yml          # Full stack orchestration
│
├── docs/                           # Documentation
│   ├── ARCHITECTURE.md             # System design
│   └── CONTRIBUTING.md             # Contribution guidelines
│
├── docker-compose.yml              # Root compose file
├── .env.example                    # Environment template
├── .gitignore
├── README.md                       # This file
└── LICENSE
```

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Week 1** | Institution module, CSV import, teacher dashboards, bulk assignment | ✅ Done |
| **Week 2** | Parent notifications (SMS/WhatsApp), weekly digest, email integration | 🔲 Next |
| **Week 3** | Documentation package (API docs, user guides, pitch deck), unit + E2E tests | 🔲 Planned |
| **Week 4** | CI/CD pipeline, error monitoring (Sentry), load testing | 🔲 Planned |
| **Pilot** | 3–5 schools, investor demos, feedback loop | 🔲 Planned |
| **Post-Pilot** | Therapist portal, WhatsApp integration, SMS notifications, analytics dashboard | 🔲 Roadmap |

---

## License

**Proprietary** – AD Group Africa. All rights reserved.

For licensing inquiries, contact the team.

---

## Team

| Role | Name         | Owns |
|------|--------------|------|
| **Backend & Architecture** | Harrison Muturi| Spring Boot, PostgreSQL, REST APIs, JWT auth, DevOps, security |
| **Frontend & Accessibility** | Victor Mwaura| Next.js, Tailwind CSS, accessibility suite, mobile UI, PWA |
| **AI & Pipeline** | Alvin Muchiri| FastAPI, LLM providers, prompt engineering, 4-stage pipeline |

---

## Acknowledgments

Elekeza is built on the contributions and support of:

- **Mizizi** – Learner research & impact validation
- **KISE** (Kenya Institute of Special Education) – Curriculum & accessibility guidance
- **AT4D** (Africa's Talking) – SMS/WhatsApp infrastructure
- **Google AI Studio** – Free LLM access during development
- **Groq** – High-speed LLM inference
- **Safaricom & M‑Pesa** – Payment infrastructure in Kenya
- **Capacitor & Ionic** – Mobile app framework

---

## Getting Help

- **Backend issues?** See [`backend/README.md`](backend/README.md)
- **Frontend issues?** See [`frontend/README.md`](frontend/README.md)
- **AI service issues?** See [`ai-elewa/README.md`](ai-elewa/README.md)
- **Architecture questions?** See [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

**Made with ❤️ by AD Group Africa**

*Learn deeply. Understand fully.*
