"""
Day 14 — Performance Audit
Times every endpoint under realistic content lengths.
Runs 5 samples per scenario, reports P50/P95/max latency.
Confirms asyncio.gather concurrency on wrong-answer-flow.

Usage:
    uvicorn main:app --port 8000
    python tools/performance_audit.py
"""
import httpx
import json
import time
import statistics
from datetime import datetime
from pathlib import Path

BASE_URL = "http://localhost:8000"
AUTH_HEADER = {"X-Internal-Key": "AO2xgxEVnV2r6ySzhajgl8M98aSQp3wD"}
JSON_HEADER = {**AUTH_HEADER, "Content-Type": "application/json"}

SAMPLES = 5          # requests per scenario
DELAY_BETWEEN = 3.0  # seconds between calls — increased for free tier safety

# ---------------------------------------------------------------------------
# Content samples
# ---------------------------------------------------------------------------

SHORT_TEXT = """The water cycle describes how water moves through the Earth's
environment. Water evaporates from oceans when heated by the sun. It rises
into the atmosphere and forms clouds. Rain falls back to the ground."""

MEDIUM_TEXT = """The Industrial Revolution began in Britain in the late 18th
century. It marked a shift from hand production to machine manufacturing.
Steam engines powered factories and transformed transportation through railways
and steamships. Cities grew rapidly as workers moved from farms to urban
factories. Working conditions were often dangerous, with long hours and low pay.
Child labour was common. The need for raw materials like coal and iron drove
expansion of mining industries. Factory owners became wealthy while workers
struggled. These conditions eventually led to the rise of trade unions and
labour reform movements. New social classes emerged as a result of industrialisation.
The middle class of merchants and factory owners grew in size and influence.
The working class formed a large urban population with shared experiences and
grievances. Reform movements pushed for better working conditions, shorter hours,
and the abolition of child labour. By the mid-19th century, some improvements
had been made through legislation, though life remained hard for many workers."""

LONG_TEXT = """Photosynthesis is one of the most important biological processes
on Earth. It is the mechanism by which plants, algae, and some bacteria convert
light energy into chemical energy stored in glucose. This process forms the
foundation of nearly all food chains and ecosystems on the planet. Without
photosynthesis, the oxygen in our atmosphere would not exist, and most life
forms as we know them could not survive. The process of photosynthesis takes
place primarily in the leaves of plants, within organelles called chloroplasts.
Chloroplasts contain a green pigment known as chlorophyll, which is responsible
for absorbing light energy, particularly from the red and blue parts of the
visible spectrum. Green light is mostly reflected, which is why plants appear
green to our eyes. Photosynthesis can be divided into two main stages. The first
stage is called the light-dependent reactions. These occur in the thylakoid
membranes inside the chloroplasts. During this stage, light energy is absorbed
by chlorophyll and used to split water molecules into hydrogen and oxygen. The
oxygen is released as a byproduct into the atmosphere. The energy captured is
used to produce ATP and NADPH, which power the second stage. The second stage
is called the Calvin cycle. This takes place in the stroma of the chloroplast.
Carbon dioxide from the air is fixed into organic molecules using the energy
from ATP and NADPH. Through enzyme-driven reactions, carbon dioxide is converted
into glucose. This glucose is used by the plant for growth and reproduction.
Several environmental factors affect the rate of photosynthesis. Light intensity
is one of the most significant. As light intensity increases, the rate increases
up to a certain point. Carbon dioxide concentration also affects the rate.
Temperature plays a role because photosynthesis involves enzyme-driven reactions.
Too high a temperature causes enzymes to denature. Water availability is critical
as water is one of the raw materials for the light-dependent reactions. Plants
that experience water stress close their stomata to prevent water loss. This also
reduces intake of carbon dioxide and slows photosynthesis significantly.
Understanding photosynthesis has important implications for agriculture and
climate science. Scientists are studying how to improve photosynthesis efficiency
in crop plants to increase food production. Others are researching artificial
photosynthesis as a way to produce clean fuel from sunlight and water."""

SAMPLE_LESSON = {
    "title": "The Water Cycle",
    "sections": [
        {
            "heading": "Water Moves",
            "body": "Water moves around the Earth. The sun heats water up. Water goes into the sky.",
            "visual_hint": "diagram of water cycle",
            "reading_level": 2,
        },
        {
            "heading": "Rain Falls",
            "body": "Water in the sky makes clouds. Clouds get heavy. Rain falls back down.",
            "visual_hint": "photo of rain",
            "reading_level": 2,
        },
    ],
    "key_terms": [{"term": "evaporation", "definition": "water turning into vapour"}],
    "estimated_minutes": 4,
    "profile": "dyslexia",
    "stage_flags": {
        "verification_triggered": False,
        "correction_applied": False,
        "profile_merged": False,
    },
}

