import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useMembers } from "../../hooks/useMembers";

/* ── Default automations ─────────────────────────────────── */
const DEFAULT_AUTOMATIONS = [
  {
    id: "welcome-email",
    name: "Welcome Email",
    trigger: "New member joins",
    action: "Send welcome email",
    enabled: true,
    subject: "Welcome to {gymName}!",
    body: "Hey {firstName}, welcome to the team! We're excited to have you. Your journey starts now — let's crush it together.",
  },
  {
    id: "missed-session",
    name: "Missed Session Reminder",
    trigger: "Member hasn't checked in for 7 days",
    action: "Send reminder email",
    enabled: true,
    subject: "We miss you!",
    body: "Hey {firstName}, it's been a week since your last visit. We'd love to see you back in the gym — your consistency is what drives results!",
  },
  {
    id: "payment-reminder",
    name: "Payment Reminder",
    trigger: "Payment overdue",
    action: "Send payment reminder",
    enabled: true,
    subject: "Payment Due",
    body: "Hi {firstName}, your payment of {amount} is now overdue. Please update your billing info or contact us if you have questions.",
  },
  {
    id: "class-reminder",
    name: "Class Reminder",
    trigger: "24 hours before booked class",
    action: "Send reminder",
    enabled: true,
    subject: "See you tomorrow!",
    body: "Reminder: you're booked for {className} at {time} tomorrow. Don't forget your gear!",
  },
  {
    id: "assessment-due",
    name: "Assessment Due",
    trigger: "90 days since last assessment",
    action: "Alert coach",
    enabled: false,
    subject: "",
    body: "",
  },
  {
    id: "birthday",
    name: "Birthday",
    trigger: "Member's birthday",
    action: "Send birthday email",
    enabled: false,
    subject: "Happy Birthday, {firstName}!",
    body: "Wishing you an amazing birthday, {firstName}! Enjoy a free guest pass on us this week.",
  },
  {
    id: "waiver-expiry",
    name: "Waiver Expiry",
    trigger: "Waiver older than 1 year",
    action: "Send re-sign request",
    enabled: false,
    subject: "",
    body: "",
  },
];

const TRIGGER_OPTIONS = [
  "Member Joins",
  "Member Cancels",
  "Check-In",
  "Missed 7 Days",
  "Payment Overdue",
  "Assessment Due",
  "Class Booked",
];

const ACTION_OPTIONS = [
  "Send Email",
  "Send SMS",
  "In-App Notification",
  "Alert Coach",
];

/* ── Demo log entries ──────────────────────────────────────── */
const DEMO_LOG = [
  { id: 1, date: "2026-03-31 09:12", automation: "Welcome Email", member: "David Martinez", action: "Email sent", status: "sent" },
  { id: 2, date: "2026-03-31 08:00", automation: "Class Reminder", member: "Sarah Johnson", action: "Email sent", status: "sent" },
  { id: 3, date: "2026-03-30 18:00", automation: "Missed Session Reminder", member: "James Williams", action: "Email sent", status: "sent" },
  { id: 4, date: "2026-03-30 10:30", automation: "Payment Reminder", member: "Lisa Park", action: "Email sent", status: "pending" },
  { id: 5, date: "2026-03-29 14:00", automation: "Assessment Due", member: "Emily Rodriguez", action: "Coach alerted", status: "sent" },
  { id: 6, date: "2026-03-29 09:00", automation: "Class Reminder", member: "Tom Baker", action: "Email sent", status: "sent" },
  { id: 7, date: "2026-03-28 07:45", automation: "Welcome Email", member: "New Member (Trial)", action: "Email sent", status: "failed" },
  { id: 8, date: "2026-03-27 12:00", automation: "Missed Session Reminder", member: "Rachel Kim", action: "Email sent", status: "sent" },
  { id: 9, date: "2026-03-27 08:00", automation: "Birthday", member: "Mike Chen", action: "Email sent", status: "sent" },
  { id: 10, date: "2026-03-26 16:30", automation: "Payment Reminder", member: "Tom Baker", action: "Email sent", status: "sent" },
];

