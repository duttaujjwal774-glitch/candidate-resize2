import React, { useState, useRef, useEffect } from "react";

/**
 * Clean, complete App.jsx
 * - Image preview, resize, crop, download
 * - Shows file info
 * - No external libs
 * - No truncated functions (tested)
 */

export default function App() {
  const [preview, setPreview] = useState("");
  const [fileInfo, setFileInfo] = useState(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [quality, setQuality] = useState(0.9);

  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const cropStart = useRef(null);
  const cropRect = useRef(null);

  // Load file and show basic info
  const loadFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const info = {
      name: f.name,
      size: (f.size / 1024 / 1024).toFixed(2) + " MB",
      type: f.type,
      lastModified: new Date(f.lastModified).toLocaleString(),
    };

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        info.width = img.width;
        info.height = img.height;
        setFileInfo(info);
        setPreview(ev.target.result);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  };

  // Draw the main image to canvas whenever preview changes
  useEffect(() => {
    if (!preview) {
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);
      }
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      clearOverlay();
    };
    img.src = preview;
  }, [preview]);

  // Helper: get cursor position relative to canvas
  const getOffset = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Mouse handlers for crop
  const onMouseDown = (e) => {
    if (!preview) return;
    cropStart.current = getOffset(e);
    cropRect.current = null;
  };

  const onMouseMove = (e) => {
    if (!cropStart.current) return;
    const pos = getOffset(e);
    const s = cropStart.current;
    const x = Math.min(s.x, pos.x);
    const y = Math.min(s.y, pos.y);
    const w = Math.abs(pos.x - s.x);
    const h = Math.abs(pos.y - s.y);
    cropRect.current = { x, y, w, h };
    drawOverlay();
  };

  const onMouseUp = () => {
    cropStart.current = null;
  };

  // Draw overlay rectangle for crop
  const drawOverlay = () => {
    const overlay = overlayRef.current;
    const base = canvasRef.current;
    if (!overlay || !base) return;
    overlay.width = base.width;
    overlay.height = base.height;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!cropRect.current) return;
    const r = cropRect.current;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    ctx.clearRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
  };

  const clearOverlay = () => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.width = overlay.width; // clears
  };

  // Crop & download the selected portion
  const cropAndDownload = () => {
    if (!cropRect.current) return alert("Draw a crop rectangle first (click + drag).");
    const base = canvasRef.current;
    const img = new Image();
    img.onload = () => {
      // convert canvas overlay coords to natural coords
      const scaleX = img.width / base.width;
      const scaleY = img.height / base.height;
      const r = cropRect.current;
      const sx = Math.round(r.x * scaleX);
      const sy = Math.round(r.y * scaleY);
      const sw = Math.round(r.w * scaleX);
      const sh = Math.round(r.h * scaleY);

      const out = document.createElement("canvas");
      out.width = sw;
      out.height = sh;
      const octx = out.getContext("2d");
      octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      out.toBlob((b) => {
        if (!b) return alert("Failed to create crop.");
        downloadBlob(b, `crop-${fileInfo?.name || "image.jpg"}`);
      }, "image/jpeg", quality);
    };
    img.src = preview;
  };

  // Resize & download
  const resizeAndDownload = () => {
    if (!preview) return alert("Upload an image first");
    if (!width || !height) return alert("Enter width and height");

    const img = new Image();
    img.onload = () => {
      const out = document.createElement("canvas");
      out.width = parseInt(width, 10);
      out.height = parseInt(height, 10);
      const octx = out.getContext("2d");
      octx.drawImage(img, 0, 0, out.width, out.height);
      out.toBlob((b) => {
        if (!b) return alert("Failed to generate image.");
        downloadBlob(b, `resized-${fileInfo?.name || "image.jpg"}`);
      }, "image/jpeg", quality);
    };
    img.src = preview;
  };

  // Download helper
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const clearCrop = () => {
    cropRect.current = null;
    clearOverlay();
  };

  const clearAll = () => {
    setPreview("");
    setFileInfo(null);
    setWidth("");
    setHeight("");
    setQuality(0.9);
    cropRect.current = null;
    clearOverlay();
  };

  // UI
  return (
    <div style={{ padding: 20, fontFamily: "system-ui, Arial, sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>Image: Resize & Crop</h1>

      <input type="file" accept="image/*" onChange={loadFile} style={{ marginBottom: 12 }} />

      {fileInfo && (
        <div style={{ marginBottom: 12 }}>
          <strong>File:</strong> {fileInfo.name} • {fileInfo.size} • {fileInfo.type} • {fileInfo.lastModified}
          <div>Resolution: {fileInfo.width} × {fileInfo.height} px</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ position: "relative", border: "1px solid #ddd", width: 600, height: 400 }}>
          <canvas
            ref={canvasRef}
            style={{ display: "block", width: "100%", height: "100%" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          />
          <canvas
            ref={overlayRef}
            style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", width: "100%", height: "100%" }}
          />
        </div>

        <div style={{ width: 260 }}>
          <div style={{ marginBottom: 8 }}>
            <label>Width (px)</label><br />
            <input value={width} onChange={(e) => setWidth(e.target.value)} style={{ width: "100%" }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Height (px)</label><br />
            <input value={height} onChange={(e) => setHeight(e.target.value)} style={{ width: "100%" }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Quality</label><br />
            <input type="range" min="0.1" max="1" step="0.05" value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ width: "100%" }} />
          </div>

          <button onClick={resizeAndDownload} style={{ width: "100%", marginBottom: 8 }}>Resize & Download</button>
          <button onClick={cropAndDownload} style={{ width: "100%", marginBottom: 8 }}>Crop & Download</button>
          <button onClick={clearCrop} style={{ width: "100%", marginBottom: 8 }}>Clear Crop</button>
          <button onClick={clearAll} style={{ width: "100%" }}>Clear All</button>
        </div>
      </div>
    </div>
  );
}
