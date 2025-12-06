// src/App.jsx
import React, { useEffect, useRef, useState } from "react";

/*
Unified App:
- Image tools (crop/resize/rotate/flip/download, OCR, image->PDF) — from prior version
- Excel (xlsx) -> CSV / JSON / PDF (SheetJS loaded at runtime)
- Word (docx) -> HTML / TXT / PDF (Mammoth loaded at runtime)
- Bulk IP utilities (validate, classify, expand CIDR/ranges, dedupe, export)
- All libs loaded at runtime via CDN to avoid bundler issues (no APIs)
- No server calls. Everything client-side.
*/

export default function App() {
  // ---------------- COMMON UI STATE ----------------
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ---------- IMAGE SECTION (kept compact from previous) ----------
  const [fileInfo, setFileInfo] = useState(null);
  const [dataUrl, setDataUrl] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [quality, setQuality] = useState(0.92);
  const [format, setFormat] = useState("image/jpeg");
  const [rotateDeg, setRotateDeg] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  const fileInputRef = useRef();
  const previewRef = useRef();
  const containerRef = useRef();
  const cropOverlayRef = useRef();
  const hiddenCanvasRef = useRef();
  const naturalRef = useRef(null);
  const cropRectRef = useRef(null);
  const cropStartRef = useRef(null);

  // OCR & PDF libs flags
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoaded, setOcrLoaded] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);

  // ----------- EXCEL & WORD STATE --------------
  const [xlsxLoaded, setXlsxLoaded] = useState(false);
  const [mammothLoaded, setMammothLoaded] = useState(false);

  const [excelSheets, setExcelSheets] = useState([]); // {name, rows(array of objects)}
  const [selectedSheet, setSelectedSheet] = useState("");
  const [excelPreviewRows, setExcelPreviewRows] = useState([]); // small preview

  const [docHtml, setDocHtml] = useState("");
  const [docPlain, setDocPlain] = useState("");

  // ---------------- BULK IP ----------------
  const [ipInput, setIpInput] = useState("");
  const [ipOutput, setIpOutput] = useState([]); // array of {ip, valid, type, private, int}
  const IP_EXPAND_LIMIT = 5000; // safety

  // ----------- CSS (compact) --------------
  const css = `
    :root{--bg:#f7f9fc;--card:#fff;--text:#0f172a;--muted:#64748b;--accent:#6b46c1}
    .app{max-width:1100px;margin:18px auto;font-family:Inter,Arial;color:var(--text)}
    .app.dark{background:#071123;color:#e6eef8}
    .card{background:var(--card);padding:18px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.06)}
    .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .layout{display:flex;gap:18px}
    .preview-col{flex:1}
    .controls{width:340px;display:flex;flex-direction:column;gap:10px}
    .preview-box{height:420px;border-radius:10px;background:linear-gradient(180deg,#fbfdff,#f7f9fc);border:1px solid rgba(0,0,0,0.04);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
    .app.dark .preview-box{background:linear-gradient(180deg,#061426,#071123);border-color:rgba(255,255,255,0.02)}
    .preview-img{max-width:90%;max-height:90%;display:block;user-select:none;pointer-events:none;border-radius:6px}
    .overlay{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:auto}
    .controls input[type="number"], .controls select, .controls input[type="text"], .controls textarea{padding:8px;border-radius:6px;border:1px solid #ddd}
    .btn{padding:10px;border-radius:8px;border:0;background:linear-gradient(90deg,#3b82f6,#8b5cf6);color:white;cursor:pointer}
    .sec{background:white;border:1px solid #eee;padding:10px;border-radius:8px;cursor:pointer}
    .info{font-size:13px;color:var(--muted);padding:8px;background:#fbfdff;border-radius:8px}
    .small{font-size:13px;color:#475569}
    .section {margin-top:14px;padding:12px;border-radius:10px;border:1px solid #f0f3f6;background:#fff}
    .app.dark .section{background:#071423;border-color:rgba(255,255,255,0.02)}
    pre {white-space:pre-wrap;word-break:break-word}
    @media(max-width:980px){.layout{flex-direction:column}.controls{width:100%}}
  `;

  // =================== IMAGE FUNCTIONS (kept) ===================
  const handleFile = (file) => {
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
        cropRectRef.current = null; clearOverlay();
      };
      img.onerror = () => alert("Invalid image file");
      img.src = data;
    };
    reader.readAsDataURL(file);
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDragOver = (ev) => { ev.preventDefault(); el.classList.add("drag"); };
    const onDragLeave = () => { el.classList.remove("drag"); };
    const onDrop = (ev) => { ev.preventDefault(); el.classList.remove("drag"); const f = ev.dataTransfer.files?.[0]; if (f) handleFile(f); };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => { el.removeEventListener("dragover", onDragOver); el.removeEventListener("dragleave", onDragLeave); el.removeEventListener("drop", onDrop); };
  }, []);

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

  const handleResizeDownload = async () => {
    if (!naturalRef.current) return alert("Upload an image");
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
      };
      img.src = url;
    } catch (err) { alert(err.message); }
  };

  const rotateRight = () => setRotateDeg((d) => (d + 90) % 360);
  const rotateLeft = () => setRotateDeg((d) => (d - 90 + 360) % 360);
  const toggleFlipH = () => setFlipH((s) => !s);
  const toggleFlipV = () => setFlipV((s) => !s);
  const clearAllImage = () => { setDataUrl(""); setFileInfo(null); naturalRef.current = null; setWidth(""); setHeight(""); setOcrText(""); cropRectRef.current = null; clearOverlay(); };

  useEffect(() => {
    const imgEl = previewRef.current;
    if (!imgEl) return;
    const t = `rotate(${rotateDeg}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`;
    imgEl.style.transform = t;
    drawOverlay();
  }, [rotateDeg, flipH, flipV, dataUrl]);

  // ---------------- OCR (runtime CDN) ----------------
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
      if (!createWorker && window.Tesseract.recognize) {
        const res = await window.Tesseract.recognize(dataUrl, "eng", { logger: (m) => {} });
        setOcrText(res.data?.text || "No text found");
      } else {
        const worker = createWorker({ logger: (m) => {} });
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

  // ---------------- image -> PDF (jsPDF runtime) ----------------
  async function loadJsPdf() {
    if (pdfLoaded) return;
    try {
      if (!window.jspdf) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
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
      const img = naturalRef.current;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "px", format: [w, h] });
      const type = format === "image/png" ? "PNG" : "JPEG";
      doc.addImage(dataUrl, type, 0, 0, w, h);
      const pdfBlob = doc.output("blob");
      downloadBlob(pdfBlob, (fileInfo?.name || "image") + ".pdf");
    } catch (err) {
      alert("Failed to create PDF: " + (err.message || err));
    }
  }

  // =================== EXCEL (SheetJS runtime) ===================
  async function loadSheetJS() {
    if (xlsxLoaded) return;
    try {
      if (!window.XLSX) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.sheetjs.com/xlsx-0.18.5/package/dist/xlsx.full.min.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      setXlsxLoaded(true);
    } catch (err) {
      alert("Failed to load SheetJS");
    }
  }

  async function handleExcelFile(file) {
    if (!file) return;
    await loadSheetJS();
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      const XLSX = window.XLSX;
      const wb = XLSX.read(data, { type: "array" });
      const sheets = [];
      for (let name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        sheets.push({ name, rows: json });
      }
      setExcelSheets(sheets);
      if (sheets.length) {
        setSelectedSheet(sheets[0].name);
        setExcelPreviewRows(sheets[0].rows.slice(0, 50));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function exportSheetAsCSV(name) {
    const sheet = excelSheets.find(s => s.name === name);
    if (!sheet) return alert("No sheet");
    const rows = sheet.rows;
    // simple CSV
    const keys = rows.length ? Object.keys(rows[0]) : [];
    const lines = [keys.join(",")].concat(rows.map(r => keys.map(k => JSON.stringify((r[k]||"").toString())).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    downloadBlob(blob, `${name}.csv`);
  }

  function exportSheetAsJSON(name) {
    const sheet = excelSheets.find(s => s.name === name);
    if (!sheet) return alert("No sheet");
    const blob = new Blob([JSON.stringify(sheet.rows, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${name}.json`);
  }

  async function exportSheetAsPDF(name) {
    const sheet = excelSheets.find(s => s.name === name);
    if (!sheet) return alert("No sheet");
    await loadJsPdf();
    if (!window.jspdf || !window.jspdf.jsPDF) return alert("PDF lib not available");
    // render simple HTML table (limited rows) to canvas, then to PDF
    const rows = sheet.rows.slice(0, 200);
    const keys = rows.length ? Object.keys(rows[0]) : [];
    const html = `<table style="width:100%;border-collapse:collapse;font-size:10px">
      <thead><tr>${keys.map(k=>`<th style="border:1px solid #ddd;padding:6px;background:#f7f7f7">${escapeHtml(k)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td style="border:1px solid #eee;padding:6px">${escapeHtml((r[k]||"").toString())}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    // create a temporary hidden div, draw with SVG foreignObject then PDF
    try {
      const docHtml = `<div style="font-family:Arial">${html}</div>`;
      // use jsPDF html method if available
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      await doc.html(docHtml, { callback: function() { const blob = doc.output("blob"); downloadBlob(blob, `${name}.pdf`); } });
    } catch (err) {
      alert("Export to PDF failed: " + err.message);
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
  }

  // --------------- DOCX (Mammoth runtime) ----------------
  async function loadMammoth() {
    if (mammothLoaded) return;
    try {
      if (!window.mammoth) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://unpkg.com/mammoth/mammoth.browser.min.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      setMammothLoaded(true);
    } catch (err) {
      alert("Failed to load mammoth");
    }
  }

  async function handleDocxFile(file) {
    if (!file) return;
    await loadMammoth();
    if (!window.mammoth) return alert("Mammoth not loaded");
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const res = await window.mammoth.convertToHtml({ arrayBuffer });
        setDocHtml(res.value || "");
        // plain text
        const resText = await window.mammoth.extractRawText({ arrayBuffer });
        setDocPlain(resText.value || "");
      } catch (err) {
        alert("Failed to convert docx: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadText(name, text) {
    const blob = new Blob([text], { type: "text/plain" });
    downloadBlob(blob, name);
  }

  async function exportDocHtmlToPDF(name) {
    if (!docHtml) return alert("No document HTML");
    await loadJsPdf();
    if (!window.jspdf || !window.jspdf.jsPDF) return alert("PDF lib not available");
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      await doc.html(docHtml, { callback: function() { const blob = doc.output("blob"); downloadBlob(blob, `${name}.pdf`); } });
    } catch (err) { alert("Failed to export PDF: " + err.message); }
  }

  // ------------------ BULK IP UTILITIES (no network) ------------------
  // helpers: validate IPv4, IPv6 (simple), check private ranges, cidr expand small sets
  function isIPv4(s) {
    if (typeof s !== "string") return false;
    const parts = s.trim().split(".");
    if (parts.length !== 4) return false;
    for (let p of parts) {
      if (!/^\d+$/.test(p)) return false;
      const n = parseInt(p, 10);
      if (n < 0 || n > 255) return false;
    }
    return true;
  }

  function ipv4ToInt(s) {
    if (!isIPv4(s)) return null;
    const p = s.trim().split(".").map(n => parseInt(n,10));
    return ((p[0]<<24)>>>0) + (p[1]<<16) + (p[2]<<8) + p[3];
  }
  function intToIPv4(i) {
    i >>>= 0;
    return [(i>>>24)&255, (i>>>16)&255, (i>>>8)&255, i&255].join(".");
  }

  function isPrivateIPv4(intVal) {
    if (intVal === null) return false;
    // RFC1918 ranges
    const a10 = ipv4ToInt("10.0.0.0"), b10 = ipv4ToInt("10.255.255.255");
    const a172 = ipv4ToInt("172.16.0.0"), b172 = ipv4ToInt("172.31.255.255");
    const a192 = ipv4ToInt("192.168.0.0"), b192 = ipv4ToInt("192.168.255.255");
    return (intVal >= a10 && intVal <= b10) || (intVal >= a172 && intVal <= b172) || (intVal >= a192 && intVal <= b192);
  }

  function parseCIDR(cidr) {
    // returns {baseInt, maskBits} or null
    const parts = cidr.split("/");
    if (parts.length !== 2) return null;
    const ip = parts[0].trim();
    const mb = parseInt(parts[1], 10);
    if (!isIPv4(ip) || isNaN(mb) || mb < 0 || mb > 32) return null;
    const base = ipv4ToInt(ip) & (~0 << (32 - mb));
    return { base, mb };
  }

  function expandCIDR(cidr) {
    const parsed = parseCIDR(cidr);
    if (!parsed) return [];
    const { base, mb } = parsed;
    const count = 2 ** (32 - mb);
    if (count > IP_EXPAND_LIMIT) throw new Error("CIDR expands to too many addresses (" + count + ")");
    const out = [];
    for (let i = 0; i < count; i++) out.push(intToIPv4((base + i) >>> 0));
    return out;
  }

  function expandRange(rangeStr) {
    // formats: 1.2.3.4-1.2.3.10   or 1.2.3.4-10 (last octet)
    const parts = rangeStr.split("-");
    if (parts.length !== 2) return [];
    const a = parts[0].trim();
    const b = parts[1].trim();
    if (!isIPv4(a)) return [];
    if (isIPv4(b)) {
      const ia = ipv4ToInt(a), ib = ipv4ToInt(b);
      if (ib < ia) return [];
      const count = ib - ia + 1;
      if (count > IP_EXPAND_LIMIT) throw new Error("Range expands too big");
      const out = [];
      for (let i = ia; i <= ib; i++) out.push(intToIPv4(i));
      return out;
    } else if (/^\d+$/.test(b)) {
      // last octet
      const baseParts = a.split(".").map(x => parseInt(x,10));
      const start = baseParts[3];
      const end = parseInt(b,10);
      if (end < start) return [];
      if (end > 255) return [];
      const out = [];
      for (let v = start; v <= end; v++) {
        out.push([baseParts[0],baseParts[1],baseParts[2],v].join("."));
      }
      if (out.length > IP_EXPAND_LIMIT) throw new Error("Range expands too big");
      return out;
    }
    return [];
  }

  function processIpList(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let all = [];
    for (let l of lines) {
      try {
        if (l.includes("/")) {
          const ex = expandCIDR(l);
          all = all.concat(ex);
        } else if (l.includes("-")) {
          const ex = expandRange(l);
          all = all.concat(ex);
        } else {
          all.push(l);
        }
      } catch (err) {
        alert("Error expanding '" + l + "': " + err.message);
      }
    }
    // dedupe & validate
    const seen = new Set();
    const out = [];
    for (let s of all) {
      if (seen.has(s)) continue;
      seen.add(s);
      const valid = isIPv4(s);
      const int = valid ? ipv4ToInt(s) : null;
      const priv = valid ? isPrivateIPv4(int) : false;
      out.push({ ip: s, valid, int: int === null ? "" : String(int), private: priv ? "yes" : "no" });
    }
    setIpOutput(out);
  }

  function exportIpCSV() {
    if (!ipOutput.length) return alert("No IPs");
    const keys = ["ip","valid","private","int"];
    const lines = [keys.join(",")].concat(ipOutput.map(r => keys.map(k => JSON.stringify((r[k]||"").toString())).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    downloadBlob(blob, "ips.csv");
  }
  function exportIpJSON() {
    if (!ipOutput.length) return alert("No IPs");
    const blob = new Blob([JSON.stringify(ipOutput, null, 2)], { type: "application/json" });
    downloadBlob(blob, "ips.json");
  }

  // ---------------- UI handlers for Excel/Word input ----------------
  const onExcelSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) handleExcelFile(f);
  };
  const onDocxSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) handleDocxFile(f);
  };

  // ---------------- small helpers ----------------
  function handleImageInputFile(e) { const f = e.target.files?.[0]; if (f) handleFile(f); }

  // HTML render
  return (
    <div className={dark ? "app dark" : "app"}>
      <style>{css}</style>
      <div className="top">
        <div style={{fontWeight:700}}>All-in-One Tools — Image, Excel, Word, Bulk IP (No API)</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <label style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="checkbox" checked={dark} onChange={(e)=>setDark(e.target.checked)} /> Dark
          </label>
          <button className="sec" onClick={()=>setSidebarOpen(s=>!s)}>{sidebarOpen ? "Hide" : "Show"} Sidebar</button>
        </div>
      </div>

      <div className="card">
        {/* top file input general */}
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700}}>Image</div>
              <input type="file" accept="image/*" onChange={handleImageInputFile} />
            </div>
            <div style={{marginLeft:12}}>
              <div style={{fontWeight:700}}>Excel (.xlsx)</div>
              <input type="file" accept=".xlsx,.xls" onChange={onExcelSelect} />
            </div>
            <div style={{marginLeft:12}}>
              <div style={{fontWeight:700}}>Word (.docx)</div>
              <input type="file" accept=".docx" onChange={onDocxSelect} />
            </div>
          </div>

          <div style={{marginLeft:"auto"}} className="info">
            {fileInfo ? `${fileInfo.name} • ${fileInfo.size} • ${fileInfo.w}×${fileInfo.h}px` : "No main image selected"}
          </div>
        </div>

        {/* main layout */}
        <div className="layout">
          {/* left: preview and image controls */}
          <div style={{flex:1}}>
            <div className="preview-box" ref={containerRef}
                 onMouseDown={(e)=>onDown(e)} onMouseMove={(e)=>onMove(e)} onMouseUp={()=>onUp()}>
              {dataUrl ? <>
                <img ref={previewRef} src={dataUrl} alt="preview" className="preview-img" draggable={false}
                     style={{transition:"transform .12s", transform: `rotate(${rotateDeg}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`}} />
                <canvas ref={cropOverlayRef} className="overlay" />
              </> : <div className="small">Drop or choose an image to begin. Draw crop rectangle directly on preview.</div>}
            </div>

            <div style={{display:"flex",gap:10,marginTop:10}}>
              <button className="btn" onClick={handleResizeDownload}>Resize & Download</button>
              <button className="sec" onClick={handleCropDownload}>Crop & Download</button>
              <button className="sec" onClick={handleApplyCrop}>Apply Crop</button>
              <button className="sec" onClick={imageToPDF}>Image → PDF</button>
              <button className="sec" onClick={async ()=>{ await loadTesseract(); runOCR(); }}>{ocrRunning ? "OCR..." : "Image → Text (OCR)"}</button>
            </div>

            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button className="sec" onClick={rotateLeft}>Rotate Left</button>
              <button className="sec" onClick={rotateRight}>Rotate Right</button>
              <button className="sec" onClick={toggleFlipH}>Flip H</button>
              <button className="sec" onClick={toggleFlipV}>Flip V</button>
              <button className="sec" onClick={clearAllImage}>Clear</button>
            </div>

            <div style={{marginTop:12}} className="section">
              <div style={{fontWeight:700}}>OCR Output</div>
              <textarea value={ocrText} readOnly style={{width:"100%",minHeight:120,marginTop:8}} placeholder="OCR result will appear here" />
            </div>
          </div>

          {/* right: controls */}
          <div className="controls">
            <div>
              <div className="small" style={{fontWeight:700}}>Width (px)</div>
              <input type="number" value={width} onChange={(e)=>setWidth(e.target.value)} />
            </div>
            <div>
              <div className="small" style={{fontWeight:700}}>Height (px)</div>
              <input type="number" value={height} onChange={(e)=>setHeight(e.target.value)} />
            </div>
            <div>
              <div className="small" style={{fontWeight:700}}>Quality</div>
              <input type="range" min="0.1" max="1" step="0.01" value={quality} onChange={(e)=>setQuality(Number(e.target.value))} />
            </div>
            <div>
              <div className="small" style={{fontWeight:700}}>Format</div>
              <select value={format} onChange={(e)=>setFormat(e.target.value)}><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option></select>
            </div>

            <div className="section">
              <div style={{fontWeight:700}}>Excel Sheets</div>
              <div style={{marginTop:8}} className="small">Loaded sheets: {excelSheets.length}</div>
              {excelSheets.length ? <>
                <select value={selectedSheet} onChange={(e)=>{ setSelectedSheet(e.target.value); const s = excelSheets.find(x=>x.name===e.target.value); setExcelPreviewRows(s.rows.slice(0,50)); }}>
                  {excelSheets.map(s => <option key={s.name} value={s.name}>{s.name} ({s.rows.length} rows)</option>)}
                </select>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button className="sec" onClick={()=>exportSheetAsCSV(selectedSheet)}>Export CSV</button>
                  <button className="sec" onClick={()=>exportSheetAsJSON(selectedSheet)}>Export JSON</button>
                  <button className="sec" onClick={()=>exportSheetAsPDF(selectedSheet)}>Export PDF (preview rows)</button>
                </div>
                <div style={{marginTop:8,maxHeight:200,overflow:"auto",background:"#fbfdff",padding:8,borderRadius:6}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
                    <tr>{excelPreviewRows.length ? Object.keys(excelPreviewRows[0]).map(k=> <th key={k} style={{textAlign:"left",padding:"6px",fontSize:12}}>{k}</th>) : <td style={{color:"#64748b"}}>No preview</td>}</tr>
                    {excelPreviewRows.map((r,idx)=> <tr key={idx}>{Object.keys(r).map(c=> <td key={c} style={{padding:"6px",fontSize:12}}>{String(r[c]||"")}</td>)}</tr>)}
                  </tbody></table>
                </div>
              </> : <div className="small" style={{marginTop:6}}>Load an Excel file to see sheets</div>}
            </div>

            <div className="section">
              <div style={{fontWeight:700}}>Word (DOCX)</div>
              {docHtml ? <>
                <div style={{marginTop:8,marginBottom:8}} className="small">Document preview (basic HTML)</div>
                <div style={{maxHeight:180,overflow:"auto",background:"#fbfdff",padding:8,borderRadius:6}} dangerouslySetInnerHTML={{__html: docHtml}} />
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button className="sec" onClick={()=>downloadText("doc.txt", docPlain)}>Save as TXT</button>
                  <button className="sec" onClick={()=>exportDocHtmlToPDF("document")}>Export as PDF</button>
                </div>
              </> : <div className="small" style={{marginTop:6}}>Load a .docx to convert to HTML/TXT</div>}
            </div>

            <div className="section">
              <div style={{fontWeight:700}}>Bulk IP Tools</div>
              <div style={{marginTop:6}}>
                <textarea value={ipInput} onChange={(e)=>setIpInput(e.target.value)} placeholder={"Enter IPs, CIDRs or ranges.\nExamples:\n192.168.1.1\n10.0.0.0/30\n192.0.2.1-192.0.2.10\n1.2.3.4-10"} style={{width:"100%",minHeight:120}} />
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button className="sec" onClick={()=>processIpList(ipInput)}>Process</button>
                  <button className="sec" onClick={exportIpCSV}>Export CSV</button>
                  <button className="sec" onClick={exportIpJSON}>Export JSON</button>
                </div>
                <div style={{marginTop:8,maxHeight:200,overflow:"auto",background:"#fbfdff",padding:8,borderRadius:6}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{textAlign:"left",padding:6}}>IP</th><th style={{padding:6}}>Valid</th><th style={{padding:6}}>Private</th><th style={{padding:6}}>Integer</th></tr></thead>
                    <tbody>{ipOutput.map((r,idx)=> <tr key={idx}><td style={{padding:6}}>{r.ip}</td><td style={{padding:6}}>{r.valid ? "✓" : "✗"}</td><td style={{padding:6}}>{r.private}</td><td style={{padding:6}}>{r.int}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>

            <div style={{marginTop:8}} className="small">All operations are performed client-side. No APIs called. For reverse-DNS, WHOIS, geoIP you need a remote service or API.</div>
          </div>

          {/* sidebar */}
          {sidebarOpen && <div style={{width:220,paddingLeft:12}}>
            <div style={{fontWeight:700}}>Sidebar</div>
            <div className="info" style={{marginTop:8}}>
              <div style={{fontWeight:700}}>{fileInfo ? fileInfo.name : "No image"}</div>
              <div style={{marginTop:6}}>{fileInfo ? `${fileInfo.size} • ${fileInfo.w}×${fileInfo.h}px` : "Upload image, excel or docx"}</div>
            </div>
            <div style={{height:12}} />
            <div className="section">
              <div style={{fontWeight:700}}>Quick Extras</div>
              <div style={{marginTop:8}}>
                <button className="sec" onClick={()=>{ navigator.clipboard && navigator.clipboard.writeText(JSON.stringify({info:fileInfo},null,2)) }}>Copy state</button>
              </div>
            </div>
          </div>}
        </div>
      </div>

      <canvas ref={hiddenCanvasRef} style={{display:"none"}} />
    </div>
  );
}
