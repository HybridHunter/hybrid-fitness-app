import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";

const ALL_BADGES = [
  { key: "First Workout", icon: "\ud83c\udfaf", desc: "Complete your first workout" },
  { key: "10 Workouts", icon: "\ud83d\udcaa", desc: "Complete 10 workouts" },
  { key: "50 Workouts", icon: "\ud83d\udd25", desc: "Complete 50 workouts" },
  { key: "100 Workouts", icon: "\u2b50", desc: "Complete 100 workouts" },
  { key: "Iron Club", icon: "\ud83c\udfcb\ufe0f", desc: "Lift 50,000+ lbs total" },
  { key: "Week Warrior", icon: "\u26a1", desc: "7-day workout streak" },
  { key: "Month Machine", icon: "\ud83d\uddd3\ufe0f", desc: "30-day workout streak" },
  { key: "Early Bird", icon: "\ud83c\udf05", desc: "Check in before 7 AM" },
  { key: "Consistency King", icon: "\ud83d\udc51", desc: "Longest streak 21+" },
];

const LEADERBOARD_TABS = [
  { key: "xp", label: "XP", field: "xp", format: (v) => v.toLocaleString() + " XP" },
  { key: "workouts", label: "Workouts", field: "totalWorkouts", format: (v) => v.toLocaleString() },
  { key: "weight", label: "Weight Lifted", field: "totalWeightLifted", format: (v) => (v >= 1000 ? (v / 1000).toFixed(1) + "K" : v) + " lbs" },
  { key: "streak", label: "Streak", field: "currentStreak", format: (v) => v + " days" },
];

function getInitials(f, l) {
  return ((f?.[0] || "") + (l?.[0] || "")).toUpperCase();
}

function getAttendanceByMonth(attendance, year, month) {
  const counts = {};
  attendance.forEach((rec) => {
    const d = new Date(rec.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      counts[rec.memberId] = (counts[rec.memberId] || 0) + 1;
    }
  });
  return counts;
}

