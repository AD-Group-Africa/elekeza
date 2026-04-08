import os
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Provider selection — read once at startup, fail fast if invalid
# ---------------------------------------------------------------------------

AI_PROVIDER = os.getenv("AI_PROVIDER", "").lower()

SUPPORTED_PROVIDERS = {"groq", "openai", "anthropic", "google"}

if AI_PROVIDER not in SUPPORTED_PROVIDERS:
    raise ValueError(
        f"❌ AI_PROVIDER='{AI_PROVIDER}' is not supported. "
        f"Must be one of: {', '.join(sorted(SUPPORTED_PROVIDERS))}. "
        f"Check your .env file."
    )

AI_API_KEY = os.getenv("AI_API_KEY", "")
if not AI_API_KEY:
    raise ValueError("❌ AI_API_KEY is missing or empty. Check your .env file.")

# ---------------------------------------------------------------------------
# Model names per provider and per stage
# Switch provider by changing AI_PROVIDER in .env — nothing else changes
# ---------------------------------------------------------------------------

_MODELS = {
    "groq": {
        "stage2": "llama-3.3-70b-versatile",   # large — simplification
        "stage3": "llama-3.1-8b-instant",       # fast  — verification
        "quiz":   "llama-3.3-70b-versatile",   # same as stage2
        "adaptive": "llama-3.1-8b-instant",    # same as stage3
    },
    "openai": {
        "stage2":   "gpt-4o",
        "stage3":   "gpt-4o-mini",
        "quiz":     "gpt-4o",
        "adaptive": "gpt-4o-mini",
    },
    "anthropic": {
        "stage2":   "claude-opus-4-6",
        "stage3":   "claude-haiku-4-5-20251001",
        "quiz":     "claude-opus-4-6",
        "adaptive": "claude-haiku-4-5-20251001",
    },
    "google": {
        "stage2":   "gemini-1.5-pro",
        "stage3":   "gemini-1.5-flash",
        "quiz":     "gemini-1.5-pro",
        "adaptive": "gemini-1.5-flash",
    },
}

STAGE2_MODEL   = _MODELS[AI_PROVIDER]["stage2"]
STAGE3_MODEL   = _MODELS[AI_PROVIDER]["stage3"]
QUIZ_MODEL     = _MODELS[AI_PROVIDER]["quiz"]
ADAPTIVE_MODEL = _MODELS[AI_PROVIDER]["adaptive"]

# ---------------------------------------------------------------------------
# Temperature constants — fixed regardless of provider
# ---------------------------------------------------------------------------

TEMPERATURE_SIMPLIFY = 0.3   # deterministic — content must be accurate
TEMPERATURE_QUIZ     = 0.5   # balanced — varied but structured
TEMPERATURE_ADAPTIVE = 0.7   # creative — personalised responses

# ---------------------------------------------------------------------------
# Content limits
# ---------------------------------------------------------------------------

MAX_WORDS = 5000              # requests above this return OVERSIZED error
MIN_CHARS = 1                 # below this return EMPTY_CONTENT error

print(f"✅ Config loaded — provider: {AI_PROVIDER} | stage2: {STAGE2_MODEL} | stage3: {STAGE3_MODEL}")