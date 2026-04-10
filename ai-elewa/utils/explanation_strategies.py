"""
Profile-specific re-explanation strategies for the Elewa AI service.

When a learner answers a question incorrectly, the wrong-answer flow
re-explains the concept before presenting a new version of the question.

The current re-explanation prompt adjusts vocabulary per profile but
uses the same paragraph structure for everyone. This is a significant
accessibility problem:

  - A paragraph is the worst possible format for a dyslexic learner
    who has just failed a question. The decoding load compounds the
    emotional load of getting something wrong.

  - An ADHD learner who gets an explanation that builds towards the
    answer will disengage before reaching it. They need the answer
    immediately, then the explanation.

  - An autistic learner receiving an analogy-based explanation ("it is
    like a factory...") will be confused rather than helped. Autistic
    learners need literal cause-and-effect, not metaphor.

  - An ID learner receiving a paragraph has no structural anchor to
    hold onto. The Tell-Show-Remind pattern gives three explicit handholds.

This module defines the four structural strategies, builds the system
prompt block for each, and provides a detection function for validating
that the model's output follows the requested structure.

Strategy definitions:

  numbered_steps (Dyslexia)
    Three numbered sentences. Each sentence is one idea.
    Maximum 12 words per sentence. No paragraphs.
    Example:
      1. Water gets warm from the sun.
      2. Warm water turns into vapour.
      3. Vapour rises up and forms clouds.

  answer_first (ADHD)
    The correct answer is stated in the first sentence.
    One short explanation follows. Maximum 3 sentences total.
    Example:
      The correct answer is evaporation.
      This happens because heat gives water molecules energy to escape.
      That is why puddles disappear on a sunny day.

  cause_effect (Autism)
    Strict cause-and-effect chain. No analogies. No idioms.
    Each sentence states a fact or a direct cause-and-effect relationship.
    Format: "X happens because Y. Y happens because Z."
    Example:
      Water evaporates because heat gives it energy.
      Energy causes water molecules to move faster.
      Faster-moving molecules escape into the air as vapour.

  tell_show_remind (Intellectual Disability)
    Three-part structure: fact, real-world example, memory anchor.
    Maximum 8 words per sentence. Ends with "Remember: [one sentence]."
    Example:
      Water turns into air when it gets hot.
      Think of a wet puddle on a sunny day.
      The puddle goes away because the water turned into air.
      Remember: heat turns water into air.
"""

import logging
import re
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Strategy name constants
# ---------------------------------------------------------------------------

STRATEGY_NUMBERED_STEPS  = "numbered_steps"
STRATEGY_ANSWER_FIRST    = "answer_first"
STRATEGY_CAUSE_EFFECT    = "cause_effect"
STRATEGY_TELL_SHOW_REMIND = "tell_show_remind"
STRATEGY_PARAGRAPH       = "paragraph"   # fallback only

VALID_STRATEGIES = {
    STRATEGY_NUMBERED_STEPS,
    STRATEGY_ANSWER_FIRST,
    STRATEGY_CAUSE_EFFECT,
    STRATEGY_TELL_SHOW_REMIND,
    STRATEGY_PARAGRAPH,
}


# ---------------------------------------------------------------------------
# Strategy dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ExplanationStrategy:
    """
    Defines the structural strategy for a re-explanation.

    strategy_name:       identifier used in WrongAnswerFlowResponse.explanation_strategy
    profile_name:        human-readable profile label for logging
    max_sentence_words:  hard maximum words per sentence in the re-explanation
    max_total_sentences: maximum number of sentences in the re-explanation
    system_prompt_block: the instruction block injected into the re-explanation
                         system prompt for this strategy
    structure_markers:   strings that must appear in a correctly-structured
                         output — used for lightweight validation
    """
    strategy_name: str
    profile_name: str
    max_sentence_words: int
    max_total_sentences: int
    system_prompt_block: str
    structure_markers: list[str]


# ---------------------------------------------------------------------------
# Strategy instances
# ---------------------------------------------------------------------------

NUMBERED_STEPS_STRATEGY = ExplanationStrategy(
    strategy_name=STRATEGY_NUMBERED_STEPS,
    profile_name="Dyslexia",
    max_sentence_words=12,
    max_total_sentences=3,
    system_prompt_block="""
RE-EXPLANATION STRUCTURE — DYSLEXIA PROFILE:

You must write exactly 3 numbered steps. No more. No fewer.
Each step is exactly one sentence.
Each sentence must be 12 words or fewer.
Never write a paragraph. Never combine two ideas in one sentence.

Format your re-explanation exactly like this:
1. [One short sentence — first idea.]
2. [One short sentence — second idea.]
3. [One short sentence — third idea.]

Rules:
- Active voice only. Never passive.
- Shortest possible word for every concept.
- No sentence may exceed 12 words.
- No introductory text before the numbered steps.
- No summary sentence after the numbered steps.
- Just the three steps. Nothing else.

Example of correct output:
1. Water gets warm from the sun.
2. Warm water turns into vapour.
3. Vapour rises up and forms clouds.
""",
    structure_markers=["1.", "2.", "3."],
)

