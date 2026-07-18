import asyncio
import base64
import os
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from utils.ocr import _clean_ocr_output, extract_text_from_image
from models.errors import AIServiceError, ERROR_OCR_FAILED


# ---------------------------------------------------------------------------
# _clean_ocr_output — pure function, no mocking needed
# ---------------------------------------------------------------------------

def test_clean_ocr_strips_whitespace():
    raw = "  Hello   World  "
    result = _clean_ocr_output(raw)
    # Leading/trailing whitespace stripped, internal spaces collapsed
    assert result == "Hello World"
    assert not result.startswith(" ")
    assert not result.endswith(" ")


def test_clean_ocr_collapses_multiple_spaces():
    raw = "Hello    World    Test"
    result = _clean_ocr_output(raw)
    assert "    " not in result


def test_clean_ocr_collapses_excessive_newlines():
    raw = "Line 1\n\n\n\n\nLine 2"
    result = _clean_ocr_output(raw)
    assert "\n\n\n" not in result


def test_clean_ocr_returns_empty_for_blank_input():
    assert _clean_ocr_output("   \n\n   ") == ""


def test_clean_ocr_removes_non_printable():
    raw = "Hello\x00World\x01Test"
    result = _clean_ocr_output(raw)
    assert "\x00" not in result
    assert "\x01" not in result
    assert "Hello" in result
    assert "World" in result


# ---------------------------------------------------------------------------
# extract_text_from_image — mock Tesseract
# ---------------------------------------------------------------------------

def _make_base64_png() -> str:
    """Minimal valid PNG as base64 — 1x1 white pixel."""
    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
        b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
        b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return base64.b64encode(png_bytes).decode("utf-8")


@pytest.mark.asyncio
async def test_extract_text_success():
    with patch("utils.ocr._run_tesseract", return_value="This is extracted text from the image."):
        result = await extract_text_from_image(_make_base64_png(), "image/png")
    assert "extracted text" in result


@pytest.mark.asyncio
async def test_extract_text_empty_raises_ocr_failed():
    with patch("utils.ocr._run_tesseract", return_value="   \n\n   "):
        with pytest.raises(AIServiceError) as exc_info:
            await extract_text_from_image(_make_base64_png(), "image/png")
    assert exc_info.value.error_response.error_code == ERROR_OCR_FAILED


@pytest.mark.asyncio
async def test_extract_text_invalid_base64_raises_ocr_failed():
    with pytest.raises(AIServiceError) as exc_info:
        await extract_text_from_image("not_valid_base64!!!", "image/png")
    assert exc_info.value.error_response.error_code == ERROR_OCR_FAILED


@pytest.mark.asyncio
async def test_temp_file_deleted_after_success():
    created_paths = []

    original_run = __import__("utils.ocr", fromlist=["_run_tesseract"])._run_tesseract

    def mock_run(path):
        created_paths.append(path)
        return "Some extracted text here."

    with patch("utils.ocr._run_tesseract", side_effect=mock_run):
        await extract_text_from_image(_make_base64_png(), "image/png")

    # Confirm temp file was deleted
    for path in created_paths:
        assert not Path(path).exists(), f"Temp file was NOT deleted: {path}"


@pytest.mark.asyncio
async def test_temp_file_deleted_after_failure():
    created_paths = []

    def mock_run_fail(path):
        created_paths.append(path)
        return ""  # Empty — triggers OCR_FAILED

    with patch("utils.ocr._run_tesseract", side_effect=mock_run_fail):
        with pytest.raises(AIServiceError):
            await extract_text_from_image(_make_base64_png(), "image/png")

    for path in created_paths:
        assert not Path(path).exists(), f"Temp file was NOT deleted after failure: {path}"

