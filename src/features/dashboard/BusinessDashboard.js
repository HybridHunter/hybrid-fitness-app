import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useMembershipEvents } from "../../hooks/useMembershipEvents";
import Card from "../../components/ui/Card";

/* ========== helpers ========== */
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDollar(n) {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "0%";
  return Number(n).toFixed(1) + "%";
}

function pctChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function daysBetween(d1, d2) {
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function periodKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function inRange(iso, start, end) {
  if (!iso) return false;
  const d = new Date(iso);
  return d >= start && d <= end;
}

function periodRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

function priorPeriod(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return periodKey(d);
}

function fmtDate(iso) {
  if (!iso) return "--";
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/* ========== Avatar ========== */
function Avatar({ name, size = 36, B }) {
  const initials = (name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: B.accent + "25", color: B.accent,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
    }}>{initials}</div>
  );
}

/* ========== Inline Editable Number (for Ad Spend only) ========== */
function EditableNumber({ value, onChange, prefix = "", suffix = "", style = {} }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(parsed);
    else setDraft(String(value));
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setDraft(String(value)); } }}
        style={{
          fontSize: "inherit", fontWeight: "inherit", color: "inherit",
          background: "transparent", border: "1px solid #8fbf3b",
          borderRadius: 4, outline: "none", width: "100%",
          padding: "2px 4px", textAlign: "center", ...style,
        }}
      />
    );
  }

  const display = prefix
    ? prefix + Number(value).toLocaleString("en-US", { minimumFractionDigits: value % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })
    : Number(value).toLocaleString("en-US", { minimumFractionDigits: value % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 });

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to edit"
      style={{ cursor: "pointer", borderBottom: "1px dashed rgba(128,128,128,0.3)", ...style }}
    >
      {display}{suffix}
    </span>
  );
}

