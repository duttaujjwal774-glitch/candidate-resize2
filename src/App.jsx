import React, { useState, useRef, useEffect } from "react";

export default function App() {
  const [preview, setPreview] = useState("");
  const [fileInfo, setFileInfo] = useState(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [quality, setQuality] = useState(0.92);

  const canvasRef = useRef(null);
  const cropCanvasRef = useRef(null);

  const cropStart = useRef(null);
  const cropRect = useRef(null);

  // -------------------------
  // LOAD FILE
  // -------------------------
  const loadFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

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

  // -------------------------
  // DRAW IMAGE
  // -------------------------
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

  useEffect(drawImage, [preview]);

  // -------------------------
  // MOUSE HELPERS
  // -------------------------
  const getOffset = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // -------------------------
  // CROP FUNCTIONS
  // -------------------------
  const startCrop = (e) => {
    if (!preview) return;
    cropStart.current = getOffset(e);
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

    const base = canvasRef.current;
    const rect = cropRect.current;

    const cropCanvas = document.createElement("canvas");
    const ctx = cropCanvas.getContext("2d");

    cropCanvas.width = rect.w;
    cropCanvas.height = rect.h;

    ctx.drawImage(
      base,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      0,
      0,
      rect.w,
      rect.h
    );

    setPreview(cropCanvas.toDataURL("image/jpeg", quality));
    cropRect.current = null;
  };

  const clearCrop = () => {
    cropRect.current = null;
    drawCropOverlay();
  };

  // -------------------------
  // RESIZE
  // -------------------------
  const resizeImage = () => {
    if (!preview || !width || !height) return alert("Enter width & height");

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = parseInt(width);
      canvas.height = parseInt(height);

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      download(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = preview;
  };

  const download = (data) => {
    const a = document.createElement("a");
    a.href = data;
    a.download = "output.jpg";
    a.click();
  };

  const clearAll = () => {
    setPreview("");
    setFileInfo(null);
    cropRect.current = null;
  };

  // -------------------------
  // UI LAYOUT
  // -------------------------
  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2 style={{ textAlign: "center" }}>Image: Resize & Crop</h2>

      <input type="file" onChange={loadFile} />

      {fileInfo && (
        <div style={{ marginTop: 10 }}>
          <b>File Info:</b><br />
          Name: {fileInfo.name}<br />
          Size: {fileInfo.size}<br />
          Type: {fileInfo.type}<br />
          Modified: {fileInfo.lastModified}<br />
          Dimensions: {fileInfo.width} × {fileInfo.height}px
        </div>
      )}

      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        {/* Image + Crop Overlay */}
        <div style={{ position: "relative" }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startCrop}
            onMouseMove={moveCrop}
            style={{ border: "1px solid #ccc" }}
          />
          <canvas
            ref={cropCanvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Controls */}
        <div>
          Width (px)<br />
          <input value={width} onChange={(e) => setWidth(e.target.value)} /><br />

          Height (px)<br />
          <input value={height} onChange={(e) => setHeight(e.target.value)} /><br />

          Quality<br />
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={quality}
            onChange={(e) => setQuality(parseFloat(e.target.value))}
          /><br />

          <button onClick={resizeImage}>Resize & Download</button><br />
          <button onClick={applyCrop}>Crop & Download</button><br />
          <button onClick={clearCrop}>Clear Crop</button><br />
          <button onClick={clearAll}>Clear All</button>
        </div>
      </div>
    </div>
  );
}
