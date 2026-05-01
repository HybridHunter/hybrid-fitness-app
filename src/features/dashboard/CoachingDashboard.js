import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";
import { useAuth } from "../../context/AuthContext";
import { PostShiftCheckinModal } from "../coaching/PostShiftCheckin";

/* ========== constants ========== */
const PATTERNS = ["Squat","Hinge","Lunge","Push","Pull","Core","Carry"];
const PATTERN_COLORS = {
  Squat:"#e94560",Hinge:"#f59e0b",Lunge:"#22c55e",Push:"#3b82f6",
  Pull:"#a855f7",Core:"#ff7043",Carry:"#26a69a",
};
const DAYS_OF_WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/* ========== helpers ========== */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayDayOfWeek() {
  const jsDay = new Date().getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1; // 0=Mon...6=Sun to match schedule format
}

function fmtScheduleTime(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function isToday(iso) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function getInitials(f, l) {
  return ((f?.[0] || "") + (l?.[0] || "")).toUpperCase();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtTimeFromISO(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${m} ${ampm}`;
}

function daysSince(iso) {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function getScoreColor(val) {
  if (val <= -3) return "#ef4444";
  if (val === -2) return "#f87171";
  if (val === -1) return "#fb923c";
  if (val === 0) return "#facc15";
  if (val === 1) return "#a3e635";
  if (val === 2) return "#4ade80";
  return "#22c55e";
}

/* ========== component ========== */
export default function CoachingDashboard() {
  const B = useTheme();
  const navigate = useNavigate();
  const _gp = (p) => `/gym/${localStorage.getItem("hf_gym_id") || "default"}/${p}`;
  const { currentUser } = useAuth();
  const { members, getMember, updateMember } = useMembers();
  const [schedule] = useLocalStorage("hf_schedule", []);
  const [attendance, setAttendance] = useLocalStorage("hf_attendance", []);
  const [shiftLogs, setShiftLogs] = useLocalStorage("hf_shift_logs", []);
  const [showShiftCheckin, setShowShiftCheckin] = useState(null); // date string or null
  const [assessments] = useLocalStorage("hf_assessments", []);

  // Live clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Quick member lookup
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Derived data
  const todayDow = getTodayDayOfWeek();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todaySessions = useMemo(() => {
    return schedule
      .filter(c => c.dayOfWeek === todayDow)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [schedule, todayDow]);

  const todayCheckins = useMemo(() => {
    return attendance
      .filter(a => isToday(a.checkInTime))
      .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime));
  }, [attendance, now]);

  const atRiskMembers = useMemo(() => {
    const activeMembers = members.filter(m => !!m.membershipPlanId);
    return activeMembers
      .map(m => {
        const memberCheckins = attendance.filter(a => a.memberId === m.id && !a.noShow);
        const lastCheckin = memberCheckins.length > 0
          ? memberCheckins.reduce((latest, a) => new Date(a.checkInTime) > new Date(latest.checkInTime) ? a : latest)
          : null;
        const days = lastCheckin ? daysSince(lastCheckin.checkInTime) : daysSince(m.startDate);
        return { ...m, lastSeenDays: days, lastCheckin };
      })
      .filter(m => m.lastSeenDays >= 7)
      .sort((a, b) => b.lastSeenDays - a.lastSeenDays);
  }, [members, attendance]);

  const recentAssessments = useMemo(() => {
    return assessments.slice(0, 5);
  }, [assessments]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return members.filter(m =>
      (m.firstName + " " + m.lastName).toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, members]);

  // Quick check-in handler
  const handleQuickCheckIn = (memberId, classId) => {
    const member = getMember(memberId);
    if (!member) return;
    const record = {
      id: crypto.randomUUID(),
      memberId,
      checkInTime: new Date().toISOString(),
      method: "coach",
      ...(classId ? { classId } : {}),
    };
    setAttendance(prev => [...prev, record]);

    // Update gamification stats
    const g = member.gamification || { level: 1, xp: 0, totalWorkouts: 0, totalWeightLifted: 0, badges: [], currentStreak: 0, longestStreak: 0 };
    const todayStr = new Date().toISOString().slice(0, 10);
    const alreadyToday = attendance.some(a => a.memberId === memberId && a.checkInTime.slice(0, 10) === todayStr);
    const newTotalWorkouts = (g.totalWorkouts || 0) + 1;
    const newCurrentStreak = alreadyToday ? (g.currentStreak || 0) : (g.currentStreak || 0) + 1;
    const newLongestStreak = Math.max(newCurrentStreak, g.longestStreak || 0);
    updateMember(memberId, {
      gamification: { ...g, totalWorkouts: newTotalWorkouts, currentStreak: newCurrentStreak, longestStreak: newLongestStreak },
    });
  };

  // Pending shift check-ins — today + any missed days
  const pendingCheckins = useMemo(() => {
    const coachName = currentUser?.displayName || currentUser?.username || "Coach";
    const today = todayISO();
    const pending = [];

    // Check last 7 days for missed check-ins
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;

      // Did this coach have sessions on this day?
      const hadSessions = schedule.some(s => s.dayOfWeek === dow);
      if (!hadSessions) continue;

      // Already submitted for this date?
      const alreadySubmitted = shiftLogs.some(l => l.date === dateStr && l.coachName === coachName);
      if (alreadySubmitted) continue;

      // For today, only prompt if all sessions are done
      if (dateStr === today) {
        const todaySess = schedule.filter(s => s.dayOfWeek === dow);
        const allDone = todaySess.every(s => {
          const endMin = timeToMinutes(s.endTime);
          return currentMinutes > endMin;
        });
        if (!allDone) continue;
      }

      pending.push(dateStr);
    }
    return pending;
  }, [schedule, shiftLogs, currentUser, currentMinutes]);

  const handleShiftSubmit = (data) => {
    setShiftLogs(prev => [...prev, { id: crypto.randomUUID(), ...data }]);
    setShowShiftCheckin(null);
  };

  // Styles
  const sectionTitle = { fontSize: 20, fontWeight: 700, color: B.text, margin: "0 0 12px 0" };
  const label = { fontSize: 13, color: B.muted, fontWeight: 500 };
  const bigNum = { fontSize: 32, fontWeight: 800, color: B.text };

  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>

      {/* ===== POST-SHIFT CHECK-IN BANNER ===== */}
      {pendingCheckins.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, " + B.accent + "22, " + B.accent + "08)",
          border: "1px solid " + B.accent + "40", borderRadius: 12, padding: "14px 20px",
          marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: B.text }}>
              {pendingCheckins.length === 1 && pendingCheckins[0] === todayISO()
                ? "Your sessions are done — submit your shift check-in!"
                : `You have ${pendingCheckins.length} pending shift check-in${pendingCheckins.length > 1 ? "s" : ""}`
              }
            </div>
            <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>Log your hours, breaks, and client wins.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {pendingCheckins.map(dateStr => (
              <button key={dateStr} onClick={() => setShowShiftCheckin(dateStr)} style={{
                padding: "8px 16px", borderRadius: 8, border: "none", background: B.accent, color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                {dateStr === todayISO() ? "Check In Now" : new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Post-Shift Modal */}
      {showShiftCheckin && (
        <PostShiftCheckinModal
          date={showShiftCheckin}
          coachName={currentUser?.displayName || currentUser?.username || "Coach"}
          onClose={() => setShowShiftCheckin(null)}
          onSubmit={handleShiftSubmit}
        />
      )}

      {/* ===== HEADER ===== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: B.text, margin: 0 }}>Coaching Dashboard</h1>
          <p style={{ fontSize: 18, color: B.muted, margin: "4px 0 0 0" }}>
            {getGreeting()}, Coach &middot; {dateStr}
          </p>
          <p style={{ fontSize: 14, color: B.dim, margin: "2px 0 0 0" }}>{timeStr}</p>
        </div>

        {/* Quick Member Lookup */}
        <div style={{ position: "relative", minWidth: 280 }}>
          <input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 10,
              border: `2px solid ${searchFocused ? B.accent : B.border}`,
              background: B.card, color: B.text, fontSize: 16, outline: "none",
              transition: "border-color 0.2s",
            }}
          />
          {searchFocused && searchResults.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
              background: B.card, border: `1px solid ${B.border}`, borderRadius: 10,
              marginTop: 4, maxHeight: 320, overflowY: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}>
              {searchResults.map(m => (
                <div
                  key={m.id}
                  onClick={() => { navigate(_gp(`members/${m.id}`)); setSearchQuery(""); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    cursor: "pointer", borderBottom: `1px solid ${B.border}`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = B.darker}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: B.accent + "22",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14, color: B.accent, flexShrink: 0,
                  }}>
                    {getInitials(m.firstName, m.lastName)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: B.text, fontSize: 15 }}>{m.firstName} {m.lastName}</div>
                    <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
                      {m.movementScores && PATTERNS.map(p => (
                        <div key={p} style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: getScoreColor(m.movementScores[p] || 0),
                        }} title={`${p}: ${m.movementScores[p] || 0}`} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== SECTION 1: TODAY'S SESSIONS ===== */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={sectionTitle}>Today&rsquo;s Sessions</h2>
        {todaySessions.length === 0 ? (
          <Card><p style={{ color: B.muted, margin: 0, fontSize: 16 }}>No sessions scheduled for today.</p></Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {todaySessions.map(cls => {
              const startMin = timeToMinutes(cls.startTime);
              const endMin = timeToMinutes(cls.endTime);
              const isActive = currentMinutes >= startMin && currentMinutes < endMin;
              const isPast = currentMinutes >= endMin;
              // Next upcoming: first class that hasn't started yet
              const nextUpcoming = todaySessions.find(c => timeToMinutes(c.startTime) > currentMinutes);
              const isNext = nextUpcoming && nextUpcoming.id === cls.id;
              const booked = (cls.bookings || []).length;

              // Check which members in this class are checked in today
              const bookingMemberIds = new Set(cls.bookings || []);

              return (
                <Card key={cls.id} style={{
                  opacity: isPast ? 0.6 : 1,
                  border: isActive
                    ? `2px solid ${B.green}`
                    : isNext
                    ? `2px solid ${B.accent}`
                    : `1px solid ${B.border}`,
                  position: "relative",
                }}>
                  {/* Active badge */}
                  {isActive && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      background: B.green, color: "#fff", fontWeight: 700,
                      fontSize: 11, padding: "3px 10px", borderRadius: 20,
                      textTransform: "uppercase", letterSpacing: 0.5,
                    }}>Currently Active</div>
                  )}
                  {isNext && !isActive && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      background: B.accent + "33", color: B.accent, fontWeight: 700,
                      fontSize: 11, padding: "3px 10px", borderRadius: 20,
                      textTransform: "uppercase", letterSpacing: 0.5,
                    }}>Up Next</div>
                  )}

                  <div style={{ fontSize: 18, fontWeight: 700, color: B.text, marginBottom: 4, paddingRight: 100 }}>{cls.name}</div>
                  <div style={{ fontSize: 14, color: B.muted, marginBottom: 8 }}>
                    {fmtScheduleTime(cls.startTime)} - {fmtScheduleTime(cls.endTime)} &middot; {cls.instructor}
                  </div>

                  {/* Capacity bar */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: B.muted }}>Capacity</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: booked >= cls.capacity ? B.red : B.text }}>
                        {booked} / {cls.capacity}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: B.border }}>
                      <div style={{
                        height: "100%", borderRadius: 4,
                        width: `${Math.min(100, (booked / cls.capacity) * 100)}%`,
                        background: booked >= cls.capacity ? B.red : B.green,
                        transition: "width 0.3s",
                      }} />
                    </div>
                  </div>

                  {/* Member list with quick check-in */}
                  {booked > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                      {(cls.bookings || []).map(memberId => {
                        const m = getMember(memberId);
                        if (!m) return null;
                        const checkedIn = todayCheckins.some(a => a.memberId === memberId && a.classId === cls.id);
                        const canQuickCheckIn = (isActive || (isNext && startMin - currentMinutes <= 30)) && !checkedIn;
                        return (
                          <div key={memberId} style={{
                            display: "flex", alignItems: "center", gap: 8,
                            background: B.darker, borderRadius: 8, padding: "5px 8px",
                          }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%",
                              background: checkedIn ? B.green + "22" : B.accent + "22",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontWeight: 700, fontSize: 11, color: checkedIn ? B.green : B.accent,
                              flexShrink: 0,
                            }}>
                              {getInitials(m.firstName, m.lastName)}
                            </div>
                            <span onClick={(e) => { e.stopPropagation(); navigate(_gp(`members/${memberId}`)); }}
                              style={{ fontSize: 13, color: B.text, flex: 1, cursor: "pointer", borderBottom: "1px dashed transparent" }}
                              onMouseEnter={e => e.currentTarget.style.borderBottomColor = B.accent}
                              onMouseLeave={e => e.currentTarget.style.borderBottomColor = "transparent"}>
                              {m.firstName} {m.lastName?.[0]}.
                            </span>
                            {checkedIn ? (
                              <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                                <span style={{ fontSize: 14, color: B.green }} title="Checked in">{"\u2713"}</span>
                                <button onClick={(e) => { e.stopPropagation(); setAttendance(prev => prev.filter(a => !(a.memberId === memberId && a.classId === cls.id && a.checkInTime?.slice(0,10) === new Date().toISOString().slice(0,10)))); }}
                                  style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid " + B.border, background: "transparent", color: B.muted, fontSize: 10, cursor: "pointer" }} title="Undo check-in">Undo</button>
                                <button onClick={(e) => { e.stopPropagation(); setAttendance(prev => { const without = prev.filter(a => !(a.memberId === memberId && a.classId === cls.id && a.checkInTime?.slice(0,10) === new Date().toISOString().slice(0,10))); return [...without, { id: crypto.randomUUID(), memberId, checkInTime: new Date().toISOString(), method: "no-show", classId: cls.id, noShow: true }]; }); }}
                                  style={{ padding: "2px 6px", borderRadius: 4, border: "none", background: (B.orange || "#f59e0b") + "22", color: B.orange || "#f59e0b", fontSize: 10, fontWeight: 700, cursor: "pointer" }} title="Mark as no-show">No Show</button>
                              </div>
                            ) : canQuickCheckIn ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleQuickCheckIn(memberId, cls.id); }}
                                style={{
                                  padding: "3px 10px", borderRadius: 6, border: "none",
                                  background: B.green, color: "#fff", fontWeight: 700,
                                  fontSize: 11, cursor: "pointer", flexShrink: 0,
                                  transition: "opacity 0.15s",
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                              >Check In</button>
                            ) : (
                              <div style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: B.dim, flexShrink: 0,
                              }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => navigate(_gp("command"))}
                    style={{
                      width: "100%", padding: "10px 0", borderRadius: 8,
                      border: `1px solid ${B.accent}`, background: "transparent",
                      color: B.accent, fontWeight: 700, fontSize: 14, cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = B.accent + "15"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >Open Session View</button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== SECTION 2: QUICK ACTIONS ===== */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={sectionTitle}>Quick Actions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          {[
            { label: "Check In Client", icon: "&#10003;", route: "/checkin", color: B.green },
            { label: "Open Session View", icon: "&#9654;", route: "/command", color: B.blue || B.accent },
            { label: "New Assessment", icon: "&#9881;", route: "/assessments", color: B.purple },
            { label: "Send Message", icon: "&#9993;", route: "/messages", color: B.orange },
          ].map(action => (
            <Card key={action.label} style={{ cursor: "pointer", textAlign: "center", padding: 24, transition: "transform 0.15s" }}
              onClick={() => navigate(_gp(action.route.replace(/^\//, "")))}>
              <div
                style={{ fontSize: 36, marginBottom: 8, color: action.color }}
                dangerouslySetInnerHTML={{ __html: action.icon }}
              />
              <div style={{ fontSize: 16, fontWeight: 700, color: B.text }}>{action.label}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* ===== TWO-COLUMN LAYOUT for sections 3+4, 5+7 ===== */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>

        {/* ===== SECTION 3: AT-RISK MEMBERS ===== */}
        <Card style={{ padding: 20 }}>
          <h2 style={{ ...sectionTitle, marginBottom: 16 }}>At-Risk Clients</h2>
          {atRiskMembers.length === 0 ? (
            <p style={{ color: B.muted, margin: 0 }}>All clients are active. No one flagged.</p>
          ) : (
            <>
              {atRiskMembers.slice(0, 5).map(m => {
                const severity = m.lastSeenDays >= 14 ? B.red : B.orange;
                return (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 0", borderBottom: `1px solid ${B.border}`,
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%",
                      background: severity + "22", border: `2px solid ${severity}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 15, color: severity, flexShrink: 0,
                    }}>
                      {getInitials(m.firstName, m.lastName)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: B.text, fontSize: 15 }}>{m.firstName} {m.lastName}</div>
                      <div style={{ fontSize: 13, color: severity, fontWeight: 600 }}>
                        Last seen {m.lastSeenDays} days ago
                      </div>
                      <div style={{ fontSize: 12, color: B.dim }}>{m.membershipStatus}</div>
                    </div>
                    <button
                      onClick={() => navigate(_gp("messages"))}
                      style={{
                        padding: "6px 14px", borderRadius: 8, border: `1px solid ${severity}`,
                        background: "transparent", color: severity, fontWeight: 600,
                        fontSize: 13, cursor: "pointer",
                      }}
                    >Message</button>
                  </div>
                );
              })}
              {atRiskMembers.length > 5 && (
                <div
                  onClick={() => navigate(_gp("members"))}
                  style={{ textAlign: "center", padding: "10px 0", color: B.accent, fontWeight: 600, fontSize: 14, cursor: "pointer", marginTop: 8 }}
                >
                  View all {atRiskMembers.length} at-risk clients
                </div>
              )}
            </>
          )}
        </Card>

        {/* ===== SECTION 4: TODAY'S CHECK-INS FEED ===== */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ ...sectionTitle, margin: 0 }}>Today&rsquo;s Check-ins</h2>
            <div style={{
              background: B.green + "22", color: B.green, fontWeight: 700,
              fontSize: 14, padding: "4px 12px", borderRadius: 20,
            }}>
              {todayCheckins.length} checked in
            </div>
          </div>
          {todayCheckins.length === 0 ? (
            <p style={{ color: B.muted, margin: 0 }}>No check-ins yet today.</p>
          ) : (
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {todayCheckins.map(a => {
                const m = getMember(a.memberId);
                if (!m) return null;
                const checkinTime = new Date(a.checkInTime);
                const minutesAgo = Math.floor((now - checkinTime) / 60000);
                const isRecent = minutesAgo < 5;

                // Try to find which class they might be in
                const matchedClass = todaySessions.find(cls =>
                  (cls.bookings || []).includes(a.memberId) &&
                  timeToMinutes(cls.startTime) <= checkinTime.getHours() * 60 + checkinTime.getMinutes() + 30 &&
                  timeToMinutes(cls.startTime) >= checkinTime.getHours() * 60 + checkinTime.getMinutes() - 30
                );

                return (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 0", borderBottom: `1px solid ${B.border}`,
                  }}>
                    {/* Green dot with pulse for recent */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: B.accent + "22",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 14, color: B.accent,
                      }}>
                        {getInitials(m.firstName, m.lastName)}
                      </div>
                      {isRecent && (
                        <div style={{
                          position: "absolute", top: -2, right: -2,
                          width: 12, height: 12, borderRadius: "50%",
                          background: B.green, border: `2px solid ${B.card}`,
                          animation: "pulse 1.5s ease-in-out infinite",
                        }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: B.text, fontSize: 15 }}>{m.firstName} {m.lastName}</div>
                      <div style={{ fontSize: 12, color: B.dim }}>
                        {matchedClass ? matchedClass.name : "Open Gym"}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: B.muted, fontWeight: 500, flexShrink: 0 }}>
                      {fmtTimeFromISO(a.checkInTime)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ===== SECTION 5: RECENT ASSESSMENTS ===== */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={sectionTitle}>Recent Assessments</h2>
        {recentAssessments.length === 0 ? (
          <Card><p style={{ color: B.muted, margin: 0, fontSize: 16 }}>No assessments recorded yet.</p></Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {recentAssessments.map((a, idx) => {
              const m = getMember(a.memberId);
              if (!m) return null;
              const assessDate = new Date(a.date);
              return (
                <Card key={a.id || idx} style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: B.text, fontSize: 16 }}>{m.firstName} {m.lastName}</div>
                      <div style={{ fontSize: 13, color: B.muted }}>
                        {assessDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {a.assessorName ? ` by ${a.assessorName}` : ""}
                      </div>
                    </div>
                  </div>
                  {/* Score dots */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {PATTERNS.map(p => {
                      const score = a.scores?.[p] ?? 0;
                      return (
                        <div key={p} style={{ textAlign: "center" }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: getScoreColor(score),
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 700, color: "#fff",
                          }}>
                            {score > 0 ? `+${score}` : score}
                          </div>
                          <div style={{ fontSize: 9, color: B.dim, marginTop: 2 }}>{p.slice(0, 2)}</div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => navigate(_gp(`members/${m.id}`))}
                    style={{
                      width: "100%", padding: "8px 0", borderRadius: 8,
                      border: `1px solid ${B.border}`, background: "transparent",
                      color: B.accent, fontWeight: 600, fontSize: 13, cursor: "pointer",
                    }}
                  >View Profile</button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
