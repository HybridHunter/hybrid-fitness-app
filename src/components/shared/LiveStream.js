/*
 * LiveStream — pseudo-live streaming for a gym, no media server.
 * The broadcaster records rapid ~6s video chunks (a fresh MediaRecorder per
 * chunk so each is independently playable) and upserts the latest chunk into
 * the existing Supabase key-value store under `hf_live_stream`. Viewers poll
 * that key every 4s, queue unseen chunks by seq, and play them back-to-back
 * through two double-buffered <video> elements. Expected latency ~10-20s.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";

const SUPABASE_URL = "https://qzvxnklyeadbroesccxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM";
const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

const LIVE_KEY = "hf_live_stream";
const CHUNK_MS = 6000;            // ~6s per chunk
const POLL_MS = 4000;             // viewer poll interval
const MAX_LIVE_MS = 30 * 60 * 1000; // 30 min hard cap

function getGymId() {
  try { return localStorage.getItem("hf_gym_id") || "default"; } catch { return "default"; }
}

// Repair data URLs whose mime carries codec params (e.g. "video/mp4; codecs=a,b")
// — the raw comma breaks strict parsers like iOS Safari.
function cleanDataUrl(v) {
  if (!v || !v.startsWith("data:")) return v;
  const i = v.indexOf(";base64,");
  if (i === -1) return v;
  const mime = v.slice(5, i).split(";")[0].split(",")[0].trim();
  return `data:${mime};base64,` + v.slice(i + 8);
}

// Some legacy writers double-stringified values into the JSONB column.
function heal(v) {
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return v;
}

// Direct upsert of the live-stream row. Fire-and-forget with one retry.
async function upsertLive(value) {
  const body = JSON.stringify({
    gym_id: getGymId(), key: LIVE_KEY, value, updated_at: new Date().toISOString(),
  });
  const send = () => fetch(`${SUPABASE_URL}/rest/v1/data_store?on_conflict=gym_id,key`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal,resolution=merge-duplicates" },
    body,
  });
  try {
    const res = await send();
    if (!res.ok) throw new Error(`live upsert ${res.status}`);
  } catch {
    try { await send(); } catch {}
  }
  // Refresh the local cache so useLiveStatus banners on THIS device react
  // immediately (other devices get it from the app's global poller).
  try { localStorage.setItem(LIVE_KEY, JSON.stringify(value)); } catch {}
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const livePulseCss = `
@keyframes hfLivePulse {
  0% { opacity: 1; }
  50% { opacity: 0.35; }
  100% { opacity: 1; }
}`;

function LivePill({ pulsing }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "#ef4444", color: "#fff", borderRadius: 6,
      fontSize: 11, fontWeight: 800, letterSpacing: 0.6, padding: "3px 8px",
      animation: pulsing ? "hfLivePulse 1.6s ease-in-out infinite" : "none",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: "#fff" }} />
      LIVE
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   GoLive — broadcaster overlay
   ══════════════════════════════════════════════════════════════ */
