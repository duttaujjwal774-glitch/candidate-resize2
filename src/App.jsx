import React, { useEffect, useRef, useState } from "react";

/**
 * Replace entire src/App.jsx with this file.
 * Fixes:
 *  - prevents CSS scaling of canvas (no height:auto / max-width)
 *  - centers the canvas in the inner wrapper by setting left/top
 * Includes:
 *  - drag & drop upload
 *  - dark mode toggle
 *  - sidebar
 *  - crop overlay (non-blocking)
 *  - resize & download, crop & download, apply crop
 *  - real-time resize preview
 *
 * IMPORTANT: Replace whole file. Commit & redeploy. Hard refresh the page.
 */

export default function App() {
  const [previewData, setPreviewData] = useState("");
  const [fileInfo, setFileInfo] = useState(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [quality, setQuality] = useState(0.92);
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [previewThumb, setPreviewThumb] = useState("");

  const containerRef = useRef(null);
  const controlsRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const naturalRef = useRef(null);
  const displayScaleRef = useRef(1);

  const cropStartRef = useRef(null);
  const cropRectRef = useRef(null);

  // injected CSS (explicitly prevents canvas CSS-scaling and centers)
  const css = `
  :root{--bg:#f7f9fc;--card:#fff;--text:#0f172a;--muted:#64748b;--accent1:#2563eb;--accent2:#7c3aed}
  .app-shell{max-width:1180px;margin:28px auto;font-family:Inter,system-ui,Arial;color:var(--text)}
  .app-shell.dark{background:#061223;color:#e6eef8}
  .card{background:var(--card);padding:18px;border-radius:12px;box-shadow:0 10px 30px rgba(14,20,40,0.06);border:1px solid rgba(14,20,40,0.04)}
  .app-shell.dark .card{background:#071123;box-shadow:0 12px 30px rgba(2,6,23,0.6);border:1px solid rgba(255,255,255,0.03)}
  .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .page-title{font-weight:700;font-size:20px}
  .canvas-wrap{flex:1;min-width:340px}
  .canvas-box{border-radius:10px;min-height:420px;border:1px solid rgba(14,20,40,0.04);background:linear-gradient(180deg,#fbfdff,#f7f9fc);padding:14px;position:relative;overflow:hidden}
  .app-shell.dark .canvas-box{background:linear-gradient(180deg,#071123,#04101a);border-color:rgba(255,255,255,0.02)}
  .canvas-box .inner{position:relative;width:100%;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center}
  /* IMPORTANT: canvas must NOT be CSS-scaled (no max-width/height:auto). 
     We'll set exact pixel width/height and position it with left/top. */
  .main-canvas{position:absolute;z-index:1;border-radius:6px;background:transparent;display:block;box-shadow:0 6px 18px rgba(14,20,40,0.03)}
  .overlay-canvas{position:absolute;left:0;top:0;z-index:3;pointer-events:none;background:transparent}
  .placeholder{position:absolute;left:28px;top:28px;color:var(--muted)}
  .controls{width:300px;display:flex;flex-direction:column;gap:10px;margin-top:6px}
  .controls input[type="number"], .controls input[type="text"]{width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(14,20,40,0.06);background:transparent;color:inherit}
  .btn{display:inline-block;background:linear-gradient(90deg,var(--accent1),var(--accent2));color:#fff;border:none;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:700;border:0;width:100%}
  .btn.secondary{background:transparent;color:var(--text);border:1px solid rgba(14,20,40,0.06);box-shadow:none;font-weight:600}
  .preview-thumb{background:#fbfdff;border-radius:8px;padding:8px;border:1px solid rgba(14,20,40,0.03);min-height:48px;display:flex;align-items:center;justify-content:center}
  .info-box{background:#f8fafc;border-radius:8px;padding:10px;border:1px solid rgba(14,20,40,0.03);font-size:13px;color:#334155}
  .label{font-weight:700;font-size:13px;margin-bottom:6px;color:var(--text)}
  .meta{font-size:13px;color:#475569}
  .sidebar{width:220px;padding:10px;border-left:1px solid rgba(14,20,40,0.04)}
  .switch{display:inline-block;margin-right:8px}
  .switch input{display:none}
  .switch .slider{display:inline-block;width:44px;height:24px;background:#e6eef8;border-radius:20px;position:relative}
  .switch .slider:after{content:'';position:absolute;left:4px;top:4px;width:16px;height:16px;background:#fff;border-radius:50%;transition:all .15s}
  .switch input:checked + .slider{background:linear-gradient(90deg,var(--accent1),var(--accent2))}
  .switch input:checked + .slider:after{transform:translateX(20px)}
  .canvas-box.dragging{outline:3px dashed rgba(37,99,235,0.12);outline-offset:-6px}
  @media (max-width:980px){.controls{width:100%}.canvas-wrap{min-width:100%}.sidebar{display:none}}
  `;

  // load file helper
  function loadFile(f) {
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const data = ev.target.result;
      const img = new Image();
      img.onload = () => {
        naturalRef.current = img;
        setPreviewData(data);
        setFileInfo({
          name: f.name,
          size: (f.size / 1024 / 1024).toFixed(2) + " MB",
          type: f.type || "image",
          lastModified: new Date(f.lastModified).toLocaleString(),
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        setWidth(String(img.naturalWidth));
        setHeight(String(img.naturalHeight));
      };
      img.onerror = () => alert("Invalid image file");
      img.src = data;
    };
    r.readAsDataURL(f);
  }

  const onFileInput = (e) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  };

  // drag & drop wiring
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDragOver = (ev) => { ev.preventDefault(); setDragging(true); };
    const onDragLeave = (ev) => { ev.preventDefault(); setDragging(false); };
    const onDrop = (ev) => { ev.preventDefault(); setDragging(false); const f = ev.dataTransfer.files?.[0]; if (f) loadFile(f); };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => { el.removeEventListener("dragover", onDragOver); el.removeEventListener("dragleave", onDragLeave); el.removeEventListener("drop", onDrop); };
  }, []);

  // robust draw + centering: this is the critical fix
  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      const container = containerRef.current;
      if (!canvas || !overlay || !container) return;

      // measure inner wrapper exactly
      const inner = container.querySelector(".inner");
      const innerW = inner ? inner.clientWidth : container.clientWidth;
      const innerH = inner ? inner.clientHeight : container.clientHeight;
      const maxH = Math.max(240, Math.min(820, innerH || 520));

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const img = naturalRef.current;
      if (!img) {
        // placeholder size
        const pw = Math.min(960, Math.max(360, innerW));
        const ph = Math.min(520, maxH);
        canvas.width = pw; canvas.height = ph;
        canvas.style.width = pw + "px"; canvas.style.height = ph + "px";
        // center
        const left = Math.max(0, Math.round((innerW - pw) / 2));
        const top = Math.max(0, Math.round((innerH - ph) / 2));
        canvas.style.left = left + "px";
        canvas.style.top = top + "px";
        overlay.width = canvas.width; overlay.height = canvas.height;
        overlay.style.width = canvas.style.width; overlay.style.height = canvas.style.height;
        overlay.style.left = canvas.style.left; overlay.style.top = canvas.style.top;
        return;
      }

      const nW = img.naturalWidth || img.width;
      const nH = img.naturalHeight || img.height;

      // display width: use inner width (fill available area), but limit to image natural width
      let displayW = Math.max(160, Math.min(innerW, nW));
      // compute display height from aspect ratio but cap to maxH
      let displayH = Math.max(120, Math.round(displayW * (nH / nW)));
      if (displayH > maxH) {
        displayH = maxH;
        displayW = Math.max(160, Math.round(displayH * (nW / nH)));
      }

      // set canvas pixel dimensions exactly (no CSS scaling)
      canvas.width = displayW;
      canvas.height = displayH;
      canvas.style.width = displayW + "px";
      canvas.style.height = displayH + "px";

      // center horizontally and vertically in inner
      const left = Math.max(0, Math.round((innerW - displayW) / 2));
      const top = Math.max(0, Math.round((innerH - displayH) / 2));
      canvas.style.left = left + "px";
      canvas.style.top = top + "px";

      // overlay matches canvas and is positioned same offset
      overlay.width = displayW;
      overlay.height = displayH;
      overlay.style.width = canvas.style.width;
      overlay.style.height = canvas.style.height;
      overlay.style.left = canvas.style.left;
      overlay.style.top = canvas.style.top;

      // scale factor for mapping display -> natural
      displayScaleRef.current = nW / displayW;

      // draw the scaled image into canvas
      ctx.clearRect(0, 0, displayW, displayH);
      ctx.drawImage(img, 0, 0, displayW, displayH);

      // clear overlay
      const octx = overlay.getContext("2d");
      octx.clearRect(0, 0, overlay.width, overlay.height);

      if (cropRectRef.current) drawOverlay();
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [previewData]);

  // crop helpers
  const getDisplayPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) };
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
    const x = Math.min(s.x, pos.x), y = Math.min(s.y, pos.y);
    const w = Math.max(1, Math.abs(pos.x - s.x)), h = Math.max(1, Math.abs(pos.y - s.y));
    cropRectRef.current = { x, y, w, h };
    drawOverlay();
  };
  const onMouseUp = () => { cropStartRef.current = null; };

  function drawOverlay() {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const r = cropRectRef.current;
    if (!r) return;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    ctx.clearRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
  }

  function clearOverlay() {
    cropRectRef.current = null;
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
  }

  function displayedToNatural(r) {
    const scale = displayScaleRef.current || 1;
    return { sx: Math.round(r.x * scale), sy: Math.round(r.y * scale), sw: Math.round(r.w * scale), sh: Math.round(r.h * scale) };
  }

  // actions
  const cropAndDownload = () => {
    const r = cropRectRef.current;
    if (!r || !naturalRef.current) return alert("Draw crop rectangle (click + drag).");
    const nat = displayedToNatural(r);
    const img = naturalRef.current;
    const out = document.createElement("canvas");
    out.width = nat.sw; out.height = nat.sh;
    out.getContext("2d").drawImage(img, nat.sx, nat.sy, nat.sw, nat.sh, 0, 0, nat.sw, nat.sh);
    out.toBlob((b) => { if (!b) return alert("Failed"); downloadBlob(b, `crop-${fileInfo?.name || "image.jpg"}`); }, "image/jpeg", quality);
  };

  const applyCrop = () => {
    const r = cropRectRef.current;
    if (!r || !naturalRef.current) return alert("Draw crop rectangle first.");
    const nat = displayedToNatural(r);
    const img = naturalRef.current;
    const out = document.createElement("canvas");
    out.width = nat.sw; out.height = nat.sh;
    out.getContext("2d").drawImage(img, nat.sx, nat.sy, nat.sw, nat.sh, 0, 0, nat.sw, nat.sh);
    const data = out.toDataURL("image/jpeg", quality);
    const newImg = new Image();
    newImg.onload = () => { naturalRef.current = newImg; setPreviewData(data); clearOverlay(); };
    newImg.src = data;
  };

  const resizeAndDownload = () => {
    if (!naturalRef.current) return alert("Upload an image first.");
    const w = parseInt(width, 10), h = parseInt(height, 10);
    if (!w || !h) return alert("Enter width and height.");
    const img = naturalRef.current;
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    out.getContext("2d").drawImage(img, 0, 0, w, h);
    out.toBlob((b) => { if (!b) return alert("Failed"); downloadBlob(b, `resized-${fileInfo?.name || "image.jpg"}`); }, "image/jpeg", quality);
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    naturalRef.current = null; setPreviewData(""); setFileInfo(null); setWidth(""); setHeight(""); setQuality(0.92); clearOverlay();
  };

  // preview thumb
  useEffect(() => {
    if (!naturalRef.current) { setPreviewThumb(""); return; }
    const w = parseInt(width, 10), h = parseInt(height, 10);
    if (!w || !h) { setPreviewThumb(""); return; }
    const img = naturalRef.current;
    const tmp = document.createElement("canvas");
    tmp.width = Math.min(420, w); tmp.height = Math.min(340, h);
    tmp.getContext("2d").drawImage(img, 0, 0, w, h, 0, 0, tmp.width, tmp.height);
    setPreviewThumb(tmp.toDataURL("image/jpeg", quality));
  }, [width, height, quality, previewData]);

  return (
    <div className={dark ? "app-shell dark" : "app-shell"}>
      <style>{css}</style>

      <div className="topbar">
        <div className="page-title">Image: Resize & Crop</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="switch">
            <input type="checkbox" checked={dark} onChange={() => setDark((s) => !s)} />
            <span className="slider" />
          </label>
          <button className="btn secondary" onClick={() => setSidebarOpen((s) => !s)}>{sidebarOpen ? "Hide" : "Show"} Sidebar</button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="file" accept="image/*" onChange={onFileInput} />
          <div style={{ marginLeft: "auto" }}>
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

        <div style={{ display: "flex", gap: 18 }}>
          <div className="canvas-wrap" ref={containerRef}>
            <div className={dragging ? "canvas-box dragging" : "canvas-box"}>
              <div className="inner"
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }}
              >
                <canvas ref={canvasRef} className="main-canvas" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} />
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

          <div className="controls" ref={controlsRef}>
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

            <div style={{ display: "flex", gap: 10 }}>
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

          {sidebarOpen && (
            <aside className="sidebar">
              <h4>Extras</h4>
              <p className="meta">Drag & drop supported. Works fully in-browser.</p>
              <p className="meta">Dark mode: {dark ? "On" : "Off"}</p>
              <div style={{ marginTop: 8 }}>
                <button className="btn secondary" onClick={() => setQuality(0.8)}>Quick Compress</button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
