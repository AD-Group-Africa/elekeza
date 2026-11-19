# ELEKEZA AI TEST FAILURE ANALYSIS

**Date:** 5 Nov 2026 · Service under test: `ai-elewa` (FastAPI) from the current working tree
**Final reproducible result: 606 passed, 55 deselected, 0 failed** (full suite); targeted edge-case suite **31/31 passed**.

---

## 1. What was actually run

| Step | Command (abridged) | Outcome |
|---|---|---|
| Initial full run | `pytest tests -q -m "not live"` (no server targeting, no env) | **84 failed, 574 passed, 3 deselected** |
| Diagnosis | live probes on :8000 / :8001 | :8000 = **PCEA Works** demo API (another project); Elekeza AI service had to run on :8001 |
| Edge suite vs Elekeza service | `AI_TEST_BASE_URL=http://localhost:8001 pytest tests/test_edge_cases.py` | 23 failed → traced to **auth key mismatch** |
| Auth key trace | `security.py` fail-closed middleware + `conftest.py load_dotenv` | tests loaded `ai-elewa/.env`'s `INTERNAL_SECRET`; server had been launched with an override → different keys |
| Clean restart | uvicorn **without** explicit secret (reads its own `.env`) | edge + integration target files: **31/31 passed** |
| Full suite | `AI_TEST_BASE_URL=http://localhost:8001 pytest tests` | 1 failed (live smoke) |
| Live smoke failure | `test_live_smoke.py::test_simplify_text_live` | `AsyncCompletions.create() got an unexpected keyword argument 'max_completion_tokens'` |
| Dependency check | venv `groq` was **0.11.0**; `requirements.txt` pins **groq==1.4.0** | local **environment drift**, not an application bug |
| Fix | `pip install groq==1.4.0` into the project venv, restart service | — |
| Final full suite | same command | **606 passed, 55 deselected, 0 failed** (93 s) |

## 2. Failure classification (all 84)

### 2.1 `tests/test_edge_cases.py` — 30 failures
- **Names (representative set):** `test_empty_string_returns_422_empty_content`, `test_empty_text_returns_422`, `test_oversized_text_returns_413`, `test_missing_learner_context_returns_422`, `test_adaptive_*` (missing `question`, `is_correct`, negative `latency_ms`), `test_wrong_answer_*` (missing `section_content`, `question`), image payload cases.
- **Actual:** HTTP 404 (`{"error":{"code":"not_found"...}}` — a *different project's* 404 envelope) or HTTP 401 (`UNAUTHORISED`, Elekeza's own envelope).
- **Expected:** 422 `SCHEMA_INVALID` / 413.
- **Cause: environment (two stacked problems).**
  1. The suite's documented docstring default (`uvicorn :8000`) collided with PCEA Works on this machine. The file already honors `AI_TEST_BASE_URL` (audit comment EL-F-AIport in the file), so no code change was needed — only the right launch target.
  2. The server was (by me) started with an explicit `INTERNAL_SECRET` env override. `conftest.py` runs `load_dotenv(ai-elewa/.env)`, so pytest sent the `.env` secret, while the server honoured the override → every authenticated case got 401.
- **Resolution:** start `uvicorn main:app --port 8001` with no secret override; run tests with `AI_TEST_BASE_URL=http://localhost:8001`. **31/31 pass** (30 previously failing + the file's other case).
- **Application changes: none.**

### 2.2 `tests/test_full_pipeline.py` — 54 failures
- **Cause: test infrastructure + marker design.** The file is marked `pytest.mark.live_full` (a deliberate 54-real-LLM-call matrix, opt-in), and its `BASE_URL` was **hardcoded** to `http://localhost:8000` — historically fine in CI, fatal on this machine where another project owns :8000. My initial run used `-m "not live"`, which *overrides* the `addopts` default that normally deselects `live_full` — that's why these 54 ran and failed at all.
- **Resolution:** single plumbing fix — `BASE_URL = os.environ.get("AI_TEST_BASE_URL", "http://localhost:8000")` (same pattern the edge-case file already documents). No assertions changed. These tests make **paid provider calls**, so they remain deselected by default and were not executed without approval.
- **Application changes: none.**

### 2.3 `tests/test_live_smoke.py::test_simplify_text_live` — 1 failure
- **Actual:** 422 `SCHEMA_INVALID` — body: `Unexpected error from AI provider: AsyncCompletions.create() got an unexpected keyword argument 'max_completion_tokens'`.
- **Diagnosis:** `pipeline/stage2_simplify.py` passes `max_completion_tokens` (correct for the pinned `groq==1.4.0`), but the local `.venv` still had `groq 0.11.0` from an older install. **Environment drift toward an outdated SDK.** (Not an app bug: the pinned requirements are right.)
- **Resolution:** `pip install groq==1.4.0` into `ai-elewa/.venv`; restart. Test now **passes** against the live provider (proving the `.env` credential works and the real AI path is functional).
- **Recommendation:** add a CI/developer check `pip check` or install via `pip install -r requirements.txt` and never hand-upgrade single packages.

## 3. Files modified

| Path | Change | Justification |
|---|---|---|
| `ai-elewa/tests/test_full_pipeline.py` | `BASE_URL` now honours `AI_TEST_BASE_URL` (2-line change + comment) | Remove hardcoded port dependency; matches existing suite convention |
| `ai-elewa/.venv` (untracked) | `groq 0.11.0 → 1.4.0` | Align environment with `requirements.txt` |

No application source, assertions, markers, or Git state were changed. Deadline-security work untouched; stashes untouched.

## 4. Remaining unresolved / deliberately excluded
- `live_full` (54 paid LLM calls) — **not executed** (cost approval required). Command when approved: `AI_TEST_BASE_URL=http://localhost:8001 pytest tests -m live_full`.
- PCEA Works retains port 8000; Elekeza's AI service now uses **8001** locally. Documented in the baseline.

## 5. Trusted test environment recipe (current machine)

```bash
cd ai-elewa
./.venv/Scripts/python.exe -m uvicorn main:app --port 8001        # reads .env itself
# other terminal:
AI_TEST_BASE_URL=http://localhost:8001 ./.venv/Scripts/python.exe -m pytest tests -q
# expect: 606 passed, 55 deselected
```
Never pass an explicit `INTERNAL_SECRET` to the server for test runs unless you also export it for pytest — the conftest loads `.env`.
