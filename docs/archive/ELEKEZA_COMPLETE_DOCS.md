# ELEKEZA — COMPLETE ENGINEERING & STARTUP DOCUMENTATION
**Organisation:** Afrika Digitalis Group
**Product:** Elekeza — Africa's Inclusive Learning Intelligence Platform
**Version:** Pilot-Ready | July 2026

---

## QUICK START (local dev, 2 commands)

```bash
# Terminal 1 — Backend (H2 in-memory DB, mock AI, demo data auto-seeded)
cd backend
./gradlew bootRun --args='--spring.profiles.active=dev'
# → http://localhost:9090  |  H2 console: /h2-console

# Terminal 2 — Frontend
cd frontend
npm install && npm run dev
# → http://localhost:3000
```

**Demo accounts (seeded by DataInitializer on dev profile)**

| Role | Email | Password |
|---|---|---|
| Teacher | teacher@elekeza.app | teacher123 |
| Student | student@elekeza.app | student123 |
| Parent  | parent@elekeza.app  | parent123  |

---

## FULL STACK (Docker Compose)

```bash
cp .env.example .env          # edit with real values
docker compose up -d
curl http://localhost/actuator/health  # → {"status":"UP"}
```

---

## ENVIRONMENT VARIABLES

### Required for all environments

```bash
# Database
DB_URL=jdbc:postgresql://postgres:5432/elekeza
DB_USER=elekeza
DB_PASSWORD=strong-password-here

# JWT (minimum 64 characters — use: openssl rand -base64 64)
JWT_SECRET=your-64-char-minimum-secret-here

# AI Service
AI_SERVICE_URL=http://ai-service:8000
AI_INTERNAL_SECRET=shared-hmac-secret-backend-and-ai
AI_CLIENT_TYPE=real            # real | mock (mock for dev)

# AI Provider (pick one)
AI_API_KEY=REDACTED...             # Groq key (recommended — fast + cheap)
AI_PROVIDER=groq               # groq | openai | anthropic | google

# CORS
CORS_ALLOWED_ORIGINS=https://your-domain.com
FRONTEND_URL=https://your-domain.com
```

### Optional (disable if not using)

```bash
# Google OAuth (leave blank to disable)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email notifications
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=noreply@yourdomain.com
MAIL_PASSWORD=app-password

# Redis (optional — for rate limiting)
REDIS_HOST=redis
REDIS_PASSWORD=redis-password

# File storage (optional — default: local disk)
R2_ENDPOINT=https://account.r2.cloudflarestorage.com
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=elekeza-uploads

# Monitoring
SENTRY_DSN_BACKEND=https://...
SENTRY_DSN_AI=https://...
LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
```

---

## ARCHITECTURE

```
Browser / Mobile PWA (Next.js 15 — Vercel)
        ↓  /api/* proxy
Nginx (TLS termination — :443)
        ↓
Spring Boot 3.2 Kotlin (Render / Railway — :8080)
  ├─ auth/          JWT, roles, refresh tokens
  ├─ institution/   School registration, CSV import
  ├─ content/       File upload, PDF/DOCX extraction
  ├─ quiz/          Adaptive quiz engine
  ├─ teacher/       Student management, assignment
  ├─ guardian/      Parent portal, ward progress
  ├─ notification/  In-app alerts, guardian notices
  ├─ analytics/     School and platform dashboards
  └─ common/ai/     AiClient → FastAPI bridge
        ↓  X-Internal-Key HMAC
FastAPI Python AI Service (Railway — :8000)
  ├─ /ai/simplify/text     — profile-adapted lesson
  ├─ /ai/quiz/generate     — quiz question generation
  ├─ /ai/quiz/adaptive-response  — correct answer coaching
  └─ /ai/quiz/wrong-answer-flow  — remediation + reattempt
        ↓
PostgreSQL 16 (Supabase / Railway)   Redis 7 (Railway)
```

---

## DATABASE MIGRATIONS

Flyway manages all migrations. Files live in:
`backend/src/main/resources/db/migration/`

| Version | Description |
|---|---|
| V1–V9 | Core schema: users, learners, lessons, quizzes, auth |
| V10–V13 | Content, payments, audit logs, adaptive UI state |
| V14 | Quiz attempt tables (BigInt model) |
| V15 | Seed test accounts |
| V16 | Performance indexes |
| V17–V22 | Placeholder gaps |
| V23 | Demo seed data |
| V24 | Lesson plans, content bridge FK |
| V25 | Multi-school: institution_id on users, notifications, import jobs |

