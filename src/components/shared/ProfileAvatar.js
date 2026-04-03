import { useRef } from "react";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function ProfileAvatar({ photo, name, size = 48, editable, onPhotoChange, style = {} }) {
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Resize to max 200x200 to keep data small
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 200;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        onPhotoChange?.(dataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const containerStyle = {
    width: size, height: size, borderRadius: size * 0.35,
    overflow: "hidden", position: "relative", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: editable ? "pointer" : "default",
    ...style,
  };

  if (photo) {
    return (
      <div style={containerStyle} onClick={editable ? () => fileRef.current?.click() : undefined}>
        <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {editable && (
          <>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", opacity: 0, transition: "opacity 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}>
              <span style={{ color: "#fff", fontSize: size * 0.2, fontWeight: 700 }}>Edit</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </>
        )}
      </div>
    );
  }

  // No photo — show initials
  const bg = style.background || "linear-gradient(135deg, #8fbf3b, #6a9a2d)";
  return (
    <div style={{ ...containerStyle, background: bg, color: "#fff", fontSize: size * 0.36, fontWeight: 800 }}
      onClick={editable ? () => fileRef.current?.click() : undefined}>
      {getInitials(name)}
      {editable && (
        <>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", opacity: 0, transition: "opacity 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0}>
            <span style={{ color: "#fff", fontSize: size * 0.2, fontWeight: 700 }}>Edit</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
        </>
      )}
    </div>
  );
}
