# pyrefly: ignore [missing-import]
from fastapi import FastAPI, UploadFile, File
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.responses import FileResponse
import shutil
import os
# pyrefly: ignore [missing-import]
from PIL import Image
# pyrefly: ignore [missing-import]
import pytesseract
# pyrefly: ignore [missing-import]
from pdf2image import convert_from_path
# pyrefly: ignore [missing-import]
from docx import Document
# pyrefly: ignore [missing-import]
from PyPDF2 import PdfReader

# -------------------------------
# FastAPI App
# -------------------------------
app = FastAPI()

# -------------------------------
# Enable CORS
# -------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# Folders
# -------------------------------
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "output"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# -------------------------------
# Tesseract Path (Windows)
# Change if needed
# -------------------------------
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# -------------------------------
# Poppler Path (Windows)
# Change this to your exact path
# -------------------------------
POPPLER_PATH = r"C:\Users\srava\Downloads\Compressed\Release-26.02.0-0\poppler-26.02.0\Library\bin"


# -------------------------------
# Save text file
# -------------------------------
def save_txt(base_name, text):
    txt_filename = f"{base_name}.txt"
    txt_path = os.path.join(OUTPUT_FOLDER, txt_filename)

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(text)

    return txt_filename


# -------------------------------
# OCR from image
# -------------------------------
def image_ocr(path):
    img = Image.open(path)
    text = pytesseract.image_to_string(img)
    return text


# -------------------------------
# PDF Extraction
# Works for scanned/image PDFs
# -------------------------------
def extract_pdf(path):
    text = ""

    try:
        # First try direct text extraction
        reader = PdfReader(path)

        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

    except:
        pass

    # If no text found, use OCR on PDF pages
    if text.strip() == "":
        pages = convert_from_path(
            path,
            poppler_path=POPPLER_PATH
        )

        for page in pages:
            page_text = pytesseract.image_to_string(page)
            text += page_text + "\n"

    return text


# -------------------------------
# DOCX Extraction
# -------------------------------
def extract_docx(path):
    doc = Document(path)

    lines = []
    for para in doc.paragraphs:
        lines.append(para.text)

    return "\n".join(lines)


# -------------------------------
# Main Upload Route
# -------------------------------
@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        ext = os.path.splitext(file.filename)[1].lower()
        base_name = os.path.splitext(file.filename)[0]

        text = ""

        # Image Files
        if ext in [".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"]:
            text = image_ocr(file_path)

        # PDF Files
        elif ext == ".pdf":
            text = extract_pdf(file_path)

        # Word Files
        elif ext == ".docx":
            text = extract_docx(file_path)

        # TXT Files
        elif ext == ".txt":
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()

        else:
            text = "Unsupported file format."

        txt_filename = save_txt(base_name, text)

        return {
            "filename": file.filename,
            "text": text,
            "txt_file": txt_filename
        }

    except Exception as e:
        return {
            "filename": file.filename,
            "text": f"Error extracting text: {str(e)}",
            "txt_file": ""
        }


# -------------------------------
# Download TXT File
# -------------------------------
@app.get("/download/{filename}")
def download_file(filename: str):
    path = os.path.join(OUTPUT_FOLDER, filename)

    return FileResponse(
        path,
        media_type="text/plain",
        filename=filename
    )