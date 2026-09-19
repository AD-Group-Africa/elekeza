"""
Day 12 — Prompt Quality Review Script
Runs 5 texts × 4 profiles, scores each output against profile rules,
and writes a findings report to tools/prompt_review_notes.md

Usage:
    uvicorn main:app --port 8000
    python tools/prompt_review.py
"""
import httpx
import json
import os
import re
import time
from pathlib import Path
from datetime import datetime

# Key is read from the environment (never hardcoded) — the placeholder below
# only applies when the operator has not configured a real INTERNAL_SECRET.
INTERNAL_KEY = os.environ.get("INTERNAL_SECRET", "elekeza-test-internal-key-not-a-secret")

BASE_URL = "http://localhost:8000"
AUTH_HEADER = {"X-Internal-Key": INTERNAL_KEY}
JSON_HEADER = {**AUTH_HEADER, "Content-Type": "application/json"}

TEXTS = {
    "water_cycle": """The water cycle describes how water moves continuously through
    the Earth's environment. Water evaporates from oceans, lakes, and rivers when
    heated by the sun. It rises into the atmosphere as water vapour. As it cools,
    it condenses into clouds. When clouds hold enough water, precipitation occurs
    — rain, snow, or hail falls back to the ground. This water then flows into
    rivers and oceans or soaks into the ground, beginning the cycle again.""",

    "industrial_revolution": """The Industrial Revolution began in Britain in the
    late 18th century. It marked a shift from hand production to machine
    manufacturing. Steam engines powered factories and transformed transportation
    through railways and steamships. Cities grew rapidly as workers moved from
    farms to urban factories. Working conditions were often dangerous, with long
    hours and low pay. Child labour was common. These conditions eventually led
    to the rise of trade unions and labour reform movements.""",

    "volcanoes": """Volcanoes are openings in the Earth's crust where molten rock,
    ash, and gases escape from below the surface. The molten rock beneath the
    surface is called magma. When it erupts and reaches the surface, it is called
    lava. Volcanoes form at tectonic plate boundaries, where plates collide or
    pull apart. The Ring of Fire around the Pacific Ocean is home to over 75
    percent of the world's active volcanoes. Famous examples include Mount Fuji
    in Japan and Mount Vesuvius in Italy.""",

    "human_heart": """The human heart is a muscular organ that pumps blood around
    the body. It beats approximately 70 times per minute at rest. The heart has
    four chambers: two atria and two ventricles. Oxygen-poor blood enters the
    right side of the heart and is pumped to the lungs. There it picks up oxygen.
    The oxygen-rich blood returns to the left side of the heart and is pumped to
    the rest of the body. Regular exercise strengthens the heart muscle and
    reduces the risk of heart disease.""",

    "internet": """The internet is a global network of computers connected together.
    It was developed in the 1960s by the United States military as a way to share
    information. The World Wide Web, invented by Tim Berners-Lee in 1989, made the
    internet accessible to ordinary people. Web pages are written in HTML and
    connected by hyperlinks. Today billions of people use the internet for
    communication, education, shopping, and entertainment. The internet has
    transformed nearly every aspect of modern life.""",
}

PROFILES = ["dyslexia", "adhd", "autism", "intellectual_disability"]

# ---------------------------------------------------------------------------
# Scoring functions — each returns (passed: bool, detail: str)
# ---------------------------------------------------------------------------

def score_sentence_length(text: str, max_words: int) -> tuple[bool, str]:
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    violations = []
    for s in sentences:
        wc = len(s.split())
        if wc > max_words:
            violations.append(f"{wc} words: '{s[:60]}...'")
    if violations:
        return False, f"{len(violations)} sentence(s) exceed {max_words}-word limit: {violations[0]}"
    return True, f"All sentences within {max_words}-word limit"


