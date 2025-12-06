import React, { useState, useRef } from "react";

/**
 * Minimal File Toolkit (ZERO external deps)
 * - Image preview
 * - Resize client-side and download
 * 
 * No watermark, no OCR, no pdf-lib, no file-saver, no background workers.
 */

export default function App() {
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepRatio, setKeepRatio] = useState(true);
  const [quality, setQuality] = useState(0.9);
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

    setFileName(f.name || "image.jpg");

    if (f.type && f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreview(ev.target.result);

        // measure natural dimensions
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

  // Utility: download a blob with anchor (no file-saver)
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
      if (!width && !height) {
        w = img.width;
        h = img.height;
      }
    } else {
      if (!w) w = img.width;
      if (!h) h = img.height;
    }

    // safety: clamp sizes (prevent very large canvases)
    const MAX_DIM = 4000; // you can lower this if you want
    if (w > MAX_DIM || h > MAX_DIM) {
      const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    canvas.toBlob(
      (blob)
