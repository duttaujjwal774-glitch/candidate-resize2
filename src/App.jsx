import React, { useState, useRef } from "react";

/**
 * Zero-dependency App.jsx
 * - No file-saver, jspdf, pdf-lib, tesseract
 * - Uses browser APIs to download blobs
 */

export default function App() {
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepRatio, setKeepRatio] = useState(true);
  const [watermarkText, setWatermarkText] = useState("");
  const inputRef = useRef();

  const loadFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setPreview("");
      setFileName("");
      setWidth("");
      setHeight("");
      return;
    }
    setFileName(f.name);
    if (f.type && f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreview(ev.target.result);
        const img = new Image();
        img.onload = () => {
          setWidth(img.width);
          setHeight(img.height);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(f);
    } else {
      setPreview("");
      setWidth("");
      setHeight("");
    }
  };

  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const resizeImage = async () => {
    if (!preview) return alert("Upload an image first.");
    const img = new Image();
    img.src = preview;
    await img.decode();

    let w = parseInt(width, 10) || img.width;
    let h = parseInt(height, 10) || img.height;

    if (keepRatio) {
      const r = img.width / img.height;
      if (!height && width) h = Math.round(w / r);
      if (!width && height) w = Math.round(h * r);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    canvas.toBlob((b) => {
      if (!b) return alert("Failed to produce image blob");
      downloadBlob(b, `resized-${fileName || "image.jpg"}`);
    }, "image/jpeg", 0.9);
  };

  const addWatermark = async () => {
    if (!preview) return alert("Upload an image first.");
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

    canvas.toBlob((b) => {
      if (!b) return alert("Failed to produce watermarked image");
      downloadBlob(b, `watermarked-${fileName || "image.jpg"}`);
    }, "image/jpeg", 0.9);
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>Minimal File Toolkit</h1>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={loadFile}
        style={{ display: "block", margin: "12px 0" }}
      />

      {preview && (
        <div style={{ marginBottom: 12 }}>
          <img src={preview} alt="preview" style={{ width: "100%", maxHeight: 450, objectFit: "contain" }} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="Width" />
        <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Height" />
        <label style={{ alignSelf: "center" }}>
          <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} /> Keep ratio
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={resizeImage}>Resize & Download</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <input value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} placeholder="Watermark text" style={{ width: "100%" }} />
      </div>
      <div>
        <button onClick={addWatermark}>Apply Watermark & Download</button>
      </div>
    </div>
  );
}