/* ── Component ──────────────────────────────────────────────── */
export default function AutomationsView() {
  const B = useTheme();
  const [automations, setAutomations] = useLocalStorage("hf_automations", DEFAULT_AUTOMATIONS);
  const [log, setLog] = useLocalStorage("hf_automation_log", DEMO_LOG);
  const [expandedId, setExpandedId] = useState(null);

  // Custom automation builder state
  const [customTrigger, setCustomTrigger] = useState(TRIGGER_OPTIONS[0]);
  const [customAction, setCustomAction] = useState(ACTION_OPTIONS[0]);
  const [customName, setCustomName] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");

  const toggleEnabled = (id) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const updateTemplate = (id, field, value) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const saveCustom = () => {
    if (!customName.trim()) return;
    const newAuto = {
      id: "custom-" + Date.now(),
      name: customName.trim(),
      trigger: customTrigger,
      action: customAction,
      enabled: true,
      subject: customAction === "Send Email" ? customSubject : "",
      body: customAction === "Send Email" ? customBody : "",
    };
    setAutomations((prev) => [...prev, newAuto]);
    setCustomName("");
    setCustomSubject("");
    setCustomBody("");
  };

  const removeAutomation = (id) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
  };

  const hasTemplate = (a) =>
    a.action.toLowerCase().includes("email") ||
    a.action.toLowerCase().includes("reminder") ||
    a.action.toLowerCase().includes("birthday") ||
    a.action.toLowerCase().includes("re-sign");

  const card = {
    background: B.card,
    borderRadius: 10,
    border: `1px solid ${B.border}`,
    padding: 16,
    marginBottom: 10,
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    border: `1px solid ${B.border}`,
    background: B.bg,
    color: B.text,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };

  const btnPrimary = {
    padding: "8px 18px",
    borderRadius: 6,
    border: "none",
    background: B.accent,
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  };

  const statusColor = (s) =>
    s === "sent" ? "#4ADE80" : s === "pending" ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <h2 style={{ color: B.text, margin: 0 }}>Automations</h2>
      <p style={{ color: B.muted, fontSize: 14, marginTop: 4, marginBottom: 24 }}>
        Set up automated actions triggered by events
      </p>

      {/* ── Automation cards ──────────────────────────── */}
      {automations.map((a) => {
        const expanded = expandedId === a.id;
        const isCustom = a.id.startsWith("custom-");
        return (
          <div key={a.id} style={card}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: hasTemplate(a) ? "pointer" : "default",
              }}
              onClick={() => hasTemplate(a) && setExpandedId(expanded ? null : a.id)}
            >
              {/* Trigger */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{a.name}</div>
                <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>{a.trigger}</div>
              </div>

              {/* Arrow */}
              <span style={{ color: B.muted, fontSize: 18, flexShrink: 0 }}>&#8594;</span>

              {/* Action */}
              <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                <div style={{ fontSize: 13, color: B.text }}>{a.action}</div>
              </div>

              {/* Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleEnabled(a.id);
                }}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: "none",
                  background: a.enabled ? B.accent : B.border,
                  position: "relative",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "background 0.2s",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: "#fff",
                    position: "absolute",
                    top: 3,
                    left: a.enabled ? 23 : 3,
                    transition: "left 0.2s",
                  }}
                />
              </button>

              {/* Remove (custom only) */}
              {isCustom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAutomation(a.id);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    fontSize: 16,
                    cursor: "pointer",
                    padding: 4,
                    flexShrink: 0,
                  }}
                  title="Remove"
                >
                  &#10005;
                </button>
              )}
            </div>

            {/* Expanded template editor */}
            {expanded && hasTemplate(a) && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B.border}` }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 4 }}>
                  Subject
                </label>
                <input
                  value={a.subject}
                  onChange={(e) => updateTemplate(a.id, "subject", e.target.value)}
                  style={{ ...inputStyle, marginBottom: 10 }}
                />
                <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 4 }}>
                  Body
                </label>
                <textarea
                  value={a.body}
                  onChange={(e) => updateTemplate(a.id, "body", e.target.value)}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                <div style={{ fontSize: 11, color: B.muted, marginTop: 6 }}>
                  Variables: {"{firstName}"} {"{gymName}"} {"{amount}"} {"{className}"} {"{time}"}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Custom Automation Builder ─────────────────── */}
      <div style={{ ...card, marginTop: 32 }}>
        <h3 style={{ color: B.text, margin: "0 0 14px" }}>Create Custom Automation</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 4 }}>
              Name
            </label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Post-Class Survey"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 4 }}>
              Trigger
            </label>
            <select
              value={customTrigger}
              onChange={(e) => setCustomTrigger(e.target.value)}
              style={inputStyle}
            >
              {TRIGGER_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 4 }}>
              Action
            </label>
            <select
              value={customAction}
              onChange={(e) => setCustomAction(e.target.value)}
              style={inputStyle}
            >
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {customAction === "Send Email" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 4 }}>
              Email Subject
            </label>
            <input
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Subject line..."
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 4 }}>
              Email Body
            </label>
            <textarea
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              rows={3}
              placeholder="Email body... use {firstName}, {gymName}, etc."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        )}

        <button onClick={saveCustom} style={btnPrimary}>
          Save Automation
        </button>
      </div>

      {/* ── Automation Log ────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ color: B.text, margin: "0 0 14px" }}>Automation Log</h3>
        <div
          style={{
            borderRadius: 10,
            border: `1px solid ${B.border}`,
            overflow: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              minWidth: 600,
            }}
          >
            <thead>
              <tr style={{ background: B.card }}>
                {["Date", "Automation", "Member", "Action", "Status"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      color: B.muted,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      borderBottom: `1px solid ${B.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: `1px solid ${B.border}` }}>
                  <td style={{ padding: "8px 12px", color: B.muted }}>{entry.date}</td>
                  <td style={{ padding: "8px 12px", color: B.text, fontWeight: 500 }}>{entry.automation}</td>
                  <td style={{ padding: "8px 12px", color: B.text }}>{entry.member}</td>
                  <td style={{ padding: "8px 12px", color: B.muted }}>{entry.action}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        background: statusColor(entry.status) + "22",
                        color: statusColor(entry.status),
                        textTransform: "capitalize",
                      }}
                    >
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