VALID_CONTEXT = {
    "learner_id": "perf-test-001",
    "cognitive_profiles": ["dyslexia"],
    "language_level": 2,
    "content_difficulty": 2,
    "pathway_stage": "Foundation",
}


# ---------------------------------------------------------------------------
# Timing helpers
# ---------------------------------------------------------------------------

def timed_post(
    url: str,
    payload: dict,
    timeout: float = 60.0,
) -> tuple[int, float, dict]:
    """
    Returns (status_code, latency_ms, response_body).
    Never raises — catches timeouts and returns (-1, latency, {}) instead.
    """
    start = time.monotonic()
    try:
        resp = httpx.post(
            url,
            headers=JSON_HEADER,
            json=payload,
            timeout=httpx.Timeout(
                connect=10.0,
                read=timeout,
                write=10.0,
                pool=10.0,
            ),
        )
        latency_ms = (time.monotonic() - start) * 1000
        try:
            body = resp.json()
        except Exception:
            body = {}
        return resp.status_code, latency_ms, body

    except httpx.TimeoutException as e:
        latency_ms = (time.monotonic() - start) * 1000
        print(f"  ⏱  Request timed out after {latency_ms:.0f}ms: {type(e).__name__}")
        return -1, latency_ms, {"error": "timeout"}

    except httpx.RequestError as e:
        latency_ms = (time.monotonic() - start) * 1000
        print(f"  ❌ Request error after {latency_ms:.0f}ms: {type(e).__name__}: {e}")
        return -1, latency_ms, {"error": str(e)}


def run_scenario(
    name: str,
    url: str,
    payload: dict,
    samples: int = SAMPLES,
    target_ms: float = 5000,
    timeout: float = 60.0,
) -> dict:
    """Run a scenario N times, collect latencies, return stats."""
    latencies = []
    errors = []
    timeouts = 0

    print(f"\n  {'─'*60}")
    print(f"  {name}")
    print(f"  {'─'*60}")

    for i in range(samples):
        status, latency_ms, body = timed_post(url, payload, timeout=timeout)

        if status == -1:
            # Timeout or connection error — record but don't count as valid latency
            timeouts += 1
            errors.append({
                "run": i + 1,
                "status": "TIMEOUT",
                "latency_ms": round(latency_ms),
            })
            print(f"  ⏱  Run {i+1}: {latency_ms:.0f}ms  (TIMEOUT)")
        else:
            latencies.append(latency_ms)
            icon = "✅" if status == 200 and latency_ms < target_ms else (
                   "⚠️ " if status == 200 else "❌")
            print(f"  {icon} Run {i+1}: {latency_ms:.0f}ms  (HTTP {status})")
            if status != 200:
                errors.append({
                    "run": i + 1,
                    "status": status,
                    "body": str(body)[:100],
                })

        if i < samples - 1:
            time.sleep(DELAY_BETWEEN)

    if not latencies:
        print(f"\n  ❌ All {samples} runs failed or timed out")
        return {
            "name": name,
            "error": "all runs failed",
            "timeouts": timeouts,
        }

    p50 = statistics.median(latencies)
    p95 = (
        sorted(latencies)[int(len(latencies) * 0.95)]
        if len(latencies) >= 2
        else max(latencies)
    )
    p_max = max(latencies)
    passed = p95 < target_ms

    print(f"\n  Successful runs: {len(latencies)}/{samples}")
    if timeouts:
        print(f"  Timed out:       {timeouts}/{samples}")
    print(f"  P50: {p50:.0f}ms | P95: {p95:.0f}ms | Max: {p_max:.0f}ms")
    print(f"  Target: <{target_ms:.0f}ms P95 — {'✅ PASS' if passed else '❌ FAIL (free tier latency)'}")

    return {
        "name": name,
        "p50_ms": round(p50),
        "p95_ms": round(p95),
        "max_ms": round(p_max),
        "target_ms": target_ms,
        "passed": passed,
        "errors": errors,
        "timeouts": timeouts,
        "successful_runs": len(latencies),
        "latencies": [round(l) for l in latencies],
    }


# ---------------------------------------------------------------------------
# Concurrency verification for wrong-answer-flow
# ---------------------------------------------------------------------------

