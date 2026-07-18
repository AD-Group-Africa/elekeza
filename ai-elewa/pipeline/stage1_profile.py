import os
import logging
from pathlib import Path
from models.requests import LearnerContext

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Path to prompts folder — resolved relative to this file
# ---------------------------------------------------------------------------

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

PROFILE_FILES = {
    "dyslexia":               "dyslexia.txt",
    "adhd":                   "adhd.txt",
    "autism":                 "autism.txt",
    "intellectual_disability": "intellectual_disability.txt",
}

# ---------------------------------------------------------------------------
# Comorbid merge priority table
# Defines which profile's rules take priority for each rule category
# Mirrors COMORBID_RULES.md exactly
# ---------------------------------------------------------------------------

COMORBID_PRIORITY = {
    frozenset(["dyslexia", "adhd"]): {
        "sentence_length":   "adhd",
        "vocabulary":        "dyslexia",
        "structure":         "adhd",
        "headings":          "adhd",
        "visuals":           "adhd",
        "engagement":        "adhd",
        "reading_level":     "dyslexia",
        "timing":            "adhd",
        "note": (
            "Sentence rhythm from ADHD takes priority — use 6–12 word range. "
            "Vocabulary and reading level from Dyslexia. "
            "Structure, headings, engagement, and visuals from ADHD. "
            "Reduce estimated_minutes by 20%."
        ),
    },
    frozenset(["dyslexia", "autism"]): {
        "sentence_length":   "dyslexia",
        "vocabulary":        "dyslexia",
        "figurative":        "autism",
        "structure":         "autism",
        "headings":          "autism",
        "cause_effect":      "autism",
        "tone":              "autism",
        "visuals":           "dyslexia",
        "note": (
            "Autism's literal language rule is non-negotiable — no idioms or metaphors. "
            "Dyslexia sentence length (max 12 words) and vocabulary apply. "
            "Autism 3-part section structure: fact → why → example. "
            "Factual statement headings. Calm, factual tone."
        ),
    },
    frozenset(["dyslexia", "intellectual_disability"]): {
        "sentence_length":   "intellectual_disability",
        "vocabulary":        "intellectual_disability",
        "structure":         "intellectual_disability",
        "summary":           "intellectual_disability",
        "visuals":           "intellectual_disability",
        "tone":              "intellectual_disability",
        "active_voice":      "dyslexia",
        "note": (
            "ID is the stricter baseline — max 8 words per sentence, 1000 common words. "
            "Dyslexia active voice rule applied on top. "
            "Max 3 sections, max 2 sentences per paragraph. "
            "Every section ends with 'Remember:' sentence. "
            "Reading age 8–10 regardless of language_level."
        ),
    },
    frozenset(["adhd", "autism"]): {
        "sentence_length":   "autism",
        "vocabulary":        "autism",
        "figurative":        "autism",
        "structure":         "autism",
        "headings":          "adhd",
        "engagement":        "adhd",
        "transitions":       "autism",
        "visuals":           "adhd",
        "timing":            "adhd",
        "note": (
            "Autism structural and language rules dominate. "
            "ADHD engagement (hook sentence, second-person, dynamic visuals) layered on top. "
            "Headings: factual questions (satisfies both profiles). "
            "Explicit transition signals required. "
            "Reduce estimated_minutes by 20%."
        ),
    },
    frozenset(["adhd", "intellectual_disability"]): {
        "sentence_length":   "intellectual_disability",
        "vocabulary":        "intellectual_disability",
        "structure":         "adhd",
        "headings":          "adhd",
        "engagement":        "adhd",
        "summary":           "intellectual_disability",
        "visuals":           "adhd",
        "timing":            "adhd",
        "tone":              "intellectual_disability",
        "note": (
            "ID vocabulary and sentence length limits are non-negotiable. "
            "ADHD structural energy applied within those limits: chunks, hooks, numbered steps. "
            "Every section ends with 'Remember:' sentence. "
            "Warm encouraging tone. Reduce estimated_minutes by 20%."
        ),
    },
    frozenset(["autism", "intellectual_disability"]): {
        "sentence_length":   "intellectual_disability",
        "vocabulary":        "intellectual_disability",
        "figurative":        "autism",
        "structure":         "intellectual_disability",
        "cause_effect":      "autism",
        "transitions":       "autism",
        "summary":           "intellectual_disability",
        "visuals":           "intellectual_disability",
        "tone":              "intellectual_disability",
        "note": (
            "Most restrictive combination. ID sentence and vocabulary limits apply. "
            "Autism precision and literal language layer on top without conflict. "
            "Explicit transitions in simple language. "
            "Every section ends with 'Remember:' sentence. "
            "Concrete photo-based visuals. Warm and calm tone."
        ),
    },
}


def _load_profile(profile: str) -> str:
    """Load a single profile prompt file."""
    path = PROMPTS_DIR / PROFILE_FILES[profile]
    return path.read_text(encoding="utf-8")


def _build_comorbid_prompt(profile_a: str, profile_b: str) -> str:
    """
    Merge two profile prompts using the priority rules from COMORBID_RULES.md.
    Returns a single merged system prompt string.
    """
    key = frozenset([profile_a, profile_b])
    rules = COMORBID_PRIORITY.get(key)

    if rules is None:
        # Fallback — should never happen given validation, but safe default
        logger.warning(f"No comorbid rules found for {profile_a}+{profile_b}, concatenating")
        return _load_profile(profile_a) + "\n\n" + _load_profile(profile_b)

    text_a = _load_profile(profile_a)
    text_b = _load_profile(profile_b)

    merged = f"""PROFILE: Comorbid — {profile_a.upper()} + {profile_b.upper()}

This learner presents two cognitive profiles. Rules have been merged according
to priority guidelines. Where profiles conflict, the priority rule applies.

MERGE PRIORITY NOTE:
{rules['note']}

--- RULES FROM {profile_a.upper()} PROFILE ---
{text_a}

--- RULES FROM {profile_b.upper()} PROFILE ---
{text_b}

--- ACTIVE PRIORITY OVERRIDES ---
"""
    for category, winner in rules.items():
        if category == "note":
            continue
        merged += f"- {category.upper()}: follow {winner.upper()} profile rules\n"

    return merged


def build_system_prompt(learner_context: LearnerContext) -> str:
    """
    Pure function — no API call.
    Builds the complete system prompt for the AI based on learner context.
    Single profile: loads that profile's .txt directly.
    Two profiles: applies comorbid merge logic.
    Injects language_level, content_difficulty, pathway_stage into the prompt.
    """
    profiles = learner_context.cognitive_profiles

    if len(profiles) == 1:
        base_prompt = _load_profile(profiles[0])
        profile_label = profiles[0]
    else:
        base_prompt = _build_comorbid_prompt(profiles[0], profiles[1])
        profile_label = f"{profiles[0]}+{profiles[1]}"

    # Inject learner context into the prompt
    context_block = f"""
--- LEARNER CONTEXT ---
Profile: {profile_label}
Language Level: {learner_context.language_level} (1=basic, 2=intermediate, 3=advanced)
Content Difficulty: {learner_context.content_difficulty} (1=easy, 2=medium, 3=hard)
Pathway Stage: {learner_context.pathway_stage}

Apply the language_level and content_difficulty values when choosing vocabulary
complexity and sentence structure. A learner at language_level 1 needs simpler
language than a learner at language_level 3, even within the same profile.
"""

    return base_prompt + context_block
