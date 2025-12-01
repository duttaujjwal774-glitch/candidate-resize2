import React, { useRef, useState } from "react";

export default function App() {
  const fileInputRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [imgInfo, setImgInfo] = useState(null);

  // Resize states
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepRatio, setKeepRatio] = useState(true);
  const [resizedSrc, setResizedSrc] = useState(null);

  // Load Image
  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    const url = URL.createObjectURL(f);
    setSrc(url);
    setResizedSrc(null);

    const tmp = new Image();
    tmp.onload = () => {
      setImgInfo({
        width: tmp.naturalWidth,
        height: tmp.naturalHeight,
        name: f.name,
        size: f.size,
      });

      setWidth(tmp.naturalWidth);
      setHeight(tmp.naturalHeight);
    };
    tmp.src = url;
  };

  // Resize Function
  const handleResize = () => {
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = parseInt(width);
      canvas.height = parseInt(height);
      const ctx = canvas.getContext("2d");

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const output = canvas.toDataURL("image/jpeg", 0.9);

      setResizedSrc(output);
    };
    img.src = src;
  };

  // Auto-update height if keep ratio = true
  const updateWidth = (val) => {
    setWidth(val);
    if (keepRatio && imgInfo) {
      const ratio = imgInfo.height / imgInfo.width;
      setHeight(Math.round(val * ratio));
    }
  };

  const updateHeight = (val) => {
    setHeight(val);
    if (keepRatio && imgInfo) {
      const ratio = imgInfo.width / imgInfo.height;
      setWidth(Math.round(val * ratio));
    }
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
      <label htmlFor="file-input" className="cursor-pointer px-6 py-3 bg-blue-600 text-white rounded-md shadow">
        Upload Image
      </label>

      {/* ORIGINAL PREVIEW */}
      {src && (
        <div className="mt-8 w-full max-w-2xl text-center">
          <img src={src} alt="preview" className="rounded shadow max-w-full" />

          {imgInfo && (
            <div className="mt-3 text-gray-700">
              <div><strong>File:</strong> {imgInfo.name}</div>
              <div><strong>Original:</strong> {imgInfo.width} × {imgInfo.height} px</div>
              <div><strong>Size:</strong> {(imgInfo.size / 1024).toFixed(1)} KB</div>
            </div>
          )}
        </div>
      )}

      {/* RESIZE CONTROLS */}
      {src && (
        <div className="mt-10 p-5 bg-white shadow rounded-lg w-full max-w-lg">
          <h2 className="text-xl font-semibold mb-4 text-center">Resize Image</h2>

          <div className="flex gap-4 mb-3">
            <div className="w-1/2">
              <label className="text-sm font-medium">Width (px)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => updateWidth(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>

            <div className="w-1/2">
              <label className="text-sm font-medium">Height (px)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => updateHeight(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={keepRatio}
              onChange={() => setKeepRatio(!keepRatio)}
            />
            <label>Keep Aspect Ratio</label>
          </div>

          <button
            onClick={handleResize}
            className="w-full bg-green-600 text-white py-2 rounded shadow"
          >
            Resize Image
          </button>
        </div>
      )}

      {/* RESIZED IMAGE OUTPUT */}
      {resizedSrc && (
        <div className="mt-10 w-full max-w-2xl text-center">
          <h2 className="text-xl font-semibold mb-4">Resized Image</h2>

          <img src={resizedSrc} alt="resized" className="rounded shadow max-w-full" />

          <a
            href={resizedSrc}
            download="resized.jpg"
            className="mt-4 inline-block bg-blue-700 text-white px-6 py-2 rounded shadow"
          >
            Download Image
          </a>
        </div>
      )}
    </div>
  );
}

