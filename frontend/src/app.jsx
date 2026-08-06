import React, { useState, useRef, useMemo, useEffect } from "react";
import axios from "axios";
import {
  ScanText,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileCode,
  Sparkles,
  Copy,
  Check,
  Download,
  Trash2,
  ZoomIn,
  X,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Type
} from "lucide-react";
import "./app.css";

const BACKEND_URL = "http://localhost:8000";

function App() {
  const [file, setFile] = useState(null);
  const [activeFileName, setActiveFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState("");
  const [txtFile, setTxtFile] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoomModal, setZoomModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [toasts, setToasts] = useState([]);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const highlightLayerRef = useRef(null);

  // Helper to trigger toast notification
  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Format file size nicely
  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // File selection handler
  const handleSelectFile = (selected) => {
    if (!selected) return;

    setFile(selected);
    setActiveFileName(selected.name);
    setTxtFile("");

    // Generate preview for images
    if (selected.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(selected));
    } else {
      setPreview(null);
    }

    addToast(`Selected "${selected.name}"`, "info");
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectFile(e.target.files[0]);
    }
  };

  // Drag & Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  // Upload & extract text via FastAPI
  const uploadFile = async () => {
    if (!file) {
      addToast("Please select or drop a file first", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);

    try {
      const res = await axios.post(`${BACKEND_URL}/extract-text`, formData);

      if (res.data && res.data.text !== undefined) {
        setText(res.data.text);
        setTxtFile(res.data.txt_file || "");

        if (res.data.text.startsWith("Error extracting text:")) {
          addToast("Extraction failed: backend error", "error");
        } else {
          addToast("Text extracted successfully!", "success");
        }
      } else {
        addToast("Unexpected response from OCR server", "error");
      }
    } catch (error) {
      console.error(error);
      addToast("Failed to connect to backend OCR server", "error");
    } finally {
      setLoading(false);
    }
  };

  // Copy text to clipboard
  const copyText = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    addToast("Text copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  // Text formatting utilities
  const cleanWhitespace = () => {
    if (!text) return;
    const cleaned = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n\n");
    setText(cleaned);
    addToast("Cleaned extra lines & whitespace", "info");
  };

  const convertCase = (mode) => {
    if (!text) return;
    if (mode === "upper") {
      setText(text.toUpperCase());
    } else if (mode === "lower") {
      setText(text.toLowerCase());
    }
  };

  // Download .TXT File with exact filename (e.g. dog.pdf -> dog.txt)
  const downloadTxtFile = () => {
    if (!text) {
      addToast("No text available to download", "error");
      return;
    }

    let rawName = "";
    if (file && file.name) {
      rawName = file.name;
    } else if (activeFileName) {
      rawName = activeFileName;
    } else if (txtFile) {
      rawName = txtFile;
    }

    let baseName = "extracted_text";
    if (rawName) {
      const lastDotIndex = rawName.lastIndexOf(".");
      baseName = lastDotIndex > 0 ? rawName.substring(0, lastDotIndex) : rawName;
    }

    const downloadFileName = `${baseName}.txt`;
    console.log("DOWNLOAD FUNCTION CALLED");
    console.log("Filename:", downloadFileName);
    console.log("File object:", file);
    console.log("Active filename:", activeFileName);

    // Preserve Windows & Unix line breaks nicely
    const formattedContent = text.replace(/\r?\n/g, "\r\n");

    const blob = new Blob([formattedContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", downloadFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);

    addToast(`Downloaded "${downloadFileName}"`, "success");
  };

  // Clear workspace
  const clearAll = () => {
    setFile(null);
    setActiveFileName("");
    setPreview(null);
    setText("");
    setTxtFile("");
    setSearchQuery("");
    setCurrentMatchIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    addToast("Workspace reset", "info");
  };

  // Search match positions calculation
  const matches = useMemo(() => {
    if (!searchQuery.trim() || !text) return [];
    const query = searchQuery.trim();
    const result = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let index = lowerText.indexOf(lowerQuery);
    while (index !== -1) {
      result.push({ start: index, end: index + query.length });
      index = lowerText.indexOf(lowerQuery, index + 1);
    }
    return result;
  }, [text, searchQuery]);

  // Reset match index when query or text changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery, text]);

  // Navigate between search matches (Tab, Enter, or Arrow Buttons)
  const navigateMatch = (direction) => {
    if (matches.length === 0) return;
    const nextIndex = (currentMatchIndex + direction + matches.length) % matches.length;
    setCurrentMatchIndex(nextIndex);

    // Scroll & select range in textarea
    const match = matches[nextIndex];
    if (textareaRef.current && match) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(match.start, match.end);

      // Scroll active highlight into view
      setTimeout(() => {
        const activeMark = document.getElementById(`match-mark-${nextIndex}`);
        if (activeMark) {
          activeMark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
    }
  };


  // Text analytics metrics
  const stats = useMemo(() => {
    if (!text) return { chars: 0, words: 0, lines: 0, readTime: "0 min" };
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split("\n").length;
    const readTime = Math.ceil(words / 200) + " min";
    return { chars, words, lines, readTime };
  }, [text]);

  // Synchronize scroll between textarea and highlight backdrop layer
  const handleTextareaScroll = (e) => {
    if (highlightLayerRef.current) {
      highlightLayerRef.current.scrollTop = e.target.scrollTop;
      highlightLayerRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // Render text with highlighted search terms
  const renderHighlightedText = () => {
    if (!searchQuery.trim() || matches.length === 0) {
      return text;
    }

    const elements = [];
    let lastIndex = 0;

    matches.forEach((match, idx) => {
      // Unmatched prefix text
      if (match.start > lastIndex) {
        elements.push(text.substring(lastIndex, match.start));
      }

      // Matched text wrapped in <mark>
      const matchedText = text.substring(match.start, match.end);
      const isActive = idx === currentMatchIndex;

      elements.push(
        <mark
          key={`match-${idx}`}
          id={`match-mark-${idx}`}
          className={`match-highlight ${isActive ? "active-match" : ""}`}
        >
          {matchedText}
        </mark>
      );

      lastIndex = match.end;
    });

    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex));
    }

    return elements;
  };

  return (
    <div className="app-shell">
      {/* Header Bar */}
      <header className="app-header">
        <div className="brand-container">
          <div className="logo-badge">
            <ScanText size={26} />
          </div>
          <div>
            <h1 className="brand-title">
              OmniOCR <span style={{ color: "var(--accent-cyan)", fontSize: "14px", fontWeight: "600" }}>STUDIO</span>
            </h1>
            <p className="brand-tagline">AI-Powered Optical Character Recognition Workspace</p>
          </div>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="workspace-grid">
        {/* Left Column: File Selector & Inspector */}
        <section className="glass-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <UploadCloud size={20} /> Input Document
            </h2>
            {file && (
              <span className="badge" style={{ color: "var(--accent-cyan)", borderColor: "rgba(56,189,248,0.3)" }}>
                {file.name.split(".").pop().toUpperCase()}
              </span>
            )}
          </div>

          {!file ? (
            <div
              className={`dropzone ${isDragOver ? "active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="file-input-hidden"
                accept=".jpg,.jpeg,.png,.bmp,.tif,.tiff,.pdf,.docx,.txt"
                onChange={handleFileInputChange}
              />
              <div className="dropzone-icon-wrap">
                <UploadCloud size={32} />
              </div>
              <h3 className="dropzone-heading">Drop document or image here</h3>
              <p className="dropzone-sub">or click anywhere to browse local files</p>
              <div className="format-badges">
                <span className="badge">PNG</span>
                <span className="badge">JPG</span>
                <span className="badge">PDF</span>
                <span className="badge">DOCX</span>
                <span className="badge">TIFF</span>
                <span className="badge">TXT</span>
              </div>
            </div>
          ) : (
            <div className="preview-card">
              <div className="preview-container">
                {preview ? (
                  <img src={preview} alt="Document Preview" className="preview-img" />
                ) : (
                  <div className="preview-file-icon-box">
                    <FileText size={54} />
                    <span className="file-name-large">{file.name}</span>
                  </div>
                )}

                {/* Laser scan animation when processing */}
                {loading && (
                  <div className="scan-overlay">
                    <div className="scan-line"></div>
                  </div>
                )}
              </div>

              <div className="file-meta-bar">
                <div className="file-info">
                  {preview ? <ImageIcon size={18} className="file-icon-sm" /> : <FileText size={18} className="file-icon-sm" />}
                  <div className="file-text-details">
                    <span className="file-name-title">{file.name}</span>
                    <span className="file-size-subtitle">{formatFileSize(file.size)}</span>
                  </div>
                </div>

                <div className="file-actions">
                  {preview && (
                    <button className="icon-btn" title="Inspect Fullscreen" onClick={() => setZoomModal(true)}>
                      <ZoomIn size={16} />
                    </button>
                  )}
                  <button className="icon-btn danger" title="Remove File" onClick={clearAll}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Extract Text Button */}
          <button className="btn-primary" onClick={uploadFile} disabled={!file || loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="spinner" />
                <span>Processing OCR Engine...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Extract Text</span>
              </>
            )}
          </button>
        </section>

        {/* Right Column: Extracted Result & Analytics Workspace */}
        <section className="glass-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <FileCode size={20} /> Extracted Result
            </h2>

            {text && (
              <div className="toolbar-group">
                <button className="tool-btn" onClick={cleanWhitespace} title="Remove empty lines & trim extra whitespace">
                  <Type size={14} /> Clean Format
                </button>
                <button className="tool-btn" onClick={() => convertCase("upper")} title="UPPERCASE">
                  AA
                </button>
                <button className="tool-btn" onClick={() => convertCase("lower")} title="lowercase">
                  aa
                </button>
              </div>
            )}
          </div>

          {/* Workspace Toolbar */}
          <div className="workspace-toolbar">
            <div className="search-container-box">
              <div className="search-input-wrap">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Find text..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {matches.length > 0 && (
                <>
                  <div className="match-counter-pill">
                    <span>{currentMatchIndex + 1} of {matches.length}</span>
                  </div>

                  <button className="search-nav-btn" onClick={() => navigateMatch(-1)} title="Previous match">
                    <ChevronLeft size={14} />
                  </button>
                  <button className="search-nav-btn" onClick={() => navigateMatch(1)} title="Next match">
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
            </div>

            <div className="toolbar-group">
              <button className={`tool-btn ${copied ? "success" : ""}`} onClick={copyText} disabled={!text}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy Text"}</span>
              </button>

              <button
                className="tool-btn success"
                onClick={downloadTxtFile}
                disabled={!text}
                title="Download formatted .txt file"
              >
                <Download size={14} />
                <span>Download .TXT</span>
              </button>

              <button className="tool-btn" onClick={clearAll} title="Clear Workspace" disabled={!text && !file}>
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Text Area with Search Highlight Overlay */}
          <div className="text-editor-container">
            {searchQuery.trim() && matches.length > 0 && (
              <div className="search-highlight-layer" ref={highlightLayerRef}>
                {renderHighlightedText()}
              </div>
            )}

            <textarea
              ref={textareaRef}
              className={`text-editor ${searchQuery.trim() && matches.length > 0 ? "has-search" : ""}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onScroll={handleTextareaScroll}
              placeholder="Extracted OCR text will appear here ready for editing, copying, or downloading..."
            />
          </div>

          {/* Analytics Footer Bar */}
          <div className="analytics-bar">
            <div className="stat-item">
              <span>Characters:</span>
              <span className="stat-value">{stats.chars.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span>Words:</span>
              <span className="stat-value">{stats.words.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span>Lines:</span>
              <span className="stat-value">{stats.lines}</span>
            </div>
            <div className="stat-item">
              <span>Est. Read:</span>
              <span className="stat-value">{stats.readTime}</span>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "error" && <AlertCircle size={16} style={{ color: "var(--accent-rose)" }} />}
            {t.type === "success" && <CheckCircle2 size={16} style={{ color: "var(--accent-emerald)" }} />}
            {t.type === "info" && <Sparkles size={16} style={{ color: "var(--accent-cyan)" }} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Fullscreen Image Preview Modal */}
      {zoomModal && preview && (
        <div className="modal-overlay" onClick={() => setZoomModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setZoomModal(false)}>
              <X size={18} />
            </button>
            <img src={preview} alt="Enlarged Document" className="modal-img" />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;