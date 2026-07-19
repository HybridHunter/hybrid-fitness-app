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
const PRESENCE_KEY = "hf_live_presence"; // { [viewerId]: lastSeenEpochMs }
const CHAT_KEY = "hf_live_chat";         // [{ id, authorId, authorName, text, at }]
const REACTIONS_KEY = "hf_live_reactions"; // [{ id, emoji, at, byId }]
const POSTS_KEY = "hf_community_posts";  // community feed array (shared w/ app)
const CHUNK_MS = 6000;            // ~6s per chunk
const POLL_MS = 4000;             // viewer poll interval
const PRESENCE_MS = 4000;         // viewer heartbeat + count poll interval
const PRESENCE_STALE_MS = 12000;  // an entry older than this isn't "watching"
const CHAT_POLL_MS = 3000;        // chat poll interval
const CHAT_MAX = 60;              // stored message cap
const REACTIONS_POLL_MS = 1200;  // reaction poll interval (both sides)
const REACTIONS_MAX = 80;        // stored reaction cap
const REACTION_LIFE_MS = 4000;   // how long a float lives on screen
const REACTION_EMOJIS = ["❤️", "🔥", "💪", "👏", "😂"];
const MAX_LIVE_MS = 30 * 60 * 1000; // 30 min hard cap
const REPLAY_CAP_BYTES = 12 * 1024 * 1024; // ~12MB accumulated-chunk cap
const REPLAY_TTL_MS = 14 * 24 * 60 * 60 * 1000; // replay posts expire in 14 days

function newId() {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch {}
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

// Direct upsert of any data_store row. Fire-and-forget with one retry.
async function upsertKey(key, value) {
  const body = JSON.stringify({
    gym_id: getGymId(), key, value, updated_at: new Date().toISOString(),
  });
  const send = () => fetch(`${SUPABASE_URL}/rest/v1/data_store?on_conflict=gym_id,key`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal,resolution=merge-duplicates" },
    body,
  });
  try {
    const res = await send();
    if (!res.ok) throw new Error(`upsert ${key} ${res.status}`);
  } catch {
    try { await send(); } catch {}
  }
}

// Read one data_store value (healed). Returns null on any failure.
async function fetchKey(key) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/data_store?gym_id=eq.${encodeURIComponent(getGymId())}&key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: HEADERS }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return heal(rows?.[0]?.value);
  } catch { return null; }
}

// Live-stream row + local-cache refresh so useLiveStatus banners on THIS device
// react immediately (other devices get it from the app's global poller).
async function upsertLive(value) {
  await upsertKey(LIVE_KEY, value);
  try { localStorage.setItem(LIVE_KEY, JSON.stringify(value)); } catch {}
}

// Count presence entries seen within the freshness window.
function countWatching(presence) {
  if (!presence || typeof presence !== "object") return 0;
  const now = Date.now();
  return Object.values(presence).filter(
    (ts) => typeof ts === "number" && now - ts < PRESENCE_STALE_MS
  ).length;
}

// Append a chat message (last-write-wins read-modify-write, pruned to CHAT_MAX).
async function sendChatMessage(me, text) {
  const t = (text || "").trim();
  if (!t) return;
  const current = await fetchKey(CHAT_KEY);
  const arr = Array.isArray(current) ? current : [];
  arr.push({
    id: newId(),
    authorId: me?.id || "anon",
    authorName: me?.name || "Viewer",
    text: t.slice(0, 300),
    at: Date.now(),
  });
  await upsertKey(CHAT_KEY, arr.slice(-CHAT_MAX));
}

// Append one reaction (read-modify-write, pruned to REACTIONS_MAX). Returns the
// reaction record so the caller can optimistically float it without waiting.
async function sendReaction(myId, emoji) {
  const rec = { id: newId(), emoji, at: Date.now(), byId: myId || "anon" };
  const current = await fetchKey(REACTIONS_KEY);
  const arr = Array.isArray(current) ? current : [];
  arr.push(rec);
  await upsertKey(REACTIONS_KEY, arr.slice(-REACTIONS_MAX));
  return rec;
}

