import re
from typing import List


def split_into_sentences(text: str) -> List[str]:
    """
    Split text into sentences using regex.
    More reliable than simple '.split()'
    """
    if not text or not text.strip():
        return []

    # Regex sentence splitter
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())

    return [s.strip() for s in sentences if s.strip()]


def chunk_text(text: str, chunk_size: int = 800) -> List[str]:
    """
    Split text into chunks based on sentence boundaries.

    chunk_size = max characters per chunk
    """

    if not text or not text.strip():
        return []

    sentences = split_into_sentences(text)

    chunks = []
    current_chunk = ""

    for sentence in sentences:

        # Handle extremely long sentences
        if len(sentence) > chunk_size:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""

            # Split long sentence directly
            for i in range(0, len(sentence), chunk_size):
                chunks.append(sentence[i:i + chunk_size])

            continue

        # Normal case
        if len(current_chunk) + len(sentence) + 1 <= chunk_size:
            current_chunk += sentence + " "
        else:
            chunks.append(current_chunk.strip())
            current_chunk = sentence + " "

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def chunk_text_with_overlap(
    text: str,
    chunk_size: int = 800,
    overlap: int = 100
) -> List[str]:
    """
    Split text into overlapping chunks.

    overlap = characters shared between adjacent chunks
    """

    if not text or not text.strip():
        return []

    if overlap >= chunk_size:
        raise ValueError("Overlap must be smaller than chunk_size")

    sentences = split_into_sentences(text)

    chunks = []
    current_chunk = ""

    for sentence in sentences:

        if len(sentence) > chunk_size:

            if current_chunk:
                chunks.append(current_chunk.strip())

            # Split long sentence
            for i in range(0, len(sentence), chunk_size - overlap):

                chunk = sentence[i:i + chunk_size]

                if chunk:
                    chunks.append(chunk)

            current_chunk = ""
            continue

        if len(current_chunk) + len(sentence) + 1 <= chunk_size:
            current_chunk += sentence + " "
        else:
            chunks.append(current_chunk.strip())

            # Apply overlap safely
            overlap_text = current_chunk[-overlap:] if overlap > 0 else ""

            current_chunk = overlap_text + sentence + " "

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def combine_chunks(chunks: List[str]) -> str:
    """
    Combine chunks back into single text
    """

    if not chunks:
        return ""

    return " ".join(chunk.strip() for chunk in chunks if chunk.strip())