# TEST_READINESS — Elekeza

## How to reproduce the verification (exact commands)

```bash
# Backend (from backend/)
./gradlew test
python -c "import glob,xml.etree.ElementTree as ET;t=f=s=0;[ (r:=ET.parse(p).getroot()) and (t:=t+int(r.get('tests',0)), f:=f+int(r.get('failures',0))+int(r.get('errors',0)), s:=s+int(r.get('skipped',0))) for p in glob.glob('build/test-results/test/*.xml')];print(f'tests={t} failures={f} skipped={s}')"

# Frontend (from frontend/)
npx tsc --noEmit
npm run lint
NEXT_PUBLIC_API_URL=https://api.elekeza.example npm run build   # production build + PWA service worker
```

## Current evidence (this gate)

| Check | Result |
| --- | --- |
| Backend suite | **151 tests, 0 failures, 0 skipped** (XML-verified) |
| Frontend typecheck | PASS (`tsc --noEmit` exit 0) |
| Frontend lint | **0 errors**, 26 pre-existing warnings |
| Frontend production build | PASS (all routes; PWA SW regenerated) |
| Regression after a11y changes | Backend suite unaffected (frontend-only change); typecheck/lint/build re-run green |

## What the 151 tests cover

Auth & input security (15) · forgot-password (5) · multi-tenant authorization (11) · content authorization (3) · content processing/upload (3) · lesson views (4) · exam API (18) · guardian relationship + analytics authorization (4) · duplicate/institution registration (5) · M-Pesa callback + end-to-end (12) · personalization domain + integration (30) · AI quiz parsing (14) · quiz review (7) · support signals (11) · support authorization (9) · miscellaneous integration flows.

## Testing that remains to build (honest)

- Frontend unit/component tests (no test runner wired in `frontend/` yet — verification is typecheck/lint/build + live browser walkthroughs)
- Automated E2E (Playwright) for the 14-step learner journey
- Accessibility automation (axe-core) in CI, plus manual screen-reader sessions
- IDOR sweep + dependency audit automation
- Performance tests on low-end Android / slow network profiles

## Browser journey (previously verified, re-run before pilot)

Login → learner home (companion) → subject → lesson (adapted presentation) → activity → quiz → server score → progress → gamification → guardian notification → guardian ward detail → teacher progress. This was verified live in earlier gates; it must be re-executed against a running stack before the pilot, and codified as Playwright E2E.