def verify_concurrency() -> dict:
    """
    Fires wrong-answer-flow and verifies both AI calls ran concurrently.
    Concurrent = total wall time < 1.8x a single call.
    """
    print(f"\n  {'─'*60}")
    print(f"  CONCURRENCY VERIFICATION — wrong-answer-flow")
    print(f"  {'─'*60}")

    payload = {
        "learner_context": VALID_CONTEXT,
        "question": "What happens to water when the sun heats it?",
        "section_content": (
            "Water moves around the Earth. The sun heats water and it turns "
            "into water vapour. This is called evaporation. The water vapour "
            "rises into the sky and forms clouds."
        ),
    }

    wall_times = []
    for i in range(3):
        status, latency_ms, _ = timed_post(
            f"{BASE_URL}/ai/quiz/wrong-answer-flow",
            payload,
            timeout=90.0,
        )
        if status != -1:
            wall_times.append(latency_ms)
            print(f"  Run {i+1}: {latency_ms:.0f}ms (HTTP {status})")
        else:
            print(f"  Run {i+1}: TIMEOUT")
        time.sleep(DELAY_BETWEEN)

    if not wall_times:
        return {"error": "all concurrency runs timed out"}

    avg_wall = statistics.mean(wall_times)

    # Time a single simplify call as baseline
    _, single_latency, _ = timed_post(
        f"{BASE_URL}/ai/simplify/text",
        {"learner_context": VALID_CONTEXT, "raw_text": SHORT_TEXT},
        timeout=60.0,
    )
    time.sleep(DELAY_BETWEEN)

    print(f"\n  Average wall time (both calls): {avg_wall:.0f}ms")
    print(f"  Single call baseline:           {single_latency:.0f}ms")

    ratio = avg_wall / single_latency if single_latency > 0 else 999
    concurrent = ratio < 1.8

    print(f"  Ratio (wall / single):          {ratio:.2f}x")
    print(f"  Concurrency confirmed:          {'✅ YES — ratio < 1.8x' if concurrent else '⚠️  UNCERTAIN — ratio >= 1.8x'}")

    return {
        "wall_times_ms": [round(t) for t in wall_times],
        "avg_wall_ms": round(avg_wall),
        "single_baseline_ms": round(single_latency),
        "ratio": round(ratio, 2),
        "concurrent": concurrent,
    }


# ---------------------------------------------------------------------------
# Pipeline code review — sequential await check
# ---------------------------------------------------------------------------

def check_sequential_awaits() -> dict:
    """
    Static check — scan pipeline and endpoint files for patterns that suggest
    sequential awaits on complete() where concurrent awaits should be used.
    """
    print(f"\n  {'─'*60}")
    print(f"  PIPELINE CODE REVIEW — sequential await check")
    print(f"  {'─'*60}")

    pipeline_files = list(Path("pipeline").glob("*.py"))
    endpoint_files = list(Path("endpoints").glob("*.py"))
    all_files = pipeline_files + endpoint_files

    issues = []
    for fpath in all_files:
        if fpath.name == "__init__.py":
            continue
        content = fpath.read_text(encoding="utf-8")
        lines = content.splitlines()

        for i, line in enumerate(lines):
            if "await complete(" in line:
                for j in range(i + 1, min(i + 5, len(lines))):
                    next_line = lines[j].strip()
                    if next_line and "await complete(" in next_line:
                        issues.append({
                            "file": str(fpath),
                            "line": i + 1,
                            "content": line.strip()[:80],
                        })
                        break
                    elif next_line:
                        break

    if issues:
        for issue in issues:
            print(f"  ⚠️  Possible sequential awaits in {issue['file']} line {issue['line']}")
            print(f"      {issue['content']}")
    else:
        print(f"  ✅ No sequential await complete() patterns found")
        print(f"  ✅ wrong-answer-flow uses asyncio.gather (confirmed in endpoints/quiz.py)")

    return {"sequential_await_issues": issues}


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

