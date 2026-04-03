import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";

const TRIGGER_TYPES = [
  { id: "no_attendance_7", label: "No attendance in 7+ days", icon: "\uD83D\uDEA8", color: "#ef4444" },
  { id: "no_attendance_14", label: "No attendance in 14+ days", icon: "\u26A0\uFE0F", color: "#f59e0b" },
  { id: "underutilized", label: "Not fully utilizing membership", icon: "\uD83D\uDCC9", color: "#f59e0b" },
  { id: "streak_broken", label: "Workout streak broken", icon: "\uD83D\uDD25", color: "#ef4444" },
  { id: "new_member_checkin", label: "New member (first 14 days) — welcome check-in", icon: "\uD83D\uDC4B", color: "#22c55e" },
  { id: "birthday", label: "Birthday this month", icon: "\uD83C\uDF82", color: "#a855f7" },
  { id: "cancel_risk", label: "Cancel scheduled — retention outreach", icon: "\uD83D\uDEA9", color: "#ef4444" },
];

const DEFAULT_CHECKLIST = [
  { id: "reach_out", label: "Reach out via text/call", done: false },
  { id: "discuss_goals", label: "Discuss current goals", done: false },
  { id: "schedule_session", label: "Schedule next session", done: false },
  { id: "follow_up", label: "Follow up within 48 hours", done: false },
];