// Tally a reactions array into a { emoji: count } breakdown.
function tallyReactions(list) {
  const out = {};
  if (!Array.isArray(list)) return out;
  for (const r of list) {
    if (!r || !r.emoji) continue;
    out[r.emoji] = (out[r.emoji] || 0) + 1;
  }
  return out;
}

/* Remove expired live-replay posts. Exported so the feed reader can purge on
   read. Non-replay posts (and anything without a valid expiresAt) pass through. */
export function pruneExpiredReplays(posts) {
  if (!Array.isArray(posts)) return posts;
  const now = Date.now();
  return posts.filter((p) => {
    if (!p || !p.isLiveReplay || !p.expiresAt) return true;
    const t = new Date(p.expiresAt).getTime();
    return isNaN(t) || t > now;
  });
}

/* Poll the live viewer count (both broadcaster & viewer use this). */
function useWatchingCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let dead = false;
    const poll = async () => {
      const v = await fetchKey(PRESENCE_KEY);
      if (!dead) setCount(countWatching(v));
    };
    poll();
    const id = setInterval(poll, PRESENCE_MS);
    return () => { dead = true; clearInterval(id); };
  }, []);
  return count;
}

/* Poll the live chat (both sides). Returns the message array. */
function useLiveChat() {
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    let dead = false;
    const poll = async () => {
      const v = await fetchKey(CHAT_KEY);
      if (!dead) setMessages(Array.isArray(v) ? v : []);
    };
    poll();
    const id = setInterval(poll, CHAT_POLL_MS);
    return () => { dead = true; clearInterval(id); };
  }, []);
  return messages;
}

/* Poll live reactions (both sides) and drive the floating animation.
   Reactions seen in the last ~4s spawn a float; new ones are deduped by their
   reaction id via a seen-set ref so a reaction floats exactly once. Returns the
   active floats plus spawnLocal() for optimistic (own-tap) floats. */
function useLiveReactions() {
  const [floats, setFloats] = useState([]); // [{ key, emoji, x }]
  const seenRef = useRef(new Set());
  const timersRef = useRef([]);

  const spawn = useCallback((emoji) => {
    const key = newId();
    const x = 8 + Math.random() * 64; // 8-72% from left
    setFloats((f) => [...f, { key, emoji, x }]);
    const t = setTimeout(() => {
      setFloats((f) => f.filter((fl) => fl.key !== key));
    }, REACTION_LIFE_MS);
    timersRef.current.push(t);
  }, []);

  useEffect(() => {
    let dead = false;
    const poll = async () => {
      const v = await fetchKey(REACTIONS_KEY);
      if (dead || !Array.isArray(v)) return;
      const cutoff = Date.now() - REACTION_LIFE_MS;
      for (const r of v) {
        if (!r || !r.id || !r.emoji) continue;
        if (seenRef.current.has(r.id)) continue;
        seenRef.current.add(r.id);
        // Only float ones recent enough to still be alive (skip backlog).
        if (typeof r.at === "number" && r.at >= cutoff) spawn(r.emoji);
      }
      // Keep the seen-set from growing unbounded across a long broadcast.
      if (seenRef.current.size > 400) {
        seenRef.current = new Set(v.map((r) => r && r.id).filter(Boolean));
      }
    };
    poll();
    const id = setInterval(poll, REACTIONS_POLL_MS);
    return () => {
      dead = true;
      clearInterval(id);
      timersRef.current.forEach(clearTimeout);
    };
  }, [spawn]);

  return { floats, spawnLocal: spawn };
}

const reactionFloatCss = `
@keyframes hfReactionFloat {
  0%   { transform: translateY(0) translateX(0); opacity: 1; }
  100% { transform: translateY(-320px) translateX(24px); opacity: 0; }
}`;

/* Absolutely-positioned floating emoji layer, rendered inside the 9:16 frame. */
function ReactionFloats({ floats }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 }}>
      {floats.map((f) => (
        <span
          key={f.key}
          style={{
            position: "absolute", bottom: 70, left: `${f.x}%`, fontSize: 30, lineHeight: 1,
            animation: "hfReactionFloat 4s ease-out forwards",
          }}
        >{f.emoji}</span>
      ))}
    </div>
  );
}

