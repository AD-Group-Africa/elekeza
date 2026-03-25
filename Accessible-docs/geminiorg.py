import json
import logging
from typing import Dict, List

from app.config import generate_content

logger = logging.getLogger(__name__)

READING_LEVEL_PROMPTS = {
    "child": (
        "You are an expert in cognitive accessibility. Rewrite the following text so a child "
        "(Grade 3-5 reading level) can easily understand it. "
        "Rules: Use very simple everyday words, short active sentences (max 12 words), and an encouraging tone. "
        "Do not omit any important facts, warnings, or core meanings. "
        "Do not include introductory filler phrases."
    ),
    "teen": (
        "You are an expert in plain language translation. Rewrite the following text for a teenager "
        "(Grade 6-9 reading level). "
        "Rules: Use clear, relatable language and active voice. Explain difficult concepts directly. "
        "Keep tone engaging but professional. "
        "Preserve all original facts and meanings. "
        "Do not include introductory filler phrases."
    ),
    "adult": (
        "You are an expert in plain language translation. Rewrite the following text for a general adult audience "
        "at an 8th-grade reading level. "
        "Rules: Remove complex jargon. If a technical term must be used, define it simply. "
        "Keep tone professional and concise. "
        "Preserve all original facts. "
        "Do not include introductory filler phrases."
    )
}

def simplify_text(text: str, level: str) -> str:
    if level not in READING_LEVEL_PROMPTS:
        raise ValueError(f"Invalid level: {level}")

    prompt = f"""
{READING_LEVEL_PROMPTS[level]}

Text:
{text}

Return only the rewritten text.
"""

    try:
        response = generate_content(prompt)
        return response.strip()

    except Exception as e:
        logger.error(f"Simplification failed ({level}): {e}")
        raise Exception("Text simplification failed")


def simplify_all_levels(text: str) -> Dict[str, str]:
    try:
        return {
            "child": simplify_text(text, "child"),
            "teen": simplify_text(text, "teen"),
            "adult": simplify_text(text, "adult")
        }

    except Exception as e:
        logger.error(f"Multi-level simplification failed: {e}")
        raise Exception("Multi-level simplification failed")

def extract_terms(text: str) -> List[Dict]:
    prompt = f"""
Extract important terms from the text and provide simple definitions.

Return ONLY valid JSON in this format:

[
  {{
    "term": "example term",
    "definition": "simple explanation"
  }}
]

Text:
{text}
"""

    try:
        response = generate_content(prompt)

        cleaned = response.strip()

        # Remove markdown formatting if Gemini adds ```json
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("```")
            cleaned = cleaned.replace("json", "").strip()

        return json.loads(cleaned)

    except Exception as e:
        logger.error(f"Term extraction failed: {e}")
        return []


def answer_question(prompt: str) -> str:
    """
    Accepts a fully constructed RAG prompt.
    """

    try:
        response = generate_content(prompt)
        return response.strip()

    except Exception as e:
        logger.error(f"Question answering failed: {e}")
        raise Exception("Question answering failed")
        


#config.py
import os
from dotenv import load_dotenv
from google import genai

#  Load .env file
load_dotenv()

#  Get API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not set in environment variables.")

#  Create Gemini client
client = genai.Client(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-2.5-flash"

def generate_content(prompt: str) -> str:
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config={"response_mime_type": "application/json"}
    )
    return response.text