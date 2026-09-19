# Elewa — Spring Boot Backend

REST API for the Elewa adaptive literacy platform. Handles authentication, learner onboarding, lesson content, quiz engine, and progress tracking.

> For repo-wide setup (Docker, environment variables, running all services), see the [root README](../README.md).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Kotlin |
| Framework | Spring Boot 3.2.4 |
| Database | PostgreSQL 16 |
| Auth | JWT (HTTP-only cookies) |
| Migrations | Flyway |
| Build | Gradle |

---

## Running Locally (without Docker)

### Prerequisites
- Java 21
- PostgreSQL running on port 5433 (or update `application.yaml`)

### 1. Start only the database via Docker
```bash
cd ..
docker-compose up postgres
```

### 2. Run the backend
```bash
.\gradlew bootRun        # Windows
./gradlew bootRun        # Mac/Linux
```

Server starts on **http://localhost:8080**. Flyway migrations run automatically.

---

## API Endpoints

All endpoints except auth require a valid `elewa_access` cookie, set automatically on login/register.

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register a new learner |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/refresh` | No | Refresh access token via cookie |
| POST | `/api/auth/logout` | Yes | Logout and clear cookies |

**Register request:**
```json
{
  "email": "user@elewa.com",
  "password": "YourPassword123!",
  "fullName": "Jane Doe"
}
```

**Login request:**
```json
{
  "email": "user@elewa.com",
  "password": "YourPassword123!"
}
```

---

### Onboarding — `/api/onboarding`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/onboarding/profile` | Save learner profile |
| POST | `/api/onboarding/placement` | Save placement test result |
| POST | `/api/onboarding/complete` | Mark onboarding as complete |
| POST | `/api/onboarding/guardian-link` | Link a guardian to the learner |

**Profile request:**
```json
{
  "preferredLanguage": "en",
  "ageGroup": "TEEN",
  "learningGoal": "Improve reading comprehension"
}
```
> `ageGroup` values: `CHILD`, `TEEN`, `ADULT`

**Placement request:**
```json
{
  "score": 7,
  "totalQuestions": 10
}
```
> Literacy level is auto-calculated: ≥70% = `ADVANCED`, ≥40% = `INTERMEDIATE`, <40% = `BEGINNER`

**Guardian link request:**
```json
{
  "fullName": "Jane Doe",
  "relationship": "parent",
  "phone": "+254712345678",
  "email": "parent@elewa.com"
}
```
> At least one of `phone` or `email` is required.

---

### Content — `/api/content`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/content/upload/text` | Upload raw text to generate a lesson |
| GET | `/api/content/lessons/{lessonId}` | Get a lesson with sections and key terms |
| PATCH | `/api/content/lessons/{lessonId}/sections/{sectionId}/progress` | Update time spent on a section |
| POST | `/api/content/lessons/{lessonId}/term-tap` | Record a key term tap |

**Upload text request:**
```json
{
  "text": "Your raw lesson text here...",
  "subject": "Biology"
}
```
> ⚠️ Requires the FastAPI AI service running on port 8000.

---

### Quiz — `/api/quiz`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/quiz/{lessonId}/start` | Start or resume a quiz for a lesson |
| POST | `/api/quiz/{quizId}/answer` | Submit an answer to a question |
| GET | `/api/quiz/{quizId}/complete` | Finalise the quiz and get the score |

**Submit answer request:**
```json
{
  "questionId": "<uuid>",
  "selectedOptionId": "0",
  "latencyMs": 3200
}
```
> `selectedOptionId` is the index of the chosen option as a string (`"0"`, `"1"`, `"2"`, `"3"`).

---

### Progress — `/api/progress`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/progress/dashboard` | Get learner progress dashboard |

---

## Testing

A Postman collection is available at `backend/Elewa_API.postman_collection.json`.

Import via **File → Import** in Postman. The collection auto-saves IDs between requests via test scripts.

**Recommended test order:**
1. Register → Login
2. Save Profile → Save Placement → Complete Onboarding → Link Guardian
3. Upload Text → Get Lesson → Update Section Progress → Tap Term
4. Start Quiz → Submit Answer (repeat per question) → Complete Quiz
5. Get Dashboard

---

## Branching & Contribution

This service follows the monorepo branching strategy. Always branch off `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

Open PRs into `develop`, never directly into `main`. See the [root README](../README.md) for the full workflow.

### Commit Convention

| Prefix | Use for |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `chore:` | Config, deps, tooling |
| `refactor:` | Code change, no behaviour change |
| `docs:` | Documentation only |