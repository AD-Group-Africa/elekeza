# app/services/reading_level_service.py

import textstat
import re
from typing import Dict


def analyze_reading_level(text: str) -> Dict:
    """
    Analyze text readability using standard readability formulas.
    """

    if not text or not text.strip():
        return {
            "grade_level": 0.0,
            "reading_ease": 0.0,
            "word_count": 0,
            "sentence_count": 0,
            "category": "unknown"
        }

    # Clean text
    cleaned_text = text.strip()

    # Calculate stats
    grade_level = textstat.flesch_kincaid_grade(cleaned_text)
    reading_ease = textstat.flesch_reading_ease(cleaned_text)
    word_count = textstat.lexicon_count(cleaned_text)
    sentence_count = textstat.sentence_count(cleaned_text)

    category = get_grade_category(grade_level)

    return {
        "grade_level": round(grade_level, 2),
        "reading_ease": round(reading_ease, 2),
        "word_count": word_count,
        "sentence_count": sentence_count,
        "category": category
    }


def get_grade_category(grade: float) -> str:
    """
    Convert grade level into human-friendly category
    """

    if grade <= 5:
        return "child"

    elif grade <= 9:
        return "teen"

    elif grade <= 12:
        return "adult"

    else:
        return "complex"


def compare_reading_levels(original: str, simplified_versions: Dict[str, str]) -> Dict:
    """
    Compare readability between original and simplified versions
    """

    original_analysis = analyze_reading_level(original)

    results = {
        "original": original_analysis,
        "simplified": {}
    }

    for level, text in simplified_versions.items():

        simplified_analysis = analyze_reading_level(text)

        results["simplified"][level] = {
            "analysis": simplified_analysis,
            "grade_improvement": round(
                original_analysis["grade_level"] - simplified_analysis["grade_level"], 2
            ),
            "ease_improvement": round(
                simplified_analysis["reading_ease"] - original_analysis["reading_ease"], 2
            )
        }

    return results