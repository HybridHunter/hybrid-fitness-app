import { useState, useEffect, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";

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

function buildDemoConversations(members) {
  if (members.length < 4) return [];
  const m0 = members[0]; // Sarah
  const m1 = members[1]; // Mike
  const m2 = members[2]; // Emily
  const m4 = members[4]; // Lisa
  const now = Date.now();
  return [
    {
      id: "demo-conv-1",
      participants: [m0.id],
      messages: [
        { id: "dm1-1", senderId: "coach", text: "Hey Sarah! Great job on your 10K this weekend. How are your legs feeling?", timestamp: new Date(now - 86400000 * 2).toISOString(), read: true },
        { id: "dm1-2", senderId: m0.id, text: "Thanks coach! A little sore in my calves but nothing major. Should I still come in tomorrow?", timestamp: new Date(now - 86400000 * 2 + 3600000).toISOString(), read: true },
        { id: "dm1-3", senderId: "coach", text: "Absolutely. We'll do a recovery session - foam rolling, light stretching, and some easy mobility work. No heavy lifting.", timestamp: new Date(now - 86400000 * 2 + 7200000).toISOString(), read: true },
        { id: "dm1-4", senderId: m0.id, text: "Sounds perfect. See you at 7am!", timestamp: new Date(now - 86400000 + 1800000).toISOString(), read: true },
        { id: "dm1-5", senderId: "coach", text: "Also, I updated your program to include more hip mobility work. Check it out when you get a chance.", timestamp: new Date(now - 3600000).toISOString(), read: false },
      ],
      lastActivity: new Date(now - 3600000).toISOString(),
    },
    {
      id: "demo-conv-2",
      participants: [m1.id],
      messages: [
        { id: "dm2-1", senderId: "coach", text: "Mike, I noticed your squat form was off yesterday. Let's work on that next session.", timestamp: new Date(now - 86400000 * 3).toISOString(), read: true },
        { id: "dm2-2", senderId: m1.id, text: "Yeah I felt like I was leaning forward a lot. Any drills I can do at home?", timestamp: new Date(now - 86400000 * 3 + 5400000).toISOString(), read: true },
        { id: "dm2-3", senderId: "coach", text: "Try goblet squats with a 3-second pause at the bottom. Do 3 sets of 8 with light weight. Focus on keeping your chest up.", timestamp: new Date(now - 86400000 * 3 + 7200000).toISOString(), read: true },
        { id: "dm2-4", senderId: m1.id, text: "Got it, I'll practice tonight. Also, can we reschedule Thursday to Friday this week?", timestamp: new Date(now - 86400000).toISOString(), read: true },
        { id: "dm2-5", senderId: "coach", text: "Friday at 6pm works. See you then!", timestamp: new Date(now - 43200000).toISOString(), read: true },
        { id: "dm2-6", senderId: m1.id, text: "Perfect, thanks!", timestamp: new Date(now - 36000000).toISOString(), read: false },
      ],
      lastActivity: new Date(now - 36000000).toISOString(),
    },
    {
      id: "demo-conv-3",
      participants: [m2.id],
      messages: [
        { id: "dm3-1", senderId: m2.id, text: "Coach, I just hit a 225lb clean and jerk! New PR!", timestamp: new Date(now - 86400000 * 5).toISOString(), read: true },
        { id: "dm3-2", senderId: "coach", text: "That's incredible Emily! All that technique work is paying off. How did it feel?", timestamp: new Date(now - 86400000 * 5 + 1800000).toISOString(), read: true },
        { id: "dm3-3", senderId: m2.id, text: "Felt smooth! The catch position was solid. I think 235 is within reach.", timestamp: new Date(now - 86400000 * 5 + 3600000).toISOString(), read: true },
        { id: "dm3-4", senderId: "coach", text: "Let's not rush it. We'll add 5lbs next week and keep building. Consistency over everything.", timestamp: new Date(now - 86400000 * 4).toISOString(), read: true },
        { id: "dm3-5", senderId: "system", text: "Coach assigned a new workout: Competition Prep Week 12", timestamp: new Date(now - 86400000 * 2).toISOString(), read: true },
      ],
      lastActivity: new Date(now - 86400000 * 2).toISOString(),
    },
    {
      id: "demo-conv-4",
      participants: [m4.id],
      messages: [
        { id: "dm4-1", senderId: "coach", text: "Hi Lisa! Welcome to your second month. How are you feeling about the program so far?", timestamp: new Date(now - 86400000 * 7).toISOString(), read: true },
        { id: "dm4-2", senderId: m4.id, text: "I'm really enjoying it! I feel stronger already. The nutrition tips have been super helpful too.", timestamp: new Date(now - 86400000 * 7 + 7200000).toISOString(), read: true },
        { id: "dm4-3", senderId: "coach", text: "That's great to hear! Remember, consistency is key. Even on days you don't feel like it, just show up and do something.", timestamp: new Date(now - 86400000 * 6).toISOString(), read: true },
        { id: "dm4-4", senderId: "system", text: "Coach assigned a new workout: Full Body Foundations B", timestamp: new Date(now - 86400000 * 4).toISOString(), read: true },
        { id: "dm4-5", senderId: m4.id, text: "Quick question - should I be sore after every workout? Sometimes I feel fine the next day and worry I'm not working hard enough.", timestamp: new Date(now - 86400000 * 1).toISOString(), read: false },
      ],
      lastActivity: new Date(now - 86400000 * 1).toISOString(),
    },
  ];
}

export default function MessagingView() {
  const B = useTheme();
  const { members } = useMembers();
  const [conversations, setConversations] = useLocalStorage("hf_messages", () => buildDemoConversations(members));
  const [activeConvId, setActiveConvId] = useState(null);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [newMsgModal, setNewMsgModal] = useState(false);
  const [newMsgMemberId, setNewMsgMemberId] = useState("");
  const [newMsgText, setNewMsgText] = useState("");
  const [mobileShowConv, setMobileShowConv] = useState(false);
  const messagesEndRef = useRef(null);

  // Initialize demo data if empty
  useEffect(() => {
    if (conversations.length === 0 && members.length >= 4) {
      setConversations(buildDemoConversations(members));
    }
  }, [members]);

  const getMemberInfo = (memberId) => {
    const m = members.find(x => x.id === memberId);
    if (m) return { name: `${m.firstName} ${m.lastName}`, initials: getInitials(m.firstName, m.lastName), status: m.membershipStatus };
    return { name: "Unknown", initials: "??", status: "inactive" };
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  // Mark messages as read when opening a conversation
  useEffect(() => {
    if (activeConv) {
      const hasUnread = activeConv.messages.some(m => !m.read && m.senderId !== "coach");
      if (hasUnread) {
        setConversations(prev => prev.map(c =>
          c.id === activeConvId
            ? { ...c, messages: c.messages.map(m => m.senderId !== "coach" ? { ...m, read: true } : m) }
            : c
        ));
      }
    }
  }, [activeConvId]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages?.length]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.messages.filter(m => !m.read && m.senderId !== "coach").length, 0);

  const sortedConversations = [...conversations].sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

  const filteredConversations = sortedConversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    const info = getMemberInfo(c.participants[0]);
    return info.name.toLowerCase().includes(q);
  });

  const handleSendMessage = () => {
    if (!messageText.trim() || !activeConvId) return;
    const msg = { id: crypto.randomUUID(), senderId: "coach", text: messageText.trim(), timestamp: new Date().toISOString(), read: true };
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
    const msg = { id: crypto.randomUUID(), senderId: "coach", text: newMsgText.trim(), timestamp: new Date().toISOString(), read: true };
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
    chatArea: { flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 8 },
    bubbleCoach: { alignSelf: "flex-end", maxWidth: "70%", background: B.accent, color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "10px 14px", fontSize: 13, lineHeight: 1.5 },
    bubbleMember: { alignSelf: "flex-start", maxWidth: "70%", background: B.card, color: B.text, borderRadius: "16px 16px 16px 4px", padding: "10px 14px", fontSize: 13, lineHeight: 1.5, border: "1px solid " + B.border },
    bubbleSystem: { alignSelf: "center", background: B.border + "44", color: B.dim, borderRadius: 12, padding: "6px 14px", fontSize: 11, fontStyle: "italic" },
    bubbleTime: { fontSize: 10, color: B.dim, marginTop: 4 },
    bubbleTimeCoach: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 4, textAlign: "right" },
    inputBar: { display: "flex", gap: 10, padding: "12px 20px", borderTop: "1px solid " + B.border, background: B.dark },
    msgInput: { flex: 1, background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "10px 14px", color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
    sendBtn: { background: B.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
    emptyChat: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: B.dim, fontSize: 14 },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    modal: { background: B.dark, borderRadius: 14, border: "1px solid " + B.border, padding: 28, width: 420, maxWidth: "92vw" },
    modalTitle: { fontSize: 18, fontWeight: 800, color: B.text, marginBottom: 18 },
    field: { marginBottom: 14 },
    label: { display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 },
    select: { width: "100%", background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "9px 12px", color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
    textarea: { width: "100%", background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "9px 12px", color: B.text, fontSize: 14, outline: "none", minHeight: 80, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" },
    modalActions: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 },
    cancelBtn: { background: "transparent", border: "1px solid " + B.border, borderRadius: 8, padding: "8px 18px", color: B.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" },
    backBtn: { background: "transparent", border: "1px solid " + B.border, borderRadius: 8, padding: "7px 12px", color: B.muted, fontSize: 13, cursor: "pointer", display: "none" },
  };

  // Mobile responsive: use CSS media query via inline check
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const renderConversationList = () => (
    <div style={{ ...s.leftPanel, ...(isMobile && mobileShowConv ? { display: "none" } : {}), ...(isMobile ? { width: "100%", minWidth: "100%" } : {}) }}>
      <div style={s.listHeader}>
        <div style={s.listHeaderTop}>
          <span style={s.title}>Messages</span>
          <button style={s.newBtn} onClick={() => setNewMsgModal(true)}>+ New Message</button>
        </div>
        <input style={s.searchInput} placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filteredConversations.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: B.dim, fontSize: 13 }}>No conversations yet.</div>
        ) : (
          filteredConversations.map(c => {
            const info = getMemberInfo(c.participants[0]);
            const lastMsg = c.messages[c.messages.length - 1];
            const unread = c.messages.filter(m => !m.read && m.senderId !== "coach").length;
            const color = statusColors[info.status] || B.muted;
            return (
              <div key={c.id} style={s.convItem(activeConvId === c.id)} onClick={() => handleSelectConv(c.id)}
                onMouseEnter={e => { if (activeConvId !== c.id) e.currentTarget.style.background = B.border + "44"; }}
                onMouseLeave={e => { if (activeConvId !== c.id) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={s.avatar(color)}>{info.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={s.convName}>{info.name}</span>
                    <span style={s.convTime}>{timeAgo(c.lastActivity)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <span style={s.convPreview}>
                      {lastMsg?.senderId === "coach" ? "You: " : ""}{lastMsg?.senderId === "system" ? lastMsg.text : (lastMsg?.text || "")}
                    </span>
                    {unread > 0 && <span style={s.unreadBadge}>{unread}</span>}
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
          <div style={s.avatar(color)}>{info.initials}</div>
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
            if (msg.senderId === "system") {
              return (
                <div key={msg.id} style={s.bubbleSystem}>{msg.text}</div>
              );
            }
            const isCoach = msg.senderId === "coach";
            return (
              <div key={msg.id} style={{ alignSelf: isCoach ? "flex-end" : "flex-start", maxWidth: "70%" }}>
                <div style={isCoach ? s.bubbleCoach : s.bubbleMember}>{msg.text}</div>
                <div style={isCoach ? s.bubbleTimeCoach : s.bubbleTime}>
                  {formatTime(msg.timestamp)}
                  {isCoach && msg.read && <span style={{ marginLeft: 6 }}>&#10003;&#10003;</span>}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={s.inputBar}>
          <input
            style={s.msgInput}
            placeholder="Type a message..."
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
          />
          <button style={s.sendBtn} onClick={handleSendMessage}>Send</button>
        </div>
      </div>
    );
  };

  return (
    <div style={s.page}>
      {renderConversationList()}
      {renderActiveConversation()}

      {/* New Message Modal */}
      {newMsgModal && (
        <div style={s.overlay} onClick={() => setNewMsgModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>New Message</div>
            <div style={s.field}>
              <label style={s.label}>Client</label>
              <select style={s.select} value={newMsgMemberId} onChange={e => setNewMsgMemberId(e.target.value)}>
                <option value="">Select a client...</option>
                {members.filter(m => m.membershipStatus !== "inactive").map(m => (
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
              <button style={s.sendBtn} onClick={handleNewConversation}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function useUnreadCount() {
  const [conversations] = useLocalStorage("hf_messages", []);
  return conversations.reduce((sum, c) => sum + c.messages.filter(m => !m.read && m.senderId !== "coach").length, 0);
}
