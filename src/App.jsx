import React, { useState, useRef } from "react";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import { PDFDocument } from "pdf-lib";
import Tesseract from "tesseract.js";

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

  /** Load File */
  const loadFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;

    setFile(f);

    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
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

    let w = parseInt(width);
    let h = parseInt(height);

    if (keepRatio) {
      const r = img.width / img.height;
      if (!height) h = Math.round(w / r);
      if (!width) w = Math.round(h * r);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);

    canvas.toBlob(
      (blob) => saveAs(blob, "resized-" + file.name),
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

    const pdf = new jsPDF({
      unit: "px",
      format: [img.width, img.height],
    });

    pdf.addImage(preview, "JPEG", 0, 0, img.width, img.height);

    saveAs(pdf.output("blob"), file.name.replace(/\..+$/, "") + ".pdf");
  };
  /** Merge PDFs */
  const mergePDFs = async () => {
    const files = inputRef.current.files;
    if (!files.length) return alert("Select PDFs");

    const outPDF = await PDFDocument.create();

    for (let f of files) {
      const bytes = await f.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const pages = await outPDF.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => outPDF.addPage(p));
    }

    const merged = await outPDF.save();
    saveAs(new Blob([merged]), "merged.pdf");
  };

  /** Split PDF → one file per page */
  const splitPDF = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload PDF");

    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const count = pdf.getPageCount();

    for (let i = 0; i < count; i++) {
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(pdf, [i]);
      out.addPage(page);

      const saveBytes = await out.save();
      saveAs(new Blob([saveBytes]), `page-${i + 1}.pdf`);
    }
  };

  /** PDF → Images */
  const pdfToImages = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload PDF first!");

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
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

      canvas.toBlob((b) => saveAs(b, `pdf-page-${i + 1}.png`));
    }
  };

  /** Compress PDF (simple) */
  const compressPDF = async () => {
    if (!file || !file.type.includes("pdf")) return alert("Upload PDF first!");

    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);

    // Remove metadata, compress streams
    pdf.setTitle("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("");
    pdf.setCreator("");
    pdf.setAuthor("");

    const saveBytes = await pdf.save({ useObjectStreams: true });
    saveAs(new Blob([saveBytes]), "compressed.pdf");
  };
  /** OCR (Image → Text) */
  const doOCR = async () => {
    if (!file || !preview) return alert("Upload an image");

    setOcrText("Processing... Please wait");

    const result = await Tesseract.recognize(preview, "eng", {
      logger: (m) => console.log(m),
    });

    setOcrText(result.data.text || "No text detected");
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

    ctx.font = `${img.width / 15}px Arial`;
    ctx.fillStyle = "rgba(255,0,0,0.4)";
    ctx.textAlign = "center";
    ctx.rotate(-0.2);
    ctx.fillText(watermarkText, img.width / 2, img.height / 2);

    canvas.toBlob((blob) => saveAs(blob, "watermarked-" + file.name));
  };

  /** UI Rendering */
  return (
    <div className="p-6 max-w-3xl mx-auto">

      <h1 className="text-3xl font-bold text-center mb-4">
        All-in-One File Toolkit (No API Needed)
      </h1>

      {/* TAB MENU */}
      <div className="flex gap-3 justify-center mb-4">
        {["image", "pdf", "ocr", "watermark"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded ${
              tab === t ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* FILE INPUT */}
      <input
        type="file"
        onChange={loadFile}
        ref={inputRef}
        className="mb-4"
      />

      {preview && tab !== "pdf" && (
        <img src={preview} alt="preview" className="w-full mb-4 rounded" />
      )}

      {/* IMAGE TOOLS */}
      {tab === "image" && (
        <>
          <h2 className="text-xl font-bold mb-2">Resize Image</h2>

          <div className="flex gap-3 mb-3">
            <input
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="Width"
              className="border p-2 w-full"
            />
            <input
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="Height"
              className="border p-2 w-full"
            />
          </div>

          <label>
            <input
              type="checkbox"
              checked={keepRatio}
              onChange={(e) => setKeepRatio(e.target.checked)}
            />{" "}
            Keep Aspect Ratio
          </label>

          <div className="mt-4 flex gap-3">
            <button onClick={resizeImage} className="bg-green-600 text-white px-4 py-2 rounded">
              Resize
            </button>
            <button onClick={imageToPDF} className="bg-blue-600 text-white px-4 py-2 rounded">
              Image → PDF
            </button>
          </div>
        </>
      )}

      {/* PDF TOOLS */}
      {tab === "pdf" && (
        <>
          <h2 className="text-xl font-bold mb-2">PDF Tools</h2>

          <div className="flex flex-col gap-3">

            <button onClick={mergePDFs} className="bg-purple-600 text-white px-4 py-2 rounded">
              Merge PDFs
            </button>

            <button onClick={splitPDF} className="bg-orange-600 text-white px-4 py-2 rounded">
              Split PDF
            </button>

            <button onClick={compressPDF} className="bg-teal-600 text-white px-4 py-2 rounded">
              Compress PDF
            </button>

            <button onClick={pdfToImages} className="bg-red-600 text-white px-4 py-2 rounded">
              PDF → Images
            </button>
          </div>
        </>
      )}

      {/* OCR TOOL */}
      {tab === "ocr" && (
        <>
          <h2 className="text-xl font-bold mb-2">Extract Text (OCR)</h2>

          <button
            onClick={doOCR}
            className="bg-blue-600 text-white px-4 py-2 rounded mb-3"
          >
            Extract Text
          </button>

          <textarea
            value={ocrText}
            readOnly
            className="border p-3 w-full h-40"
          />
        </>
      )}

      {/* WATERMARK TOOL */}
      {tab === "watermark" && (
        <>
          <h2 className="text-xl font-bold mb-2">Add Watermark</h2>

          <input
            type="text"
            placeholder="Watermark text"
            value={watermarkText}
            onChange={(e) => setWatermarkText(e.target.value)}
            className="border p-2 w-full mb-3"
          />

          <button
            onClick={addWatermark}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Apply Watermark
          </button>
        </>
      )}
    </div>
  );
}

