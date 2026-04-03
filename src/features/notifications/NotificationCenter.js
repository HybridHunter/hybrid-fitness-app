import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useNavigate } from "react-router-dom";

/* ========== constants ========== */
const TYPE_ICONS = {
  check_in: "\uD83D\uDCCD",
  payment: "\uD83D\uDCB3",
  member_join: "\uD83C\uDF89",
  waiver_signed: "\u270D\uFE0F",
  class_booked: "\uD83D\uDCC5",
  message: "\uD83D\uDCAC",
  alert: "\u26A0\uFE0F",
};

function buildDemoNotifications() {
  const now = Date.now();
  return [
    { id: crypto.randomUUID(), type: "check_in", title: "Sarah Johnson checked in", message: "Front desk check-in via PIN", timestamp: new Date(now - 2 * 60000).toISOString(), read: false, link: "/members", icon: TYPE_ICONS.check_in, _demo: true },
    { id: crypto.randomUUID(), type: "payment", title: "Payment received: $199", message: "Tom Baker \u2014 Monthly membership renewal", timestamp: new Date(now - 60 * 60000).toISOString(), read: false, link: "/billing", icon: TYPE_ICONS.payment, _demo: true },
    { id: crypto.randomUUID(), type: "member_join", title: "New member: David Martinez", message: "Signed up for a free trial week", timestamp: new Date(now - 3 * 3600000).toISOString(), read: false, link: "/members", icon: TYPE_ICONS.member_join, _demo: true },
    { id: crypto.randomUUID(), type: "waiver_signed", title: "Emily Rodriguez signed waiver", message: "Liability waiver completed and on file", timestamp: new Date(now - 26 * 3600000).toISOString(), read: false, link: "/waivers", icon: TYPE_ICONS.waiver_signed, _demo: true },
    { id: crypto.randomUUID(), type: "class_booked", title: "Mike Chen booked 6AM Semi-Private", message: "Wednesday semi-private session", timestamp: new Date(now - 28 * 3600000).toISOString(), read: true, link: "/schedule", icon: TYPE_ICONS.class_booked, _demo: true },
    { id: crypto.randomUUID(), type: "payment", title: "Payment received: $149", message: "Lisa Park \u2014 Monthly membership", timestamp: new Date(now - 48 * 3600000).toISOString(), read: true, link: "/billing", icon: TYPE_ICONS.payment, _demo: true },
    { id: crypto.randomUUID(), type: "check_in", title: "Tom Baker checked in", message: "Morning session check-in", timestamp: new Date(now - 50 * 3600000).toISOString(), read: true, link: "/members", icon: TYPE_ICONS.check_in, _demo: true },
    { id: crypto.randomUUID(), type: "alert", title: "Membership expiring soon", message: "James Williams \u2014 frozen membership expires in 5 days", timestamp: new Date(now - 72 * 3600000).toISOString(), read: true, link: "/members", icon: TYPE_ICONS.alert, _demo: true },
    { id: crypto.randomUUID(), type: "message", title: "New message from Coach Mike", message: "Updated the programming for next week", timestamp: new Date(now - 96 * 3600000).toISOString(), read: true, link: "/messaging", icon: TYPE_ICONS.message, _demo: true },
    { id: crypto.randomUUID(), type: "class_booked", title: "Emily Rodriguez booked Open Gym", message: "Saturday 9AM open gym slot", timestamp: new Date(now - 120 * 3600000).toISOString(), read: true, link: "/schedule", icon: TYPE_ICONS.class_booked, _demo: true },
  ];
}

/* ========== relative time ========== */
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + (days === 1 ? " day ago" : " days ago");
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ========== useNotifications hook ========== */
export function useNotifications() {
  const [notifications, setNotifications] = useLocalStorage("hf_notifications", []);

  const addNotification = useCallback((type, title, message, link) => {
    const n = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      link: link || null,
      icon: TYPE_ICONS[type] || "\uD83D\uDD14",
    };
    setNotifications(prev => [n, ...prev]);
    return n;
  }, [setNotifications]);

  const markRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, [setNotifications]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [setNotifications]);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, [setNotifications]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  return { notifications, addNotification, markRead, markAllRead, clearAll, unreadCount };
}