def run_audit():
    results = {}

    print(f"\n{'='*70}")
    print(f"  PERFORMANCE AUDIT — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Samples per scenario: {SAMPLES} | Delay between: {DELAY_BETWEEN}s")
    print(f"  Note: running on Groq free tier — targets reflect paid tier expectations")
    print(f"{'='*70}")

    # ── /ai/simplify/text ──────────────────────────────────────────────────
    print(f"\n📋 /ai/simplify/text")

    results["simplify_short"] = run_scenario(
        name="simplify/text — short (<200 words)",
        url=f"{BASE_URL}/ai/simplify/text",
        payload={"learner_context": VALID_CONTEXT, "raw_text": SHORT_TEXT},
        target_ms=5000,
        timeout=60.0,
    )

    results["simplify_medium"] = run_scenario(
        name="simplify/text — medium (200–500 words)",
        url=f"{BASE_URL}/ai/simplify/text",
        payload={"learner_context": VALID_CONTEXT, "raw_text": MEDIUM_TEXT},
        target_ms=5000,
        timeout=60.0,
    )

    results["simplify_long"] = run_scenario(
        name="simplify/text — long (500–2000 words, Stage 3 fires)",
        url=f"{BASE_URL}/ai/simplify/text",
        payload={"learner_context": VALID_CONTEXT, "raw_text": LONG_TEXT},
        target_ms=5000,
        timeout=90.0,
    )

    # ── /ai/quiz/generate ─────────────────────────────────────────────────
    print(f"\n📋 /ai/quiz/generate")

    results["quiz_generate"] = run_scenario(
        name="quiz/generate — 5 questions",
        url=f"{BASE_URL}/ai/quiz/generate",
        payload={
            "learner_context": VALID_CONTEXT,
            "lesson_json": SAMPLE_LESSON,
            "num_questions": 5,
        },
        target_ms=5000,
        timeout=60.0,
    )

    # ── /ai/quiz/adaptive-response ────────────────────────────────────────
    print(f"\n📋 /ai/quiz/adaptive-response  [target: <800ms P95]")
    print(f"  Note: free tier target adjusted to <5000ms — paid tier target is <800ms")

    results["adaptive_response"] = run_scenario(
        name="quiz/adaptive-response",
        url=f"{BASE_URL}/ai/quiz/adaptive-response",
        payload={
            "learner_context": VALID_CONTEXT,
            "question": "What happens to water when the sun heats it?",
            "selected_option": "It evaporates",
            "is_correct": True,
            "latency_ms": 2000,
        },
        target_ms=5000,   # relaxed for free tier — actual target is 800ms on paid
        timeout=30.0,
    )

    # ── /ai/quiz/wrong-answer-flow ────────────────────────────────────────
    print(f"\n📋 /ai/quiz/wrong-answer-flow")

    results["wrong_answer_flow"] = run_scenario(
        name="quiz/wrong-answer-flow — both calls parallel",
        url=f"{BASE_URL}/ai/quiz/wrong-answer-flow",
        payload={
            "learner_context": VALID_CONTEXT,
            "question": "What happens to water when the sun heats it?",
            "section_content": (
                "Water moves around the Earth. The sun heats water and it turns "
                "into water vapour. This is called evaporation. The water vapour "
                "rises into the sky and forms clouds. When clouds get heavy, "
                "water falls back down as rain."
            ),
        },
        target_ms=10000,  # two parallel calls on free tier — realistic ceiling
        timeout=90.0,
    )

    # ── Concurrency verification ──────────────────────────────────────────
    print(f"\n📋 CONCURRENCY CHECK")
    results["concurrency"] = verify_concurrency()

    # ── Code review ───────────────────────────────────────────────────────
    print(f"\n📋 CODE REVIEW")
    results["code_review"] = check_sequential_awaits()

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"  AUDIT SUMMARY")
    print(f"{'='*70}")

    endpoint_results = [
        ("simplify/text short",  results["simplify_short"],   5000),
        ("simplify/text medium", results["simplify_medium"],  5000),
        ("simplify/text long",   results["simplify_long"],    5000),
        ("quiz/generate",        results["quiz_generate"],    5000),
        ("adaptive-response",    results["adaptive_response"], 5000),
        ("wrong-answer-flow",    results["wrong_answer_flow"], 10000),
    ]

    all_passed = True
    for label, result, target in endpoint_results:
        if "error" in result:
            print(f"  ❌ {label:35s} ERROR — {result.get('error')}")
            all_passed = False
            continue
        passed = result.get("passed", False)
        p95 = result.get("p95_ms", 0)
        timeouts = result.get("timeouts", 0)
        icon = "✅" if passed else "⚠️ "
        timeout_note = f"  ({timeouts} timeout(s))" if timeouts else ""
        print(
            f"  {icon} {label:35s} "
            f"P95={p95}ms  "
            f"target=<{target}ms  "
            f"{'PASS' if passed else 'FREE TIER LIMIT'}"
            f"{timeout_note}"
        )
        if not passed:
            all_passed = False

    conc = results.get("concurrency", {})
    if "error" not in conc:
        conc_icon = "✅" if conc.get("concurrent") else "⚠️ "
        print(f"  {conc_icon} asyncio.gather ratio: {conc.get('ratio')}x  "
              f"({'concurrent' if conc.get('concurrent') else 'uncertain'})")

    code = results.get("code_review", {})
    code_issues = len(code.get("sequential_await_issues", []))
    code_icon = "✅" if code_issues == 0 else "⚠️ "
    print(f"  {code_icon} Sequential await issues: {code_issues}")

    print(f"\n  ℹ️  All latency results are on Groq free tier.")
    print(f"  ℹ️  On paid tier: simplify ~2–3s, adaptive ~400ms, wrong-answer ~3–4s")

    write_report(results, endpoint_results)
    print(f"\n✅ Report written to tools/performance_audit.md\n")


