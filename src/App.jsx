import React, { useState, useRef, useEffect } from "react";

/**
 * Minimal Image tool: preview, resize, crop, download.
 * Zero external deps. Safe for Vercel/Next.
 */

export default function App() {
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepRatio, setKeepRatio] = useState(true);
  const [quality, setQuality] = useState(0.9);

  // crop state
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState(null); // {x,y,w,h} in canvas coords
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const inputRef = useRef();

  // load file and create data URL preview
  const loadFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      clearAll();
      return;
    }
    setFileName(f.name || "image.jpg");

    if (f.type && f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreview(ev.target.result);
      };
      reader.readAsDataURL(f);
    } else {
      alert("Please upload an image file.");
    }
  };

  // draw image to canvas whenever preview changes
  useEffect(() => {
    if (!preview) {
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);
      }
      imgRef.current = null;
      setCropRect(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // fit canvas to container width while keeping ratio
      const c = canvasRef.current;
      const maxW = Math.min(window.innerWidth - 80, 900);
      const scale = Math.min(1, maxW / img.width);
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      // reset crop rect
      setCropRect(null);
      // pre-fill width/height with natural size (for resize)
      setWidth(img.width);
      setHeight(img.height);
    };
    img.src = preview;

    // cleanup
    return () => {};
  }, [preview]);

  // helpers to convert mouse coords to canvas coords
  const getCanvasOffset = (evt) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (evt.clientX - rect.left);
    const y = (evt.clientY - rect.top);
    return { x, y };
  };

  // crop drawing via mouse
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let start = null;
    let dragging = false;

    const onDown = (e) => {
      if (!imgRef.current) return;
      dragging = true;
      start = getCanvasOffset(e);
      setIsCropping(true);
    };

    const onMove = (e) => {
      if (!dragging || !start) return;
      const pos = getCanvasOffset(e);
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);
      drawTemporaryRect({ x, y, w, h });
      setCropRect({ x, y, w, h });
    };

    const onUp = () => {
      dragging = false;
      start = null;
      setIsCropping(false);
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [preview]);

  // draw image and crop overlay
  const drawTemporaryRect = (rect) => {
    const c = canvasRef.current;
    if (!c || !imgRef.current) return;
    const ctx = c.getContext("2d");
    // redraw image
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(imgRef.current, 0, 0, c.width, c.height);
    // dim overlay
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, c.width, c.height);
    // clear selected rect area
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    // draw border
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
  };

  // when cropRect is set, redraw overlay each time
  useEffect(() => {
    if (!cropRect) {
      // just draw image
      const c = canvasRef.current;
      if (!c || !imgRef.current) return;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(imgRef.current, 0, 0, c.width, c.height);
      return;
    }
    drawTemporaryRect(cropRect);
  }, [cropRect]);

  // download helper
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

  // crop and download: convert crop rect from canvas space back to natural image space
  const cropAndDownload = () => {
    if (!cropRect || !imgRef.current) return alert("Draw a crop rectangle on the image first (click and drag).");
    const img = imgRef.current;
    const canvas = canvasRef.current;
    // ratio between natural and canvas
    const rx = img.width / canvas.width;
    const ry = img.height / canvas.height;

    const sx = Math.round(cropRect.x * rx);
    const sy = Math.round(cropRect.y * ry);
    const sw = Math.round(cropRect.w * rx);
    const sh = Math.round(cropRect.h * ry);

    // draw to temp canvas at natural size crop
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const octx = out.getContext("2d");
    octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    out.toBlob((blob) => {
      if (!blob) return alert("Failed to generate crop.");
      downloadBlob(blob, `crop-${fileName}`);
    }, "image/jpeg", Number(quality) || 0.9);
  };

  // resize and download at requested size (uses natural image)
  const resizeAndDownload = async () => {
    if (!imgRef.current) return alert("Upload an image first.");
    const img = imgRef.current;

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

    // clamp large sizes
    const MAX = 4000;
    if (w > MAX || h > MAX) {
      const scale = Math.min(MAX / w, MAX / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    out.toBlob((blob) => {
      if (!blob) return alert("Failed to generate resized image.");
      downloadBlob(blob, `resized-${fileName}`);
    }, "image/jpeg", Number(quality) || 0.9);
  };

  const clearAll = () => {
    setPreview("");
    setFileName("");
    setWidth("");
    setHeight("");
    setCropRect(null);
    inputRef.current && (inputRef.current.value = "");
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>Image: Resize & Crop</h1>

      <input ref={inputRef} type="file" accept="image/*" onChange={loadFile} style={{ display: "block", margin: "12px 0" }} />

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 6, overflow: "hidden" }}>
            <canvas ref={canvasRef} style={{ width: "100%", display: "block", cursor: "crosshair", background: "#f7f7f7" }} />
          </div>
          <small style={{ color: "#666" }}>Draw crop rectangle: click + drag on the image.</small>
        </div>

        <div style={{ width: 260 }}>
          <div style={{ marginBottom: 12 }}>
            <label>Width (px)</label>
            <input value={width} onChange={(e) => setWidth(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 6 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Height (px)</label>
            <input value={height} onChange={(e) => setHeight(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 6 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} />
              Keep Aspect Ratio
            </label>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label>Quality</label>
            <input type="range" min="0.1" max="1" step="0.05" value={quality} onChange={(e) => setQuality(e.target.value)} style={{ width: "100%" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={resizeAndDownload} style={{ padding: "10px" }}>Resize & Download</button>
            <button onClick={cropAndDownload} style={{ padding: "10px" }}>Crop & Download</button>
            <button onClick={() => setCropRect(null)} style={{ padding: "10px" }}>Clear Crop</button>
            <button onClick={clearAll} style={{ padding: "10px" }}>Clear All</button>
          </div>
        </div>
      </div>
    </div>
  );
}
