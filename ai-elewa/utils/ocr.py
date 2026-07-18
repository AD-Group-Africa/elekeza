import asyncio
import base64
import logging
import os
import re
import shutil
import tempfile
import unicodedata
from pathlib import Path

from models.errors import AIServiceError, ErrorResponse, ERROR_OCR_FAILED

logger = logging.getLogger(__name__)

MEDIA_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png":  ".png",
    "image/webp": ".webp",
}


def _resolve_tesseract_cmd() -> str:
    """
    Resolve Tesseract binary path in this order:
    1. TESSERACT_CMD env var (explicit override)
    2. Auto-detect via shutil.which (works on Linux/Docker)
    3. Windows default install path fallback
    """
    # Explicit override from .env
    env_cmd = os.getenv("TESSERACT_CMD", "").strip()
    if env_cmd:
        return env_cmd

    # Auto-detect — works on Linux (Docker) where Tesseract is on PATH
    which_cmd = shutil.which("tesseract")
    if which_cmd:
        return which_cmd

    # Windows fallback
    return r"C:\Program Files\Tesseract-OCR\tesseract.exe"


TESSERACT_CMD = _resolve_tesseract_cmd()


def _configure_tesseract():
    try:
        import pytesseract
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
        logger.debug(f"Tesseract configured at: {TESSERACT_CMD}")
    except ImportError:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_OCR_FAILED,
            message="pytesseract is not installed.",
            stage="ocr",
        ))


def _clean_ocr_output(raw_text: str) -> str:
    text = unicodedata.normalize("NFKC", raw_text)
    text = "".join(
        ch for ch in text
        if unicodedata.category(ch) not in ("Cc", "Cf") or ch in "\n\t"
    )
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(lines).strip()


async def extract_text_from_image(base64_image: str, media_type: str) -> str:
    _configure_tesseract()
    extension = MEDIA_TYPE_EXTENSIONS.get(media_type, ".jpg")
    tmp_path = None

    try:
        try:
            image_bytes = base64.b64decode(base64_image)
        except Exception as e:
            raise AIServiceError(ErrorResponse(
                error_code=ERROR_OCR_FAILED,
                message=f"Failed to decode base64 image: {str(e)}",
                stage="ocr",
            ))

        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        logger.info(f"OCR — temp file written: {tmp_path} ({len(image_bytes)} bytes)")

        raw_text = await asyncio.to_thread(_run_tesseract, tmp_path)
        cleaned = _clean_ocr_output(raw_text)

        if not cleaned:
            raise AIServiceError(ErrorResponse(
                error_code=ERROR_OCR_FAILED,
                message=(
                    "Tesseract could not extract any text from the image. "
                    "Please upload a clearer image with readable text."
                ),
                stage="ocr",
            ))

        logger.info(f"OCR — extracted {len(cleaned.split())} words")
        return cleaned

    finally:
        if tmp_path and Path(tmp_path).exists():
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.warning(f"OCR — failed to delete temp file: {e}")


def _run_tesseract(image_path: str) -> str:
    try:
        import pytesseract
        from PIL import Image
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
        img = Image.open(image_path)
        return pytesseract.image_to_string(img, lang="eng")
    except FileNotFoundError:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_OCR_FAILED,
            message=(
                f"Tesseract binary not found at '{TESSERACT_CMD}'. "
                "Set TESSERACT_CMD in .env or install Tesseract."
            ),
            stage="ocr",
        ))
    except Exception as e:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_OCR_FAILED,
            message=f"Tesseract failed to process image: {str(e)}",
            stage="ocr",
        ))

async def extract_text_from_file(file_path: str) -> str:
    """Extract text from PDF, DOCX, or TXT file."""
    import asyncio
    from pathlib import Path

    path = Path(file_path)
    if not path.exists():
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_OCR_FAILED,
            message=f"File not found: {file_path}",
            stage="process",
        ))

    ext = path.suffix.lower()

    try:
        if ext == '.pdf':
            return await asyncio.to_thread(_extract_pdf, path)
        elif ext in ['.docx', '.doc']:
            return await asyncio.to_thread(_extract_docx, path)
        elif ext == '.txt':
            return await asyncio.to_thread(_extract_txt, path)
        else:
            # Fallback: try to read as text
            return await asyncio.to_thread(_extract_txt, path)
    except Exception as e:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_OCR_FAILED,
            message=f"Failed to extract text from {path.name}: {str(e)}",
            stage="process",
        ))

def _extract_pdf(path: Path) -> str:
    import PyPDF2
    text_parts = []
    with open(path, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
    return '\n\n'.join(text_parts)

def _extract_docx(path: Path) -> str:
    from docx import Document
    doc = Document(path)
    return '\n\n'.join(paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip())

def _extract_txt(path: Path) -> str:
    return path.read_text(encoding='utf-8', errors='ignore')


def extract_text_from_file(file_path: str) -> str:
    """
    Extract plain text from PDF, DOCX, or TXT files.
    Called by /process endpoint when backend sends a file path.

    FIX: This function was referenced in process.py but never implemented in ocr.py,
    causing a NameError on every file-based upload request.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    suffix = path.suffix.lower()

    if suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="replace").strip()

    elif suffix == ".pdf":
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                return "\n".join(
                    page.extract_text() or "" for page in pdf.pages
                ).strip()
        except ImportError:
            # Fallback to PyPDF2 if pdfplumber not installed
            import PyPDF2
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                return "\n".join(
                    page.extract_text() or "" for page in reader.pages
                ).strip()

    elif suffix in (".docx", ".doc"):
        from docx import Document
        doc = Document(file_path)
        return "\n".join(para.text for para in doc.paragraphs if para.text.strip()).strip()

    else:
        raise ValueError(f"Unsupported file type: {suffix}. Supported: .txt, .pdf, .docx")


