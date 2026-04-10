import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Valid types and their aliases
# ---------------------------------------------------------------------------

VALID_TYPES = {
    "photo",
    "diagram",
    "illustration",
    "step_diagram",
    "comparison",
    "animation_suggestion",
}

# Keywords in the hint text that map to each type.
# Order matters — more specific patterns are listed first.
_TYPE_PATTERNS: list[tuple[str, list[str]]] = [
    ("step_diagram", [
        "step", "steps", "numbered", "sequence", "how to", "process diagram",
        "flow", "flowchart", "stages diagram", "numbered diagram",
    ]),
    ("comparison", [
        "comparison", "compare", "before and after", "before/after",
        "side by side", "side-by-side", "versus", "difference between",
        "contrast",
    ]),
    ("animation_suggestion", [
        "animation", "animated", "interactive", "moving", "video",
        "gif", "motion", "dynamic",
    ]),
    ("diagram", [
        "diagram", "schematic", "chart", "model", "molecular",
        "structure", "cross-section", "cross section", "scientific",
        "technical", "blueprint", "map", "network", "cycle diagram",
        "labelled", "labeled",
    ]),
    ("illustration", [
        "illustration", "drawing", "cartoon", "sketch", "artwork",
        "comic", "infographic", "icon", "depicted", "drawn",
    ]),
    ("photo", [
        "photograph", "photo", "picture", "image", "real", "actual",
        "showing", "of a", "of an", "of the", "scene", "landscape",
        "person", "people", "child", "children", "classroom", "school",
        "river", "lake", "ocean", "mountain", "plant", "animal",
        "food", "home", "family", "market", "farm", "field",
    ]),
]

# Default type when no pattern matches
_DEFAULT_TYPE = "illustration"

# Profiles that forbid animation_suggestion
_NO_ANIMATION_PROFILES = {"autism", "intellectual_disability"}

# Profiles that require only concrete types
_CONCRETE_ONLY_PROFILES = {"intellectual_disability"}
_CONCRETE_TYPES = {"photo", "illustration"}

# Abstract → concrete rewrite patterns for ID profile.
# Keys are substrings to detect in the hint text (lowercase).
# Values are concrete replacement templates.
_ABSTRACT_TO_CONCRETE: list[tuple[str, str]] = [
    # Scientific/molecular
    ("molecular", "photo of the substance in everyday life"),
    ("molecule", "photo of the substance in everyday life"),
    ("atom", "photo of everyday objects made from this material"),
    ("chemical", "photo of this substance in daily use"),
    ("biochemical", "photo showing this process in nature"),
    ("photosynthesis diagram", "photo of a plant growing in sunlight"),
    ("cellular", "simple illustration of the cell as a round shape"),
    ("chromosome", "illustration of the body part this affects"),

    # Scientific diagrams
    ("cross-section", "illustration showing what this looks like from outside"),
    ("cross section", "illustration showing what this looks like from outside"),
    ("schematic", "photo of the real object this describes"),
    ("technical diagram", "photo of this in real life"),
    ("scientific diagram", "photo of this in real life"),
    ("labelled diagram", "photo of the real object with simple labels"),
    ("labeled diagram", "photo of the real object with simple labels"),
    ("chart", "simple illustration showing the main idea"),
    ("graph", "simple illustration showing more and less"),
    ("model", "photo of a real example of this"),

    # Abstract processes
    ("water cycle diagram", "photo of rain falling into a river"),
    ("cycle diagram", "photo showing one step of this process in real life"),
    ("flow diagram", "illustration of the steps as simple pictures"),
    ("flowchart", "illustration of the steps as numbered pictures"),
    ("network diagram", "photo of people or things connected together"),

    # Generic abstract fallbacks
    ("diagram", "photo of a real example of this"),
    ("abstract", "photo of a real example of this"),
    ("structure", "photo of the real thing this describes"),
]


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def classify_hint(hint: str) -> str:
    """
    Classify a free-form visual hint string into a structured type.

    Matching is case-insensitive and searches for keyword patterns
    in the hint text. More specific patterns take priority over general ones.
    Returns 'illustration' as the default when no pattern matches.

    Args:
        hint: the raw visual_hint string from the AI response

    Returns:
        one of: photo, diagram, illustration, step_diagram,
                comparison, animation_suggestion
    """
    if not hint or not hint.strip():
        return _DEFAULT_TYPE

    lower = hint.lower()

    for type_name, keywords in _TYPE_PATTERNS:
        if any(kw in lower for kw in keywords):
            return type_name

    return _DEFAULT_TYPE


# ---------------------------------------------------------------------------
# Profile validation
# ---------------------------------------------------------------------------