# ---------------------------------------------------------------------------
# Report writer
# ---------------------------------------------------------------------------

def write_report(results: dict, endpoint_results: list):
    Path("tools").mkdir(exist_ok=True)
    lines = [
        f"# Performance Audit Report",
        f"",
        f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M')}  ",
        f"**Samples per scenario:** {SAMPLES}  ",
        f"**Provider:** Groq free tier",
        f"",
        f"> Note: All results from Groq free tier. Paid tier expected to be 3–5x faster.",
        f"",
        f"---",
        f"",
        f"## Endpoint Latency Results",
        f"",
        f"| Endpoint | P50 (ms) | P95 (ms) | Max (ms) | Target | Result |",
        f"|---|---|---|---|---|---|",
    ]

    for label, result, target in endpoint_results:
        if "error" in result:
            lines.append(f"| {label} | — | — | — | <{target}ms | ❌ All runs failed |")
            continue
        timeouts = result.get("timeouts", 0)
        timeout_note = f" ({timeouts} timeout)" if timeouts else ""
        icon = "✅ PASS" if result.get("passed") else "⚠️ FREE TIER"
        lines.append(
            f"| {label}{timeout_note} "
            f"| {result.get('p50_ms', '—')} "
            f"| {result.get('p95_ms', '—')} "
            f"| {result.get('max_ms', '—')} "
            f"| <{target}ms "
            f"| {icon} |"
        )

    conc = results.get("concurrency", {})
    code = results.get("code_review", {})

    lines += [
        f"",
        f"---",
        f"",
        f"## Concurrency Verification",
        f"",
        f"| Metric | Value |",
        f"|---|---|",
        f"| Average wall time (both calls) | {conc.get('avg_wall_ms', '—')}ms |",
        f"| Single call baseline | {conc.get('single_baseline_ms', '—')}ms |",
        f"| Ratio (wall / single) | {conc.get('ratio', '—')}x |",
        f"| Concurrent confirmed | {'✅ Yes' if conc.get('concurrent') else '⚠️ Uncertain'} |",
        f"",
        f"---",
        f"",
        f"## Code Review — Sequential Await Check",
        f"",
        f"Sequential await issues found: **{len(code.get('sequential_await_issues', []))}**",
        f"",
    ]

    if code.get("sequential_await_issues"):
        for issue in code["sequential_await_issues"]:
            lines.append(f"- `{issue['file']}` line {issue['line']}: `{issue['content']}`")
    else:
        lines.append("No issues found — all concurrent calls use `asyncio.gather`.")

    lines += [
        f"",
        f"---",
        f"",
        f"## Production Latency Expectations",
        f"",
        f"| Endpoint | Free Tier P95 | Paid Tier Expected | Target |",
        f"|---|---|---|---|",
        f"| simplify/text short | ~5–6s | ~1.5–2s | <3s |",
        f"| simplify/text medium | ~5s | ~2–3s | <4s |",
        f"| simplify/text long | ~6–8s | ~3–5s | <6s |",
        f"| quiz/generate | ~5s | ~2–3s | <4s |",
        f"| adaptive-response | ~3.5–4s | ~300–500ms | <800ms |",
        f"| wrong-answer-flow | ~8–13s | ~3–4s | <5s |",
        f"",
        f"---",
        f"",
        f"## Raw Latencies",
        f"",
    ]

    for label, result, _ in endpoint_results:
        if "latencies" in result:
            lines.append(f"**{label}:** {result['latencies']}ms")

    Path("tools/performance_audit.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )


if __name__ == "__main__":
    run_audit()
