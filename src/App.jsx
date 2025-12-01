import React, { useState, useRef, useEffect } from "react";
import Resizer from "react-image-file-resizer";

export default function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [resizedImage, setResizedImage] = useState(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepAspect, setKeepAspect] = useState(true);
  const [quality, setQuality] = useState(80);

  // 🎵 MUSIC PLAYER REFS
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    const tryAutoplay = async () => {
      if (!audioRef.current) return;
      try {
        audioRef.current.volume = 0.4;
        await audioRef.current.play();
        setPlaying(true);
      } catch {
        setAutoplayBlocked(true);
        setPlaying(false);
      }
    };
    tryAutoplay();
  }, []);

  const toggleMusic = async () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setPlaying(true);
        setAutoplayBlocked(false);
      } catch {
        setAutoplayBlocked(true);
      }
    }
  };

  // 📷 IMAGE UPLOAD HANDLER
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedImage(file);
    setResizedImage(null);
  };

  // 📏 RESIZE HANDLER
  const handleResize = () => {
    if (!selectedImage) return;

    Resizer.imageFileResizer(
      selectedImage,
      width ? parseInt(width) : undefined,
      height ? parseInt(height) : undefined,
      "JPEG",
      quality,
      0,
      (uri) => setResizedImage(uri),
      "base64"
    );
  };

  return (
    <div className="app-container" style={{ padding: "20px", textAlign: "center" }}>
      <h1>Resize Photo & Signature for Govt Exams</h1>

      {/* 🎵 Background Music */}
      <audio ref={audioRef} src="/bg-music.mp3" loop preload="auto" />

      {/* 🎵 Floating Button */}
      <button
        onClick={toggleMusic}
        style={{
          position: "fixed",
          bottom: "18px",
          right: "18px",
          background: playing ? "#16a34a" : "#1d4ed8",
          color: "white",
          border: "none",
          padding: "10px 16px",
          borderRadius: "8px",
          fontWeight: "600",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 9999
        }}
      >
        {playing ? "Pause Music" : "Play Music"}
      </button>

      {autoplayBlocked && (
        <div
          style={{
            position: "fixed",
            right: "18px",
            bottom: "60px",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "6px 10px",
            fontSize: "12px",
            borderRadius: "6px",
            zIndex: 9999
          }}
        >
          Autoplay blocked — Tap play
        </div>
      )}

      {/* IMAGE UPLOAD */}
      <div style={{ marginTop: "30px" }}>
        <input type="file" accept="image/*" onChange={handleImageUpload} />
      </div>

      {selectedImage && (
        <>
          <h3>Resize Image</h3>

          <div style={{ maxWidth: "300px", margin: "auto" }}>
            <input
              type="number"
              placeholder="Width"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Height"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="input mt-2"
            />

            <label style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
              <input
                type="checkbox"
                checked={keepAspect}
                onChange={() => setKeepAspect(!keepAspect)}
              />
              <span style={{ marginLeft: "6px" }}>Keep Aspect Ratio</span>
            </label>

            <label style={{ marginTop: "15px", display: "block" }}>
              Quality: {quality}%
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              style={{ width: "100%" }}
            />

            <button
              onClick={handleResize}
              style={{ marginTop: "15px" }}
              className="btn-primary"
            >
              Resize Image
            </button>
          </div>

          {resizedImage && (
            <div style={{ marginTop: "20px" }}>
              <img src={resizedImage} style={{ maxWidth: "80%" }} alt="Resized" />
              <br />
              <a
                href={resizedImage}
                download="resized-image.jpg"
                className="btn-primary"
                style={{ marginTop: "10px", display: "inline-block" }}
              >
                Download Resized
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

