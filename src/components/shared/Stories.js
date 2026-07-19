/*
 * Stories — Facebook-style ephemeral stories for a gym location.
 * Coaches AND clients can post; everyone at the location sees them for 24h.
 * Stored in hf_stories (whole-blob per gym, like everything else): photos are
 * resized small (480px) and expired stories are pruned on every write.
 */
import { useState, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { resizeImage } from "./ImageUpload";

const DAY_MS = 24 * 60 * 60 * 1000;
const TEXT_BGS = [
  "linear-gradient(135deg,#8fbf3b,#4a7020)",
  "linear-gradient(135deg,#3b82f6,#1e3a8a)",
  "linear-gradient(135deg,#ef4444,#7f1d1d)",
  "linear-gradient(135deg,#a855f7,#4c1d95)",
  "linear-gradient(135deg,#f59e0b,#92400e)",
  "linear-gradient(135deg,#111,#444)",
];

export function activeStories(list) {
  const cutoff = Date.now() - DAY_MS;
  return (Array.isArray(list) ? list : []).filter(s => new Date(s.createdAt).getTime() > cutoff);
}

/**
 * me: { id, name, photo? } — the current person (coach or client).
 * Renders the horizontal stories bar with a create tile, the full-screen
 * viewer, and the composer.
 */
export default function StoriesBar({ me }) {
  const B = useTheme();
  const [stories, setStories] = useLocalStorage("hf_stories", []);
  const [viewing, setViewing] = useState(null); // index into active list
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [bg, setBg] = useState(TEXT_BGS[0]);
  const [image, setImage] = useState(null);
  const [video, setVideo] = useState(null);
  const [muted, setMuted] = useState(true);
  const fileRef = useRef(null);
  const advanceTimer = useRef(null);

  const active = activeStories(stories).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const post = () => {
    if (!image && !video && !text.trim()) return;
    const story = {
      id: crypto.randomUUID(),
      authorId: me.id, authorName: me.name, authorPhoto: me.photo || "",
      mediaType: video ? "video" : image ? "image" : "text",
      image: image || "", video: video || "", text: text.trim(), bg,
      createdAt: new Date().toISOString(),
      views: [],
    };
    // Prune expired while writing to keep the blob small
    setStories(prev => [...activeStories(prev), story]);
    setComposing(false);
    setText(""); setImage(null); setVideo(null); setBg(TEXT_BGS[0]);
  };

  const openStory = (idx) => {
    setViewing(idx);
    const s = active[idx];
    if (s && !(s.views || []).includes(me.id)) {
      setStories(prev => (Array.isArray(prev) ? prev : []).map(x =>
        x.id === s.id ? { ...x, views: [...(x.views || []), me.id] } : x));
    }
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      setViewing(v => {
        if (v == null) return null;
        return v + 1 < active.length ? (openStory(v + 1), v + 1) : null;
      });
    }, s?.mediaType === "video" ? 15000 : 6000);
  };
  const closeViewer = () => { clearTimeout(advanceTimer.current); setViewing(null); };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type.startsWith("video/")) {
      // Keep videos small — they live in the shared gym blob for 24h
      if (f.size > 8 * 1024 * 1024) { alert("Video too large — keep it under 8MB (about 20-30 seconds)."); return; }
      const reader = new FileReader();
      reader.onload = () => { setVideo(reader.result); setImage(null); };
      reader.onerror = () => alert("Could not read that video.");
      reader.readAsDataURL(f);
      return;
    }
    try { setImage(await resizeImage(f, 720)); setVideo(null); } catch { alert("Could not read that image."); }
  };

  const seen = (s) => (s.views || []).includes(me.id);

  return (
    <>
      {/* ── Bar ── */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0 8px", scrollbarWidth: "none" }}>
        {/* Create tile */}
        <div onClick={() => setComposing(true)} style={{
          minWidth: 92, width: 92, height: 140, borderRadius: 14, overflow: "hidden", cursor: "pointer",
          background: B.card, border: `1px solid ${B.border}`, position: "relative", flexShrink: 0,
        }}>
          <div style={{
            height: 96, background: me.photo ? `url(${me.photo}) center/cover` : `linear-gradient(135deg, ${B.accent}, ${B.accent}88)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: "#fff", fontWeight: 800,
          }}>
            {!me.photo && (me.name || "?").slice(0, 1)}
          </div>
          <div style={{
            position: "absolute", top: 82, left: "50%", transform: "translateX(-50%)",
            width: 28, height: 28, borderRadius: 14, background: B.accent, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, border: `3px solid ${B.card}`,
          }}>+</div>
          <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: B.text, marginTop: 14 }}>Create<br />story</div>
        </div>

        {active.map((s, i) => (
          <div key={s.id} onClick={() => openStory(i)} style={{
            minWidth: 92, width: 92, height: 140, borderRadius: 14, overflow: "hidden", cursor: "pointer",
            position: "relative", flexShrink: 0,
            background: s.mediaType === "image" ? `url(${s.image}) center/cover` : s.mediaType === "video" ? "#111" : s.bg,
          }}>
            {s.mediaType === "video" && (
              <>
                <video src={s.video} muted preload="metadata" playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 22, textShadow: "0 1px 6px #000" }}>{"▶️"}</div>
              </>
            )}
            <div style={{
              position: "absolute", top: 8, left: 8, width: 32, height: 32, borderRadius: 16,
              border: `3px solid ${seen(s) ? "#999" : B.accent}`,
              background: s.authorPhoto ? `url(${s.authorPhoto}) center/cover` : "#333",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 13, fontWeight: 800,
            }}>
              {!s.authorPhoto && (s.authorName || "?").slice(0, 1)}
            </div>
            {s.mediaType === "text" && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                padding: 10, color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center", lineHeight: 1.3,
              }}>
                {s.text.slice(0, 60)}
              </div>
            )}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 8px 6px",
              background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
              color: "#fff", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {s.authorId === me.id ? "Your story" : s.authorName}
            </div>
          </div>
        ))}
      </div>

      {/* ── Viewer ── */}
      {viewing != null && active[viewing] && (() => {
        const s = active[viewing];
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "#000", display: "flex", flexDirection: "column" }}>
            {/* Progress bars */}
            <div style={{ display: "flex", gap: 4, padding: "10px 12px 0" }}>
              {active.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= viewing ? "#fff" : "#ffffff44" }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 18,
                background: s.authorPhoto ? `url(${s.authorPhoto}) center/cover` : "#444",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800,
              }}>{!s.authorPhoto && (s.authorName || "?").slice(0, 1)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{s.authorName}</div>
                <div style={{ color: "#ffffff99", fontSize: 11 }}>
                  {Math.max(1, Math.round((Date.now() - new Date(s.createdAt).getTime()) / 3600000))}h ago
                  {s.authorId === me.id ? ` · 👁 ${(s.views || []).filter(v => v !== me.id).length}` : ""}
                </div>
              </div>
              <button onClick={closeViewer} style={{ background: "#ffffff22", border: "none", borderRadius: 16, color: "#fff", fontSize: 14, fontWeight: 800, padding: "6px 14px", cursor: "pointer" }}>✕</button>
            </div>
            <div
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", minHeight: 0 }}
              onClick={(e) => {
                const goBack = e.clientX < window.innerWidth / 3;
                clearTimeout(advanceTimer.current);
                if (goBack) { if (viewing > 0) openStory(viewing - 1); }
                else if (viewing + 1 < active.length) openStory(viewing + 1);
                else closeViewer();
              }}
            >
              {/* 9:16 story frame — media autocrops to fill it (like Meta stories) */}
              <div style={{
                position: "relative", aspectRatio: "9 / 16", height: "100%",
                maxWidth: "100vw", maxHeight: "100%", margin: "0 auto",
                background: s.mediaType === "text" ? s.bg : "#111",
                borderRadius: 12, overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {s.mediaType === "image" && (
                  <img src={s.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {s.mediaType === "video" && (
                  <>
                    <video
                      key={s.id}
                      src={s.video}
                      autoPlay
                      playsInline
                      loop
                      muted={muted}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
                      style={{
                        position: "absolute", bottom: 14, right: 14, width: 38, height: 38, borderRadius: 19,
                        background: "#00000088", border: "1px solid #ffffff44", color: "#fff",
                        fontSize: 16, cursor: "pointer",
                      }}
                    >{muted ? "🔇" : "🔊"}</button>
                  </>
                )}
                {s.mediaType === "text" && (
                  <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, textAlign: "center", padding: 28, lineHeight: 1.35 }}>{s.text}</div>
                )}
                {s.mediaType !== "text" && s.text && (
                  <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 16, fontWeight: 700, textShadow: "0 1px 6px #000", padding: "0 20px" }}>{s.text}</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Composer ── */}
      {composing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "#000000cc", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 380, background: B.card, borderRadius: 18, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: B.text }}>Create Story</div>
              <button onClick={() => setComposing(false)} style={{ background: "none", border: "none", color: B.muted, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {/* Preview — 9:16 like the real story */}
            <div style={{
              aspectRatio: "9 / 16", maxHeight: 340, margin: "0 auto", borderRadius: 14, overflow: "hidden", position: "relative",
              background: image ? `url(${image}) center/cover` : video ? "#111" : bg,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {video && (
                <video src={video} autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              {!image && !video && (
                <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, textAlign: "center", padding: 20, lineHeight: 1.35 }}>
                  {text || "Say something..."}
                </div>
              )}
              {(image || video) && text && (
                <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 14, fontWeight: 700, textShadow: "0 1px 6px #000", padding: "0 14px" }}>{text}</div>
              )}
            </div>

            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={(image || video) ? "Add a caption (optional)" : "Type your story..."}
              style={{
                width: "100%", boxSizing: "border-box", marginTop: 12, background: B.dark, color: B.text,
                border: `1px solid ${B.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none",
              }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
              <button onClick={() => fileRef.current?.click()} style={{
                background: B.dark, border: `1px solid ${B.border}`, borderRadius: 10, color: B.text,
                fontSize: 13, fontWeight: 700, padding: "9px 14px", cursor: "pointer",
              }}>📷 Photo / Video</button>
              {!image && !video && TEXT_BGS.map(g => (
                <div key={g} onClick={() => setBg(g)} style={{
                  width: 26, height: 26, borderRadius: 13, background: g, cursor: "pointer",
                  border: bg === g ? "2.5px solid #fff" : `2.5px solid ${B.card}`,
                  boxShadow: bg === g ? `0 0 0 2px ${B.accent}` : "none", flexShrink: 0,
                }} />
              ))}
              {(image || video) && (
                <button onClick={() => { setImage(null); setVideo(null); }} style={{ background: "none", border: "none", color: B.red || "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Remove media</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFile} />

            <button
              onClick={post}
              disabled={!image && !video && !text.trim()}
              style={{
                width: "100%", marginTop: 14, background: (image || video || text.trim()) ? B.accent : B.border,
                border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 800,
                padding: "12px 0", cursor: (image || video || text.trim()) ? "pointer" : "default",
              }}
            >Share to {`the gym`} 🚀</button>
          </div>
        </div>
      )}
    </>
  );
}
