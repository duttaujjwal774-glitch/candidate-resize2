import React, { useState, useRef } from "react";

/**
 * Lighter Plan-B App.jsx
 * - No file-saver, no OCR
 * - Dynamic imports for jspdf and pdf-lib
 * - downloadBlob() helper for saving files
 *
 * Features (no external API required):
 * - Image preview
 * - Resize image and download
 * - Add watermark to image and download
 * - Image -> PDF (jspdf, dynamic)
 * - Merge PDFs, Split PDF, Compress PDF, PDF->Images (pdf-lib, dynamic)
 */

/* ---------- Lazy import helpers ---------- */
const getJsPdf = async () => {
  const mod = await import("jspdf");
  return mod.jsPDF || mod.default || mod;
};

const getPdfLib = async () => {
  const mod = await import("pdf-lib");
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
  const [file, setFile] = useState(null); // currently selected single file
  const [preview, setPreview] = useState(""); // dataURL for image preview
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepRatio, setKeepRatio] = useState(true);
  const [quality, setQuality] = useState(0.9);
  const [watermarkText, setWatermarkText] = useState("");
  const inputRef = useRef(); // used for selecting multiple files for merging

  /** Load first selected file (single-file operations) */
  const loadFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setFile(null);
      setPreview("");
      setWidth("");
      setHeight("");
      return;
    }
    setFile(f);

    // If image, create preview and set natural sizes
    if (f.type && f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreview(ev.target.result);
        // measure actual size
        const img = new Image();
        img.onload = () => {
          setWidth(img.width);
          setHeight(img.height);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(f);
    } else {
      // Not an image: clear preview
      setPreview("");
      setWidth("");
      setHeight("");
    }
  };

  /* ---------- IMAGE OPERATIONS ---------- */

  const resizeImage = async () => {
    if (!file) return alert("Upload image first!");
    if (!file.type || !file.type.startsWith("image/")) return alert("Not an image!");

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

    canvas.toBlob(
      (blob) => {
        if (!blob) return alert("Failed to generate image");
        downloadBlob(blob, `resized-${file.name}`);
      },
      "image/jpeg",
      quality
    );
  };

  const addWatermark = async () => {
    if (!preview) return alert("Upload image first!");

    const img = new Image();
    img.src = preview;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);

    ctx.save();
    ctx.font = `${Math.max(20, img.width / 15)}px sans-serif`;
    ctx.fillStyle = "rgba(255,0,0,0.35)";
    ctx.textAlign = "center";
    ctx.translate(img.width / 2, img.height / 2);
    ctx.rotate(-0.25);
    ctx.fillText(watermarkText || "Watermark", 0, 0);
    ctx.restore();

    canvas.toBlob((blob) => {
      if (!blob) return alert("Failed to generate watermarked image");
      downloadBlob(blob, `watermarked-${file ? file.name : "image.jpg"}`);
    }, "image/jpeg", quality);
  };

  const imageToPDF = async () => {
    if (!file || !preview) return alert("Upload image first");

    const img = new Image();
    img.src = preview;
    await img.decode();

    const jsPDF = await getJsPdf();

    // create PDF the same size as image (px)
    const pdf = new jsPDF({
      unit: "px",
      format: [img.width, img.height],
    });

    pdf.addImage(preview, "JPEG", 0, 0, img.width, img.height);

    const blob = pdf.output("blob");
    downloadBlob(blob, `${file.name.replace(/\..+$/, "")}.pdf`);
  };

  /* ---------- PDF OPERATIONS (require dynamic pdf-lib) ---------- */

  const mergePDFs = async () => {
    const files = inputRef.current && inputRef.current.files;
    if (!files || files.length === 0) return alert("Select PDFs (multiple) to merge");

    const { PDFDocument } = await getPdfLib();
    const outPDF = await PDFDocument.create();

    for (let f of files) {
      if (!f.type || !f.type.includes("pdf")) continue;
      const bytes = await f.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const copied = await outPDF.copyPages(pdf, pdf.getPageIndices());
      copied.forEach((p) => outPDF.addPage(p));
    }

    const merged = await outPDF.save();
    downloadBlob(new Blob([merged]), "merged.pdf");
  };

  const splitPDF = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload a PDF to split");

    const { PDFDocument } = await getPdfLib();
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const count = pdf.getPageCount();

    for (let i = 0; i < count; i++) {
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(pdf, [i]);
      out.addPage(page);
      const res = await out.save();
      downloadBlob(new Blob([res]), `page-${i + 1}.pdf`);
    }
  };

  const compressPDF = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload a PDF to compress");

    const { PDFDocument } = await getPdfLib();
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);

    // Strip metadata and ask pdf-lib to use object streams
    pdf.setTitle("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("");
    pdf.setCreator("");
    pdf.setAuthor("");

    const res = await pdf.save({ useObjectStreams: true });
    downloadBlob(new Blob([res]), `compressed-${file.name.replace(/\..+$/, "")}.pdf`);
  };

  const pdfToImages = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload a PDF first");

    // This is a lightweight placeholder renderer — not a full PDF rasterizer.
    // It produces simple PNG placeholders for each page to preview / download.
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
      ctx.fillText(`PDF Preview Page ${i + 1}`, 40, 80);

      canvas.toBlob((b) => downloadBlob(b, `pdf-page-${i + 1}.png`));
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-4">All-in-One File Toolkit (lighter)</h1>

      {/* Tabs */}
      <div className="flex gap-3 justify-center mb-4">
        {["image", "pdf", "watermark"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded ${tab === t ? "bg-blue-500 text-white" : "bg-gray-200"}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* File input (multiple allowed for merge) */}
      <input
        type="file"
        onChange={loadFile}
        ref={inputRef}
        className="mb-4"
        multiple
        accept="image/*,application/pdf"
      />

      {/* Image preview (show only for image files) */}
      {preview && tab !== "pdf" && (
        <img src={preview} alt="preview" className="w-full mb-4 rounded" />
      )}

      {/* IMAGE TAB */}
      {tab === "image" && (
        <>
          <h2 className="text-xl font-bold mb-2">Image Tools</h2>

          <div className="flex gap-3 mb-3">
            <input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="Width" className="border p-2 w-full" />
            <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Height" className="border p-2 w-full" />
          </div>

          <label className="block mb-3">
            <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} />{" "}
            Keep Aspect Ratio
          </label>

          <div className="flex gap-3">
            <button onClick={resizeImage} className="bg-green-600 text-white px-4 py-2 rounded">Resize & Download</button>
            <button onClick={imageToPDF} className="bg-blue-600 text-white px-4 py-2 rounded">Image → PDF</button>
          </div>
        </>
      )}

      {/* PDF TAB */}
      {tab === "pdf" && (
        <>
          <h2 className="text-xl font-bold mb-2">PDF Tools</h2>

          <div className="flex flex-col gap-3">
            <button onClick={mergePDFs} className="bg-purple-600 text-white px-4 py-2 rounded">Merge PDFs (select multiple files above)</button>
            <button onClick={splitPDF} className="bg-orange-600 text-white px-4 py-2 rounded">Split PDF (single PDF must be loaded)</button>
            <button onClick={compressPDF} className="bg-teal-600 text-white px-4 py-2 rounded">Compress PDF</button>
            <button onClick={pdfToImages} className="bg-red-600 text-white px-4 py-2 rounded">PDF → Images (preview placeholders)</button>
          </div>
        </>
      )}

      {/* WATERMARK TAB */}
      {tab === "watermark" && (
        <>
          <h2 className="text-xl font-bold mb-2">Add Watermark</h2>

          <input type="text" placeholder="Watermark text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} className="border p-2 w-full mb-3" />

          <button onClick={addWatermark} className="bg-red-600 text-white px-4 py-2 rounded">Apply Watermark & Download</button>
        </>
      )}
    </div>
  );
}