**Adding a new migration:**
1. Create `V{N}__description.sql` — never modify existing files
2. Restart backend — Flyway applies automatically
3. For dev profile (H2), Flyway is disabled; JPA `ddl-auto=update` handles schema

---

## API REFERENCE

### Authentication (public)
| Method | Endpoint | Body |
|---|---|---|
| POST | /api/auth/register | `{name, email, password}` |
| POST | /api/auth/login | `{email, password}` |
| POST | /api/auth/refresh | (cookie) |
| GET  | /api/auth/me | — |
| POST | /api/auth/logout | — |

### School / Institution (SCHOOL_ADMIN, ADMIN)
| Method | Endpoint | Notes |
|---|---|---|
| POST | /api/institutions/register | **Public** — any school can self-register |
| POST | /api/institutions/{id}/students/import | CSV bulk import |
| GET  | /api/institutions/{id}/summary | School dashboard stats |
| GET  | /api/institutions/{id}/students | Student list |
| GET  | /api/institutions/{id}/teachers | Teacher list |

### Content (authenticated)
| Method | Endpoint | Notes |
|---|---|---|
| POST | /api/content/upload/text | Raw text → AI → lesson |
| POST | /api/content/upload/file | PDF/DOCX/TXT → AI → lesson |
| GET  | /api/content/lessons/{id} | Lesson with sections + key terms |
| GET  | /api/content/list | Content owned by current user |

### Quiz (authenticated)
| Method | Endpoint | Notes |
|---|---|---|
| GET  | /api/quiz/{lessonId}/start | Creates quiz if none; returns questions |
| POST | /api/quiz/{quizId}/answer | Answer + adaptive AI feedback |
| POST | /api/quiz/{quizId}/complete | Saves progress, notifies guardian |

### Teacher (TEACHER, SCHOOL_ADMIN, ADMIN)
| Method | Endpoint | Notes |
|---|---|---|
| GET  | /api/teacher/students | All students (institution-scoped) |
| POST | /api/teacher/student | Create individual student |
| POST | /api/teacher/content/assign | Assign lesson to student(s) |
| GET  | /api/teacher/student/{id}/progress | Student progress summary |

### Guardian / Parent (GUARDIAN)
| Method | Endpoint | Notes |
|---|---|---|
| GET  | /api/guardian/wards | Children + progress + SNE type |

### Notifications (authenticated)
| Method | Endpoint | Notes |
|---|---|---|
| GET  | /api/notifications | All (max 50) |
| GET  | /api/notifications/unread | Unread only |
| POST | /api/notifications/{id}/read | Mark one read |
| POST | /api/notifications/read-all | Mark all read |

### Analytics (SCHOOL_ADMIN, ADMIN)
| Method | Endpoint | Notes |
|---|---|---|
| GET  | /api/analytics/institution | School-level stats |
| GET  | /api/analytics/platform | Platform-wide (ADMIN only) |

### Progress (authenticated)
| Method | Endpoint | Notes |
|---|---|---|
| GET  | /api/progress/dashboard | Summary stats |
| GET  | /api/progress/lessons | Assigned lessons for learner |

---

## MULTI-SCHOOL ONBOARDING GUIDE

### For a new school (any type — mainstream, SNE, NGO)

1. Visit `/school/onboarding` — 3-step wizard (school details → admin account → confirm)
2. POST `/api/institutions/register` creates institution + SCHOOL_ADMIN user
3. Admin logs in → teacher dashboard → **Import** tab
4. Upload `students.csv` → POST `/api/institutions/{id}/students/import`
5. Teachers upload lesson content → AI processes → assign to students
6. Students log in → read lesson → take quiz → progress saved
7. Parents receive in-app notification → log in to `/parent-portal`

### CSV format

```csv
firstName,lastName,grade,sneType,guardianEmail,guardianPhone,guardianName,guardianRelationship
Amina,Ali,Grade 4,DYSLEXIA,fatuma@example.com,+254712345678,Fatuma Ali,Mother
Juma,Osei,Grade 3,NONE,,,,
Baraka,Kamau,Grade 5,ADHD,james@example.com,+254723456789,James Kamau,Father
```

**sneType options:** DYSLEXIA | ADHD | AUTISM | INTELLECTUAL_DISABILITY | NONE

---

## FEATURE STATUS MATRIX

