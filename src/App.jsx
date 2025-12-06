import React, { useState, useRef } from "react";

/**
 * Dynamic imports version WITHOUT file-saver.
 * - No top-level imports of heavy/browser-only libs.
 * - Uses downloadBlob() instead of file-saver.
 * - Dynamically imports jspdf, pdf-lib, tesseract when used.
 *
 * Save as src/App.jsx and redeploy.
 */

/* ---------- Lazy import helpers ---------- */
const getJsPdf = async () => {
  const mod = await import("jspdf");
  // some bundlers put constructor on mod.jsPDF, others as default
  return mod.jsPDF || mod.default || mod;
};

const getPdfLib = async () => {
  const mod = await import("pdf-lib");
  return mod;
};

const getTesseract = async () => {
  const mod = await import("tesseract.js");
  return mod;
};

/* ---------- Download helper (no file-saver) ---------- */
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

/* ---------- Component ---------- */
export default function App() {
  const [tab, setTab] = useState("image");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepRatio, setKeepRatio] = useState(true);
  const [quality, setQuality] = useState(0.9);
  const [ocrText, setOcrText] = useState("");
  const [watermarkText, setWatermarkText] = useState("");

  const inputRef = useRef();

  /** Load File (single) */
  const loadFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setFile(null);
      setPreview("");
      return;
    }
    setFile(f);

    if (f.type && f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(f);

      const img = new Image();
      img.src = URL.createObjectURL(f);
      img.onload = () => {
        setWidth(img.width);
        setHeight(img.height);
      };
    } else {
      setPreview("");
    }
  };

  /** Resize Image */
  const resizeImage = async () => {
    if (!file) return alert("Upload image first!");
    if (!file.type.startsWith("image/")) return alert("Not an image!");

    const img = new Image();
    img.src = preview;
    await img.decode();

    let w = parseInt(width, 10);
    let h = parseInt(height, 10);

    if (keepRatio) {
      const r = img.width / img.height;
      if (!height && width) h = Math.round(w / r);
      if (!width && height) w = Math.round(h * r);
      if (!width && !height) {
        w = img.width;
        h = img.height;
      }
    } else {
      if (!w) w = img.width;
      if (!h) h = img.height;
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    canvas.toBlob((blob) => {
      if (!blob) return alert("Failed to generate image blob");
      downloadBlob(blob, "resized-" + file.name);
    }, "image/jpeg", quality);
  };

  /** Image → PDF */
  const imageToPDF = async () => {
    if (!file || !preview) return alert("Upload image first");

    const img = new Image();
    img.src = preview;
    await img.decode();

    const jsPDF = await getJsPdf();

    const pdf = new jsPDF({
      unit: "px",
      format: [img.width, img.height],
    });

    pdf.addImage(preview, "JPEG", 0, 0, img.width, img.height);

    const blob = pdf.output("blob");
    downloadBlob(blob, file.name.replace(/\..+$/, "") + ".pdf");
  };

  /** Merge PDFs (multiple select) */
  const mergePDFs = async () => {
    const files = inputRef.current && inputRef.current.files;
    if (!files || files.length === 0) return alert("Select PDFs (multiple)");

    const { PDFDocument } = await getPdfLib();
    const outPDF = await PDFDocument.create();

    for (let f of files) {
      if (!f.type || !f.type.includes("pdf")) continue;
      const bytes = await f.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const pages = await outPDF.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => outPDF.addPage(p));
    }

    const merged = await outPDF.save();
    downloadBlob(new Blob([merged]), "merged.pdf");
  };

  /** Split PDF into separate pages */
  const splitPDF = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload PDF");

    const { PDFDocument } = await getPdfLib();
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const count = pdf.getPageCount();

    for (let i = 0; i < count; i++) {
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(pdf, [i]);
      out.addPage(page);
      const saveBytes = await out.save();
      downloadBlob(new Blob([saveBytes]), `page-${i + 1}.pdf`);
    }
  };

  /** PDF → Images (simple placeholder render per page) */
  const pdfToImages = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload PDF first!");

    const { PDFDocument } = await getPdfLib();
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const pages = pdf.getPageCount();

    for (let i = 0; i < pages; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 1100;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#000";
      ctx.font = "20px sans-serif";
      ctx.fillText(`PDF Preview Page ${i + 1}`, 100, 100);

      canvas.toBlob((b) => downloadBlob(b, `pdf-page-${i + 1}.png`));
    }
  };

  /** Compress PDF (basic) */
  const compressPDF = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload PDF first!");
    const { PDFDocument } = await getPdfLib();
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);

    pdf.setTitle("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("");
    pdf.setCreator("");
    pdf.setAuthor("");

    const saveBytes = await pdf.save({ useObjectStreams: true });
    downloadBlob(new Blob([saveBytes]), "compressed.pdf");
  };

  /** OCR (Image → Text) */
  const doOCR = async () => {
    if (!file || !preview) return alert("Upload an image");

    setOcrText("Processing... Please wait");

    const Tesseract = await getTesseract();
    const { createWorker } = Tesseract;

    const worker = createWorker({
      logger: (m) => {
        // optionally use console.log(m) or update progress
      },
    });

    try {
      await worker.load();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      const { data } = await worker.recognize(preview);
      setOcrText(data.text || "No text detected");
    } catch (err) {
      setOcrText("OCR failed: " + (err.message || err));
    } finally {
      await worker.terminate();
    }
  };

  /** Add Watermark to Image */
  const addWatermark = async () => {
    if (!preview) return alert("Upload image first!");

    const img = new Image();
    img.src = preview;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");

    ctx.dr
