# Elekeza – Africa's Inclusive Learning Intelligence Platform

A pilot‑ready, multi‑school AI‑powered learning platform for learners with Special Educational Needs (SNE) and mainstream education. Built by **AD Group Africa**.

> **Status:** Week 1 Complete – Institution module, CSV import, teacher dashboards, bulk assignment, parent portal, accessibility suite, and offline PWA.

---

## Quick Start (Local Dev)

### 1. Backend (Spring Boot)
```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=dev'
# Backend runs on http://localhost:9090
# H2 console: http://localhost:9090/h2-console (jdbc:h2:mem:elekeza)
2. Frontend (Next.js)
bash
cd frontend
npm install && npm run dev
# Open http://localhost:3000
3. AI Service (optional – mock AI used in dev)
bash
cd ai-elewa
pip install -r requirements.txt
uvicorn main:app --port 8000
Demo Accounts (dev profile – auto‑seeded)
Role	Email	Password
Teacher	teacher@elekeza.app	teacher123
Student	student@elekeza.app	student123
Parent	parent@elekeza.app	parent123
Project Structure
text
elekeza/
├── frontend/            # Next.js 15 PWA (App Router, Tailwind, next-pwa)
│   └── src/app/
│       ├── login/       # JWT login with cookie support
│       ├── student-home/# Learner dashboard
│       ├── lesson/[id]/ # AI‑simplified lesson with TTS
│       ├── quiz/[id]/   # Adaptive quiz engine
│       ├── teacher/     # Teacher dashboard (institution‑scoped)
│       ├── guardian/    # Parent portal (ward progress)
│       ├── school/onboarding/ # School registration form
│       ├── school/import/     # CSV student import with password display
│       └── components/  # Reusable UI (SidebarLayout, etc.)
│
├── backend/             # Spring Boot 3.2 (Kotlin)
│   └── src/main/kotlin/com/elekeza/backend/
│       ├── auth/        # JWT, User, SecurityConfig, JwtAuthFilter
│       ├── config/      # AppConfig, DataInitializer (seed data)
│       ├── content/     # Document upload, AI pipeline, lessons
│       ├── quiz/        # Quiz generation, answering, progress
│       ├── learner/     # Learner profiles, progress tracking
│       ├── teacher/     # Teacher controller (institution‑scoped)
│       ├── guardian/    # Guardian controller (ward linking)
│       ├── institution/ # School registration, CSV import, student mgmt
│       └── notification/# Notification service (stub)
│   └── src/main/resources/db/migration/  # Flyway V1–V24
│
├── ai-elewa/            # FastAPI AI service (Groq/OpenAI/Anthropic)
│   └── pipeline/        # 4‑stage content simplification + quiz gen
│
├── infrastructure/      # Nginx config, Docker Compose
├── docs/                # Architecture, master blueprint, user guides
└── README.md
Key Features (All Working)
AI Content Simplification – Upload PDF/DOCX/TXT; AI adapts for Dyslexia, ADHD, Autism, Intellectual Disability.

Adaptive Quiz Engine – Auto‑generates questions, tracks progress per student.

Institution Management – Register schools, CSV bulk import with guardian auto‑linking.

Role‑Based Dashboards – Teacher (student management, bulk assignment), Student (lessons, progress), Parent (ward progress).

Accessibility Suite – 40+ toggles (OpenDyslexic font, TTS, line spacing, focus mode, contrast).

Offline‑First PWA – Installable; lesson + quiz cached; IndexedDB sync queue for answers.

Parent Engagement – Guardian portal, progress tracking, notification hooks (SMS/email ready).

Multi‑School Ready – Institution‑scoped teacher views, class/grade grouping (schema ready).

School Onboarding Flow
School admin registers via /school/onboarding or POST /api/institutions/register

Uploads CSV of students at /school/import (first name, last name, grade, SNE type, guardian phone/email)

Students created with temp passwords; guardians auto‑linked

Teacher uploads lessons, assigns to students

Students log in, read AI‑simplified content, take quizzes

Parents receive progress reports (SMS/email integration coming Week 2)

API Summary (Public Endpoints)
Method	Endpoint	Auth	Description
POST	/api/auth/register	None	Register user
POST	/api/auth/login	None	Login, returns JWT + HttpOnly cookie
POST	/api/auth/refresh	Cookie	Refresh token
GET	/api/auth/me	Bearer	Current user info
POST	/api/institutions/register	None	Register school
POST	/api/institutions/{id}/students/import	SCHOOL_ADMIN	CSV import
GET	/api/institutions/{id}/students	SCHOOL_ADMIN	List students
GET	/api/teacher/students	TEACHER	Teacher's institution students
POST	/api/teacher/content/assign	TEACHER	Bulk assign lesson
POST	/api/content/upload/file	Bearer	Upload document
GET	/api/content/lessons/{id}	Bearer	Read lesson
GET	/api/quiz/{lessonId}/start	Bearer	Start quiz
POST	/api/quiz/{quizId}/answer	Bearer	Submit answer
POST	/api/quiz/{quizId}/complete	Bearer	Finish quiz, save progress
GET	/api/guardian/wards	GUARDIAN	View linked children
Deployment
Docker Compose (full stack)
bash
docker compose up -d
# Services: postgres, redis, backend:9090, ai-service:8000, frontend:3000, nginx:80/443
Production (Render + Vercel)
Backend: Render Web Service (Java 21, java -jar build/libs/elekeza-0.0.1-SNAPSHOT.jar)

Frontend: Vercel (Next.js, root directory frontend, build: npm run build)

Database: Supabase / Railway PostgreSQL

AI Service: Railway (Python, uvicorn)

Required environment variables: JWT_SECRET, AI_SERVICE_URL, AI_INTERNAL_SECRET, DB_URL, DB_USER, DB_PASSWORD, GROQ_API_KEY (for real AI).

Roadmap
Week	Focus	Status
1	Institution module, CSV import, teacher dashboards, bulk assignment	✅ Done
2	Parent notifications (SMS/WhatsApp), notification service, weekly digest	🔲 Next
3	Documentation package (guides, API docs, pitch deck), unit + E2E tests	🔲 Planned
4	CI/CD, error monitoring, load testing, production deployment	🔲 Planned
5	Pilot launch (3–5 schools), investor demos	🔲 Planned
Full documentation: see docs/ELEKEZA_COMPLETE_DOCS.md for the complete startup blueprint.

Team (AD Group Africa)
Harrison – Backend, Content Pipeline, Quiz Engine, CTO, Architecture, DevOps, Security

Victor – Frontend, UI/UX, Accessibility

Alvin – AI Service, Pipeline, Model Selection

License
AProprietary – AD Group Africa. All rights reserved.