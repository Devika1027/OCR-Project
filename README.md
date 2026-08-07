# OmniOCR Studio

## Optical Character Recognition (OCR) & Document Text Extraction Platform

OmniOCR Studio is a full-stack Optical Character Recognition (OCR)
application that extracts text from images and documents through a
simple web interface. It supports multiple file formats and
intelligently handles both searchable and scanned PDF documents, making
text extraction accurate and seamless.

The application combines a React frontend with a FastAPI backend to
provide fast document processing and an intuitive user experience.

------------------------------------------------------------------------

# Live Demo

**Application:**\
https://ocr-project-d09qcxb9n-devika9.vercel.app/

**Deployment**

-   Frontend: Vercel
-   Backend API: Railway

------------------------------------------------------------------------
## Screenshot

<img width="1882" height="960" alt="OmniOCR" src="https://github.com/user-attachments/assets/dd456767-8d8e-4977-a13e-b2b873760396" />


*A preview of the application.*

# Technology Stack

## Frontend

-   React 18
-   Vite
-   JavaScript
-   CSS
-   Axios

## Backend

-   Python
-   FastAPI
-   Uvicorn
-   Pydantic

## OCR & Document Processing

-   Tesseract OCR
-   PyPDF2
-   pdf2image
-   Poppler
-   Pillow
-   python-docx

------------------------------------------------------------------------

# Use Cases

-   Extract text from scanned images and scanned PDF documents.
-   Convert documents into editable and searchable text for further
    processing.

------------------------------------------------------------------------

# Project Workflow

``` text
User Uploads File
        │
        ▼
React Frontend
        │
        ▼
FastAPI Backend
        │
        ├── Images → Tesseract OCR
        ├── PDF → PyPDF2 / OCR
        ├── DOCX → python-docx
        └── TXT → Text Reader
        │
        ▼
Extracted Text
        │
        ▼
Search • Edit • Download
```

------------------------------------------------------------------------

# Installation

## Prerequisites

-   Python 3.10+
-   Node.js 18+

### Install Tesseract OCR

Download: https://github.com/UB-Mannheim/tesseract/wiki

### Install Poppler

Download: https://github.com/oschwartz10612/poppler-windows/releases

------------------------------------------------------------------------

## Clone Repository

``` bash
git clone https://github.com/Devika1027/OCR-Project.git

cd OCR-Project
```

## Backend

``` bash
cd backend

pip install -r requirements.txt

uvicorn main:app --reload
```

For local development, configure the paths in the `.env` file:

``` env
TESSERACT_CMD=...
POPPLER_PATH=...
```

If deploying to Railway, configure the required variables using the
`railway.toml` file or Railway environment variables instead of a local
`.env` file.

## Frontend

``` bash
cd frontend

npm install

npm run dev
```

------------------------------------------------------------------------

# API Endpoints

  Method   Endpoint                 Description
  -------- ------------------------ --------------------------------------
  GET      `/`                      API Status
  GET      `/health`                Health Check
  POST     `/extract-text`          Extract text from uploaded documents
  GET      `/download/{filename}`   Download extracted text

------------------------------------------------------------------------

# Author

**Devika MP**