ANSWER_FIRST_STRATEGY = ExplanationStrategy(
    strategy_name=STRATEGY_ANSWER_FIRST,
    profile_name="ADHD",
    max_sentence_words=16,
    max_total_sentences=3,
    system_prompt_block="""
RE-EXPLANATION STRUCTURE — ADHD PROFILE:

State the correct answer in the very first sentence.
Never build towards the answer — give it immediately.
Follow with one or two short explanation sentences.
Maximum 3 sentences total.

Format your re-explanation exactly like this:
The correct answer is [answer] because [one-line reason].
[One sentence explaining the key idea.]
[Optional: one sentence with a punchy real-world connection.]

Rules:
- First sentence MUST start with "The correct answer is"
- Maximum 3 sentences total.
- Keep each sentence under 16 words.
- Second sentence explains the mechanism simply.
- Third sentence (optional) connects to real life — make it vivid.
- No lengthy build-up. No "Let me explain..." or "First, we need to understand..."

Example of correct output:
The correct answer is evaporation because heat turns water into vapour.
Heat gives water molecules enough energy to escape into the air.
That is why a wet floor dries faster on a hot day.
""",
    structure_markers=["The correct answer is"],
)

CAUSE_EFFECT_STRATEGY = ExplanationStrategy(
    strategy_name=STRATEGY_CAUSE_EFFECT,
    profile_name="Autism",
    max_sentence_words=20,
    max_total_sentences=4,
    system_prompt_block="""
RE-EXPLANATION STRUCTURE — AUTISM PROFILE:

Use strict cause-and-effect sentences only.
Every sentence must state a fact or a direct cause-and-effect relationship.
Chain the sentences so each one leads logically to the next.

Format: "X happens because Y. Y happens because Z."

Rules:
- No analogies. No metaphors. No "it is like..." or "imagine that..."
- No idioms or figurative language of any kind.
- Every claim must be literally true.
- Each sentence must be self-contained and unambiguous.
- Maximum 4 sentences.
- Maximum 20 words per sentence.
- No introductory phrases like "Let me explain" or "Think about it this way."
- No emotional language. Calm and factual throughout.
- Use "because" to connect cause and effect explicitly.

Example of correct output:
Water evaporates because heat gives water molecules enough energy to move.
Moving molecules escape from the liquid surface into the air.
This process happens faster when the temperature is higher.
The escaped water molecules form water vapour in the atmosphere.
""",
    structure_markers=["because"],
)

TELL_SHOW_REMIND_STRATEGY = ExplanationStrategy(
    strategy_name=STRATEGY_TELL_SHOW_REMIND,
    profile_name="Intellectual Disability",
    max_sentence_words=8,
    max_total_sentences=4,
    system_prompt_block="""
RE-EXPLANATION STRUCTURE — INTELLECTUAL DISABILITY PROFILE:

Use the Tell-Show-Remind structure. Always. Every time.

Part 1 — TELL: State the fact in one simple sentence.
Part 2 — SHOW: Give one real-world example in one simple sentence.
Part 3 — REMIND: End with exactly this format: "Remember: [one short sentence]."

Rules:
- Maximum 8 words per sentence. No exceptions.
- Use only common, everyday words.
- No technical vocabulary unless it has already been defined.
- Warm, encouraging tone throughout.
- The "Remember:" sentence must be the last sentence.
- No sentence may exceed 8 words.
- No paragraphs. Each part is one sentence only.

Example of correct output:
Water turns into air when it gets hot.
A wet puddle on a sunny day dries up.
The water turned into air and went away.
Remember: heat turns water into air.
""",
    structure_markers=["Remember:"],
)

_FALLBACK_STRATEGY = ExplanationStrategy(
    strategy_name=STRATEGY_PARAGRAPH,
    profile_name="Generic",
    max_sentence_words=15,
    max_total_sentences=6,
    system_prompt_block="""
RE-EXPLANATION STRUCTURE:
Write a clear, concise explanation of the concept.
Use simple language. Maximum 4 sentences.
""",
    structure_markers=[],
)


