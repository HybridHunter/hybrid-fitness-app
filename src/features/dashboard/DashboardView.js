import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ========== helpers ========== */
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(d) {
  const dt = new Date(d);
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

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

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** Get YYYY-MM string from a Date */
function periodKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Check if an ISO date falls within [start, end] range */
function inRange(iso, start, end) {
  if (!iso) return false;
  const d = new Date(iso);
  return d >= start && d <= end;
}

/** Get start/end Date objects for a YYYY-MM period */
function periodRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Get the prior period YYYY-MM */
function priorPeriod(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return periodKey(d);
}

/* ========== Demo metrics data ========== */
const DEMO_METRICS = [
  {
    period: "2026-03",
    holdsSet: 28,
    holdsLifted: 22,
    upgrades: 3,
    downgrades: 2,
    totalLeads: 54,
    totalJumpstarts: 32,
    jumpstartCloses: 19,
    totalStratSessions: 21,
    trialCloses: 18,
    newTrials: 16,
    adSpend: 1987.50,
    costPerCall: 48.75,
    cashCollected: 12450,
    feoCollected: 5890,
  },
  {
    period: "2026-04",
    holdsSet: 37,
    holdsLifted: 37,
    upgrades: 1,
    downgrades: 1,
    totalLeads: 68,
    totalJumpstarts: 41,
    jumpstartCloses: 25,
    totalStratSessions: 26,
    trialCloses: 23,
    newTrials: 22,
    adSpend: 2333.69,
    costPerCall: 56.92,
    cashCollected: 14981,
    feoCollected: 7576,
  },
];

const EMPTY_METRICS = {
  holdsSet: 0, holdsLifted: 0, upgrades: 0, downgrades: 0,
  totalLeads: 0, totalJumpstarts: 0, jumpstartCloses: 0,
  totalStratSessions: 0, trialCloses: 0, newTrials: 0,
  adSpend: 0, costPerCall: 0, cashCollected: 0, feoCollected: 0,
};

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

/* ========== Inline Editable Number ========== */
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
          <span style={{ fontSize: 14, fontWeight: 700, color: B.text }}>Member Engagement Alerts</span>
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
                  onSendMessage={() => navigate("/messages")} onDismiss={() => dismissAlert(a.alertKey)} onClickMember={() => navigate(`/members/${a.member.id}`)} />
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
                  onSendMessage={() => navigate("/messages")} onDismiss={() => dismissAlert(a.alertKey)} onClickMember={() => navigate(`/members/${a.member.id}`)} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ========== Sales Funnel (CSS-based) ========== */
function SalesFunnel({ stages, B }) {
  const maxVal = stages[0]?.count || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center", width: "100%" }}>
      {stages.map((stage, i) => {
        const pct = maxVal > 0 ? (stage.count / maxVal) * 100 : 0;
        const widthPct = Math.max(20, 20 + (80 * (stages.length - 1 - i) / (stages.length - 1)));
        const invertedWidth = Math.max(20, 20 + (80 * ((stages.length - 1 - i) / (stages.length - 1))));
        const actualWidth = 100 - (i / (stages.length - 1)) * 80;
        return (
          <div key={stage.label} style={{
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

/* ========== Main Dashboard ========== */
export default function DashboardView() {
  const B = useTheme();
  const navigate = useNavigate();
  const { members } = useMembers();
  const [attendance] = useLocalStorage("hf_attendance", []);
  const [plans] = useLocalStorage("hf_plans", []);
  const [schedule] = useLocalStorage("hf_schedule", []);
  const [payments] = useLocalStorage("hf_payments", []);
  const [allMetrics, setAllMetrics] = useLocalStorage("hf_dashboard_metrics", DEMO_METRICS);

  /* ---- Date range state ---- */
  const now = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState(periodKey(now));
  const [preset, setPreset] = useState("this_month");

  const { start: rangeStart, end: rangeEnd } = periodRange(selectedPeriod);
  const prior = priorPeriod(selectedPeriod);
  const { start: priorStart, end: priorEnd } = periodRange(prior);

  /* ---- Metrics for current & prior period ---- */
  const currentMetrics = useMemo(() => {
    const found = allMetrics.find(m => m.period === selectedPeriod);
    return found || { period: selectedPeriod, ...EMPTY_METRICS };
  }, [allMetrics, selectedPeriod]);

  const priorMetrics = useMemo(() => {
    const found = allMetrics.find(m => m.period === prior);
    return found || { period: prior, ...EMPTY_METRICS };
  }, [allMetrics, prior]);

  const updateMetric = (key, value) => {
    setAllMetrics(prev => {
      const idx = prev.findIndex(m => m.period === selectedPeriod);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], [key]: value };
        return updated;
      }
      return [...prev, { period: selectedPeriod, ...EMPTY_METRICS, [key]: value }];
    });
  };

  /* ---- Member-derived KPIs ---- */
  const activeMembersAll = members.filter(m => m.membershipStatus === "active");
  const frozenMembers = members.filter(m => m.membershipStatus === "frozen");

  // Members with a recurring plan (not per-session / drop-in)
  const recurringPlans = plans.filter(p => p.billingCycle === "monthly");
  const recurringPlanIds = new Set(recurringPlans.map(p => p.id));

  const recurringMembers = activeMembersAll.filter(m => {
    if (m.membershipPlanId && recurringPlanIds.has(m.membershipPlanId)) return true;
    // If no plan assigned but active, count them as recurring for demo purposes
    if (!m.membershipPlanId && m.membershipStatus === "active") return true;
    return false;
  });

  const getMemberPlanPrice = (m) => {
    const plan = plans.find(p => p.id === m.membershipPlanId);
    if (plan) return plan.price || 0;
    // Default price for demo members without assigned plans
    return 149;
  };

  const currentRecurring = recurringMembers.reduce((sum, m) => sum + getMemberPlanPrice(m), 0);
  const recurringCount = recurringMembers.length;

  // New members in selected period
  const newMembersInPeriod = members.filter(m => inRange(m.createdAt || m.startDate, rangeStart, rangeEnd));
  const newMembersInPrior = members.filter(m => inRange(m.createdAt || m.startDate, priorStart, priorEnd));
  const newMemberCount = newMembersInPeriod.length;
  const priorNewMemberCount = newMembersInPrior.length;

  // New recurring revenue
  const newRecurringRevenue = newMembersInPeriod.filter(m => m.membershipStatus === "active" || m.membershipStatus === "trial").reduce((sum, m) => sum + getMemberPlanPrice(m), 0);
  const priorNewRecurringRevenue = newMembersInPrior.filter(m => m.membershipStatus === "active" || m.membershipStatus === "trial").reduce((sum, m) => sum + getMemberPlanPrice(m), 0);

  // Lost members (inactive in period)
  const lostMembers = members.filter(m => m.membershipStatus === "inactive");
  const lostMemberCount = lostMembers.length;
  const lostRecurringRevenue = lostMembers.reduce((sum, m) => sum + getMemberPlanPrice(m), 0);

  // Attrition calculation
  const attritionPct = (recurringCount + newMemberCount) > 0
    ? (lostMemberCount / (recurringCount + newMemberCount)) * 100
    : 0;

  /* ---- Funnel stages ---- */
  const funnelStages = [
    { label: "Total Leads", count: currentMetrics.totalLeads, color: "#3b82f6" },
    { label: "Total Jumpstarts", count: currentMetrics.totalJumpstarts, color: "#f59e0b" },
    { label: "Jumpstart Closes", count: currentMetrics.jumpstartCloses, color: "#a855f7" },
    { label: "Total Strat Sessions", count: currentMetrics.totalStratSessions, color: "#eab308" },
    { label: "Trial Closes", count: currentMetrics.trialCloses, color: "#06b6d4" },
    { label: "New Members", count: newMemberCount || currentMetrics.newTrials, color: "#22c55e" },
  ];

  /* ---- Marketing calculated values ---- */
  const costPerLead = currentMetrics.totalLeads > 0 ? currentMetrics.adSpend / currentMetrics.totalLeads : 0;
  const costPerTrial = currentMetrics.trialCloses > 0 ? currentMetrics.adSpend / currentMetrics.trialCloses : 0;
  const costPerNewMember = (newMemberCount || currentMetrics.newTrials) > 0
    ? currentMetrics.adSpend / (newMemberCount || currentMetrics.newTrials)
    : 0;
  const roas = currentMetrics.adSpend > 0 ? currentMetrics.cashCollected / currentMetrics.adSpend : 0;

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

  /* ---- Quick Actions ---- */
  const quickActions = [
    { label: "New Workout", icon: "\u2795", path: "/build", color: B.accent },
    { label: "Check In", icon: "\u2713", path: "/checkin", color: B.green },
    { label: "Add Member", icon: "\u263A", path: "/members", color: B.blue },
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

  return (
    <div>
      {/* ============ SECTION 1: Header + Date Range ============ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: sectionGap, flexWrap: "wrap", gap: 12,
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: 0 }}>Hybrid Fitness Dashboard</h1>
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
          <div style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10 }}>
            <div style={kpiLabelStyle}>Current Recurring</div>
            <div style={kpiValueStyle}>{fmtDollar(currentRecurring)}</div>
          </div>

          {/* Recurring Members */}
          <div style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10 }}>
            <div style={kpiLabelStyle}>Recurring Members</div>
            <div style={kpiValueStyle}>{recurringCount}</div>
          </div>

          {/* New Recurring */}
          <div style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10 }}>
            <div style={kpiLabelStyle}>New Recurring</div>
            <div style={kpiValueStyle}>
              {fmtDollar(newRecurringRevenue)}
              <ChangeIndicator current={newRecurringRevenue} previous={priorNewRecurringRevenue} />
            </div>
          </div>

          {/* Lost Recurring */}
          <div style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10 }}>
            <div style={kpiLabelStyle}>Lost Recurring</div>
            <div style={kpiValueStyle}>
              {fmtDollar(lostRecurringRevenue)}
              <ChangeIndicator current={lostRecurringRevenue} previous={0} invert />
            </div>
          </div>

          {/* New Members */}
          <div style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10 }}>
            <div style={kpiLabelStyle}>New Members</div>
            <div style={kpiValueStyle}>
              {newMemberCount}
              <ChangeIndicator current={newMemberCount} previous={priorNewMemberCount} />
            </div>
          </div>

          {/* Lost Members */}
          <div style={{ padding: 16, background: "rgba(255,255,255,0.12)", borderRadius: 10 }}>
            <div style={kpiLabelStyle}>Lost Members</div>
            <div style={kpiValueStyle}>
              {lostMemberCount}
              <ChangeIndicator current={lostMemberCount} previous={0} invert />
            </div>
          </div>
        </div>
      </div>

      {/* ============ SECTION 3: Membership Movement ============ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 14, marginBottom: sectionGap,
      }}>
        {/* Active Holds (auto) */}
        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>Active Holds</div>
          <div style={cardValueStyle}>{frozenMembers.length}</div>
          <div style={{ fontSize: 10, color: B.dim, marginTop: 4 }}>auto-calculated</div>
        </Card>

        {/* Holds Set (editable) */}
        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>Holds Set</div>
          <div style={cardValueStyle}>
            <EditableNumber value={currentMetrics.holdsSet} onChange={v => updateMetric("holdsSet", v)} />
          </div>
        </Card>

        {/* Holds Lifted (editable) */}
        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>Holds Lifted</div>
          <div style={cardValueStyle}>
            <EditableNumber value={currentMetrics.holdsLifted} onChange={v => updateMetric("holdsLifted", v)} />
          </div>
        </Card>

        {/* Upgrades (editable) */}
        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>Upgrades</div>
          <div style={cardValueStyle}>
            <EditableNumber value={currentMetrics.upgrades} onChange={v => updateMetric("upgrades", v)} />
          </div>
        </Card>

        {/* Downgrades (editable) */}
        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>Downgrades</div>
          <div style={cardValueStyle}>
            <EditableNumber value={currentMetrics.downgrades} onChange={v => updateMetric("downgrades", v)} />
          </div>
        </Card>

        {/* Attrition % */}
        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>Attrition %</div>
          <div style={{ ...cardValueStyle, color: attritionPct > 10 ? B.red : attritionPct > 5 ? B.orange : B.green }}>
            {fmtPct(attritionPct)}
          </div>
          <div
            onClick={() => setShowAttritionDetail(!showAttritionDetail)}
            style={{ fontSize: 10, color: B.accent, marginTop: 4, cursor: "pointer", textDecoration: "underline" }}
          >
            {showAttritionDetail ? "Hide details" : "See details"}
          </div>
          {showAttritionDetail && (
            <div style={{ fontSize: 10, color: B.dim, marginTop: 6, textAlign: "left", lineHeight: 1.6 }}>
              Lost Members: {lostMemberCount}<br />
              Recurring at Start + New: {recurringCount} + {newMemberCount}<br />
              = {lostMemberCount} / {recurringCount + newMemberCount} = {fmtPct(attritionPct)}
            </div>
          )}
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
          <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 16 }}>Sales Funnel</div>
          <SalesFunnel stages={funnelStages} B={B} />
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
            <MiniKpi label="Ad Spend" B={B} editable value={currentMetrics.adSpend} prefix="$" onChange={v => updateMetric("adSpend", v)} />
            <MiniKpi label="Cost Per Deposit" B={B} editable value={currentMetrics.costPerCall} prefix="$" onChange={v => updateMetric("costPerCall", v)} />
            <MiniKpi label="Total Leads" B={B} editable value={currentMetrics.totalLeads} onChange={v => updateMetric("totalLeads", v)} />
            <MiniKpi label="Total Strat Sessions" B={B} editable value={currentMetrics.totalStratSessions} onChange={v => updateMetric("totalStratSessions", v)} />

            {/* Row 2 */}
            <MiniKpi label="Cost Per Lead" B={B} value={costPerLead} prefix="$" calculated />
            <MiniKpi label="Cost Per Trial" B={B} value={costPerTrial} prefix="$" calculated />
            <MiniKpi label="Total Jumpstarts" B={B} editable value={currentMetrics.totalJumpstarts} onChange={v => updateMetric("totalJumpstarts", v)} />
            <MiniKpi label="New Trials" B={B} editable value={currentMetrics.newTrials} onChange={v => updateMetric("newTrials", v)} />

            {/* Row 3 */}
            <MiniKpi label="Cost Per Call" B={B} editable value={currentMetrics.costPerCall} prefix="$" onChange={v => updateMetric("costPerCall", v)} />
            <MiniKpi label="Cost Per New Member" B={B} value={costPerNewMember} prefix="$" calculated />
            <MiniKpi label="Jumpstart Closes" B={B} editable value={currentMetrics.jumpstartCloses} onChange={v => updateMetric("jumpstartCloses", v)} />
            <MiniKpi label="New Members" B={B} value={newMemberCount || currentMetrics.newTrials} calculated />
          </div>
        </Card>
      </div>

      {/* ============ SECTION 5: Financial Summary ============ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14, marginBottom: sectionGap,
      }}>
        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>Cash Collected</div>
          <div style={cardValueStyle}>
            <EditableNumber value={currentMetrics.cashCollected} prefix="$" onChange={v => updateMetric("cashCollected", v)} />
          </div>
        </Card>

        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>FEO Collected</div>
          <div style={cardValueStyle}>
            <EditableNumber value={currentMetrics.feoCollected} prefix="$" onChange={v => updateMetric("feoCollected", v)} />
          </div>
        </Card>

        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>Ad Spend</div>
          <div style={cardValueStyle}>{fmtDollar(currentMetrics.adSpend)}</div>
        </Card>

        <Card style={{ padding: 16, textAlign: "center" }}>
          <div style={cardLabelStyle}>ROAS</div>
          <div style={{ ...cardValueStyle, color: roas >= 5 ? "#22c55e" : roas >= 3 ? B.orange : B.red }}>
            {roas.toFixed(2)}x
          </div>
        </Card>
      </div>

      {/* ============ Member Engagement Alerts ============ */}
      <MemberEngagementAlerts members={members} attendance={attendance} plans={plans} B={B} navigate={navigate} />

      {/* ============ Quick Actions ============ */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {quickActions.map((qa) => (
          <button key={qa.path} onClick={() => navigate(qa.path)}
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
                    <div style={{ fontWeight: 600, fontSize: 13, color: B.text }}>{cls.name || cls.title || "Class"}</div>
                    <div style={{ fontSize: 11, color: B.dim }}>{booked}/{cap} booked</div>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}

/* ========== Mini KPI Card for Marketing Grid ========== */
function MiniKpi({ label, value, prefix = "", editable = false, calculated = false, onChange, B }) {
  const displayVal = prefix
    ? prefix + Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: (value || 0) % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })
    : Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: (value || 0) % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 });

  return (
    <div style={{
      padding: 10, borderRadius: 8,
      border: "1px solid " + B.border,
      background: calculated ? B.accent + "08" : "transparent",
      textAlign: "center",
    }}>
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
    </div>
  );
}
