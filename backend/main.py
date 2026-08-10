"""
OmniOCR Studio - FastAPI Backend Engine
Production-Grade Optical Character Recognition & Text Extraction API.
"""

import logging
import os
import shutil
from contextlib import asynccontextmanager
from typing import List, Set

from dotenv import load_dotenv
from docx import Document
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pdf2image import convert_from_path
from PIL import Image
import pytesseract
from pydantic import BaseModel, Field
from PyPDF2 import PdfReader


# --------------------------------------------------------------------------
# Load Environment Variables & Configuration
# --------------------------------------------------------------------------

load_dotenv()

UPLOAD_FOLDER: str = os.getenv("UPLOAD_FOLDER", "uploads")
OUTPUT_FOLDER: str = os.getenv("OUTPUT_FOLDER", "output")
TESSERACT_CMD: str | None = os.getenv("TESSERACT_CMD")
POPPLER_PATH: str | None = os.getenv("POPPLER_PATH")
CORS_ORIGINS_RAW: str = os.getenv("CORS_ORIGINS", "*")

SUPPORTED_IMAGE_EXTENSIONS: Set[str] = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".tif",
    ".tiff",
}

SUPPORTED_DOCUMENT_EXTENSIONS: Set[str] = {
    ".pdf",
    ".docx",
    ".txt",
}

SUPPORTED_EXTENSIONS: Set[str] = (
    SUPPORTED_IMAGE_EXTENSIONS | SUPPORTED_DOCUMENT_EXTENSIONS
)


# --------------------------------------------------------------------------
# Logging Setup
# --------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger("omniocr-backend")


# --------------------------------------------------------------------------
# Ensure required storage directories exist
# --------------------------------------------------------------------------

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)


# --------------------------------------------------------------------------
# Configure Tesseract OCR binary path if provided
# --------------------------------------------------------------------------

if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    logger.info(f"Configured Tesseract binary path: {TESSERACT_CMD}")
else:
    logger.warning(
        "TESSERACT_CMD environment variable not set. "
        "Utilizing default system PATH for Tesseract."
    )


# --------------------------------------------------------------------------
# Configure Poppler path if provided
# --------------------------------------------------------------------------

if POPPLER_PATH:
    logger.info(f"Configured Poppler binary path: {POPPLER_PATH}")
else:
    logger.warning(
        "POPPLER_PATH environment variable not set. "
        "PDF image-to-text fallback requires Poppler on system PATH."
    )


# --------------------------------------------------------------------------
# Lifespan Event Handler
# --------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting OmniOCR Studio Backend Service...")
    yield
    logger.info("Shutting down OmniOCR Studio Backend Service...")


# --------------------------------------------------------------------------
# FastAPI Application Setup
# --------------------------------------------------------------------------

app = FastAPI(
    title="OmniOCR Studio API",
    description="Production-Grade OCR & Text Extraction API",
    version="1.0.0",
    lifespan=lifespan,
)


# --------------------------------------------------------------------------
# Configure CORS origins
# --------------------------------------------------------------------------

if CORS_ORIGINS_RAW.strip() == "*":
    allow_origins: List[str] = ["*"]
else:
    allow_origins = [
        origin.strip()
        for origin in CORS_ORIGINS_RAW.split(",")
        if origin.strip()
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Pydantic Schemas
# --------------------------------------------------------------------------

class ExtractionResponse(BaseModel):
    filename: str = Field(
        ...,
        description="Original name of the uploaded document"
    )

    text: str = Field(
        ...,
        description="Extracted plain text content"
    )

    txt_file: str = Field(
        ...,
        description="Generated downloadable .txt filename"
    )


class HealthResponse(BaseModel):
    status: str = Field(
        ...,
        example="healthy"
    )

    service: str = Field(
        ...,
        example="OmniOCR Studio API"
    )

    version: str = Field(
        ...,
        example="1.0.0"
    )


# --------------------------------------------------------------------------
# Helper Processing Functions
# --------------------------------------------------------------------------

def save_txt(base_name: str, text: str) -> str:
    """Save extracted text to a .txt file in the output directory."""

    txt_filename = f"{base_name}.txt"
    txt_path = os.path.join(OUTPUT_FOLDER, txt_filename)

    try:
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)

        logger.info(
            f"Saved extracted text to output file: '{txt_filename}'"
        )

    except Exception as e:
        logger.error(
            f"Failed to save text output file '{txt_filename}': {e}"
        )
        raise e

    return txt_filename


