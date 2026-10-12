# E2E Summary — Exhibition QA capture (2026-10-12)

## Root
`C:\Users\thrillerpark\Desktop\Flagship Projects\Elekeza`, branch `feat/elekeza-pilot-completion`, commit `bab0ba2` (HEAD of branch). Working tree was clean at session start except the intentional 3-file sidebar fix (uncommitted).

## Duplicate sidebar defect (fixed this session)
- `teacher/layout.tsx` and `guardian/layout.tsx` already wrap children in `SidebarLayout`.
- Three teacher pages wrapped themselves again, producing two sidebars: `/teacher/support`, `/teacher/quiz-results`, `/teacher/exams`.
- Smallest safe fix: removed the redundant `SidebarLayout` import/wrapper from those 3 pages only.
- Verified in live browser on :3100: `document.querySelectorAll('aside').length === 1` on all three routes; no horizontal overflow.

## Method
- Services: FE :3100 (`next dev --webpack`, NEXT_PUBLIC_API_URL=:8097), BE :8097 prod profile via `backend/restart-local.sh`, AI :8001 (uvicorn), PG :5433 scratch.
- Real logins via seeded demo accounts: student@/teacher@/parent@elekeza.app (200 OK). admin@elekeza.app password differs from archived docs — logs 401 (see blockers.md).
- Capture driver: standalone Playwright script `frontend/scripts/capture-exhibition.mts` (uses playwright-core against chromium, no `npx playwright test` because the suite's config boots its own isolated stack and the cold-compile timeout is >10 min on this machine).
- 24 screenshots saved under `artifacts/exhibition-qa/` (viewport + full-page variants) and `mobile/`.

## Console errors observed
- Every journey logged exactly 2 × `401 (Unauthorized)` resource loads — these are pre-auth probes fired before the login round-trip completes (server responds 401, UI shows login form). No unexplained 4xx/5xx on any post-login route.

## Markup structure check (live browser, post-fix)
| Route | asides | h1 | horizontal overflow |
|---|---|---|---|
| /teacher | 1 | (dashboard) | no |
| /teacher/support | 1 | Support Signals | no |
| /teacher/exams | 1 | Exams & CBT | no |
| /teacher/quiz-results | 1 | Per-Question Quiz Results | no |

## Not exercised
- SCHOOL_ADMIN dashboard (no valid demo password — see blockers.md).
- AI recovery states / fault injection.
- Offline sync journey (helper exists; not exercised in this online capture).
- Orange UI variant (no orange theme variant exists in code; guardian green remaps apply by role). Purple theme confirmed active (`data-theme=dark`, purple-primary tokens).

## Output files
- `artifacts/exhibition-qa/*.png` (viewport captures, 1366x900, 19 files)
- `artifacts/exhibition-qa/mobile/*.png` (390x844, 5 files)
- `artifacts/exhibition-qa/full-page/*.png` (full-page captures, 24 files)
- `artifacts/exhibition-qa/capture-log.json` (journey + console-error record)
