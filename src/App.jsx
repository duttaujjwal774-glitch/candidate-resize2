import React, { useState, useRef, useEffect } from "react";

/**
 * Styled Image Resize & Crop (safe, zero deps)
 * - Keep functionality identical to your working version.
 * - Uses CSS in src/index.css for visuals.
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

  // Load image file & info
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
        setWidth(img.width.toString());
        setHeight(img.height.toString());
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  };

  // Draw base image to canvas
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
      const c = canvasRef.current;
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      clearOverlay();
    };
    img.src = preview;
  }, [preview]);

  // utility: get mouse pos relative to canvas
  const getOffset = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Crop event handlers
  const onDown = (e) => {
    if (!preview) return;
    cropStart.current = getOffset(e);
    cropRect.current = null;
  };

  const onMove = (e) => {
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

  const onUp = () => {
    cropStart.current = null;
  };

  // Draw overlay for crop
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
    // dim outside
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    ctx.clearRect(r.x, r.y, r.w, r.h);

    // border
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
  };

  const clearOverlay = () => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  };

  // Crop -> replace preview
  const applyCrop = () => {
    if (!cropRect.current) return alert("Draw crop rectangle (click + drag) first.");
    const r = cropRect.current;
    const base = canvasRef.current;

    // scale factors relative to natural image
    const img = new Image();
    img.onload = () => {
      const scaleX = img.width / base.width;
      const scaleY = img.height / base.height;

      const sx = Math.round(r.x * scaleX);
      const sy = Math.round(r.y * scaleY);
      const sw = Math.round(r.w * scaleX);
      const sh = Math.round(r.h * scaleY);

      const out = document.createElement("canvas");
      out.width = sw;
      out.height = sh;
      const octx = out.getContext("2d");
      octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      setPreview(out.toDataURL("image/jpeg", quality));
      cropRect.current = null;
      clearOverlay();
    };
    img.src = preview;
  };

  // Resize and download
  const resizeDownload = () => {
    if (!preview) return alert("Upload an image first.");
    if (!width || !height) return alert("Enter width and height.");

    const img = new Image();
    img.onload = () => {
      const out = document.createElement("canvas");
      out.width = parseInt(width, 10);
      out.height = parseInt(height, 10);
      const ctx = out.getContext("2d");
      ctx.drawImage(img, 0, 0, out.width, out.height);
      const data = out.toDataURL("image/jpeg", quality);
      const a = document.createElement("a");
      a.href = data;
      a.download = `resized-${fileInfo?.name || "image.jpg"}`;
      a.click();
    };
    img.src = preview;
  };

  // Download crop directly
  const cropDownload = () => {
    if (!cropRect.current) return alert("Draw crop rectangle first.");
    const r = cropRect.current;
    const base = canvasRef.current;
    const img = new Image();
    img.onload = () => {
      const scaleX = img.width / base.width;
      const scaleY = img.height / base.height;

      const sx = Math.round(r.x * scaleX);
      const sy = Math.round(r.y * scaleY);
      const sw = Math.round(r.w * scaleX);
      const sh = Math.round(r.h * scaleY);

      const out = document.createElement("canvas");
      out.width = sw;
      out.height = sh;
      const octx = out.getContext("2d");
      octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const data = out.toDataURL("image/jpeg", quality);
      const a = document.createElement("a");
      a.href = data;
      a.download = `crop-${fileInfo?.name || "image.jpg"}`;
      a.click();
    };
    img.src = preview;
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

  return (
    <div className="app-shell">
      <div className="card">
        <div className="page-title">Image: Resize & Crop</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <input type="file" accept="image/*" onChange={loadFile} />
          <div style={{ marginLeft: "auto" }} className="meta">
            {fileInfo ? (
              <div className="info-box">
                <strong>{fileInfo.name}</strong><br />
                {fileInfo.size} • {fileInfo.type}<br />
                {fileInfo.lastModified}<br />
                {fileInfo.width} × {fileInfo.height} px
              </div>
            ) : (
              <span className="meta">No file selected</span>
            )}
          </div>
        </div>

        <div style={{ height: 18 }} />

        <div className="tool-row">
          <div className="canvas-wrap">
            <div className="canvas-box">
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <canvas
                  ref={canvasRef}
                  onMouseDown={onDown}
                  onMouseMove={onMove}
                  onMouseUp={onUp}
                  style={{ display: preview ? "block" : "none", maxWidth: "100%", maxHeight: "100%" }}
                />
                <canvas
                  ref={overlayRef}
                  style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
                />
                {!preview && (
                  <div style={{ position: "absolute", left: 18, top: 18, color: "#64748b" }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Drop or select an image</div>
                    <div style={{ fontSize: 13 }}>Then draw crop rectangle (click + drag)</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="controls">
            <div>
              <div className="label">Width (px)</div>
              <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>

            <div>
              <div className="label">Height (px)</div>
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>

            <div>
              <div className="label">Quality</div>
              <input type="range" min="0.1" max="1" step="0.01" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
            </div>

            <button className="btn" onClick={resizeDownload}>Resize & Download</button>
            <button className="btn secondary" onClick={cropDownload}>Crop & Download</button>
            <button className="btn secondary" onClick={applyCrop}>Apply Crop (replace preview)</button>
            <button className="btn secondary" onClick={clearCrop}>Clear Crop</button>
            <button className="btn secondary" onClick={clearAll}>Clear All</button>
          </div>
        </div>
      </div>
    </div>
  );
}