def image_ocr(path: str) -> str:
    """Perform optical character recognition on image files using Tesseract."""

    logger.info(
        f"Performing Tesseract OCR on image: '{path}'"
    )

    try:
        with Image.open(path) as img:
            text = pytesseract.image_to_string(img)

        return text

    except Exception as e:
        logger.error(
            f"Image OCR failed for '{path}': {e}"
        )
        raise e


def extract_pdf(path: str) -> str:
    """
    Extract text from PDF documents.

    First attempts native text layer extraction using PyPDF2.

    If no text is found, converts PDF pages to images one at a time
    and runs Tesseract OCR to reduce memory usage.
    """

    logger.info(
        f"Processing PDF document: '{path}'"
    )

    text = ""

    # ----------------------------------------------------------------------
    # Phase 1: Native vector text extraction
    # ----------------------------------------------------------------------

    try:
        reader = PdfReader(path)

        for page in reader.pages:
            page_text = page.extract_text()

            if page_text:
                text += page_text + "\n"

    except Exception as e:
        logger.warning(
            f"Native PDF text extraction failed for '{path}', "
            f"attempting OCR fallback: {e}"
        )

    # ----------------------------------------------------------------------
    # Phase 2: Scanned PDF OCR fallback
    # ----------------------------------------------------------------------

    if not text.strip():

        logger.info(
            f"No native text layer detected in '{path}'. "
            "Running PDF page OCR via Poppler..."
        )

        try:
            # Get total number of pages
            reader = PdfReader(path)
            total_pages = len(reader.pages)

            logger.info(
                f"PDF contains {total_pages} page(s). "
                "Starting page-by-page OCR."
            )

            # --------------------------------------------------------------
            # Process ONE page at a time
            # --------------------------------------------------------------

            for page_num in range(1, total_pages + 1):

                logger.info(
                    f"OCR processing page "
                    f"{page_num}/{total_pages}"
                )

                # Convert only the current page.
                # 150 DPI reduces memory usage compared to high DPI.
                pages = convert_from_path(
                    path,
                    dpi=150,
                    first_page=page_num,
                    last_page=page_num,
                    poppler_path=POPPLER_PATH
                )

                if pages:

                    page = pages[0]

                    try:
                        page_text = pytesseract.image_to_string(
                            page
                        )

                        text += page_text + "\n"

                    finally:
                        # Explicitly release image memory
                        page.close()
                        del page

                # Release the pages list immediately
                del pages

                logger.info(
                    f"Finished OCR for page "
                    f"{page_num}/{total_pages}"
                )

        except Exception as e:

            logger.error(
                f"PDF page OCR conversion failed "
                f"for '{path}': {e}"
            )

            raise e

    return text


def extract_docx(path: str) -> str:
    """Extract text paragraphs from Microsoft Word (.docx) documents."""

    logger.info(
        f"Extracting text from DOCX document: '{path}'"
    )

    try:
        doc = Document(path)

        lines = [
            para.text
            for para in doc.paragraphs
        ]

        return "\n".join(lines)

    except Exception as e:
        logger.error(
            f"DOCX extraction failed for '{path}': {e}"
        )
        raise e


# --------------------------------------------------------------------------
# API Routes
# --------------------------------------------------------------------------

@app.get(
    "/",
    response_model=HealthResponse,
    tags=["Health Check"]
)
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health Check"]
)
async def health_check() -> HealthResponse:

    """Health check endpoint for deployment monitoring."""

    return HealthResponse(
        status="healthy",
        service="OmniOCR Studio API",
        version="1.0.0"
    )


# --------------------------------------------------------------------------
# Extract Text Endpoint
# --------------------------------------------------------------------------

