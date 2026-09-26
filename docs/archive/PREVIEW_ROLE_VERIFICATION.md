# Preview role verification

Use the deterministic dev seed and the test accounts in `END_USER_TESTING.md`. Record PASS, FAIL, or BLOCKED beside every step; do not infer a result from navigation visibility.

| Role | Verified preview path | Current status |
| --- | --- | --- |
| Learner | Login, assigned lesson, quiz, score, progress, Tutor fallback, logout | Needs clean-run re-verification |
| Teacher | Login, assigned learners, learner support/progress view | Needs clean-run re-verification |
| Guardian | Login, linked ward, summary/progress/results visibility, foreign-ward denial | Needs clean-run re-verification |
| School admin | Login, school administration surfaces | Blocked: full school ERP acceptance is not evidenced |
| Super admin | Login, platform administration surfaces | Blocked: clean-run acceptance is not evidenced |

Finance acceptance is blocked: the present implementation records M-Pesa transactions but has no institution-scoped learner account, fee structure, invoice, allocation, balance, receipt, or manual-payment workflow. Attendance acceptance is also blocked: no attendance domain or API was found in the backend.

For every run, capture the environment, timestamp, account, route, observed result, and any browser console/network error. Never use a learner or guardian account to test another user's private record.
