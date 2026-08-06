# ⚡ OmniOCR Studio

> **AI-Powered Optical Character Recognition & Text Extraction Workspace**

OmniOCR Studio is an enterprise-grade web application and FastAPI backend service built to extract, clean, inspect, search, and download text from images (`.jpg`, `.png`, `.bmp`, `.tiff`), scanned or vector PDFs (`.pdf`), Microsoft Word documents (`.docx`), and plain text files (`.txt`).

---

## 🌟 Key Features

- **Multi-Format Extraction**: Instant OCR and document text extraction across 9+ supported formats (`.jpg`, `.jpeg`, `.png`, `.bmp`, `.tif`, `.tiff`, `.pdf`, `.docx`, `.txt`).
- **Dual-Engine PDF Parsing**: Automatic native vector text extraction via `PyPDF2` with intelligent fallback to multi-page raster OCR via `pdf2image` and `Tesseract OCR`.
- **Live Search & Match Navigation**: Interactive document text search with highlight layer sync and match navigation (`Previous` / `Next`).
- **Text Cleaning & Manipulation Utilities**: One-click whitespace trimming, empty line removal, uppercase (`AA`), and lowercase (`aa`) conversion.
- **Original Filename Preservation**: Download extracted plain text outputs directly retaining the original source filename (e.g., `Invoice.pdf` → `Invoice.txt`).
- **Automatic Temp File Cleanup**: Production-grade backend garbage cleanup for temporary upload files after processing.
- **Health Checks & Observability**: Dedicated `/health` endpoint and structured production logging.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite 5, Lucide Icons, Vanilla CSS Design System |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pydantic v2, `python-dotenv` |
| **OCR & PDF Engines** | Tesseract OCR (`pytesseract`), Poppler (`pdf2image`), PyPDF2, `python-docx`, Pillow |

---

## 📐 System Architecture & Flow

```mermaid
flowchart TD
    User([User Workspace / Browser]) -->|Drag & Drop Document| Frontend[React + Vite Frontend]
    Frontend -->|POST /extract-text| API[FastAPI Backend Engine]
    
    subgraph Backend Services
        API -->|Validate Format| Router{File Extension}
        Router -->|.jpg, .png, .bmp, .tiff| OCR[Tesseract OCR Engine]
        Router -->|.pdf| PDFProc{PyPDF2 Native Check}
        PDFProc -->|Has Text| ExtractText[Extract Vector Text]
        PDFProc -->|No Text / Scanned| Poppler[Poppler pdf2image] --> OCR
        Router -->|.docx| DocxProc[python-docx Parser]
        Router -->|.txt| TxtProc[UTF-8 Text Reader]
        
        OCR --> Output[Save to output/base_name.txt]
        ExtractText --> Output
        DocxProc --> Output
        TxtProc --> Output
        
        Output --> Clean[Delete Temp Upload File]
    end
    
    Backend Services -->|JSON Response| Frontend
    Frontend -->|Display Highlights & Text| User
    User -->|GET /download/filename.txt| API -->|Serve FileResponse| User
```

---

## 📁 Directory Structure

```
ocr/
├── backend/
│   ├── uploads/            # Temporary file upload directory (auto-cleaned)
│   ├── output/             # Processed .txt file storage directory
│   ├── main.py             # FastAPI backend server & OCR logic
│   ├── requirements.txt    # Python backend dependencies
│   └── .env                # Backend environment configuration
├── frontend/
│   ├── dist/               # Production build output
│   ├── src/
│   │   ├── app.jsx         # Main React application component
│   │   ├── app.css         # Custom CSS design system & highlight styles
│   │   └── main.jsx        # React entry point
│   ├── package.json        # Frontend Node dependencies & scripts
│   └── vite.config.js      # Vite bundler configuration
└── README.md               # Project documentation
```

---

## 🚀 Quickstart & Installation Guide

### Prerequisites

1. **Python 3.10+**: Ensure Python is installed on your system.
2. **Node.js 18+**: Required for the React frontend.
3. **Tesseract OCR**: 
   - **Windows**: Download installer from [UB-Mannheim Tesseract Wiki](https://github.com/UB-Mannheim/tesseract/wiki).
   - **Linux**: `sudo apt-get install tesseract-ocr`
   - **macOS**: `brew install tesseract`
4. **Poppler Utilities**:
   - **Windows**: Download binary build from [Poppler Windows Releases](https://github.com/oschwartz10612/poppler-windows/releases).
   - **Linux**: `sudo apt-get install poppler-utils`
   - **macOS**: `brew install poppler`

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (optional)
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables in backend/.env:
# TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
# POPPLER_PATH=C:\poppler-26.02.0\Library\bin
# CORS_ORIGINS=*

# Start FastAPI server
uvicorn main:app --reload --port 8000
```

The backend server will run at `http://localhost:8000`.

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## ⚙️ Environment Variables

The backend loads configuration from `backend/.env`:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `TESSERACT_CMD` | Absolute path to Tesseract OCR binary | `C:\Program Files\Tesseract-OCR\tesseract.exe` |
| `POPPLER_PATH` | Absolute path to Poppler `bin` directory | `C:\poppler-26.02.0\Library\bin` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `*` or `http://localhost:5173` |
| `UPLOAD_FOLDER` | Directory for temporary uploads | `uploads` |
| `OUTPUT_FOLDER` | Directory for output text files | `output` |

---

## 📖 API Documentation

### 1. Health Check
- **Endpoint**: `GET /` or `GET /health`
- **Response** (`200 OK`):
```json
{
  "status": "healthy",
  "service": "OmniOCR Studio API",
  "version": "1.0.0"
}
```

### 2. Extract Text
- **Endpoint**: `POST /extract-text`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (binary document/image file)
- **Supported Formats**: `.jpg`, `.jpeg`, `.png`, `.bmp`, `.tif`, `.tiff`, `.pdf`, `.docx`, `.txt`
- **Response** (`200 OK`):
```json
{
  "filename": "Invoice.pdf",
  "text": "INVOICE #10023\nDate: 2026-08-07\nTotal: $1,250.00...",
  "txt_file": "Invoice.txt"
}
```

### 3. Download Text File
- **Endpoint**: `GET /download/{filename}`
- **Response** (`200 OK`): Serves `FileResponse` (`text/plain`).
- **Error** (`404 Not Found`): If requested file does not exist in `output/`.

---

## 🌐 Production Deployment

### Backend (Gunicorn + Uvicorn Workers)
```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend (Static Production Build)
```bash
npm run build
```
Deploy the generated `dist/` directory to Nginx, Vercel, Netlify, or AWS S3 + CloudFront.

---

## 📜 License

Distributed under the MIT License.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 🧑‍💻 Author

**OmniOCR Studio Team**  
*AI-Powered Optical Character Recognition & Workspace Solutions*