export function GoLive({ me, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunkTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
  const tickRef = useRef(null);
  const liveRef = useRef(false);
  const seqRef = useRef(0);
  const metaRef = useRef(null);
  const [facing, setFacing] = useState("user");
  const [live, setLive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      setError("");
    } catch {
      setError("Camera unavailable — check your camera & microphone permissions and try again.");
    }
  };

  // Push one finished chunk to the store (fire-and-forget).
  const pushChunk = (dataUrl) => {
    if (!liveRef.current || !metaRef.current) return;
    seqRef.current += 1;
    upsertLive({
      active: true,
      ...metaRef.current,
      seq: seqRef.current,
      chunk: dataUrl,
      chunkAt: new Date().toISOString(),
    });
  };

  // Record ONE ~6s chunk with a brand-new MediaRecorder, then loop.
  // A fresh recorder per chunk is what makes each chunk independently playable.
  const recordLoop = () => {
    if (!liveRef.current || !streamRef.current) return;
    let rec;
    try {
      // Low bitrate so a ~6s chunk stays well under ~700KB as a data URL.
      const opts = { videoBitsPerSecond: 800_000, audioBitsPerSecond: 48_000 };
      // Prefer H.264/AAC in mp4 — the only combo that plays on EVERY device
      // (iPhones cannot play webm; Chrome's plain video/mp4 may mux VP9).
      const preferred = [
        'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4;codecs=avc1",
        "video/mp4",
        "video/webm;codecs=vp8,opus",
      ].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } });
      if (preferred) opts.mimeType = preferred;
      rec = new MediaRecorder(streamRef.current, opts);
    } catch {
      try { rec = new MediaRecorder(streamRef.current); } catch {
        setError("Live recording isn't supported on this device/browser.");
        endLive();
        return;
      }
    }
    const parts = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
    rec.onstop = () => {
      // Immediately roll into the next chunk to keep the gap tiny.
      if (liveRef.current) recordLoop();
      // Bare container mime only — codec params in a data URL break iOS.
      const blob = new Blob(parts, { type: (rec.mimeType || "video/webm").split(";")[0] });
      if (blob.size < 5000 || blob.size > 2 * 1024 * 1024) return; // empty or runaway chunk
      const reader = new FileReader();
      reader.onload = () => pushChunk(reader.result);
      reader.readAsDataURL(blob);
    };
    recorderRef.current = rec;
    try { rec.start(); } catch { return; }
    chunkTimerRef.current = setTimeout(() => {
      try { if (rec.state === "recording") rec.stop(); } catch {}
    }, CHUNK_MS);
  };

  // Uses only refs, so the mount-time cleanup closure stays valid.
  const endLive = useCallback((silent) => {
    if (!liveRef.current) return;
    liveRef.current = false;
    setLive(false);
    clearTimeout(chunkTimerRef.current);
    clearTimeout(maxTimerRef.current);
    clearInterval(tickRef.current);
    try { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); } catch {}
    upsertLive({
      active: false,
      ...(metaRef.current || {}),
      seq: seqRef.current,
      endedAt: new Date().toISOString(),
    });
    if (!silent) setNotice("");
  }, []);

  const goLive = () => {
    if (!streamRef.current || liveRef.current || error) return;
    metaRef.current = {
      hostId: me.id,
      hostName: me.name,
      hostPhoto: me.photo || "",
      title: title.trim(),
      startedAt: new Date().toISOString(),
    };
    seqRef.current = 0;
    liveRef.current = true;
    setLive(true);
    setElapsed(0);
    setNotice("");
    tickRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    maxTimerRef.current = setTimeout(() => {
      endLive(true);
      setNotice("Your live reached the 30 minute limit and was ended.");
    }, MAX_LIVE_MS);
    recordLoop();
  };

  const flip = async () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    await startStream(next);
    // Cut the in-flight chunk short so the next one records from the new camera
    // (its onstop restarts the loop against the fresh stream).
    clearTimeout(chunkTimerRef.current);
    try { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); } catch {}
  };

  useEffect(() => {
    startStream("user");
    return () => {
      endLive(true); // ending on unmount keeps viewers from waiting forever
      clearTimeout(chunkTimerRef.current);
      clearTimeout(maxTimerRef.current);
      clearInterval(tickRef.current);
      try { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); } catch {}
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 6500, background: "#000", display: "flex", flexDirection: "column" }}>
      <style>{livePulseCss}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px" }}>
        <button
          onClick={() => { endLive(true); onClose(); }}
          style={{ background: "#ffffff22", border: "none", borderRadius: 16, color: "#fff", fontSize: 14, fontWeight: 800, padding: "7px 14px", cursor: "pointer" }}
        >✕</button>
        {live && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 800, fontSize: 14 }}>
            <LivePill />
            {fmtClock(elapsed)}
          </div>
        )}
        <button
          onClick={flip}
          style={{ background: "#ffffff22", border: "none", borderRadius: 16, color: "#fff", fontSize: 16, padding: "7px 12px", cursor: "pointer" }}
        >🔄</button>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        <div style={{ position: "relative", aspectRatio: "9 / 16", height: "100%", maxWidth: "100vw", borderRadius: 12, overflow: "hidden", background: "#111" }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : "none" }}
          />
          {live && (
            <div style={{ position: "absolute", top: 10, left: 10 }}>
              <LivePill pulsing />
            </div>
          )}
          {error && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, color: "#fff", fontSize: 14, textAlign: "center", background: "#000c" }}>{error}</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 16px 26px", gap: 10 }}>
        {notice && (
          <div style={{ color: "#ffffffcc", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{notice}</div>
        )}
        {!live ? (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's this live about?"
              maxLength={80}
              style={{
                width: "100%", maxWidth: 340, boxSizing: "border-box",
                background: "#ffffff1a", color: "#fff", border: "1px solid #ffffff33",
                borderRadius: 12, padding: "11px 14px", fontSize: 14, outline: "none", textAlign: "center",
              }}
            />
            <button
              onClick={goLive}
              disabled={!!error}
              style={{
                width: "100%", maxWidth: 340, background: error ? "#555" : "#ef4444",
                border: "none", borderRadius: 14, color: "#fff", fontSize: 17, fontWeight: 800,
                padding: "14px 0", cursor: error ? "default" : "pointer", letterSpacing: 0.5,
              }}
            >● Go LIVE</button>
            <div style={{ color: "#ffffff88", fontSize: 11, fontWeight: 700, textAlign: "center" }}>
              Everyone at your gym can watch. Viewers are ~10-20s behind — that's normal.
            </div>
          </>
        ) : (
          <button
            onClick={() => { endLive(); onClose(); }}
            style={{
              width: "100%", maxWidth: 340, background: "#ffffff22", border: "1px solid #ffffff44",
              borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 800, padding: "13px 0", cursor: "pointer",
            }}
          >End Live</button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LiveViewer — watches the current live
   ══════════════════════════════════════════════════════════════ */
export function LiveViewer({ onClose }) {
  const B = useTheme();
  const vidA = useRef(null);
  const vidB = useRef(null);
  const frontRef = useRef(0);        // which video element is showing
  const playingRef = useRef(false);
  const queueRef = useRef([]);       // [{ seq, chunk }] sorted by seq
  const seenRef = useRef(new Set()); // seqs already queued/played
  const startedAtRef = useRef("");
  const mutedRef = useRef(true);
  const [front, setFront] = useState(0);
  const [waiting, setWaiting] = useState(true);   // no chunk currently playing
  const [muted, setMuted] = useState(true);
  const [info, setInfo] = useState(null);         // latest row value (host meta + active)
  const [, setTick] = useState(0);                // 1s re-render for elapsed clock

  const playNext = () => {
    const next = queueRef.current.shift();
    if (!next) {
      playingRef.current = false;
      setWaiting(true); // hold last frame + pulse until the next chunk lands
      return;
    }
    playingRef.current = true;
    setWaiting(false);
    const backIdx = 1 - frontRef.current;
    const v = backIdx === 0 ? vidA.current : vidB.current;
    if (!v) { playingRef.current = false; return; }
    v.onended = playNext;
    v.onerror = playNext; // a bad chunk shouldn't stall the stream
    v.muted = mutedRef.current;
    v.src = cleanDataUrl(next.chunk);
    frontRef.current = backIdx;
    setFront(backIdx);
    v.play().catch(() => {}); // autoplay is fine: muted by default
  };

  useEffect(() => {
    let dead = false;
    const gymId = getGymId();
    const poll = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/data_store?gym_id=eq.${encodeURIComponent(gymId)}&key=eq.${encodeURIComponent(LIVE_KEY)}&select=value`,
          { headers: HEADERS }
        );
        if (!res.ok || dead) return;
        const rows = await res.json();
        const v = heal(rows?.[0]?.value);
        if (dead) return;
        if (!v || typeof v !== "object") { setInfo({ active: false }); return; }
        setInfo(v);
        if (!v.active || !v.chunk || typeof v.seq !== "number") return;
        // New broadcast (seq restarted) — reset the queue
        if (v.startedAt && v.startedAt !== startedAtRef.current) {
          startedAtRef.current = v.startedAt;
          seenRef.current = new Set();
          queueRef.current = [];
        }
        if (seenRef.current.has(v.seq)) return;
        seenRef.current.add(v.seq);
        queueRef.current.push({ seq: v.seq, chunk: v.chunk });
        queueRef.current.sort((a, b) => a.seq - b.seq);
        // Bound latency: if we've fallen behind, skip to the freshest chunks
        if (queueRef.current.length > 3) queueRef.current = queueRef.current.slice(-2);
        if (!playingRef.current) playNext();
      } catch {}
    };
    poll();
    const pollId = setInterval(poll, POLL_MS);
    const tickId = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      dead = true;
      clearInterval(pollId);
      clearInterval(tickId);
      try { if (vidA.current) { vidA.current.onended = null; vidA.current.onerror = null; } } catch {}
      try { if (vidB.current) { vidB.current.onended = null; vidB.current.onerror = null; } } catch {}
    };
  }, []);

  const toggleMute = () => {
    setMuted(m => {
      const next = !m;
      mutedRef.current = next;
      if (vidA.current) vidA.current.muted = next;
      if (vidB.current) vidB.current.muted = next;
      return next;
    });
  };

  const active = !!info?.active;
  const ended = info != null && !active;
  const elapsedSec = active && info.startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(info.startedAt).getTime()) / 1000))
    : 0;

  const vidStyle = (idx) => ({
    position: "absolute", inset: 0, width: "100%", height: "100%",
    objectFit: "cover", opacity: front === idx ? 1 : 0,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 6400, background: "#000", display: "flex", flexDirection: "column" }}>
      <style>{livePulseCss}</style>

      {/* Header — host + title + live pill + elapsed + close */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 18, flexShrink: 0,
          background: info?.hostPhoto ? `url(${info.hostPhoto}) center/cover` : "#444",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800,
        }}>{!info?.hostPhoto && (info?.hostName || "?").slice(0, 1)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {info?.hostName || "Live"}
            </span>
            {active && <LivePill />}
            {active && <span style={{ color: "#ffffff99", fontSize: 12, fontWeight: 700 }}>{fmtClock(elapsedSec)}</span>}
          </div>
          {info?.title ? (
            <div style={{ color: "#ffffff99", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{info.title}</div>
          ) : null}
        </div>
        <button onClick={onClose} style={{ background: "#ffffff22", border: "none", borderRadius: 16, color: "#fff", fontSize: 14, fontWeight: 800, padding: "6px 14px", cursor: "pointer", flexShrink: 0 }}>✕</button>
      </div>

      {/* 9:16 frame */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        <div style={{
          position: "relative", aspectRatio: "9 / 16", height: "100%", maxWidth: "100vw", maxHeight: "100%",
          borderRadius: 12, overflow: "hidden", background: "#111",
        }}>
          <video ref={vidA} playsInline muted autoPlay preload="auto" style={vidStyle(0)} />
          <video ref={vidB} playsInline muted autoPlay preload="auto" style={vidStyle(1)} />

          {/* Buffering between chunks — hold the last frame, pulse LIVE */}
          {active && waiting && (
            <div style={{ position: "absolute", top: 10, left: 10 }}>
              <LivePill pulsing />
            </div>
          )}

          {/* Connecting (first load) */}
          {info == null && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffffbb", fontSize: 14, fontWeight: 700, animation: "hfLivePulse 1.6s ease-in-out infinite" }}>
              Connecting to live...
            </div>
          )}

          {/* Ended */}
          {ended && (
            <div style={{ position: "absolute", inset: 0, background: "#000d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 34 }}>📺</div>
              <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>The live has ended</div>
              {info?.hostName && (
                <div style={{ color: "#ffffff99", fontSize: 13 }}>
                  {info.hostName}{info.title ? ` — ${info.title}` : ""}
                </div>
              )}
              <button
                onClick={onClose}
                style={{ background: B.accent, border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 800, padding: "11px 28px", cursor: "pointer" }}
              >Close</button>
            </div>
          )}

          {/* Tap-to-unmute */}
          {active && (
            <button
              onClick={toggleMute}
              style={{
                position: "absolute", bottom: 14, right: 14, width: 38, height: 38, borderRadius: 19,
                background: "#00000088", border: "1px solid #ffffff44", color: "#fff",
                fontSize: 16, cursor: "pointer",
              }}
            >{muted ? "🔇" : "🔊"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   useLiveStatus — cheap "is someone live?" for banners/badges.
   Reads the same key through useLocalStorage; the app's global
   20s poller keeps it fresh enough for a banner.
   ══════════════════════════════════════════════════════════════ */
export function useLiveStatus() {
  const [value] = useLocalStorage(LIVE_KEY, null);
  return { live: value && value.active ? value : null };
}
