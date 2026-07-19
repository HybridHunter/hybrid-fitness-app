/*
 * Stories — Facebook/Meta-style ephemeral stories for a gym location.
 * Coaches AND clients can post; everyone at the location sees them for 24h.
 * One tile per PERSON (their stories play in sequence, Meta-style).
 * Stored in hf_stories (whole-blob per gym): images resized, videos recorded
 * in-app (hold-to-record) or uploaded; expired stories pruned on write.
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { resizeImage } from "./ImageUpload";


// Repair data URLs whose mime carries codec params (e.g. "video/mp4; codecs=a,b")
// — the raw comma breaks strict parsers like iOS Safari.
function cleanDataUrl(v) {
  if (!v || !v.startsWith("data:")) return v;
  const i = v.indexOf(";base64,");
  if (i === -1) return v;
  const mime = v.slice(5, i).split(";")[0].split(",")[0].trim();
  return `data:${mime};base64,` + v.slice(i + 8);
}

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

/* In-app camera (Meta-style) — HOLD the button to record, release to stop.
   Live preview via getUserMedia, capture via MediaRecorder. */
function StoryCamera({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [facing, setFacing] = useState("user");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const startStream = async (face) => {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: face, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      setError("Camera unavailable — check permissions, or use the upload button instead.");
    }
  };

  useEffect(() => {
    startStream(facing);
    return () => {
      clearInterval(timerRef.current);
      try { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); } catch {}
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [facing]);

  const startRecording = () => {
    if (!streamRef.current || recording) return;
    chunksRef.current = [];
    let rec;
    try {
      const opts = { videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 64_000 };
      // Prefer H.264/AAC in mp4 — the only combo that plays on EVERY device
      // (iPhones cannot play webm; Chrome's plain video/mp4 may mux VP9).
      const preferred = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4;codecs=avc1",
        "video/mp4",
        "video/webm;codecs=vp8,opus",
      ].find(t => MediaRecorder.isTypeSupported(t));
      if (preferred) opts.mimeType = preferred;
      rec = new MediaRecorder(streamRef.current, opts);
    } catch {
      try { rec = new MediaRecorder(streamRef.current); } catch { setError("Recording not supported here — use the upload button instead."); return; }
    }
    recorderRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      clearInterval(timerRef.current);
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: (rec.mimeType || "video/webm").split(";")[0] });
      if (blob.size < 20000) return; // accidental tap — nothing meaningful recorded
      if (blob.size > 8 * 1024 * 1024) { setError("That clip is too big — keep it under ~25 seconds."); return; }
      const reader = new FileReader();
      reader.onload = () => onCapture(reader.result);
      reader.readAsDataURL(blob);
    };
    rec.start();
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= 25) { try { rec.stop(); } catch {} }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    try { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); } catch {}
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 6000, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px" }}>
        <button onClick={onClose} style={{ background: "#ffffff22", border: "none", borderRadius: 16, color: "#fff", fontSize: 14, fontWeight: 800, padding: "7px 14px", cursor: "pointer" }}>✕</button>
        {recording && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#fff", fontWeight: 800, fontSize: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: "#ef4444" }} />
            0:{String(elapsed).padStart(2, "0")} / 0:25
          </div>
        )}
        <button onClick={() => setFacing(f => (f === "user" ? "environment" : "user"))} style={{ background: "#ffffff22", border: "none", borderRadius: 16, color: "#fff", fontSize: 16, padding: "7px 12px", cursor: "pointer" }}>🔄</button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        <div style={{ position: "relative", aspectRatio: "9 / 16", height: "100%", maxWidth: "100vw", borderRadius: 12, overflow: "hidden", background: "#111" }}>
          <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : "none" }} />
          {error && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, color: "#fff", fontSize: 14, textAlign: "center", background: "#000c" }}>{error}</div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 26px", gap: 8 }}>
        <div style={{ color: "#ffffff99", fontSize: 12, fontWeight: 700 }}>
          {recording ? "Release to stop" : "Hold to record"}
        </div>
        <button
          onPointerDown={(e) => { e.preventDefault(); startRecording(); }}
          onPointerUp={stopRecording}
          onPointerLeave={() => recording && stopRecording()}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            width: 78, height: 78, borderRadius: 39, cursor: "pointer",
            border: `5px solid ${recording ? "#ef4444" : "#fff"}`, background: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            touchAction: "none", WebkitUserSelect: "none", userSelect: "none",
          }}
        >
          <div style={{
            width: recording ? 62 : 56, height: recording ? 62 : 56,
            borderRadius: recording ? 31 : 28, background: "#ef4444",
            transition: "all 0.15s",
          }} />
        </button>
      </div>
    </div>
  );
}

