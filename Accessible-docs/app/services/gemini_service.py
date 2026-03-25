import json
import logging
from typing import Dict, List
from app.config import generate_content

logger = logging.getLogger(__name__)

def simplify_all_levels(text: str, terms: List[str] = None) -> Dict[str, str]:
    """
    Generates all 3 reading levels in a single API call for maximum speed.
    Dynamically targets specific jargon if a list of terms is provided.
    """
    
    terms_directive = ""
    if terms:
        terms_joined = ", ".join(terms)
        terms_directive = f"\nCRITICAL: The original text contains these complex terms: [{terms_joined}]. You MUST simplify these specific terms or provide brief, plain-language definitions for them in your rewritten versions.\n"

    prompt = f"""
You are an expert in cognitive accessibility and plain language translation. 
Take the provided text and rewrite it into three distinct reading levels.

1. "child": Grade 3-5 reading level. Use very simple everyday words, short active sentences (max 12 words), and an encouraging tone.
2. "teen": Grade 6-9 reading level. Use clear, relatable language and active voice. Explain difficult concepts directly.
3. "adult": 8th-grade reading level. Remove complex jargon. Keep tone professional and concise.
{terms_directive}
Rules: Preserve all original facts. Do not include introductory filler phrases.

Return ONLY valid JSON in this exact format:
{{
  "child": "...",
  "teen": "...",
  "adult": "..."
}}

Text:
{text}
"""
    try:
        response = generate_content(prompt)
        cleaned = response.strip()
        
        # Strip markdown formatting if Gemini includes it
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("```")
            cleaned = cleaned.replace("json", "", 1).strip()
            
        return json.loads(cleaned)

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON from Gemini: {e}")
        # Safe fallback so the frontend UI doesn't completely crash during the demo
        return {
            "child": "Error generating child version. Please try again.",
            "teen": "Error generating teen version. Please try again.",
            "adult": "Error generating adult version. Please try again."
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
            cleaned = cleaned.replace("json", "", 1).strip()

        return json.loads(cleaned)

    except Exception as e:
        logger.error(f"Term extraction failed: {e}")
        return []


def answer_question(context: str, question: str) -> str:
    """
    Strict RAG prompt with anti-hallucination measures and required citations.
    """
    prompt = f"""
You are a highly accurate, accessibility-focused assistant reading a specific document.

RULES:
1. You must base your answer STRICTLY and EXCLUSIVELY on the provided Context.
2. DO NOT use outside knowledge. DO NOT guess, infer, or make up information.
3. If the answer is not clearly stated within the Context, you MUST reply with exactly: "I cannot find this in the document."
4. If you find the answer, you must explain it simply AND include a short, exact quote from the Context in quotation marks to prove your accuracy.

Context:
{context}

Question:
{question}

Answer:
"""
    try:
        response = generate_content(prompt)
        return response.strip()
    except Exception as e:
        logger.error(f"Question answering failed: {e}")
        raise Exception("Question answering failed")