# ---------------------------------------------------------------------------
# Profile → strategy mapping
# ---------------------------------------------------------------------------

_PROFILE_STRATEGIES: dict[str, ExplanationStrategy] = {
    "dyslexia":                NUMBERED_STEPS_STRATEGY,
    "adhd":                    ANSWER_FIRST_STRATEGY,
    "autism":                  CAUSE_EFFECT_STRATEGY,
    "intellectual_disability": TELL_SHOW_REMIND_STRATEGY,
}

# Priority order for comorbid profile resolution —
# most protective (simplest structure) takes precedence
_COMORBID_PRIORITY = [
    "intellectual_disability",
    "autism",
    "dyslexia",
    "adhd",
]


def get_strategy(profile: str) -> ExplanationStrategy:
    """
    Return the explanation strategy for a profile.

    For comorbid profiles, uses the strategy of the primary profile
    following the priority order:
        intellectual_disability > autism > dyslexia > adhd

    The primary profile's strategy takes full precedence because
    mixing structural strategies produces incoherent output.
    """
    if "+" in profile:
        parts = [p.strip() for p in profile.split("+")]
        for p in _COMORBID_PRIORITY:
            if p in parts:
                logger.debug(
                    f"Comorbid profile '{profile}': using '{p}' strategy "
                    f"({_PROFILE_STRATEGIES[p].strategy_name})"
                )
                return _PROFILE_STRATEGIES[p]

    return _PROFILE_STRATEGIES.get(profile, _FALLBACK_STRATEGY)


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def build_reexplanation_system_prompt(profile: str) -> str:
    """
    Build the complete system prompt for the re-explanation call.

    Combines the base instruction with the profile-specific structure block.
    This replaces the static REEXPLAIN_SYSTEM_PROMPT in endpoints/quiz.py.

    Args:
        profile: cognitive profile label (may be comorbid e.g. 'dyslexia+adhd')

    Returns:
        Complete system prompt string for the re-explanation AI call.
    """
    strategy = get_strategy(profile)

    base = """You are a re-explanation assistant for learners with cognitive disabilities.
A learner answered a quiz question incorrectly.
You will be given the question and the lesson section it came from.

Your job is to re-explain the concept so the learner understands it
before attempting the question again.

CRITICAL: You must follow the structure instructions below exactly.
The structure is not a suggestion — it is a requirement.
Learners with cognitive disabilities rely on predictable structure.
Deviating from the structure makes the explanation harder to process,
not easier.
"""

    return base + strategy.system_prompt_block


# ---------------------------------------------------------------------------
# Output validation
# ---------------------------------------------------------------------------

def validate_explanation_structure(
    text: str,
    strategy: ExplanationStrategy,
) -> tuple[bool, list[str]]:
    """
    Lightly validate that a re-explanation follows the expected structure.

    This is a heuristic check — not exhaustive. It checks for the presence
    of structure markers and sentence count. It does not parse the full
    linguistic structure.

    Numbered list markers (e.g. "1.", "2.", "3.") are stripped before
    sentence splitting to avoid false-positive sentence count failures.

    Returns:
        (passes: bool, issues: list[str])
        issues is empty when passes is True.
    """
    if not text or not text.strip():
        return False, ["Re-explanation is empty."]

    issues = []

    # Check structure markers are present
    lower = text.lower()
    for marker in strategy.structure_markers:
        if marker.lower() not in lower:
            issues.append(
                f"Expected structure marker '{marker}' not found in re-explanation. "
                f"Strategy '{strategy.strategy_name}' requires this marker."
            )

    # Normalise numbered list markers before sentence splitting.
    # Removes patterns like "1. ", "2. ", "a. " so the dot in the marker
    # does not fragment the sentence count.
    normalised_text = re.sub(r"(?<!\w)(\d+|[a-zA-Z])\.\s*", " ", text)

    # Split into sentences on standard sentence-ending punctuation
    sentences = [
        s.strip()
        for s in re.split(r"[.!?]+", normalised_text)
        if s.strip()
    ]

    # Check sentence count
    if len(sentences) > strategy.max_total_sentences:
        issues.append(
            f"Re-explanation has {len(sentences)} sentences — "
            f"maximum for {strategy.strategy_name} is {strategy.max_total_sentences}."
        )

    # Check individual sentence length
    for i, sentence in enumerate(sentences):
        word_count = len(sentence.split())
        if word_count > strategy.max_sentence_words:
            issues.append(
                f"Sentence {i + 1} has {word_count} words — "
                f"maximum for {strategy.strategy_name} is "
                f"{strategy.max_sentence_words}."
            )

    return len(issues) == 0, issues