export default function GamificationView() {
  const B = useTheme();
  const { members } = useMembers();
  const [activeTab, setActiveTab] = useState("xp");
  const [attendance] = useLocalStorage("hf_attendance", []);
  const [showDidntReach, setShowDidntReach] = useState(false);
  const [showDidntReachCurrent, setShowDidntReachCurrent] = useState(false);

  const activeMembers = members.filter((m) => m.membershipStatus === "active");
  const tab = LEADERBOARD_TABS.find((t) => t.key === activeTab);

  const sorted = [...activeMembers].sort((a, b) => {
    const av = a.gamification?.[tab.field] || 0;
    const bv = b.gamification?.[tab.field] || 0;
    return bv - av;
  });

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  // Badge counts across ALL members
  const badgeCounts = {};
  ALL_BADGES.forEach((b) => { badgeCounts[b.key] = 0; });
  members.forEach((m) => {
    (m.gamification?.badges || []).forEach((badge) => {
      if (badgeCounts[badge] !== undefined) badgeCounts[badge]++;
    });
  });

  // Global stats
  const totalWorkoutsAll = members.reduce((s, m) => s + (m.gamification?.totalWorkouts || 0), 0);
  const avgLevel = members.length ? (members.reduce((s, m) => s + (m.gamification?.level || 1), 0) / members.length).toFixed(1) : 0;
  const badgeFreq = {};
  members.forEach((m) => (m.gamification?.badges || []).forEach((b) => { badgeFreq[b] = (badgeFreq[b] || 0) + 1; }));
  const mostCommonBadge = Object.entries(badgeFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "---";

  // --- Monthly Attendance Goal calculations ---
  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  const prevCounts = getAttendanceByMonth(attendance, prevYear, prevMonth);
  const curCounts = getAttendanceByMonth(attendance, curYear, curMonth);

  const GOAL = 8;

  // Build member lists for previous month
  const memberWithPrevCount = activeMembers.map((m) => ({
    ...m,
    sessionCount: prevCounts[m.id] || 0,
  }));
  const prevHitGoal = memberWithPrevCount.filter((m) => m.sessionCount >= GOAL).sort((a, b) => b.sessionCount - a.sessionCount);
  const prevAttendedNotGoal = memberWithPrevCount.filter((m) => m.sessionCount > 0 && m.sessionCount < GOAL).sort((a, b) => b.sessionCount - a.sessionCount);
  const prevNoAttendance = memberWithPrevCount.filter((m) => m.sessionCount === 0);
  const prevGoalPct = activeMembers.length ? Math.round((prevHitGoal.length / activeMembers.length) * 100) : 0;
  const prevBarColor = prevGoalPct >= 70 ? "#22c55e" : prevGoalPct >= 50 ? "#eab308" : "#ef4444";

  // Build member lists for current month
  const daysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const dayElapsed = now.getDate();
  const projectionFactor = daysInCurMonth / Math.max(dayElapsed, 1);

  const memberWithCurCount = activeMembers.map((m) => ({
    ...m,
    sessionCount: curCounts[m.id] || 0,
    projected: Math.round((curCounts[m.id] || 0) * projectionFactor),
  }));
  const curOnTrack = memberWithCurCount.filter((m) => m.projected >= GOAL).sort((a, b) => b.sessionCount - a.sessionCount);
  const curNeedWork = memberWithCurCount.filter((m) => m.projected < GOAL && m.sessionCount > 0).sort((a, b) => b.sessionCount - a.sessionCount);
  const curNoAttendance = memberWithCurCount.filter((m) => m.sessionCount === 0);
  const curOnTrackPct = activeMembers.length ? Math.round((curOnTrack.length / activeMembers.length) * 100) : 0;
  const curBarColor = curOnTrackPct >= 70 ? "#22c55e" : curOnTrackPct >= 50 ? "#eab308" : "#ef4444";

  const prevMonthName = new Date(prevYear, prevMonth).toLocaleString("default", { month: "long" });
  const curMonthName = new Date(curYear, curMonth).toLocaleString("default", { month: "long" });

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const medalEmojis = ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"];

  const s = {
    page: { minHeight: "100%" },
    header: { marginBottom: 28 },
    title: { fontSize: 26, fontWeight: 800, color: B.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: B.muted, fontWeight: 500 },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 16, fontWeight: 700, color: B.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
    card: { background: B.card, borderRadius: 14, border: "1px solid " + B.border, padding: 20, marginBottom: 16 },
    tabBar: { display: "flex", gap: 4, marginBottom: 20, background: B.darker, borderRadius: 10, padding: 4 },
    tab: (active) => ({
      flex: 1, padding: "10px 8px", textAlign: "center", fontSize: 13, fontWeight: 700,
      color: active ? B.white : B.muted, background: active ? B.accent : "transparent",
      border: "none", borderRadius: 8, cursor: "pointer", transition: "all .2s",
    }),
    podium: { display: "flex", gap: 14, justifyContent: "center", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap" },
    podiumCard: (idx) => ({
      background: B.card, borderRadius: 14, border: "2px solid " + medalColors[idx] + "66",
      padding: idx === 0 ? "24px 28px" : "18px 22px", textAlign: "center", minWidth: 140,
      flex: "0 1 180px", order: idx === 0 ? 1 : idx === 1 ? 0 : 2,
      boxShadow: idx === 0 ? "0 0 24px " + medalColors[0] + "22" : "none",
      transform: idx === 0 ? "scale(1.05)" : "scale(1)",
    }),
    avatar: (color) => ({
      width: 48, height: 48, borderRadius: "50%", background: (color || B.accent) + "22",
      color: color || B.accent, display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: 16, margin: "0 auto 8px",
    }),
    medal: { fontSize: 28, marginBottom: 6 },
    podName: { fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 2 },
    podValue: { fontSize: 18, fontWeight: 800, color: B.accent },
    podLevel: { fontSize: 11, fontWeight: 600, color: B.muted, marginTop: 4 },
    row: (isTop) => ({
      display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
      background: isTop ? B.darker : "transparent", borderRadius: 10, marginBottom: 4,
      border: isTop ? "1px solid " + B.border : "1px solid transparent",
    }),
    rank: { width: 28, fontSize: 14, fontWeight: 800, color: B.dim, textAlign: "center", flexShrink: 0 },
    rowAvatar: { width: 36, height: 36, borderRadius: "50%", background: B.accent + "18", color: B.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 },
    rowName: { flex: 1, fontSize: 14, fontWeight: 600, color: B.text },
    rowValue: { fontSize: 14, fontWeight: 700, color: B.accent, minWidth: 80, textAlign: "right" },
    rowLevel: { fontSize: 11, fontWeight: 600, color: B.muted, background: B.darker, padding: "3px 10px", borderRadius: 10, minWidth: 50, textAlign: "center" },
    badgeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 },
    badgeCard: (earned) => ({
      background: earned ? B.card : B.darker, borderRadius: 12, border: "1px solid " + (earned ? B.border : B.border + "44"),
      padding: 16, textAlign: "center", opacity: earned ? 1 : 0.45, transition: "all .2s",
    }),
    badgeIcon: { fontSize: 32, marginBottom: 6 },
    badgeName: { fontSize: 12, fontWeight: 700, color: B.text, marginBottom: 2 },
    badgeDesc: { fontSize: 10, color: B.dim, marginBottom: 6, lineHeight: 1.3 },
    badgeCount: { fontSize: 11, fontWeight: 700, color: B.accent },
    statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 8 },
    statBox: { background: B.darker, borderRadius: 12, padding: 18, textAlign: "center" },
    statValue: { fontSize: 24, fontWeight: 800, color: B.text },
    statLabel: { fontSize: 11, color: B.dim, marginTop: 4, fontWeight: 600 },
    // Attendance section styles
    attendanceGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 },
    kpiCard: { background: B.card, borderRadius: 14, border: "1px solid " + B.border, padding: 24 },
    kpiBig: { fontSize: 48, fontWeight: 800, lineHeight: 1 },
    kpiSub: { fontSize: 13, color: B.muted, fontWeight: 500, marginTop: 4 },
    progressBar: { width: "100%", height: 10, background: B.darker, borderRadius: 6, marginTop: 12, overflow: "hidden" },
    progressFill: (pct, color) => ({ width: pct + "%", height: "100%", background: color, borderRadius: 6, transition: "width .4s ease" }),
    pctLabel: { fontSize: 12, fontWeight: 700, marginTop: 6 },
    memberRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, marginBottom: 2 },
    memberAvatar: { width: 32, height: 32, borderRadius: "50%", background: B.accent + "18", color: B.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 },
    memberName: { flex: 1, fontSize: 13, fontWeight: 600, color: B.text },
    memberCount: { fontSize: 13, fontWeight: 700, color: B.accent },
    collapseBtn: {
      background: "none", border: "1px solid " + B.border, borderRadius: 8, padding: "8px 16px",
      color: B.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", textAlign: "left",
      marginTop: 12, marginBottom: 4,
    },
    mutedMember: { fontSize: 12, color: B.dim, padding: "4px 12px" },
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.title}>Gamification</div>
        <div style={s.subtitle}>Track progress, earn badges, and compete</div>
      </div>

      {/* Global Stats */}
      <div style={s.section}>
        <div style={s.sectionTitle}>{"\ud83d\udcca"} Gym Overview</div>
        <div style={s.statsRow}>
          <div style={s.statBox}>
            <div style={s.statValue}>{totalWorkoutsAll.toLocaleString()}</div>
            <div style={s.statLabel}>Total Workouts Completed</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statValue}>{avgLevel}</div>
            <div style={s.statLabel}>Average Member Level</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statValue}>{mostCommonBadge}</div>
            <div style={s.statLabel}>Most Common Badge</div>
          </div>
        </div>
      </div>

      {/* Monthly Attendance Goal */}
      <div style={s.section}>
        <div style={s.sectionTitle}>{"\ud83d\udcc5"} Monthly Attendance Goal</div>
        <div style={{ ...s.subtitle, marginTop: -10, marginBottom: 16 }}>Members who attended 8+ sessions last month</div>
        <div style={s.attendanceGrid}>
          {/* Previous Month Card */}
          <div style={s.kpiCard}>
            <div style={{ fontSize: 13, fontWeight: 700, color: B.muted, marginBottom: 12 }}>{prevMonthName} Results</div>
            <div style={{ ...s.kpiBig, color: prevBarColor }}>{prevHitGoal.length}</div>
            <div style={s.kpiSub}>of {activeMembers.length} active members hit the goal</div>
            <div style={s.progressBar}>
              <div style={s.progressFill(prevGoalPct, prevBarColor)} />
            </div>
            <div style={{ ...s.pctLabel, color: prevBarColor }}>{prevGoalPct}% of members</div>

            {/* Members who hit the goal */}
            {prevHitGoal.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {prevHitGoal.map((m) => (
                  <div key={m.id} style={s.memberRow}>
                    <div style={s.memberAvatar}>{getInitials(m.firstName, m.lastName)}</div>
                    <div style={s.memberName}>{m.firstName} {m.lastName}</div>
                    <div style={s.memberCount}>{m.sessionCount} sessions</div>
                    <span style={{ fontSize: 16 }}>{"\ud83c\udfc6"}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Didn't reach goal - collapsible */}
            {prevAttendedNotGoal.length > 0 && (
              <div>
                <button style={s.collapseBtn} onClick={() => setShowDidntReach(!showDidntReach)}>
                  {showDidntReach ? "\u25bc" : "\u25b6"} Didn't reach goal ({prevAttendedNotGoal.length} member{prevAttendedNotGoal.length !== 1 ? "s" : ""})
                </button>
                {showDidntReach && prevAttendedNotGoal.map((m) => (
                  <div key={m.id} style={s.memberRow}>
                    <div style={s.memberAvatar}>{getInitials(m.firstName, m.lastName)}</div>
                    <div style={s.memberName}>
                      {m.firstName} {m.lastName}
                      <span style={{ fontSize: 11, color: B.muted, marginLeft: 8 }}>{GOAL - m.sessionCount} more to go!</span>
                    </div>
                    <div style={{ ...s.memberCount, color: B.muted }}>{m.sessionCount} sessions</div>
                  </div>
                ))}
              </div>
            )}

            {/* No attendance at all */}
            {prevNoAttendance.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: B.dim, marginBottom: 4, padding: "0 12px" }}>No attendance recorded:</div>
                {prevNoAttendance.map((m) => (
                  <div key={m.id} style={s.mutedMember}>
                    {m.firstName} {m.lastName}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* This Month So Far Card */}
          <div style={s.kpiCard}>
            <div style={{ fontSize: 13, fontWeight: 700, color: B.muted, marginBottom: 12 }}>{curMonthName} So Far <span style={{ fontWeight: 500 }}>(Day {dayElapsed} of {daysInCurMonth})</span></div>
            <div style={{ ...s.kpiBig, color: curBarColor }}>{curOnTrack.length}</div>
            <div style={s.kpiSub}>of {activeMembers.length} active members on track</div>
            <div style={s.progressBar}>
              <div style={s.progressFill(curOnTrackPct, curBarColor)} />
            </div>
            <div style={{ ...s.pctLabel, color: curBarColor }}>{curOnTrackPct}% on track</div>

            {/* On track members */}
            {curOnTrack.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", marginBottom: 6, padding: "0 12px" }}>{curOnTrack.length} member{curOnTrack.length !== 1 ? "s" : ""} on track</div>
                {curOnTrack.map((m) => (
                  <div key={m.id} style={s.memberRow}>
                    <div style={s.memberAvatar}>{getInitials(m.firstName, m.lastName)}</div>
                    <div style={s.memberName}>{m.firstName} {m.lastName}</div>
                    <div style={s.memberCount}>{m.sessionCount} so far</div>
                    <span style={{ fontSize: 14, color: "#22c55e" }}>{"\u2705"}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Need to pick it up */}
            {curNeedWork.length > 0 && (
              <div>
                <button style={s.collapseBtn} onClick={() => setShowDidntReachCurrent(!showDidntReachCurrent)}>
                  {showDidntReachCurrent ? "\u25bc" : "\u25b6"} {curNeedWork.length} member{curNeedWork.length !== 1 ? "s" : ""} need to pick it up
                </button>
                {showDidntReachCurrent && curNeedWork.map((m) => (
                  <div key={m.id} style={s.memberRow}>
                    <div style={s.memberAvatar}>{getInitials(m.firstName, m.lastName)}</div>
                    <div style={s.memberName}>
                      {m.firstName} {m.lastName}
                      <span style={{ fontSize: 11, color: B.muted, marginLeft: 8 }}>projected: ~{m.projected} sessions</span>
                    </div>
                    <div style={{ ...s.memberCount, color: B.muted }}>{m.sessionCount} so far</div>
                  </div>
                ))}
              </div>
            )}

            {/* No attendance at all this month */}
            {curNoAttendance.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: B.dim, marginBottom: 4, padding: "0 12px" }}>No attendance yet:</div>
                {curNoAttendance.map((m) => (
                  <div key={m.id} style={s.mutedMember}>
                    {m.firstName} {m.lastName}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={s.section}>
        <div style={s.sectionTitle}>{"\ud83c\udfc6"} Leaderboard</div>
        <div style={s.card}>
          <div style={s.tabBar}>
            {LEADERBOARD_TABS.map((t) => (
              <button key={t.key} style={s.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Podium */}
          {top3.length > 0 && (
            <div style={s.podium}>
              {top3.map((m, idx) => {
                const g = m.gamification || {};
                const val = g[tab.field] || 0;
                return (
                  <div key={m.id} style={s.podiumCard(idx)}>
                    <div style={s.medal}>{medalEmojis[idx]}</div>
                    <div style={s.avatar(medalColors[idx])}>
                      {getInitials(m.firstName, m.lastName)}
                    </div>
                    <div style={s.podName}>{m.firstName} {m.lastName}</div>
                    <div style={s.podValue}>{tab.format(val)}</div>
                    <div style={s.podLevel}>Level {g.level || 1}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Remaining */}
          {rest.map((m, idx) => {
            const g = m.gamification || {};
            const val = g[tab.field] || 0;
            return (
              <div key={m.id} style={s.row(false)}>
                <div style={s.rank}>{idx + 4}</div>
                <div style={s.rowAvatar}>{getInitials(m.firstName, m.lastName)}</div>
                <div style={s.rowName}>{m.firstName} {m.lastName}</div>
                <div style={s.rowValue}>{tab.format(val)}</div>
                <div style={s.rowLevel}>Lv {g.level || 1}</div>
              </div>
            );
          })}

          {sorted.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, color: B.dim, fontSize: 14 }}>
              No active members to display
            </div>
          )}
        </div>
      </div>

      {/* Badges Gallery */}
      <div style={s.section}>
        <div style={s.sectionTitle}>{"\ud83c\udfc5"} Badge Gallery</div>
        <div style={s.badgeGrid}>
          {ALL_BADGES.map((badge) => {
            const count = badgeCounts[badge.key] || 0;
            const earned = count > 0;
            return (
              <div key={badge.key} style={s.badgeCard(earned)}>
                <div style={s.badgeIcon}>{badge.icon}</div>
                <div style={s.badgeName}>{badge.key}</div>
                <div style={s.badgeDesc}>{badge.desc}</div>
                <div style={s.badgeCount}>
                  {count} member{count !== 1 ? "s" : ""} earned
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
