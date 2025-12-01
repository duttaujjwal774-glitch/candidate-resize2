// src/App.jsx
import React, { useRef, useState, useEffect } from "react";

/**
 * Simple image resize UI:
 * - Upload image
 * - Enter width / height (keeps aspect ratio if checkbox is checked)
 * - Choose quality (0.1 - 1.0)
 * - Resize -> preview + output size + download
 */

export default function App() {
  const fileInputRef = useRef(null);
  const [originalSrc, setOriginalSrc] = useState(null); // data URL of uploaded image
  const [originalName, setOriginalName] = useState("");
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);
  const [originalSizeKB, setOriginalSizeKB] = useState(null);

  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepAspect, setKeepAspect] = useState(true);

  const [quality, setQuality] = useState(0.85);
  const [resizedSrc, setResizedSrc] = useState(null);
  const [resizedSizeKB, setResizedSizeKB] = useState(null);

  // When user uploads a file, read it as data URL and set original info
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOriginalName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setOriginalSrc(dataUrl);

      // compute original file size in KB
      try {
        const base64 = dataUrl.split(",")[1];
        const bytes = atob(base64).length;
        setOriginalSizeKB((bytes / 1024).toFixed(1));
      } catch {
        setOriginalSizeKB(null);
      }

      // get natural width/height
      const img = new Image();
      img.onload = () => {
        setOriginalWidth(img.naturalWidth);
        setOriginalHeight(img.naturalHeight);

        // set inputs initially to original dimensions
        setWidth(img.naturalWidth);
        setHeight(img.naturalHeight);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // If keepAspect is true and width changes, update height automatically
  useEffect(() => {
    if (!originalWidth || !originalHeight) return;
    if (!keepAspect) return;

    // Only update when width changes to a valid number
    const w = parseInt(width, 10);
    if (!w || w <= 0) return;
    const newH = Math.round((w / originalWidth) * originalHeight);
    setHeight(newH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  // If keepAspect is true and height changes, update width automatically
  useEffect(() => {
    if (!originalWidth || !originalHeight) return;
    if (!keepAspect) return;

    const h = parseInt(height, 10);
    if (!h || h <= 0) return;
    const newW = Math.round((h / originalHeight) * originalWidth);
    setWidth(newW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Resize function: draws on canvas and produces JPEG data URL
  const handleResize = () => {
    if (!originalSrc) {
      alert("Upload an image first.");
      return;
    }

    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (!w || !h || w <= 0 || h <= 0) {
      alert("Please enter valid width and height.");
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      // draw with aspect fill that stretches to width & height
      ctx.drawImage(img, 0, 0, w, h);

      // convert to JPEG with chosen quality
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        setResizedSrc(dataUrl);

        // compute size in KB
        const base64 = dataUrl.split(",")[1];
        const bytes = atob(base64).length;
        setResizedSizeKB((bytes / 1024).toFixed(1));
      } catch (err) {
        console.error("Failed to convert canvas to dataURL:", err);
        alert("Resize failed — check console for details.");
      }
    };

    img.onerror = () => {
      alert("Error loading original image for resizing.");
    };

    img.src = originalSrc;
  };

  const handleDownload = () => {
    if (!resizedSrc) return;
    const a = document.createElement("a");
    a.href = resizedSrc;
    a.download = `resized-${originalName || "image"}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const clearAll = () => {
    setOriginalSrc(null);
    setOriginalName("");
    setOriginalWidth(0);
    setOriginalHeight(0);
    setOriginalSizeKB(null);
    setWidth("");
    setHeight("");
    setResizedSrc(null);
    setResizedSizeKB(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-6">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-4 text-center">
        Resize Photo & Signature for Govt Exams
      </h1>

      <p className="text-sm text-gray-600 mb-6 text-center">Upload Photo / Signature</p>

      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="p-2 bg-white rounded shadow"
        />
        {originalSrc && (
          <button
            onClick={clearAll}
            className="ml-3 px-3 py-1 bg-red-600 text-white rounded"
            title="Clear"
          >
            Clear
          </button>
        )}
      </div>

      {/* Original preview */}
      {originalSrc && (
        <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-6">
          <div className="flex justify-center mb-4">
            <img
              src={originalSrc}
              alt="original preview"
              style={{ maxWidth: "100%", borderRadius: 8 }}
            />
          </div>
          <div className="text-center text-gray-700">
            <div>
              <strong>File:</strong> {originalName || "uploaded image"}
            </div>
            <div>
              <strong>Original:</strong> {originalWidth} × {originalHeight} px
            </div>
            {originalSizeKB && (
              <div>
                <strong>Size:</strong> {originalSizeKB} KB
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resize controls */}
      {originalSrc && (
        <div className="w-full max-w-2xl bg-white rounded shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Resize Image</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Width (px)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Height (px)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="flex items-center mb-4">
            <input
              id="keepAspect"
              type="checkbox"
              checked={keepAspect}
              onChange={(e) => setKeepAspect(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="keepAspect" className="text-gray-700">
              Keep Aspect Ratio
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">
              Quality: {Math.round(quality * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleResize}
              className="px-5 py-2 bg-green-600 text-white rounded shadow"
            >
              Resize Image
            </button>

            {resizedSrc && (
              <>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-blue-600 text-white rounded shadow"
                >
                  Download Resized
                </button>
                <button
                  onClick={() => {
                    // show resized image in new tab
                    window.open(resizedSrc, "_blank");
                  }}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Open Resized
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Resized preview & info */}
      {resizedSrc && (
        <div className="w-full max-w-3xl bg-white rounded shadow p-6">
          <div className="flex justify-center mb-4">
            <img src={resizedSrc} alt="resized preview" style={{ maxWidth: "100%", borderRadius: 8 }} />
          </div>

          <div className="text-center text-gray-700">
            <div>
              <strong>Output size:</strong> {resizedSizeKB} KB
            </div>
            <div className="mt-3">
              <a
                href={resizedSrc}
                download={`resized-${originalName || "image"}.jpg`}
                className="inline-block px-4 py-2 bg-green-600 text-white rounded"
              >
                Download Resized Image
              </a>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-8 text-sm text-gray-500">
        Tip: pick lower quality (e.g. 0.6) to reduce file size for exam uploads.
      </footer>
    </div>
  );
}

