import os
import re
import logging
from typing import Optional
import fitz  
from docx import Document
import pytesseract
from PIL import Image, ImageOps, ImageEnhance


logger = logging.getLogger(__name__)


# Optional: set path manually if needed (Windows only)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def preprocess_image(img: Image.Image) -> Image.Image:
    """
    Enhances image for better OCR accuracy.
    Converts to grayscale and increases contrast.
    """
    # Convert to grayscale
    img = ImageOps.grayscale(img)
    
    # Bump the contrast to make text pop
    enhancer = ImageEnhance.Contrast(img)
    return enhancer.enhance(2.0)


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from PDF using PyMuPDF.
    Falls back to OCR if no text found.
    """

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    text = ""

    try:
        doc = fitz.open(file_path)

        for page in doc:
            page_text = page.get_text("text")
            text += page_text

        doc.close()

        # OCR fallback if text is empty
        if not text.strip():
            logger.info("No text found in PDF, using OCR fallback")

            doc = fitz.open(file_path)

            for page in doc:
                pix = page.get_pixmap()
                img = Image.frombytes(
                    "RGB",
                    [pix.width, pix.height],
                    pix.samples
                )
                
                # Apply preprocessing before OCR
                img = preprocess_image(img)
                text += pytesseract.image_to_string(img)

            doc.close()

        return clean_extracted_text(text)

    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        return ""


def extract_text_from_docx(file_path: str) -> str:
    """
    Extract text from Word document
    """

    if not os.path.exists(file_path):
        raise FileNotFoundError(file_path)

    try:
        doc = Document(file_path)

        text = "\n".join(
            paragraph.text for paragraph in doc.paragraphs
        )

        return clean_extracted_text(text)

    except Exception as e:
        logger.error(f"DOCX extraction failed: {e}")
        return ""


def extract_text_from_image(file_path: str) -> str:
    """
    Extract text from image using OCR
    """

    if not os.path.exists(file_path):
        raise FileNotFoundError(file_path)

    try:
        image = Image.open(file_path)
        
        # Apply preprocessing before OCR
        image = preprocess_image(image)
        text = pytesseract.image_to_string(image)

        return clean_extracted_text(text)

    except Exception as e:
        logger.error(f"Image OCR failed: {e}")
        return ""


def extract_text_from_file(file_path: str) -> str:
    """
    Auto-detect file type and extract text
    """

    if not file_path:
        raise ValueError("File path is empty")

    file_path_lower = file_path.lower()

    if file_path_lower.endswith(".pdf"):
        return extract_text_from_pdf(file_path)

    elif file_path_lower.endswith(".docx"):
        return extract_text_from_docx(file_path)

    elif file_path_lower.endswith((".png", ".jpg", ".jpeg", ".bmp", ".tiff")):
        return extract_text_from_image(file_path)

    else:
        raise ValueError("Unsupported file type")


def clean_extracted_text(text: Optional[str]) -> str:
    """
    Clean extracted text
    """

    if not text:
        return ""

    # Remove excessive whitespace
    text = re.sub(r"\s+", " ", text)

    # Remove non-printable characters
    text = re.sub(r"[^\x20-\x7E\n]", "", text)

    return text.strip()