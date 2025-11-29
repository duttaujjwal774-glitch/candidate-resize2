import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";

export default function App() {
  const [image, setImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const onImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(URL.createObjectURL(file));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <h1 className="text-2xl font-bold text-navy-700 mb-4">
        Resize Photo & Signature for Govt Exams
      </h1>

      <label className="bg-navy-700 text-white px-4 py-2 rounded cursor-pointer mb-4">
        Upload Photo / Signature
        <input type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
      </label>

      {image && (
        <div className="relative w-full max-w-md h-80 bg-black rounded overflow-hidden">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            aspect={4 / 3}
          />
        </div>
      )}

      {!image && <p className="text-gray-600 mt-4">Upload an image to begin cropping.</p>}
    </div>
  );
}
