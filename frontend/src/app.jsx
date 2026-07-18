import React, { useState } from "react";
import axios from "axios";

function App() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [text, setText] = useState("");
    const [txtFile, setTxtFile] = useState("");
    const [loading, setLoading] = useState(false);

    const handleFile = (e) => {
        const selected = e.target.files[0];
        setFile(selected);
        setPreview(URL.createObjectURL(selected));
    };

    const uploadFile = async () => {
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setLoading(true);

        try {
            const res = await axios.post(
                "http://localhost:8000/extract-text",
                formData
            );

            setText(res.data.text);
            setTxtFile(res.data.txt_file);
        } catch (error) {
            alert("Error extracting text");
        }

        setLoading(false);
    };

    const copyText = () => {
        navigator.clipboard.writeText(text);
        alert("Text copied!");
    };

    const clearAll = () => {
        setFile(null);
        setPreview(null);
        setText("");
        setTxtFile("");
    };

    return (
        <div className="container">
            <h1>OCR Text Extractor</h1>
            <input
                type="file"
                accept=".jpg,.jpeg,.png,.bmp,.tif,.tiff,.pdf,.docx,.txt"
                onChange={handleFile}
            />
            {preview && <img src={preview} className="preview" alt="preview" />}

            <button onClick={uploadFile}>Extract Text</button>

            {loading && <p>Processing OCR...</p>}

            <textarea
                className="text-area"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Extracted text will appear here..."
            />

            <div className="btn-group">
                <button onClick={copyText}>Copy Text</button>

                {txtFile && (
                    <a
                        href={`http://localhost:8000/download/${txtFile}`}
                        download
                    >
                        Download TXT
                    </a>
                )}

                <button onClick={clearAll}>Clear</button>
            </div>
        </div>
    );
}

export default App;