import React, { useState, useRef } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("image.jpg");

  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepAspect, setKeepAspect] = useState(false);
  const [quality, setQuality] = useState(0.92);

  const canvasRef = useRef(null); // main image canvas
  const cropCanvasRef = useRef(null); // crop overlay canvas

  const cropStart = useRef(null);
  const cropRect = useRef(null);

  // --------------------------
  // LOAD FILE + SHOW INFO
  // --------------------------
  const loadFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setFileName(f.name);

    const info = {
      name: f.name,
      size: (f.size / 1024 / 1024).toFixed(2) + " MB",
      type: f.type,
      lastModified: new Date(f.lastModified).toLocaleString(),
    };

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        info.width = img.width;
        info.height = img.height;
        setFileInfo(info);
        setPreview(ev.target.result);
      };
      img.src = ev.target.result;
    };

    reader.readAsDataURL(f);
  };

  // --------------------------
  // DRAW IMAGE ON CANVAS
  // --------------------------
  const drawImage = () => {
    if (!preview) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };

    img.src = preview;
  };

  React.useEffect(drawImage, [preview]);

  // --------------------------
  // CROP FEATURE
  // --------------------------

  const getOffset = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startCrop = (e) => {
    if (!preview) return;
    cropStart.current = getOffset(e);
    cropRect.current = null;
  };

  const moveCrop = (e) => {
    if (!cropStart.current) return;

    const pos = getOffset(e);
    const start = cropStart.current;

    const x = Math.min(start.x, pos.x);
    const y = Math.min(start.y, pos.y);
    const w = Math.abs(start.x - pos.x);
    const h = Math.abs(start.y - pos.y);

    cropRect.current = { x, y, w, h };
    drawCropOverlay();
  };

  const drawCropOverlay = () => {
    const overlay = cropCanvasRef.current;
    const ctx = overlay.getContext("2d");
    const rect = cropRect.current;

    const base = canvasRef.current;
    overlay.width = base.width;
    overlay.height = base.height;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!rect) return;

    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  };

  const applyCrop = () => {
    if (!cropRect.current) return;

    const rect = cropRect.current;
    const baseCanvas = canvasRef.current;

    const cropCanvas = document.createElement("canvas");
    const ctx = cropCanvas.getContext("2d");

    cropCanvas.width = rect.w;
    cropCanvas.height = rect.h;

    ctx.drawImage(
      baseCanvas,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      0,
      0,
      rect.w,
      rect.h
    );

    const data = cropCanvas.toDataURL("image/jpeg", quality);
    setPreview(data);

    cropRect.current = null;
    cropStart.current = null;
  };

  const clearCrop = () => {
    cropRect.current = null;
    cropStart.current = null;
    drawCropOverlay();
  };

  // --------------------------
  // RESIZE IMAGE
  // --------------------------
  const resizeImage = () => {
    if (!preview || !width || !height) return alert("Enter width & height");

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = parseInt(width);
      canvas.height = parseInt(height);

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const out = canvas.toDataURL("image/jpeg", quality);
      downloadImage(out);
    };
    img.src = preview;
  };

  // --------------------------
  // DOWNLOAD HELPER
  // --------------------------
  const downloadImage = (data) => {
    const a = document.createElement("a");
    a.href = data;
    a.download = fileName.replace(/\.[^.]+$/, "") + "_edited.jpg";
    a.click();
  };

  const clearAll = () => {
    setPreview("");
    setFile(null);
    setFileInfo(null);
    cropRect.current = null;
    cropStart.current = null;
  };

  // --------------------------
  // UI
  // --------------------------
  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>Image: Resize & Crop</h2>

      <input type="file" onChange={loadFile} />

      {fileInfo && (
        <div style={{ marginTop: 10, fontSize: 14 }}>
          <strong>File Details:</strong><br />
          Name: {fileInfo.name} <br />
          Size: {fileInfo.size} <br />
          Type: {fileInfo.type} <br />
          Modified: {fileInfo.lastModified} <br />
          Dimensions: {fileInfo.width} × {fileInfo.height}px
        </div>
      )}

      <div style={{ display: "flex", marginTop: 20, gap: 20 }}>
        {/* Main Image Area */}
        <div>
          <canvas
            ref={canvasRef}
            style={{ border: "1px solid #ccc", cursor: "crosshair" }}
            onMouseDown={startCrop}
            onMouseMove={moveCrop}
          ></canvas>

          <canvas
            ref={cropCanvasRef}
            style={{
              position: "absolute",
              pointerEvents: "none",
              border: "1px solid transparent",
            }}
          ></canvas>
        </div>

        {/* Controls */}
        <div>
          <div>
            Width (px) <br />
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            Height (px) <br />
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            Quality <br />
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
            />
          </div>

          <button style={{ marginTop: 15 }} onClick={resizeImage}>
            Resize & Download
          </button>

          <button style={{ marginTop: 10 }} onClick={applyCrop}>
            Crop & Download
          </button>

          <button style={{ marginTop: 10 }} onClick={clearCrop}>
            Clear Crop
          </button>

          <button style={{ marginTop: 10 }} onClick={clearAll}>
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