/* Media inside a story tile / viewer — handles image, video (with an iOS
   first-frame nudge + error fallback), and text. */
function StoryMedia({ s, cover, controlsMuted, onUnmute }) {
  const [failed, setFailed] = useState(false);
  if (s.mediaType === "image") {
    return <img src={s.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  if (s.mediaType === "video") {
    if (failed) {
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, padding: 20, textAlign: "center", background: "#111" }}>
          This video format can't play on this device. 🎬
        </div>
      );
    }
    return (
      <video
        key={s.id}
        src={cleanDataUrl(s.video)}
        autoPlay={!cover}
        playsInline
        loop
        muted={cover ? true : controlsMuted}
        preload={cover ? "metadata" : "auto"}
        // Tiles: nudge to a real first frame (poster). Active player: DON'T seek —
        // seeking in onLoadedMetadata cancels autoplay and freezes on one frame.
        onLoadedMetadata={cover ? (e) => { try { e.target.currentTime = 0.01; } catch {} } : undefined}
        onLoadedData={!cover ? (e) => { e.target.play().catch(() => {}); } : undefined}
        onCanPlay={!cover ? (e) => { e.target.play().catch(() => {}); } : undefined}
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  return null;
}

/**
 * me: { id, name, photo? } — the current person (coach or client).
 * Bar (one tile per person) + sequential viewer + composer + in-app camera.
 */
export default function StoriesBar({ me, live, onWatchLive }) {
  const B = useTheme();
  const [stories, setStories] = useLocalStorage("hf_stories", []);
  const [view, setView] = useState(null); // { g: groupIdx, i: storyIdx }
  const [composing, setComposing] = useState(false);
  const [filming, setFilming] = useState(false);
  const [text, setText] = useState("");
  const [bg, setBg] = useState(TEXT_BGS[0]);
  const [image, setImage] = useState(null);
  const [video, setVideo] = useState(null);
  const [muted, setMuted] = useState(true);
  const fileRef = useRef(null);
  const advanceTimer = useRef(null);

  // Group active stories by author — one tile per person, my group first,
  // others ordered by their newest story.
  const groups = useMemo(() => {
    const act = activeStories(stories).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const map = new Map();
    for (const s of act) {
      if (!map.has(s.authorId)) map.set(s.authorId, { authorId: s.authorId, authorName: s.authorName, authorPhoto: s.authorPhoto, stories: [] });
      const g = map.get(s.authorId);
      g.stories.push(s);
      if (s.authorPhoto) g.authorPhoto = s.authorPhoto;
    }
    const list = [...map.values()];
    list.sort((a, b) => {
      if (a.authorId === me.id) return -1;
      if (b.authorId === me.id) return 1;
      return new Date(b.stories[b.stories.length - 1].createdAt) - new Date(a.stories[a.stories.length - 1].createdAt);
    });
    return list;
  }, [stories, me.id]);

  const seenByMe = (s) => (s.views || []).includes(me.id);
  const groupUnseen = (g) => g.stories.some(s => !seenByMe(s));

  const markSeen = (s) => {
    if (!s || seenByMe(s)) return;
    setStories(prev => (Array.isArray(prev) ? prev : []).map(x =>
      x.id === s.id ? { ...x, views: [...(x.views || []), me.id] } : x));
  };

  const showStory = (g, i) => {
    const grp = groups[g];
    if (!grp || !grp.stories[i]) { closeViewer(); return; }
    setView({ g, i });
    markSeen(grp.stories[i]);
    clearTimeout(advanceTimer.current);
    const dur = grp.stories[i].mediaType === "video" ? 15000 : 6000;
    advanceTimer.current = setTimeout(() => advance(g, i), dur);
  };

  const advance = (g, i) => {
    const grp = groups[g];
    if (grp && i + 1 < grp.stories.length) return showStory(g, i + 1);
    if (g + 1 < groups.length) return showStory(g + 1, 0);
    closeViewer();
  };

  const goBack = (g, i) => {
    if (i > 0) return showStory(g, i - 1);
    if (g > 0) { const prev = groups[g - 1]; return showStory(g - 1, prev.stories.length - 1); }
  };

  const openGroup = (g) => {
    const grp = groups[g];
    const firstUnseen = grp.stories.findIndex(s => !seenByMe(s));
    showStory(g, firstUnseen === -1 ? 0 : firstUnseen);
  };

  const closeViewer = () => { clearTimeout(advanceTimer.current); setView(null); };

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

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type.startsWith("video/")) {
      if (f.size > 8 * 1024 * 1024) { alert("Video too large — keep it under 8MB (about 20-30 seconds)."); return; }
      if (/webm|mkv/i.test(f.type) && !window.confirm("Heads up: this video format (webm) won't play on iPhones. Post anyway?")) return;
      const reader = new FileReader();
      reader.onload = () => { setVideo(reader.result); setImage(null); };
      reader.onerror = () => alert("Could not read that video.");
      reader.readAsDataURL(f);
      return;
    }
    try { setImage(await resizeImage(f, 720)); setVideo(null); } catch { alert("Could not read that image."); }
  };

  const current = view ? groups[view.g] : null;
  const currentStory = current ? current.stories[view.i] : null;

  return (
    <>
      {/* ── Bar: one tile per person ── */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0 8px", scrollbarWidth: "none" }}>
        <style>{`@keyframes hfLivePulse { 0%,100% { box-shadow: 0 0 0 2px #ef4444, 0 0 6px 1px #ef444466; } 50% { box-shadow: 0 0 0 2px #ef4444, 0 0 14px 4px #ef4444aa; } }`}</style>

        {/* LIVE tile — someone is broadcasting now */}
        {live && live.hostId !== me.id && (
          <div
            onClick={() => onWatchLive && onWatchLive()}
            style={{
              minWidth: 92, width: 92, height: 140, borderRadius: 14, overflow: "hidden", cursor: "pointer",
              position: "relative", flexShrink: 0, background: "#111",
              animation: "hfLivePulse 1.8s ease-in-out infinite",
            }}
          >
            <div style={{
              position: "absolute", inset: 0,
              background: live.hostPhoto ? `url(${live.hostPhoto}) center/cover` : `linear-gradient(135deg, #7f1d1d, #ef4444)`,
              opacity: 0.9,
            }} />
            <div style={{
              position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
              background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 900,
              padding: "2px 9px", borderRadius: 8, letterSpacing: 0.5,
            }}>● LIVE</div>
            {!live.hostPhoto && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: "#fff", fontWeight: 800 }}>
                {(live.hostName || "?").slice(0, 1)}
              </div>
            )}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 8px 6px",
              background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
              color: "#fff", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {live.hostName}
            </div>
          </div>
        )}

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

        {groups.map((g, gi) => {
          const latest = g.stories[g.stories.length - 1];
          return (
            <div key={g.authorId} onClick={() => openGroup(gi)} style={{
              minWidth: 92, width: 92, height: 140, borderRadius: 14, overflow: "hidden", cursor: "pointer",
              position: "relative", flexShrink: 0,
              background: latest.mediaType === "image" ? `url(${latest.image}) center/cover` : latest.mediaType === "video" ? "#111" : latest.bg,
            }}>
              {latest.mediaType === "video" && (
                <>
                  <div style={{ position: "absolute", inset: 0 }}>
                    <StoryMedia s={latest} cover />
                  </div>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 22, textShadow: "0 1px 6px #000" }}>{"▶️"}</div>
                </>
              )}
              {/* Segment marks — one per story this person has */}
              {g.stories.length > 1 && (
                <div style={{ position: "absolute", top: 4, left: 6, right: 6, display: "flex", gap: 3 }}>
                  {g.stories.map((s, i) => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: seenByMe(s) ? "#ffffff55" : "#fff" }} />
                  ))}
                </div>
              )}
              <div style={{
                position: "absolute", top: 10, left: 8, width: 32, height: 32, borderRadius: 16,
                border: `3px solid ${groupUnseen(g) ? B.accent : "#999"}`,
                background: g.authorPhoto ? `url(${g.authorPhoto}) center/cover` : "#333",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 13, fontWeight: 800,
              }}>
                {!g.authorPhoto && (g.authorName || "?").slice(0, 1)}
              </div>
              {latest.mediaType === "text" && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 10, color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center", lineHeight: 1.3,
                }}>
                  {latest.text.slice(0, 60)}
                </div>
              )}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 8px 6px",
                background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
                color: "#fff", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {g.authorId === me.id ? "Your story" : g.authorName}
                {g.stories.length > 1 ? ` · ${g.stories.length}` : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Viewer: plays through one person's stories, then the next person ── */}
      {currentStory && (
        <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "#000", display: "flex", flexDirection: "column" }}>
          {/* Progress bars — one per story of the CURRENT person */}
          <div style={{ display: "flex", gap: 4, padding: "10px 12px 0" }}>
            {current.stories.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= view.i ? "#fff" : "#ffffff44" }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 18,
              background: currentStory.authorPhoto ? `url(${currentStory.authorPhoto}) center/cover` : "#444",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800,
            }}>{!currentStory.authorPhoto && (currentStory.authorName || "?").slice(0, 1)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{currentStory.authorName}</div>
              <div style={{ color: "#ffffff99", fontSize: 11 }}>
                {Math.max(1, Math.round((Date.now() - new Date(currentStory.createdAt).getTime()) / 3600000))}h ago
                {currentStory.authorId === me.id ? ` · 👁 ${(currentStory.views || []).filter(v => v !== me.id).length}` : ""}
              </div>
            </div>
            <button onClick={closeViewer} style={{ background: "#ffffff22", border: "none", borderRadius: 16, color: "#fff", fontSize: 14, fontWeight: 800, padding: "6px 14px", cursor: "pointer" }}>✕</button>
          </div>
          <div
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", minHeight: 0 }}
            onClick={(e) => {
              const back = e.clientX < window.innerWidth / 3;
              clearTimeout(advanceTimer.current);
              if (back) goBack(view.g, view.i);
              else advance(view.g, view.i);
            }}
          >
            {/* 9:16 story frame — media autocrops to fill it */}
            <div style={{
              position: "relative", aspectRatio: "9 / 16", height: "100%",
              maxWidth: "100vw", maxHeight: "100%", margin: "0 auto",
              background: currentStory.mediaType === "text" ? currentStory.bg : "#111",
              borderRadius: 12, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {currentStory.mediaType !== "text" && (
                <StoryMedia s={currentStory} controlsMuted={muted} />
              )}
              {currentStory.mediaType === "video" && (
                <button
                  onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
                  style={{
                    position: "absolute", bottom: 14, right: 14, width: 38, height: 38, borderRadius: 19,
                    background: "#00000088", border: "1px solid #ffffff44", color: "#fff",
                    fontSize: 16, cursor: "pointer",
                  }}
                >{muted ? "🔇" : "🔊"}</button>
              )}
              {currentStory.mediaType === "text" && (
                <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, textAlign: "center", padding: 28, lineHeight: 1.35 }}>{currentStory.text}</div>
              )}
              {currentStory.mediaType !== "text" && currentStory.text && (
                <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 16, fontWeight: 700, textShadow: "0 1px 6px #000", padding: "0 20px" }}>{currentStory.text}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── In-app camera ── */}
      {filming && (
        <StoryCamera
          onCapture={(dataUrl) => { setVideo(dataUrl); setImage(null); setFilming(false); }}
          onClose={() => setFilming(false)}
        />
      )}

      {/* ── Composer ── */}
      {composing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "#000000cc", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 380, background: B.card, borderRadius: 18, padding: 18, maxHeight: "92vh", overflowY: "auto" }}>
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
                <video src={cleanDataUrl(video)} autoPlay muted loop playsInline preload="auto" onCanPlay={(e) => e.target.play().catch(() => {})} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => setFilming(true)} style={{
                background: B.accent, border: "none", borderRadius: 10, color: "#fff",
                fontSize: 13, fontWeight: 700, padding: "9px 14px", cursor: "pointer",
              }}>🎥 Film</button>
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
