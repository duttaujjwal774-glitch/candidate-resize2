import React, { useEffect, useRef, useState } from "react";

/*
Full replacement App.jsx
- Keeps previous safe image features (drag/drop, preview, crop, resize, rotate/flip, download)
- Adds:
   * Image → Text (OCR) via Tesseract.js loaded dynamically from CDN (no API)
   * Image → PDF via jsPDF loaded dynamically from CDN (no API)
- Libraries are loaded at runtime only when needed (avoids bundler/build issues)
- All processing is done in-browser on a hidden canvas
- Replace entire src/App.jsx with this file
*/

export default function App() {
  // ---- state ----
  const [fileInfo, setFileInfo] = useState(null);
  const [dataUrl, setDataUrl] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [quality, setQuality] = useState(0.92);
  const [format, setFormat] = useState("image/jpeg");
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [rotateDeg, setRotateDeg] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // OCR state
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoaded, setOcrLoaded] = useState(false);

  // PDF loader state
  const [pdfLoaded, setPdfLoaded] = useState(false);

  // ---- refs ----
  const fileInputRef = useRef();
  const previewRef = useRef();        // visible img element
  const containerRef = useRef();      // preview wrapper (for mouse coords)
  const hiddenCanvasRef = useRef();   // hidden canvas used for processing
  const cropOverlayRef = useRef();    // overlay canvas for crop rectangle
  const naturalRef = useRef(null);    // original Image object
  const cropRectRef = useRef(null);   // {x,y,w,h} in preview CSS pixels (visible)
  const cropStartRef = useRef(null);

  // injected CSS (compact)
  const css = `
    :root{--bg:#f7f9fc;--card:#fff;--text:#0f172a;--muted:#64748b;--accent:#6b46c1}
    .app{max-width:1100px;margin:18px auto;font-family:Inter,Arial;color:var(--text)}
    .app.dark{background:#071123;color:#e6eef8}
    .card{background:var(--card);padding:18px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.06)}
    .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .layout{display:flex;gap:18px}
    .preview-col{flex:1}
    .controls{width:340px;display:flex;flex-direction:column;gap:10px}
    .preview-box{height:520px;border-radius:10px;background:linear-gradient(180deg,#fbfdff,#f7f9fc);border:1px solid rgba(0,0,0,0.04);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
    .app.dark .preview-box{background:linear-gradient(180deg,#061426,#071123);border-color:rgba(255,255,255,0.02)}
    .preview-img{max-width:90%;max-height:90%;display:block;user-select:none;pointer-events:none;border-radius:6px}
    .overlay{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:auto}
    .controls input[type="number"], .controls select{padding:8px;border-radius:6px;border:1px solid #ddd}
    .btn{padding:10px;border-radius:8px;border:0;background:linear-gradient(90deg,#3b82f6,#8b5cf6);color:white;cursor:pointer}
    .sec{background:white;border:1px solid #eee;padding:10px;border-radius:8px;cursor:pointer}
    .info{font-size:13px;color:var(--muted);padding:8px;background:#fbfdff;border-radius:8px}
    .small{font-size:13px;color:#475569}
    @media(max-width:980px){.layout{flex-direction:column}.controls{width:100%}}
  `;

  // ------------- file loading -------------
  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      const img = new Image();
      img.onload = () => {
        naturalRef.current = img;
        setDataUrl(data);
        setFileInfo({
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(2) + " MB",
          type: file.type || "image",
          modified: new Date(file.lastModified).toLocaleString(),
          w: img.naturalWidth,
          h: img.naturalHeight,
        });
        setWidth(String(img.naturalWidth));
        setHeight(String(img.naturalHeight));
        setRotateDeg(0); setFlipH(false); setFlipV(false);
        cropRectRef.current = null;
        clearOverlay();
      };
      img.onerror = () => alert("Invalid image file");
      img.src = data;
    };
    reader.readAsDataURL(file);
  }

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // drag/drop wiring
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDragOver = (ev) => { ev.preventDefault(); setDragging(true); };
    const onDragLeave = () => setDragging(false);
    const onDrop = (ev) => { ev.preventDefault(); setDragging(false); const f = ev.dataTransfer.files?.[0]; if (f) handleFile(f); };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => { el.removeEventListener("dragover", onDragOver); el.removeEventListener("dragleave", onDragLeave); el.removeEventListener("drop", onDrop); };
  }, []);

  // --------- overlay & cropping on visible preview ----------
  const clearOverlay = () => {
    const ov = cropOverlayRef.current;
    if (!ov) return;
    const ctx = ov.getContext("2d");
    ctx.clearRect(0, 0, ov.width, ov.height);
  };

  const drawOverlay = () => {
    const ov = cropOverlayRef.current;
    if (!ov || !containerRef.current) return;
    const ctx = ov.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const cssW = containerRef.current.clientWidth;
    const cssH = containerRef.current.clientHeight;
    ov.width = Math.round(cssW * ratio);
    ov.height = Math.round(cssH * ratio);
    ov.style.width = cssW + "px";
    ov.style.height = cssH + "px";
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,cssW,cssH);

    const r = cropRectRef.current;
    if (!r) return;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0,0,cssW,cssH);
    ctx.clearRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x+0.5, r.y+0.5, r.w, r.h);
  };

  const getPreviewRect = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e) => { if (!naturalRef.current) return; cropStartRef.current = getPreviewRect(e); cropRectRef.current = null; };
  const onMove = (e) => { if (!cropStartRef.current) return; const p = getPreviewRect(e); const s = cropStartRef.current; const x = Math.min(s.x,p.x), y = Math.min(s.y,p.y); const w = Math.max(1,Math.abs(p.x-s.x)), h = Math.max(1,Math.abs(p.y-s.y)); cropRectRef.current = {x,y,w,h}; drawOverlay(); };
  const onUp = () => { cropStartRef.current = null; };

  // map crop rect CSS -> natural image pixels
  function mapCropToNatural() {
    const r = cropRectRef.current;
    if (!r || !naturalRef.current || !previewRef.current || !containerRef.current) return null;
    const imgEl = previewRef.current;
    const wrapper = containerRef.current;
    const cssImgW = imgEl.clientWidth;
    const cssImgH = imgEl.clientHeight;
    const naturalW = naturalRef.current.naturalWidth;
    const naturalH = naturalRef.current.naturalHeight;
    const scaleX = naturalW / cssImgW;
    const scaleY = naturalH / cssImgH;
    const offsetX = (wrapper.clientWidth - cssImgW) / 2;
    const offsetY = (wrapper.clientHeight - cssImgH) / 2;
    const relX = r.x - offsetX;
    const relY = r.y - offsetY;
    const sx = Math.max(0, Math.round(relX * scaleX));
    const sy = Math.max(0, Math.round(relY * scaleY));
    const sw = Math.max(1, Math.round(Math.min(r.w * scaleX, naturalW - sx)));
    const sh = Math.max(1, Math.round(Math.min(r.h * scaleY, naturalH - sy)));
    return { sx, sy, sw, sh };
  }

  // ------------- hidden canvas processing -------------
  async function processToBlob({ outW, outH, sx, sy, sw, sh, fmt = format, q = quality, rotate = rotateDeg, flipHorizontal = flipH, flipVertical = flipV }) {
    const img = naturalRef.current;
    if (!img) throw new Error("No image");
    const canvas = hiddenCanvasRef.current || document.createElement("canvas");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(outW * ratio));
    canvas.height = Math.max(1, Math.round(outH * ratio));
    canvas.style.width = outW + "px";
    canvas.style.height = outH + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,outW,outH);
    ctx.save();
    if (rotate % 360 !== 0) {
      ctx.translate(outW/2, outH/2);
      ctx.rotate((rotate * Math.PI)/180);
      ctx.translate(-outW/2, -outH/2);
    }
    if (flipHorizontal || flipVertical) {
      ctx.translate(flipHorizontal ? outW : 0, flipVertical ? outH : 0);
      ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
    }
    if (typeof sx === "number") {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    } else {
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, outW, outH);
    }
    ctx.restore();
    return await new Promise((resolve, reject) => {
      canvas.toBlob((b) => { if (!b) reject(new Error("Failed to create blob")); else resolve(b); }, fmt, fmt === "image/jpeg" ? q : undefined);
    });
  }

  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  // image actions
  const handleResizeDownload = async () => {
    if (!naturalRef.current) return alert("Upload image first");
    const w = parseInt(width, 10), h = parseInt(height, 10);
    if (!w || !h) return alert("Enter width and height");
    try {
      const b = await processToBlob({ outW: w, outH: h, fmt: format, q: quality });
      const ext = format === "image/png" ? "png" : "jpg";
      downloadBlob(b, `resized-${fileInfo?.name || "image"}.${ext}`);
    } catch (err) { alert(err.message); }
  };

  const handleCropDownload = async () => {
    const nat = mapCropToNatural();
    if (!nat) return alert("Draw crop on preview first");
    try {
      const b = await processToBlob({ outW: nat.sw, outH: nat.sh, sx: nat.sx, sy: nat.sy, sw: nat.sw, sh: nat.sh, fmt: format, q: quality });
      const ext = format === "image/png" ? "png" : "jpg";
      downloadBlob(b, `crop-${fileInfo?.name || "image"}.${ext}`);
    } catch (err) { alert(err.message); }
  };

  const handleApplyCrop = async () => {
    const nat = mapCropToNatural();
    if (!nat) return alert("Draw crop on preview first");
    try {
      const b = await processToBlob({ outW: nat.sw, outH: nat.sh, sx: nat.sx, sy: nat.sy, sw: nat.sw, sh: nat.sh, fmt: "image/jpeg", q: 0.92 });
      const url = URL.createObjectURL(b);
      const img = new Image();
      img.onload = () => {
        naturalRef.current = img;
        setDataUrl(url);
        setFileInfo((f) => f ? { ...f, w: img.naturalWidth, h: img.naturalHeight } : f);
        setWidth(String(img.naturalWidth)); setHeight(String(img.naturalHeight));
        cropRectRef.current = null; clearOverlay();
        // revoke later (when replaced or cleared) - cannot revoke now because preview uses it
      };
      img.src = url;
    } catch (err) { alert(err.message); }
  };

  const rotateRight = () => setRotateDeg((d) => (d + 90) % 360);
  const rotateLeft = () => setRotateDeg((d) => (d - 90 + 360) % 360);
  const toggleFlipH = () => setFlipH((s) => !s);
  const toggleFlipV = () => setFlipV((s) => !s);
  const clearAll = () => { setDataUrl(""); setFileInfo(null); naturalRef.current = null; setWidth(""); setHeight(""); setOcrText(""); cropRectRef.current = null; clearOverlay(); };

  // update preview transform on rotate/flip changes
  useEffect(() => {
    const imgEl = previewRef.current;
    if (!imgEl) return;
    const t = `rotate(${rotateDeg}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`;
    imgEl.style.transform = t;
    drawOverlay();
  }, [rotateDeg, flipH, flipV, dataUrl]);

  // ---------- OCR loading + run (dynamic) ----------
  // load Tesseract.js dynamically from CDN
  async function loadTesseract() {
    if (ocrLoaded) return;
    setOcrRunning(true);
    try {
      if (!window.Tesseract) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@2.1.5/dist/tesseract.min.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      setOcrLoaded(true);
    } catch (err) {
      alert("Failed to load OCR library.");
    } finally { setOcrRunning(false); }
  }

  async function runOCR() {
    if (!dataUrl) return alert("Upload image first");
    await loadTesseract();
    if (!window.Tesseract) return alert("OCR not available");
    setOcrRunning(true); setOcrText("Processing...");
    try {
      const { createWorker } = window.Tesseract;
      // in older builds Tesseract.createWorker exists
      if (!createWorker && window.Tesseract.recognize) {
        // fallback simple recognize
        const res = await window.Tesseract.recognize(dataUrl, "eng", { logger: (m) => {/*progress*/} });
        setOcrText(res.data?.text || "No text found");
      } else {
        // preferred worker API
        const worker = createWorker({
          logger: (m) => {
            // optional progress: m.progress
          },
        });
        await worker.load();
        await worker.loadLanguage("eng");
        await worker.initialize("eng");
        const { data } = await worker.recognize(dataUrl);
        setOcrText(data?.text || "No text found");
        await worker.terminate();
      }
    } catch (err) {
      setOcrText("OCR failed: " + (err.message || err));
    } finally { setOcrRunning(false); }
  }

  // ---------- PDF loading + image→pdf (dynamic) ----------
  async function loadJsPdf() {
    if (pdfLoaded) return;
    try {
      if (!window.jspdf) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          // use UMD build that exposes window.jspdf
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      setPdfLoaded(true);
    } catch (err) {
      alert("Failed to load PDF library.");
    }
  }

  async function imageToPDF() {
    if (!dataUrl) return alert("Upload image first");
    await loadJsPdf();
    if (!window.jspdf || !window.jspdf.jsPDF) return alert("PDF library not available");
    try {
      // create a PDF with same pixel size as image (use px units)
      const img = naturalRef.current;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "px", format: [w, h] });
      // ensure image is JPEG dataURL for addImage (if PNG chosen, keep as PNG)
      const type = format === "image/png" ? "PNG" : "JPEG";
      doc.addImage(dataUrl, type, 0, 0, w, h);
      const pdfBlob = doc.output("blob");
      downloadBlob(pdfBlob, (fileInfo?.name || "image") + ".pdf");
    } catch (err) {
      alert("Failed to create PDF: " + (err.message || err));
    }
  }

  // small helper: create preview thumbnail on width/height change (for real-time preview)
  useEffect(() => {
    if (!naturalRef.current) return;
    const w = parseInt(width, 10), h = parseInt(height, 10);
    if (!w || !h) return;
    (async () => {
      try {
        const b = await processToBlob({ outW: Math.min(420, w), outH: Math.min(340, h), fmt: "image/jpeg", q: quality });
        const u = URL.createObjectURL(b);
        // set as preview thumbnail by updating dataUrl? We keep main preview as original.
        // We'll create a separate small image preview only if needed. For now skip to avoid replacing main preview.
        // Revoke after short time
        setTimeout(() => URL.revokeObjectURL(u), 3000);
      } catch (e) { /* ignore */ }
    })();
  }, [width, height, quality]);

  // render
  return (
    <div className={dark ? "app dark" : "app"}>
      <style>{css}</style>

      <div className="top">
        <div style={{fontWeight:700}}>Image: Resize, Crop, PDF & OCR</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <label style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="checkbox" checked={dark} onChange={(e)=>setDark(e.target.checked)} /> Dark
          </label>
          <button className="sec" onClick={()=>setSidebarOpen(s=>!s)}>{sidebarOpen ? "Hide" : "Show"} Sidebar</button>
        </div>
      </div>

      <div className="card">
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:8}}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} />
          <div style={{marginLeft:"auto"}} className="info">{fileInfo ? `${fileInfo.name} • ${fileInfo.size} • ${fileInfo.w}×${fileInfo.h}px` : "No file selected"}</div>
        </div>

        <div className="layout">
          <div className="preview-col">
            <div className="preview-box" ref={containerRef}
                 onMouseDown={(e)=>onDown(e)} onMouseMove={(e)=>onMove(e)} onMouseUp={()=>onUp()}>
              {dataUrl ? <>
                <img ref={previewRef} src={dataUrl} alt="preview" className="preview-img" draggable={false}
                     style={{transition:"transform .12s", transform: `rotate(${rotateDeg}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`}} />
                <canvas ref={cropOverlayRef} className="overlay" />
              </> : <div className="small">Drop image here or choose file. Draw crop rectangle on preview to crop.</div>}
            </div>

            <div style={{height:12}} />

            <div style={{display:"flex",gap:8}}>
              <button className="btn" onClick={handleResizeDownload}>Resize & Download</button>
              <button className="sec" onClick={handleCropDownload}>Crop & Download</button>
              <button className="sec" onClick={handleApplyCrop}>Apply Crop</button>
            </div>

            <div style={{height:10}} />

            <div style={{display:"flex",gap:8}}>
              <button className="sec" onClick={async ()=>{ await loadTesseract(); runOCR(); }} disabled={ocrRunning}>{ocrRunning ? "OCR running..." : "Image → Text (OCR)"}</button>
              <button className="sec" onClick={imageToPDF}>Image → PDF</button>
            </div>

            <div style={{height:10}} />
            <div style={{fontWeight:700, marginBottom:6}}>OCR Result</div>
            <textarea value={ocrText} readOnly style={{width:"100%",minHeight:120,padding:8}} placeholder="OCR output will appear here" />
          </div>

          <div className="controls">
            <div><div className="small" style={{fontWeight:700}}>Width (px)</div><input type="number" value={width} onChange={(e)=>setWidth(e.target.value)} /></div>
            <div><div className="small" style={{fontWeight:700}}>Height (px)</div><input type="number" value={height} onChange={(e)=>setHeight(e.target.value)} /></div>

            <div>
              <div className="small" style={{fontWeight:700}}>Quality</div>
              <input type="range" min="0.1" max="1" step="0.01" value={quality} onChange={(e)=>setQuality(Number(e.target.value))} />
            </div>

            <div>
              <div className="small" style={{fontWeight:700}}>Format</div>
              <select value={format} onChange={(e)=>setFormat(e.target.value)}>
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG</option>
              </select>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button className="sec" onClick={rotateLeft}>Rotate Left</button>
              <button className="sec" onClick={rotateRight}>Rotate Right</button>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="sec" onClick={toggleFlipH}>Flip H</button>
              <button className="sec" onClick={toggleFlipV}>Flip V</button>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button className="sec" onClick={clearAll}>Clear</button>
            </div>

            <div style={{marginTop:12}}>
              <div style={{fontWeight:700}}>Useful</div>
              <div className="info" style={{marginTop:8}}>
                <div>• OCR runs inside browser (no APIs). Might be slow for large images.</div>
                <div style={{marginTop:6}}>• PDF uses jsPDF loaded at runtime (no bundling).</div>
                <div style={{marginTop:6}}>• All image ops are client-side, safe and private.</div>
              </div>
            </div>
          </div>

          {sidebarOpen && <div style={{width:220,paddingLeft:12}}>
            <div style={{fontWeight:700}}>File Info</div>
            <div className="info" style={{marginTop:8}}>{fileInfo ? <>
              <div style={{fontWeight:700}}>{fileInfo.name}</div>
              <div className="small">{fileInfo.size} • {fileInfo.type}</div>
              <div style={{marginTop:6}}>{fileInfo.w} × {fileInfo.h} px</div>
              <div style={{marginTop:6}}>{fileInfo.modified}</div>
            </> : "No file selected"}</div>
          </div>}
        </div>
      </div>

      <canvas ref={hiddenCanvasRef} style={{display:"none"}} />
    </div>
  );
}
