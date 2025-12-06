import React, { useState, useRef, useEffect } from "react";

/**
 * Improved App.jsx
 * - Proper canvas sizing and overlay sync
 * - Keeps natural image for exact crop/resize math
 * - UI same as before but fixes overlay overlap & alignment
 */

export default function App() {
  const [preview, setPreview] = useState("");
  const [fileInfo, setFileInfo] = useState(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [quality, setQuality] = useState(0.9);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  // natural image (keeps original pixel dimensions)
  const naturalImgRef = useRef(null);
  // scale from natural -> displayed
  const displayScaleRef = useRef(1);

  const cropStart = useRef(null);
  const cropRect = useRef(null);

  // Load file and prepare preview
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
        naturalImgRef.current = img; // store original
        info.width = img.naturalWidth || img.width;
        info.height = img.naturalHeight || img.height;
        setFileInfo(info);
        setPreview(ev.target.result);

        // set form width/height defaults to natural dimensions
        setWidth(String(info.width));
        setHeight(String(info.height));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  };

  // Draw image onto canvas sized to container (keeps overlay sync)
  useEffect(() => {
    const draw = () => {
      const img = naturalImgRef.current;
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      if (!canvas || !overlay) return;

      const container = containerRef.current;
      const maxW = Math.max(320, (container?.clientWidth || 620) - 12); // ensure minimum
      const maxH = 520; // fixed max height for layout
      if (!img) {
        // clear canvases
        canvas.width = Math.floor(maxW * 0.9);
        canvas.height = Math.floor(maxH * 0.85);
        canvas.style.width = canvas.width + "px";
        canvas.style.height = canvas.height + "px";
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        overlay.style.width = canvas.style.width;
        overlay.style.height = canvas.style.height;
        return;
      }

      // Calculate scale so image fits inside maxW x maxH while preserving aspect ratio
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      const ratio = Math.min(1, Math.min(maxW / naturalW, maxH / naturalH));
      const displayW = Math.max(100, Math.round(naturalW * ratio));
      const displayH = Math.max(80, Math.round(naturalH * ratio));

      // Set canvas pixel size to display size (no CSS scaling)
      canvas.width = displayW;
      canvas.height = displayH;
      canvas.style.width = displayW + "px";
      canvas.style.height = displayH + "px";

      // Overlay must match exactly
      overlay.width = displayW;
      overlay.height = displayH;
      overlay.style.width = canvas.style.width;
      overlay.style.height = canvas.style.height;

      // remember scale factor to convert displayed coords -> natural coords
      displayScaleRef.current = naturalW / displayW;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, displayW, displayH);
      ctx.drawImage(img, 0, 0, displayW, displayH);

      // clear overlay if any previous dimming exists
      const octx = overlay.getContext("2d");
      octx.clearRect(0, 0, overlay.width, overlay.height);
      // redraw rectangle if present (keep selection)
      if (cropRect.current) drawOverlay(); 
    };

    draw();
    // also redraw on window resize to adapt
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [preview]);

  // get mouse position relative to displayed canvas (pixels)
  const getDisplayOffset = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    };
  };

  // Mouse handlers for cropping
  const onDown = (e) => {
    if (!naturalImgRef.current) return;
    cropStart.current = getDisplayOffset(e);
    cropRect.current = null;
  };

  const onMove = (e) => {
    if (!cropStart.current) return;
    const pos = getDisplayOffset(e);
    const s = cropStart.current;
    const x = Math.min(s.x, pos.x);
    const y = Math.min(s.y, pos.y);
    const w = Math.max(1, Math.abs(pos.x - s.x));
    const h = Math.max(1, Math.abs(pos.y - s.y));
    cropRect.current = { x, y, w, h };
    drawOverlay();
  };

  const onUp = () => {
    cropStart.current = null;
  };

  // draw overlay rectangle and dim outside region
  const drawOverlay = () => {
    const overlay = overlayRef.current;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const r = cropRect.current;
    if (!r) return;

    // dim outside
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);

    // clear selected rect area
    ctx.clearRect(r.x, r.y, r.w, r.h);

    // draw border
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
  };

  const clearOverlay = () => {
    cropRect.current = null;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  };

  // Convert displayed rect to natural-pixel rect (for precise crop/download)
  const displayedToNaturalRect = (r) => {
    const scale = displayScaleRef.current || 1;
    return {
      sx: Math.round(r.x * scale),
      sy: Math.round(r.y * scale),
      sw: Math.round(r.w * scale),
      sh: Math.round(r.h * scale),
    };
  };

  // Crop & replace preview (applies crop to natural image and sets preview)
  const applyCrop = () => {
    if (!cropRect.current || !naturalImgRef.current) return alert("Draw crop first (click + drag).");
    const naturalImg = naturalImgRef.current;
    const r = displayedToNaturalRect(cropRect.current);

    const out = document.createElement("canvas");
    out.width = r.sw;
    out.height = r.sh;
    const octx = out.getContext("2d");
    octx.drawImage(naturalImg, r.sx, r.sy, r.sw, r.sh, 0, 0, r.sw, r.sh);

    const data = out.toDataURL("image/jpeg", quality);
    // update natural image reference to cropped image
    const newImg = new Image();
    newImg.onload = () => {
      naturalImgRef.current = newImg;
      setPreview(data);
      clearOverlay();
    };
    newImg.src = data;
  };

  // Crop & download without replacing preview
  const cropDownload = () => {
    if (!cropRect.current || !naturalImgRef.current) return alert("Draw crop first (click + drag).");
    const naturalImg = naturalImgRef.current;
    const r = displayedToNaturalRect(cropRect.current);

    const out = document.createElement("canvas");
    out.width = r.sw;
    out.height = r.sh;
    const octx = out.getContext("2d");
    octx.drawImage(naturalImg, r.sx, r.sy, r.sw, r.sh, 0, 0, r.sw, r.sh);

    out.toBlob((blob) => {
      if (!blob) return alert("Failed to generate file");
      downloadBlob(blob, `crop-${fileInfo?.name || "image.jpg"}`);
    }, "image/jpeg", quality);
  };

  // Resize & download (uses natural image for best quality)
  const resizeAndDownload = () => {
    if (!naturalImgRef.current) return alert("Upload image first");
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (!w || !h) return alert("Enter width and height");

    const natural = naturalImgRef.current;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d");
    octx.drawImage(natural, 0, 0, w, h);
    out.toBlob((blob) => {
      if (!blob) return alert("Failed to generate file");
      downloadBlob(blob, `resized-${fileInfo?.name || "image.jpg"}`);
    }, "image/jpeg", quality);
  };

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
    clearOverlay();
  };

  const clearAll = () => {
    setPreview("");
    setFileInfo(null);
    naturalImgRef.current = null;
    displayScaleRef.current = 1;
    clearOverlay();
  };

  return (
    <div className="app-shell">
      <div className="card">
        <div className="page-title">Image: Resize & Crop</div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="file" accept="image/*" onChange={loadFile} />
          <div style={{ marginLeft: "auto" }} className="file-info-wrapper">
            {fileInfo ? (
              <div className="info-box">
                <div style={{ fontWeight: 700 }}>{fileInfo.name}</div>
                <div style={{ fontSize: 13 }}>{fileInfo.size} • {fileInfo.type}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{fileInfo.lastModified}</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{fileInfo.width} × {fileInfo.height} px</div>
              </div>
            ) : (
              <div className="meta">No file selected</div>
            )}
          </div>
        </div>

        <div style={{ height: 14 }} />

        <div className="tool-row">
          <div className="canvas-wrap" ref={containerRef}>
            <div className="canvas-box" style={{ padding: 14 }}>
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <canvas
                  ref={canvasRef}
                  onMouseDown={onDown}
                  onMouseMove={onMove}
                  onMouseUp={onUp}
                  style={{ display: "block" }}
                />
                <canvas
                  ref={overlayRef}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    pointerEvents: "none",
                  }}
                />
                {!preview && (
                  <div style={{ position: "absolute", left: 28, top: 28, color: "#64748b" }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Drop or select an image</div>
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

            <button className="btn" onClick={resizeAndDownload}>Resize & Download</button>
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
