# User Accessible Pages (Frontend)

This is the user-facing page map for the frontend app.

## Public Pages

| Page | Route | Purpose |
|---|---|---|
| Home | `/` | Entry point, redirects user to login or dashboard |
| Register | `/register` | Create a new account |
| Login | `/login` | Sign in to an existing account |

## Protected Pages (Require Login)

| Page | Route | Purpose |
|---|---|---|
| Dashboard | `/dashboard` | Main overview: progress, recent lessons, quiz history |
| Upload | `/upload` | Upload text content for lesson generation |
| Onboarding Profile | `/onboarding/profile` | Save learner profile details |
| Onboarding Placement | `/onboarding/placement` | Submit placement score |
| Onboarding Complete | `/onboarding/complete` | Final onboarding step |
| Lesson Details | `/lesson/[id]` | View a generated lesson |
| Quiz | `/quiz/[lessonId]` | Take quiz for a lesson |
| Document Page | `/document/[id]` | View document details |
| Document History | `/dashboard/history` | View previously uploaded/processed docs |
| Settings | `/dashboard/settings` | User preferences and accessibility settings |

## Sidebar Navigation (Current)

The sidebar currently links to:
- `/dashboard`
- `/upload`
- `/dashboard/history`
- `/dashboard/settings`

## Typical User Flow

1. Register or login.
2. Complete onboarding.
3. Upload text content.
4. Read lesson.
5. Take quiz.
6. Track progress from dashboard/history.
