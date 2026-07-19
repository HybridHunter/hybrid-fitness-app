import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Legend,
} from "recharts";

/* ══════════════════════════════════════════════════════
   DATA HELPERS — build chart data from real localStorage data
   ══════════════════════════════════════════════════════ */
const HOURS = ["6 AM","7 AM","8 AM","9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM","6 PM","7 PM","8 PM"];
const DAYS_WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const PLAN_COLORS = ["#8fbf3b","#063461","#a855f7","#f59e0b","#ef4444","#06b6d4","#ec4899"];

function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("default", { month: "short" }) + " " + String(d.getFullYear()).slice(2);
    months.push({ date: d, label, key: d.toISOString().slice(0, 7) });
  }
  return months;
}

function buildRevenueByMonth(payments) {
  const months = getLast12Months();
  return months.map(m => {
    const revenue = payments.filter(p => p.status === "paid" && p.date && p.date.startsWith(m.key)).reduce((s, p) => s + (p.amount || 0), 0);
    return { month: m.label, revenue };
  });
}

function buildRevenueByPlan(payments, plans) {
  const planTotals = {};
  payments.filter(p => p.status === "paid").forEach(p => {
    const planName = p.plan || "Other";
    planTotals[planName] = (planTotals[planName] || 0) + (p.amount || 0);
  });
  return Object.entries(planTotals).map(([name, value], i) => ({ name, value, color: PLAN_COLORS[i % PLAN_COLORS.length] }));
}

function buildSignUpsByMonth(events) {
  const months = getLast12Months();
  return months.map(m => {
    const signUps = events.filter(e => (e.type === "sign_up" || e.type === "plan_change") && e.date && e.date.startsWith(m.key)).length;
    return { month: m.label, signUps };
  });
}

function buildSignUpsCancellations(events) {
  const months = getLast12Months();
  return months.map(m => {
    const signUps = events.filter(e => (e.type === "sign_up" || e.type === "plan_change" || e.type === "upgrade") && e.date && e.date.startsWith(m.key)).length;
    const cancellations = events.filter(e => (e.type === "cancellation" || e.type === "downgrade") && e.date && e.date.startsWith(m.key)).length;
    return { month: m.label, signUps, cancellations };
  });
}

function buildMemberGrowth(members) {
  const months = getLast12Months();
  return months.map(m => {
    const endOfMonth = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0);
    const total = members.filter(mb => {
      if (!mb.startDate) return false;
      return new Date(mb.startDate) <= endOfMonth && !!mb.membershipPlanId;
    }).length;
    return { month: m.label, total };
  });
}

function buildMemberStatusDist(members) {
  const counts = { active: 0, trial: 0, frozen: 0, inactive: 0 };
  members.forEach(m => { if (counts[m.membershipStatus] !== undefined) counts[m.membershipStatus]++; else counts.inactive++; });
  return [
    { name: "Active", value: counts.active, color: "#8fbf3b" },
    { name: "Trial", value: counts.trial, color: "#063461" },
    { name: "Frozen", value: counts.frozen, color: "#f59e0b" },
    { name: "Inactive", value: counts.inactive, color: "#ef4444" },
  ].filter(d => d.value > 0);
}

function buildChurnRate(members, events) {
  const months = getLast12Months();
  return months.map(m => {
    const activeAtStart = members.filter(mb => mb.startDate && new Date(mb.startDate) < m.date && !!mb.membershipPlanId).length;
    const cancels = events.filter(e => (e.type === "cancellation" || e.type === "downgrade") && e.date && e.date.startsWith(m.key)).length;
    const rate = activeAtStart > 0 ? Math.round((cancels / activeAtStart) * 1000) / 10 : 0;
    return { month: m.label, rate };
  });
}

function buildAttendanceByDay(attendance) {
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dayCounts = [0,0,0,0,0,0,0];
  const dayDays = new Set();
  attendance.forEach(a => {
    const d = new Date(a.checkInTime || a.date);
    if (isNaN(d)) return;
    dayCounts[d.getDay()]++;
    dayDays.add(d.toISOString().slice(0, 10));
  });
  const totalDays = dayDays.size || 1;
  const reordered = [1,2,3,4,5,6,0]; // Mon-Sun
  return reordered.map(i => ({ day: dayNames[i], avg: Math.round(dayCounts[i] / Math.max(totalDays / 7, 1)) }));
}

function buildCheckInsPerMonth(attendance) {
  const months = getLast12Months();
  return months.map(m => {
    const checkIns = attendance.filter(a => {
      if (a.noShow) return false;
      const d = (a.checkInTime || a.date || "").slice(0, 7);
      return d === m.key;
    }).length;
    return { month: m.label, checkIns };
  });
}

function buildHeatData(attendance) {
  const grid = Array.from({ length: 15 }, () => [0,0,0,0,0,0,0]);
  attendance.forEach(a => {
    const d = new Date(a.checkInTime || a.date);
    if (isNaN(d)) return;
    const hour = d.getHours();
    const dayIdx = d.getDay(); // 0=Sun
    const reorderedDay = dayIdx === 0 ? 6 : dayIdx - 1; // Mon=0..Sun=6
    const hourIdx = hour - 6;
    if (hourIdx >= 0 && hourIdx < 15) grid[hourIdx][reorderedDay]++;
  });
  return grid;
}

