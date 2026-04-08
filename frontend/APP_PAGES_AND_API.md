# ELEKEZA Frontend Pages + API Reference

This guide shows:
- all frontend pages/routes
- the API endpoints they call
- example request payloads
- quick curl examples

## Base URLs

- Frontend app: `http://localhost:3000`
- Backend app: `http://localhost:8080`
- Frontend calls API via rewrite proxy as `/api/...` (configured in `frontend/next.config.ts`)

## Frontend Pages

| Page | Route | Auth | Notes |
|---|---|---|---|
| Home redirect | `/` | No | Redirects to dashboard if logged in, else login |
| Register | `/register` | No | Creates learner account |
| Login | `/login` | No | Signs in learner |
| Upload | `/upload` | Yes | Uploads text for lesson generation |
| Dashboard | `/dashboard` | Yes | Shows progress overview |
| History | `/dashboard/history` | Yes | Document history view |
| Settings | `/dashboard/settings` | Yes | User accessibility/preferences |
| Onboarding Profile | `/onboarding/profile` | Yes | Saves language, age group, goal |
| Onboarding Placement | `/onboarding/placement` | Yes | Saves placement score |
| Onboarding Complete | `/onboarding/complete` | Yes | Marks onboarding complete |
| Lesson | `/lesson/[id]` | Yes | Lesson details and sections |
| Quiz | `/quiz/[lessonId]` | Yes | Start/answer/complete quiz |
| Document | `/document/[id]` | Yes | Document details page |

## API Endpoints Used by Frontend

All calls below are made from `frontend/src/lib/api.ts`.

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Register payload:

```json
{
  "email": "user@ELEKEZA.com",
  "password": "YourPassword123!",
  "fullName": "Jane Doe"
}
```

Login payload:

```json
{
  "email": "user@ELEKEZA.com",
  "password": "YourPassword123!"
}
```

### Onboarding

- `POST /api/onboarding/profile`
- `POST /api/onboarding/placement`
- `POST /api/onboarding/complete`
- `POST /api/onboarding/guardian-link`

Profile payload:

```json
{
  "preferredLanguage": "en",
  "ageGroup": "TEEN",
  "learningGoal": "Improve reading comprehension"
}
```

Placement payload:

```json
{
  "score": 7,
  "totalQuestions": 10
}
```

Guardian Link payload:

```json
{
  "fullName": "Jane Doe",
  "relationship": "parent",
  "phone": "+254712345678",
  "email": "parent@ELEKEZA.com"
}
```

### Content

- `POST /api/content/upload/text`
- `GET /api/content/lessons/{lessonId}`
- `PATCH /api/content/lessons/{lessonId}/sections/{sectionId}/progress`
- `POST /api/content/lessons/{lessonId}/term-tap`

Upload Text payload:

```json
{
  "text": "Your lesson text here...",
  "subject": "Biology"
}
```

Progress payload:

```json
{
  "additionalSeconds": 120
}
```

Term tap payload:

```json
{
  "termId": "<uuid>"
}
```

### Quiz

- `GET /api/quiz/{lessonId}/start`
- `POST /api/quiz/{quizId}/answer`
- `GET /api/quiz/{quizId}/complete`

Answer payload:

```json
{
  "questionId": "<uuid>",
  "selectedOptionId": "0",
  "latencyMs": 3200
}
```

### Progress

- `GET /api/progress/dashboard`

## Quick curl Examples

Direct backend (Postman/curl style):

```bash
curl -X POST http://localhost:8080/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"user@ELEKEZA.com\",\"password\":\"YourPassword123!\",\"fullName\":\"Jane Doe\"}"
```

From frontend proxy (same origin style):

```bash
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"user@ELEKEZA.com\",\"password\":\"YourPassword123!\"}"
```

## Optional: Add Swagger (Backend Change Required)

If your team approves backend edits, add Swagger/OpenAPI with `springdoc-openapi` in backend.

Typical result:
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`
- Swagger UI: `http://localhost:8080/swagger-ui.html`

I can set this up for you when you give explicit permission to modify the backend folder.