/* ========== Change Indicator ========== */
function ChangeIndicator({ current, previous, invert = false }) {
  const pct = pctChange(current, previous);
  if (pct === 0) return null;
  const positive = invert ? pct < 0 : pct > 0;
  const color = positive ? "#22c55e" : "#ef4444";
  const arrow = pct > 0 ? "\u25B2" : "\u25BC";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: 6 }}>
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* ========== Alert Card ========== */
function AlertCard({ member, reason, severity, planName, onSendMessage, onDismiss, onClickMember, B }) {
  const name = `${member.firstName} ${member.lastName}`;
  const sevColor = severity === "red" ? B.red : B.orange;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
      borderRadius: 10, border: "1px solid " + sevColor + "40", background: sevColor + "08",
      marginBottom: 8, transition: "all 0.15s",
    }}>
      <div style={{ width: 4, height: 40, borderRadius: 2, background: sevColor, flexShrink: 0 }} />
      <Avatar name={name} size={36} B={B} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={onClickMember}
          style={{ fontSize: 13, fontWeight: 700, color: B.text, cursor: "pointer", textDecoration: "none" }}
          onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
          onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
        >{name}</div>
        <div style={{ fontSize: 11, color: B.dim, marginTop: 2 }}>{reason}</div>
        {planName && <div style={{ fontSize: 10, color: B.muted, marginTop: 1 }}>{planName}</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          onClick={onSendMessage}
          style={{
            padding: "5px 10px", borderRadius: 6, border: "1px solid " + B.border,
            background: B.accent + "15", color: B.accent, fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}
        >Send Message</button>
        <button
          onClick={onDismiss}
          style={{
            padding: "5px 10px", borderRadius: 6, border: "1px solid " + B.border,
            background: "transparent", color: B.dim, fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}
        >Dismiss</button>
      </div>
    </div>
  );
}

/* ========== Member Engagement Alerts ========== */
function MemberEngagementAlerts({ members, attendance, plans, B, navigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useLocalStorage("hf_dismissed_alerts", []);

  const dismissAlert = (alertKey) => {
    setDismissedAlerts(prev => [...prev, alertKey]);
  };

  const alerts = useMemo(() => {
    const now = new Date();
    const result = [];
    const activeMembers = members.filter(m => m.membershipStatus === "active" || m.membershipStatus === "trial");

    activeMembers.forEach(m => {
      const alertKey = `noshow_${m.id}`;
      if (dismissedAlerts.includes(alertKey)) return;
      const memberCheckins = attendance.filter(a => a.memberId === m.id);
      const plan = plans.find(p => p.id === m.membershipPlanId);
      if (memberCheckins.length === 0) {
        result.push({ type: "noshow", member: m, reason: "Never checked in", planName: plan ? plan.name : "No plan assigned", severity: "red", sortWeight: 999, alertKey });
      } else {
        const lastCheckin = memberCheckins.reduce((latest, a) => {
          const t = new Date(a.checkInTime).getTime();
          return t > latest ? t : latest;
        }, 0);
        const daysAgo = daysBetween(new Date(lastCheckin), now);
        if (daysAgo >= 7) {
          result.push({ type: "noshow", member: m, reason: `Last seen ${daysAgo} days ago`, planName: plan ? plan.name : "No plan assigned", severity: "red", sortWeight: daysAgo, alertKey });
        }
      }
    });

    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    activeMembers.forEach(m => {
      const plan = plans.find(p => p.id === m.membershipPlanId);
      if (!plan || plan.sessionsIncluded == null) return;
      const alertKey = `unused_${m.id}`;
      if (dismissedAlerts.includes(alertKey)) return;
      const expectedIn14Days = Math.round((plan.sessionsIncluded / 4) * 2);
      const actualIn14Days = attendance.filter(a =>
        a.memberId === m.id && new Date(a.checkInTime) >= fourteenDaysAgo
      ).length;
      if (actualIn14Days < expectedIn14Days) {
        const shortfall = expectedIn14Days - actualIn14Days;
        const severity = shortfall >= 3 ? "red" : "orange";
        result.push({ type: "unused", member: m, reason: `Used ${actualIn14Days} of ${expectedIn14Days} expected sessions (${shortfall} short)`, planName: plan.name, severity, sortWeight: shortfall, alertKey });
      }
    });

    result.sort((a, b) => {
      if (a.severity === "red" && b.severity !== "red") return -1;
      if (a.severity !== "red" && b.severity === "red") return 1;
      return b.sortWeight - a.sortWeight;
    });
    return result;
  }, [members, attendance, plans, dismissedAlerts]);

  const noshowAlerts = alerts.filter(a => a.type === "noshow");
  const unusedAlerts = alerts.filter(a => a.type === "unused");

  if (alerts.length === 0) return null;

  return (
    <Card style={{ padding: 0, marginBottom: 20, overflow: "hidden" }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", cursor: "pointer", background: B.red + "08",
          borderBottom: collapsed ? "none" : "1px solid " + B.border + "40",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>{collapsed ? "\u25B6" : "\u25BC"}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: B.text }}>Client Engagement Alerts</span>
          <span style={{
            padding: "2px 10px", borderRadius: 10, background: B.red, color: "#fff",
            fontSize: 11, fontWeight: 700, lineHeight: "18px",
          }}>{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</span>
        </div>
        <span style={{ fontSize: 12, color: B.dim }}>{collapsed ? "Show" : "Hide"}</span>
      </div>

      {!collapsed && (
        <div style={{ padding: "14px 18px" }}>
          {noshowAlerts.length > 0 && (
            <div style={{ marginBottom: unusedAlerts.length > 0 ? 18 : 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: B.red, textTransform: "uppercase",
                letterSpacing: 0.6, marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: B.red, display: "inline-block" }} />
                No Show -- 7+ Days ({noshowAlerts.length})
              </div>
              {noshowAlerts.map(a => (
                <AlertCard key={a.alertKey} member={a.member} reason={a.reason} severity={a.severity} planName={a.planName} B={B}
                  onSendMessage={() => navigate(_gp("messages"))} onDismiss={() => dismissAlert(a.alertKey)} onClickMember={() => navigate(_gp(`members/${a.member.id}`))} />
              ))}
            </div>
          )}
          {unusedAlerts.length > 0 && (
            <div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: B.orange, textTransform: "uppercase",
                letterSpacing: 0.6, marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: B.orange, display: "inline-block" }} />
                Unused Sessions -- 14 Day Window ({unusedAlerts.length})
              </div>
              {unusedAlerts.map(a => (
                <AlertCard key={a.alertKey} member={a.member} reason={a.reason} severity={a.severity} planName={a.planName} B={B}
                  onSendMessage={() => navigate(_gp("messages"))} onDismiss={() => dismissAlert(a.alertKey)} onClickMember={() => navigate(_gp(`members/${a.member.id}`))} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ========== Sales Funnel (CSS-based) ========== */
function SalesFunnel({ stages, B, onStageClick }) {
  const maxVal = stages[0]?.count || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center", width: "100%" }}>
      {stages.map((stage, i) => {
        const pct = maxVal > 0 ? (stage.count / maxVal) * 100 : 0;
        const actualWidth = 100 - (i / (stages.length - 1)) * 80;
        return (
          <div key={stage.label}
            onClick={() => onStageClick && onStageClick(stage)}
            style={{
              width: `${Math.max(20, actualWidth)}%`,
              padding: "12px 16px",
              background: stage.color,
              color: "#fff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: i === 0 ? "8px 8px 0 0" : i === stages.length - 1 ? "0 0 8px 8px" : 0,
              transition: "all 0.3s",
              marginLeft: "auto",
              marginRight: "auto",
              cursor: "pointer",
            }}>
            <span>{stage.label}</span>
            <span style={{ fontWeight: 800 }}>
              {maxVal > 0 ? pct.toFixed(0) : 0}% ({stage.count})
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ========== Mini KPI Card for Marketing Grid ========== */
function MiniKpi({ label, value, prefix = "", editable = false, calculated = false, onChange, B, note, onClick }) {
  const displayVal = prefix
    ? prefix + Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: (value || 0) % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })
    : Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: (value || 0) % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 });

  return (
    <div
      onClick={onClick}
      style={{
        padding: 10, borderRadius: 8,
        border: "1px solid " + B.border,
        background: calculated ? B.accent + "08" : "transparent",
        textAlign: "center",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, lineHeight: 1.2 }}>
        {label}
      </div>
      {editable && onChange ? (
        <div style={{ fontSize: 16, fontWeight: 800, color: B.text }}>
          <EditableNumber value={value || 0} prefix={prefix} onChange={onChange} style={{ fontSize: 16 }} />
        </div>
      ) : (
        <div style={{ fontSize: 16, fontWeight: 800, color: calculated ? B.accent : B.text }}>
          {displayVal}
        </div>
      )}
      {note && <div style={{ fontSize: 8, color: B.dim, marginTop: 2 }}>{note}</div>}
    </div>
  );
}

/* ========== Drill-Down Sortable Table ========== */
function DrillTable({ columns, rows, B }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    const colDef = columns.find(c => c.key === sortCol);
    return [...rows].sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (colDef && colDef.sortVal) {
        va = colDef.sortVal(a);
        vb = colDef.sortVal(b);
      }
      if (va == null) va = "";
      if (vb == null) vb = "";
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [rows, sortCol, sortDir, columns]);

  if (rows.length === 0) {
    return <div style={{ padding: 24, textAlign: "center", color: B.dim, fontSize: 13 }}>No data for this period.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                style={{
                  textAlign: col.align || "left", padding: "10px 12px",
                  borderBottom: "2px solid " + B.border, color: B.muted, fontSize: 11,
                  fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                  cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                }}
              >
                {col.label}
                {sortCol === col.key && (
                  <span style={{ marginLeft: 4, fontSize: 9 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row._key || i} style={{ borderBottom: "1px solid " + B.border + "40" }}>
              {columns.map(col => (
                <td key={col.key} style={{
                  padding: "10px 12px", color: B.text,
                  textAlign: col.align || "left", whiteSpace: "nowrap",
                }}>
                  {col.render ? col.render(row) : (row[col.key] ?? "--")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ========== Default Funnel Configuration ========== */
const DEFAULT_FUNNEL_STAGES = [
  { id: "leads", label: "Total Leads", color: "#3b82f6", hasSubMetrics: false },
  { id: "jumpstarts", label: "Total Jumpstarts", color: "#f59e0b", hasSubMetrics: true, subLabels: ["Booked", "Showed"] },
  { id: "jumpstart_closes", label: "Jumpstart Closes", color: "#a855f7", hasSubMetrics: false },
  { id: "strat_sessions", label: "Total Strat Sessions", color: "#eab308", hasSubMetrics: false },
  { id: "trial_closes", label: "Trial Closes", color: "#06b6d4", hasSubMetrics: true, subLabels: ["Booked", "Showed"] },
  { id: "new_clients", label: "New Clients", color: "#22c55e", hasSubMetrics: false },
];

const PRESET_COLORS = [
  "#3b82f6", "#f59e0b", "#a855f7", "#eab308", "#06b6d4", "#22c55e",
  "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#6366f1",
  "#84cc16", "#0ea5e9", "#d946ef", "#78716c",
];

/* ========== Funnel Editor Modal ========== */
function FunnelEditorModal({ stages, onSave, onClose, B }) {
  const [draft, setDraft] = useState(() => stages.map(s => ({ ...s })));
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const updateStage = (idx, field, value) => {
    setDraft(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const removeStage = (idx) => {
    setDraft(prev => prev.filter((_, i) => i !== idx));
  };

  const addStage = () => {
    const id = "stage_" + Date.now();
    setDraft(prev => [...prev, { id, label: "New Stage", color: "#6366f1", hasSubMetrics: false, subLabels: ["Booked", "Showed"] }]);
  };

  const moveStage = (fromIdx, toIdx) => {
    setDraft(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const handleDragStart = (idx) => { dragItem.current = idx; };
  const handleDragEnter = (idx) => { dragOverItem.current = idx; };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      moveStage(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div style={{
        background: B.card, borderRadius: 14, padding: 28, width: 580, maxWidth: "95vw",
        maxHeight: "85vh", overflow: "auto", border: "1px solid " + B.border,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: B.text }}>Edit Funnel Stages</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: B.dim, fontSize: 20, cursor: "pointer", padding: 4 }}>x</button>
        </div>

        <div style={{ fontSize: 11, color: B.dim, marginBottom: 16 }}>Drag to reorder. Toggle sub-metrics to track Booked/Showed/Closed for a stage.</div>

        {draft.map((stage, idx) => (
          <div
            key={stage.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              marginBottom: 8, borderRadius: 8, border: "1px solid " + B.border,
              background: B.bg, cursor: "grab",
            }}
          >
            {/* Drag handle */}
            <span style={{ color: B.dim, fontSize: 16, cursor: "grab", userSelect: "none", flexShrink: 0 }}>{"\u2261"}</span>

            {/* Up/Down arrows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, flexShrink: 0 }}>
              <button disabled={idx === 0} onClick={() => moveStage(idx, idx - 1)}
                style={{ background: "none", border: "none", color: idx === 0 ? B.border : B.dim, fontSize: 10, cursor: idx === 0 ? "default" : "pointer", padding: 0, lineHeight: 1 }}>{"\u25B2"}</button>
              <button disabled={idx === draft.length - 1} onClick={() => moveStage(idx, idx + 1)}
                style={{ background: "none", border: "none", color: idx === draft.length - 1 ? B.border : B.dim, fontSize: 10, cursor: idx === draft.length - 1 ? "default" : "pointer", padding: 0, lineHeight: 1 }}>{"\u25BC"}</button>
            </div>

            {/* Color picker */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <select
                value={stage.color}
                onChange={e => updateStage(idx, "color", e.target.value)}
                style={{
                  width: 32, height: 32, borderRadius: 6, border: "2px solid " + B.border,
                  background: stage.color, cursor: "pointer", appearance: "none",
                  WebkitAppearance: "none", MozAppearance: "none", color: "transparent",
                }}
              >
                {PRESET_COLORS.map(c => <option key={c} value={c} style={{ background: c, color: "#fff" }}>{c}</option>)}
              </select>
            </div>

            {/* Label input */}
            <input
              value={stage.label}
              onChange={e => updateStage(idx, "label", e.target.value)}
              style={{
                flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid " + B.border,
                background: B.card, color: B.text, fontSize: 13, fontWeight: 600, outline: "none",
              }}
            />

            {/* Sub-metrics toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: B.dim, flexShrink: 0, cursor: "pointer", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={stage.hasSubMetrics || false}
                onChange={e => updateStage(idx, "hasSubMetrics", e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              B/S/C
            </label>

            {/* Delete */}
            <button onClick={() => removeStage(idx)} style={{
              background: "none", border: "none", color: "#ef4444", fontSize: 16, cursor: "pointer",
              padding: "2px 6px", borderRadius: 4, flexShrink: 0, opacity: 0.6,
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}
            >{"\u2717"}</button>
          </div>
        ))}

        <button onClick={addStage} style={{
          width: "100%", padding: "10px 0", borderRadius: 8, border: "1px dashed " + B.border,
          background: "transparent", color: B.accent, fontSize: 13, fontWeight: 700,
          cursor: "pointer", marginTop: 8, marginBottom: 20,
        }}>+ Add Stage</button>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border,
            background: "transparent", color: B.text, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => { onSave(draft); onClose(); }} style={{
            padding: "8px 20px", borderRadius: 8, border: "none",
            background: B.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ========== Funnel Data Entry Modal ========== */
function FunnelDataEntryModal({ stages, allFunnelData, period, cashCollected, onSave, onClose, B }) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState("entry"); // "entry" | "ledger"
  const [editingEntry, setEditingEntry] = useState(null);

  // Get period key from date
  const periodKey = selectedDate.slice(0, 7);
  const periodData = allFunnelData[periodKey] || {};

  const [draft, setDraft] = useState(() => ({ ...periodData, _date: selectedDate }));

  // Update draft when date changes
  const handleDateChange = (d) => {
    setSelectedDate(d);
    const pk = d.slice(0, 7);
    const existing = allFunnelData[pk] || {};
    setDraft({ ...existing, _date: d });
  };

  const setVal = (key, value) => {
    const parsed = value === "" ? 0 : parseFloat(value);
    setDraft(prev => ({ ...prev, [key]: isNaN(parsed) ? 0 : parsed }));
  };

  const adSpend = draft.adSpend || 0;
  const leadsVal = draft[stages[0]?.id] || 0;
  const newClientsStage = stages.find(s => s.id === "new_clients") || stages[stages.length - 1];
  const newClientsVal = draft[newClientsStage?.id] || 0;
  const trialStage = stages.find(s => s.id === "trial_closes");
  const trialVal = trialStage ? (draft[trialStage.id] || 0) : 0;
  const costPerLead = leadsVal > 0 ? adSpend / leadsVal : 0;
  const costPerTrial = trialVal > 0 ? adSpend / trialVal : 0;
  const costPerNewClient = newClientsVal > 0 ? adSpend / newClientsVal : 0;
  const roas = adSpend > 0 ? (cashCollected || 0) / adSpend : 0;

  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid " + B.border, background: B.darker || B.dark, color: B.text, fontSize: 14, fontWeight: 600, outline: "none", textAlign: "center", boxSizing: "border-box" };
  const labelStyle = { fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
  const subLabelStyle = { fontSize: 9, fontWeight: 600, color: B.dim, marginBottom: 2 };

  // Ledger: all submissions sorted by period
  const ledgerEntries = Object.entries(allFunnelData)
    .filter(([k]) => k !== "stages" && k.match(/^\d{4}-\d{2}$/))
    .sort((a, b) => b[0].localeCompare(a[0]));

  const handleSave = () => {
    const pk = selectedDate.slice(0, 7);
    onSave({ ...draft, _savedAt: new Date().toISOString(), _date: selectedDate }, pk);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: B.card, borderRadius: 14, padding: 28, width: 580, maxWidth: "95vw", maxHeight: "85vh", overflow: "auto", border: "1px solid " + B.border, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: B.text }}>Funnel Data</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: B.dim, fontSize: 20, cursor: "pointer", padding: 4 }}>x</button>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          <button onClick={() => setView("entry")} style={{ padding: "6px 16px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: view === "entry" ? B.accent : B.dark, color: view === "entry" ? "#fff" : B.muted }}>Enter Data</button>
          <button onClick={() => setView("ledger")} style={{ padding: "6px 16px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: view === "ledger" ? B.accent : B.dark, color: view === "ledger" ? "#fff" : B.muted }}>Submission History ({ledgerEntries.length})</button>
        </div>

        {view === "ledger" ? (
          /* LEDGER VIEW */
          <div>
            {ledgerEntries.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: B.dim }}>No submissions yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ledgerEntries.map(([pk, data]) => (
                  <div key={pk} style={{ padding: 14, borderRadius: 10, border: "1px solid " + B.border, background: B.dark }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: B.text }}>{pk}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {data._savedAt && <span style={{ fontSize: 10, color: B.dim }}>Saved {new Date(data._savedAt).toLocaleDateString()}</span>}
                        <button onClick={() => { setDraft({ ...data }); setSelectedDate(data._date || pk + "-01"); setView("entry"); }} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid " + B.accent + "40", background: B.accent + "15", color: B.accent, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                      {data.adSpend > 0 && <span style={{ fontSize: 12, color: B.muted }}>Ad Spend: <strong style={{ color: B.text }}>${data.adSpend}</strong></span>}
                      {stages.map(s => {
                        const v = data[s.id];
                        if (!v) return null;
                        return <span key={s.id} style={{ fontSize: 12, color: B.muted }}>{s.label}: <strong style={{ color: s.color }}>{v}</strong></span>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ENTRY VIEW */
          <div>
            {/* Date selector */}
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: "1px solid " + B.border, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={labelStyle}>Date</div>
              <input type="date" value={selectedDate} onChange={e => handleDateChange(e.target.value)} style={{ ...inputStyle, textAlign: "left", flex: 1 }} />
              <span style={{ fontSize: 11, color: B.dim }}>Period: {periodKey}</span>
            </div>

            {/* Ad Spend */}
            <div style={{ marginBottom: 18, padding: 14, borderRadius: 10, background: B.accent + "08", border: "1px solid " + B.accent + "25" }}>
              <div style={labelStyle}>Ad Spend ($)</div>
              <input type="number" step="0.01" value={draft.adSpend || ""} placeholder="0" onChange={e => setVal("adSpend", e.target.value)} style={{ ...inputStyle, fontSize: 18, fontWeight: 800 }} />
            </div>

            {/* Stages */}
            {stages.map(stage => (
              <div key={stage.id} style={{ marginBottom: 14, padding: 12, borderRadius: 8, border: "1px solid " + B.border }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: stage.color, flexShrink: 0 }} />
                  <div style={labelStyle}>{stage.label}</div>
                </div>
                <input type="number" value={draft[stage.id] ?? ""} placeholder="0" onChange={e => setVal(stage.id, e.target.value)} style={inputStyle} />
                {stage.hasSubMetrics && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                    {(stage.subLabels || ["Booked", "Showed", "Closed"]).map((sub) => {
                      const subKey = `${stage.id}_${sub.toLowerCase()}`;
                      return (
                        <div key={subKey}>
                          <div style={subLabelStyle}>{sub}</div>
                          <input type="number" value={draft[subKey] ?? ""} placeholder="0" onChange={e => setVal(subKey, e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "6px 8px" }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Auto-calculated */}
            <div style={{ marginTop: 18, padding: 14, borderRadius: 10, background: B.accent + "06", border: "1px solid " + B.border }}>
              <div style={{ ...labelStyle, marginBottom: 10, color: B.accent }}>Auto-Calculated</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><div style={subLabelStyle}>Cost Per Lead</div><div style={{ fontSize: 14, fontWeight: 700, color: B.text }}>{fmtDollar(costPerLead)}</div></div>
                <div><div style={subLabelStyle}>Cost Per Trial</div><div style={{ fontSize: 14, fontWeight: 700, color: B.text }}>{fmtDollar(costPerTrial)}</div></div>
                <div><div style={subLabelStyle}>Cost Per New Client</div><div style={{ fontSize: 14, fontWeight: 700, color: B.text }}>{fmtDollar(costPerNewClient)}</div></div>
                <div><div style={subLabelStyle}>ROAS</div><div style={{ fontSize: 14, fontWeight: 700, color: roas >= 5 ? "#22c55e" : roas >= 3 ? "#f59e0b" : B.text }}>{roas.toFixed(2)}x</div></div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save for {periodKey}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== Main Dashboard ========== */
export default function BusinessDashboard() {
  const B = useTheme();
  const navigate = useNavigate();
  const _gp = (p) => `/gym/${localStorage.getItem("hf_gym_id") || "default"}/${p}`;
  const { members } = useMembers();
  const { events: membershipEvents } = useMembershipEvents();
  const [attendance] = useLocalStorage("hf_attendance", []);
  const [plans] = useLocalStorage("hf_plans", []);
  const [schedule] = useLocalStorage("hf_schedule", []);
  const [payments] = useLocalStorage("hf_payments", []);
  const [leads] = useLocalStorage("hf_leads", []);
  const [dashMetrics, setDashMetrics] = useLocalStorage("hf_dashboard_metrics", () => {
    const d = new Date();
    const cur = periodKey(d);
    d.setMonth(d.getMonth() - 1);
    const prev = periodKey(d);
    return [{ period: cur, adSpend: 2333.69 }, { period: prev, adSpend: 1987.50 }];
  });

  /* ---- Customizable Sales Funnel state ---- */
  const [salesFunnel, setSalesFunnel] = useLocalStorage("hf_sales_funnel", {
    stages: DEFAULT_FUNNEL_STAGES,
    data: {},
  });
  const [showFunnelEditor, setShowFunnelEditor] = useState(false);
  const [showFunnelDataEntry, setShowFunnelDataEntry] = useState(false);

  const saveFunnelStages = useCallback((newStages) => {
    setSalesFunnel(prev => ({ ...prev, stages: newStages }));
  }, [setSalesFunnel]);

  const saveFunnelData = useCallback((periodKey, data) => {
    setSalesFunnel(prev => ({
      ...prev,
      data: { ...prev.data, [periodKey]: data },
    }));
  }, [setSalesFunnel]);

  /* ---- Drill-down state ---- */
  const [drillDown, setDrillDown] = useState(null);

  /* ---- Date range state ---- */
  const now = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState(periodKey(now));
  const [preset, setPreset] = useState("this_month");

  const { start: rangeStart, end: rangeEnd } = periodRange(selectedPeriod);
  const prior = priorPeriod(selectedPeriod);
  const { start: priorStart, end: priorEnd } = periodRange(prior);

  /* ---- Ad Spend (only manual metric) ---- */
  const currentDashMetrics = useMemo(() => {
    return dashMetrics.find(m => m.period === selectedPeriod) || { period: selectedPeriod, adSpend: 0 };
  }, [dashMetrics, selectedPeriod]);

  const priorDashMetrics = useMemo(() => {
    return dashMetrics.find(m => m.period === prior) || { period: prior, adSpend: 0 };
  }, [dashMetrics, prior]);

  const adSpend = currentDashMetrics.adSpend || 0;

  const updateAdSpend = (value) => {
    setDashMetrics(prev => {
      const idx = prev.findIndex(m => m.period === selectedPeriod);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], adSpend: value };
        return updated;
      }
      return [...prev, { period: selectedPeriod, adSpend: value }];
    });
    // Also sync to funnel data
    setSalesFunnel(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [selectedPeriod]: { ...(prev.data?.[selectedPeriod] || {}), adSpend: value },
      },
    }));
  };

  /* ---- Filter membership events by period ---- */
  const eventsInPeriod = useMemo(() =>
    membershipEvents.filter(e => inRange(e.date, rangeStart, rangeEnd)),
    [membershipEvents, rangeStart, rangeEnd]
  );
  const eventsInPrior = useMemo(() =>
    membershipEvents.filter(e => inRange(e.date, priorStart, priorEnd)),
    [membershipEvents, priorStart, priorEnd]
  );

  /* ==========================
     SECTION 2: Revenue KPIs
     ========================== */

  // Current Recurring = sum of plan prices for all active members with a plan
  const activeMembersAll = members.filter(m => m.membershipStatus === "active");
  const frozenMembers = members.filter(m => m.membershipStatus === "frozen");

  const recurringPlans = plans.filter(p => ["monthly", "annual", "weekly", "every-4-weeks"].includes(p.billingCycle));
  const recurringPlanIds = new Set(recurringPlans.map(p => p.id));

  const getMemberPlanPrice = (m) => {
    const plan = plans.find(p => p.id === m.membershipPlanId);
    if (plan) return plan.price || 0;
    return 0;
  };

  const getMemberPlan = (m) => {
    return plans.find(p => p.id === m.membershipPlanId) || null;
  };

  const recurringMembers = activeMembersAll.filter(m => {
    return m.membershipPlanId && recurringPlanIds.has(m.membershipPlanId);
  });

  const currentRecurring = recurringMembers.reduce((sum, m) => sum + getMemberPlanPrice(m), 0);
  const recurringCount = recurringMembers.length;

  // New Members & New Recurring = from membership events type="join" in period
  const joinEventsInPeriod = eventsInPeriod.filter(e => e.type === "join");
  const joinEventsInPrior = eventsInPrior.filter(e => e.type === "join");
  const newMemberCount = joinEventsInPeriod.length;
  const priorNewMemberCount = joinEventsInPrior.length;
  const newRecurringRevenue = joinEventsInPeriod.reduce((sum, e) => sum + (e.details?.newPrice || 0), 0);
  const priorNewRecurringRevenue = joinEventsInPrior.reduce((sum, e) => sum + (e.details?.newPrice || 0), 0);

  // Lost Members & Lost Recurring = from membership events type="cancel" in period
  const cancelEventsInPeriod = eventsInPeriod.filter(e => e.type === "cancel");
  const cancelEventsInPrior = eventsInPrior.filter(e => e.type === "cancel");
  const lostMemberCount = cancelEventsInPeriod.length;
  const priorLostMemberCount = cancelEventsInPrior.length;
  const lostRecurringRevenue = cancelEventsInPeriod.reduce((sum, e) => sum + (e.details?.oldPrice || 0), 0);
  const priorLostRecurringRevenue = cancelEventsInPrior.reduce((sum, e) => sum + (e.details?.oldPrice || 0), 0);

  /* ==========================
     SECTION 3: Membership Movement (all auto-calculated from events)
     ========================== */
  const activeHolds = frozenMembers.length;
  const holdsSet = eventsInPeriod.filter(e => e.type === "freeze").length;
  const holdsLifted = eventsInPeriod.filter(e => e.type === "unfreeze").length;
  const upgrades = eventsInPeriod.filter(e => e.type === "upgrade").length;
  const downgrades = eventsInPeriod.filter(e => e.type === "downgrade").length;

  // Attrition % = Lost / (Starting + New)
  // Starting members approximation: current recurring + lost in period - new in period
  const startingMembers = recurringCount + lostMemberCount - newMemberCount;
  const attritionPct = (startingMembers + newMemberCount) > 0
    ? (lostMemberCount / (startingMembers + newMemberCount)) * 100
    : 0;

  const priorHoldsSet = eventsInPrior.filter(e => e.type === "freeze").length;
  const priorHoldsLifted = eventsInPrior.filter(e => e.type === "unfreeze").length;
  const priorUpgrades = eventsInPrior.filter(e => e.type === "upgrade").length;
  const priorDowngrades = eventsInPrior.filter(e => e.type === "downgrade").length;

  /* ==========================
     SECTION 4: Sales Funnel (manual data with CRM fallback)
     ========================== */
  const leadsInPeriod = useMemo(() =>
    leads.filter(l => inRange(l.createdAt || l.date, rangeStart, rangeEnd)),
    [leads, rangeStart, rangeEnd]
  );

  const hasCrmData = leads.length > 0;

  // CRM-derived values (fallback)
  const crmTotalLeads = leadsInPeriod.length;
  const crmTotalJumpstarts = leadsInPeriod.filter(l => l.stage !== "new").length;
  const crmJumpstartCloses = leadsInPeriod.filter(l => l.stage === "trial" || l.stage === "won" || l.stage === "negotiation").length;
  const crmTotalStratSessions = leadsInPeriod.filter(l => l.stage === "contacted" || l.stage === "negotiation" || l.stage === "won").length;
  const crmTrialCloses = leadsInPeriod.filter(l => l.stage === "won").length;

  // CRM fallback map for default stage ids
  const crmFallbackMap = {
    leads: crmTotalLeads,
    jumpstarts: crmTotalJumpstarts,
    jumpstart_closes: crmJumpstartCloses,
    strat_sessions: crmTotalStratSessions,
    trial_closes: crmTrialCloses,
    new_clients: newMemberCount,
  };

  // Manual funnel data for this period
  const funnelPeriodData = salesFunnel.data?.[selectedPeriod] || {};
  const hasManualFunnelData = Object.keys(funnelPeriodData).length > 0;
  const funnelStageConfig = salesFunnel.stages || DEFAULT_FUNNEL_STAGES;

  // Resolve a stage value: manual data first, then CRM fallback
  const getFunnelVal = (stageId) => {
    if (hasManualFunnelData && funnelPeriodData[stageId] != null) return funnelPeriodData[stageId];
    if (crmFallbackMap[stageId] != null) return crmFallbackMap[stageId];
    return 0;
  };

  const getSubVal = (stageId, subLabel) => {
    const subKey = `${stageId}_${subLabel.toLowerCase()}`;
    return funnelPeriodData[subKey] || 0;
  };

  // Ad spend: prefer funnel data, then dashMetrics
  const funnelAdSpend = hasManualFunnelData && funnelPeriodData.adSpend != null ? funnelPeriodData.adSpend : adSpend;

  // Build funnel stages for visualization
  const funnelStages = funnelStageConfig.map(stage => ({
    label: stage.label,
    count: getFunnelVal(stage.id),
    color: stage.color,
    drillType: stage.id === "new_clients" ? "new_members" : "funnel_" + stage.id,
    stageId: stage.id,
    hasSubMetrics: stage.hasSubMetrics,
    subLabels: stage.subLabels || ["Booked", "Showed", "Closed"],
  }));

  // Convenience values for marketing metrics
  const totalLeads = getFunnelVal("leads") || getFunnelVal(funnelStageConfig[0]?.id);
  const totalJumpstarts = getFunnelVal("jumpstarts");
  const jumpstartCloses = getFunnelVal("jumpstart_closes");
  const totalStratSessions = getFunnelVal("strat_sessions");
  const trialCloses = getFunnelVal("trial_closes");

  /* ---- Marketing calculated values ---- */
  const effectiveAdSpend = funnelAdSpend;
  const costPerLead = totalLeads > 0 ? effectiveAdSpend / totalLeads : 0;
  const costPerTrial = trialCloses > 0 ? effectiveAdSpend / trialCloses : 0;
  const costPerNewMember = newMemberCount > 0 ? effectiveAdSpend / newMemberCount : 0;

  /* ==========================
     SECTION 5: Financial Summary (auto from payments)
     ========================== */
  const paymentsInPeriod = useMemo(() =>
    payments.filter(p => inRange(p.date || p.timestamp || p.createdAt, rangeStart, rangeEnd)),
    [payments, rangeStart, rangeEnd]
  );

  const paidPaymentsInPeriod = useMemo(() =>
    paymentsInPeriod.filter(p => p.status === "paid"),
    [paymentsInPeriod]
  );

  const cashCollected = paidPaymentsInPeriod
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // FEO = payments from members in their first 30 days
  const feoPayments = useMemo(() => {
    return paidPaymentsInPeriod
      .filter(p => {
        const member = members.find(m =>
          m.id === p.memberId ||
          `${m.firstName} ${m.lastName}` === p.member
        );
        if (!member) return false;
        const startDate = new Date(member.startDate || member.createdAt);
        const payDate = new Date(p.date || p.timestamp || p.createdAt);
        return daysBetween(startDate, payDate) <= 30;
      });
  }, [paidPaymentsInPeriod, members]);

  const feoCollected = feoPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const roas = effectiveAdSpend > 0 ? cashCollected / effectiveAdSpend : 0;

  /* ---- Attrition detail expand ---- */
  const [showAttritionDetail, setShowAttritionDetail] = useState(false);

  /* ---- Preset handlers ---- */
  const handlePreset = (p) => {
    setPreset(p);
    const d = new Date();
    switch (p) {
      case "this_month":
        setSelectedPeriod(periodKey(d));
        break;
      case "last_month":
        d.setMonth(d.getMonth() - 1);
        setSelectedPeriod(periodKey(d));
        break;
      case "this_quarter": {
        const qMonth = Math.floor(d.getMonth() / 3) * 3;
        setSelectedPeriod(periodKey(new Date(d.getFullYear(), qMonth, 1)));
        break;
      }
      case "this_year":
        setSelectedPeriod(`${d.getFullYear()}-01`);
        break;
      default:
        break;
    }
  };

  /* ---- Period month selector options ---- */
  const periodOptions = useMemo(() => {
    const opts = [];
    for (let y = 2025; y <= 2027; y++) {
      for (let m = 1; m <= 12; m++) {
        const pk = `${y}-${String(m).padStart(2, "0")}`;
        opts.push({ value: pk, label: `${MONTH_NAMES_FULL[m - 1]} ${y}` });
      }
    }
    return opts;
  }, []);

  /* ---- Shared styles ---- */
  const sectionGap = 24;
  const kpiLabelStyle = { fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 };
  const kpiValueStyle = { fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.1 };
  const cardLabelStyle = { fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 };
  const cardValueStyle = { fontSize: 26, fontWeight: 900, color: B.text, lineHeight: 1.1 };
  const presetBtnBase = { padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid", transition: "all 0.15s" };
  const autoTag = { fontSize: 9, color: B.accent, marginTop: 4, fontWeight: 600, letterSpacing: 0.3 };
  const clickableKpi = { cursor: "pointer", transition: "all 0.15s" };

  /* ---- Quick Actions ---- */
  const quickActions = [
    { label: "New Workout", icon: "\u2795", path: "/build", color: B.accent },
    { label: "Check In", icon: "\u2713", path: "/checkin", color: B.green },
    { label: "Add Client", icon: "\u263A", path: "/members", color: B.blue },
    { label: "View Schedule", icon: "\u25A3", path: "/schedule", color: B.purple },
  ];

  /* ---- Today's Schedule ---- */
  const todayDay = DAYS[new Date().getDay()];
  const todayClasses = schedule.filter((c) => c.day === todayDay || c.days?.includes?.(todayDay));

  /* ---- Recent Activity ---- */
  const recentActivity = useMemo(() => {
    const items = [];
    attendance.forEach((a) => {
      const m = members.find((x) => x.id === a.memberId);
      const name = m ? `${m.firstName} ${m.lastName}` : "Unknown";
      items.push({ text: `${name} checked in`, time: a.date || a.timestamp || a.createdAt || "", dot: B.green, sort: new Date(a.date || a.timestamp || a.createdAt || 0).getTime() });
    });
    members.forEach((m) => {
      if (m.createdAt) items.push({ text: `New member: ${m.firstName} ${m.lastName}`, time: m.createdAt, dot: B.blue, sort: new Date(m.createdAt).getTime() });
    });
    payments.forEach((p) => {
      const m = members.find((x) => x.id === p.memberId);
      const name = m ? `${m.firstName} ${m.lastName}` : "Unknown";
      const amt = typeof p.amount === "number" ? `$${p.amount.toLocaleString()}` : "";
      items.push({ text: `Payment received: ${amt} from ${name}`, time: p.date || p.timestamp || p.createdAt || "", dot: B.purple, sort: new Date(p.date || p.timestamp || p.createdAt || 0).getTime() });
    });
    items.sort((a, b) => b.sort - a.sort);
    return items.slice(0, 10);
  }, [attendance, members, payments, B]);

  /* ---- CRM note for empty funnel ---- */
  const crmNote = hasManualFunnelData ? null : (!hasCrmData ? "Connect CRM data to populate" : null);
  const funnelDataSource = hasManualFunnelData ? "manual" : (hasCrmData ? "crm" : "none");

  /* ========== DRILL-DOWN RENDERING ========== */

  const backButtonStyle = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "10px 20px", borderRadius: 8, border: "1px solid " + B.border,
    background: B.card, color: B.text, fontSize: 14, fontWeight: 700,
    cursor: "pointer", marginBottom: 24, transition: "all 0.15s",
  };

  const drillSummaryStyle = {
    display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 24,
  };

  const drillStatBox = (label, value, color) => (
    <div style={{
      padding: "14px 20px", borderRadius: 10, background: (color || B.accent) + "12",
      border: "1px solid " + (color || B.accent) + "30", minWidth: 140,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: color || B.text }}>{value}</div>
    </div>
  );

  const findMemberForEvent = (e) => {
    return members.find(m => m.id === e.memberId) || null;
  };

  const renderDrillDown = () => {
    if (!drillDown) return null;

    const periodLabel = periodOptions.find(o => o.value === selectedPeriod)?.label || selectedPeriod;

    const wrapper = (title, bigValue, summaryStats, tableContent) => (
      <div>
        <button
          onClick={() => setDrillDown(null)}
          style={backButtonStyle}
          onMouseEnter={e => { e.currentTarget.style.background = B.accent + "15"; e.currentTarget.style.borderColor = B.accent; }}
          onMouseLeave={e => { e.currentTarget.style.background = B.card; e.currentTarget.style.borderColor = B.border; }}
        >
          <span style={{ fontSize: 18 }}>{"\u2190"}</span> Back to Dashboard
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: B.text, margin: "0 0 6px 0" }}>{title}</h1>
        <div style={{ fontSize: 13, color: B.dim, marginBottom: 20 }}>{periodLabel}</div>

        {bigValue && (
          <div style={{ fontSize: 36, fontWeight: 900, color: B.text, marginBottom: 20 }}>{bigValue}</div>
        )}

        {summaryStats && summaryStats.length > 0 && (
          <div style={drillSummaryStyle}>
            {summaryStats.map((s, i) => (
              <div key={i}>{drillStatBox(s.label, s.value, s.color)}</div>
            ))}
          </div>
        )}

        <Card style={{ padding: 20 }}>
          {tableContent}
        </Card>
      </div>
    );

    switch (drillDown.type) {

      case "current_recurring": {
        const rows = recurringMembers.map(m => {
          const plan = getMemberPlan(m);
          return {
            _key: m.id,
            name: `${m.firstName} ${m.lastName}`,
            planName: plan ? plan.name : "No plan",
            price: getMemberPlanPrice(m),
            billingCycle: plan ? plan.billingCycle : "monthly",
            startDate: m.startDate || m.createdAt || "",
          };
        });
        const total = rows.reduce((s, r) => s + r.price, 0);
        return wrapper(
          "Current Recurring Revenue",
          fmtDollar(currentRecurring),
          [
            { label: "Active Clients", value: recurringCount },
            { label: "Avg per Client", value: fmtDollar(recurringCount > 0 ? currentRecurring / recurringCount : 0) },
            { label: "Total MRR", value: fmtDollar(total) },
          ],
          <>
            <DrillTable B={B} columns={[
              { key: "name", label: "Client" },
              { key: "planName", label: "Plan" },
              { key: "price", label: "Price", align: "right", render: r => fmtDollar(r.price), sortVal: r => r.price },
              { key: "billingCycle", label: "Billing Cycle" },
              { key: "startDate", label: "Start Date", render: r => fmtDate(r.startDate), sortVal: r => new Date(r.startDate || 0).getTime() },
            ]} rows={rows} />
            <div style={{ textAlign: "right", padding: "12px", borderTop: "2px solid " + B.border, fontWeight: 800, fontSize: 15, color: B.text }}>
              Total: {fmtDollar(total)}
            </div>
          </>
        );
      }

      case "recurring_members": {
        const activeCount = recurringMembers.filter(m => m.membershipStatus === "active").length;
        const trialCount = members.filter(m => m.membershipStatus === "trial").length;
        const rows = recurringMembers.map(m => {
          const plan = getMemberPlan(m);
          return {
            _key: m.id,
            name: `${m.firstName} ${m.lastName}`,
            status: m.membershipStatus,
            planName: plan ? plan.name : "No plan",
            price: getMemberPlanPrice(m),
            startDate: m.startDate || m.createdAt || "",
          };
        });
        return wrapper(
          "Recurring Clients",
          String(recurringCount),
          [
            { label: "Active", value: activeCount, color: "#22c55e" },
            { label: "Trial", value: trialCount, color: "#3b82f6" },
            { label: "Total Recurring", value: recurringCount },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Client" },
            { key: "status", label: "Status", render: r => (
              <span style={{
                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                background: r.status === "active" ? "#22c55e20" : "#3b82f620",
                color: r.status === "active" ? "#22c55e" : "#3b82f6",
              }}>{r.status}</span>
            )},
            { key: "planName", label: "Plan" },
            { key: "price", label: "Price", align: "right", render: r => fmtDollar(r.price), sortVal: r => r.price },
            { key: "startDate", label: "Start Date", render: r => fmtDate(r.startDate), sortVal: r => new Date(r.startDate || 0).getTime() },
          ]} rows={rows} />
        );
      }

      case "new_recurring": {
        const rows = joinEventsInPeriod.map((e, i) => {
          const m = findMemberForEvent(e);
          return {
            _key: e.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (e.memberName || "Unknown"),
            joinDate: e.date,
            planName: e.details?.planName || (m ? (getMemberPlan(m)?.name || "N/A") : "N/A"),
            price: e.details?.newPrice || 0,
          };
        });
        return wrapper(
          "New Recurring Revenue",
          fmtDollar(newRecurringRevenue),
          [
            { label: "New Joins", value: newMemberCount },
            { label: "New Revenue", value: fmtDollar(newRecurringRevenue), color: "#22c55e" },
            { label: "Avg Revenue", value: fmtDollar(newMemberCount > 0 ? newRecurringRevenue / newMemberCount : 0) },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Client" },
            { key: "joinDate", label: "Join Date", render: r => fmtDate(r.joinDate), sortVal: r => new Date(r.joinDate || 0).getTime() },
            { key: "planName", label: "Plan Assigned" },
            { key: "price", label: "Plan Price", align: "right", render: r => fmtDollar(r.price), sortVal: r => r.price },
          ]} rows={rows} />
        );
      }

      case "lost_recurring": {
        const rows = cancelEventsInPeriod.map((e, i) => {
          const m = findMemberForEvent(e);
          return {
            _key: e.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (e.memberName || "Unknown"),
            cancelDate: e.date,
            planName: e.details?.planName || "N/A",
            revenueLost: e.details?.oldPrice || 0,
          };
        });
        return wrapper(
          "Lost Recurring Revenue",
          fmtDollar(lostRecurringRevenue),
          [
            { label: "Cancellations", value: lostMemberCount, color: "#ef4444" },
            { label: "Revenue Lost", value: fmtDollar(lostRecurringRevenue), color: "#ef4444" },
            { label: "Avg Lost", value: fmtDollar(lostMemberCount > 0 ? lostRecurringRevenue / lostMemberCount : 0) },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Member" },
            { key: "cancelDate", label: "Cancel Date", render: r => fmtDate(r.cancelDate), sortVal: r => new Date(r.cancelDate || 0).getTime() },
            { key: "planName", label: "Plan" },
            { key: "revenueLost", label: "Revenue Lost", align: "right", render: r => fmtDollar(r.revenueLost), sortVal: r => r.revenueLost },
          ]} rows={rows} />
        );
      }

      case "new_members": {
        const rows = joinEventsInPeriod.map((e, i) => {
          const m = findMemberForEvent(e);
          return {
            _key: e.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (e.memberName || "Unknown"),
            joinDate: e.date,
            email: m?.email || "--",
            phone: m?.phone || "--",
          };
        });
        return wrapper(
          "New Clients",
          String(newMemberCount),
          [
            { label: "New This Period", value: newMemberCount, color: "#22c55e" },
            { label: "Prior Period", value: priorNewMemberCount },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Client" },
            { key: "joinDate", label: "Join Date", render: r => fmtDate(r.joinDate), sortVal: r => new Date(r.joinDate || 0).getTime() },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
          ]} rows={rows} />
        );
      }

      case "lost_members": {
        const rows = cancelEventsInPeriod.map((e, i) => {
          const m = findMemberForEvent(e);
          const memberCheckins = m ? attendance.filter(a => a.memberId === m.id) : [];
          const lastCheckin = memberCheckins.length > 0
            ? memberCheckins.reduce((latest, a) => {
                const t = new Date(a.checkInTime || a.date || 0).getTime();
                return t > latest ? t : latest;
              }, 0)
            : null;
          return {
            _key: e.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (e.memberName || "Unknown"),
            cancelDate: e.date,
            reason: e.details?.reason || "--",
            lastCheckin: lastCheckin ? new Date(lastCheckin).toISOString() : null,
          };
        });
        return wrapper(
          "Lost Clients",
          String(lostMemberCount),
          [
            { label: "Lost This Period", value: lostMemberCount, color: "#ef4444" },
            { label: "Prior Period", value: priorLostMemberCount },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Client" },
            { key: "cancelDate", label: "Cancel Date", render: r => fmtDate(r.cancelDate), sortVal: r => new Date(r.cancelDate || 0).getTime() },
            { key: "reason", label: "Reason" },
            { key: "lastCheckin", label: "Last Check-in", render: r => r.lastCheckin ? fmtDate(r.lastCheckin) : "Never", sortVal: r => r.lastCheckin ? new Date(r.lastCheckin).getTime() : 0 },
          ]} rows={rows} />
        );
      }

      case "active_holds": {
        const rows = frozenMembers.map(m => {
          const plan = getMemberPlan(m);
          const freezeEvent = membershipEvents
            .filter(e => e.memberId === m.id && e.type === "freeze")
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          return {
            _key: m.id,
            name: `${m.firstName} ${m.lastName}`,
            email: m.email || "--",
            planName: plan ? plan.name : "N/A",
            freezeDate: freezeEvent?.date || "--",
          };
        });
        return wrapper(
          "Active Holds",
          String(activeHolds),
          [
            { label: "Currently Frozen", value: activeHolds, color: "#f59e0b" },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Member" },
            { key: "email", label: "Email" },
            { key: "planName", label: "Plan" },
            { key: "freezeDate", label: "Freeze Date", render: r => fmtDate(r.freezeDate), sortVal: r => new Date(r.freezeDate || 0).getTime() },
          ]} rows={rows} />
        );
      }

      case "holds_set": {
        const freezeEvents = eventsInPeriod.filter(e => e.type === "freeze");
        const rows = freezeEvents.map((e, i) => {
          const m = findMemberForEvent(e);
          return {
            _key: e.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (e.memberName || "Unknown"),
            date: e.date,
            details: e.details?.reason || e.details?.note || "--",
          };
        });
        return wrapper(
          "Holds Set",
          String(holdsSet),
          [
            { label: "Holds Set This Period", value: holdsSet, color: "#f59e0b" },
            { label: "Prior Period", value: priorHoldsSet },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Member" },
            { key: "date", label: "Freeze Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
            { key: "details", label: "Details" },
          ]} rows={rows} />
        );
      }

      case "holds_lifted": {
        const unfreezeEvents = eventsInPeriod.filter(e => e.type === "unfreeze");
        const rows = unfreezeEvents.map((e, i) => {
          const m = findMemberForEvent(e);
          return {
            _key: e.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (e.memberName || "Unknown"),
            date: e.date,
            details: e.details?.reason || e.details?.note || "--",
          };
        });
        return wrapper(
          "Holds Lifted",
          String(holdsLifted),
          [
            { label: "Holds Lifted This Period", value: holdsLifted, color: "#22c55e" },
            { label: "Prior Period", value: priorHoldsLifted },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Member" },
            { key: "date", label: "Unfreeze Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
            { key: "details", label: "Details" },
          ]} rows={rows} />
        );
      }

      case "upgrades": {
        const upgradeEvents = eventsInPeriod.filter(e => e.type === "upgrade");
        const rows = upgradeEvents.map((e, i) => {
          const m = findMemberForEvent(e);
          return {
            _key: e.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (e.memberName || "Unknown"),
            date: e.date,
            oldPlan: e.details?.oldPlanName || "N/A",
            newPlan: e.details?.newPlanName || e.details?.planName || "N/A",
            oldPrice: e.details?.oldPrice || 0,
            newPrice: e.details?.newPrice || 0,
          };
        });
        return wrapper(
          "Upgrades",
          String(upgrades),
          [
            { label: "Upgrades This Period", value: upgrades, color: "#22c55e" },
            { label: "Prior Period", value: priorUpgrades },
            { label: "Added Revenue", value: fmtDollar(rows.reduce((s, r) => s + (r.newPrice - r.oldPrice), 0)), color: "#22c55e" },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Member" },
            { key: "date", label: "Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
            { key: "oldPlan", label: "Old Plan" },
            { key: "newPlan", label: "New Plan" },
            { key: "change", label: "Price Change", align: "right", render: r => (
              <span>
                {fmtDollar(r.oldPrice)} {"\u2192"} {fmtDollar(r.newPrice)}
                <span style={{ color: "#22c55e", fontWeight: 700, marginLeft: 6 }}>+{fmtDollar(r.newPrice - r.oldPrice)}</span>
              </span>
            ), sortVal: r => r.newPrice - r.oldPrice },
          ]} rows={rows} />
        );
      }

      case "downgrades": {
        const downgradeEvents = eventsInPeriod.filter(e => e.type === "downgrade");
        const rows = downgradeEvents.map((e, i) => {
          const m = findMemberForEvent(e);
          return {
            _key: e.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (e.memberName || "Unknown"),
            date: e.date,
            oldPlan: e.details?.oldPlanName || "N/A",
            newPlan: e.details?.newPlanName || e.details?.planName || "N/A",
            oldPrice: e.details?.oldPrice || 0,
            newPrice: e.details?.newPrice || 0,
          };
        });
        return wrapper(
          "Downgrades",
          String(downgrades),
          [
            { label: "Downgrades This Period", value: downgrades, color: "#ef4444" },
            { label: "Prior Period", value: priorDowngrades },
            { label: "Lost Revenue", value: fmtDollar(rows.reduce((s, r) => s + (r.oldPrice - r.newPrice), 0)), color: "#ef4444" },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Member" },
            { key: "date", label: "Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
            { key: "oldPlan", label: "Old Plan" },
            { key: "newPlan", label: "New Plan" },
            { key: "change", label: "Price Change", align: "right", render: r => (
              <span>
                {fmtDollar(r.oldPrice)} {"\u2192"} {fmtDollar(r.newPrice)}
                <span style={{ color: "#ef4444", fontWeight: 700, marginLeft: 6 }}>-{fmtDollar(r.oldPrice - r.newPrice)}</span>
              </span>
            ), sortVal: r => r.oldPrice - r.newPrice },
          ]} rows={rows} />
        );
      }

      case "attrition": {
        const rows = cancelEventsInPeriod.map((e, i) => {
          const m = findMemberForEvent(e);
          return {
            _key: e.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (e.memberName || "Unknown"),
            cancelDate: e.date,
            planName: e.details?.planName || "N/A",
            revenueLost: e.details?.oldPrice || 0,
          };
        });
        return wrapper(
          "Attrition Rate",
          fmtPct(attritionPct),
          [
            { label: "Lost Clients", value: lostMemberCount, color: "#ef4444" },
            { label: "Starting Clients", value: startingMembers },
            { label: "New Clients", value: newMemberCount, color: "#22c55e" },
            { label: "Starting + New", value: startingMembers + newMemberCount },
          ],
          <>
            <div style={{
              padding: 16, marginBottom: 16, borderRadius: 8,
              background: B.accent + "08", border: "1px solid " + B.border,
              fontSize: 13, color: B.text, lineHeight: 1.8,
            }}>
              <strong>Calculation:</strong> {lostMemberCount} lost / ({startingMembers} starting + {newMemberCount} new) = {lostMemberCount} / {startingMembers + newMemberCount} = <strong>{fmtPct(attritionPct)}</strong>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 12 }}>Lost Clients Detail</div>
            <DrillTable B={B} columns={[
              { key: "name", label: "Client" },
              { key: "cancelDate", label: "Cancel Date", render: r => fmtDate(r.cancelDate), sortVal: r => new Date(r.cancelDate || 0).getTime() },
              { key: "planName", label: "Plan" },
              { key: "revenueLost", label: "Revenue Lost", align: "right", render: r => fmtDollar(r.revenueLost), sortVal: r => r.revenueLost },
            ]} rows={rows} />
          </>
        );
      }

      case "mrr": {
        // Group by plan
        const planBreakdown = {};
        recurringMembers.forEach(m => {
          const plan = getMemberPlan(m);
          const planName = plan ? plan.name : "Default Plan";
          const price = getMemberPlanPrice(m);
          if (!planBreakdown[planName]) {
            planBreakdown[planName] = { planName, count: 0, priceEach: price, total: 0 };
          }
          planBreakdown[planName].count += 1;
          planBreakdown[planName].total += price;
        });
        const rows = Object.values(planBreakdown);
        const grandTotal = rows.reduce((s, r) => s + r.total, 0);
        return wrapper(
          "Monthly Recurring Revenue (MRR)",
          fmtDollar(currentRecurring),
          [
            { label: "Total MRR", value: fmtDollar(currentRecurring) },
            { label: "Plan Types", value: rows.length },
            { label: "Total Clients", value: recurringCount },
          ],
          <>
            <DrillTable B={B} columns={[
              { key: "planName", label: "Plan" },
              { key: "count", label: "Clients", align: "right", sortVal: r => r.count },
              { key: "priceEach", label: "Price Each", align: "right", render: r => fmtDollar(r.priceEach), sortVal: r => r.priceEach },
              { key: "total", label: "Total", align: "right", render: r => fmtDollar(r.total), sortVal: r => r.total },
            ]} rows={rows} />
            <div style={{ textAlign: "right", padding: "12px", borderTop: "2px solid " + B.border, fontWeight: 800, fontSize: 15, color: B.text }}>
              Grand Total: {fmtDollar(grandTotal)}
            </div>
          </>
        );
      }

      case "cash_collected": {
        const rows = paidPaymentsInPeriod.map((p, i) => {
          const m = members.find(x => x.id === p.memberId || `${x.firstName} ${x.lastName}` === p.member);
          return {
            _key: p.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (p.member || "Unknown"),
            date: p.date || p.timestamp || p.createdAt,
            amount: Number(p.amount) || 0,
            type: p.type || p.description || "--",
          };
        });
        return wrapper(
          "Cash Collected",
          fmtDollar(cashCollected),
          [
            { label: "Total Collected", value: fmtDollar(cashCollected) },
            { label: "Payments", value: rows.length },
            { label: "Avg Payment", value: fmtDollar(rows.length > 0 ? cashCollected / rows.length : 0) },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Member" },
            { key: "date", label: "Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
            { key: "amount", label: "Amount", align: "right", render: r => fmtDollar(r.amount), sortVal: r => r.amount },
            { key: "type", label: "Type" },
          ]} rows={rows} />
        );
      }

      case "feo_collected": {
        const rows = feoPayments.map((p, i) => {
          const m = members.find(x => x.id === p.memberId || `${x.firstName} ${x.lastName}` === p.member);
          const startDate = m ? (m.startDate || m.createdAt) : null;
          const payDate = p.date || p.timestamp || p.createdAt;
          const daysIn = startDate && payDate ? daysBetween(new Date(startDate), new Date(payDate)) : "?";
          return {
            _key: p.id || i,
            name: m ? `${m.firstName} ${m.lastName}` : (p.member || "Unknown"),
            date: payDate,
            amount: Number(p.amount) || 0,
            daysIn: daysIn,
          };
        });
        return wrapper(
          "FEO Collected (First 30 Days)",
          fmtDollar(feoCollected),
          [
            { label: "FEO Total", value: fmtDollar(feoCollected) },
            { label: "FEO Payments", value: rows.length },
          ],
          <DrillTable B={B} columns={[
            { key: "name", label: "Member" },
            { key: "date", label: "Payment Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
            { key: "amount", label: "Amount", align: "right", render: r => fmtDollar(r.amount), sortVal: r => r.amount },
            { key: "daysIn", label: "Day #", align: "right", render: r => `Day ${r.daysIn}` },
          ]} rows={rows} />
        );
      }

      case "roas": {
        return wrapper(
          "Return on Ad Spend (ROAS)",
          roas.toFixed(2) + "x",
          [
            { label: "Cash Collected", value: fmtDollar(cashCollected), color: "#22c55e" },
            { label: "Ad Spend", value: fmtDollar(effectiveAdSpend), color: "#ef4444" },
            { label: "ROAS", value: roas.toFixed(2) + "x", color: roas >= 5 ? "#22c55e" : roas >= 3 ? "#f59e0b" : "#ef4444" },
          ],
          <div style={{ padding: 20, fontSize: 14, color: B.text, lineHeight: 2 }}>
            <div style={{
              padding: 20, borderRadius: 10, background: B.accent + "08",
              border: "1px solid " + B.border, marginBottom: 16,
            }}>
              <strong>ROAS Calculation</strong><br />
              Cash Collected: {fmtDollar(cashCollected)}<br />
              Ad Spend: {fmtDollar(effectiveAdSpend)}<br />
              <strong>ROAS = {fmtDollar(cashCollected)} / {fmtDollar(effectiveAdSpend)} = {roas.toFixed(2)}x</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{
                padding: 16, borderRadius: 8, textAlign: "center",
                background: "#22c55e12", border: "1px solid #22c55e30",
              }}>
                <div style={{ fontSize: 11, color: B.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Revenue</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#22c55e" }}>{fmtDollar(cashCollected)}</div>
              </div>
              <div style={{
                padding: 16, borderRadius: 8, textAlign: "center",
                background: "#ef444412", border: "1px solid #ef444430",
              }}>
                <div style={{ fontSize: 11, color: B.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Ad Spend</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#ef4444" }}>{fmtDollar(effectiveAdSpend)}</div>
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: B.dim }}>
              For every $1 spent on ads, you earned {fmtDollar(roas)} back.
              {roas >= 5 ? " Excellent performance!" : roas >= 3 ? " Solid performance." : " Consider optimizing ad spend."}
            </div>
          </div>
        );
      }

      /* ---- Funnel drill-downs ---- */
      case "funnel_total_leads": {
        const rows = leadsInPeriod.map((l, i) => ({
          _key: l.id || i,
          name: l.name || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown",
          email: l.email || "--",
          phone: l.phone || "--",
          stage: l.stage || "--",
          source: l.source || "--",
          date: l.createdAt || l.date,
        }));
        return wrapper(
          "Total Leads",
          String(totalLeads),
          [
            { label: "Total Leads", value: totalLeads, color: "#3b82f6" },
            { label: "Cost Per Lead", value: fmtDollar(costPerLead) },
            { label: "Ad Spend", value: fmtDollar(effectiveAdSpend) },
          ],
          hasManualFunnelData && !hasCrmData ? (
            <div style={{ padding: 24, textAlign: "center", color: B.dim, fontSize: 13 }}>Manual data: {totalLeads} total leads. CRM detail not available.</div>
          ) : (
            <DrillTable B={B} columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "stage", label: "Stage" },
              { key: "source", label: "Source" },
              { key: "date", label: "Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
            ]} rows={rows} />
          )
        );
      }

      case "funnel_jumpstarts": {
        const stageConf = funnelStageConfig.find(s => s.id === "jumpstarts");
        const filtered = leadsInPeriod.filter(l => l.stage !== "new");
        const rows = filtered.map((l, i) => ({
          _key: l.id || i,
          name: l.name || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown",
          email: l.email || "--",
          stage: l.stage || "--",
          source: l.source || "--",
          date: l.createdAt || l.date,
        }));
        const summaryStats = [{ label: "Jumpstarts", value: totalJumpstarts, color: "#f59e0b" }];
        if (stageConf?.hasSubMetrics && hasManualFunnelData) {
          (stageConf.subLabels || ["Booked", "Showed", "Closed"]).forEach(sub => {
            summaryStats.push({ label: sub, value: getSubVal("jumpstarts", sub), color: "#f59e0b" });
          });
        }
        return wrapper(
          stageConf?.label || "Total Jumpstarts",
          String(totalJumpstarts),
          summaryStats,
          hasManualFunnelData && !hasCrmData ? (
            <div style={{ padding: 24, textAlign: "center", color: B.dim, fontSize: 13 }}>Manual data: {totalJumpstarts} total. CRM detail not available.</div>
          ) : (
            <DrillTable B={B} columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "stage", label: "Stage" },
              { key: "source", label: "Source" },
              { key: "date", label: "Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
            ]} rows={rows} />
          )
        );
      }

      case "funnel_jumpstart_closes": {
        const filtered = leadsInPeriod.filter(l => l.stage === "trial" || l.stage === "won" || l.stage === "negotiation");
        const rows = filtered.map((l, i) => ({
          _key: l.id || i,
          name: l.name || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown",
          email: l.email || "--",
          stage: l.stage || "--",
          source: l.source || "--",
          date: l.createdAt || l.date,
        }));
        return wrapper(
          "Jumpstart Closes",
          String(jumpstartCloses),
          [{ label: "Jumpstart Closes", value: jumpstartCloses, color: "#a855f7" }],
          <DrillTable B={B} columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "stage", label: "Stage" },
            { key: "source", label: "Source" },
            { key: "date", label: "Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
          ]} rows={rows} />
        );
      }

      case "funnel_strat_sessions": {
        const filtered = leadsInPeriod.filter(l => l.stage === "contacted" || l.stage === "negotiation" || l.stage === "won");
        const rows = filtered.map((l, i) => ({
          _key: l.id || i,
          name: l.name || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown",
          email: l.email || "--",
          stage: l.stage || "--",
          source: l.source || "--",
          date: l.createdAt || l.date,
        }));
        return wrapper(
          "Total Strategy Sessions",
          String(totalStratSessions),
          [{ label: "Strat Sessions", value: totalStratSessions, color: "#eab308" }],
          <DrillTable B={B} columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "stage", label: "Stage" },
            { key: "source", label: "Source" },
            { key: "date", label: "Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
          ]} rows={rows} />
        );
      }

      case "funnel_trial_closes": {
        const stageConf = funnelStageConfig.find(s => s.id === "trial_closes");
        const filtered = leadsInPeriod.filter(l => l.stage === "won");
        const rows = filtered.map((l, i) => ({
          _key: l.id || i,
          name: l.name || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown",
          email: l.email || "--",
          stage: l.stage || "--",
          source: l.source || "--",
          date: l.createdAt || l.date,
        }));
        const summaryStats = [
          { label: "Trial Closes", value: trialCloses, color: "#06b6d4" },
          { label: "Cost Per Trial", value: fmtDollar(costPerTrial) },
        ];
        if (stageConf?.hasSubMetrics && hasManualFunnelData) {
          (stageConf.subLabels || ["Booked", "Showed", "Closed"]).forEach(sub => {
            summaryStats.push({ label: sub, value: getSubVal("trial_closes", sub), color: "#06b6d4" });
          });
        }
        return wrapper(
          stageConf?.label || "Trial Closes",
          String(trialCloses),
          summaryStats,
          hasManualFunnelData && !hasCrmData ? (
            <div style={{ padding: 24, textAlign: "center", color: B.dim, fontSize: 13 }}>Manual data: {trialCloses} total. CRM detail not available.</div>
          ) : (
            <DrillTable B={B} columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "stage", label: "Stage" },
              { key: "source", label: "Source" },
              { key: "date", label: "Date", render: r => fmtDate(r.date), sortVal: r => new Date(r.date || 0).getTime() },
            ]} rows={rows} />
          )
        );
      }

      default: {
        // Handle custom funnel stages (drillType starts with "funnel_")
        if (drillDown.type.startsWith("funnel_")) {
          const stageId = drillDown.type.replace("funnel_", "");
          const stageConf = funnelStageConfig.find(s => s.id === stageId);
          if (stageConf) {
            const val = getFunnelVal(stageId);
            const summaryStats = [{ label: stageConf.label, value: val, color: stageConf.color }];
            if (stageConf.hasSubMetrics && hasManualFunnelData) {
              (stageConf.subLabels || ["Booked", "Showed", "Closed"]).forEach(sub => {
                summaryStats.push({ label: sub, value: getSubVal(stageId, sub), color: stageConf.color });
              });
            }
            return wrapper(
              stageConf.label,
              String(val),
              summaryStats,
              <div style={{ padding: 24, textAlign: "center", color: B.dim, fontSize: 13 }}>
                Manual data: {val} total. Individual records tracked in CRM.
              </div>
            );
          }
        }
        return (
          <div>
            <button onClick={() => setDrillDown(null)} style={backButtonStyle}>
              <span style={{ fontSize: 18 }}>{"\u2190"}</span> Back to Dashboard
            </button>
            <div style={{ padding: 40, textAlign: "center", color: B.dim }}>Detail view not available for this metric.</div>
          </div>
        );
      }
    }
  };

  /* ========== DRILL-DOWN EARLY RETURN ========== */
  if (drillDown) return renderDrillDown();

  return (
    <div>
      {/* ============ SECTION 1: Header + Date Range ============ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: sectionGap, flexWrap: "wrap", gap: 12,
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: 0 }}>Business Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "this_month", label: "This Month" },
            { key: "last_month", label: "Last Month" },
            { key: "this_quarter", label: "This Quarter" },
            { key: "this_year", label: "This Year" },
          ].map(p => (
            <button key={p.key} onClick={() => handlePreset(p.key)} style={{
              ...presetBtnBase,
              background: preset === p.key ? B.accent : "transparent",
              color: preset === p.key ? "#fff" : B.muted,
              borderColor: preset === p.key ? B.accent : B.border,
            }}>{p.label}</button>
          ))}
          <select
            value={selectedPeriod}
            onChange={e => { setSelectedPeriod(e.target.value); setPreset(""); }}
            style={{
              padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: B.card, color: B.text, border: "1px solid " + B.border,
              cursor: "pointer", outline: "none",
            }}
          >
            {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* ============ SECTION 2: Revenue & Membership KPIs (green banner) ============ */}
      <div style={{
        background: "linear-gradient(135deg, #8fbf3b, #6a9a2d)",
        borderRadius: 12, padding: 20, marginBottom: sectionGap,
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
          gap: 14,
        }}>
          {/* Current Recurring */}
          <div onClick={() => setDrillDown({ type: "current_recurring" })} style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10, ...clickableKpi }}>
            <div style={kpiLabelStyle}>Current Recurring</div>
            <div style={kpiValueStyle}>{fmtDollar(currentRecurring)}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>auto from member plans</div>
          </div>

          {/* Recurring Members */}
          <div onClick={() => setDrillDown({ type: "recurring_members" })} style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10, ...clickableKpi }}>
            <div style={kpiLabelStyle}>Recurring Members</div>
            <div style={kpiValueStyle}>{recurringCount}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>active on monthly/annual</div>
          </div>

          {/* New Recurring */}
          <div onClick={() => setDrillDown({ type: "new_recurring" })} style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10, ...clickableKpi }}>
            <div style={kpiLabelStyle}>New Recurring</div>
            <div style={kpiValueStyle}>
              {fmtDollar(newRecurringRevenue)}
              <ChangeIndicator current={newRecurringRevenue} previous={priorNewRecurringRevenue} />
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>from join events</div>
          </div>

          {/* Lost Recurring */}
          <div onClick={() => setDrillDown({ type: "lost_recurring" })} style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10, ...clickableKpi }}>
            <div style={kpiLabelStyle}>Lost Recurring</div>
            <div style={kpiValueStyle}>
              {fmtDollar(lostRecurringRevenue)}
              <ChangeIndicator current={lostRecurringRevenue} previous={priorLostRecurringRevenue} invert />
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>from cancel events</div>
          </div>

          {/* New Clients */}
          <div onClick={() => setDrillDown({ type: "new_members" })} style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10, ...clickableKpi }}>
            <div style={kpiLabelStyle}>New Clients</div>
            <div style={kpiValueStyle}>
              {newMemberCount}
              <ChangeIndicator current={newMemberCount} previous={priorNewMemberCount} />
            </div>
          </div>

          {/* Lost Clients */}
          <div onClick={() => setDrillDown({ type: "lost_members" })} style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10, ...clickableKpi }}>
            <div style={kpiLabelStyle}>Lost Clients</div>
            <div style={kpiValueStyle}>
              {lostMemberCount}
              <ChangeIndicator current={lostMemberCount} previous={priorLostMemberCount} invert />
            </div>
          </div>
        </div>
      </div>

      {/* ============ SECTION 3: Membership Movement (all auto-calculated) ============ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 14, marginBottom: sectionGap,
      }}>
        {/* Active Holds */}
        <Card onClick={() => setDrillDown({ type: "active_holds" })} style={{ padding: 16, textAlign: "center", ...clickableKpi }}>
          <div style={cardLabelStyle}>Active Holds</div>
          <div style={cardValueStyle}>{activeHolds}</div>
          <div style={autoTag}>auto -- from member status</div>
        </Card>

        {/* Holds Set */}
        <Card onClick={() => setDrillDown({ type: "holds_set" })} style={{ padding: 16, textAlign: "center", ...clickableKpi }}>
          <div style={cardLabelStyle}>Holds Set</div>
          <div style={cardValueStyle}>
            {holdsSet}
            <ChangeIndicator current={holdsSet} previous={priorHoldsSet} invert />
          </div>
          <div style={autoTag}>auto -- from freeze events</div>
        </Card>

        {/* Holds Lifted */}
        <Card onClick={() => setDrillDown({ type: "holds_lifted" })} style={{ padding: 16, textAlign: "center", ...clickableKpi }}>
          <div style={cardLabelStyle}>Holds Lifted</div>
          <div style={cardValueStyle}>
            {holdsLifted}
            <ChangeIndicator current={holdsLifted} previous={priorHoldsLifted} />
          </div>
          <div style={autoTag}>auto -- from unfreeze events</div>
        </Card>

        {/* Upgrades */}
        <Card onClick={() => setDrillDown({ type: "upgrades" })} style={{ padding: 16, textAlign: "center", ...clickableKpi }}>
          <div style={cardLabelStyle}>Upgrades</div>
          <div style={cardValueStyle}>
            {upgrades}
            <ChangeIndicator current={upgrades} previous={priorUpgrades} />
          </div>
          <div style={autoTag}>auto -- from upgrade events</div>
        </Card>

        {/* Downgrades */}
        <Card onClick={() => setDrillDown({ type: "downgrades" })} style={{ padding: 16, textAlign: "center", ...clickableKpi }}>
          <div style={cardLabelStyle}>Downgrades</div>
          <div style={cardValueStyle}>
            {downgrades}
            <ChangeIndicator current={downgrades} previous={priorDowngrades} invert />
          </div>
          <div style={autoTag}>auto -- from downgrade events</div>
        </Card>

        {/* Attrition % */}
        <Card onClick={() => setDrillDown({ type: "attrition" })} style={{ padding: 16, textAlign: "center", ...clickableKpi }}>
          <div style={cardLabelStyle}>Attrition %</div>
          <div style={{ ...cardValueStyle, color: attritionPct > 10 ? B.red : attritionPct > 5 ? B.orange : B.green }}>
            {fmtPct(attritionPct)}
          </div>
          <div
            onClick={(e) => { e.stopPropagation(); setShowAttritionDetail(!showAttritionDetail); }}
            style={{ fontSize: 10, color: B.accent, marginTop: 4, cursor: "pointer", textDecoration: "underline" }}
          >
            {showAttritionDetail ? "Hide details" : "See details"}
          </div>
          {showAttritionDetail && (
            <div style={{ fontSize: 10, color: B.dim, marginTop: 6, textAlign: "left", lineHeight: 1.6 }}>
              Lost Clients: {lostMemberCount}<br />
              Starting + New: {startingMembers} + {newMemberCount}<br />
              = {lostMemberCount} / {startingMembers + newMemberCount} = {fmtPct(attritionPct)}
            </div>
          )}
          <div style={autoTag}>auto -- computed</div>
        </Card>
      </div>

      {/* ============ SECTION 4: Sales Funnel + Marketing Metrics ============ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20, marginBottom: sectionGap,
      }}>
        {/* Left: Sales Funnel */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: B.text }}>Sales Funnel</div>
              {crmNote && <div style={{ fontSize: 10, color: B.orange, fontWeight: 600 }}>{crmNote}</div>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowFunnelDataEntry(true)} style={{
                padding: "5px 10px", borderRadius: 6, border: "1px solid " + B.accent,
                background: B.accent + "12", color: B.accent, fontSize: 11, fontWeight: 700,
                cursor: "pointer", transition: "all 0.15s",
              }}>Enter Data</button>
              <button onClick={() => setShowFunnelEditor(true)} style={{
                padding: "5px 10px", borderRadius: 6, border: "1px solid " + B.border,
                background: "transparent", color: B.dim, fontSize: 11, fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
              }}>Edit Funnel</button>
            </div>
          </div>
          <SalesFunnel stages={funnelStages} B={B} onStageClick={(stage) => setDrillDown({ type: stage.drillType })} />
          {/* Sub-metric rows for stages that have them */}
          {funnelStageConfig.filter(s => s.hasSubMetrics && hasManualFunnelData).map(stage => {
            const subs = (stage.subLabels || ["Booked", "Showed", "Closed"]);
            const booked = getSubVal(stage.id, "Booked");
            const showed = getSubVal(stage.id, "Showed");
            const showRate = booked > 0 ? Math.round((showed / booked) * 100) : 0;
            return (
              <div key={stage.id + "_sub"} style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: stage.color + "08", border: "1px solid " + stage.color + "20" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: stage.color, minWidth: 100 }}>{stage.label}:</span>
                  {subs.map(sub => (
                    <span key={sub} style={{ fontSize: 11, color: B.dim }}>
                      {sub}: <strong style={{ color: B.text }}>{getSubVal(stage.id, sub)}</strong>
                    </span>
                  ))}
                  <span style={{ fontSize: 11, color: B.dim }}>|</span>
                  <span style={{ fontSize: 11, color: showRate >= 70 ? "#22c55e" : showRate >= 50 ? "#f59e0b" : B.red, fontWeight: 700 }}>
                    Show Rate: {showRate}%
                  </span>
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 9, color: B.dim, marginTop: 10, textAlign: "center" }}>
            {funnelDataSource === "manual" ? "Manual data" : funnelDataSource === "crm" ? `CRM data (${hasCrmData ? "connected" : "no data"})` : "No data -- click Enter Data"}
            {funnelDataSource !== "manual" && " | New Clients from event log"}
          </div>
        </Card>

        {/* Right: Marketing Metrics */}
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 16 }}>Marketing Metrics</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}>
            {/* Row 1 */}
            <MiniKpi label="Ad Spend" B={B} value={effectiveAdSpend} prefix="$" calculated note="from funnel data" />
            <MiniKpi label="Cost Per Lead" B={B} value={costPerLead} prefix="$" calculated note={totalLeads === 0 ? "needs leads" : ""} onClick={() => setDrillDown({ type: "funnel_total_leads" })} />
            <MiniKpi label="Total Leads" B={B} value={totalLeads} calculated note={hasManualFunnelData ? "manual" : (crmNote || "from CRM")} onClick={() => setDrillDown({ type: "funnel_total_leads" })} />
            <MiniKpi label="Total Strat Sessions" B={B} value={totalStratSessions} calculated note={hasManualFunnelData ? "manual" : (crmNote || "from CRM")} onClick={() => setDrillDown({ type: "funnel_strat_sessions" })} />

            {/* Row 2 */}
            <MiniKpi label="Cost Per Trial" B={B} value={costPerTrial} prefix="$" calculated note={trialCloses === 0 ? "needs trials" : ""} onClick={() => setDrillDown({ type: "funnel_trial_closes" })} />
            <MiniKpi label="Cost Per New Client" B={B} value={costPerNewMember} prefix="$" calculated onClick={() => setDrillDown({ type: "new_members" })} />
            <MiniKpi label="Total Jumpstarts" B={B} value={totalJumpstarts} calculated note={hasManualFunnelData ? "manual" : (crmNote || "from CRM")} onClick={() => setDrillDown({ type: "funnel_jumpstarts" })} />
            <MiniKpi label="Jumpstart Closes" B={B} value={jumpstartCloses} calculated note={hasManualFunnelData ? "manual" : (crmNote || "from CRM")} onClick={() => setDrillDown({ type: "funnel_jumpstart_closes" })} />

            {/* Row 3 */}
            <MiniKpi label="Trial Closes" B={B} value={trialCloses} calculated note={hasManualFunnelData ? "manual" : (crmNote || "from CRM")} onClick={() => setDrillDown({ type: "funnel_trial_closes" })} />
            <MiniKpi label="New Clients" B={B} value={newMemberCount} calculated note="from events" onClick={() => setDrillDown({ type: "new_members" })} />
            <div />
            <div />

            {/* Sub-metric rows for stages that have them */}
            {hasManualFunnelData && funnelStageConfig.filter(s => s.hasSubMetrics).map(stage => {
              const subs = (stage.subLabels || ["Booked", "Showed", "Closed"]);
              return subs.map(sub => {
                const subKey = `${stage.id}_${sub.toLowerCase()}`;
                const val = funnelPeriodData[subKey] || 0;
                return (
                  <MiniKpi key={subKey} label={`${stage.label} ${sub}`} B={B} value={val} calculated note="manual" />
                );
              });
            })}
          </div>
          <div style={{ fontSize: 9, color: B.dim, marginTop: 10, textAlign: "center" }}>
            {hasManualFunnelData ? "Funnel numbers from manual entry" : "All data is auto-calculated. Enter funnel data to populate."}
          </div>
        </Card>
      </div>

      {/* ============ SECTION 5: Financial Summary ============ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14, marginBottom: sectionGap,
      }}>
        <Card onClick={() => setDrillDown({ type: "cash_collected" })} style={{ padding: 16, textAlign: "center", ...clickableKpi }}>
          <div style={cardLabelStyle}>Cash Collected</div>
          <div style={cardValueStyle}>{fmtDollar(cashCollected)}</div>
          <div style={autoTag}>auto -- from paid payments</div>
        </Card>

        <Card onClick={() => setDrillDown({ type: "feo_collected" })} style={{ padding: 16, textAlign: "center", ...clickableKpi }}>
          <div style={cardLabelStyle}>FEO Collected</div>
          <div style={cardValueStyle}>{fmtDollar(feoCollected)}</div>
          <div style={autoTag}>auto -- first 30 day payments</div>
        </Card>

        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>Ad Spend</div>
          <div style={cardValueStyle}>
            <EditableNumber value={effectiveAdSpend} prefix="$" onChange={updateAdSpend} />
          </div>
          <div style={{ fontSize: 9, color: B.orange, marginTop: 4, fontWeight: 600 }}>manual entry</div>
        </Card>

        <Card onClick={() => setDrillDown({ type: "roas" })} style={{ padding: 16, textAlign: "center", ...clickableKpi }}>
          <div style={cardLabelStyle}>ROAS</div>
          <div style={{ ...cardValueStyle, color: roas >= 5 ? "#22c55e" : roas >= 3 ? B.orange : B.red }}>
            {roas.toFixed(2)}x
          </div>
          <div style={autoTag}>auto -- cash / ad spend</div>
        </Card>
      </div>

      {/* ============ Member Engagement Alerts ============ */}
      <MemberEngagementAlerts members={members} attendance={attendance} plans={plans} B={B} navigate={navigate} />

      {/* ============ Quick Actions ============ */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {quickActions.map((qa) => (
          <button key={qa.path} onClick={() => navigate(_gp(qa.path.replace(/^\//, "")))}
            style={{
              flex: 1, minWidth: 140, padding: "14px 16px", borderRadius: 10,
              border: "1px solid " + B.border, background: B.card, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10, transition: "all .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = qa.color; e.currentTarget.style.background = qa.color + "10"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = B.border; e.currentTarget.style.background = B.card; }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: 8, background: qa.color + "20", color: qa.color,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, flexShrink: 0,
            }}>{qa.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: B.text }}>{qa.label}</span>
          </button>
        ))}
      </div>

      {/* ============ Today's Schedule + Recent Activity ============ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* Recent Activity */}
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 12 }}>Recent Activity</div>
          {recentActivity.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: B.dim, fontSize: 13 }}>
              No activity recorded yet. Check-ins, signups, and payments will appear here.
            </div>
          ) : (
            recentActivity.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid " + B.border + "40" }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: item.dot, marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: B.text, lineHeight: 1.4 }}>{item.text}</div>
                  <div style={{ fontSize: 11, color: B.dim, marginTop: 2 }}>{timeAgo(item.time)}</div>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Today's Schedule */}
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 12 }}>Today's Schedule</div>
          {todayClasses.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: B.dim, fontSize: 13 }}>
              No classes scheduled for {todayDay}. Add classes in the Schedule section.
            </div>
          ) : (
            todayClasses.map((cls, i) => {
              const booked = cls.bookedCount ?? cls.memberIds?.length ?? 0;
              const cap = cls.capacity || "--";
              return (
                <div key={i} style={{
                  padding: "12px 0", borderBottom: i < todayClasses.length - 1 ? "1px solid " + B.border + "40" : "none",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{
                    width: 48, textAlign: "center", padding: "6px 0", borderRadius: 8,
                    background: B.accent + "15", color: B.accent, fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {cls.time || "--"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: B.text }}>{cls.name || cls.title || "Session"}</div>
                    <div style={{ fontSize: 11, color: B.dim }}>{booked}/{cap} booked</div>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* ============ Funnel Editor Modal ============ */}
      {showFunnelEditor && (
        <FunnelEditorModal
          stages={funnelStageConfig}
          onSave={saveFunnelStages}
          onClose={() => setShowFunnelEditor(false)}
          B={B}
        />
      )}

      {/* ============ Funnel Data Entry Modal ============ */}
      {showFunnelDataEntry && (
        <FunnelDataEntryModal
          stages={funnelStageConfig}
          allFunnelData={salesFunnel.data || {}}
          period={periodOptions.find(o => o.value === selectedPeriod)?.label || selectedPeriod}
          cashCollected={cashCollected}
          onSave={(data, pk) => saveFunnelData(pk || selectedPeriod, data)}
          onClose={() => setShowFunnelDataEntry(false)}
          B={B}
        />
      )}
    </div>
  );
}