function daysBetween(d1, d2) {
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function TaskChecklistModal({ task, B, onClose, onComplete }) {
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST.map(c => ({ ...c })));
  const [notes, setNotes] = useState("");
  const { member: tm, trigger, triggerInfo: ti } = task;
  const allDone = checklist.every(c => c.done);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 480, width: "95%" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 28 }}>{ti.icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: B.text }}>{tm.firstName} {tm.lastName}</h3>
            <div style={{ fontSize: 13, color: ti.color, fontWeight: 600 }}>{ti.label}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Checklist</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {checklist.map((item, idx) => (
            <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: B.darker, cursor: "pointer" }}>
              <input type="checkbox" checked={item.done} onChange={() => setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, done: !c.done } : c))}
                style={{ width: 18, height: 18, accentColor: B.accent, cursor: "pointer" }} />
              <span style={{ fontSize: 14, color: item.done ? B.dim : B.text, textDecoration: item.done ? "line-through" : "none" }}>{item.label}</span>
            </label>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 4 }}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes from this outreach..."
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13, minHeight: 60, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={() => onComplete(tm.id, trigger, notes)} disabled={!allDone}
            style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: allDone ? "#22c55e" : B.dim, color: "#fff", cursor: allDone ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, opacity: allDone ? 1 : 0.5 }}>
            Mark Complete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountabilityView() {
  const B = useTheme();
  const { currentUser, users } = useAuth();
  const { members, updateMember } = useMembers();
  const [attendance] = useLocalStorage("hf_attendance", []);
  const [schedule] = useLocalStorage("hf_schedule", []);
  const [plans] = useLocalStorage("hf_plans", []);
  const [accountabilityLog, setAccountabilityLog] = useLocalStorage("hf_accountability_log", []);
  const [selectedCoach, setSelectedCoach] = useState("all");
  const [assignModal, setAssignModal] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [bdayMonth, setBdayMonth] = useState(new Date().getMonth());
  const [bdayYear, setBdayYear] = useState(new Date().getFullYear());

  const coaches = (users || []).filter(u => u.role === "coach" || u.role === "admin");
  const isCoachView = currentUser?.role === "coach";

  // Assign/unassign coach
  const assignCoach = (memberId, coachId) => {
    const coach = coaches.find(c => c.id === coachId);
    updateMember(memberId, { assignedCoach: coachId ? { coachId, coachName: coach?.displayName || coach?.username || "Coach" } : null });
    setAssignModal(null);
  };

  // All active members (coaches can see everyone)
  const activeMembers = useMemo(() => members.filter(m => !!m.membershipPlanId), [members]);

  // Members filtered by coach selection (for display)
  const visibleMembers = useMemo(() => {
    if (selectedCoach === "all") return activeMembers;
    if (selectedCoach === "unassigned") return activeMembers.filter(m => !m.assignedCoach);
    return activeMembers.filter(m => m.assignedCoach?.coachId === selectedCoach);
  }, [activeMembers, selectedCoach]);

  // Members to generate alerts for — coaches only get alerts for THEIR assigned clients
  const alertMembers = useMemo(() => {
    if (isCoachView) return activeMembers.filter(m => m.assignedCoach?.coachId === currentUser.id);
    if (selectedCoach !== "all" && selectedCoach !== "unassigned") return activeMembers.filter(m => m.assignedCoach?.coachId === selectedCoach);
    return activeMembers;
  }, [activeMembers, selectedCoach, isCoachView, currentUser]);

  const unassignedMembers = activeMembers.filter(m => !m.assignedCoach);

  // Build alerts for assigned members only
  const alerts = useMemo(() => {
    const now = new Date();
    const results = [];

    alertMembers.forEach(m => {
      const memberCheckins = attendance.filter(a => a.memberId === m.id && !a.noShow);
      const lastCheckin = memberCheckins.length > 0
        ? memberCheckins.reduce((latest, a) => { const t = new Date(a.checkInTime).getTime(); return t > latest ? t : latest; }, 0)
        : null;
      const daysSinceLast = lastCheckin ? daysBetween(new Date(lastCheckin), now) : null;
      const plan = plans.find(p => p.id === m.membershipPlanId);
      const memberAge = m.createdAt ? daysBetween(new Date(m.createdAt), now) : 999;

      // No attendance 7+ days
      if ((daysSinceLast !== null && daysSinceLast >= 7) || (daysSinceLast === null && memberAge >= 7)) {
        results.push({ member: m, trigger: daysSinceLast >= 14 || (daysSinceLast === null && memberAge >= 14) ? "no_attendance_14" : "no_attendance_7", detail: daysSinceLast !== null ? `Last seen ${daysSinceLast} days ago` : "Never checked in", priority: daysSinceLast || 999 });
      }

      // Underutilized — has sessions included but using less than half
      if (plan?.sessionsIncluded && memberCheckins.length > 0) {
        const last30 = memberCheckins.filter(a => daysBetween(new Date(a.checkInTime), now) <= 30).length;
        const expected = plan.sessionsIncluded;
        if (last30 < expected * 0.5) {
          results.push({ member: m, trigger: "underutilized", detail: `${last30}/${expected} sessions used this month`, priority: 50 });
        }
      }

      // Streak broken
      if (m.gamification?.longestStreak >= 5 && m.gamification?.currentStreak === 0 && daysSinceLast >= 3) {
        results.push({ member: m, trigger: "streak_broken", detail: `Had ${m.gamification.longestStreak}-day streak, now broken`, priority: 40 });
      }

      // New member welcome
      if (memberAge <= 14 && memberAge >= 1) {
        const alreadyDone = accountabilityLog.some(l => l.memberId === m.id && l.trigger === "new_member_checkin");
        if (!alreadyDone) {
          results.push({ member: m, trigger: "new_member_checkin", detail: `Joined ${memberAge} day${memberAge !== 1 ? "s" : ""} ago`, priority: 10 });
        }
      }

      // Birthday this month
      if (m.dob) {
        const dob = new Date(m.dob);
        if (dob.getMonth() === now.getMonth()) {
          results.push({ member: m, trigger: "birthday", detail: `Birthday: ${dob.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, priority: 5 });
        }
      }

      // Cancel scheduled
      if (m.cancelScheduled) {
        results.push({ member: m, trigger: "cancel_risk", detail: `Cancels on ${new Date(m.cancelScheduled).toLocaleDateString()}`, priority: 100 });
      }
    });

    return results.sort((a, b) => b.priority - a.priority);
  }, [visibleMembers, attendance, plans, accountabilityLog]);

  // Complete a task
  const completeTask = (memberId, trigger, notes) => {
    setAccountabilityLog(prev => [...prev, {
      id: crypto.randomUUID(),
      memberId,
      trigger,
      completedBy: currentUser?.displayName || currentUser?.username || "Unknown",
      completedAt: new Date().toISOString(),
      notes: notes || "",
    }]);
    setTaskModal(null);
  };

  // Check if an alert has been completed recently (within 7 days)
  const isRecentlyCompleted = (memberId, trigger) => {
    return accountabilityLog.some(l =>
      l.memberId === memberId && l.trigger === trigger &&
      daysBetween(new Date(l.completedAt), new Date()) < 7
    );
  };

  const triggerInfo = (id) => TRIGGER_TYPES.find(t => t.id === id) || { label: id, icon: "\uD83D\uDD18", color: "#666" };

  // Styles
  const s = {
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 },
    title: { fontSize: 24, fontWeight: 800, color: B.text },
    filterRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 20 },
    pill: (active) => ({ padding: "6px 14px", borderRadius: 20, border: "1px solid " + (active ? B.accent : B.border), background: active ? B.accent : "transparent", color: active ? "#fff" : B.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }),
    alertCard: { padding: "14px 16px", borderRadius: 12, background: B.card, border: "1px solid " + B.border, display: "flex", alignItems: "center", gap: 14, marginBottom: 8 },
    memberName: { fontSize: 14, fontWeight: 700, color: B.text },
    detail: { fontSize: 12, color: B.muted },
    coachBadge: { fontSize: 11, padding: "2px 8px", borderRadius: 10, background: B.accent + "15", color: B.accent, fontWeight: 600 },
    actionBtn: (bg, color) => ({ padding: "5px 14px", borderRadius: 8, border: "none", background: bg, color, fontSize: 12, fontWeight: 700, cursor: "pointer" }),
    statCard: { textAlign: "center", padding: 16 },
    statValue: { fontSize: 28, fontWeight: 800, color: B.text },
    statLabel: { fontSize: 11, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  // Summary stats
  const activeAlerts = alerts.filter(a => !isRecentlyCompleted(a.member.id, a.trigger));
  const completedToday = accountabilityLog.filter(l => new Date(l.completedAt).toDateString() === new Date().toDateString()).length;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Accountability</h1>
        {!isCoachView && (
          <button onClick={() => setAssignModal("bulk")} style={s.actionBtn(B.accent, "#fff")}>
            Assign Clients to Coaches
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Card style={s.statCard}>
          <div style={{ ...s.statValue, color: "#ef4444" }}>{activeAlerts.length}</div>
          <div style={s.statLabel}>Active Alerts</div>
        </Card>
        <Card style={s.statCard}>
          <div style={{ ...s.statValue, color: "#22c55e" }}>{completedToday}</div>
          <div style={s.statLabel}>Completed Today</div>
        </Card>
        <Card style={s.statCard}>
          <div style={s.statValue}>{isCoachView ? alertMembers.length : activeMembers.filter(m => m.assignedCoach).length}</div>
          <div style={s.statLabel}>{isCoachView ? "My Clients" : "Assigned Clients"}</div>
        </Card>
        <Card style={s.statCard}>
          <div style={{ ...s.statValue, color: B.orange }}>{unassignedMembers.length}</div>
          <div style={s.statLabel}>Unassigned</div>
        </Card>
      </div>

      {/* Coach Filter (admin only) */}
      {!isCoachView && (
        <div style={s.filterRow}>
          <span style={{ fontSize: 13, fontWeight: 600, color: B.muted }}>Filter by coach:</span>
          <button style={s.pill(selectedCoach === "all")} onClick={() => setSelectedCoach("all")}>All</button>
          <button style={s.pill(selectedCoach === "unassigned")} onClick={() => setSelectedCoach("unassigned")}>Unassigned</button>
          {coaches.map(c => (
            <button key={c.id} style={s.pill(selectedCoach === c.id)} onClick={() => setSelectedCoach(c.id)}>
              {c.displayName || c.username}
            </button>
          ))}
        </div>
      )}

      {/* Unassigned members section */}
      {selectedCoach === "unassigned" && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 12 }}>
            Unassigned Clients ({unassignedMembers.length})
          </div>
          {unassignedMembers.length === 0 ? (
            <div style={{ color: B.dim, fontSize: 13 }}>All active clients are assigned to a coach.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {unassignedMembers.map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: B.accent + "22", color: B.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                    {getInitials(m.firstName + " " + m.lastName)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: B.text }}>{m.firstName} {m.lastName}</div>
                    <div style={{ fontSize: 11, color: B.dim }}>{m.email}</div>
                  </div>
                  <select onChange={e => { if (e.target.value) assignCoach(m.id, e.target.value); e.target.value = ""; }}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.card, color: B.text, fontSize: 12, cursor: "pointer", outline: "none" }}>
                    <option value="">Assign coach...</option>
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.displayName || c.username}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Active Alerts */}
      {selectedCoach !== "unassigned" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, color: B.text, marginBottom: 12 }}>
            Action Items ({activeAlerts.length})
          </div>
          {activeAlerts.length === 0 ? (
            <Card style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{"\u2705"}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: B.text }}>All caught up!</div>
              <div style={{ fontSize: 13, color: B.muted, marginTop: 4 }}>No outstanding accountability tasks right now.</div>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {activeAlerts.map((a, i) => {
                const t = triggerInfo(a.trigger);
                return (
                  <div key={i} style={{ ...s.alertCard, borderLeft: `4px solid ${t.color}` }}>
                    <span style={{ fontSize: 24 }}>{t.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={s.memberName}>{a.member.firstName} {a.member.lastName}</div>
                      <div style={s.detail}>{t.label}</div>
                      <div style={{ fontSize: 11, color: B.dim }}>{a.detail}</div>
                      {a.member.assignedCoach && (
                        <span style={s.coachBadge}>{a.member.assignedCoach.coachName}</span>
                      )}
                    </div>
                    <button onClick={() => setTaskModal({ member: a.member, trigger: a.trigger, triggerInfo: t })}
                      style={s.actionBtn(t.color + "18", t.color)}>
                      Start Task
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent Activity */}
          {accountabilityLog.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 10 }}>Recent Activity</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {accountabilityLog.slice(-20).reverse().map(l => {
                  const m = members.find(x => x.id === l.memberId);
                  const t = triggerInfo(l.trigger);
                  const d = new Date(l.completedAt);
                  return (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
                      <span style={{ fontSize: 14 }}>{"\u2705"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: B.text }}>
                          <strong>{m ? `${m.firstName} ${m.lastName}` : "Unknown"}</strong> — {t.label}
                        </div>
                        {l.notes && <div style={{ fontSize: 12, color: B.muted }}>{l.notes}</div>}
                        <div style={{ fontSize: 11, color: B.dim }}>
                          {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          {" \u2022 by "}{l.completedBy}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Birthdays This Month */}
      {(() => {
        const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

        const birthdays = members
          .filter(m => {
            if (!m.dob) return false;
            const dob = new Date(m.dob + "T12:00:00");
            return dob.getMonth() === bdayMonth;
          })
          .map(m => {
            const dob = new Date(m.dob + "T12:00:00");
            const age = bdayYear - dob.getFullYear();
            return { ...m, bdayDay: dob.getDate(), age };
          })
          .sort((a, b) => a.bdayDay - b.bdayDay);

        return (
          <Card style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>{"\uD83C\uDF82"}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: B.text }}>Birthdays</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => { if (bdayMonth === 0) { setBdayMonth(11); setBdayYear(y => y - 1); } else setBdayMonth(m => m - 1); }}
                  style={{ background: "transparent", border: "1px solid " + B.border, borderRadius: 6, color: B.muted, cursor: "pointer", padding: "4px 8px", fontSize: 14 }}>{"\u25C0"}</button>
                <span style={{ fontSize: 14, fontWeight: 700, color: B.text, minWidth: 120, textAlign: "center" }}>{MONTHS[bdayMonth]} {bdayYear}</span>
                <button onClick={() => { if (bdayMonth === 11) { setBdayMonth(0); setBdayYear(y => y + 1); } else setBdayMonth(m => m + 1); }}
                  style={{ background: "transparent", border: "1px solid " + B.border, borderRadius: 6, color: B.muted, cursor: "pointer", padding: "4px 8px", fontSize: 14 }}>{"\u25B6"}</button>
              </div>
            </div>
            {birthdays.length === 0 ? (
              <div style={{ color: B.dim, fontSize: 13, padding: "8px 0" }}>No birthdays in {MONTHS[bdayMonth]}.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {birthdays.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#a855f7" + "22", color: "#a855f7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {m.bdayDay}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{m.firstName} {m.lastName}</div>
                      <div style={{ fontSize: 12, color: B.muted }}>Turning {m.age}</div>
                    </div>
                    {m.assignedCoach && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: B.accent + "15", color: B.accent, fontWeight: 600 }}>{m.assignedCoach.coachName}</span>}
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 12, color: B.dim, borderTop: "1px solid " + B.border + "44", paddingTop: 8 }}>
                  {birthdays.length} birthday{birthdays.length !== 1 ? "s" : ""} in {MONTHS[bdayMonth]}
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      {/* Bulk Assign Modal */}
      {assignModal === "bulk" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setAssignModal(null)}>
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 560, width: "95%", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: B.text }}>Assign Clients to Coaches</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {members.filter(m => !!m.membershipPlanId).map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: B.text }}>{m.firstName} {m.lastName}</div>
                  </div>
                  <select value={m.assignedCoach?.coachId || ""} onChange={e => assignCoach(m.id, e.target.value)}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.card, color: B.text, fontSize: 12, cursor: "pointer", outline: "none", minWidth: 140 }}>
                    <option value="">Unassigned</option>
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.displayName || c.username}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setAssignModal(null)} style={s.actionBtn(B.accent, "#fff")}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Checklist Modal */}
      {taskModal && <TaskChecklistModal task={taskModal} B={B} onClose={() => setTaskModal(null)} onComplete={completeTask} />}
    </div>
  );
}
