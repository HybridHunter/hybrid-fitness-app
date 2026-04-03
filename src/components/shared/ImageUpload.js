import { useRef } from "react";
import { useTheme } from "../../context/ThemeContext";

// Resizes image to max dimension and returns base64 data URL
function resizeImage(file, maxSize = 800) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Inline image upload button — returns base64 via onUpload callback
export default function ImageUpload({ onUpload, label, maxSize = 800, style = {}, children }) {
  const B = useTheme();
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file, maxSize);
    onUpload(dataUrl);
    e.target.value = "";
  };

  return (
    <>
      <button onClick={() => fileRef.current?.click()} style={{
        background: B.accent + "15", color: B.accent, border: "1px dashed " + B.accent + "40",
        borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
        ...style,
      }}>
        {children || label || "Upload Image"}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
    </>
  );
}

// Image upload zone with preview — used in forms
export function ImageUploadZone({ value, onChange, maxSize = 800, label }) {
  const B = useTheme();
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file, maxSize);
    onChange(dataUrl);
    e.target.value = "";
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const dataUrl = await resizeImage(file, maxSize);
    onChange(dataUrl);
  };

  if (value) {
    return (
      <div style={{ position: "relative", display: "inline-block" }}>
        <img src={value} alt="Upload" style={{ maxHeight: 180, maxWidth: "100%", borderRadius: 8, display: "block" }} />
        <button onClick={() => onChange("")} style={{
          position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
          background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", fontSize: 14,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>{"\u2715"}</button>
      </div>
    );
  }

  return (
    <div
      onClick={() => fileRef.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        border: "2px dashed " + B.border, borderRadius: 10, padding: "24px 16px",
        textAlign: "center", cursor: "pointer", background: B.darker,
        transition: "border-color 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = B.accent}
      onMouseLeave={e => e.currentTarget.style.borderColor = B.border}
    >
      <div style={{ fontSize: 28, marginBottom: 6 }}>{"\uD83D\uDCF7"}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: B.text }}>{label || "Upload Image"}</div>
      <div style={{ fontSize: 11, color: B.dim, marginTop: 4 }}>Click or drag & drop</div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
    </div>
  );
}

// Export the resize utility for direct use
export { resizeImage };