/* Tappable emoji reaction bar, bottom-right of the frame. Spammable — every tap
   sends one reaction and optimistically spawns its own float immediately. */
function ReactionBar({ myId, onLocal }) {
  const tap = (emoji) => {
    onLocal(emoji);          // instant local float (don't wait for the poll)
    sendReaction(myId, emoji); // fire-and-forget append (retry-once inside upsertKey)
  };
  return (
    <div style={{
      position: "absolute", right: 10, bottom: 58, display: "flex", flexDirection: "column", gap: 6, zIndex: 6,
    }}>
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => tap(emoji)}
          style={{
            width: 40, height: 40, borderRadius: 20, background: "#ffffff22", border: "1px solid #ffffff33",
            fontSize: 20, lineHeight: 1, cursor: "pointer", padding: 0,
          }}
        >{emoji}</button>
      ))}
    </div>
  );
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

function WatchingPill({ count }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "#ffffff22", color: "#fff", borderRadius: 6,
      fontSize: 12, fontWeight: 700, padding: "3px 8px", whiteSpace: "nowrap",
    }}>
      👁 {count} watching
    </span>
  );
}

/* Chat overlay pinned bottom-left of the 9:16 frame + a send bar at the very
   bottom. Shared by broadcaster and viewer. `rightInset` clears the viewer's
   mute button so the input doesn't slide under it. */
