// src/App.jsx
import React, { useRef, useState } from "react";

/*
  CandidateResize - single-file App.jsx
  - Upload image
  - Choose preset or custom px dimensions
  - Set target KB
  - Compress to target KB using canvas (iterative JPEG quality)
  - Download JPG/PNG
*/

const PRESETS = [
  { id: "sig", label: "Signature 200×60 px — ~20 KB", w: 200, h: 60, kb: 20 },
  { id: "passport", label: "Passport 3.5×4.5 cm ≈ 350×450 px — ~50 KB", w: 350, h: 450, kb: 50 },
  { id: "govt", label: "Standard Govt Photo 400×600 px — ~80 KB", w: 400, h: 600, kb: 80 },
  { id: "custom", label: "Custom (enter below)", w: null, h: null, kb: null },
];

function bytesToKB(b) {
  return Math.round((b / 1024) * 10) / 10;
}

export default function App() {
  const fileRef = useRef(null);
  const [srcUrl, setSrcUrl] = useState(null);
  const [origInfo, setOrigInfo] = useState(null);

  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const [targetKB, setTargetKB] = useState(PRESETS[0].kb);

  const [status, setStatus] = useState("");
  const [resultBlob, setResultBlob] = useState(null);
  const [resultKB, setResultKB] = useState(null);

  // Load file
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setSrcUrl(url);
    setResultBlob(null);
    setResultKB(null);
    setStatus("");

    const img = new Image();
    img.onload = () => {
      setOrigInfo({
        name: f.name,
        sizeKB: bytesToKB(f.size),
        w: img.naturalWidth,
        h: img.naturalHeight,
      });
      // if preset is custom keep as is; otherwise populate dims from preset
      const p = PRESETS.find((p) => p.id === presetId);
      if (p && p.w && p.h) {
        setCustomW(p.w);
        setCustomH(p.h);
        setTargetKB(p.kb);
      } else {
        setCustomW(img.naturalWidth);
        setCustomH(img.naturalHeight);
      }
    };
    img.src = url;
  };

  const onPresetChange = (id) => {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p) {
      if (p.w && p.h) {
        setCustomW(p.w);
        setCustomH(p.h);
        setTargetKB(p.kb);
      }
    }
  };

  // Draw image on canvas with background white and centered letterbox if aspect mismatch
  function drawToCanvas(img, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // white background (helps signatures)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fit inside (contain) while preserving aspect ratio and center
    const ratio = Math.min(width / img.naturalWidth, height / img.naturalHeight);
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);
    const dx = Math.round((width - w) / 2);
    const dy = Math.round((height - h) / 2);
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, w, h);
    return canvas;
  }

  // Convert canvas to blob (jpeg) with quality
  function canvasToJpegBlob(canvas, quality = 0.9) {
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });
  }

  // Iteratively compress: lower quality until <= target KB or minQuality reached
  async function compressToTarget(canvas, targetKB, minQuality = 0.35) {
    let q = 0.92;
    let blob = await canvasToJpegBlob(canvas, q);
    let sizeKB = bytesToKB(blob.size);
    if (sizeKB <= targetKB) return blob;

    // step down slowly
    while (q > minQuality) {
      q = Math.round((q - 0.07) * 100) / 100; // step 0.07, round to 2 decimals
      if (q < minQuality) q = minQuality;
      blob = await canvasToJpegBlob(canvas, q);
      sizeKB = bytesToKB(blob.size);
      if (sizeKB <= targetKB) break;
    }
    return blob; // may still be >target if extremely small target
  }

  const handleCompress = async () => {
    setStatus("Preparing...");
    setResultBlob(null);
    setResultKB(null);

    if (!srcUrl) {
      setStatus("Upload an image first.");
      return;
    }

    const w = parseInt(customW, 10);
    const h = parseInt(customH, 10);
    const kb = parseFloat(targetKB);

    if (!w || !h || !kb) {
      setStatus("Enter valid width, height and target KB.");
      return;
    }

    setStatus("Loading image...");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = srcUrl;

    await new Promise((res) => {
      img.onload = res;
      img.onerror = () => {
        setStatus("Failed to load image.");
        res();
      };
    });

    setStatus("Drawing image to canvas...");
    const canvas = drawToCanvas(img, w, h);

    setStatus(`Compressing to around ${kb} KB...`);
    try {
      const blob = await compressToTarget(canvas, kb);
      setResultBlob(blob);
      setResultKB(bytesToKB(blob.size));
      setStatus("Done. Use download buttons.");
    } catch (err) {
      console.error(err);
      setStatus("Compression failed. See console.");
    }
  };

  const downloadBlob = (blob, filename) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadJPG = () => {
    if (!resultBlob) {
      setStatus("No result. Click Compress first.");
      return;
    }
    downloadBlob(resultBlob, "resized.jpg");
  };

  const handleDownloadPNG = async () => {
    if (!srcUrl) {
      setStatus("No source image.");
      return;
    }
    // draw and export PNG
    setStatus("Preparing PNG...");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = srcUrl;
    await new Promise((res) => {
      img.onload = res;
      img.onerror = res;
    });
    const w = parseInt(customW, 10) || img.naturalWidth;
    const h = parseInt(customH, 10) || img.naturalHeight;
    const canvas = drawToCanvas(img, w, h);
    canvas.toBlob((b) => {
      if (b) downloadBlob(b, "resized.png");
      else setStatus("PNG generation failed.");
    }, "image/png");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <h1 className="text-3xl font-bold text-gray-800 text-center">Resize Photo & Signature for Govt Exams</h1>
      <p className="text-gray-600 mt-2 text-center">Upload Photo / Signature</p>

      <div className="mt-6">
        <button
          onClick={() => fileRef.current.click()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700"
        >
          Upload Image
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>

      <div className="w-full max-w-3xl mt-6">
        {srcUrl ? (
          <div className="bg-white rounded p-4 shadow">
            <div className="flex flex-col md:flex-row gap-4">
              <div style={{ flex: 1 }}>
                <img
                  src={srcUrl}
                  alt="preview"
                  style={{ maxWidth: "100%", height: "auto", borderRadius: 6, boxShadow: "0 4px 10px rgba(0,0,0,0.08)" }}
                />
                <div className="text-sm text-gray-600 mt-2">
                  Original: {origInfo ? `${origInfo.sizeKB} KB • ${origInfo.w}×${origInfo.h}px` : "—"}
                </div>
              </div>

              <div style={{ width: 340 }}>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700">Preset</label>
                  <select
                    className="mt-1 block w-full rounded border-gray-300 p-2"
                    value={presetId}
                    onChange={(e) => onPresetChange(e.target.value)}
                  >
                    {PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700">Width (px)</label>
                  <input
                    type="number"
                    value={customW}
                    onChange={(e) => setCustomW(e.target.value)}
                    className="mt-1 block w-full rounded border-gray-300 p-2"
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700">Height (px)</label>
                  <input
                    type="number"
                    value={customH}
                    onChange={(e) => setCustomH(e.target.value)}
                    className="mt-1 block w-full rounded border-gray-300 p-2"
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700">Target file size (KB)</label>
                  <input
                    type="number"
                    value={targetKB}
                    onChange={(e) => setTargetKB(e.target.value)}
                    className="mt-1 block w-full rounded border-gray-300 p-2"
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleCompress}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Compress to Target
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="text-sm text-gray-700">Result:</div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadJPG}
                      className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      Download JPG
                    </button>
                    <button
                      onClick={handleDownloadPNG}
                      className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
                    >
                      Download PNG
                    </button>
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  {status && <div><strong>Status:</strong> {status}</div>}
                  {resultKB && <div><strong>Final size:</strong> {resultKB} KB</div>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-20">Upload an image to begin resizing.</div>
        )}
      </div>
    </div>
  );
}

