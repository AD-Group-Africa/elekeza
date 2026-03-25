import os
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List

from app.services.chunk_service import chunk_text_with_overlap
from app.services.gemini_service import answer_question


# Persistent storage folder
CHROMA_DB_PATH = "chroma_db"

# Create persistent Chroma client
chroma_client = chromadb.Client(
    Settings(
        persist_directory=CHROMA_DB_PATH,
        anonymized_telemetry=False
    )
)

# Create or get collection
collection = chroma_client.get_or_create_collection(
    name="documents"
)

# Load embedding model 
embedding_model = SentenceTransformer("BAAI/bge-base-en-v1.5")


def initialize_vector_store():
    """
    Ensure vector store exists.
    """
    return collection


def store_document(document_id: str, text: str):
    """
    Chunk document and store embeddings.
    """

    if not text.strip():
        raise ValueError("Cannot store empty document")

    # Remove old chunks for same document (avoid duplicates)
    collection.delete(where={"document_id": document_id})

    chunks = chunk_text_with_overlap(text)

    if not chunks:
        raise ValueError("No valid chunks generated")

    embeddings = embedding_model.encode(chunks).tolist()

    ids = [f"{document_id}_{i}" for i in range(len(chunks))]
    metadata = [{"document_id": document_id} for _ in chunks]

    collection.add(
        documents=chunks,
        embeddings=embeddings,
        ids=ids,
        metadatas=metadata
    )

    return {
        "message": "Document stored successfully",
        "chunks": len(chunks)
    }

def retrieve_relevant_chunks(
    document_id: str,
    question: str,
    top_k: int = 5
) -> List[str]:

    if not question.strip():
        return []

    question_embedding = embedding_model.encode(question).tolist()

    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=top_k,
        where={"document_id": document_id}
    )

    # SAFELY unpack ChromaDB's nested list structure
    if not results or not results.get("documents") or not results["documents"][0]:
        return []

    return results["documents"][0]

def answer_with_rag(document_id: str, question: str):
    """
    Retrieve relevant chunks and ask Groq (Llama 3).
    """

    relevant_chunks = retrieve_relevant_chunks(document_id, question)

    if not relevant_chunks:
        return "I could not find this in the document."

    context = "\n\n".join(relevant_chunks)

    # Correct call matching the updated gemini_service signature
    return answer_question(context, question)

def delete_document(document_id: str):
    """
    Delete all chunks belonging to a document.
    """

    collection.delete(where={"document_id": document_id})

    return {"message": "Document deleted successfully"}