/* ========== NotificationBell ========== */
export function NotificationBell() {
  const B = useTheme();
  const { notifications, markRead, markAllRead, clearAll, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sorted = useMemo(() => [...notifications].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [notifications]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: "none", color: B.text, fontSize: 20, cursor: "pointer", padding: 4, position: "relative", lineHeight: 1 }}
        aria-label="Notifications"
      >
        &#128276;
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: 0, right: -2, minWidth: 16, height: 16, borderRadius: 8,
            background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360, maxHeight: 460,
          overflowY: "auto", background: B.card, border: "1px solid " + B.border, borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)", zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 10px", borderBottom: "1px solid " + B.border,
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: B.text }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: "none", border: "none", color: B.accent, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          {sorted.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: B.muted, fontSize: 13 }}>No notifications</div>
          )}
          {sorted.map(n => (
            <div
              key={n.id}
              style={{
                padding: "12px 16px", borderBottom: "1px solid " + B.border,
                background: n.read ? "transparent" : B.accent + "0a", cursor: "pointer",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}
              onClick={() => {
                markRead(n.id);
                if (n.link) { navigate(n.link); setOpen(false); }
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{n.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: 4, background: B.accent, flexShrink: 0 }} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: B.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title}</span>
                </div>
                <div style={{ fontSize: 12, color: B.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</div>
                <div style={{ fontSize: 11, color: B.dim, marginTop: 4 }}>{timeAgo(n.timestamp)}</div>
              </div>
            </div>
          ))}

          {/* Footer */}
          {sorted.length > 0 && (
            <div style={{ padding: "10px 16px", textAlign: "center", borderTop: "1px solid " + B.border }}>
              <button onClick={clearAll} style={{ background: "none", border: "none", color: B.muted, fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ========== NotificationPanel (standalone, for full-page view) ========== */
export function NotificationPanel() {
  const B = useTheme();
  const { notifications, markRead, markAllRead, clearAll, unreadCount } = useNotifications();
  const navigate = useNavigate();

  const sorted = useMemo(() => [...notifications].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [notifications]);

  const s = {
    badge: (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: color + "22", color }),
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: B.text }}>
          All Notifications {unreadCount > 0 && <span style={s.badge(B.accent)}>{unreadCount} unread</span>}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.text, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              Mark all read
            </button>
          )}
          {sorted.length > 0 && (
            <button onClick={clearAll} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {sorted.length === 0 && (
        <div style={{ padding: 48, textAlign: "center", color: B.muted, fontSize: 14 }}>No notifications</div>
      )}

      <div style={{ display: "grid", gap: 4 }}>
        {sorted.map(n => (
          <div
            key={n.id}
            style={{
              padding: "14px 16px", borderRadius: 10,
              background: n.read ? "transparent" : B.accent + "0a",
              border: "1px solid " + (n.read ? B.border : B.accent + "33"),
              cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start",
            }}
            onClick={() => {
              markRead(n.id);
              if (n.link) navigate(n.link);
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{n.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: 4, background: B.accent, flexShrink: 0 }} />}
                <span style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{n.title}</span>
                <span style={{ fontSize: 12, color: B.dim, marginLeft: "auto", flexShrink: 0 }}>{timeAgo(n.timestamp)}</span>
              </div>
              <div style={{ fontSize: 13, color: B.muted, marginTop: 4 }}>{n.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== Full page default export ========== */
export default function NotificationCenter() {
  const B = useTheme();
  return (
    <div style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: B.text, margin: 0 }}>Notification Center</h1>
      <p style={{ color: B.muted, fontSize: 14, marginTop: 4, marginBottom: 24 }}>All your notifications in one place.</p>
      <NotificationPanel />
    </div>
  );
}
