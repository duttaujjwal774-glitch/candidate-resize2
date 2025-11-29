import React from "react";             // <- ADD THIS
import { useRef, useState } from "react";

export default function App() {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(URL.createObjectURL(file));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-10">
      <h1 className="text-3xl font-bold text-gray-800">
        Resize Photo & Signature for Govt Exams
      </h1>
      <p className="text-gray-600 my-3">Upload Photo / Signature</p>

      <button
        onClick={() => fileInputRef.current.click()}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700"
      >
        Upload Image
      </button>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {image && (
        <div className="mt-6">
          <img src={image} alt="preview" className="max-w-full max-h-96 rounded shadow-md" />
        </div>
      )}
    </div>
  );
}

