"""
Day 10 — Full pipeline integration test.
Tests all 4 profiles × all endpoints × edge cases.
Runs against the live server — start uvicorn before running.

Usage:
    uvicorn main:app --port 8000
    pytest tests/test_full_pipeline.py -v -s
"""
import os
import pytest
import httpx
import time

# Key is read from the environment (never hardcoded) — the placeholder below
# only applies when the operator has not configured a real INTERNAL_SECRET.
INTERNAL_KEY = os.environ.get("INTERNAL_SECRET", "elekeza-test-internal-key-not-a-secret")

BASE_URL = "http://localhost:8000"
AUTH_HEADER = {"X-Internal-Key": INTERNAL_KEY}
JSON_HEADER = {**AUTH_HEADER, "Content-Type": "application/json"}

@pytest.fixture(autouse=True)
def rate_limit_delay():
    yield
    time.sleep(1.5)
    
# ---------------------------------------------------------------------------
# 5 text samples — varied topics and lengths
# ---------------------------------------------------------------------------

SHORT_TEXTS = [
    # Sample 1 — Science (under 500 words)
    """The water cycle describes how water moves through the Earth's environment.
    Water evaporates from oceans, lakes, and rivers when heated by the sun.
    It rises into the atmosphere as water vapour. As it cools, it condenses
    into clouds. When clouds hold enough water, precipitation occurs — rain,
    snow, or hail falls back to the ground. This water then flows into rivers
    and oceans or soaks into the ground, beginning the cycle again.""",

    # Sample 2 — History (under 500 words)
    """The Industrial Revolution began in Britain in the late 18th century.
    It marked a shift from hand production to machine manufacturing.
    Steam engines powered factories and transformed transportation through
    railways and steamships. Cities grew rapidly as workers moved from
    farms to urban factories. Working conditions were often dangerous,
    with long hours and low pay. Child labour was common. These conditions
    eventually led to the rise of trade unions and labour reform movements.""",

    # Sample 3 — Geography (under 500 words)
    """Volcanoes are openings in the Earth's crust where molten rock, ash,
    and gases escape from below the surface. The molten rock beneath the
    surface is called magma. When it erupts and reaches the surface, it
    is called lava. Volcanoes form at tectonic plate boundaries, where
    plates collide or pull apart. The Ring of Fire around the Pacific Ocean
    is home to over 75 percent of the world's active volcanoes. Famous
    examples include Mount Fuji in Japan and Mount Vesuvius in Italy.""",

    # Sample 4 — Health (under 500 words)
    """The human heart is a muscular organ that pumps blood around the body.
    It beats approximately 70 times per minute at rest. The heart has four
    chambers: two atria and two ventricles. Oxygen-poor blood enters the
    right side of the heart and is pumped to the lungs. There it picks up
    oxygen. The oxygen-rich blood returns to the left side of the heart
    and is pumped to the rest of the body. Regular exercise strengthens
    the heart muscle and reduces the risk of heart disease.""",

    # Sample 5 — Technology (under 500 words)
    """The internet is a global network of computers connected together.
    It was developed in the 1960s by the United States military as a way
    to share information. The World Wide Web, invented by Tim Berners-Lee
    in 1989, made the internet accessible to ordinary people. Web pages
    are written in HTML and connected by hyperlinks. Today billions of
    people use the internet for communication, education, shopping, and
    entertainment. The internet has transformed nearly every aspect of
    modern life.""",
]

