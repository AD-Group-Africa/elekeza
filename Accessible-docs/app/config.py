import os
from dotenv import load_dotenv
from groq import Groq

# Load .env file
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not set in environment variables.")

client = Groq(api_key=GROQ_API_KEY)

MODEL_NAME = "llama-3.3-70b-versatile"

def generate_content(prompt: str) -> str:
    """
    Takes a prompt, sends it to Groq (Llama 3), and returns the text response.
    This maintains the exact same function signature as the old Gemini setup,
    so no other files need to be updated.
    """
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2, 
        )
        return completion.choices[0].message.content
    except Exception as e:
        print(f"Groq API Error: {e}")
        raise e