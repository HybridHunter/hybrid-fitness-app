import { useState, useMemo, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";
import EditProfileModal from "../auth/EditProfileModal";
import { autoIndividualize } from "../../utils/autoIndividualize";
import { DEFAULT_MATRIX } from "../../data/movementMatrix";
import { EX } from "../../data/exercises";

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAYS_FULL = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const todayISO = () => new Date().toISOString().slice(0, 10);

const getTodayDow = () => {
  const d = new Date().getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1; // 0=Mon
};

const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

const fmtDateNice = (d) => {
  const date = new Date(d);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const fmtDateShort = (d) => {
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

const getInitials = (name) => {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const extractYouTubeId = (url) => {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

const getMonday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const daysBetween = (a, b) => {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.round((db - da) / 86400000);
};

const RANK_COLORS = {
  White: "#888", Bronze: "#cd7f32", Silver: "#c0c0c0", Gold: "#ffd700", Platinum: "#e5e4e2", Black: "#111"
};

const PATTERN_COLORS = {
  Squat: "#3b82f6", Hinge: "#f59e0b", Lunge: "#a855f7", Push: "#ef4444", Pull: "#8fbf3b", Core: "#06b6d4", Carry: "#f97316"
};

const SCORE_LABELS = { "-3": "Regressed", "-2": "Limited", "-1": "Below Avg", "0": "Baseline", "1": "Good", "2": "Advanced", "3": "Elite" };

const CHALLENGE_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
];

const RESOURCE_ICONS = {
  pdf: "\uD83D\uDCC4",
  video: "\uD83C\uDFA5",
  doc: "\uD83D\uDDD2\uFE0F",
  link: "\uD83D\uDD17",
  image: "\uD83D\uDDBC\uFE0F",
};

/* ═══════════════════════════════════════════════════════════
   CLIENT PORTAL — MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function ClientPortal() {
  const B = useTheme();
  const { currentUser, logout } = useAuth();
  const { getMember, members } = useMembers();
  const [activeTab, setActiveTab] = useState("home");
  const [prevTab, setPrevTab] = useState("home");
  const [transitioning, setTransitioning] = useState(false);

  // Data stores
  const [classes] = useLocalStorage("hf_schedule", []);
  const [attendance] = useLocalStorage("hf_attendance", []);
  const [workouts] = useLocalStorage("hf_w", []);
  const [communityPosts, setCommunityPosts] = useLocalStorage("hf_community_posts", []);
  const [messages, setMessages] = useLocalStorage("hf_messages", []);
  const [workoutLogs, setWorkoutLogs] = useLocalStorage("hf_workout_logs", []);
  const [matrix] = useLocalStorage("hf_matrix", DEFAULT_MATRIX);
  const [exercises] = useLocalStorage("hf_ex", [...EX]);
  const [challenges, setChallenges] = useLocalStorage("hf_challenges", []);
  const [resources] = useLocalStorage("hf_resources", []);

  // Video modal
  const [videoModal, setVideoModal] = useState(null);
  // Edit profile modal
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  // Community sub-tab state
  const [communitySubTab, setCommunitySubTab] = useState("feed");
  const [activeChallengeId, setActiveChallengeId] = useState(null);
  const [checkinText, setCheckinText] = useState("");
  const [checkinProof, setCheckinProof] = useState("");
  const [newPostText, setNewPostText] = useState("");
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});

  // Member data
  const member = useMemo(() => {
    if (!currentUser?.memberId) return null;
    return getMember(currentUser.memberId);
  }, [currentUser, getMember]);

  const firstName = member?.firstName || currentUser?.displayName?.split(" ")[0] || "Member";
  const myId = currentUser?.memberId || member?.id;

  // Helper to get member display name from id
  const getMemberName = (mid) => {
    if (mid === "coach") return "Coach";
    if (mid === myId) return `${member?.firstName || "You"} ${member?.lastName || ""}`.trim();
    const m = members?.find(x => x.id === mid);
    return m ? `${m.firstName || ""} ${m.lastName || ""}`.trim() : mid;
  };

  // Tab transition
  const switchTab = (tab) => {
    if (tab === activeTab) return;
    setPrevTab(activeTab);
    setTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTransitioning(false);
    }, 150);
  };

  // Today's classes this member is booked into
  const todayDow = getTodayDow();
  const myBookedClasses = useMemo(() => {
    if (!member) return [];
    return classes.filter(c => c.bookings?.includes(member.id));
  }, [classes, member]);

  const todayClasses = useMemo(() => {
    return myBookedClasses.filter(c => c.dayOfWeek === todayDow);
  }, [myBookedClasses, todayDow]);

  const upcomingClasses = useMemo(() => {
    // Next 3 booked classes after today
    const upcoming = [];
    for (let offset = 0; offset < 7 && upcoming.length < 3; offset++) {
      const dow = (todayDow + offset) % 7;
      const dayClasses = myBookedClasses
        .filter(c => c.dayOfWeek === dow && (offset > 0 || true))
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
      for (const c of dayClasses) {
        if (upcoming.length < 3 && !todayClasses.includes(c)) {
          upcoming.push({ ...c, _dayLabel: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : DAYS_FULL[dow] });
        }
      }
    }
    return upcoming;
  }, [myBookedClasses, todayDow, todayClasses]);

  // Unread messages count
  const unreadCount = useMemo(() => {
    if (!member) return 0;
    let count = 0;
    (messages || []).forEach(conv => {
      if (conv.participants?.includes(member.id)) {
        (conv.messages || []).forEach(msg => {
          if (msg.senderId !== member.id && !msg.read) count++;
        });
      }
    });
    return count;
  }, [messages, member]);

  // My attendance dates for streak calendar
  const myAttendance = useMemo(() => {
    if (!member) return [];
    return attendance.filter(a => a.memberId === member.id);
  }, [attendance, member]);

  // Joined challenges
  const myJoinedChallenges = useMemo(() => {
    if (!myId) return [];
    return (challenges || []).filter(c => c.participants?.includes(myId));
  }, [challenges, myId]);

  // Current date
  const now = new Date();
  const dateStr = `${DAYS_FULL[todayDow]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  /* ─── STYLE TOKENS ─── */
  const shell = {
    maxWidth: 480, margin: "0 auto", minHeight: "100vh", position: "relative",
    background: B.darker, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: 80, overflow: "hidden",
  };

  const tabBar = {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 480, height: 56,
    background: B.card + "dd", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    borderTop: `1px solid ${B.border}40`, borderRadius: "20px 20px 0 0",
    display: "flex", alignItems: "center", justifyContent: "space-around",
    padding: "0 4px", zIndex: 100, boxSizing: "border-box",
  };

  const cardStyle = {
    borderRadius: 16, padding: "14px 16px", border: `1px solid ${B.border}`,
    background: B.card, marginBottom: 12,
  };

  const sectionTitle = {
    fontSize: 18, fontWeight: 700, color: B.text, margin: "20px 0 10px",
  };

  const bodyText = { fontSize: 15, color: B.text, lineHeight: 1.5 };
  const mutedText = { fontSize: 13, color: B.muted };
  const labelText = { fontSize: 13, color: B.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 };

  const touchBtn = (bg, fg, extra = {}) => ({
    minHeight: 44, padding: "10px 20px", borderRadius: 12, border: "none",
    background: bg, color: fg, fontWeight: 700, fontSize: 15, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    transition: "transform 0.1s, opacity 0.15s", ...extra,
  });

  const pillBadge = (bg, fg) => ({
    display: "inline-block", padding: "4px 12px", borderRadius: 20,
    background: bg, color: fg, fontSize: 12, fontWeight: 700,
  });

  const fadeStyle = {
    opacity: transitioning ? 0 : 1,
    transition: "opacity 0.15s ease",
  };

  /* ═══════════════════════════════════════════════════════════
     TAB CONTENTS
     ═══════════════════════════════════════════════════════════ */

  if (!member) {
    return (
      <div style={{ ...shell, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#x1F3CB;&#xFE0F;</div>
          <h2 style={{ color: B.text, fontSize: 20, margin: "0 0 8px" }}>Loading your profile...</h2>
          <p style={{ color: B.muted, fontSize: 14 }}>If this persists, please sign out and back in.</p>
          <button onClick={logout} style={touchBtn(B.accent, B.darker, { marginTop: 20 })}>Sign Out</button>
        </div>
      </div>
    );
  }

  /* ─────────── HOME TAB ─────────── */
  const renderHome = () => {
    const gam = member.gamification || {};
    const recentPosts = [...(communityPosts || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
    const today = todayISO();

    return (
      <div style={{ padding: "0 16px" }}>
        {/* Pull-to-refresh visual hint */}
        <div style={{ textAlign: "center", padding: "6px 0 0", opacity: 0.3 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: B.muted, margin: "0 auto" }} />
        </div>

        {/* Greeting */}
        <div style={{ padding: "20px 0 4px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: B.text, margin: 0, lineHeight: 1.2 }}>
            Hey {firstName}! &#x1F44B;
          </h1>
          <p style={{ ...mutedText, marginTop: 4 }}>{dateStr}</p>
        </div>

        {/* Quick Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "16px 0" }}>
          <div style={{ ...cardStyle, textAlign: "center", padding: "14px 8px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Level</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: B.accent }}>{gam.level || 1}</div>
            </div>
          <div style={{ ...cardStyle, textAlign: "center", padding: "14px 8px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Streak</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>
              {gam.currentStreak || 0}
            </div>
            <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>&#x1F525; days</div>
          </div>
          <div style={{ ...cardStyle, textAlign: "center", padding: "14px 8px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Workouts</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: B.text }}>{gam.totalWorkouts || 0}</div>
            <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>total</div>
          </div>
        </div>

        {/* Today's Workout */}
        {todayClasses.length > 0 && (
          <>
            <h3 style={sectionTitle}>&#x1F4AA; Today's Workout</h3>
            {todayClasses.map(cls => (
              <div key={cls.id} style={{
                ...cardStyle, background: `linear-gradient(135deg, ${B.accent}15 0%, ${B.card} 100%)`,
                border: `1px solid ${B.accent}40`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: B.text }}>{cls.name}</div>
                    <div style={{ ...mutedText, marginTop: 2 }}>
                      {fmtTime(cls.startTime)} - {fmtTime(cls.endTime)} &middot; {cls.instructor}
                    </div>
                  </div>
                  <span style={pillBadge(B.accent + "22", B.accent)}>Booked</span>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button onClick={() => switchTab("workouts")} style={touchBtn(B.accent, B.darker, { flex: 1, fontSize: 14 })}>
                    &#x1F3CB;&#xFE0F; View Workout
                  </button>
                  <button onClick={() => handleQuickCheckIn(cls)} style={touchBtn(B.text + "15", B.text, { flex: 1, fontSize: 14, border: `1px solid ${B.border}` })}>
                    &#x2705; Check In
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Your Active Challenges */}
        {myJoinedChallenges.length > 0 && (
          <>
            <h3 style={sectionTitle}>&#x1F3AF; Your Active Challenges</h3>
            {myJoinedChallenges.map((ch, ci) => {
              const totalDays = daysBetween(ch.startDate, ch.endDate) + 1;
              const elapsed = Math.min(daysBetween(ch.startDate, today) + 1, totalDays);
              const pct = Math.max(0, Math.min(100, (elapsed / totalDays) * 100));
              const mySubs = ch.submissions?.[myId] || [];
              const checkedInToday = mySubs.some(s => s.date === today);

              return (
                <div key={ch.id} style={{
                  ...cardStyle, overflow: "hidden", padding: 0,
                }}>
                  <div style={{
                    background: CHALLENGE_GRADIENTS[ci % CHALLENGE_GRADIENTS.length],
                    padding: "14px 16px 10px",
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{ch.title}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
                      Day {elapsed} of {totalDays} &middot; {ch.participants.length} clients
                    </div>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    {/* Progress bar */}
                    <div style={{ height: 6, background: B.border, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", borderRadius: 3, background: B.accent, width: `${pct}%` }} />
                    </div>
                    {checkedInToday ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: B.accent }}>&#x2705; Checked in today</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveChallengeId(ch.id);
                          setCommunitySubTab("challenges");
                          switchTab("community");
                        }}
                        style={touchBtn(B.accent, B.darker, { width: "100%", fontSize: 13, minHeight: 38, padding: "8px 16px", boxSizing: "border-box" })}
                      >
                        &#x1F4DD; Check In Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Upcoming Classes */}
        {upcomingClasses.length > 0 && (
          <>
            <h3 style={sectionTitle}>&#x1F4C5; Upcoming Sessions</h3>
            {upcomingClasses.map(cls => (
              <div key={cls.id + cls._dayLabel} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: B.text }}>{cls.name}</div>
                    <div style={{ ...mutedText, fontSize: 13, marginTop: 2 }}>
                      {cls._dayLabel} &middot; {fmtTime(cls.startTime)}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: B.accent }}>{cls.instructor}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Unread Messages */}
        {unreadCount > 0 && (
          <div style={{
            ...cardStyle, background: `linear-gradient(135deg, #3b82f615 0%, ${B.card} 100%)`,
            border: `1px solid #3b82f640`, cursor: "pointer",
          }} onClick={() => switchTab("profile")}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: "#3b82f622",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>&#x1F4AC;</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: B.text }}>
                  {unreadCount} unread message{unreadCount > 1 ? "s" : ""}
                </div>
                <div style={mutedText}>Tap to view</div>
              </div>
              <div style={{
                width: 24, height: 24, borderRadius: 12, background: "#ef4444",
                color: "#fff", fontSize: 13, fontWeight: 800, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>{unreadCount}</div>
            </div>
          </div>
        )}

        {/* Recent Community Posts */}
        {recentPosts.length > 0 && (
          <>
            <h3 style={sectionTitle}>&#x1F465; Community</h3>
            {recentPosts.map(post => (
              <div key={post.id} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: B.accent + "22", color: B.accent,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700,
                  }}>{getInitials(post.authorName)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{post.authorName}</div>
                    <div style={{ fontSize: 11, color: B.muted }}>{timeAgo(post.createdAt)}</div>
                  </div>
                  {post.category && (
                    <span style={{ ...pillBadge(B.accent + "15", B.accent), fontSize: 10 }}>{post.category}</span>
                  )}
                </div>
                <p style={{ fontSize: 14, color: B.text, margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {post.content}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
                  <span style={{ fontSize: 13, color: B.muted }}>&#x2764;&#xFE0F; {post.likes?.length || 0}</span>
                  <span style={{ fontSize: 13, color: B.muted }}>&#x1F4AC; {post.comments?.length || 0}</span>
                </div>
              </div>
            ))}
          </>
        )}

        <div style={{ height: 20 }} />
      </div>
    );
  };

  /* ─────────── WORKOUTS TAB ─────────── */
  const renderWorkouts = () => {
    // Today's workout from booked class
    const todayCls = todayClasses[0];
    const todayWorkout = todayCls?.workoutId ? workouts.find(w => w.id === todayCls.workoutId) : null;
    const individualized = todayWorkout && member.movementScores
      ? autoIndividualize(todayWorkout, member.movementScores, matrix, exercises)
      : todayWorkout;

    // Workout log for today
    const todayLog = workoutLogs.find(l => l.memberId === member.id && l.date === todayISO() && l.workoutId === todayWorkout?.id);

    // Past logs
    const pastLogs = workoutLogs
      .filter(l => l.memberId === member.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);

    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ textAlign: "center", padding: "6px 0 0", opacity: 0.3 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: B.muted, margin: "0 auto" }} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "20px 0 4px" }}>Workouts</h1>
        <p style={mutedText}>{dateStr}</p>

        {/* Today's Workout */}
        {individualized ? (
          <>
            <div style={{
              ...cardStyle, marginTop: 16,
              background: `linear-gradient(135deg, ${B.accent}10 0%, ${B.card} 100%)`,
              border: `1px solid ${B.accent}30`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: B.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>Today's Workout</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: B.text, marginTop: 4 }}>{individualized.name}</div>
                </div>
                {individualized.phase && (
                  <span style={pillBadge("#a855f722", "#a855f7")}>{individualized.phase}</span>
                )}
              </div>
              {todayCls && (
                <div style={{ ...mutedText, marginBottom: 4 }}>
                  {todayCls.name} &middot; {fmtTime(todayCls.startTime)} &middot; {todayCls.instructor}
                </div>
              )}
            </div>

            {/* Exercise sections */}
            {(individualized.sections || []).map((sec, si) => (
              <div key={sec.id || si} style={{ marginBottom: 16 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 0 6px",
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: B.accent,
                  }} />
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: B.accent,
                    textTransform: "uppercase", letterSpacing: 0.5,
                  }}>{sec.name || `Section ${si + 1}`}</span>
                  {sec.format && (
                    <span style={{ fontSize: 12, color: B.muted, fontWeight: 500 }}>
                      &middot; {sec.format}
                    </span>
                  )}
                </div>

                {(sec.slots || sec.exercises || []).map((slot, ei) => {
                  const ex = slot.exercise || slot;
                  if (!ex || !ex.n) return null;
                  const ytId = extractYouTubeId(ex.u);
                  const logKey = `${si}-${ei}`;

                  return (
                    <div key={ei} style={{
                      ...cardStyle, padding: "12px 14px", marginBottom: 8,
                      border: slot._wasSwapped ? `1px solid ${B.accent}50` : `1px solid ${B.border}`,
                    }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        {/* Video thumbnail */}
                        {ytId ? (
                          <div
                            onClick={() => setVideoModal({ url: ex.u, name: ex.n })}
                            style={{
                              width: 64, height: 48, borderRadius: 10, overflow: "hidden",
                              background: "#000", cursor: "pointer", flexShrink: 0,
                              position: "relative",
                            }}
                          >
                            <img
                              src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                              alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
                            />
                            <div style={{
                              position: "absolute", inset: 0, display: "flex",
                              alignItems: "center", justifyContent: "center",
                            }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: 12, background: "rgba(255,255,255,0.9)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, color: "#000", paddingLeft: 2,
                              }}>&#x25B6;</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            width: 64, height: 48, borderRadius: 10, background: B.border + "40",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 22, flexShrink: 0,
                          }}>&#x1F3CB;&#xFE0F;</div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: B.text }}>{ex.n}</span>
                            {slot._wasSwapped && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: B.accent, background: B.accent + "20", padding: "1px 6px", borderRadius: 4 }}>
                                INDIVIDUALIZED
                              </span>
                            )}
                          </div>

                          {/* Sets/Reps/RPE row */}
                          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                            {slot.sets && (
                              <span style={{ fontSize: 13, color: B.muted }}>
                                <span style={{ fontWeight: 700, color: B.text }}>{slot.sets}</span> sets
                              </span>
                            )}
                            {slot.reps && (
                              <span style={{ fontSize: 13, color: B.muted }}>
                                <span style={{ fontWeight: 700, color: B.text }}>{slot.reps}</span> reps
                              </span>
                            )}
                            {slot.rpe && (
                              <span style={{ fontSize: 13, color: B.muted }}>
                                RPE <span style={{ fontWeight: 700, color: "#f59e0b" }}>{slot.rpe}</span>
                              </span>
                            )}
                            {slot.tempo && (
                              <span style={{ fontSize: 13, color: B.muted }}>
                                Tempo <span style={{ fontWeight: 700, color: B.text }}>{slot.tempo}</span>
                              </span>
                            )}
                            {slot.rest && (
                              <span style={{ fontSize: 13, color: B.muted }}>
                                Rest <span style={{ fontWeight: 700, color: B.text }}>{slot.rest}</span>
                              </span>
                            )}
                          </div>

                          {/* Coaching cues */}
                          {ex.c && (
                            <ExerciseCues cues={ex.c} B={B} />
                          )}

                          {/* Original exercise if swapped */}
                          {slot._wasSwapped && slot._originalExercise && (
                            <div style={{ fontSize: 11, color: B.dim, marginTop: 6, fontStyle: "italic" }}>
                              Original: {slot._originalExercise.n} (Score: {slot._memberScore})
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Log Weight */}
                      <WeightLogger
                        B={B}
                        exerciseName={ex.n}
                        logKey={logKey}
                        todayLog={todayLog}
                        workoutId={todayWorkout?.id}
                        memberId={member.id}
                        workoutLogs={workoutLogs}
                        setWorkoutLogs={setWorkoutLogs}
                        slot={slot}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        ) : (
          <div style={{
            ...cardStyle, marginTop: 16, textAlign: "center", padding: "32px 20px",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F4AD;</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: B.text, marginBottom: 4 }}>No workout today</div>
            <div style={{ ...mutedText, fontSize: 14 }}>Book a session to see your personalized workout here.</div>
            <button onClick={() => switchTab("book")} style={touchBtn(B.accent, B.darker, { marginTop: 16, fontSize: 14 })}>
              &#x1F4C5; Book a Session
            </button>
          </div>
        )}

        {/* Workout History */}
        <h3 style={{ ...sectionTitle, marginTop: 28 }}>&#x1F4CB; Workout History</h3>
        {pastLogs.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "20px 16px" }}>
            <div style={{ ...mutedText, fontSize: 14 }}>No workouts logged yet. Complete today's workout to start tracking!</div>
          </div>
        ) : (
          pastLogs.map(log => {
            const w = workouts.find(wk => wk.id === log.workoutId);
            return (
              <div key={log.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: B.text }}>{w?.name || "Workout"}</div>
                    <div style={mutedText}>{fmtDateNice(log.date)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: B.accent }}>
                      {log.exercises?.length || 0} exercises
                    </div>
                    <div style={{ fontSize: 12, color: B.muted }}>
                      {log.exercises?.reduce((s, e) => s + ((e.weight || 0) * (e.sets || 0) * (e.reps || 0)), 0).toLocaleString()} lbs
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div style={{ height: 20 }} />
      </div>
    );
  };

  /* ─────────── BOOK TAB ─────────── */
  const renderBook = () => {
    const monday = getMonday();
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });

    const handleBook = (classId) => {
      if (!member) return;
      // We need to update the schedule in localStorage directly
      const stored = JSON.parse(localStorage.getItem("hf_schedule") || "[]");
      const updated = stored.map(c => {
        if (c.id !== classId) return c;
        if (c.bookings?.includes(member.id)) return c;
        if ((c.bookings?.length || 0) < c.capacity) {
          return { ...c, bookings: [...(c.bookings || []), member.id] };
        }
        return { ...c, waitlist: [...(c.waitlist || []), member.id] };
      });
      localStorage.setItem("hf_schedule", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      // Force re-render
      window.location.reload();
    };

    const handleCancel = (classId) => {
      if (!member) return;
      const stored = JSON.parse(localStorage.getItem("hf_schedule") || "[]");
      const updated = stored.map(c => {
        if (c.id !== classId) return c;
        let newBookings = (c.bookings || []).filter(id => id !== member.id);
        let newWaitlist = (c.waitlist || []).filter(id => id !== member.id);
        if (newBookings.length < c.capacity && newWaitlist.length > 0 && (c.bookings || []).includes(member.id)) {
          newBookings = [...newBookings, newWaitlist[0]];
          newWaitlist = newWaitlist.slice(1);
        }
        return { ...c, bookings: newBookings, waitlist: newWaitlist };
      });
      localStorage.setItem("hf_schedule", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      window.location.reload();
    };

    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ textAlign: "center", padding: "6px 0 0", opacity: 0.3 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: B.muted, margin: "0 auto" }} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "20px 0 4px" }}>Book a Session</h1>
        <p style={mutedText}>This week's schedule</p>

        {/* Day selector pills */}
        <div style={{
          display: "flex", gap: 6, overflowX: "auto", padding: "16px 0 8px",
          scrollbarWidth: "none", msOverflowStyle: "none",
        }}>
          {weekDates.map((d, i) => {
            const isToday = d.toISOString().slice(0, 10) === todayISO();
            const dayClasses = classes.filter(c => c.dayOfWeek === i);
            return (
              <div key={i} style={{
                textAlign: "center", padding: "10px 14px", borderRadius: 14,
                background: isToday ? B.accent + "20" : B.card,
                border: isToday ? `2px solid ${B.accent}` : `1px solid ${B.border}`,
                minWidth: 52, flexShrink: 0,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? B.accent : B.muted }}>{DAYS_SHORT[i]}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? B.accent : B.text, marginTop: 2 }}>{d.getDate()}</div>
                {dayClasses.length > 0 && (
                  <div style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: B.accent, margin: "4px auto 0",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Classes by day */}
        {DAYS_SHORT.map((day, dayIdx) => {
          const dayClasses = classes
            .filter(c => c.dayOfWeek === dayIdx)
            .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
          if (dayClasses.length === 0) return null;

          const dateLabel = `${DAYS_FULL[dayIdx]}, ${MONTHS[weekDates[dayIdx].getMonth()]} ${weekDates[dayIdx].getDate()}`;

          return (
            <div key={dayIdx} style={{ marginTop: 20 }}>
              <div style={{ ...labelText, marginBottom: 10 }}>{dateLabel}</div>
              {dayClasses.map(cls => {
                const isBooked = cls.bookings?.includes(member.id);
                const isWaitlisted = cls.waitlist?.includes(member.id);
                const isFull = (cls.bookings?.length || 0) >= cls.capacity;
                const spotsLeft = cls.capacity - (cls.bookings?.length || 0);

                return (
                  <div key={cls.id} style={{
                    ...cardStyle,
                    border: isBooked ? `2px solid ${B.accent}` : isWaitlisted ? `2px solid ${B.orange}` : `1px solid ${B.border}`,
                    background: isBooked ? B.accent + "08" : B.card,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: B.text }}>{cls.name}</span>
                          {isBooked && <span style={pillBadge(B.accent + "22", B.accent)}>Booked</span>}
                          {isWaitlisted && <span style={pillBadge(B.orange + "22", B.orange)}>Waitlist</span>}
                        </div>
                        <div style={{ ...mutedText, marginTop: 4 }}>
                          {fmtTime(cls.startTime)} - {fmtTime(cls.endTime)} &middot; {cls.instructor}
                        </div>
                        <div style={{
                          fontSize: 12, fontWeight: 600, marginTop: 6,
                          color: isFull ? B.orange : B.accent,
                        }}>
                          {isFull ? (
                            <>&#x1F534; Full ({cls.waitlist?.length || 0} waitlisted)</>
                          ) : (
                            <>&#x1F7E2; {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left</>
                          )}
                        </div>
                      </div>

                      <div style={{ marginLeft: 12 }}>
                        {isBooked || isWaitlisted ? (
                          <button
                            onClick={() => handleCancel(cls.id)}
                            style={touchBtn(B.red + "15", B.red, { padding: "8px 16px", fontSize: 13, minHeight: 38 })}
                          >Cancel</button>
                        ) : (
                          <button
                            onClick={() => handleBook(cls.id)}
                            style={touchBtn(
                              isFull ? B.orange + "20" : B.accent,
                              isFull ? B.orange : B.darker,
                              { padding: "8px 16px", fontSize: 13, minHeight: 38 }
                            )}
                          >
                            {isFull ? "Waitlist" : "Book"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {classes.length === 0 && (
          <div style={{ ...cardStyle, textAlign: "center", padding: "32px 20px", marginTop: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F4C5;</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: B.text }}>No sessions scheduled</div>
            <div style={{ ...mutedText, marginTop: 4 }}>Check back later for updated session times.</div>
          </div>
        )}

        <div style={{ height: 20 }} />
      </div>
    );
  };

  /* ─────────── COMMUNITY TAB ─────────── */
  const renderCommunity = () => {
    const today = todayISO();

    const subTabPill = (key, label) => ({
      padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
      fontSize: 13, fontWeight: 700,
      background: communitySubTab === key ? B.accent : B.card,
      color: communitySubTab === key ? B.darker : B.muted,
      transition: "all 0.15s",
    });

    /* ── FEED SUB-SECTION ── */
    const renderFeed = () => {
      const sortedPosts = [...(communityPosts || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const handleLikePost = (postId) => {
        setCommunityPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          const likes = p.likes || [];
          const alreadyLiked = likes.includes(myId);
          return { ...p, likes: alreadyLiked ? likes.filter(id => id !== myId) : [...likes, myId] };
        }));
      };

      const handleAddComment = (postId) => {
        const text = (commentInputs[postId] || "").trim();
        if (!text) return;
        setCommunityPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          const comment = {
            id: crypto.randomUUID(),
            authorId: myId,
            authorName: `${member.firstName || "Member"} ${member.lastName || ""}`.trim(),
            content: text,
            createdAt: new Date().toISOString(),
          };
          return { ...p, comments: [...(p.comments || []), comment] };
        }));
        setCommentInputs(prev => ({ ...prev, [postId]: "" }));
      };

      const handleCreatePost = () => {
        const text = newPostText.trim();
        if (!text) return;
        const post = {
          id: crypto.randomUUID(),
          authorId: myId,
          authorName: `${member.firstName || "Member"} ${member.lastName || ""}`.trim(),
          content: text,
          category: "General",
          createdAt: new Date().toISOString(),
          likes: [],
          comments: [],
        };
        setCommunityPosts(prev => [post, ...prev]);
        setNewPostText("");
        setShowNewPost(false);
      };

      return (
        <div>
          {/* Compose button */}
          {!showNewPost && (
            <button
              onClick={() => setShowNewPost(true)}
              style={touchBtn(B.accent, B.darker, { width: "100%", marginBottom: 16, fontSize: 14, boxSizing: "border-box" })}
            >
              &#x270F;&#xFE0F; New Post
            </button>
          )}

          {/* Compose form */}
          {showNewPost && (
            <div style={{ ...cardStyle, border: `2px solid ${B.accent}40` }}>
              <textarea
                value={newPostText}
                onChange={e => setNewPostText(e.target.value)}
                placeholder="Share something with the community..."
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${B.border}`,
                  background: B.darker, color: B.text, fontSize: 14, resize: "vertical",
                  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowNewPost(false); setNewPostText(""); }} style={touchBtn(B.card, B.muted, { fontSize: 13, minHeight: 36, padding: "6px 16px", border: `1px solid ${B.border}` })}>
                  Cancel
                </button>
                <button onClick={handleCreatePost} style={touchBtn(B.accent, B.darker, { fontSize: 13, minHeight: 36, padding: "6px 16px", opacity: newPostText.trim() ? 1 : 0.4 })}>
                  Post
                </button>
              </div>
            </div>
          )}

          {sortedPosts.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F4AC;</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: B.text }}>No posts yet</div>
              <div style={{ ...mutedText, marginTop: 4 }}>Be the first to share something!</div>
            </div>
          )}

          {sortedPosts.map(post => {
            const isExpanded = expandedPostId === post.id;
            const isLiked = (post.likes || []).includes(myId);
            return (
              <div key={post.id} style={cardStyle}>
                {/* Author header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: B.accent + "22", color: B.accent,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                  }}>{getInitials(post.authorName)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{post.authorName}</div>
                    <div style={{ fontSize: 11, color: B.muted }}>{timeAgo(post.createdAt)}</div>
                  </div>
                  {post.category && (
                    <span style={{ ...pillBadge(B.accent + "15", B.accent), fontSize: 10 }}>{post.category}</span>
                  )}
                </div>

                {/* Content */}
                <p style={{ fontSize: 14, color: B.text, margin: "0 0 12px", lineHeight: 1.6 }}>
                  {post.content}
                </p>

                {/* Like + Comment buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 8, borderTop: `1px solid ${B.border}30` }}>
                  <button
                    onClick={() => handleLikePost(post.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: isLiked ? "#ef4444" : B.muted, fontWeight: 600, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {isLiked ? "\u2764\uFE0F" : "\uD83E\uDD0D"} {(post.likes || []).length}
                  </button>
                  <button
                    onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: B.muted, fontWeight: 600, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    &#x1F4AC; {(post.comments || []).length}
                  </button>
                </div>

                {/* Expanded comments */}
                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${B.border}30` }}>
                    {(post.comments || []).map(c => (
                      <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, background: B.border + "60",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: B.muted, flexShrink: 0,
                        }}>{getInitials(c.authorName)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: B.text }}>{c.authorName}</span>
                            <span style={{ fontSize: 10, color: B.dim }}>{timeAgo(c.createdAt)}</span>
                          </div>
                          <p style={{ fontSize: 13, color: B.text, margin: "2px 0 0", lineHeight: 1.5 }}>{c.content}</p>
                        </div>
                      </div>
                    ))}
                    {/* Comment input */}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input
                        value={commentInputs[post.id] || ""}
                        onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Add a comment..."
                        onKeyDown={e => { if (e.key === "Enter") handleAddComment(post.id); }}
                        style={{
                          flex: 1, padding: "8px 12px", borderRadius: 10, border: `1px solid ${B.border}`,
                          background: B.darker, color: B.text, fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        style={{
                          minHeight: 36, padding: "0 14px", borderRadius: 10, border: "none",
                          background: B.accent, color: B.darker, fontWeight: 700, fontSize: 13, cursor: "pointer",
                        }}
                      >Send</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    /* ── CHALLENGES SUB-SECTION ── */
    const renderChallenges = () => {
      const activeChallenge = activeChallengeId ? (challenges || []).find(c => c.id === activeChallengeId) : null;

      if (activeChallenge) {
        return renderChallengeDetail(activeChallenge);
      }

      const activeChallenges = (challenges || []).filter(ch => {
        const end = new Date(ch.endDate + "T23:59:59");
        return end >= new Date();
      });

      return (
        <div>
          {activeChallenges.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F3AF;</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: B.text }}>No active challenges</div>
              <div style={{ ...mutedText, marginTop: 4 }}>Check back soon for new challenges from your coach!</div>
            </div>
          )}

          {activeChallenges.map((ch, ci) => {
            const totalDays = daysBetween(ch.startDate, ch.endDate) + 1;
            const elapsed = Math.min(daysBetween(ch.startDate, today) + 1, totalDays);
            const pct = Math.max(0, Math.min(100, (elapsed / totalDays) * 100));
            const isJoined = ch.participants?.includes(myId);

            return (
              <div key={ch.id} style={{ ...cardStyle, overflow: "hidden", padding: 0, cursor: "pointer" }}
                onClick={() => setActiveChallengeId(ch.id)}
              >
                {/* Gradient banner */}
                <div style={{
                  background: CHALLENGE_GRADIENTS[ci % CHALLENGE_GRADIENTS.length],
                  padding: "16px 16px 12px", position: "relative",
                }}>
                  {isJoined && (
                    <span style={{
                      position: "absolute", top: 10, right: 10,
                      background: "rgba(255,255,255,0.25)", color: "#fff",
                      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10,
                    }}>Joined</span>
                  )}
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{ch.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                    Day {elapsed} of {totalDays}
                  </div>
                </div>
                <div style={{ padding: "12px 16px 14px" }}>
                  {/* Progress bar */}
                  <div style={{ height: 6, background: B.border, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: "100%", borderRadius: 3, background: B.accent, width: `${pct}%` }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: B.muted }}>&#x1F465; {ch.participants?.length || 0} participants</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: B.accent }}>View &rarr;</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    /* ── CHALLENGE DETAIL ── */
    const renderChallengeDetail = (ch) => {
      const totalDays = daysBetween(ch.startDate, ch.endDate) + 1;
      const elapsed = Math.min(daysBetween(ch.startDate, today) + 1, totalDays);
      const pct = Math.max(0, Math.min(100, (elapsed / totalDays) * 100));
      const isJoined = ch.participants?.includes(myId);
      const mySubs = ch.submissions?.[myId] || [];
      const checkedInToday = mySubs.some(s => s.date === today);
      const dailyPosts = ch.dailyPosts || {};
      const todayDailyPost = dailyPosts[today] || null;
      const isTarget = ch.type === "adherence_target";

      // Today's check-ins from all participants
      const todayCheckins = [];
      (ch.participants || []).forEach(mid => {
        const subs = ch.submissions?.[mid] || [];
        const todaySub = subs.find(s => s.date === today);
        if (todaySub) {
          todayCheckins.push({ ...todaySub, memberId: mid });
        }
      });

      // Who hasn't checked in
      const notCheckedIn = (ch.participants || []).filter(mid => {
        return !(ch.submissions?.[mid] || []).some(s => s.date === today);
      });

      // Leaderboard: top 5 by streak
      const leaderboard = (ch.participants || []).map(mid => {
        const subs = ch.submissions?.[mid] || [];
        let streak = 0;
        for (let d = elapsed - 1; d >= 0; d--) {
          const dateStr = toDateStr(new Date(new Date(ch.startDate + "T00:00:00Z").getTime() + d * 86400000));
          if (subs.some(s => s.date === dateStr)) streak++;
          else break;
        }
        return { memberId: mid, streak, total: subs.length };
      }).sort((a, b) => b.streak - a.streak).slice(0, 5);

      const handleJoin = (e) => {
        e.stopPropagation();
        setChallenges(prev => prev.map(c => {
          if (c.id !== ch.id) return c;
          return {
            ...c,
            participants: [...(c.participants || []), myId],
            submissions: { ...c.submissions, [myId]: [] },
          };
        }));
      };

      const handleLeave = (e) => {
        e.stopPropagation();
        setChallenges(prev => prev.map(c => {
          if (c.id !== ch.id) return c;
          const newParticipants = (c.participants || []).filter(p => p !== myId);
          const newSubmissions = { ...c.submissions };
          delete newSubmissions[myId];
          return { ...c, participants: newParticipants, submissions: newSubmissions };
        }));
      };

      const handleCheckin = () => {
        const text = checkinText.trim();
        if (!text) return;
        const sub = {
          id: crypto.randomUUID(),
          date: today,
          comment: text,
          proof: isTarget ? checkinProof.trim() || null : null,
          verified: null,
          likes: [],
          timestamp: new Date().toISOString(),
        };
        setChallenges(prev => prev.map(c => {
          if (c.id !== ch.id) return c;
          const memberSubs = [...(c.submissions?.[myId] || []), sub];
          return { ...c, submissions: { ...c.submissions, [myId]: memberSubs } };
        }));
        setCheckinText("");
        setCheckinProof("");
      };

      const handleLikeCheckin = (memberId, subId) => {
        setChallenges(prev => prev.map(c => {
          if (c.id !== ch.id) return c;
          const memberSubs = (c.submissions?.[memberId] || []).map(s => {
            if (s.id !== subId) return s;
            const likes = s.likes || [];
            const alreadyLiked = likes.includes(myId);
            return { ...s, likes: alreadyLiked ? likes.filter(id => id !== myId) : [...likes, myId] };
          });
          return { ...c, submissions: { ...c.submissions, [memberId]: memberSubs } };
        }));
      };

      const gradientIdx = (challenges || []).findIndex(c => c.id === ch.id);

      return (
        <div>
          {/* Back button */}
          <button
            onClick={() => setActiveChallengeId(null)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: B.accent, fontSize: 14, fontWeight: 600, padding: "0 0 12px",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            &#x2190; Back to Challenges
          </button>

          {/* Banner */}
          <div style={{
            background: CHALLENGE_GRADIENTS[gradientIdx % CHALLENGE_GRADIENTS.length],
            borderRadius: 16, padding: "20px 16px 16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{ch.title}</div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: "6px 0 0", lineHeight: 1.5 }}>
              {ch.description}
            </p>
            {isTarget && ch.targetDescription && (
              <div style={{
                background: "rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px 12px",
                marginTop: 10, fontSize: 12, color: "#fff", fontWeight: 600,
              }}>&#x1F3AF; Daily Target: {ch.targetDescription}</div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
              <span>Day {elapsed} of {totalDays}</span>
              <span>&#x1F465; {ch.participants?.length || 0} clients</span>
            </div>
            {/* Progress */}
            <div style={{ height: 5, background: "rgba(255,255,255,0.25)", borderRadius: 3, marginTop: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 3, background: "#fff", width: `${pct}%` }} />
            </div>
          </div>

          {/* Join / Leave */}
          {!isJoined ? (
            <button onClick={handleJoin} style={touchBtn(B.accent, B.darker, { width: "100%", marginBottom: 16, boxSizing: "border-box" })}>
              &#x1F64B; Join Challenge
            </button>
          ) : (
            <button onClick={handleLeave} style={touchBtn(B.card, B.red, { width: "100%", marginBottom: 16, border: `1px solid ${B.red}40`, fontSize: 13, boxSizing: "border-box" })}>
              Leave Challenge
            </button>
          )}

          {/* Coach's Daily Post */}
          {todayDailyPost && (
            <div style={{
              ...cardStyle,
              background: `linear-gradient(135deg, ${B.accent}08 0%, ${B.card} 100%)`,
              border: `1px solid ${B.accent}30`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: B.accent, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800,
                }}>&#x1F3CB;&#xFE0F;</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: B.text }}>Coach</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, background: B.accent + "25", color: B.accent,
                      padding: "2px 6px", borderRadius: 4,
                    }}>COACH</span>
                  </div>
                  <div style={{ fontSize: 11, color: B.muted }}>Today's Message</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: B.text, margin: 0, lineHeight: 1.6 }}>{todayDailyPost}</p>
            </div>
          )}

          {/* Check-in form or confirmation */}
          {isJoined && (
            <>
              {checkedInToday ? (
                <div style={{
                  ...cardStyle,
                  border: `1px solid ${B.accent}40`,
                  background: B.accent + "08",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: B.accent }}>&#x2705; You checked in today!</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, background: B.accent + "25", color: B.accent,
                      padding: "2px 6px", borderRadius: 4,
                    }}>YOU</span>
                  </div>
                  {mySubs.filter(s => s.date === today).map(s => (
                    <p key={s.id} style={{ fontSize: 13, color: B.text, margin: 0, lineHeight: 1.5 }}>{s.comment}</p>
                  ))}
                </div>
              ) : (
                <div style={{ ...cardStyle, border: `2px solid ${B.accent}30` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 10 }}>&#x1F4DD; Your Check-In</div>
                  <textarea
                    value={checkinText}
                    onChange={e => setCheckinText(e.target.value)}
                    placeholder="How did it go today? Share your update..."
                    rows={3}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${B.border}`,
                      background: B.darker, color: B.text, fontSize: 14, resize: "vertical",
                      outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                  {isTarget && (
                    <input
                      value={checkinProof}
                      onChange={e => setCheckinProof(e.target.value)}
                      placeholder="Proof URL (screenshot link, etc.)"
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${B.border}`,
                        background: B.darker, color: B.text, fontSize: 14, marginTop: 8,
                        outline: "none", boxSizing: "border-box",
                      }}
                    />
                  )}
                  <button
                    onClick={handleCheckin}
                    disabled={!checkinText.trim()}
                    style={touchBtn(B.accent, B.darker, {
                      width: "100%", marginTop: 10, fontSize: 14, boxSizing: "border-box",
                      opacity: checkinText.trim() ? 1 : 0.4,
                    })}
                  >
                    &#x2705; Check In
                  </button>
                </div>
              )}
            </>
          )}

          {/* Today's check-in counter */}
          <div style={{
            ...cardStyle, textAlign: "center", padding: "12px 16px",
            background: B.accent + "08", border: `1px solid ${B.accent}20`,
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: B.accent }}>
              {todayCheckins.length} of {(ch.participants || []).length}
            </span>
            <span style={{ fontSize: 13, color: B.muted, marginLeft: 6 }}>checked in today</span>
          </div>

          {/* Today's Social Feed */}
          {todayCheckins.length > 0 && (
            <>
              <h3 style={{ ...sectionTitle, fontSize: 16 }}>&#x1F4AC; Today's Check-Ins</h3>
              {todayCheckins.map(ci => {
                const isMe = ci.memberId === myId;
                const isLiked = (ci.likes || []).includes(myId);
                return (
                  <div key={ci.id} style={cardStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: isMe ? B.accent + "30" : B.border + "60",
                        color: isMe ? B.accent : B.muted,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                      }}>{getInitials(getMemberName(ci.memberId))}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: B.text }}>
                            {isMe ? "You" : getMemberName(ci.memberId)}
                          </span>
                          {isMe && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, background: B.accent + "25", color: B.accent,
                              padding: "2px 6px", borderRadius: 4,
                            }}>YOU</span>
                          )}
                          {ci.memberId === "coach" && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, background: B.accent + "25", color: B.accent,
                              padding: "2px 6px", borderRadius: 4,
                            }}>COACH</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: B.muted }}>{ci.timestamp ? timeAgo(ci.timestamp) : "today"}</div>
                      </div>
                      {/* Badges */}
                      <div style={{ display: "flex", gap: 4 }}>
                        {isTarget && ci.proof && (
                          <span style={{ ...pillBadge("#3b82f615", "#3b82f6"), fontSize: 9, padding: "2px 8px" }}>Proof</span>
                        )}
                        {isTarget && ci.verified === true && (
                          <span style={{ ...pillBadge(B.accent + "15", B.accent), fontSize: 9, padding: "2px 8px" }}>&#x2705;</span>
                        )}
                        {isTarget && ci.verified === false && (
                          <span style={{ ...pillBadge("#ef444415", "#ef4444"), fontSize: 9, padding: "2px 8px" }}>&#x274C;</span>
                        )}
                        {isTarget && ci.verified === null && ci.proof && (
                          <span style={{ ...pillBadge("#f59e0b15", "#f59e0b"), fontSize: 9, padding: "2px 8px" }}>Pending</span>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: B.text, margin: "0 0 8px", lineHeight: 1.5 }}>{ci.comment}</p>
                    <button
                      onClick={() => handleLikeCheckin(ci.memberId, ci.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: isLiked ? "#ef4444" : B.muted, fontWeight: 600, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {isLiked ? "\u2764\uFE0F" : "\uD83E\uDD0D"} {(ci.likes || []).length}
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* Waiting for check-in */}
          {notCheckedIn.length > 0 && (
            <>
              <h3 style={{ ...sectionTitle, fontSize: 14, color: B.muted }}>Waiting for check-in</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {notCheckedIn.map(mid => (
                  <div key={mid} style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: B.border + "40", color: B.dim,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, opacity: 0.5,
                  }}>{getInitials(getMemberName(mid))}</div>
                ))}
              </div>
            </>
          )}

          {/* Quick Leaderboard */}
          {leaderboard.length > 0 && (
            <>
              <h3 style={{ ...sectionTitle, fontSize: 16 }}>&#x1F3C6; Leaderboard</h3>
              <div style={cardStyle}>
                {leaderboard.map((row, i) => {
                  const medal = i === 0 ? "\uD83E\uDD47" : i === 1 ? "\uD83E\uDD48" : i === 2 ? "\uD83E\uDD49" : `#${i + 1}`;
                  const isMe = row.memberId === myId;
                  return (
                    <div key={row.memberId} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                      borderBottom: i < leaderboard.length - 1 ? `1px solid ${B.border}20` : "none",
                      background: isMe ? B.accent + "08" : "transparent",
                      borderRadius: isMe ? 8 : 0, padding: isMe ? "8px 8px" : "8px 0",
                    }}>
                      <span style={{ fontSize: 16, width: 28, textAlign: "center" }}>{medal}</span>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: isMe ? B.accent + "30" : B.border + "60",
                        color: isMe ? B.accent : B.muted,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700,
                      }}>{getInitials(getMemberName(row.memberId))}</div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: B.text }}>
                          {isMe ? "You" : getMemberName(row.memberId)}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: B.accent }}>&#x1F525; {row.streak}</div>
                        <div style={{ fontSize: 10, color: B.dim }}>{row.total}/{elapsed} days</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      );
    };

    /* ── RESOURCES SUB-SECTION ── */
    const renderResources = () => {
      const resList = resources || [];
      return (
        <div>
          {resList.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F4DA;</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: B.text }}>No resources yet</div>
              <div style={{ ...mutedText, marginTop: 4 }}>Your coach will add resources here soon.</div>
            </div>
          )}
          {resList.map(res => (
            <div
              key={res.id}
              style={{ ...cardStyle, cursor: "pointer" }}
              onClick={() => { if (res.url) window.open(res.url, "_blank"); }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: B.accent + "15",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                }}>{RESOURCE_ICONS[res.type] || "\uD83D\uDD17"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{res.title}</div>
                  {res.description && (
                    <div style={{ fontSize: 12, color: B.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {res.description}
                    </div>
                  )}
                </div>
                {res.category && (
                  <span style={{ ...pillBadge(B.accent + "15", B.accent), fontSize: 10, flexShrink: 0 }}>{res.category}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ textAlign: "center", padding: "6px 0 0", opacity: 0.3 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: B.muted, margin: "0 auto" }} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "20px 0 4px" }}>Community</h1>
        <p style={mutedText}>Connect, challenge, and grow together</p>

        {/* Sub-tab pills */}
        <div style={{ display: "flex", gap: 8, margin: "16px 0", overflowX: "auto" }}>
          <button onClick={() => { setCommunitySubTab("feed"); setActiveChallengeId(null); }} style={subTabPill("feed", "Feed")}>
            &#x1F4AC; Feed
          </button>
          <button onClick={() => { setCommunitySubTab("challenges"); setActiveChallengeId(null); }} style={subTabPill("challenges", "Challenges")}>
            &#x1F3AF; Challenges
          </button>
          <button onClick={() => { setCommunitySubTab("resources"); setActiveChallengeId(null); }} style={subTabPill("resources", "Resources")}>
            &#x1F4DA; Resources
          </button>
        </div>

        {communitySubTab === "feed" && renderFeed()}
        {communitySubTab === "challenges" && renderChallenges()}
        {communitySubTab === "resources" && renderResources()}

        <div style={{ height: 20 }} />
      </div>
    );
  };

  /* ─────────── PROGRESS TAB ─────────── */
  const renderProgress = () => {
    const gam = member.gamification || {};
    const xpForLevel = (lvl) => lvl * lvl * 50;
    const currentLevelXp = xpForLevel(gam.level || 1);
    const nextLevelXp = xpForLevel((gam.level || 1) + 1);
    const xpProgress = nextLevelXp > currentLevelXp
      ? Math.min(1, ((gam.xp || 0) - currentLevelXp) / (nextLevelXp - currentLevelXp))
      : 1;

    const scores = member.movementScores || {};
    const inbody = member.inbody || {};
    const latestScan = inbody.history?.length > 0 ? inbody.history[inbody.history.length - 1] : null;
    const prevScan = inbody.history?.length > 1 ? inbody.history[inbody.history.length - 2] : null;

    const ALL_BADGES = [
      { key: "First Workout", icon: "\uD83C\uDFAF" },
      { key: "10 Workouts", icon: "\uD83D\uDCAA" },
      { key: "50 Workouts", icon: "\uD83D\uDD25" },
      { key: "100 Workouts", icon: "\u2B50" },
      { key: "Iron Club", icon: "\uD83C\uDFCB\uFE0F" },
      { key: "Week Warrior", icon: "\u26A1" },
      { key: "Month Machine", icon: "\uD83D\uDDD3\uFE0F" },
      { key: "Early Bird", icon: "\uD83C\uDF05" },
      { key: "Consistency King", icon: "\uD83D\uDC51" },
    ];

    const earnedBadges = gam.badges || [];

    // Attendance calendar for current month
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDow = firstDay.getDay(); // 0=Sun
    const attendanceDates = new Set(
      myAttendance
        .filter(a => { const d = new Date(a.date || a.timestamp); return d.getFullYear() === year && d.getMonth() === month; })
        .map(a => new Date(a.date || a.timestamp).getDate())
    );

    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ textAlign: "center", padding: "6px 0 0", opacity: 0.3 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: B.muted, margin: "0 auto" }} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "20px 0 16px" }}>Progress</h1>

        {/* Level & XP */}
        <div style={{
          ...cardStyle,
          background: `linear-gradient(135deg, ${B.accent}12 0%, ${B.card} 100%)`,
          border: `1px solid ${B.accent}30`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Level</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: B.accent, lineHeight: 1 }}>{gam.level || 1}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: B.muted, marginTop: 4 }}>
                {(gam.xp || 0).toLocaleString()} XP
              </div>
            </div>
          </div>
          <div style={{ height: 8, background: B.border, borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              background: `linear-gradient(90deg, ${B.accent}, ${B.accent}cc)`,
              width: `${Math.max(2, xpProgress * 100)}%`,
              transition: "width 0.5s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: B.dim }}>Level {gam.level || 1}</span>
            <span style={{ fontSize: 11, color: B.dim }}>Level {(gam.level || 1) + 1}</span>
          </div>
        </div>

        {/* Movement Scores */}
        <h3 style={sectionTitle}>&#x1F3AF; Movement Scores</h3>
        <div style={cardStyle}>
          {Object.entries(scores).map(([pattern, score]) => {
            const pct = ((score + 3) / 6) * 100;
            const color = PATTERN_COLORS[pattern] || B.accent;
            return (
              <div key={pattern} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{pattern}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color,
                    background: color + "18", padding: "2px 8px", borderRadius: 6,
                  }}>
                    {score > 0 ? "+" : ""}{score} {SCORE_LABELS[String(score)] || ""}
                  </span>
                </div>
                <div style={{ height: 6, background: B.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3, background: color,
                    width: `${Math.max(4, pct)}%`,
                    transition: "width 0.5s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Body Composition */}
        {latestScan && (
          <>
            <h3 style={sectionTitle}>&#x1F4CA; Body Composition</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "Weight", value: latestScan.weight, unit: "lbs", prev: prevScan?.weight, lower: true },
                { label: "Body Fat", value: latestScan.bodyFatPercent, unit: "%", prev: prevScan?.bodyFatPercent, lower: true },
                { label: "Muscle", value: latestScan.skeletalMuscleMass, unit: "lbs", prev: prevScan?.skeletalMuscleMass, lower: false },
              ].map(item => {
                const delta = item.prev != null ? item.value - item.prev : null;
                const isGood = delta != null ? (item.lower ? delta < 0 : delta > 0) : null;
                return (
                  <div key={item.label} style={{ ...cardStyle, textAlign: "center", padding: "14px 8px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: B.text }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: 12, color: B.muted }}>{item.unit}</div>
                    {delta != null && (
                      <div style={{
                        fontSize: 11, fontWeight: 700, marginTop: 4,
                        color: isGood ? B.accent : B.red,
                      }}>
                        {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mini trend */}
            {inbody.history?.length >= 2 && (
              <div style={{ ...cardStyle, marginTop: 12, padding: "16px 16px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: B.muted, marginBottom: 12 }}>Trend (Last {inbody.history.length} Scans)</div>
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", height: 60 }}>
                  {inbody.history.map((scan, i) => {
                    const maxW = Math.max(...inbody.history.map(s => s.weight));
                    const minW = Math.min(...inbody.history.map(s => s.weight));
                    const range = maxW - minW || 1;
                    const h = ((scan.weight - minW) / range) * 40 + 20;
                    return (
                      <div key={i} style={{ textAlign: "center" }}>
                        <div style={{
                          width: 32, height: h, borderRadius: 6,
                          background: `linear-gradient(180deg, ${B.accent}, ${B.accent}66)`,
                          margin: "0 auto 4px",
                        }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: B.text }}>{scan.weight}</div>
                        <div style={{ fontSize: 9, color: B.dim }}>{fmtDateShort(scan.date)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Badges */}
        <h3 style={sectionTitle}>&#x1F3C6; Badges</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {ALL_BADGES.map(badge => {
            const earned = earnedBadges.includes(badge.key);
            return (
              <div key={badge.key} style={{
                ...cardStyle, textAlign: "center", padding: "14px 8px",
                opacity: earned ? 1 : 0.35,
                border: earned ? `1px solid ${B.accent}40` : `1px solid ${B.border}`,
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{badge.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: earned ? B.text : B.dim, lineHeight: 1.3 }}>
                  {badge.key}
                </div>
              </div>
            );
          })}
        </div>

        {/* Attendance Calendar */}
        <h3 style={sectionTitle}>&#x1F4C5; Attendance — {MONTHS[month]} {year}</h3>
        <div style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: B.dim, padding: "4px 0" }}>{d}</div>
            ))}
            {Array.from({ length: startDow }, (_, i) => (
              <div key={"empty-" + i} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const attended = attendanceDates.has(day);
              const isToday = day === now.getDate();
              return (
                <div key={day} style={{
                  width: 32, height: 32, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto", fontSize: 12, fontWeight: isToday ? 800 : 500,
                  background: attended ? B.accent + "25" : "transparent",
                  color: attended ? B.accent : isToday ? B.text : B.muted,
                  border: isToday ? `2px solid ${B.accent}` : "none",
                  position: "relative",
                }}>
                  {day}
                  {attended && (
                    <div style={{
                      position: "absolute", bottom: 2,
                      width: 4, height: 4, borderRadius: 2, background: B.accent,
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ height: 20 }} />
      </div>
    );
  };

  /* ─────────── PROFILE TAB ─────────── */
  const renderProfile = () => {
    const memberSince = member.startDate || member.createdAt;
    const statusColors = {
      active: B.accent, frozen: "#3b82f6", inactive: B.dim, trial: B.orange, cancelled: B.red,
    };
    const statusColor = statusColors[member.membershipStatus] || B.muted;

    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ textAlign: "center", padding: "6px 0 0", opacity: 0.3 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: B.muted, margin: "0 auto" }} />
        </div>

        {/* Avatar + Name */}
        <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
          <div style={{
            width: 88, height: 88, borderRadius: 28, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${B.accent}, ${B.accent}88)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 800, color: "#fff",
            boxShadow: `0 8px 24px ${B.accent}33`,
          }}>
            {getInitials(currentUser?.displayName || member.firstName)}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "0 0 4px" }}>
            {member.firstName} {member.lastName}
          </h1>
          <p style={{ ...mutedText, margin: 0 }}>
            Client since {memberSince ? fmtDateNice(memberSince) : "N/A"}
          </p>
        </div>

        {/* Status + Plan */}
        <div style={{
          ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: B.muted }}>Membership Status</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4, background: statusColor,
                boxShadow: `0 0 8px ${statusColor}66`,
              }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: B.text, textTransform: "capitalize" }}>
                {member.membershipStatus || "Active"}
              </span>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div style={cardStyle}>
          <div style={{ ...labelText, marginBottom: 12 }}>Contact Info</div>
          {[
            { icon: "\u2709\uFE0F", label: "Email", value: member.email },
            { icon: "\uD83D\uDCF1", label: "Phone", value: member.phone },
            { icon: "\uD83D\uDCCD", label: "Location", value: member.address ? [member.address.city, member.address.state].filter(Boolean).join(", ") : null },
          ].filter(x => x.value).map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0", borderBottom: `1px solid ${B.border}20`,
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 12, color: B.dim }}>{item.label}</div>
                <div style={{ fontSize: 15, color: B.text, fontWeight: 500 }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div style={{
          ...cardStyle, display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 16, padding: "16px 20px",
        }}>
          {[
            { label: "Total Workouts", value: member.gamification?.totalWorkouts || 0, icon: "\uD83D\uDCAA" },
            { label: "Weight Lifted", value: `${((member.gamification?.totalWeightLifted || 0) / 1000).toFixed(1)}K lbs`, icon: "\uD83C\uDFCB\uFE0F" },
            { label: "Current Streak", value: `${member.gamification?.currentStreak || 0} days`, icon: "\uD83D\uDD25" },
            { label: "Best Streak", value: `${member.gamification?.longestStreak || 0} days`, icon: "\u26A1" },
          ].map(stat => (
            <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: B.accent + "15",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>{stat.icon}</div>
              <div>
                <div style={{ fontSize: 11, color: B.dim }}>{stat.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: B.text }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Message Coach */}
        <button
          onClick={() => { /* TODO: open messaging */ }}
          style={{
            ...touchBtn(B.card, B.text, { width: "100%", marginTop: 8, border: `1px solid ${B.border}`, gap: 10 }),
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontSize: 18 }}>&#x1F4AC;</span>
          Message Coach
          {unreadCount > 0 && (
            <span style={{
              background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800,
              padding: "2px 8px", borderRadius: 10, marginLeft: 4,
            }}>{unreadCount}</span>
          )}
        </button>

        {/* Edit Profile */}
        <button
          onClick={() => setEditProfileOpen(true)}
          style={{
            ...touchBtn(B.card, B.text, { width: "100%", marginTop: 8, border: `1px solid ${B.border}`, gap: 10 }),
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontSize: 18 }}>&#x270F;&#xFE0F;</span>
          Edit Profile
        </button>

        {/* Payment Methods */}
        <button
          onClick={() => { /* TODO: payment modal */ }}
          style={{
            ...touchBtn(B.card, B.text, { width: "100%", marginTop: 8, border: `1px solid ${B.border}`, gap: 10 }),
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontSize: 18 }}>&#x1F4B3;</span>
          My Payment Methods
        </button>

        {/* Sign Out */}
        <button
          onClick={logout}
          style={{
            ...touchBtn(B.red + "12", B.red, { width: "100%", marginTop: 16 }),
            boxSizing: "border-box",
          }}
        >
          Sign Out
        </button>

        {/* App version */}
        <div style={{ textAlign: "center", padding: "24px 0 12px" }}>
          <div style={{ fontSize: 12, color: B.dim }}>HyperFit v1.0.0</div>
        </div>

        <div style={{ height: 20 }} />
      </div>
    );
  };

  /* ─────────── QUICK CHECK-IN ─────────── */
  const [checkInMsg, setCheckInMsg] = useState(null);

  const handleQuickCheckIn = (cls) => {
    try {
      const stored = JSON.parse(localStorage.getItem("hf_attendance") || "[]");
      const already = stored.find(a =>
        a.memberId === member.id &&
        new Date(a.date || a.timestamp).toISOString().slice(0, 10) === todayISO()
      );
      if (already) {
        setCheckInMsg("You're already checked in today!");
        setTimeout(() => setCheckInMsg(null), 2500);
        return;
      }
      const record = {
        id: crypto.randomUUID(),
        memberId: member.id,
        date: todayISO(),
        timestamp: new Date().toISOString(),
        method: "client-portal",
        classId: cls?.id || null,
        className: cls?.name || null,
      };
      stored.push(record);
      localStorage.setItem("hf_attendance", JSON.stringify(stored));
      setCheckInMsg("Checked in! Have a great workout!");
      setTimeout(() => setCheckInMsg(null), 2500);
    } catch (e) {
      setCheckInMsg("Check-in failed. Try again.");
      setTimeout(() => setCheckInMsg(null), 2500);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  const TABS = [
    { key: "home", label: "Home", icon: "\uD83C\uDFE0" },
    { key: "workouts", label: "Workouts", icon: "\uD83C\uDFCB\uFE0F" },
    { key: "community", label: "Community", icon: "\uD83D\uDC65" },
    { key: "book", label: "Book", icon: "\uD83D\uDCC5" },
    { key: "progress", label: "Progress", icon: "\uD83D\uDCC8" },
    { key: "profile", label: "Profile", icon: "\uD83D\uDC64" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "home": return renderHome();
      case "workouts": return renderWorkouts();
      case "community": return renderCommunity();
      case "book": return renderBook();
      case "progress": return renderProgress();
      case "profile": return renderProfile();
      default: return renderHome();
    }
  };

  return (
    <div style={shell}>
      {/* Check-in toast */}
      {checkInMsg && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: B.accent, color: B.darker, padding: "12px 24px", borderRadius: 14,
          fontWeight: 700, fontSize: 15, zIndex: 200,
          boxShadow: `0 8px 32px ${B.accent}44`,
          animation: "slideDown 0.3s ease",
        }}>
          {checkInMsg}
        </div>
      )}

      {/* Tab Content */}
      <div style={fadeStyle}>
        {renderContent()}
      </div>

      {/* Bottom Tab Bar */}
      <div style={tabBar}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 1,
                background: "none", border: "none", cursor: "pointer",
                padding: "6px 0", minHeight: 44, position: "relative",
                transition: "transform 0.15s",
                transform: isActive ? "scale(1.05)" : "scale(1)",
              }}
            >
              {/* Active indicator dot */}
              {isActive && (
                <div style={{
                  position: "absolute", top: -1, width: 20, height: 3,
                  borderRadius: 2, background: B.accent,
                }} />
              )}
              <span style={{
                fontSize: 20, lineHeight: 1,
                filter: isActive ? "none" : "grayscale(80%)",
                opacity: isActive ? 1 : 0.5,
                transition: "opacity 0.15s, filter 0.15s",
              }}>{tab.icon}</span>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 500,
                color: isActive ? B.accent : B.dim,
                transition: "color 0.15s",
              }}>{tab.label}</span>

              {/* Unread badge on Home */}
              {tab.key === "home" && unreadCount > 0 && (
                <div style={{
                  position: "absolute", top: 2, right: "calc(50% - 18px)",
                  width: 16, height: 16, borderRadius: 8,
                  background: "#ef4444", color: "#fff",
                  fontSize: 9, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Video Modal */}
      {videoModal && (
        <div
          onClick={() => setVideoModal(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            zIndex: 300, padding: 16,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 12, padding: "0 4px",
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: 0 }}>{videoModal.name}</h3>
              <button
                onClick={() => setVideoModal(null)}
                style={{
                  width: 36, height: 36, borderRadius: 18, border: "none",
                  background: "rgba(255,255,255,0.15)", color: "#fff",
                  fontSize: 18, cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >&times;</button>
            </div>
            <div style={{
              position: "relative", width: "100%", paddingBottom: "56.25%",
              borderRadius: 16, overflow: "hidden", background: "#000",
            }}>
              {(() => {
                const ytId = extractYouTubeId(videoModal.url);
                if (ytId) {
                  return (
                    <iframe
                      src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                      title={videoModal.name}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      style={{
                        position: "absolute", top: 0, left: 0,
                        width: "100%", height: "100%", border: "none",
                      }}
                    />
                  );
                }
                return (
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#888", fontSize: 14,
                  }}>Video unavailable</div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal isOpen={editProfileOpen} onClose={() => setEditProfileOpen(false)} />

      {/* Inline keyframes for toast animation */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

/* Expandable coaching cues */
function ExerciseCues({ cues, B }) {
  const [expanded, setExpanded] = useState(false);

  if (!cues) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 600, color: B.accent, padding: 0,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        {expanded ? "\u25BC" : "\u25B6"} Coaching Cues
      </button>
      {expanded && (
        <div style={{
          marginTop: 6, padding: "8px 10px", borderRadius: 8,
          background: B.darker, fontSize: 13, color: B.muted, lineHeight: 1.6,
        }}>
          {cues}
        </div>
      )}
    </div>
  );
}

/* Weight logger inline component */
function WeightLogger({ B, exerciseName, logKey, todayLog, workoutId, memberId, workoutLogs, setWorkoutLogs, slot }) {
  const [showInput, setShowInput] = useState(false);
  const [weight, setWeight] = useState("");

  // Check if already logged
  const existingEntry = todayLog?.exercises?.find(e => e.name === exerciseName);

  const handleSave = () => {
    const w = parseFloat(weight);
    if (!w || !workoutId) return;

    const entry = {
      name: exerciseName,
      weight: w,
      sets: slot.sets ? parseInt(slot.sets, 10) : 0,
      reps: slot.reps ? parseInt(slot.reps, 10) : 0,
    };

    setWorkoutLogs(prev => {
      const existing = prev.find(l => l.memberId === memberId && l.date === todayISO() && l.workoutId === workoutId);
      if (existing) {
        return prev.map(l => {
          if (l.id !== existing.id) return l;
          const exIdx = l.exercises.findIndex(e => e.name === exerciseName);
          const exercises = [...l.exercises];
          if (exIdx >= 0) exercises[exIdx] = entry;
          else exercises.push(entry);
          return { ...l, exercises };
        });
      }
      return [...prev, {
        id: crypto.randomUUID(),
        memberId,
        date: todayISO(),
        workoutId,
        exercises: [entry],
      }];
    });

    setShowInput(false);
    setWeight("");
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${B.border}30` }}>
      {existingEntry ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px", borderRadius: 8, background: B.accent + "12",
        }}>
          <span style={{ fontSize: 13, color: B.accent, fontWeight: 700 }}>
            &#x2705; Logged: {existingEntry.weight} lbs
          </span>
        </div>
      ) : showInput ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            placeholder="Weight (lbs)"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            autoFocus
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 10,
              border: `1px solid ${B.border}`, background: B.darker,
              color: B.text, fontSize: 15, outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleSave}
            style={{
              minHeight: 40, padding: "0 16px", borderRadius: 10,
              border: "none", background: B.accent, color: B.darker,
              fontWeight: 700, fontSize: 14, cursor: "pointer",
              opacity: weight ? 1 : 0.4,
            }}
            disabled={!weight}
          >Save</button>
          <button
            onClick={() => { setShowInput(false); setWeight(""); }}
            style={{
              minHeight: 40, padding: "0 12px", borderRadius: 10,
              border: `1px solid ${B.border}`, background: "transparent",
              color: B.muted, fontSize: 14, cursor: "pointer",
            }}
          >&times;</button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          style={{
            width: "100%", padding: "10px 0", borderRadius: 10,
            border: `1px dashed ${B.border}`, background: "transparent",
            color: B.muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = B.accent + "08"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          &#x1F3CB;&#xFE0F; Log Weight
        </button>
      )}
    </div>
  );
}