LONG_TEXT = """
Photosynthesis is one of the most important biological processes on Earth. It is
the mechanism by which plants, algae, and some bacteria convert light energy into
chemical energy stored in glucose. This process forms the foundation of nearly all
food chains and ecosystems on the planet. Without photosynthesis, the oxygen in our
atmosphere would not exist, and most life forms as we know them could not survive.

The process of photosynthesis takes place primarily in the leaves of plants, within
organelles called chloroplasts. Chloroplasts contain a green pigment known as
chlorophyll, which is responsible for absorbing light energy, particularly from the
red and blue parts of the visible spectrum. Green light is mostly reflected, which
is why plants appear green to our eyes.

Photosynthesis can be divided into two main stages. The first stage is called the
light-dependent reactions. These occur in the thylakoid membranes inside the
chloroplasts. During this stage, light energy is absorbed by chlorophyll and used to
split water molecules into hydrogen and oxygen. The oxygen is released as a byproduct
into the atmosphere. The energy captured from light is used to produce molecules called
ATP and NADPH, which are energy carriers that power the second stage.

The second stage is called the Calvin cycle, or the light-independent reactions. This
takes place in the stroma of the chloroplast. During the Calvin cycle, carbon dioxide
from the air is fixed into organic molecules using the energy from ATP and NADPH. Through
a series of enzyme-driven reactions, carbon dioxide is converted into glucose. This glucose
can then be used by the plant as an energy source for growth, reproduction, and other
metabolic processes, or it can be stored as starch for later use.

Several environmental factors affect the rate of photosynthesis. Light intensity is one
of the most significant — as light intensity increases, the rate of photosynthesis
increases up to a certain point, after which other factors become limiting. Carbon dioxide
concentration also affects the rate; higher concentrations generally lead to faster
photosynthesis, provided light and temperature are adequate.

Temperature plays a role because photosynthesis involves enzyme-driven reactions, and
enzymes work most efficiently within a specific temperature range. Too high a temperature
causes the enzymes to denature and lose their function. Water availability is also critical,
as water is one of the raw materials for the light-dependent reactions. Plants that
experience water stress close their stomata to prevent water loss, which also reduces
the intake of carbon dioxide and slows photosynthesis significantly.

Understanding photosynthesis has important implications for agriculture, climate science,
and the development of renewable energy technologies. Scientists are studying how to
improve the efficiency of photosynthesis in crop plants to increase food production.
Others are researching artificial photosynthesis as a way to produce clean fuel from
sunlight and water, mimicking what plants do naturally but using synthetic materials.

The study of photosynthesis has also deepened our understanding of how life
first appeared on Earth. Early photosynthetic organisms were among the first
forms of life to produce oxygen, fundamentally transforming the atmosphere
over billions of years. This process, known as the Great Oxidation Event,
made complex life possible. Today researchers continue to investigate how
artificial systems could replicate this efficiency to address global energy
challenges and reduce dependence on fossil fuels.
""".strip()

ALL_PROFILES = ["dyslexia", "adhd", "autism", "intellectual_disability"]

COMORBID_PROFILES = [
    ["dyslexia", "adhd"],
    ["autism", "intellectual_disability"],
]

PATHWAY_STAGES = ["Foundation", "Intermediate", "Pre-vocational", "Vocational"]


def make_learner_context(profiles, language_level=2, content_difficulty=2, pathway_stage="Foundation"):
    return {
        "learner_id": "test-day10",
        "cognitive_profiles": profiles,
        "language_level": language_level,
        "content_difficulty": content_difficulty,
        "pathway_stage": pathway_stage,
    }


def assert_lesson_json(data: dict, profile_label: str):
    """Assert a response is a valid LessonJSON."""
    assert "title" in data,             f"Missing title — profile: {profile_label}"
    assert "sections" in data,          f"Missing sections — profile: {profile_label}"
    assert len(data["sections"]) > 0,   f"Empty sections — profile: {profile_label}"
    assert "key_terms" in data,         f"Missing key_terms — profile: {profile_label}"
    assert "estimated_minutes" in data, f"Missing estimated_minutes — profile: {profile_label}"
    assert "profile" in data,           f"Missing profile field — profile: {profile_label}"
    assert "stage_flags" in data,       f"Missing stage_flags — profile: {profile_label}"

    flags = data["stage_flags"]
    assert "verification_triggered" in flags, f"Missing verification_triggered"
    assert "correction_applied" in flags,     f"Missing correction_applied"
    assert "profile_merged" in flags,         f"Missing profile_merged"

    for section in data["sections"]:
        assert "heading" in section, f"Section missing heading — profile: {profile_label}"
        assert "body" in section,    f"Section missing body — profile: {profile_label}"
        assert "reading_level" in section, f"Section missing reading_level"


