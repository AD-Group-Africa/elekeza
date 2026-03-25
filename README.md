# Elewa — Backend Monorepo

AI-powered document simplification and accessible learning platform for low-literacy users in Kenya and East Africa.

## Repo Structure

```
elewa/
├── docker-compose.yml       # Spins up all services
├── .env.example             # Copy this to .env and fill in your values
├── .gitignore
├── README.md
├── backend/                 # Spring Boot 3.2.4 — Harrison
└── accessible-docs/         # FastAPI AI engine — Alvin
```

## Services

| Service         | Port | Description                              |
|-----------------|------|------------------------------------------|
| backend         | 8080 | Spring Boot REST API + JWT auth          |
| accessible-docs | 8000 | FastAPI — OCR, simplification, RAG Q&A   |
| postgres        | 5432 | PostgreSQL 16 database                   |

---

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A Groq API key — free tier at [console.groq.com](https://console.groq.com)

### 1. Clone the repo
```bash
git clone https://github.com/thrillerpark/elewa.git
cd elewa
```

### 2. Set up your environment
```bash
cp .env.example .env
```
Open `.env` and fill in:
- `DB_PASSWORD` — any password you want for local Postgres
- `SECURITY_JWT_SECRET` — any random string, minimum 32 characters
- `GROQ_API_KEY` — your Groq API key

### 3. Start all services
```bash
docker-compose up --build
```

First run will take 5–10 minutes — Docker pulls images and the AI service downloads the embedding model (~400MB, cached after first run).

### 4. Verify everything is running

| Check | URL |
|-------|-----|
| Spring Boot health | http://localhost:8080/actuator/health |
| FastAPI Swagger UI | http://localhost:8000/docs |

---

## Development Workflow

### Running only one service locally
If you're working on the backend and don't need the AI service:
```bash
docker-compose up postgres
```
Then run Spring Boot from IntelliJ with the `local` profile as usual.

### Rebuilding after code changes
```bash
docker-compose up --build backend
```

### Viewing logs
```bash
docker-compose logs -f backend
docker-compose logs -f accessible-docs
```

### Stopping everything
```bash
docker-compose down
```
To also delete the database volume (full reset):
```bash
docker-compose down -v
```

---

## Environment Variables Reference

See `.env.example` for all required variables with descriptions. Never commit your `.env` file.

---

## Team

| Name     | Role               | Service          |
|----------|--------------------|------------------|
| Harrison | Backend Lead       | Spring Boot API  |
| Alvin    | AI/ML              | FastAPI engine   |