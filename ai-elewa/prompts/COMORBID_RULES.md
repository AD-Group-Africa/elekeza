# Comorbid Profile Merge Rules

When a learner presents two cognitive profiles, the system prompt must be a
**rule-by-rule priority merge** — not a concatenation of both files.

For each rule category (sentence length, vocabulary, structure, tone), one
profile takes priority. The other profile's rules are applied only where they
do not conflict.

---

## The 6 Pairings

---

### 1. Dyslexia + ADHD

| Category | Priority | Rule applied |
|---|---|---|
| Sentence length | ADHD | Max 12 words (dyslexia) but vary rhythm (ADHD) — use 6–12 word range |
| Vocabulary | Dyslexia | Shortest word wins. Active voice. No silent letters. |
| Structure | ADHD | Chunk into smallest named sections. Numbered steps for process. |
| Headings | ADHD | Question or action phrase headings |
| Visual hints | ADHD | Dynamic visuals (animations, sequences) |
| Engagement | ADHD | Hook sentence opens every section |
| Reading level | Dyslexia | reading age target from dyslexia profile |
| Estimated minutes | ADHD | Reduce by 20% |

**Merge note:** Sentence rhythm from ADHD (vary length) takes priority over
dyslexia's strict max-12 rule — use a range of 6–12 words, not a flat maximum.

---

### 2. Dyslexia + Autism

| Category | Priority | Rule applied |
|---|---|---|
| Sentence length | Dyslexia | Max 12 words |
| Vocabulary | Dyslexia | Shortest word, but must remain literal (autism constraint added) |
| Figurative language | Autism | No idioms, no metaphors — absolute rule |
| Structure | Autism | 3-part section structure (fact → why → example) |
| Headings | Autism | Factual statement headings |
| Cause/effect | Autism | Always explicit, never implied |
| Tone | Autism | Calm, factual, no exclamation marks |
| Visual hints | Dyslexia | Simple supporting diagrams |

**Merge note:** Autism's literal language rule is non-negotiable and overrides
any dyslexia shorthand that could introduce ambiguity.

---

### 3. Dyslexia + Intellectual Disability

| Category | Priority | Rule applied |
|---|---|---|
| Sentence length | ID | Max 8 words (stricter than dyslexia's 12) |
| Vocabulary | ID | 1000 common words only. Dyslexia's short-word rule is naturally satisfied. |
| Structure | ID | Max 2 sentences per paragraph, max 3 sections |
| Summary | ID | Every section ends with "Remember:" sentence |
| Visual hints | ID | Concrete, photo-based hints |
| Tone | ID | Warm, encouraging |
| Reading level | ID | Reading age 8–10 regardless of language_level |

**Merge note:** ID profile is the stricter baseline. Dyslexia rules apply only
where they add constraint (active voice, no passive) without conflicting with ID limits.

---

### 4. ADHD + Autism

| Category | Priority | Rule applied |
|---|---|---|
| Sentence length | Autism | Precise length per language_level from autism profile |
| Vocabulary | Autism | Literal only. ADHD second-person ("you") allowed. |
| Figurative language | Autism | Absolute no idioms/metaphors rule |
| Structure | Autism | 3-part structure per section |
| Headings | ADHD | Question or action headings (compatible with autism's factual requirement — use factual questions) |
| Engagement | ADHD | Hook sentence allowed if literal and factual |
| Transitions | Autism | Explicit transition signals ("The next idea is...") |
| Visual hints | ADHD | Dynamic, but labelled explicitly (autism requirement) |
| Estimated minutes | ADHD | Reduce by 20% |

**Merge note:** Autism's structural and language rules dominate. ADHD engagement
rules (hook, second-person, dynamic visuals) are layered on top where compatible.

---

### 5. ADHD + Intellectual Disability

| Category | Priority | Rule applied |
|---|---|---|
| Sentence length | ID | Max 8 words |
| Vocabulary | ID | 1000 common words |
| Structure | ADHD | Smallest possible chunks, numbered steps |
| Headings | ADHD | Question or action headings (simplified to ID vocabulary level) |
| Engagement | ADHD | Hook sentence — but max 8 words, common vocabulary only |
| Summary | ID | Every section ends with "Remember:" sentence |
| Visual hints | ADHD | Dynamic but concrete (satisfies both profiles) |
| Estimated minutes | ADHD | Reduce by 20% |
| Tone | ID | Warm and encouraging always |

**Merge note:** ID vocabulary and sentence length limits are non-negotiable.
ADHD structural energy (chunking, hooks, questions) is applied within those limits.

---

### 6. Autism + Intellectual Disability

| Category | Priority | Rule applied |
|---|---|---|
| Sentence length | ID | Max 8 words |
| Vocabulary | ID | 1000 common words. Autism's literal rule naturally satisfied. |
| Figurative language | Autism | Absolute no idioms/metaphors |
| Structure | ID | Max 3 sections, max 2 sentences per paragraph |
| Cause/effect | Autism | Always explicit — but explained in ID vocabulary |
| Transitions | Autism | Explicit signals, but in simple language |
| Summary | ID | Every section ends with "Remember:" |
| Visual hints | ID | Concrete, photo-based |
| Tone | ID | Warm and encouraging (compatible with autism's calm/neutral) |

**Merge note:** Both profiles demand simplicity — this is the most restrictive
combination. ID sentence and vocabulary limits apply. Autism's precision and
literal language rules layer on top without conflict.