function ChatOverlay({ me, messages, accent, rightInset = 10 }) {
  const [draft, setDraft] = useState("");
  const scRef = useRef(null);
  const last = messages.slice(-6);
  useEffect(() => {
    if (scRef.current) scRef.current.scrollTop = scRef.current.scrollHeight;
  }, [messages.length]);
  const submit = (e) => {
    if (e) e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    sendChatMessage(me, t); // append + prune to 60, direct upsert (last-write-wins)
  };
  return (
    <>
      <div
        ref={scRef}
        style={{
          position: "absolute", left: 10, bottom: 58, width: "72%", maxHeight: "42%",
          overflowY: "auto", display: "flex", flexDirection: "column", gap: 5,
          pointerEvents: "none",
        }}
      >
        {last.map((m) => (
          <div key={m.id} style={{
            alignSelf: "flex-start", maxWidth: "100%", background: "#00000066",
            borderRadius: 10, padding: "5px 9px", fontSize: 12, lineHeight: 1.35, color: "#fff",
          }}>
            <span style={{ fontWeight: 800, color: accent }}>{m.authorName}</span>{" "}
            <span style={{ color: "#ffffffe6", wordBreak: "break-word" }}>{m.text}</span>
          </div>
        ))}
      </div>
      <form
        onSubmit={submit}
        style={{ position: "absolute", left: 10, right: rightInset, bottom: 12, display: "flex", gap: 6 }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something…"
          maxLength={300}
          style={{
            flex: 1, minWidth: 0, boxSizing: "border-box", background: "#00000088", color: "#fff",
            border: "1px solid #ffffff33", borderRadius: 18, padding: "8px 14px", fontSize: 13, outline: "none",
          }}
        />
        <button type="submit" style={{
          background: "#ef4444", border: "none", borderRadius: 18, color: "#fff",
          fontSize: 13, fontWeight: 800, padding: "0 14px", cursor: "pointer", flexShrink: 0,
        }}>Send</button>
      </form>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   GoLive — broadcaster overlay
   ══════════════════════════════════════════════════════════════ */
export function GoLive({ me, onClose }) {
  const B = useTheme();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunkTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
  const tickRef = useRef(null);
  const liveRef = useRef(false);
  const seqRef = useRef(0);
  const metaRef = useRef(null);
  const chunksRef = useRef([]);        // accumulated chunk dataURLs for replay
  const truncatedRef = useRef(false);  // dropped oldest chunks past the size cap
  const watching = useWatchingCount();
  const chatMessages = useLiveChat();
  const { floats } = useLiveReactions(); // broadcaster sees viewers' reactions float too
  const [facing, setFacing] = useState("user");
  const [live, setLive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState(false); // post-or-discard screen after ending
  const [busy, setBusy] = useState(false);

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

  // Push one finished chunk to the store (fire-and-forget) + retain for replay.
  const pushChunk = (dataUrl) => {
    if (!liveRef.current || !metaRef.current) return;
    seqRef.current += 1;
    // Accumulate for the optional replay, dropping oldest past the ~12MB cap.
    chunksRef.current.push(dataUrl);
    let total = chunksRef.current.reduce((s, c) => s + c.length * 0.75, 0);
    while (chunksRef.current.length > 1 && total > REPLAY_CAP_BYTES) {
      const removed = chunksRef.current.shift();
      total -= removed.length * 0.75;
      truncatedRef.current = true;
    }
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
      // Low bitrate so a ~6s chunk stays small as a data URL (~30% smaller than
      // before while staying watchable at phone size).
      const opts = { videoBitsPerSecond: 600_000, audioBitsPerSecond: 40_000 };
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
    chunksRef.current = [];
    truncatedRef.current = false;
    // Fresh presence/chat/reactions for this broadcast.
    upsertKey(PRESENCE_KEY, {});
    upsertKey(CHAT_KEY, []);
    upsertKey(REACTIONS_KEY, []);
    liveRef.current = true;
    setLive(true);
    setElapsed(0);
    setNotice("");
    tickRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    maxTimerRef.current = setTimeout(() => {
      endLive(true);
      setNotice("Your live reached the 30 minute limit and was ended.");
      setReview(true);
    }, MAX_LIVE_MS);
    recordLoop();
  };

  // Post-or-discard helpers (used by the review screen).
  const resetLivePeripherals = () => {
    upsertKey(PRESENCE_KEY, {});
    upsertKey(CHAT_KEY, []);
    upsertKey(REACTIONS_KEY, []);
  };

  const discardLive = async () => {
    if (busy) return;
    setBusy(true);
    await upsertLive({ active: false }); // clears the chunk for viewers
    resetLivePeripherals();
    onClose();
  };

  const postReplay = async () => {
    if (busy) return;
    setBusy(true);
    const meta = metaRef.current || {};
    const lastChunk = chunksRef.current[chunksRef.current.length - 1] || "";
    const now = new Date();
    // Tally the reactions this live earned so the replay shows the love it got.
    const reactionList = await fetchKey(REACTIONS_KEY);
    const reactions = tallyReactions(reactionList);
    const totalReactions = Object.values(reactions).reduce((s, n) => s + n, 0);
    // The feed counts likes by array length, so seed placeholder ids to match.
    const likes = Array.from({ length: totalReactions }, (_, i) => `live_react_${i}`);
    const post = {
      id: newId(),
      authorId: me.id,
      authorName: me.name,
      content: (meta.title && meta.title.trim()) || "Live replay",
      category: "General",
      createdAt: now.toISOString(),
      likes,
      comments: [],
      reactions,
      mediaType: "video",
      mediaUrl: cleanDataUrl(lastChunk),
      note: truncatedRef.current
        ? "🔴 Live replay — preview clip only (final ~6s; earlier footage exceeded the size cap)."
        : "🔴 Live replay — preview clip (final ~6s of the broadcast).",
      isLiveReplay: true,
      expiresAt: new Date(now.getTime() + REPLAY_TTL_MS).toISOString(),
    };
    const current = await fetchKey(POSTS_KEY);
    const arr = Array.isArray(current) ? current : [];
    arr.unshift(post);
    await upsertKey(POSTS_KEY, arr);
    await upsertLive({ active: false }); // clear the live key
    resetLivePeripherals();
    onClose();
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
      <style>{livePulseCss + reactionFloatCss}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px" }}>
        <button
          onClick={() => { endLive(true); onClose(); }}
          style={{ background: "#ffffff22", border: "none", borderRadius: 16, color: "#fff", fontSize: 14, fontWeight: 800, padding: "7px 14px", cursor: "pointer" }}
        >✕</button>
        {live && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 800, fontSize: 14 }}>
            <LivePill />
            {fmtClock(elapsed)}
            <WatchingPill count={watching} />
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
          {live && (
            <ChatOverlay me={me} messages={chatMessages} accent={B.accent} rightInset={10} />
          )}
          {live && <ReactionFloats floats={floats} />}
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
            onClick={() => { endLive(); setReview(true); }}
            style={{
              width: "100%", maxWidth: 340, background: "#ffffff22", border: "1px solid #ffffff44",
              borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 800, padding: "13px 0", cursor: "pointer",
            }}
          >End Live</button>
        )}
      </div>

      {/* Post-or-discard review screen */}
      {review && (
        <div style={{
          position: "absolute", inset: 0, background: "#000e", zIndex: 10,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 14, padding: 28, textAlign: "center",
        }}>
          <div style={{ fontSize: 34 }}>🔴</div>
          <div style={{ color: "#fff", fontSize: 19, fontWeight: 800 }}>Your live has ended</div>
          <div style={{ color: "#ffffff99", fontSize: 13, maxWidth: 320 }}>
            Post a replay to your gym's feed, or discard it. The replay is a short preview clip and expires in 14 days.
          </div>
          <button
            onClick={postReplay}
            disabled={busy}
            style={{
              width: "100%", maxWidth: 320, background: "#ef4444", border: "none", borderRadius: 14,
              color: "#fff", fontSize: 16, fontWeight: 800, padding: "13px 0", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
            }}
          >{busy ? "Posting…" : "Post replay"}</button>
          <button
            onClick={discardLive}
            disabled={busy}
            style={{
              width: "100%", maxWidth: 320, background: "#ffffff22", border: "1px solid #ffffff44", borderRadius: 14,
              color: "#fff", fontSize: 15, fontWeight: 800, padding: "12px 0", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
            }}
          >Discard</button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LiveViewer — watches the current live
   ══════════════════════════════════════════════════════════════ */
export function LiveViewer({ me, onClose }) {
  const B = useTheme();
  const vidA = useRef(null);
  const vidB = useRef(null);
  const frontRef = useRef(0);        // which video element is showing
  const playingRef = useRef(false);
  const queueRef = useRef([]);       // [{ seq, chunk }] sorted by seq
  const seenRef = useRef(new Set()); // seqs already queued/played
  const startedAtRef = useRef("");
  const mutedRef = useRef(true);
  const myIdRef = useRef(null);      // stable per-session presence id
  if (!myIdRef.current) myIdRef.current = newId();
  const watching = useWatchingCount();
  const chatMessages = useLiveChat();
  const { floats, spawnLocal } = useLiveReactions();
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

  // Presence heartbeat: write my lastSeen every 4s; best-effort remove on close.
  useEffect(() => {
    const myId = myIdRef.current;
    let dead = false;
    const beat = async () => {
      const v = await fetchKey(PRESENCE_KEY);
      if (dead) return;
      const now = Date.now();
      const obj = v && typeof v === "object" ? { ...v } : {};
      // Drop very stale entries while we're writing to keep the row small.
      for (const k of Object.keys(obj)) {
        if (typeof obj[k] !== "number" || now - obj[k] > PRESENCE_STALE_MS * 3) delete obj[k];
      }
      obj[myId] = now;
      await upsertKey(PRESENCE_KEY, obj);
    };
    beat();
    const id = setInterval(beat, PRESENCE_MS);
    return () => {
      dead = true;
      clearInterval(id);
      (async () => {
        const v = await fetchKey(PRESENCE_KEY);
        if (v && typeof v === "object") {
          const obj = { ...v };
          delete obj[myId];
          upsertKey(PRESENCE_KEY, obj);
        }
      })();
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
      <style>{livePulseCss + reactionFloatCss}</style>

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
            {active && <WatchingPill count={watching} />}
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

          {/* Live chat overlay + send bar (rightInset clears the mute button) */}
          {active && (
            <ChatOverlay me={me} messages={chatMessages} accent={B.accent} rightInset={58} />
          )}

          {/* Floating reactions + tappable reaction bar */}
          {active && <ReactionFloats floats={floats} />}
          {active && <ReactionBar myId={myIdRef.current} onLocal={spawnLocal} />}
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
