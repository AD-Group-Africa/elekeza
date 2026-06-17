# Architecture

Elekeza is a monorepo containing:
- **Frontend:** Next.js 15 with App Router, Tailwind CSS, next-pwa for offline support.
- **Backend:** Spring Boot with Kotlin, PostgreSQL, JWT auth, and Flyway migrations.
- **AI Service:** FastAPI with Groq/OpenAI/Anthropic providers and a 4‑stage simplification pipeline.

## Service Communication
- Frontend → Backend (REST API)
- Backend → AI Service (internal HTTP with HMAC)
- All services containerised via Docker Compose (see `docker-compose.yml`)

## Database
PostgreSQL with Flyway migrations located in `backend/src/main/resources/db/migration`.