@app.post(
    "/extract-text",
    response_model=ExtractionResponse,
    status_code=status.HTTP_200_OK,
    tags=["OCR & Extraction"]
)
async def extract_text(
    file: UploadFile = File(...)
) -> ExtractionResponse:

    """
    Upload document or image file for OCR & text extraction.

    Supports:
    .jpg, .jpeg, .png, .bmp, .tif, .tiff,
    .pdf, .docx, and .txt formats.

    Automatically cleans up temporary uploaded files upon completion.
    """

    # ----------------------------------------------------------------------
    # Validate uploaded file
    # ----------------------------------------------------------------------

    if not file or not file.filename:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload: File or filename is missing."
        )

    ext = os.path.splitext(file.filename)[1].lower()
    base_name = os.path.splitext(file.filename)[0]

    logger.info(
        f"Received file upload request: "
        f"'{file.filename}' "
        f"(extension: '{ext}')"
    )

    # ----------------------------------------------------------------------
    # Validate file extension
    # ----------------------------------------------------------------------

    if ext not in SUPPORTED_EXTENSIONS:

        logger.warning(
            f"Rejected unsupported file extension "
            f"'{ext}' for file '{file.filename}'"
        )

        return ExtractionResponse(
            filename=file.filename,
            text=(
                f"Error extracting text: Unsupported file format "
                f"'{ext}'. Supported formats: "
                f"{', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            ),
            txt_file=""
        )

    # ----------------------------------------------------------------------
    # Temporary uploaded file path
    # ----------------------------------------------------------------------

    file_path = os.path.join(
        UPLOAD_FOLDER,
        file.filename
    )

    try:

        # --------------------------------------------------------------
        # Save uploaded file to disk
        # --------------------------------------------------------------

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(
                file.file,
                buffer
            )

        text = ""

        # --------------------------------------------------------------
        # Perform extraction based on file type
        # --------------------------------------------------------------

        if ext in SUPPORTED_IMAGE_EXTENSIONS:

            text = image_ocr(file_path)

        elif ext == ".pdf":

            text = extract_pdf(file_path)

        elif ext == ".docx":

            text = extract_docx(file_path)

        elif ext == ".txt":

            with open(
                file_path,
                "r",
                encoding="utf-8",
                errors="replace"
            ) as f:

                text = f.read()

        # --------------------------------------------------------------
        # Save extracted text
        # --------------------------------------------------------------

        txt_filename = save_txt(
            base_name,
            text
        )

        # --------------------------------------------------------------
        # Return response
        # --------------------------------------------------------------

        return ExtractionResponse(
            filename=file.filename,
            text=text,
            txt_file=txt_filename
        )

    except Exception as e:

        logger.error(
            f"Extraction error for file "
            f"'{file.filename}': {e}",
            exc_info=True
        )

        return ExtractionResponse(
            filename=file.filename,
            text=f"Error extracting text: {str(e)}",
            txt_file=""
        )

    finally:

        # --------------------------------------------------------------
        # Clean up temporary uploaded file
        # --------------------------------------------------------------

        if os.path.exists(file_path):

            try:

                os.remove(file_path)

                logger.info(
                    f"Cleaned up temporary upload file: "
                    f"'{file_path}'"
                )

            except Exception as cleanup_err:

                logger.error(
                    f"Failed to remove temporary file: "
                    f"{cleanup_err}"
                )


# --------------------------------------------------------------------------
# Download Generated Text File
# --------------------------------------------------------------------------

@app.get(
    "/download/{filename}",
    tags=["Downloads"]
)
def download_file(filename: str) -> FileResponse:

    """
    Download generated text output file by filename.

    Validates file existence before serving.
    """

    file_path = os.path.join(
        OUTPUT_FOLDER,
        filename
    )

    if (
        not os.path.exists(file_path)
        or not os.path.isfile(file_path)
    ):

        logger.warning(
            f"Download request failed for "
            f"non-existent file: '{filename}'"
        )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Requested file '{filename}' "
                "was not found on the server."
            )
        )

    logger.info(
        f"Serving download file: '{filename}'"
    )

    return FileResponse(
        path=file_path,
        media_type="text/plain",
        filename=filename
    )
