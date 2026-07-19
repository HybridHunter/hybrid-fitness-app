import { useState, useEffect, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useIsMobile } from "../../hooks/useIsMobile";
import { resizeImage } from "../../components/shared/ImageUpload";

function getInitials(f, l) {
  return ((f?.[0] || "") + (l?.[0] || "")).toUpperCase();
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function MessagingView() {
  const B = useTheme();
  const isMobile = useIsMobile();
  const { currentUser, isClient } = useAuth();
  const { members } = useMembers();
  // Determine sender ID: staff uses "coach", clients use their memberId
  const myId = isClient ? currentUser?.memberId : "coach";
  const [conversations, setConversations, conversationsLoaded] = useLocalStorage("hf_messages", []);
  const [activeConvId, setActiveConvId] = useState(null);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [newMsgModal, setNewMsgModal] = useState(false);
  const [newMsgMemberId, setNewMsgMemberId] = useState("");
  const [newMsgText, setNewMsgText] = useState("");
  const [mobileShowConv, setMobileShowConv] = useState(false);
  const [inboxFilter, setInboxFilter] = useState("all"); // "all", "unread", "read"
  const [manualUnread, setManualUnread] = useState(new Set()); // conv IDs manually marked unread
  const [contextMenu, setContextMenu] = useState(null); // { convId, x, y }
  const messagesEndRef = useRef(null);
  const imgInputRef = useRef(null);
  const autoOpenProcessed = useRef(false);

  // Auto-open conversation if ?to=memberId is in URL
  useEffect(() => {
    if (autoOpenProcessed.current) return;
    const params = new URLSearchParams(window.location.search);
    const toMemberId = params.get("to");
    if (!toMemberId || !conversationsLoaded) return;

    // Find existing conversation with this member
    const existing = conversations.find(c => c.participants?.includes(toMemberId));
    if (existing) {
      autoOpenProcessed.current = true;
      setActiveConvId(existing.id);
      setMobileShowConv(true);
    } else {
      // Create a new conversation — if members aren't loaded yet, retry when they arrive
      const m = members.find(x => x.id === toMemberId);
      if (!m) return;
      autoOpenProcessed.current = true;
      const newConv = { id: crypto.randomUUID(), participants: [toMemberId], messages: [], lastActivity: new Date().toISOString() };
      setConversations(prev => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      setMobileShowConv(true);
    }
    // Clean up URL
    window.history.replaceState({}, "", window.location.pathname);
  }, [conversations, members, conversationsLoaded]);

  // Demo data initialization removed — demo data is now loaded only via Settings page

  const getMemberInfo = (memberId) => {
    const m = members.find(x => x.id === memberId);
    if (m) return { name: `${m.firstName} ${m.lastName}`, initials: getInitials(m.firstName, m.lastName), status: m.membershipStatus, photo: m.photo || "" };
    return { name: "Unknown", initials: "??", status: "inactive", photo: "" };
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  // Mark messages as read when opening a conversation
  useEffect(() => {
    if (activeConv) {
      const hasUnread = activeConv.messages.some(m => !m.read && m.senderId !== myId);
      if (hasUnread) {
        setConversations(prev => prev.map(c =>
          c.id === activeConvId
            ? { ...c, messages: c.messages.map(m => m.senderId !== myId ? { ...m, read: true } : m) }
            : c
        ));
      }
      // Clear manual unread when opening
      if (manualUnread.has(activeConvId)) {
        setManualUnread(prev => { const n = new Set(prev); n.delete(activeConvId); return n; });
      }
    }
  }, [activeConvId, activeConv?.messages?.length]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages?.length]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.messages.filter(m => !m.read && m.senderId !== myId).length, 0);

  const isUnread = (c) => manualUnread.has(c.id) || c.messages.some(m => !m.read && m.senderId !== myId);

  const sortedConversations = [...conversations].sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

  const filteredConversations = sortedConversations.filter(c => {
    // Inbox filter
    if (inboxFilter === "unread" && !isUnread(c)) return false;
    if (inboxFilter === "read" && isUnread(c)) return false;
    // Search filter
    if (!search) return true;
    const q = search.toLowerCase();
    const info = getMemberInfo(c.participants[0]);
    return info.name.toLowerCase().includes(q);
  });

  const handleSendMessage = (textArg) => {
    const content = (typeof textArg === "string" ? textArg : messageText).trim();
    if (!content || !activeConvId) return;
    const now = new Date().toISOString();
    // read means read-by-recipient — outgoing messages are born unread
    const msg = { id: crypto.randomUUID(), senderId: myId, text: content, content, timestamp: now, createdAt: now, read: false };
    setConversations(prev => prev.map(c =>
      c.id === activeConvId
        ? { ...c, messages: [...c.messages, msg], lastActivity: msg.timestamp }
        : c
    ));
    setMessageText("");
  };

  const handleNewConversation = () => {
    if (!newMsgMemberId || !newMsgText.trim()) return;
    const existing = conversations.find(c => c.participants.includes(newMsgMemberId));
    const now = new Date().toISOString();
    const msg = { id: crypto.randomUUID(), senderId: myId, text: newMsgText.trim(), content: newMsgText.trim(), timestamp: now, createdAt: now, read: false };
    if (existing) {
      setConversations(prev => prev.map(c =>
        c.id === existing.id
          ? { ...c, messages: [...c.messages, msg], lastActivity: msg.timestamp }
          : c
      ));
      setActiveConvId(existing.id);
    } else {
      const newConv = { id: crypto.randomUUID(), participants: [newMsgMemberId], messages: [msg], lastActivity: msg.timestamp };
      setConversations(prev => [...prev, newConv]);
      setActiveConvId(newConv.id);
    }
    setNewMsgModal(false);
    setNewMsgMemberId("");
    setNewMsgText("");
    setMobileShowConv(true);
  };

  const handleSelectConv = (id) => {
    setActiveConvId(id);
    setMobileShowConv(true);
  };

  const statusColors = { active: B.green, trial: B.orange, frozen: B.blue, inactive: B.red };

  const s = {
    page: { display: "flex", height: "calc(100vh - 60px)", overflow: "hidden" },
    leftPanel: { width: 340, minWidth: 280, borderRight: "1px solid " + B.border, display: "flex", flexDirection: "column", background: B.dark },
    rightPanel: { flex: 1, display: "flex", flexDirection: "column", background: B.darker },
    listHeader: { padding: "16px 16px 12px", borderBottom: "1px solid " + B.border },
    listHeaderTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title: { fontSize: 20, fontWeight: 800, color: B.text },
    newBtn: { background: B.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
    searchInput: { width: "100%", background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "9px 12px", color: B.text, fontSize: 13, outline: "none", boxSizing: "border-box" },
    convItem: (active) => ({ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: active ? B.accent + "15" : "transparent", borderLeft: active ? "3px solid " + B.accent : "3px solid transparent", transition: "background .15s" }),
    avatar: (color) => ({ width: 42, height: 42, borderRadius: "50%", background: (color || B.muted) + "22", color: color || B.muted, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }),
    convName: { fontSize: 14, fontWeight: 700, color: B.text },
    convPreview: { fontSize: 12, color: B.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 },
    convTime: { fontSize: 10, color: B.dim, whiteSpace: "nowrap" },
    unreadBadge: { minWidth: 18, height: 18, borderRadius: 9, background: B.accent, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" },
    chatHeader: { display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid " + B.border, background: B.dark },
    chatArea: { flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-end", minHeight: 0 },
    bubbleCoach: { background: B.accent, color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "9px 13px", fontSize: 13, lineHeight: 1.45, width: "fit-content", maxWidth: "100%", wordBreak: "break-word" },
    bubbleMember: { background: B.card, color: B.text, borderRadius: "16px 16px 16px 4px", padding: "9px 13px", fontSize: 13, lineHeight: 1.45, border: "1px solid " + B.border, width: "fit-content", maxWidth: "100%", wordBreak: "break-word" },
    bubbleSystem: { alignSelf: "center", background: B.border + "44", color: B.dim, borderRadius: 12, padding: "6px 14px", fontSize: 11, fontStyle: "italic" },
    bubbleTime: { fontSize: 10, color: B.dim, marginTop: 4 },
    bubbleTimeCoach: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 4, textAlign: "right" },
    inputBar: { display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderTop: "1px solid " + B.border, background: B.dark },
    inputActions: { display: "flex", gap: 2, alignItems: "center" },
    inputActionBtn: { background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: "6px", borderRadius: 8, color: B.accent, lineHeight: 1, transition: "background 0.15s" },
    msgInput: { flex: 1, background: B.darker, border: "1px solid " + B.border, borderRadius: 20, padding: "10px 16px", color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
    sendBtn: { background: B.accent, color: "#fff", border: "none", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", flexShrink: 0, transition: "opacity 0.15s" },
    quickLikeBtn: { background: "none", border: "none", fontSize: 26, cursor: "pointer", padding: 4, color: B.accent, lineHeight: 1 },
    emptyChat: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: B.dim, fontSize: 14 },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    modal: { background: B.dark, borderRadius: 14, border: "1px solid " + B.border, padding: 28, width: "min(420px, calc(100vw - 24px))", maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" },
    modalTitle: { fontSize: 18, fontWeight: 800, color: B.text, marginBottom: 18 },
    field: { marginBottom: 14 },
    label: { display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 },
    select: { width: "100%", background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "9px 12px", color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
    textarea: { width: "100%", background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "9px 12px", color: B.text, fontSize: 14, outline: "none", minHeight: 80, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" },
    modalActions: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 },
    cancelBtn: { background: "transparent", border: "1px solid " + B.border, borderRadius: 8, padding: "8px 18px", color: B.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" },
    backBtn: { background: "transparent", border: "1px solid " + B.border, borderRadius: 8, padding: "7px 12px", color: B.muted, fontSize: 13, cursor: "pointer", display: "none" },
  };

  // Mobile responsive: shared live-updating hook (declared at top of component)

  const renderConversationList = () => (
    <div style={{ ...s.leftPanel, ...(isMobile && mobileShowConv ? { display: "none" } : {}), ...(isMobile ? { width: "100%", minWidth: "100%" } : {}) }}>
      <div style={s.listHeader}>
        <div style={s.listHeaderTop}>
          <span style={s.title}>Messages</span>
          <button style={s.newBtn} onClick={() => setNewMsgModal(true)}>+ New Message</button>
        </div>
        <input style={s.searchInput} placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)} />
        {/* Inbox filter tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
          {[
            { key: "all", label: "All" },
            { key: "unread", label: `Unread (${conversations.filter(c => isUnread(c)).length})` },
            { key: "read", label: "Read" },
          ].map(f => (
            <button key={f.key} onClick={() => setInboxFilter(f.key)} style={{
              flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
              border: "1px solid " + (inboxFilter === f.key ? B.accent : B.border),
              background: inboxFilter === f.key ? B.accent + "15" : "transparent",
              color: inboxFilter === f.key ? B.accent : B.muted,
            }}>{f.label}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filteredConversations.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: B.dim, fontSize: 13 }}>
            {inboxFilter === "unread" ? "No unread conversations." : inboxFilter === "read" ? "No read conversations." : "No conversations yet."}
          </div>
        ) : (
          filteredConversations.map(c => {
            const info = getMemberInfo(c.participants[0]);
            const lastMsg = c.messages[c.messages.length - 1];
            const unreadCount = c.messages.filter(m => !m.read && m.senderId !== myId).length;
            const isMarkedUnread = manualUnread.has(c.id);
            const hasUnread = unreadCount > 0 || isMarkedUnread;
            const color = statusColors[info.status] || B.muted;
            return (
              <div key={c.id} style={s.convItem(activeConvId === c.id)} onClick={() => handleSelectConv(c.id)}
                onContextMenu={e => { e.preventDefault(); setContextMenu({ convId: c.id, x: e.clientX, y: e.clientY }); }}
                onMouseEnter={e => { if (activeConvId !== c.id) e.currentTarget.style.background = B.border + "44"; }}
                onMouseLeave={e => { if (activeConvId !== c.id) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ ...s.avatar(color), ...(info.photo ? { background: `url(${info.photo}) center/cover` } : {}) }}>{!info.photo && info.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ ...s.convName, fontWeight: hasUnread ? 800 : 600 }}>{info.name}</span>
                    <span style={s.convTime}>{timeAgo(c.lastActivity)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <span style={{ ...s.convPreview, fontWeight: hasUnread ? 600 : 400, color: hasUnread ? B.text : B.dim }}>
                      {lastMsg?.senderId === myId ? "You: " : ""}{lastMsg?.imageUrl ? "🖼️ Image" : (lastMsg?.text ?? lastMsg?.content ?? "")}
                    </span>
                    {hasUnread && <span style={s.unreadBadge}>{unreadCount || "\u2022"}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderActiveConversation = () => {
    if (!activeConv) {
      return (
        <div style={{ ...s.rightPanel, ...(isMobile && !mobileShowConv ? { display: "none" } : {}), ...(isMobile ? { width: "100%" } : {}) }}>
          <div style={s.emptyChat}>Select a conversation or start a new message</div>
        </div>
      );
    }

    const info = getMemberInfo(activeConv.participants[0]);
    const color = statusColors[info.status] || B.muted;

    return (
      <div style={{ ...s.rightPanel, ...(isMobile && !mobileShowConv ? { display: "none" } : {}), ...(isMobile ? { width: "100%" } : {}) }}>
        {/* Chat Header */}
        <div style={s.chatHeader}>
          {isMobile && (
            <button style={{ ...s.backBtn, display: "inline-flex" }} onClick={() => setMobileShowConv(false)}>&#8592;</button>
          )}
          <div style={{ ...s.avatar(color), ...(info.photo ? { background: `url(${info.photo}) center/cover` } : {}) }}>{!info.photo && info.initials}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: B.text }}>{info.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
              <span style={{ fontSize: 11, color, fontWeight: 600, textTransform: "capitalize" }}>{info.status}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={s.chatArea}>
          {activeConv.messages.map(msg => {
            const rawText = msg.text ?? msg.content ?? "";
            if (msg.senderId === "system") {
              return (
                <div key={msg.id} style={s.bubbleSystem}>{rawText}</div>
              );
            }
            const isMe = msg.senderId === myId;
            // Dedicated imageUrl field, with backward-compat parsing of legacy [img:...] text
            const legacyImg = !msg.imageUrl ? rawText.match(/\[img:(.*?)\]/) : null;
            const imageUrl = msg.imageUrl || legacyImg?.[1];
            const displayText = legacyImg ? rawText.replace(legacyImg[0], "").trim() : rawText;
            // Sender avatar: member photo for member messages, initial circle otherwise
            const sender = !isMe ? members.find(m => m.id === msg.senderId) : null;
            const senderInitial = (sender?.firstName || "M").slice(0, 1);
            return (
              <div key={msg.id} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "76%", display: "flex", gap: 8, flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end" }}>
                {!isMe && (
                  <div style={{
                    width: 26, height: 26, borderRadius: 13, flexShrink: 0,
                    background: sender?.photo ? `url(${sender.photo}) center/cover` : B.accent + "33",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, color: B.accent,
                  }}>
                    {!sender?.photo && senderInitial}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", minWidth: 0 }}>
                  <div style={isMe ? s.bubbleCoach : s.bubbleMember}>
                    {imageUrl && <img src={imageUrl} alt="" style={{ maxWidth: "100%", borderRadius: 8, display: "block", marginBottom: displayText ? 6 : 0 }} />}
                    {displayText}
                  </div>
                  <div style={isMe ? s.bubbleTimeCoach : s.bubbleTime}>
                    {formatTime(msg.timestamp ?? msg.createdAt)}
                    {isMe && msg.read && <span style={{ marginLeft: 6 }}>&#10003;&#10003;</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar — modern chat style */}
        <div style={s.inputBar}>
          <div style={s.inputActions}>
            <button style={s.inputActionBtn} title="Voice note" onClick={() => alert("Voice notes coming soon")}>
              {"\uD83C\uDF99\uFE0F"}
            </button>
            <button style={s.inputActionBtn} title="Send image" onClick={() => imgInputRef.current?.click()}>
              {"\uD83D\uDDBC\uFE0F"}
            </button>
            <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const dataUrl = await resizeImage(file);
              e.target.value = "";
              if (!activeConvId) return;
              const now = new Date().toISOString();
              const msg = { id: crypto.randomUUID(), senderId: myId, text: "", content: "", imageUrl: dataUrl, timestamp: now, createdAt: now, read: false };
              setConversations(prev => prev.map(c =>
                c.id === activeConvId
                  ? { ...c, messages: [...c.messages, msg], lastActivity: msg.timestamp }
                  : c
              ));
            }} />
            <button style={s.inputActionBtn} title="Send GIF" onClick={() => alert("GIF picker coming soon")}>
              GIF
            </button>
          </div>
          <input
            style={s.msgInput}
            placeholder="Aa"
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
          />
          <button style={s.inputActionBtn} title="Emoji" onClick={() => {
            const emojis = ["\uD83D\uDCAA", "\uD83D\uDD25", "\u2B50", "\uD83C\uDFC6", "\u2764\uFE0F", "\uD83D\uDE4C", "\uD83D\uDE0E", "\u26A1"];
            setMessageText(prev => prev + emojis[Math.floor(Math.random() * emojis.length)]);
          }}>
            {"\uD83D\uDE0A"}
          </button>
          {messageText.trim() ? (
            <button style={s.sendBtn} onClick={() => handleSendMessage()}>
              {"\u27A4"}
            </button>
          ) : (
            <button style={s.quickLikeBtn} title="Quick like" onClick={() => handleSendMessage("\uD83D\uDC4D")}>
              {"\uD83D\uDC4D"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={s.page}>
      {renderConversationList()}
      {renderActiveConversation()}

      {/* Context Menu (right-click on conversation) */}
      {contextMenu && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999 }} onClick={() => setContextMenu(null)}>
          <div style={{
            position: "absolute", left: contextMenu.x, top: contextMenu.y,
            background: B.card, border: "1px solid " + B.border, borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)", padding: 4, minWidth: 160,
          }} onClick={e => e.stopPropagation()}>
            {manualUnread.has(contextMenu.convId) || conversations.find(c => c.id === contextMenu.convId)?.messages.some(m => !m.read && m.senderId !== myId) ? (
              <button onClick={() => {
                // Mark as read (only messages from the other party — read means read-by-recipient)
                setConversations(prev => prev.map(c =>
                  c.id === contextMenu.convId ? { ...c, messages: c.messages.map(m => m.senderId !== myId ? { ...m, read: true } : m) } : c
                ));
                setManualUnread(prev => { const n = new Set(prev); n.delete(contextMenu.convId); return n; });
                setContextMenu(null);
              }} style={{ display: "block", width: "100%", padding: "8px 14px", borderRadius: 6, border: "none", background: "transparent", color: B.text, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = B.border + "44"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                Mark as Read
              </button>
            ) : (
              <button onClick={() => {
                setManualUnread(prev => new Set(prev).add(contextMenu.convId));
                setContextMenu(null);
              }} style={{ display: "block", width: "100%", padding: "8px 14px", borderRadius: 6, border: "none", background: "transparent", color: B.text, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = B.border + "44"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                Mark as Unread
              </button>
            )}
          </div>
        </div>
      )}

      {/* New Message Modal */}
      {newMsgModal && (
        <div style={s.overlay} onClick={() => setNewMsgModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>New Message</div>
            <div style={s.field}>
              <label style={s.label}>Client</label>
              <select style={s.select} value={newMsgMemberId} onChange={e => setNewMsgMemberId(e.target.value)}>
                <option value="">Select a client...</option>
                {members.filter(m => !!m.membershipPlanId).map(m => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Message</label>
              <textarea style={s.textarea} value={newMsgText} onChange={e => setNewMsgText(e.target.value)} placeholder="Type your message..." />
            </div>
            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => setNewMsgModal(false)}>Cancel</button>
              <button style={{ background: B.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }} onClick={handleNewConversation}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function useUnreadCount() {
  const [conversations] = useLocalStorage("hf_messages", []);
  const { currentUser, isClient } = useAuth();
  const id = isClient ? currentUser?.memberId : "coach";
  if (!Array.isArray(conversations)) return 0;
  return conversations.reduce((sum, c) => {
    if (!c.messages || !Array.isArray(c.messages)) return sum;
    return sum + c.messages.filter(m => !m.read && m.senderId !== id).length;
  }, 0);
}
