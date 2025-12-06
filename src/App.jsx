import React, { useState, useRef } from "react";

/**
 * All heavy libraries (file-saver, jspdf, pdf-lib, tesseract.js)
 * are dynamically imported inside the functions that need them.
 *
 * This prevents server-side (build) from trying to evaluate browser APIs.
 */

/* ---------- Lazy import helpers ---------- */
const getSaveAs = async () => {
  const mod = await import("file-saver");
  // file-saver exports saveAs named or default depending on bundler
  return mod.saveAs || mod.default || mod;
};
const getJsPdf = async () => {
  const mod = await import("jspdf");
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

  // used both for single-file load and for selecting multiple files (merge)
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

    // If image: create preview dataURL
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreview(ev.target.result);
      };
      reader.readAsDataURL(f);

      // get natural size
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

    const saveAs = await getSaveAs();
    canvas.toBlob(
      (blob) => {
        if (!blob) return alert("Failed to generate blob");
        saveAs(blob, "resized-" + file.name);
      },
      "image/jpeg",
      quality
    );
  };

  /** Image → PDF */
  const imageToPDF = async () => {
    if (!file || !preview) return alert("Upload image first");

    const img = new Image();
    img.src = preview;
    await img.decode();

    const jsPDF = await getJsPdf();

    // Create PDF sized to image (px units)
    const pdf = new jsPDF({
      unit: "px",
      format: [img.width, img.height],
    });

    // For addImage we pass the dataURL; format can be "JPEG" or "PNG"
    pdf.addImage(preview, "JPEG", 0, 0, img.width, img.height);

    const blob = pdf.output("blob");
    const saveAs = await getSaveAs();
    saveAs(blob, file.name.replace(/\..+$/, "") + ".pdf");
  };

  /** Merge PDFs (select multiple files from input) */
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
    const saveAs = await getSaveAs();
    saveAs(new Blob([merged]), "merged.pdf");
  };

  /** Split PDF → one file per page (requires single file loaded into `file`) */
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
      const saveAs = await getSaveAs();
      saveAs(new Blob([saveBytes]), `page-${i + 1}.pdf`);
    }
  };

  /** PDF → Images (simple preview generator — not true render) */
  const pdfToImages = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload PDF first!");

    // We do a light-weight preview: render simple placeholder per page
    const { PDFDocument } = await getPdfLib();
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const pages = pdf.getPageCount();

    for (let i = 0; i < pages; i++) {
      const canvas = document.createElement("canvas");
      // smallish preview to avoid large memory use
      canvas.width = 800;
      canvas.height = 1100;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#000";
      ctx.font = "20px sans-serif";
      ctx.fillText(`PDF Preview Page ${i + 1}`, 100, 100);

      const saveAs = await getSaveAs();
      canvas.toBlob((b) => saveAs(b, `pdf-page-${i + 1}.png`));
    }
  };

  /** Compress PDF (basic) */
  const compressPDF = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload PDF first!");
    const { PDFDocument } = await getPdfLib();
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);

    // Strip metadata to reduce size a bit
    pdf.setTitle("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("");
    pdf.setCreator("");
    pdf.setAuthor("");

    const saveBytes = await pdf.save({ useObjectStreams: true });
    const saveAs = await getSaveAs();
    saveAs(new Blob([saveBytes]), "compressed.pdf");
  };

  /** OCR (Image → Text) — heavy: loads tesseract in browser (webworker). */
  const doOCR = async () => {
    if (!file || !preview) return alert("Upload an image");

    setOcrText("Processing... Please wait (this may take time)");

    const Tesseract = await getTesseract();
    // prefer worker API
    const { createWorker } = Tesseract;
    const worker = createWorker({
      logger: (m) => {
        // optional: update small progress messages
        // console.log(m);
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

    ctx.drawImage(img, 0, 0);

    ctx.save();
    ctx.font = `${Math.max(20, img.width / 15)}px Arial`;
    ctx.fillStyle = "rgba(255,0,0,0.35)";
    ctx.textAlign = "center";

    // rotate about center
    ctx.translate(img.width / 2, img.height / 2);
    ctx.rotate(-0.25);
    ctx.fillText(watermarkText || "Watermark", 0, 0);
    ctx.restore();

    const saveAs = await getSaveAs();
    canvas.toBlob((blob) => {
      if (!blob) return alert("Failed to generate watermarked image");
      saveAs(blob, "watermarked-" + (file ? file.name : "image.jpg"));
    }, "image/jpeg", quality);
  };

  /* ---------- UI ---------- */
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-4">All-in-One File Toolkit</h1>

      <div className="flex gap-3 justify-center mb-4">
        {["image", "pdf", "ocr", "watermark"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded ${tab === t ? "bg-blue-500 text-white" : "bg-gray-200"}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* allow multiple selection for merge operation */}
      <input
        type="file"
        onChange={loadFile}
        ref={inputRef}
        className="mb-4"
        multiple
        accept="image/*,application/pdf"
      />

      {preview && tab !== "pdf" && (
        <img src={preview} alt="preview" className="w-full mb-4 rounded" />
      )}

      {tab === "image" && (
        <>
          <h2 className="text-xl font-bold mb-2">Resize Image</h2>

          <div className="flex gap-3 mb-3">
            <input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="Width" className="border p-2 w-full" />
            <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Height" className="border p-2 w-full" />
          </div>

          <label>
            <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} />{" "}
            Keep Aspect Ratio
          </label>

          <div className="mt-4 flex gap-3">
            <button onClick={resizeImage} className="bg-green-600 text-white px-4 py-2 rounded">Resize</button>
            <button onClick={imageToPDF} className="bg-blue-600 text-white px-4 py-2 rounded">Image → PDF</button>
          </div>
        </>
      )}

      {tab === "pdf" && (
        <>
          <h2 className="text-xl font-bold mb-2">PDF Tools</h2>

          <div className="flex flex-col gap-3">
            <button onClick={mergePDFs} className="bg-purple-600 text-white px-4 py-2 rounded">Merge PDFs (select multiple)</button>
            <button onClick={splitPDF} className="bg-orange-600 text-white px-4 py-2 rounded">Split PDF</button>
            <button onClick={compressPDF} className="bg-teal-600 text-white px-4 py-2 rounded">Compress PDF</button>
            <button onClick={pdfToImages} className="bg-red-600 text-white px-4 py-2 rounded">PDF → Images (preview)</button>
          </div>
        </>
      )}

      {tab === "ocr" && (
        <>
          <h2 className="text-xl font-bold mb-2">Extract Text (OCR)</h2>
          <button onClick={doOCR} className="bg-blue-600 text-white px-4 py-2 rounded mb-3">Extract Text</button>
          <textarea value={ocrText} readOnly className="border p-3 w-full h-40" />
        </>
      )}

      {tab === "watermark" && (
        <>
          <h2 className="text-xl font-bold mb-2">Add Watermark</h2>
          <input type="text" placeholder="Watermark text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} className="border p-2 w-full mb-3" />
          <button onClick={addWatermark} className="bg-red-600 text-white px-4 py-2 rounded">Apply Watermark</button>
        </>
      )}
    </div>
  );
}