def assert_quiz_response(data: dict, profile_label: str, expected_count: int = 5):
    """Assert a response is a valid QuizResponse."""
    assert "questions" in data, f"Missing questions — profile: {profile_label}"
    assert len(data["questions"]) == expected_count, (
        f"Expected {expected_count} questions, got {len(data['questions'])} — profile: {profile_label}"
    )
    for q in data["questions"]:
        assert "id" in q,          f"Question missing id — profile: {profile_label}"
        assert "text" in q,        f"Question missing text — profile: {profile_label}"
        assert "options" in q,     f"Question missing options — profile: {profile_label}"
        assert "correct_id" in q,  f"Question missing correct_id — profile: {profile_label}"
        assert "explanation" in q, f"Question missing explanation — profile: {profile_label}"
        assert len(q["options"]) == 4, f"Question should have 4 options — profile: {profile_label}"
        option_ids = {opt["id"] for opt in q["options"]}
        assert q["correct_id"] in option_ids, (
            f"correct_id '{q['correct_id']}' not in options {option_ids}"
        )


def assert_adaptive_response(data: dict, profile_label: str):
    """Assert a response is a valid AdaptiveResponse."""
    assert "learner_message" in data, f"Missing learner_message — profile: {profile_label}"
    assert "directive" in data,       f"Missing directive — profile: {profile_label}"
    assert data["directive"] in {"easier", "same", "harder", "revisit"}, (
        f"Invalid directive '{data['directive']}' — profile: {profile_label}"
    )
    assert len(data["learner_message"]) > 0, f"Empty learner_message — profile: {profile_label}"


def assert_wrong_answer_flow(data: dict, profile_label: str):
    """Assert a response is a valid WrongAnswerFlowResponse."""
    assert "re_explanation" in data,    f"Missing re_explanation — profile: {profile_label}"
    assert "reattempt_question" in data, f"Missing reattempt_question — profile: {profile_label}"
    assert len(data["re_explanation"]) > 0,    f"Empty re_explanation — profile: {profile_label}"
    assert len(data["reattempt_question"]) > 0, f"Empty reattempt_question — profile: {profile_label}"


# ---------------------------------------------------------------------------
# Health check — must always pass
# ---------------------------------------------------------------------------