def score_passive_voice(text: str) -> tuple[bool, str]:
    passive_patterns = [
        r'\b(is|are|was|were|be|been|being)\s+\w+ed\b',
        r'\b(is|are|was|were)\s+\w+en\b',
    ]
    hits = []
    for pattern in passive_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        hits.extend(matches)
    if hits:
        return False, f"Possible passive voice detected ({len(hits)} instance(s))"
    return True, "No passive voice detected"


def score_no_idioms(text: str) -> tuple[bool, str]:
    idioms = [
        "raining cats", "break a leg", "hit the nail", "piece of cake",
        "under the weather", "bite the bullet", "cost an arm", "the heart of",
        "wrap your head", "at the end of the day", "in a nutshell",
    ]
    found = [i for i in idioms if i.lower() in text.lower()]
    if found:
        return False, f"Idioms/figurative language found: {found}"
    return True, "No idioms detected"


def score_vocabulary_simplicity(text: str, max_syllables: int = 3) -> tuple[bool, str]:
    complex_words = [
        "approximately", "subsequently", "utilise", "demonstrate",
        "significant", "furthermore", "nevertheless", "consequently",
        "predominantly", "manifestation", "implementation", "infrastructure",
    ]
    found = [w for w in complex_words if w.lower() in text.lower()]
    if found:
        return False, f"Complex vocabulary found: {found}"
    return True, "Vocabulary appears appropriately simple"


def score_has_visual_hints(sections: list) -> tuple[bool, str]:
    missing = [s["heading"] for s in sections if not s.get("visual_hint")]
    if missing:
        return False, f"Sections missing visual_hint: {missing}"
    return True, "All sections have visual hints"


def score_has_key_terms(key_terms: list) -> tuple[bool, str]:
    if not key_terms:
        return False, "No key terms extracted"
    if len(key_terms) < 1:
        return False, "Too few key terms"
    return True, f"{len(key_terms)} key term(s) present"


def score_section_count(sections: list, max_sections: int) -> tuple[bool, str]:
    if len(sections) > max_sections:
        return False, f"{len(sections)} sections — exceeds {max_sections} limit"
    return True, f"{len(sections)} sections (within {max_sections} limit)"


def score_remember_sentences(sections: list) -> tuple[bool, str]:
    """ID profile — every section should end with 'Remember:'"""
    missing = []
    for s in sections:
        if "remember" not in s.get("body", "").lower():
            missing.append(s["heading"])
    if missing:
        return False, f"Sections missing 'Remember:' sentence: {missing}"
    return True, "All sections have 'Remember:' closing"


def score_headings_factual(sections: list) -> tuple[bool, str]:
    """Autism — headings should be factual statements, not questions."""
    question_headings = [s["heading"] for s in sections if s["heading"].endswith("?")]
    if question_headings:
        return False, f"Autism profile: question headings found (should be factual): {question_headings}"
    return True, "All headings are factual statements"


# ---------------------------------------------------------------------------
# Profile-specific audit
# ---------------------------------------------------------------------------

def audit_dyslexia(data: dict) -> list[dict]:
    body_text = " ".join(s["body"] for s in data["sections"])
    return [
        {"check": "sentence_length_max12", **dict(zip(["passed", "detail"], score_sentence_length(body_text, 12)))},
        {"check": "no_passive_voice",      **dict(zip(["passed", "detail"], score_passive_voice(body_text)))},
        {"check": "visual_hints_present",  **dict(zip(["passed", "detail"], score_has_visual_hints(data["sections"])))},
        {"check": "key_terms_present",     **dict(zip(["passed", "detail"], score_has_key_terms(data["key_terms"])))},
        {"check": "vocabulary_simple",     **dict(zip(["passed", "detail"], score_vocabulary_simplicity(body_text)))},
    ]


def audit_adhd(data: dict) -> list[dict]:
    body_text = " ".join(s["body"] for s in data["sections"])
    return [
        {"check": "sentence_length_max14", **dict(zip(["passed", "detail"], score_sentence_length(body_text, 14)))},
        {"check": "visual_hints_present",  **dict(zip(["passed", "detail"], score_has_visual_hints(data["sections"])))},
        {"check": "key_terms_present",     **dict(zip(["passed", "detail"], score_has_key_terms(data["key_terms"])))},
        {"check": "vocabulary_simple",     **dict(zip(["passed", "detail"], score_vocabulary_simplicity(body_text)))},
    ]