def validate_hint_type(
    hint_type: str,
    profile: str,
    language_level: int,
) -> tuple[bool, Optional[str]]:
    """
    Validate whether a hint type is appropriate for a profile and level.

    Returns:
        (valid: bool, reason: Optional[str])
        reason is None when valid, a human-readable explanation when not.
    """
    # Extract the base profile from comorbid labels
    base_profiles = [p.strip() for p in profile.split("+")] if "+" in profile else [profile]

    for base in base_profiles:
        # Animation never allowed for autism or ID
        if base in _NO_ANIMATION_PROFILES and hint_type == "animation_suggestion":
            return False, (
                f"animation_suggestion is not appropriate for {base} profile. "
                f"Unexpected motion is cognitively disruptive."
            )

        # ID requires concrete types only
        if base in _CONCRETE_ONLY_PROFILES and hint_type not in _CONCRETE_TYPES:
            return False, (
                f"'{hint_type}' is abstract and not appropriate for {base} profile. "
                f"Must be 'photo' or 'illustration' — concrete visuals only."
            )

        # Diagram is only appropriate from language_level 2 onward for dyslexia
        if base == "dyslexia" and hint_type == "diagram" and language_level < 2:
            return False, (
                f"'diagram' is too abstract for dyslexia profile at language_level 1. "
                f"Use 'illustration' or 'photo' instead."
            )

    return True, None


# ---------------------------------------------------------------------------
# Abstract → concrete rewriting
# ---------------------------------------------------------------------------

def rewrite_to_concrete(hint: str) -> str:
    """
    Rewrite an abstract visual hint to a concrete equivalent.

    Applied when the profile requires concrete visuals (ID profile)
    but the model produced an abstract hint. Rewrites are pattern-based
    and deterministic — no API call required.

    Examples:
        "molecular diagram of water" → "photo of water in a glass"
        "cycle diagram of photosynthesis" → "photo of a plant growing in sunlight"
        "schematic of the heart" → "photo of the real object this describes"

    Args:
        hint: the original abstract visual hint

    Returns:
        a concrete replacement hint string
    """
    lower = hint.lower()

    for pattern, replacement in _ABSTRACT_TO_CONCRETE:
        if pattern in lower:
            logger.debug(
                f"Visual hint rewrite: '{hint[:60]}' → '{replacement}' "
                f"(matched pattern: '{pattern}')"
            )
            return replacement

    # No pattern matched — use a generic concrete fallback
    logger.debug(
        f"Visual hint rewrite: no specific pattern matched for '{hint[:60]}'. "
        f"Using generic photo fallback."
    )
    return "photo of a real-life example of this concept"


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def standardise_hint(
    hint: Optional[str],
    heading: str,
    profile: str,
    language_level: int,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Standardise a visual hint for a given profile and language level.

    Pipeline:
      1. Classify the hint into a structured type.
      2. Validate the type against profile rules.
      3. If invalid and profile requires concrete visuals: rewrite the hint.
      4. If invalid for other reasons (e.g. animation for autism): reclassify
         the rewritten or downgraded hint.

    Args:
        hint:           the raw visual_hint string (may be None)
        heading:        section heading, used for logging only
        profile:        cognitive profile label (may be comorbid e.g. 'dyslexia+adhd')
        language_level: 1, 2, or 3

    Returns:
        (final_hint: str | None, hint_type: str | None, warning: str | None)
        warning is non-None when a rewrite or downgrade was applied.
    """
    if not hint or not hint.strip():
        # No hint provided — return None with no type and no warning
        return None, None, None

    # Step 1 — Classify
    hint_type = classify_hint(hint)

    # Step 2 — Validate
    valid, reason = validate_hint_type(hint_type, profile, language_level)

    if valid:
        return hint, hint_type, None

    # Step 3/4 — Invalid — apply profile-specific correction
    base_profiles = [p.strip() for p in profile.split("+")] if "+" in profile else [profile]

    # ID profile: rewrite the hint text to something concrete
    if any(p in _CONCRETE_ONLY_PROFILES for p in base_profiles):
        rewritten = rewrite_to_concrete(hint)
        new_type = classify_hint(rewritten)

        # Ensure the rewritten hint classifies as concrete
        if new_type not in _CONCRETE_TYPES:
            new_type = "photo"

        warning = (
            f"Section '{heading}': visual hint rewritten for {profile} profile. "
            f"Original: '{hint[:60]}' ({hint_type}) → "
            f"Rewritten: '{rewritten[:60]}' ({new_type})."
        )
        logger.info(f"Visual hint standardiser — {warning}")
        return rewritten, new_type, warning

    # Autism profile: downgrade animation_suggestion to illustration
    if any(p == "autism" for p in base_profiles) and hint_type == "animation_suggestion":
        downgraded_hint = hint  # keep the original text, change only the type
        new_type = "illustration"
        warning = (
            f"Section '{heading}': visual hint type downgraded from "
            f"'animation_suggestion' to 'illustration' for autism profile. "
            f"Unexpected motion is cognitively disruptive."
        )
        logger.info(f"Visual hint standardiser — {warning}")
        return downgraded_hint, new_type, warning

    # Dyslexia L1: downgrade diagram to illustration
    if any(p == "dyslexia" for p in base_profiles) and hint_type == "diagram" and language_level < 2:
        new_type = "illustration"
        warning = (
            f"Section '{heading}': visual hint type downgraded from "
            f"'diagram' to 'illustration' for dyslexia profile at language_level 1."
        )
        logger.info(f"Visual hint standardiser — {warning}")
        return hint, new_type, warning

    # Fallback — no specific rewrite rule — keep hint text, downgrade type
    return hint, "illustration", (
        f"Section '{heading}': visual hint type downgraded to 'illustration'. "
        f"Reason: {reason}"
    )