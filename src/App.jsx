// src/App.jsx
import React, { useRef, useState } from "react";

export default function App() {
  const fileInputRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [imgInfo, setImgInfo] = useState(null);

  // when user selects a file
  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setSrc(url);
    // read natural size as soon as image loads
    const tmp = new Image();
    tmp.onload = () => {
      setImgInfo({ width: tmp.naturalWidth, height: tmp.naturalHeight, name: f.name, size: f.size });
    };
    tmp.src = url;
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-16 bg-gray-50">
      <h1 className="text-3xl font-bold mb-4">Resize Photo & Signature for Govt Exams</h1>
      <p className="text-sm text-gray-600 mb-6">Upload Photo / Signature</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        id="file-input"
      />
      <label htmlFor="file-input" className="btn-primary cursor-pointer px-6 py-3 rounded-md bg-blue-600 text-white shadow">
        Upload Image
      </label>

      {/* Preview + info */}
      {src && (
        <div className="mt-8 w-full max-w-2xl text-center">
          <div style={{ display: "inline-block", borderRadius: 8, overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}>
            <img src={src} alt="preview" style={{ display: "block", maxWidth: "100%", height: "auto" }} />
          </div>

          {imgInfo && (
            <div className="mt-3 text-gray-700">
              <div><strong>File:</strong> {imgInfo.name}</div>
              <div><strong>Original:</strong> {imgInfo.width} × {imgInfo.height} px</div>
              <div><strong>Size:</strong> {(imgInfo.size / 1024).toFixed(1)} KB</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