| Feature | Backend | Frontend | Tests | Notes |
|---|---|---|---|---|
| JWT auth (login/refresh/me/logout) | ✅ | ✅ | ✅ AI | Prod-ready |
| Role-based access (5 roles) | ✅ | ✅ | — | STUDENT/TEACHER/SCHOOL_ADMIN/ADMIN/GUARDIAN |
| School registration | ✅ | ✅ | — | Public endpoint, 3-step UI |
| CSV student import | ✅ | ✅ | — | Guardian auto-created from email |
| Document upload (PDF/DOCX/TXT) | ✅ | ✅ | — | Synchronous AI in v6 |
| AI simplification (mock/real) | ✅ | ✅ | ✅ | Switch via AI_CLIENT_TYPE |
| Adaptive quiz | ✅ | ✅ | ✅ AI | Start/answer/complete all wired |
| Progress tracking | ✅ | ✅ | — | Per student, per lesson |
| Guardian portal | ✅ | ✅ | — | Real ward data, home activities |
| In-app notifications | ✅ | ✅ | — | Quiz complete → parent notified |
| Accessibility (40+ toggles) | — | ✅ | — | TTS, OpenDyslexic, focus mode |
| Offline PWA | — | ✅ | — | Lesson + quiz cached |
| Analytics dashboard | ✅ | Partial | — | Backend done; frontend page needed |
| Lesson planning | Schema ✅ | — | — | V24 tables exist; controller P1 |
| M-Pesa payments | Stub | — | — | P2 — post-pilot |
| CBT exam module | — | — | — | P2 — post-pilot |
| Multi-language (Kiswahili) | AI prompts ✅ | — | — | P2 |

---

## DEPLOYMENT CHECKLIST

### Before pilot demo
- [ ] Rotate Groq API key (old key was committed — check git history)
- [ ] Set `JWT_SECRET` to 64+ random chars
- [ ] Set `AI_INTERNAL_SECRET` — same value in backend and AI service
- [ ] Set `CORS_ALLOWED_ORIGINS` to your Vercel domain
- [ ] Set `AI_CLIENT_TYPE=real` in production environment
- [ ] Test full loop: register school → import students → upload lesson → student reads → parent sees progress
- [ ] Verify nginx `server_name` matches your domain
- [ ] Run `docker compose up -d` and confirm all 6 healthchecks pass

### Vercel (frontend)
- Framework: Next.js
- Root directory: `frontend`
- Build command: `npm run build`
- Environment: `NEXT_PUBLIC_API_URL=https://your-backend.render.com`

### Render (backend)
- Build: `./gradlew bootJar`
- Start: `java -jar build/libs/elekeza-0.0.1-SNAPSHOT.jar`
- Health: `GET /actuator/health`
- Set all environment variables from section above

### Railway (AI service)
- Start: `uvicorn main:app --host 0.0.0.0 --port 8000`
- Set: `AI_API_KEY`, `AI_PROVIDER=groq`, `AI_INTERNAL_KEY`

---

## REMAINING WORK (PRIORITISED)

### P0 — Required before any demo
| Task | File | Time |
|---|---|---|
| Replace files from this package in repo | All files below | 30 min |
| Rotate committed Groq API key | groq.com dashboard | 5 min |
| Deploy to Vercel + Render | CI/CD | 1 hour |

### P1 — Before production launch
| Task | Notes |
|---|---|
| Analytics frontend page | Backend endpoint exists at `/api/analytics/institution` |
| Teacher: assign to class (not individual) | Lesson plan schema ready in V24 |
| Backend unit tests | AuthService, QuizController, InstitutionService |
| Admin dashboard for SCHOOL_ADMIN | Summary stats, teacher management |
| `application-docker.yml` — add `ai.client.type: real` | Missed in current config |

### P2 — Post-pilot
| Task | Notes |
|---|---|
| M-Pesa subscription billing | `Mpesa.kt` stub exists |
| CBT exam module | Question banks, timed sessions, anti-cheat |
| Kiswahili UI | AI service has Kiswahili prompts |
| SMS notifications (Africa's Talking) | For parents without smartphone |
| Government reporting API | County-level aggregated dashboards |
| Offline AI (edge) | For schools with zero connectivity |

---

## TEAM — AFRIKA DIGITALIS

| Person | Role | Owns |
|---|---|---|
| Sir | Founder · CTO · Architect | Architecture, auth, DevOps, strategy |
| Harrison | Backend Engineer | Content pipeline, quiz engine, institution module |
| Victor | Frontend Engineer | UI, accessibility, PWA, responsive layout |
| Alvin | AI Engineer | FastAPI service, pipeline, model selection, Langfuse |

---

*Afrika Digitalis Group — Elekeza Engineering*
*Updated: July 2026*