def test_health():
    resp = httpx.get(f"{BASE_URL}/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    print("✅ /health OK")


# ---------------------------------------------------------------------------
# 20 simplify/text combinations — 5 texts × 4 profiles
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("profile", ALL_PROFILES)
@pytest.mark.parametrize("text_index,text", enumerate(SHORT_TEXTS))
def test_simplify_text_all_profiles_all_samples(profile, text_index, text):
    profile_label = profile
    payload = {
        "learner_context": make_learner_context([profile]),
        "raw_text": text,
    }
    resp = httpx.post(
        f"{BASE_URL}/ai/simplify/text",
        headers=JSON_HEADER,
        json=payload,
        timeout=30.0,
    )
    assert resp.status_code == 200, (
        f"Expected 200, got {resp.status_code} — profile: {profile_label}, "
        f"sample: {text_index} — body: {resp.text[:200]}"
    )
    assert_lesson_json(resp.json(), profile_label)
    assert resp.json()["stage_flags"]["verification_triggered"] is False, (
        f"Stage 3 should NOT fire for short text — profile: {profile_label}"
    )
    print(f"✅ simplify/text — {profile_label} — sample {text_index}")


# ---------------------------------------------------------------------------
# Stage 3 fires for long text — all 4 profiles
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("profile", ALL_PROFILES)
def test_stage3_fires_for_long_text(profile):
    word_count = len(LONG_TEXT.split())
    assert word_count > 500, f"Long text is only {word_count} words — must be > 500"

    payload = {
        "learner_context": make_learner_context([profile]),
        "raw_text": LONG_TEXT,
    }
    resp = httpx.post(
        f"{BASE_URL}/ai/simplify/text",
        headers=JSON_HEADER,
        json=payload,
        timeout=60.0,
    )
    assert resp.status_code == 200, (
        f"Expected 200, got {resp.status_code} — profile: {profile}"
    )
    data = resp.json()
    assert_lesson_json(data, profile)
    assert data["stage_flags"]["verification_triggered"] is True, (
        f"Stage 3 MUST fire for {word_count}-word text — profile: {profile}"
    )
    print(f"✅ Stage 3 fired — {profile} — {word_count} words")


# ---------------------------------------------------------------------------
# Comorbid profiles
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("profiles", COMORBID_PROFILES)
def test_comorbid_simplify(profiles):
    profile_label = f"{profiles[0]}+{profiles[1]}"
    payload = {
        "learner_context": make_learner_context(profiles),
        "raw_text": SHORT_TEXTS[0],
    }
    resp = httpx.post(
        f"{BASE_URL}/ai/simplify/text",
        headers=JSON_HEADER,
        json=payload,
        timeout=30.0,
    )
    assert resp.status_code == 200, (
        f"Expected 200, got {resp.status_code} — comorbid: {profile_label}"
    )
    data = resp.json()
    assert_lesson_json(data, profile_label)
    assert data["stage_flags"]["profile_merged"] is True, (
        f"profile_merged must be True for comorbid profiles — got: {data['stage_flags']}"
    )
    print(f"✅ Comorbid simplify — {profile_label}")


# ---------------------------------------------------------------------------
# Quiz generation — all 4 profiles
# ---------------------------------------------------------------------------

SAMPLE_LESSON = {
    "title": "The Water Cycle",
    "sections": [
        {
            "heading": "Water Moves",
            "body": "Water moves around the Earth. The sun heats water. Water goes up into the sky.",
            "visual_hint": "diagram of water cycle",
            "reading_level": 2,
        },
        {
            "heading": "Water Falls",
            "body": "Water in the sky forms clouds. When clouds get heavy, water falls as rain. Rain fills rivers and oceans.",
            "visual_hint": "photo of rain falling",
            "reading_level": 2,
        },
        {
            "heading": "The Cycle Repeats",
            "body": "The water cycle never stops. The same water is used again and again. This keeps our planet alive.",
            "visual_hint": "circular diagram of the water cycle",
            "reading_level": 2,
        },
    ],
    "key_terms": [
        {"term": "evaporation", "definition": "water turning into vapour and rising"},
        {"term": "precipitation", "definition": "water falling from clouds as rain or snow"},
    ],
    "estimated_minutes": 5,
    "profile": "dyslexia",
    "stage_flags": {
        "verification_triggered": False,
        "correction_applied": False,
        "profile_merged": False,
    },
}


@pytest.mark.parametrize("profile", ALL_PROFILES)
def test_quiz_generate_all_profiles(profile):
    payload = {
        "learner_context": make_learner_context([profile]),
        "lesson_json": SAMPLE_LESSON,
        "num_questions": 5,
    }
    resp = httpx.post(
        f"{BASE_URL}/ai/quiz/generate",
        headers=JSON_HEADER,
        json=payload,
        timeout=30.0,
    )
    assert resp.status_code == 200, (
        f"Expected 200, got {resp.status_code} — profile: {profile} — body: {resp.text[:200]}"
    )
    assert_quiz_response(resp.json(), profile)
    print(f"✅ Quiz generate — {profile}")


# ---------------------------------------------------------------------------
# Adaptive response — all 4 profiles × correct + wrong
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("profile", ALL_PROFILES)
@pytest.mark.parametrize("is_correct,latency_ms,expected_directives", [
    (True,  2000, {"harder"}),
    (False, 3000, {"revisit"}),
    (True,  6000, {"same"}),
    (False, 6000, {"easier"}),
])
def test_adaptive_response_all_profiles(profile, is_correct, latency_ms, expected_directives):
    payload = {
        "learner_context": make_learner_context([profile]),
        "question": "What happens to water when the sun heats it?",
        "selected_option": "It evaporates" if is_correct else "It freezes",
        "is_correct": is_correct,
        "latency_ms": latency_ms,
    }
    resp = httpx.post(
        f"{BASE_URL}/ai/quiz/adaptive-response",
        headers=JSON_HEADER,
        json=payload,
        timeout=15.0,
    )
    assert resp.status_code == 200, (
        f"Expected 200, got {resp.status_code} — profile: {profile} — body: {resp.text[:200]}"
    )
    data = resp.json()
    assert_adaptive_response(data, profile)
    print(f"✅ Adaptive — {profile} — correct={is_correct} latency={latency_ms}ms → {data['directive']}")


# ---------------------------------------------------------------------------
# Wrong answer flow — all 4 profiles
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("profile", ALL_PROFILES)
def test_wrong_answer_flow_all_profiles(profile):
    payload = {
        "learner_context": make_learner_context([profile]),
        "question": "What happens to water when the sun heats it?",
        "section_content": (
            "Water moves around the Earth. The sun heats water and it turns "
            "into water vapour. This is called evaporation. The water vapour "
            "rises into the sky and forms clouds. When clouds get heavy, water "
            "falls back down as rain or snow."
        ),
    }
    resp = httpx.post(
        f"{BASE_URL}/ai/quiz/wrong-answer-flow",
        headers=JSON_HEADER,
        json=payload,
        timeout=30.0,
    )
    assert resp.status_code == 200, (
        f"Expected 200, got {resp.status_code} — profile: {profile} — body: {resp.text[:200]}"
    )
    assert_wrong_answer_flow(resp.json(), profile)
    print(f"✅ Wrong answer flow — {profile}")


# ---------------------------------------------------------------------------
# Comorbid profiles — quiz + adaptive + wrong answer
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("profiles", COMORBID_PROFILES)
def test_comorbid_quiz_generate(profiles):
    profile_label = f"{profiles[0]}+{profiles[1]}"
    payload = {
        "learner_context": make_learner_context(profiles),
        "lesson_json": SAMPLE_LESSON,
        "num_questions": 5,
    }
    resp = httpx.post(
        f"{BASE_URL}/ai/quiz/generate",
        headers=JSON_HEADER,
        json=payload,
        timeout=30.0,
    )
    assert resp.status_code == 200, (
        f"Expected 200 — comorbid: {profile_label} — body: {resp.text[:200]}"
    )
    assert_quiz_response(resp.json(), profile_label)
    print(f"✅ Comorbid quiz — {profile_label}")


@pytest.mark.parametrize("profiles", COMORBID_PROFILES)
def test_comorbid_wrong_answer_flow(profiles):
    profile_label = f"{profiles[0]}+{profiles[1]}"
    payload = {
        "learner_context": make_learner_context(profiles),
        "question": "What happens to water when the sun heats it?",
        "section_content": (
            "Water moves around the Earth. The sun heats water and it turns "
            "into water vapour. The water vapour rises and forms clouds."
        ),
    }
    resp = httpx.post(
        f"{BASE_URL}/ai/quiz/wrong-answer-flow",
        headers=JSON_HEADER,
        json=payload,
        timeout=30.0,
    )
    assert resp.status_code == 200, (
        f"Expected 200 — comorbid: {profile_label} — body: {resp.text[:200]}"
    )
    assert_wrong_answer_flow(resp.json(), profile_label)
    print(f"✅ Comorbid wrong answer flow — {profile_label}")

