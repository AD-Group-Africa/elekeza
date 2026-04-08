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