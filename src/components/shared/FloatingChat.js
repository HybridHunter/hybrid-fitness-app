import { useState, useEffect, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { resizeImage } from "./ImageUpload";

function getInitials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function ChatBox({ chat, onClose, onMinimize, B, conversations, setConversations }) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);
  const imgRef = useRef(null);
  const myId = "coach";

  const conv = conversations.find(c => c.participants?.includes(chat.memberId));
  const messages = conv?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark as read
  useEffect(() => {
    if (conv) {
      const hasUnread = conv.messages.some(m => !m.read && m.senderId !== myId);
      if (hasUnread) {
        setConversations(prev => prev.map(c =>
          c.id === conv.id ? { ...c, messages: c.messages.map(m => m.senderId !== myId ? { ...m, read: true } : m) } : c
        ));
      }
    }
  }, [conv?.id]);

  const send = () => {
    if (!text.trim()) return;
    const now = new Date().toISOString();
    // read means read-by-recipient — outgoing messages are born unread
    const msg = { id: crypto.randomUUID(), senderId: myId, text: text.trim(), content: text.trim(), timestamp: now, createdAt: now, read: false };
    if (conv) {
      setConversations(prev => prev.map(c =>
        c.id === conv.id ? { ...c, messages: [...c.messages, msg], lastActivity: msg.timestamp } : c
      ));
    } else {
      setConversations(prev => [...prev, {
        id: crypto.randomUUID(), participants: [chat.memberId], messages: [msg], lastActivity: msg.timestamp,
      }]);
    }
    setText("");
  };

  return (
    <div style={{
      width: 320, height: chat.minimized ? 42 : 400, borderRadius: "10px 10px 0 0",
      background: B.card, border: "1px solid " + B.border, boxShadow: "0 -4px 20px rgba(0,0,0,0.25)",
      display: "flex", flexDirection: "column", overflow: "hidden", transition: "height 0.2s",
    }}>
      {/* Header */}
      <div onClick={onMinimize} style={{
        padding: "8px 12px", background: B.accent, color: "#fff", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
          {getInitials(chat.memberName)}
        </div>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{chat.memberName}</span>
        <button onClick={e => { e.stopPropagation(); onClose(); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 16, cursor: "pointer", padding: "0 2px" }}>{"\u2715"}</button>
      </div>

      {!chat.minimized && (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            {messages.length === 0 && <div style={{ color: B.dim, fontSize: 12, textAlign: "center", padding: 20 }}>Start a conversation</div>}
            {messages.map(m => {
              const isMe = m.senderId === myId;
              const rawText = m.text ?? m.content ?? "";
              // Dedicated imageUrl field, with backward-compat parsing of legacy [img:...] text
              const legacyImg = !m.imageUrl ? rawText.match(/\[img:(.*?)\]/) : null;
              const imageUrl = m.imageUrl || legacyImg?.[1];
              const displayText = legacyImg ? rawText.replace(legacyImg[0], "").trim() : rawText;
              return (
                <div key={m.id} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                  <div style={{
                    padding: "6px 10px", borderRadius: isMe ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                    background: isMe ? B.accent : B.darker, color: isMe ? "#fff" : B.text,
                    fontSize: 13, lineHeight: 1.4, wordBreak: "break-word",
                  }}>
                    {imageUrl && <img src={imageUrl} alt="" style={{ maxWidth: "100%", borderRadius: 6, display: "block" }} />}
                    {displayText}
                  </div>
                  <div style={{ fontSize: 9, color: B.dim, marginTop: 1, textAlign: isMe ? "right" : "left" }}>{timeAgo(m.timestamp ?? m.createdAt)}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "6px 8px", borderTop: "1px solid " + B.border, display: "flex", gap: 4, alignItems: "center" }}>
            <button onClick={() => imgRef.current?.click()} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: B.accent, padding: 2 }}>{"\uD83D\uDDBC\uFE0F"}</button>
            <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const url = await resizeImage(file);
              const now = new Date().toISOString();
              const msg = { id: crypto.randomUUID(), senderId: myId, text: "", content: "", imageUrl: url, timestamp: now, createdAt: now, read: false };
              if (conv) { setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, messages: [...c.messages, msg], lastActivity: msg.timestamp } : c)); }
              else { setConversations(prev => [...prev, { id: crypto.randomUUID(), participants: [chat.memberId], messages: [msg], lastActivity: msg.timestamp }]); }
              e.target.value = "";
            }} />
            <input value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              placeholder="Aa" style={{
                flex: 1, padding: "6px 10px", borderRadius: 16, border: "1px solid " + B.border,
                background: B.darker, color: B.text, fontSize: 13, outline: "none",
              }} />
            <button onClick={send} disabled={!text.trim()} style={{
              background: text.trim() ? B.accent : B.border, border: "none", borderRadius: "50%",
              width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 14, cursor: text.trim() ? "pointer" : "default",
            }}>{"\u2191"}</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function FloatingChat() {
  const B = useTheme();
  const [openChats, setOpenChats] = useState([]); // [{ memberId, memberName, minimized }]
  const [conversations, setConversations] = useLocalStorage("hf_messages", []);

  // Listen for open-chat events from anywhere in the app
  useEffect(() => {
    const handler = (e) => {
      const { memberId, memberName } = e.detail;
      setOpenChats(prev => {
        // Already open? Just un-minimize
        const existing = prev.find(c => c.memberId === memberId);
        if (existing) return prev.map(c => c.memberId === memberId ? { ...c, minimized: false } : c);
        // Max 3 open chats
        const next = [...prev, { memberId, memberName, minimized: false }];
        return next.slice(-3);
      });
    };
    window.addEventListener("open-chat", handler);
    return () => window.removeEventListener("open-chat", handler);
  }, []);

  if (openChats.length === 0) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, right: 80, zIndex: 8000,
      display: "flex", gap: 8, alignItems: "flex-end",
    }}>
      {openChats.map(chat => (
        <ChatBox
          key={chat.memberId}
          chat={chat}
          B={B}
          conversations={conversations}
          setConversations={setConversations}
          onClose={() => setOpenChats(prev => prev.filter(c => c.memberId !== chat.memberId))}
          onMinimize={() => setOpenChats(prev => prev.map(c => c.memberId === chat.memberId ? { ...c, minimized: !c.minimized } : c))}
        />
      ))}
    </div>
  );
}
