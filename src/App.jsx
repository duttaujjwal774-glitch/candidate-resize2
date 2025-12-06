import React, { useState, useRef, useEffect } from "react";

export default function App() {
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileInfo, setFileInfo] = useState(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepRatio, setKeepRatio] = useState(true);
  const [quality, setQuality] = useState(0.9);

  const [cropRect, setCropRect] = useState(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const inputRef = useRef();

  /** LOAD FILE + FILE INFO **/
  const loadFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    const info = {
      name: f.name,
      size: (f.size / 1024 / 1024).toFixed(2) + " MB",
      type: f.type,
      lastModified: new Date(f.lastModified).toLocaleString(),
    };

    setFileInfo(info);
    setFileName(f.name);

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  /** DRAW IMAGE ON CANVAS **/
  useEffect(() => {
    if (!preview) return;

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;

      const c = canvasRef.current;
      const maxW = Math.min(window.innerWidth - 80, 900);
      const scale = Math.min(1, maxW / img.width);

      c.width = img.width * scale;
      c.height = img.height * scale;

      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);

      setWidth(img.width);
      setHeight(img.height);

      setFileInfo((prev) =>
        prev
          ? {
              ...prev,
              resolution: img.width + " × " + img.height + " px",
            }
          : prev
      );
    };

    img.src = preview;
  }, [preview]);

  /** CANVAS OFFSET **/
  const getOffset = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y
