from pydantic import BaseModel
from typing import List, Optional

class KeyTerm(BaseModel):
    term: str
    definition: str

class StageFlags(BaseModel):
    verification_triggered: bool = False
    correction_applied: bool = False
    profile_merged: bool = False

class Section(BaseModel):
    heading: str
    body: str
    visual_hint: str = ""
    reading_level: int = 2
    mermaid: str = ""  # Mermaid.js diagram for this section

class LessonJSON(BaseModel):
    title: str
    sections: List[Section]
    key_terms: List[KeyTerm] = []
    estimated_minutes: int = 5
    profile: str
    stage_flags: StageFlags = StageFlags()