function buildTopRevenueMembers(payments, members, plans) {
  const memberTotals = {};
  payments.filter(p => p.status === "paid").forEach(p => {
    const key = p.member || "Unknown";
    if (!memberTotals[key]) memberTotals[key] = { name: key, revenue: 0, plan: p.plan || "---", months: new Set() };
    memberTotals[key].revenue += p.amount || 0;
    if (p.date) memberTotals[key].months.add(p.date.slice(0, 7));
  });
  return Object.values(memberTotals)
    .map(m => ({ ...m, months: m.months.size }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

/* ── Shared Tooltip ────────────────────────────────── */
function ChartTooltip({ B }) {
  return {
    contentStyle: { background: B.card, border: "1px solid " + B.border, borderRadius: 8, fontSize: 12, color: B.text },
    itemStyle: { color: B.text },
    labelStyle: { color: B.muted, fontWeight: 600 },
  };
}

/* ── KPI Card ─────────────────────────────────────── */
function KPI({ label, value, sub, B, color }) {
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || B.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: B.dim, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

/* ── Tab Button ───────────────────────────────────── */
function Tab({ label, active, onClick, B }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
        background: active ? B.accent : "transparent", color: active ? "#fff" : B.muted,
        fontWeight: 700, fontSize: 13, transition: "all 0.2s",
        whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

/* ── Section Wrapper ──────────────────────────────── */
function Section({ title, children, B }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {title && <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, marginBottom: 12 }}>{title}</h3>}
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: OVERVIEW
   ══════════════════════════════════════════════════════ */
function OverviewTab({ B, members, payments, attendance, membershipEvents, plans }) {
  const isMobile = useIsMobile();
  const tt = ChartTooltip({ B });
  const activeCount = members.filter(m => !!m.membershipPlanId).length;
  const revenueData = buildRevenueByMonth(payments);
  const revenueLast6 = revenueData.slice(6);
  const signUpsData = buildSignUpsByMonth(membershipEvents);
  const signUpsLast6 = signUpsData.slice(6);
  const now = new Date();
  const thisMonthKey = now.toISOString().slice(0, 7);
  const monthRevenue = payments.filter(p => p.status === "paid" && p.date && p.date.startsWith(thisMonthKey)).reduce((s, p) => s + (p.amount || 0), 0);
  const last30 = new Date(now); last30.setDate(last30.getDate() - 30);
  const last30Attendance = attendance.filter(a => !a.noShow && new Date(a.checkInTime || a.date) >= last30);
  const avgAttendance = last30Attendance.length > 0 ? (last30Attendance.length / 30).toFixed(1) : "0";
  const churnData = buildChurnRate(members, membershipEvents);
  const latestChurn = churnData.length > 0 ? churnData[churnData.length - 1].rate : 0;
  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });
  const hasRevData = revenueLast6.some(d => d.revenue > 0);
  const hasSignUpData = signUpsLast6.some(d => d.signUps > 0);
  return (
    <>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
        <KPI label="Active Clients" value={activeCount} sub="With active plan" B={B} />
        <KPI label="Monthly Revenue" value={monthRevenue > 0 ? "$" + monthRevenue.toLocaleString() : "$0"} sub={monthName} B={B} />
        <KPI label="Avg Attendance/Day" value={avgAttendance} sub="Last 30 days" B={B} />
        <KPI label="Churn Rate" value={latestChurn + "%"} sub={monthName} B={B} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Section title="Revenue (Last 6 Months)" B={B}>
          <Card style={{ padding: "16px 8px 8px" }}>
            {!hasRevData ? (
              <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No revenue data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueLast6}>
                <CartesianGrid stroke={B.border} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: B.muted, fontSize: 11 }} />
                <YAxis tick={{ fill: B.muted, fontSize: 11 }} tickFormatter={v => "$" + (v / 1000) + "k"} />
                <Tooltip {...tt} formatter={v => ["$" + v.toLocaleString(), "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke={B.accent} strokeWidth={2.5} dot={{ fill: B.accent, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Section>
        <Section title="Client Sign-Ups (Last 6 Months)" B={B}>
          <Card style={{ padding: "16px 8px 8px" }}>
            {!hasSignUpData ? (
              <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No sign-up data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={signUpsLast6}>
                <CartesianGrid stroke={B.border} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: B.muted, fontSize: 11 }} />
                <YAxis tick={{ fill: B.muted, fontSize: 11 }} />
                <Tooltip {...tt} />
                <Bar dataKey="signUps" fill={B.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Section>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: REVENUE
   ══════════════════════════════════════════════════════ */
function RevenueTab({ B, payments, members, plans }) {
  const isMobile = useIsMobile();
  const tt = ChartTooltip({ B });
  const thStyle = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: "1px solid " + B.border };
  const tdStyle = { padding: "10px 14px", fontSize: 13, color: B.text, borderBottom: "1px solid " + B.border };
  const revenueByMonth = buildRevenueByMonth(payments);
  const revenueByPlan = buildRevenueByPlan(payments, plans);
  const topRevenueMembers = buildTopRevenueMembers(payments, members, plans);
  const hasRevData = revenueByMonth.some(d => d.revenue > 0);
  const hasPlanData = revenueByPlan.length > 0 && revenueByPlan.some(d => d.value > 0);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 16, marginBottom: 24 }}>
        <Section title="Monthly Revenue (12 Months)" B={B}>
          <Card style={{ padding: "16px 8px 8px" }}>
            {!hasRevData ? (
              <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No revenue data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueByMonth}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={B.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={B.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={B.border} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: B.muted, fontSize: 10 }} />
                <YAxis tick={{ fill: B.muted, fontSize: 11 }} tickFormatter={v => "$" + (v / 1000) + "k"} />
                <Tooltip {...tt} formatter={v => ["$" + v.toLocaleString(), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke={B.accent} strokeWidth={2.5} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Section>
        <Section title="Revenue by Plan" B={B}>
          <Card style={{ padding: "16px 8px 8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {!hasPlanData ? (
              <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No revenue data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={revenueByPlan} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: B.muted }} style={{ fontSize: 11 }}>
                  {revenueByPlan.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...tt} formatter={v => ["$" + v.toLocaleString()]} />
              </PieChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Section>
      </div>
      <Section title="Top 10 Revenue-Generating Clients" B={B}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {topRevenueMembers.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No payment data yet</div>
          ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: B.darker }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Total Revenue</th>
                  <th style={thStyle}>Months Active</th>
                </tr>
              </thead>
              <tbody>
                {topRevenueMembers.map((m, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{m.name}</td>
                    <td style={tdStyle}>{m.plan}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: B.accent }}>${m.revenue.toLocaleString()}</td>
                    <td style={tdStyle}>{m.months}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Card>
      </Section>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: MEMBERS
   ══════════════════════════════════════════════════════ */
function MembersTab({ B, members, membershipEvents }) {
  const isMobile = useIsMobile();
  const tt = ChartTooltip({ B });
  const memberGrowth = buildMemberGrowth(members);
  const signUpsCancellations = buildSignUpsCancellations(membershipEvents);
  const memberStatusDist = buildMemberStatusDist(members);
  const churnRate = buildChurnRate(members, membershipEvents);
  const hasGrowthData = memberGrowth.some(d => d.total > 0);
  const hasSUCData = signUpsCancellations.some(d => d.signUps > 0 || d.cancellations > 0);
  const hasStatusData = memberStatusDist.some(d => d.value > 0);
  const hasChurnData = churnRate.some(d => d.rate > 0);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Section title="Active Clients (12 Months)" B={B}>
          <Card style={{ padding: "16px 8px 8px" }}>
            {!hasGrowthData ? (
              <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={memberGrowth}>
                <CartesianGrid stroke={B.border} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: B.muted, fontSize: 10 }} />
                <YAxis tick={{ fill: B.muted, fontSize: 11 }} />
                <Tooltip {...tt} />
                <Line type="monotone" dataKey="total" stroke={B.accent} strokeWidth={2.5} dot={{ fill: B.accent, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Section>
        <Section title="Sign-Ups vs Cancellations" B={B}>
          <Card style={{ padding: "16px 8px 8px" }}>
            {!hasSUCData ? (
              <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={signUpsCancellations}>
                <CartesianGrid stroke={B.border} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: B.muted, fontSize: 10 }} />
                <YAxis tick={{ fill: B.muted, fontSize: 11 }} />
                <Tooltip {...tt} />
                <Bar dataKey="signUps" fill={B.accent} radius={[4, 4, 0, 0]} name="Sign-Ups" />
                <Bar dataKey="cancellations" fill={B.red} radius={[4, 4, 0, 0]} name="Cancellations" />
              </BarChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Section>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Section title="Client Status Distribution" B={B}>
          <Card style={{ padding: "16px 8px 8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {!hasStatusData ? (
              <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={memberStatusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={3} label={({ name, value }) => `${name} (${value})`} labelLine={{ stroke: B.muted }} style={{ fontSize: 11 }}>
                  {memberStatusDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...tt} />
              </PieChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Section>
        <Section title="Churn Rate (%)" B={B}>
          <Card style={{ padding: "16px 8px 8px" }}>
            {!hasChurnData ? (
              <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={churnRate}>
                <CartesianGrid stroke={B.border} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: B.muted, fontSize: 10 }} />
                <YAxis tick={{ fill: B.muted, fontSize: 11 }} unit="%" />
                <Tooltip {...tt} formatter={v => [v + "%", "Churn"]} />
                <Line type="monotone" dataKey="rate" stroke={B.red} strokeWidth={2.5} dot={{ fill: B.red, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Section>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: ATTENDANCE
   ══════════════════════════════════════════════════════ */
function AttendanceTab({ B, attendance }) {
  const isMobile = useIsMobile();
  const tt = ChartTooltip({ B });
  const attendanceByDay = buildAttendanceByDay(attendance);
  const checkInsPerMonth = buildCheckInsPerMonth(attendance);
  const heatData = buildHeatData(attendance);
  const maxVal = Math.max(...heatData.flat(), 1);
  const cellColor = (val) => {
    const ratio = val / maxVal;
    if (ratio < 0.15) return B.darker;
    if (ratio < 0.35) return B.border;
    if (ratio < 0.55) return B.dim;
    if (ratio < 0.75) return B.accent + "99";
    return B.accent;
  };
  const hasAttData = attendance.length > 0;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Section title="Average Daily Attendance" B={B}>
          <Card style={{ padding: "16px 8px 8px" }}>
            {!hasAttData ? (
              <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No attendance data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={attendanceByDay}>
                <CartesianGrid stroke={B.border} strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: B.muted, fontSize: 11 }} />
                <YAxis tick={{ fill: B.muted, fontSize: 11 }} />
                <Tooltip {...tt} />
                <Bar dataKey="avg" fill={B.accent} radius={[4, 4, 0, 0]} name="Avg Attendance" />
              </BarChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Section>
        <Section title="Total Check-Ins per Month" B={B}>
          <Card style={{ padding: "16px 8px 8px" }}>
            {!hasAttData ? (
              <div style={{ padding: 48, textAlign: "center", color: B.dim, fontSize: 14 }}>No attendance data yet</div>
            ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={checkInsPerMonth}>
                <CartesianGrid stroke={B.border} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: B.muted, fontSize: 10 }} />
                <YAxis tick={{ fill: B.muted, fontSize: 11 }} />
                <Tooltip {...tt} />
                <Line type="monotone" dataKey="checkIns" stroke={B.accent} strokeWidth={2.5} dot={{ fill: B.accent, r: 4 }} name="Check-Ins" />
              </LineChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Section>
      </div>
      <Section title="Attendance Heatmap (by Hour and Day)" B={B}>
        <Card style={{ padding: 16, overflowX: "auto" }}>
          <div style={{ display: "inline-grid", gridTemplateColumns: "72px repeat(7, 1fr)", gap: 3, minWidth: 500, width: "100%" }}>
            {/* Header row */}
            <div />
            {DAYS_WEEK.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: B.muted, padding: "6px 0" }}>{d}</div>
            ))}
            {/* Data rows */}
            {HOURS.map((hour, hi) => (
              <div key={hour} style={{ display: "contents" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, display: "flex", alignItems: "center", paddingRight: 8 }}>{hour}</div>
                {DAYS_WEEK.map((day, di) => {
                  const val = heatData[hi][di];
                  return (
                    <div
                      key={day}
                      title={`${day} ${hour}: ${val} check-ins`}
                      style={{
                        background: cellColor(val),
                        borderRadius: 4,
                        minHeight: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 600,
                        color: val / maxVal > 0.5 ? "#fff" : B.dim,
                        transition: "transform 0.15s",
                        cursor: "default",
                      }}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 10, color: B.muted }}>Low</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(r => (
              <div key={r} style={{ width: 18, height: 12, borderRadius: 2, background: r < 0.15 ? B.darker : r < 0.35 ? B.border : r < 0.55 ? B.dim : r < 0.75 ? B.accent + "99" : B.accent }} />
            ))}
            <span style={{ fontSize: 10, color: B.muted }}>High</span>
          </div>
        </Card>
      </Section>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: UTILIZATION
   ══════════════════════════════════════════════════════ */
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getWeekStart(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - day);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function fmtShortDate(d) {
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function getDatePreset(preset) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const today = new Date(now);

  switch (preset) {
    case "thisWeek": {
      const start = getWeekStart(today);
      return { start: toISO(start), end: toISO(today) };
    }
    case "lastWeek": {
      const end = getWeekStart(today);
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { start: toISO(start), end: toISO(end) };
    }
    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: toISO(start), end: toISO(today) };
    }
    case "lastMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: toISO(start), end: toISO(end) };
    }
    case "last30": {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { start: toISO(start), end: toISO(today) };
    }
    case "last90": {
      const start = new Date(today);
      start.setDate(start.getDate() - 89);
      return { start: toISO(start), end: toISO(today) };
    }
    default:
      return null;
  }
}

function countDayOccurrencesInRange(dayOfWeek, startDate, endDate) {
  let count = 0;
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  while (d <= end) {
    if (d.getDay() === dayOfWeek) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function UtilizationTab({ B, members, schedule, attendance, plans }) {
  const isMobile = useIsMobile();
  const tt = ChartTooltip({ B });
  const defaultRange = getDatePreset("last30");
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  const applyPreset = (preset) => {
    const range = getDatePreset(preset);
    if (range) {
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const presetBtnStyle = {
    padding: "5px 12px", borderRadius: 6, border: "1px solid " + B.border,
    background: B.darker, color: B.muted, fontSize: 11, fontWeight: 600, cursor: "pointer",
    transition: "all 0.15s",
  };

  const inputStyle = {
    padding: "6px 10px", borderRadius: 6, border: "1px solid " + B.border,
    background: B.dark, color: B.text, fontSize: 13, outline: "none",
  };

  const data = useMemo(() => {
    const rangeStart = new Date(startDate + "T00:00:00");
    const rangeEnd = new Date(endDate + "T23:59:59");

    // -- Total Capacity --
    let totalCapacity = 0;
    const classBreakdown = schedule.map(cls => {
      const occurrences = countDayOccurrencesInRange(cls.dayOfWeek, rangeStart, rangeEnd);
      const spotsAvailable = (cls.capacity || 0) * occurrences;
      totalCapacity += spotsAvailable;

      // Bookings and check-ins for this class in range
      const classCheckins = attendance.filter(a =>
        !a.noShow &&
        a.classId === cls.id &&
        a.checkInTime >= startDate && a.checkInTime <= endDate + "T23:59:59"
      ).length;

      // Approximate: standing weekly bookings for every occurrence, plus any
      // date-scoped bookings that fall inside the selected range
      const dateScopedInRange = Object.entries(cls.bookingsByDate || {})
        .filter(([d]) => d >= startDate && d <= endDate)
        .reduce((sum, [, ids]) => sum + (ids?.length || 0), 0);
      const classBookings = (cls.bookings || []).length * occurrences + dateScopedInRange;

      return {
        id: cls.id,
        name: cls.name || "Session",
        time: cls.startTime ? `${cls.startTime}-${cls.endTime}` : "--",
        instructor: cls.instructor || "--",
        capacityPerSession: cls.capacity || 0,
        occurrences,
        spotsAvailable,
        bookings: classBookings,
        checkIns: classCheckins,
        utilization: spotsAvailable > 0 ? Math.round((classCheckins / spotsAvailable) * 100) : 0,
      };
    });

    // -- Sessions Sold (prorated) --
    const rangeDays = Math.max(1, Math.round((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1);
    let sessionsSold = 0;
    const activeMembers = members.filter(m => !!m.membershipPlanId);
    activeMembers.forEach(m => {
      const plan = plans.find(p => p.id === m.membershipPlanId);
      if (!plan) return;
      if (plan.sessionsIncluded == null) {
        // Unlimited: count as total capacity for classes they could attend (approximate: proportional share)
        sessionsSold += Math.round(totalCapacity / Math.max(activeMembers.length, 1));
      } else {
        // Prorated: sessionsIncluded is monthly, so prorate to rangeDays
        sessionsSold += Math.round((plan.sessionsIncluded / 30) * rangeDays);
      }
    });

    // -- Sessions Utilized --
    const sessionsUtilized = attendance.filter(a =>
      !a.noShow && a.checkInTime >= startDate && a.checkInTime <= endDate + "T23:59:59"
    ).length;

    // -- Utilization Rate --
    const utilizationRate = totalCapacity > 0 ? Math.round((sessionsUtilized / totalCapacity) * 100) : 0;

    // -- Week-by-week chart data --
    const weekData = [];
    const weekCursor = getWeekStart(rangeStart);
    while (weekCursor <= rangeEnd) {
      const weekEnd = new Date(weekCursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const wStart = weekCursor < rangeStart ? new Date(rangeStart) : new Date(weekCursor);
      const wEnd = weekEnd > rangeEnd ? new Date(rangeEnd) : weekEnd;

      // Capacity for this week
      let weekCapacity = 0;
      schedule.forEach(cls => {
        weekCapacity += (cls.capacity || 0) * countDayOccurrencesInRange(cls.dayOfWeek, wStart, wEnd);
      });

      // Check-ins for this week
      const wStartISO = toISO(wStart);
      const wEndISO = toISO(wEnd);
      const weekCheckins = attendance.filter(a =>
        !a.noShow && a.checkInTime >= wStartISO && a.checkInTime <= wEndISO + "T23:59:59"
      ).length;

      const weekUtil = weekCapacity > 0 ? Math.round((weekCheckins / weekCapacity) * 100) : 0;

      weekData.push({
        week: `${fmtShortDate(wStart)}-${wEnd.getDate()}`,
        capacity: weekCapacity,
        utilized: weekCheckins,
        rate: weekUtil,
      });

      weekCursor.setDate(weekCursor.getDate() + 7);
    }

    // -- Sold vs Available data (for stacked bar) --
    const unused = Math.max(0, sessionsSold - sessionsUtilized);
    const unsold = Math.max(0, totalCapacity - sessionsSold);
    const soldVsAvailable = [
      { name: "Utilized", value: sessionsUtilized, color: B.accent },
      { name: "Sold (Unused)", value: unused, color: B.orange },
      { name: "Unsold", value: unsold, color: B.border },
    ];

    return {
      totalCapacity,
      sessionsSold,
      sessionsUtilized,
      utilizationRate,
      weekData,
      classBreakdown,
      soldVsAvailable,
    };
  }, [startDate, endDate, schedule, attendance, members, plans, B]);

  const thStyle = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: "1px solid " + B.border };
  const tdStyle = { padding: "10px 14px", fontSize: 13, color: B.text, borderBottom: "1px solid " + B.border };

  const utilColor = (pct) => {
    if (pct >= 75) return B.accent;
    if (pct >= 50) return B.orange;
    return B.red;
  };

  return (
    <>
      {/* Date Range Picker */}
      <Card style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: B.muted }}>Start</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          <label style={{ fontSize: 12, fontWeight: 600, color: B.muted }}>End</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          <div style={{ width: 1, height: 24, background: B.border, margin: "0 4px" }} />
          {[
            ["thisWeek", "This Week"], ["lastWeek", "Last Week"],
            ["thisMonth", "This Month"], ["lastMonth", "Last Month"],
            ["last30", "Last 30 Days"], ["last90", "Last 90 Days"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => applyPreset(key)} style={presetBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.borderColor = B.accent; e.currentTarget.style.color = B.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = B.border; e.currentTarget.style.color = B.muted; }}
            >{label}</button>
          ))}
        </div>
      </Card>

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <KPI label="Total Capacity" value={data.totalCapacity.toLocaleString()} sub="Available spots in range" B={B} color={B.blue} />
        <KPI label="Sessions Sold" value={data.sessionsSold.toLocaleString()} sub="Prorated client allotments" B={B} color={B.purple} />
        <KPI label="Sessions Utilized" value={data.sessionsUtilized.toLocaleString()} sub="Actual check-ins" B={B} color={B.accent} />
        <KPI label="Utilization Rate" value={`${data.utilizationRate}%`} sub="Utilized / Total Capacity" B={B} color={utilColor(data.utilizationRate)} />
      </div>

      {/* Week-by-Week Utilization Chart */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 16, marginBottom: 24 }}>
        <Section title="Weekly Utilization" B={B}>
          <Card style={{ padding: "16px 8px 8px" }}>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={data.weekData}>
                <CartesianGrid stroke={B.border} strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fill: B.muted, fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: B.muted, fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: B.muted, fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="capacity" fill={B.blue} radius={[4, 4, 0, 0]} name="Capacity" opacity={0.6} />
                <Bar yAxisId="left" dataKey="utilized" fill={B.accent} radius={[4, 4, 0, 0]} name="Utilized" />
                <Line yAxisId="right" type="monotone" dataKey="rate" stroke={B.orange} strokeWidth={2.5} dot={{ fill: B.orange, r: 4 }} name="Util %" />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        </Section>

        {/* Sold vs Available Pie */}
        <Section title="Sold vs Available" B={B}>
          <Card style={{ padding: "16px 8px 8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={data.soldVsAvailable}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={100} innerRadius={55}
                  paddingAngle={3}
                  label={({ name, value }) => value > 0 ? `${name} (${value})` : ""}
                  labelLine={{ stroke: B.muted }}
                  style={{ fontSize: 11 }}
                >
                  {data.soldVsAvailable.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...tt} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {data.soldVsAvailable.map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: B.muted }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: entry.color }} />
                  {entry.name}: {entry.value}
                </div>
              ))}
            </div>
          </Card>
        </Section>
      </div>

      {/* Session-by-Session Breakdown Table */}
      <Section title="Session-by-Session Breakdown" B={B}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: B.darker }}>
                  <th style={thStyle}>Session</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Instructor</th>
                  <th style={thStyle}>Cap / Session</th>
                  <th style={thStyle}>Occurrences</th>
                  <th style={thStyle}>Total Spots</th>
                  <th style={thStyle}>Check-Ins</th>
                  <th style={thStyle}>Utilization</th>
                </tr>
              </thead>
              <tbody>
                {data.classBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: B.dim, padding: 32 }}>
                      No sessions found in the schedule.
                    </td>
                  </tr>
                ) : (
                  data.classBreakdown.map((cls, i) => (
                    <tr key={cls.id || i}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{cls.name}</td>
                      <td style={tdStyle}>{cls.time}</td>
                      <td style={tdStyle}>{cls.instructor}</td>
                      <td style={tdStyle}>{cls.capacityPerSession}</td>
                      <td style={tdStyle}>{cls.occurrences}</td>
                      <td style={tdStyle}>{cls.spotsAvailable}</td>
                      <td style={tdStyle}>{cls.checkIns}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-block", padding: "3px 10px", borderRadius: 6,
                          background: utilColor(cls.utilization) + "20",
                          color: utilColor(cls.utilization),
                          fontWeight: 700, fontSize: 12,
                        }}>
                          {cls.utilization}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: SESSION REVENUE
   ══════════════════════════════════════════════════════ */
function SessionRevenueTab({ B, members, schedule, plans }) {
  const isMobile = useIsMobile();
  const tt = ChartTooltip({ B });
  const [sortBy, setSortBy] = useState("highestRevenue");

  const sessionData = useMemo(() => {
    // Build a lookup: memberId -> plan
    const memberPlanMap = {};
    members.forEach(m => {
      const plan = plans.find(p => p.id === m.membershipPlanId);
      memberPlanMap[m.id] = plan || null;
    });

    // For unlimited plans, we need to know total sessions booked per member across all classes
    const memberTotalBookings = {};
    members.forEach(m => { memberTotalBookings[m.id] = 0; });
    schedule.forEach(cls => {
      (cls.bookings || []).forEach(memberId => {
        memberTotalBookings[memberId] = (memberTotalBookings[memberId] || 0) + 1;
      });
    });

    // Calculate revenue per session for each class
    const rows = schedule.map(cls => {
      const bookings = cls.bookings || [];
      const bookedCount = bookings.length;
      const capacity = cls.capacity || 0;
      const utilization = capacity > 0 ? Math.round((bookedCount / capacity) * 100) : 0;

      let revenuePerSession = 0;
      bookings.forEach(memberId => {
        const plan = memberPlanMap[memberId];
        if (!plan) return; // no plan = $0

        const price = plan.price || 0;
        const cycle = (plan.billingCycle || "").toLowerCase();

        if (cycle === "per-session" || cycle === "per session" || cycle === "drop-in") {
          // Per-session: price directly
          revenuePerSession += price;
        } else {
          // Monthly (or similar): divide by sessions
          if (plan.sessionsIncluded && plan.sessionsIncluded > 0) {
            revenuePerSession += price / plan.sessionsIncluded;
          } else {
            // Unlimited: price / total sessions booked across all classes
            const totalBooked = memberTotalBookings[memberId] || 1;
            revenuePerSession += price / totalBooked;
          }
        }
      });

      revenuePerSession = Math.round(revenuePerSession * 100) / 100;
      const revenuePerMonth = Math.round(revenuePerSession * 4 * 100) / 100;

      // Format day & time
      const dayName = DAY_NAMES[cls.dayOfWeek] || `Day ${cls.dayOfWeek}`;
      const dayTime = cls.startTime
        ? `${dayName} ${cls.startTime} - ${cls.endTime}`
        : dayName;

      return {
        id: cls.id,
        name: cls.name || "Session",
        dayTime,
        dayOfWeek: cls.dayOfWeek,
        startTime: cls.startTime || "",
        instructor: cls.instructor || "--",
        capacity,
        bookedCount,
        revenuePerSession,
        revenuePerMonth,
        utilization,
      };
    });

    return rows;
  }, [members, schedule, plans]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...sessionData];
    switch (sortBy) {
      case "highestRevenue":
        arr.sort((a, b) => b.revenuePerSession - a.revenuePerSession);
        break;
      case "lowestRevenue":
        arr.sort((a, b) => a.revenuePerSession - b.revenuePerSession);
        break;
      case "className":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "utilization":
        arr.sort((a, b) => b.utilization - a.utilization);
        break;
      default:
        break;
    }
    return arr;
  }, [sessionData, sortBy]);

  // Quartile color coding
  const revValues = sorted.map(r => r.revenuePerSession).filter(v => v > 0);
  const sortedRevValues = [...revValues].sort((a, b) => a - b);
  const q25 = sortedRevValues[Math.floor(sortedRevValues.length * 0.25)] || 0;
  const q75 = sortedRevValues[Math.floor(sortedRevValues.length * 0.75)] || 0;

  const revColor = (val) => {
    if (val >= q75) return "#22c55e"; // green
    if (val <= q25) return "#ef4444"; // red
    return "#f59e0b"; // yellow
  };

  // Summary stats
  const totalWeeklyRevenue = sessionData.reduce((sum, r) => sum + r.revenuePerSession, 0);
  const avgRevenue = sessionData.length > 0 ? totalWeeklyRevenue / sessionData.length : 0;
  const highest = sessionData.length > 0 ? [...sessionData].sort((a, b) => b.revenuePerSession - a.revenuePerSession)[0] : null;
  const lowest = sessionData.length > 0 ? [...sessionData].sort((a, b) => a.revenuePerSession - b.revenuePerSession)[0] : null;

  // Chart data (sorted to match table)
  const barChartData = sorted.map(r => ({
    name: r.name,
    revenue: r.revenuePerSession,
    fill: revColor(r.revenuePerSession),
  }));

  // Pie data
  const totalRevenue = sessionData.reduce((sum, r) => sum + r.revenuePerSession, 0);
  const PIE_COLORS = ["#8fbf3b", "#063461", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#6366f1", "#f97316"];
  const pieData = sessionData
    .filter(r => r.revenuePerSession > 0)
    .sort((a, b) => b.revenuePerSession - a.revenuePerSession)
    .map((r, i) => ({
      name: r.name,
      value: Math.round(r.revenuePerSession * 100) / 100,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));

  const sortBtnStyle = (key) => ({
    padding: "6px 14px", borderRadius: 6, border: "1px solid " + (sortBy === key ? B.accent : B.border),
    background: sortBy === key ? B.accent : B.darker,
    color: sortBy === key ? "#fff" : B.muted,
    fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
  });

  const thStyle = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: "1px solid " + B.border };
  const tdStyle = { padding: "10px 14px", fontSize: 13, color: B.text, borderBottom: "1px solid " + B.border };

  return (
    <>
      {/* Section 1: Average Revenue Per Session KPI */}
      <Section title="" B={B}>
        <Card style={{ textAlign: "center", padding: "32px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Average Revenue Per Session</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: B.accent }}>${avgRevenue.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: B.dim, marginTop: 6 }}>Based on {sessionData.length} active session{sessionData.length !== 1 ? "s" : ""}</div>
        </Card>
      </Section>

      {/* Section 2: Session Revenue Breakdown Table */}
      <Section title="Session Revenue Breakdown" B={B}>
        {/* Sort Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: B.muted }}>Sort by:</span>
          <button style={sortBtnStyle("highestRevenue")} onClick={() => setSortBy("highestRevenue")}>Highest Revenue</button>
          <button style={sortBtnStyle("lowestRevenue")} onClick={() => setSortBy("lowestRevenue")}>Lowest Revenue</button>
          <button style={sortBtnStyle("className")} onClick={() => setSortBy("className")}>Session Name</button>
          <button style={sortBtnStyle("utilization")} onClick={() => setSortBy("utilization")}>Utilization</button>
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: B.darker }}>
                  <th style={thStyle}>Session Name</th>
                  <th style={thStyle}>Day & Time</th>
                  <th style={thStyle}>Instructor</th>
                  <th style={thStyle}>Capacity</th>
                  <th style={thStyle}>Clients Booked</th>
                  <th style={thStyle}>Revenue / Session</th>
                  <th style={thStyle}>Revenue / Month</th>
                  <th style={thStyle}>Utilization</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: B.dim, padding: 32 }}>
                      No sessions found in the schedule.
                    </td>
                  </tr>
                ) : (
                  sorted.map((cls, i) => (
                    <tr key={cls.id || i} style={{ background: i % 2 === 0 ? "transparent" : (B.darker + "44") }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{cls.name}</td>
                      <td style={tdStyle}>{cls.dayTime}</td>
                      <td style={tdStyle}>{cls.instructor}</td>
                      <td style={tdStyle}>{cls.capacity}</td>
                      <td style={tdStyle}>{cls.bookedCount}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-block", padding: "3px 10px", borderRadius: 6,
                          background: revColor(cls.revenuePerSession) + "20",
                          color: revColor(cls.revenuePerSession),
                          fontWeight: 700, fontSize: 12,
                        }}>
                          ${cls.revenuePerSession.toFixed(2)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>${cls.revenuePerMonth.toFixed(2)}</td>
                      <td style={tdStyle}>{cls.utilization}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      {/* Section 3: Revenue Per Session Bar Chart */}
      <Section title="Revenue Per Session" B={B}>
        <Card style={{ padding: "16px 8px 8px" }}>
          <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 40)}>
            <BarChart data={barChartData} layout="vertical" margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid stroke={B.border} strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: B.muted, fontSize: 11 }} tickFormatter={v => "$" + v} />
              <YAxis type="category" dataKey="name" tick={{ fill: B.muted, fontSize: 11 }} width={120} />
              <Tooltip {...tt} formatter={v => ["$" + v.toFixed(2), "Revenue"]} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {barChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Section>

      {/* Section 4: Revenue Distribution Pie Chart */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Section title="Revenue Distribution" B={B}>
          <Card style={{ padding: "16px 8px 8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <ResponsiveContainer width="100%" height={340}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={110} innerRadius={55}
                  paddingAngle={2}
                  label={({ name, value }) => `${name} $${value.toFixed(0)}`}
                  labelLine={{ stroke: B.muted }}
                  style={{ fontSize: 10 }}
                >
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...tt} formatter={v => ["$" + Number(v).toFixed(2), "Revenue"]} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Section>

        {/* Section 5: Session Revenue Summary Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Section title="Session Revenue Summary" B={B}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Card style={{ padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Highest Revenue Session</div>
                {highest ? (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>${highest.revenuePerSession.toFixed(2)}</div>
                    <div style={{ fontSize: 13, color: B.text, marginTop: 4, fontWeight: 600 }}>{highest.name}</div>
                    <div style={{ fontSize: 11, color: B.dim, marginTop: 2 }}>{highest.dayTime}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: B.dim }}>No sessions</div>
                )}
              </Card>
              <Card style={{ padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Lowest Revenue Session</div>
                {lowest ? (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>${lowest.revenuePerSession.toFixed(2)}</div>
                    <div style={{ fontSize: 13, color: B.text, marginTop: 4, fontWeight: 600 }}>{lowest.name}</div>
                    <div style={{ fontSize: 11, color: B.dim, marginTop: 2 }}>{lowest.dayTime}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: B.dim }}>No sessions</div>
                )}
              </Card>
              <Card style={{ padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Total Weekly Session Revenue</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: B.accent }}>${totalWeeklyRevenue.toFixed(2)}</div>
                <div style={{ fontSize: 11, color: B.dim, marginTop: 4 }}>Sum of all per-session revenues</div>
              </Card>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   ANALYTICS VIEW (main export)
   ══════════════════════════════════════════════════════ */
export default function AnalyticsView() {
  const B = useTheme();
  const { members } = useMembers();
  const [tab, setTab] = useState("overview");
  const [schedule] = useLocalStorage("hf_schedule", []);
  const [attendance] = useLocalStorage("hf_attendance", []);
  const [plans] = useLocalStorage("hf_plans", []);
  const [payments] = useLocalStorage("hf_payments", []);
  const [membershipEvents] = useLocalStorage("hf_membership_events", []);

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "revenue", label: "Revenue" },
    { key: "members", label: "Clients" },
    { key: "attendance", label: "Attendance" },
    { key: "utilization", label: "Utilization" },
    { key: "sessionRevenue", label: "Session Revenue" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: B.text, marginBottom: 4 }}>Analytics</h1>
      <p style={{ color: B.muted, marginBottom: 20, fontSize: 14 }}>Revenue, client growth, attendance trends, and churn charts.</p>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: B.darker, borderRadius: 10, padding: 4, width: "fit-content", maxWidth: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {TABS.map(t => (
          <Tab key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} B={B} />
        ))}
      </div>

      {tab === "overview" && <OverviewTab B={B} members={members} payments={payments} attendance={attendance} membershipEvents={membershipEvents} plans={plans} />}
      {tab === "revenue" && <RevenueTab B={B} payments={payments} members={members} plans={plans} />}
      {tab === "members" && <MembersTab B={B} members={members} membershipEvents={membershipEvents} />}
      {tab === "attendance" && <AttendanceTab B={B} attendance={attendance} />}
      {tab === "utilization" && <UtilizationTab B={B} members={members} schedule={schedule} attendance={attendance} plans={plans} />}
      {tab === "sessionRevenue" && <SessionRevenueTab B={B} members={members} schedule={schedule} plans={plans} />}
    </div>
  );
}