def audit_autism(data: dict) -> list[dict]:
    body_text = " ".join(s["body"] for s in data["sections"])
    return [
        {"check": "no_idioms_or_metaphors", **dict(zip(["passed", "detail"], score_no_idioms(body_text)))},
        {"check": "factual_headings",        **dict(zip(["passed", "detail"], score_headings_factual(data["sections"])))},
        {"check": "key_terms_present",       **dict(zip(["passed", "detail"], score_has_key_terms(data["key_terms"])))},
        {"check": "vocabulary_simple",       **dict(zip(["passed", "detail"], score_vocabulary_simplicity(body_text)))},
    ]


def audit_intellectual_disability(data: dict) -> list[dict]:
    body_text = " ".join(s["body"] for s in data["sections"])
    return [
        {"check": "sentence_length_max8",   **dict(zip(["passed", "detail"], score_sentence_length(body_text, 8)))},
        {"check": "section_count_max3",     **dict(zip(["passed", "detail"], score_section_count(data["sections"], 3)))},
        {"check": "remember_sentences",     **dict(zip(["passed", "detail"], score_remember_sentences(data["sections"])))},
        {"check": "visual_hints_present",   **dict(zip(["passed", "detail"], score_has_visual_hints(data["sections"])))},
        {"check": "vocabulary_simple",      **dict(zip(["passed", "detail"], score_vocabulary_simplicity(body_text)))},
        {"check": "key_terms_present",      **dict(zip(["passed", "detail"], score_has_key_terms(data["key_terms"])))},
    ]


AUDITORS = {
    "dyslexia":               audit_dyslexia,
    "adhd":                   audit_adhd,
    "autism":                 audit_autism,
    "intellectual_disability": audit_intellectual_disability,
}


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

def run_review():
    results = {}
    total_checks = 0
    total_passed = 0

    print(f"\n{'='*70}")
    print(f"  PROMPT QUALITY REVIEW — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*70}\n")

    for text_name, raw_text in TEXTS.items():
        results[text_name] = {}

        for profile in PROFILES:
            print(f"  Testing: {text_name} × {profile}...", end=" ", flush=True)

            payload = {
                "learner_context": {
                    "learner_id": "review-001",
                    "cognitive_profiles": [profile],
                    "language_level": 1 if profile == "intellectual_disability" else 2,
                    "content_difficulty": 1 if profile == "intellectual_disability" else 2,
                    "pathway_stage": "Foundation",
                },
                "raw_text": raw_text,
            }

            try:
                resp = httpx.post(
                    f"{BASE_URL}/ai/simplify/text",
                    headers=JSON_HEADER,
                    json=payload,
                    timeout=30.0,
                )
                if resp.status_code != 200:
                    print(f"❌ HTTP {resp.status_code}")
                    results[text_name][profile] = {"error": f"HTTP {resp.status_code}"}
                    time.sleep(2)
                    continue

                data = resp.json()
                checks = AUDITORS[profile](data)
                passed = sum(1 for c in checks if c["passed"])
                total = len(checks)
                total_checks += total
                total_passed += passed

                results[text_name][profile] = {
                    "checks": checks,
                    "passed": passed,
                    "total": total,
                    "score": f"{passed}/{total}",
                    "sections": len(data["sections"]),
                    "key_terms": len(data["key_terms"]),
                    "estimated_minutes": data["estimated_minutes"],
                }

                score_icon = "✅" if passed == total else "⚠️ " if passed >= total * 0.6 else "❌"
                print(f"{score_icon} {passed}/{total} checks passed")

            except Exception as e:
                print(f"❌ Error: {e}")
                results[text_name][profile] = {"error": str(e)}

            time.sleep(2)  # Rate limit protection

    # ---------------------------------------------------------------------------
    # Print summary
    # ---------------------------------------------------------------------------

    print(f"\n{'='*70}")
    print(f"  SUMMARY")
    print(f"{'='*70}")
    print(f"  Total checks: {total_checks}")
    print(f"  Passed:       {total_passed} ({100*total_passed//total_checks if total_checks else 0}%)")
    print(f"  Failed:       {total_checks - total_passed}")

    # Profile breakdown
    print(f"\n  BY PROFILE:")
    for profile in PROFILES:
        p_passed = sum(
            c["passed"] for t in results.values()
            if profile in t and "checks" in t[profile]
            for c in t[profile]["checks"] if c["passed"]
        )
        p_total = sum(
            t[profile]["total"] for t in results.values()
            if profile in t and "total" in t[profile]
        )
        pct = 100 * p_passed // p_total if p_total else 0
        icon = "✅" if pct >= 80 else "⚠️ " if pct >= 60 else "❌"
        print(f"  {icon} {profile:30s} {p_passed}/{p_total} ({pct}%)")

    # Failed checks summary
    print(f"\n  FAILED CHECKS:")
    failures = []
    for text_name, profiles_data in results.items():
        for profile, data in profiles_data.items():
            if "checks" not in data:
                continue
            for check in data["checks"]:
                if not check["passed"]:
                    failures.append({
                        "text": text_name,
                        "profile": profile,
                        "check": check["check"],
                        "detail": check["detail"],
                    })

    if not failures:
        print("  None — all checks passed!")
    else:
        for f in failures:
            print(f"  ❌ [{f['profile']}] {f['check']}: {f['detail'][:80]}")

    # ---------------------------------------------------------------------------
    # Write markdown report
    # ---------------------------------------------------------------------------

    write_report(results, failures, total_passed, total_checks)
    print(f"\n✅ Report written to tools/prompt_review_notes.md\n")


