import React, { useEffect, useRef, useState } from "react";

/**
 * Final improved App.jsx
 * - Stable canvas rendering for large images
 * - Drag & drop upload
 * - Crop overlay that doesn't block image
 * - Resize & real-time preview
 * - Dark mode toggle
 * - Simple sidebar
 *
 * Replace your src/App.jsx fully with this file.
 */

export default function App() {
  // UI state
  const [previewData, setPreviewData] = useState(""); // data URL shown in canvas
  const [fileInfo, setFileInfo] = useState(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [quality, setQuality] = useState(0.92);
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // canvas refs
  const containerRef = useRef(null);
  const canvasRef = useRef(null); // displayed canvas
  const overlayRef = useRef(null); // overlay canvas
  const naturalRef = useRef(null); // natural Image object (original pixels)
  const displayScaleRef = useRef(1); // natural_px / display_px

  // crop state (use refs for fast updates)
  const cropStartRef = useRef(null);
  const cropRectRef = useRef(null);

  // drag & drop highlight
  const [dragging, setDragging] = useState(false);

  // -----------------------
  // Load file (from input or drop)
  // -----------------------
  const loadFileFromFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target.result;
      const img = new Image();
      img.onload = () => {
        naturalRef.current = img;
        setPreviewData(data);
        setFileInfo({
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(2) + " MB",
          type: file.type || "image",
          lastModified: new Date(file.lastModified).toLocaleString(),
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        setWidth(String(img.naturalWidth));
        setHeight(String(img.naturalHeight));
      };
      img.onerror = () => {
        alert("Invalid image file");
      };
      img.src = data;
    };
    reader.readAsDataURL(file);
  };

  const onFileInput = (e) => {
    const f = e.target.files?.[0];
    if (f) loadFileFromFile(f);
  };

  // -----------------------
  // Drag & drop handlers
  // -----------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDragOver = (ev) => {
      ev.preventDefault();
      setDragging(true);
    };
    const onDragLeave = (ev) => {
      ev.preventDefault();
      setDragging(false);
    };
    const onDrop = (ev) => {
      ev.preventDefault();
      setDragging(false);
      const f = ev.dataTransfer.files?.[0];
      if (f) loadFileFromFile(f);
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);

    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  // -----------------------
  // Draw image into display canvas (scaled to fit)
  // -----------------------
  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      const container = containerRef.current;
      if (!canvas || !overlay || !container) return;

      // container size available for canvas
      const maxW = Math.max(320, container.clientWidth - 320); // leave room for controls
      const maxH = 520; // fixed max height for consistent layout

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const img = naturalRef.current;
      if (!img) {
        // show placeholder canvas size
        canvas.width = Math.min(640, maxW);
        canvas.height = Math.min(420, maxH);
        canvas.style.width = canvas.width + "px";
        canvas.style.height = canvas.height + "px";
        // clear overlay same size
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        overlay.style.width = canvas.style.width;
        overlay.style.height = canvas.style.height;
        return;
      }

      // natural image size
      const nW = img.naturalWidth || img.width;
      const nH = img.naturalHeight || img.height;

      // compute scale so image fits into maxW x maxH
      const ratio = Math.min(1, Math.min(maxW / nW, maxH / nH));
      const displayW = Math.max(120, Math.round(nW * ratio));
      const displayH = Math.max(80, Math.round(nH * ratio));

      // set canvas pixel size to display size (no CSS scaling)
      canvas.width = displayW;
      canvas.height = displayH;
      canvas.style.width = displayW + "px";
      canvas.style.height = displayH + "px";

      // overlay exact match
      overlay.width = displayW;
      overlay.height = displayH;
      overlay.style.width = canvas.style.width;
      overlay.style.height = canvas.style.height;

      // scale factor from display px->natural px
      displayScaleRef.current = nW / displayW;

      // draw image into canvas scaled
      ctx.clearRect(0, 0, displayW, displayH);
      ctx.drawImage(img, 0, 0, displayW, displayH);

      // clear overlay contents
      const octx = overlay.getContext("2d");
      octx.clearRect(0, 0, overlay.width, overlay.height);

      // if crop exists redraw overlay
      if (cropRectRef.current) drawOverlay();
    };

    // initial draw and redraw on resize
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [previewData]); // redraw when previewData changes or window resizes

  // -----------------------
  // Mouse / Crop helpers
  // -----------------------
  const getDisplayPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    };
  };

  const onMouseDown = (e) => {
    if (!naturalRef.current) return;
    cropStartRef.current = getDisplayPos(e);
    cropRectRef.current = null;
  };

  const onMouseMove = (e) => {
    if (!cropStartRef.current) return;
    const pos = getDisplayPos(e);
    const s = cropStartRef.current;
    const x = Math.min(s.x, pos.x);
    const y = Math.min(s.y, pos.y);
    const w = Math.max(1, Math.abs(pos.x - s.x));
    const h = Math.max(1, Math.abs(pos.y - s.y));
    cropRectRef.current = { x, y, w, h };
    drawOverlay();
  };

  const onMouseUp = () => {
    cropStartRef.current = null;
  };

  function drawOverlay() {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const r = cropRectRef.current;
    if (!r) return;
    // dim outside rect
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    // clear selected area
    ctx.clearRect(r.x, r.y, r.w, r.h);
    // border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
  }

  function clearOverlay() {
    cropRectRef.current = null;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }

  // Convert displayed rect to natural pixels
  function displayedToNatural(r) {
    const scale = displayScaleRef.current || 1;
    return {
      sx: Math.round(r.x * scale),
      sy: Math.round(r.y * scale),
      sw: Math.round(r.w * scale),
      sh: Math.round(r.h * scale),
    };
  }

  // -----------------------
  // Actions: crop, resize, download
  // -----------------------
  const cropAndDownload = () => {
    const r = cropRectRef.current;
    if (!r || !naturalRef.current) return alert("Draw crop rectangle (click and drag).");
    const nat = displayedToNatural(r);
    const img = naturalRef.current;
    const out = document.createElement("canvas");
    out.width = nat.sw;
    out.height = nat.sh;
    const ctx = out.getContext("2d");
    ctx.drawImage(img, nat.sx, nat.sy, nat.sw, nat.sh, 0, 0, nat.sw, nat.sh);
    out.toBlob(
      (b) => {
        if (!b) return alert("Failed to generate file");
        downloadBlob(b, `crop-${fileInfo?.name || "image.jpg"}`);
      },
      "image/jpeg",
      quality
    );
  };

  const applyCrop = () => {
    const r = cropRectRef.current;
    if (!r || !naturalRef.current) return alert("Draw crop rectangle (click and drag).");
    const nat = displayedToNatural(r);
    const img = naturalRef.current;
    const out = document.createElement("canvas");
    out.width = nat.sw;
    out.height = nat.sh;
    const ctx = out.getContext("2d");
    ctx.drawImage(img, nat.sx, nat.sy, nat.sw, nat.sh, 0, 0, nat.sw, nat.sh);
    const data = out.toDataURL("image/jpeg", quality);

    // update natural image with cropped version
    const newImg = new Image();
    newImg.onload = () => {
      naturalRef.current = newImg;
      setPreviewData(data);
      clearOverlay();
    };
    newImg.src = data;
  };

  const resizeAndDownload = () => {
    if (!naturalRef.current) return alert("Upload an image first.");
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (!w || !h) return alert("Enter width and height.");
    const img = naturalRef.current;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    out.toBlob(
      (b) => {
        if (!b) return alert("Failed to generate file");
        downloadBlob(b, `resized-${fileInfo?.name || "image.jpg"}`);
      },
      "image/jpeg",
      quality
    );
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

  const clearAll = () => {
    naturalRef.current = null;
    setPreviewData("");
    setFileInfo(null);
    setWidth("");
    setHeight("");
    setQuality(0.92);
    clearOverlay();
  };

  // -----------------------
  // Real-time resize preview: return a small dataURL for user to preview
  // -----------------------
  const [previewThumb, setPreviewThumb] = useState("");
  useEffect(() => {
    if (!naturalRef.current) {
      setPreviewThumb("");
      return;
    }
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (!w || !h) {
      setPreviewThumb("");
      return;
    }
    // create a small preview to show result
    const img = naturalRef.current;
    const tmp = document.createElement("canvas");
    tmp.width = Math.min(400, w);
    tmp.height = Math.min(300, h);
    const tctx = tmp.getContext("2d");
    tctx.drawImage(img, 0, 0, w, h, 0, 0, tmp.width, tmp.height);
    setPreviewThumb(tmp.toDataURL("image/jpeg", quality));
  }, [width, height, quality, previewData]);

  // -----------------------
  // UI render
  // -----------------------
  return (
    <div className={dark ? "app-shell dark" : "app-shell"}>
      <div className="topbar">
        <div className="page-title">Image: Resize & Crop</div>
        <div className="top-actions">
          <label className="switch">
            <input type="checkbox" checked={dark} onChange={() => setDark(!dark)} />
            <span className="slider" />
          </label>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen((s) => !s)}>
            {sidebarOpen ? "Hide" : "Show"} Sidebar
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="file" accept="image/*" onChange={onFileInput} />
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

        <div style={{ display: "flex", gap: 20 }}>
          {/* MAIN CANVAS AREA */}
          <div className="canvas-wrap" ref={containerRef}>
            <div className={dragging ? "canvas-box dragging" : "canvas-box"}>
              <div
                style={{ position: "relative", width: "100%", height: "100%" }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) loadFileFromFile(f);
                }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  className="main-canvas"
                />
                <canvas ref={overlayRef} className="overlay-canvas" />
                {!previewData && (
                  <div className="placeholder">
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Drop or select an image</div>
                    <div style={{ fontSize: 13 }}>Then draw crop rectangle (click + drag)</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CONTROLS */}
          <div className="controls">
            <div>
              <div className="label">Width (px)</div>
              <input value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>

            <div>
              <div className="label">Height (px)</div>
              <input value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>

            <div>
              <div className="label">Quality</div>
              <input type="range" min="0.1" max="1" step="0.01" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button className="btn" onClick={resizeAndDownload}>Resize & Download</button>
            </div>

            <button className="btn secondary" onClick={cropAndDownload}>Crop & Download</button>
            <button className="btn secondary" onClick={applyCrop}>Apply Crop (replace preview)</button>
            <button className="btn secondary" onClick={clearOverlay}>Clear Crop</button>
            <button className="btn secondary" onClick={clearAll}>Clear All</button>

            <div style={{ height: 12 }} />

            <div className="label">Real-time Resize Preview</div>
            <div className="preview-thumb">
              {previewThumb ? (
                <img src={previewThumb} alt="preview" style={{ maxWidth: "100%" }} />
              ) : (
                <div className="meta">Enter width & height to see preview</div>
              )}
            </div>
          </div>

          {/* SIDEBAR */}
          {sidebarOpen && (
            <aside className="sidebar">
              <h4>Extras</h4>
              <p className="meta">Drag & drop supported. Works fully in-browser.</p>
              <p className="meta">Dark mode: {dark ? "On" : "Off"}</p>
              <div style={{ marginTop: 8 }}>
                <button className="btn secondary" onClick={() => { setQuality(0.8); }}>Quick Compress</button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