def write_report(results, failures, total_passed, total_checks):
    Path("tools").mkdir(exist_ok=True)
    lines = [
        f"# Prompt Quality Review Notes",
        f"",
        f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M')}  ",
        f"**Overall score:** {total_passed}/{total_checks} checks passed",
        f"",
        f"---",
        f"",
        f"## Failed Checks",
        f"",
    ]

    if not failures:
        lines.append("No failures found.")
    else:
        for f in failures:
            lines.append(f"- **[{f['profile']}]** `{f['check']}` — {f['detail']}")

    lines += [
        f"",
        f"---",
        f"",
        f"## Per-Profile Findings",
        f"",
    ]

    for profile in ["dyslexia", "adhd", "autism", "intellectual_disability"]:
        lines.append(f"### {profile.upper()}")
        lines.append(f"")
        for text_name, profiles_data in results.items():
            if profile not in profiles_data or "checks" not in profiles_data[profile]:
                continue
            d = profiles_data[profile]
            lines.append(f"**{text_name}** — {d['score']} checks, "
                         f"{d['sections']} sections, "
                         f"{d['key_terms']} key terms, "
                         f"{d['estimated_minutes']} min")
            for check in d["checks"]:
                icon = "✅" if check["passed"] else "❌"
                lines.append(f"  - {icon} `{check['check']}`: {check['detail']}")
            lines.append("")

    lines += [
        f"---",
        f"",
        f"## Improvements Made",
        f"",
        f"_(filled in after prompt updates)_",
        f"",
        f"### Improvement 1:",
        f"- **Profile affected:**",
        f"- **Issue found:**",
        f"- **Change made:**",
        f"- **Result after re-test:**",
        f"",
        f"### Improvement 2:",
        f"- **Profile affected:**",
        f"- **Issue found:**",
        f"- **Change made:**",
        f"- **Result after re-test:**",
        f"",
        f"---",
        f"",
        f"## Langfuse Observations",
        f"",
        f"- Highest retry rate profile:",
        f"- Slowest stage:",
        f"- Any systematic failures:",
        f"",
    ]

    Path("tools/prompt_review_notes.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    run_review()

