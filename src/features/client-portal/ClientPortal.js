import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";
import EditProfileModal from "../auth/EditProfileModal";
import { autoIndividualize } from "../../utils/autoIndividualize";
import { DEFAULT_MATRIX } from "../../data/movementMatrix";
import { EX } from "../../data/exercises";
import { getYTId, getYTThumb } from "../../utils/youtube";
import { localISO } from "../../utils/dates";
import { resizeImage } from "../../components/shared/ImageUpload";
import StoriesBar from "../../components/shared/Stories";
import ProgressPhotos from "../members/ProgressPhotos";

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAYS_FULL = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const todayISO = () => localISO();

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

const formatRWTimer = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/* ═══════════════════════════════════════════════════════════
   CLIENT PORTAL — MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function ClientPortal() {
  const B = useTheme();
  const { currentUser, logout } = useAuth();
  const { getMember, members, membersLoaded, updateMember } = useMembers();
  const avatarFileRef = useRef(null);
  const [activeTab, setActiveTab] = useState("home");
  const [prevTab, setPrevTab] = useState("home");
  const [transitioning, setTransitioning] = useState(false);
  const [clientChatOpen, setClientChatOpen] = useState(null);
  const [clientChatText, setClientChatText] = useState("");
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [progressReports, setProgressReports] = useLocalStorage("hf_progress_reports", []);
  const [viewingReport, setViewingReport] = useState(null);

  // Open a report and mark it seen (drives the home-page notification badge)
  const openReport = (r) => {
    setViewingReport(r);
    if (!r.seenAt) {
      const seenAt = new Date().toISOString();
      setProgressReports(prev => (Array.isArray(prev) ? prev : []).map(x => (x.id === r.id ? { ...x, seenAt } : x)));
    }
  };

  // Data stores
  const [classes, setClasses] = useLocalStorage("hf_schedule", []);
  const [attendance, setAttendance] = useLocalStorage("hf_attendance", []);
  const [, setPayments] = useLocalStorage("hf_payments", []);
  const [noShowSettings] = useLocalStorage("hf_noshow_settings", {});
  const [workouts] = useLocalStorage("hf_w", []);
  const [communityPosts, setCommunityPosts] = useLocalStorage("hf_community_posts", []);
  const [messages, setMessages] = useLocalStorage("hf_messages", []);
  const [workoutLogs, setWorkoutLogs] = useLocalStorage("hf_workout_logs", []);
  const [matrix] = useLocalStorage("hf_matrix", DEFAULT_MATRIX);
  const [exercises] = useLocalStorage("hf_ex", [...EX]);
  const [challenges, setChallenges] = useLocalStorage("hf_challenges", []);
  const [resources] = useLocalStorage("hf_resources", []);
  const [remoteWorkouts, setRemoteWorkouts] = useLocalStorage("hf_remote_workouts", []);
  const [clientTasks, setClientTasks] = useLocalStorage("hf_client_tasks", []);
  const [courses] = useLocalStorage("hf_courses", []);
  const [courseProgress, setCourseProgress] = useLocalStorage("hf_course_progress", []);

  // Video modal
  const [videoModal, setVideoModal] = useState(null);
  // Edit profile modal
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  // Remote workout completion
  const [remoteCompletionNotes, setRemoteCompletionNotes] = useState({});

  // Remote workout full-screen mode
  const [remoteWorkoutMode, setRemoteWorkoutMode] = useState(null);
  const [rwExIndex, setRwExIndex] = useState(0);
  const [rwTimer, setRwTimer] = useState(0);
  const [rwLogs, setRwLogs] = useState([]);
  const [rwShowCues, setRwShowCues] = useState(false);
  const [rwVideoUrl, setRwVideoUrl] = useState(null);
  const [rwFinished, setRwFinished] = useState(false);
  const [rwWeightInput, setRwWeightInput] = useState("");
  const [rwRepsInput, setRwRepsInput] = useState("");
  const [rwRpeInput, setRwRpeInput] = useState("");
  const [rwShowDrawer, setRwShowDrawer] = useState(false);
  const rwTimerRef = useRef(null);
  const rwTouchStartX = useRef(null);
  const [stationSettings] = useLocalStorage("hf_station_settings", { showWeight: true, showReps: true, showRPE: true, showMedia: true });

  // Community sub-tab state
  const [communitySubTab, setCommunitySubTab] = useState("feed");
  const [trainSection, setTrainSection] = useState(null); // "book" | "workouts" — null = smart default
  const [activeChallengeId, setActiveChallengeId] = useState(null);
  const [checkinText, setCheckinText] = useState("");
  const [checkinProof, setCheckinProof] = useState("");
  const [newPostText, setNewPostText] = useState("");
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});

  // Coach-assigned tasks UI state
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [viewedDocTasks, setViewedDocTasks] = useState({}); // taskId -> true once the doc was opened
  const [docOverlay, setDocOverlay] = useState(null); // { name, dataUrl } — inline image doc viewer
  const [courseViewerId, setCourseViewerId] = useState(null); // courseId for the full-screen course viewer
  const [courseLessonPath, setCourseLessonPath] = useState(null); // { moduleIdx, lessonIdx }

  // Member data
  const member = useMemo(() => {
    if (!currentUser?.memberId) return null;
    return getMember(currentUser.memberId);
  }, [currentUser, getMember, members]);

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

  // Progress reports delivered to this member (newest first) + unseen ones
  const myDeliveredReports = (Array.isArray(progressReports) ? progressReports : [])
    .filter(r => r.memberId === member?.id && r.status === "delivered")
    .sort((a, b) => (b.weekOf || "").localeCompare(a.weekOf || ""));
  const unseenReports = myDeliveredReports.filter(r => !r.seenAt);

  // Open (or create) the coach conversation and show the chat modal.
  // Shared by the Profile tab button, the home "Message Your Coach" card,
  // and the Messages stat tile.
  const openCoachChat = () => {
    const myMemberId = currentUser?.memberId;
    if (!myMemberId) return;
    const convs = Array.isArray(messages) ? messages : [];
    let myConv = convs.find(c => c.participants?.includes(myMemberId));
    if (!myConv) {
      myConv = { id: crypto.randomUUID(), participants: [myMemberId], messages: [], lastActivity: new Date().toISOString() };
      setMessages(prev => [...(Array.isArray(prev) ? prev : []), myConv]);
    }
    setClientChatOpen(myConv.id);
  };

  // Today's classes this member is booked into
  const todayDow = getTodayDow();
  const myBookedClasses = useMemo(() => {
    if (!member) return [];
    return classes.filter(c => c.bookings?.includes(member.id));
  }, [classes, member]);

  const todayClasses = useMemo(() => {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const today = todayISO();
    return myBookedClasses
      .filter(c => c.dayOfWeek === todayDow)
      .filter(c => !c.exceptions?.includes(today))
      .filter(c => {
        // Only include sessions that haven't ended yet
        const [eh, em] = (c.endTime || "23:59").split(":").map(Number);
        return currentMin < eh * 60 + em;
      })
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  }, [myBookedClasses, todayDow]);

  const upcomingClasses = useMemo(() => {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const upcoming = [];
    // Go out 8 days (offset 7 = same weekday next week) so a class whose
    // occurrence today already ended still shows its next occurrence.
    for (let offset = 0; offset <= 7 && upcoming.length < 3; offset++) {
      const dow = (todayDow + offset) % 7;
      const sessionDate = new Date(now);
      sessionDate.setDate(sessionDate.getDate() + offset);
      const sessionISO = localISO(sessionDate);
      const dayClasses = myBookedClasses
        .filter(c => c.dayOfWeek === dow)
        .filter(c => !c.exceptions?.includes(sessionISO))
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
      for (const c of dayClasses) {
        // Skip if it's today and already ended (its next-week occurrence is picked up at offset 7)
        if (offset === 0) {
          const [eh, em] = (c.endTime || "23:59").split(":").map(Number);
          if (currentMin >= eh * 60 + em) continue;
        }
        // Skip if already in todayClasses (shown separately) or already listed
        if (todayClasses.some(tc => tc.id === c.id)) continue;
        if (upcoming.some(u => u.id === c.id)) continue;
        if (upcoming.length < 3) {
          const dateStr = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : `${DAYS_FULL[dow]}, ${MONTHS[sessionDate.getMonth()]} ${sessionDate.getDate()}`;
          upcoming.push({ ...c, _dayLabel: dateStr });
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
    return attendance.filter(a => a.memberId === member.id && !a.noShow);
  }, [attendance, member]);

  // Joined challenges
  const myJoinedChallenges = useMemo(() => {
    if (!myId) return [];
    return (challenges || []).filter(c => c.participants?.includes(myId));
  }, [challenges, myId]);

  // ── Coach-assigned tasks (hf_client_tasks) ──
  // Visible = mine + pending + scheduled for today or earlier (future-scheduled stay hidden)
  const visibleTasks = useMemo(() => {
    if (!myId) return [];
    const today = todayISO();
    return (Array.isArray(clientTasks) ? clientTasks : [])
      .filter(t => t.memberId === myId && t.status === "pending" && (t.scheduledFor || "") <= today)
      .sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
  }, [clientTasks, myId]);

  // Completed in the last 7 days — shown in the collapsed "Done recently" list
  const recentDoneTasks = useMemo(() => {
    if (!myId) return [];
    const cutoff = Date.now() - 7 * 86400000;
    return (Array.isArray(clientTasks) ? clientTasks : [])
      .filter(t => t.memberId === myId && t.status === "done" && t.completedAt && new Date(t.completedAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  }, [clientTasks, myId]);

  const markTaskDone = (taskId) => {
    setClientTasks(prev => (Array.isArray(prev) ? prev : []).map(t =>
      t.id === taskId ? { ...t, status: "done", completedAt: new Date().toISOString() } : t
    ));
  };

  // Auto-complete: after the client actually creates a community post, mark the
  // OLDEST visible pending community_post task for this member as done.
  const completeOldestCommunityTask = () => {
    if (!myId) return;
    setClientTasks(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      const today = todayISO();
      const target = arr
        .filter(t => t.memberId === myId && t.status === "pending" && t.type === "community_post" && (t.scheduledFor || "") <= today)
        .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))[0];
      if (!target) return arr;
      return arr.map(t => t.id === target.id ? { ...t, status: "done", completedAt: new Date().toISOString() } : t);
    });
  };

  // Attach proof to a task (cap 2MB)
  const handleTaskUpload = (taskId, file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("File is too large — max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setClientTasks(prev => (Array.isArray(prev) ? prev : []).map(t =>
        t.id === taskId ? { ...t, upload: { name: file.name, dataUrl: reader.result } } : t
      ));
    };
    reader.readAsDataURL(file);
  };

  // Open a doc task: images get an inline overlay; anything else (PDF etc.)
  // opens a new window with an iframe pointed at the dataUrl.
  const openTaskDoc = (task) => {
    const doc = task.doc;
    if (!doc?.dataUrl) return;
    if (doc.dataUrl.startsWith("data:image")) {
      setDocOverlay({ name: doc.name, dataUrl: doc.dataUrl });
    } else {
      const w = window.open("", "_blank");
      if (w) {
        const safeName = String(doc.name || "Document").replace(/[<>&"]/g, "");
        w.document.write(`<!DOCTYPE html><html><head><title>${safeName}</title></head><body style="margin:0;background:#111"><iframe src="${doc.dataUrl}" style="border:none;width:100vw;height:100vh"></iframe></body></html>`);
        w.document.close();
      }
    }
    setViewedDocTasks(prev => ({ ...prev, [task.id]: true }));
  };

  // Per-member course progress — mirrors ClassroomView's toggleComplete record
  // shape exactly: { courseId, lessonIds: [...], memberId }
  const toggleLessonComplete = (courseId, lessonId) => {
    if (!myId) return;
    setCourseProgress(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      const existing = arr.find(p => p.courseId === courseId && (p.memberId || "admin") === myId);
      if (existing) {
        const ids = existing.lessonIds.includes(lessonId) ? existing.lessonIds.filter(id => id !== lessonId) : [...existing.lessonIds, lessonId];
        return arr.map(p => p === existing ? { ...p, lessonIds: ids } : p);
      }
      return [...arr, { courseId, lessonIds: [lessonId], memberId: myId }];
    });
  };

  // "Make a Post" — jump to the Home feed composer
  const goToPostComposer = () => {
    setCommunitySubTab("feed");
    setActiveChallengeId(null);
    setShowNewPost(true);
    switchTab("home");
    setTimeout(() => document.getElementById("home-feed")?.scrollIntoView({ behavior: "smooth" }), 400);
  };

  // Current date
  const now = new Date();
  const dateStr = `${DAYS_FULL[todayDow]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  /* ─── STYLE TOKENS ─── */
  const shell = {
    maxWidth: 480, margin: "0 auto", minHeight: "100vh", position: "relative",
    background: B.darker, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: 80, overflow: "hidden",
  };

  // Facebook-style floating pill nav
  const tabBar = {
    position: "fixed", bottom: 10, left: "50%", transform: "translateX(-50%)",
    width: "calc(100% - 20px)", maxWidth: 460, height: 58,
    background: B.card + "f2", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    border: `1px solid ${B.border}60`, borderRadius: 29,
    boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
    display: "flex", alignItems: "center", justifyContent: "space-around",
    padding: "0 6px", zIndex: 100, boxSizing: "border-box",
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

  // NOTE: Don't early-return here — hooks below need to run on every render.
  // Instead we check !member in the final return.
  // Wait for Supabase data to load before deciding the member is truly missing.
  const memberMissing = !member && membersLoaded;
  const memberLoading = !member && !membersLoaded;
  const isFrozen = member?.membershipStatus === "frozen";


  /* ─────────── HOME TAB (Facebook-style feed) ─────────── */
  const renderHome = () => {
    // Count unread messages
    const myConvs = (Array.isArray(messages) ? messages : []).filter(c => c.participants?.includes(myId));
    const unreadMsgCount = myConvs.reduce((sum, c) => sum + (c.messages || []).filter(m => !m.read && m.senderId !== myId).length, 0);

    return (
      <div style={{ padding: "0 16px" }}>
        {/* Facebook-style top bar: gym name + messenger */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 4px" }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, color: B.accent }}>
            {(() => { try { return JSON.parse(localStorage.getItem("hf_branding") || "{}").gymName || "GymKit"; } catch { return "GymKit"; } })()}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {unseenReports.length > 0 && (
              <div onClick={() => openReport(unseenReports[0])} style={{
                width: 40, height: 40, borderRadius: 20, background: B.card, border: `1px solid ${B.border}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", position: "relative",
              }}>
                {"🔔"}
                <div style={{ position: "absolute", top: -3, right: -3, width: 18, height: 18, borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{unseenReports.length}</div>
              </div>
            )}
            <div onClick={openCoachChat} style={{
              width: 40, height: 40, borderRadius: 20, background: B.card, border: `1px solid ${B.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", position: "relative",
            }}>
              {"💬"}
              {unreadMsgCount > 0 && (
                <div style={{ position: "absolute", top: -3, right: -3, width: 18, height: 18, borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadMsgCount}</div>
              )}
            </div>
          </div>
        </div>

        {/* "What's on your mind?" composer row */}
        <div onClick={() => { setCommunitySubTab("feed"); setActiveChallengeId(null); document.getElementById("home-feed")?.scrollIntoView({ behavior: "smooth" }); }} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 0 12px",
          borderBottom: `1px solid ${B.border}`, marginBottom: 10, cursor: "pointer",
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 19, flexShrink: 0,
            background: member.photo ? `url(${member.photo}) center/cover` : `linear-gradient(135deg, ${B.accent}, ${B.accent}88)`,
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800,
          }}>
            {!member.photo && (member.firstName || "?").slice(0, 1)}
          </div>
          <div style={{
            flex: 1, background: B.card, border: `1px solid ${B.border}`, borderRadius: 20,
            padding: "10px 16px", fontSize: 14, color: B.muted,
          }}>What's on your mind?</div>
        </div>

        {/* Stories */}
        <StoriesBar me={{ id: member.id, name: `${member.firstName} ${member.lastName || ""}`.trim(), photo: member.photo || "" }} />

        {/* New progress report notification */}
        {unseenReports.length > 0 && (
          <div
            onClick={() => openReport(unseenReports[0])}
            style={{
              margin: "16px 0 4px", padding: "16px 18px", borderRadius: 16, cursor: "pointer",
              background: `linear-gradient(135deg, ${B.accent}, ${B.accent}bb)`,
              boxShadow: `0 8px 24px ${B.accent}44`,
              display: "flex", alignItems: "center", gap: 14,
            }}
          >
            <div style={{ fontSize: 30 }}>{"🎉"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
                Your Progress Report is ready!
              </div>
              <div style={{ fontSize: 12, color: "#ffffffdd", marginTop: 2 }}>
                Your coach just reviewed your progress — tap to see your wins
              </div>
            </div>
            <div style={{ fontSize: 18, color: "#fff", fontWeight: 800 }}>{"→"}</div>
          </div>
        )}

        {/* Unread Messages */}
        {unreadCount > 0 && (
          <div style={{
            ...cardStyle, background: `linear-gradient(135deg, #3b82f615 0%, ${B.card} 100%)`,
            border: `1px solid #3b82f640`, cursor: "pointer",
          }} onClick={openCoachChat}>
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

        {/* Community — full feed/challenges/resources now live on Home */}
        <div id="home-feed" style={{ margin: "0 -16px" }}>
          {renderCommunity()}
        </div>

        <div style={{ height: 20 }} />
      </div>
    );
  };

  /* ─────────── DASH TAB (stats + sessions + coach) ─────────── */
  const renderDash = () => {
    const gam = member.gamification || {};
    const today = todayISO();
    const xpForNext = (gam.level || 1) * 200;
    const xpPct = Math.min(100, ((gam.xp || 0) / xpForNext) * 100);

    // Count unread messages
    const myConvs = (Array.isArray(messages) ? messages : []).filter(c => c.participants?.includes(myId));
    const unreadMsgCount = myConvs.reduce((sum, c) => sum + (c.messages || []).filter(m => !m.read && m.senderId !== myId).length, 0);

    // Next upcoming session
    const nextSession = todayClasses.length > 0 ? todayClasses[0] : null;

    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ textAlign: "center", padding: "6px 0 0", opacity: 0.3 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: B.muted, margin: "0 auto" }} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "20px 0 4px" }}>Dashboard</h1>

        {/* Tasks to Complete — coach-assigned tasks */}
        {(visibleTasks.length > 0 || recentDoneTasks.length > 0) && (
          <div style={{ ...cardStyle, marginTop: 12, border: `1px solid ${B.accent}40` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{"✅"}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: B.text, flex: 1 }}>Tasks to Complete</span>
              {visibleTasks.length > 0 && (
                <span style={{
                  minWidth: 22, height: 22, borderRadius: 11, padding: "0 6px", boxSizing: "border-box",
                  background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 800,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>{visibleTasks.length}</span>
              )}
            </div>
            {visibleTasks.length === 0 && (
              <div style={{ ...mutedText, marginTop: 8 }}>All caught up! {"🎉"}</div>
            )}
            {visibleTasks.map((t, ti) => {
              const icon = { custom: "📝", doc: "📄", course: "🎓", community_post: "📣" }[t.type] || "📝";
              const overdue = t.dueDate && t.dueDate < today;
              const smallBtn = { fontSize: 12, minHeight: 32, padding: "6px 14px", borderRadius: 10 };
              return (
                <div key={t.id} style={{ padding: "10px 0 2px", borderTop: ti === 0 ? "none" : `1px solid ${B.border}`, marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 18, lineHeight: 1.2 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: B.text, lineHeight: 1.3 }}>{t.title}</div>
                      {t.description && (
                        <div style={{ fontSize: 12, color: B.muted, marginTop: 2, lineHeight: 1.4 }}>{t.description}</div>
                      )}
                      {t.type === "community_post" && t.prompt && (
                        <div style={{
                          fontSize: 12, color: B.text, marginTop: 6, padding: "8px 10px", lineHeight: 1.4,
                          background: B.darker, borderRadius: 8, borderLeft: `3px solid ${B.accent}`,
                        }}>{"💬"} {t.prompt}</div>
                      )}
                      {t.upload && (
                        <div style={{ fontSize: 11, color: B.accent, fontWeight: 600, marginTop: 4 }}>{"📎"} {t.upload.name}</div>
                      )}
                    </div>
                    {t.dueDate && (
                      <span style={{
                        ...pillBadge(overdue ? "#ef444422" : B.darker, overdue ? "#ef4444" : B.muted),
                        fontSize: 10, alignSelf: "flex-start", flexShrink: 0, border: `1px solid ${overdue ? "#ef444450" : B.border}`,
                      }}>{overdue ? "Overdue · " : "Due "}{fmtDateShort(t.dueDate + "T00:00:00")}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, marginLeft: 28, flexWrap: "wrap", alignItems: "center" }}>
                    {t.type === "custom" && (
                      <>
                        <button onClick={() => markTaskDone(t.id)} style={touchBtn(B.accent, B.darker, smallBtn)}>Mark Done</button>
                        <label style={{
                          fontSize: 12, fontWeight: 600, color: B.muted, cursor: "pointer",
                          padding: "6px 12px", borderRadius: 10, border: `1px dashed ${B.border}`,
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}>
                          {"📎"} attach
                          <input type="file" style={{ display: "none" }} onChange={e => { handleTaskUpload(t.id, e.target.files?.[0]); e.target.value = ""; }} />
                        </label>
                      </>
                    )}
                    {t.type === "doc" && (
                      <>
                        <button onClick={() => openTaskDoc(t)} style={touchBtn(B.darker, B.text, { ...smallBtn, border: `1px solid ${B.border}` })}>
                          {"👁️"} View
                        </button>
                        {viewedDocTasks[t.id] && (
                          <button onClick={() => markTaskDone(t.id)} style={touchBtn(B.accent, B.darker, smallBtn)}>Mark Done</button>
                        )}
                      </>
                    )}
                    {t.type === "course" && (
                      <>
                        <button onClick={() => { setCourseViewerId(t.courseId); setCourseLessonPath(null); }} style={touchBtn(B.accent, B.darker, smallBtn)}>
                          Open Course
                        </button>
                        <button onClick={() => markTaskDone(t.id)} style={touchBtn(B.darker, B.muted, { ...smallBtn, border: `1px solid ${B.border}` })}>Mark Done</button>
                      </>
                    )}
                    {t.type === "community_post" && (
                      <button onClick={goToPostComposer} style={touchBtn(B.accent, B.darker, smallBtn)}>Make a Post</button>
                    )}
                  </div>
                </div>
              );
            })}
            {recentDoneTasks.length > 0 && (
              <div style={{ marginTop: 10, borderTop: `1px solid ${B.border}`, paddingTop: 8 }}>
                <div onClick={() => setShowDoneTasks(v => !v)} style={{
                  fontSize: 12, fontWeight: 700, color: B.muted, cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>Done recently ({recentDoneTasks.length})</span>
                  <span style={{ fontSize: 10 }}>{showDoneTasks ? "▲" : "▼"}</span>
                </div>
                {showDoneTasks && recentDoneTasks.map(t => (
                  <div key={t.id} style={{ display: "flex", gap: 8, padding: "6px 0 0", fontSize: 12, color: B.muted, alignItems: "center" }}>
                    <span style={{ color: B.green || "#22c55e", fontWeight: 800 }}>{"✓"}</span>
                    <span style={{ flex: 1, textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                    <span style={{ fontSize: 11, flexShrink: 0 }}>{fmtDateShort(t.completedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hero Greeting Card */}
        <div style={{
          background: `linear-gradient(135deg, ${B.accent}22 0%, ${B.card} 100%)`,
          borderRadius: 20, padding: "24px 20px", margin: "12px 0 16px",
          border: `1px solid ${B.accent}30`,
        }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: B.text, margin: 0, lineHeight: 1.2 }}>
            Hey {firstName}! {"\uD83D\uDC4B"}
          </h1>
          <p style={{ ...mutedText, marginTop: 4, marginBottom: 16 }}>{dateStr}</p>

          {/* XP Progress Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: B.accent + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: B.accent }}>
              {gam.level || 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: B.text }}>Level {gam.level || 1}</span>
                <span style={{ fontSize: 11, color: B.muted }}>{gam.xp || 0} / {xpForNext} XP</span>
              </div>
              <div style={{ height: 8, background: B.border, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: B.accent, borderRadius: 4, width: xpPct + "%", transition: "width 0.5s" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, margin: "0 0 16px" }}>
          <div style={{ ...cardStyle, textAlign: "center", padding: "12px 6px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>{gam.currentStreak || 0}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: B.muted, marginTop: 2 }}>{"\uD83D\uDD25"} Streak</div>
          </div>
          <div style={{ ...cardStyle, textAlign: "center", padding: "12px 6px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: B.text }}>{gam.totalWorkouts || 0}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: B.muted, marginTop: 2 }}>{"\uD83C\uDFCB\uFE0F"} Workouts</div>
          </div>
          <div style={{ ...cardStyle, textAlign: "center", padding: "12px 6px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: B.accent }}>{gam.longestStreak || 0}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: B.muted, marginTop: 2 }}>{"\u2B50"} Best</div>
          </div>
          <div style={{ ...cardStyle, textAlign: "center", padding: "12px 6px", cursor: "pointer" }} onClick={openCoachChat}>
            <div style={{ fontSize: 22, fontWeight: 800, color: unreadMsgCount > 0 ? B.red || "#ef4444" : B.dim }}>{unreadMsgCount}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: B.muted, marginTop: 2 }}>{"\uD83D\uDCE9"} Messages</div>
          </div>
        </div>

        {/* Next Session Card */}
        {nextSession && (() => {
          const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
          const [sh, sm] = (nextSession.startTime || "0:0").split(":").map(Number);
          const [eh, em] = (nextSession.endTime || "23:59").split(":").map(Number);
          const isInProgress = nowMin >= sh * 60 + sm && nowMin < eh * 60 + em;
          const isUpcoming = nowMin < sh * 60 + sm;
          return (
          <div style={{
            ...cardStyle, padding: 0, overflow: "hidden", marginBottom: 16,
          }}>
            <div style={{ background: isInProgress ? B.green : B.accent, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{isInProgress ? "\uD83D\uDFE2 Session In Progress" : "\uD83D\uDCC5 Next Session"}</span>
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Today</span>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: B.text }}>{nextSession.name}</div>
              <div style={{ ...mutedText, marginTop: 2 }}>
                {fmtTime(nextSession.startTime)} - {fmtTime(nextSession.endTime)} &middot; {nextSession.instructor}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button onClick={() => { setTrainSection("workouts"); switchTab("train"); }} style={touchBtn(B.accent, B.darker, { flex: 1, fontSize: 14 })}>
                  {"\uD83C\uDFCB\uFE0F"} View Workout
                </button>
                {isCheckedInForClass(nextSession.id) ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", borderRadius: 12, background: B.green + "15", border: `1px solid ${B.green}30` }}>
                    <span style={{ color: B.green, fontWeight: 700, fontSize: 14 }}>{"\u2705"} Checked In</span>
                  </div>
                ) : (
                  <button onClick={() => handleQuickCheckIn(nextSession)} style={touchBtn(B.text + "15", B.text, { flex: 1, fontSize: 14, border: `1px solid ${B.border}` })}>
                    {"\u2705"} Check In
                  </button>
                )}
                {isUpcoming && !isCheckedInForClass(nextSession.id) && (
                  <button onClick={() => handleCancel(nextSession.id)} style={touchBtn(B.red + "15", B.red, { fontSize: 13, border: `1px solid ${B.red}30` })}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {/* No Session Today */}
        {!nextSession && (
          <div style={{ ...cardStyle, textAlign: "center", padding: "20px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{"\uD83C\uDFCA"}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: B.text }}>No sessions booked today</div>
            <button onClick={() => { setTrainSection("book"); switchTab("train"); }} style={{ ...touchBtn(B.accent, B.darker, { marginTop: 12, fontSize: 14 }), display: "inline-flex" }}>
              Book a Session
            </button>
          </div>
        )}

        {/* Additional booked sessions today (if more than one) */}
        {todayClasses.length > 1 && (
          <>
            <h3 style={sectionTitle}>{"\uD83D\uDCC5"} Other Sessions Today</h3>
            {todayClasses.slice(1).map(cls => (
              <div key={cls.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{cls.name}</div>
                  <div style={{ fontSize: 12, color: B.muted }}>{fmtTime(cls.startTime)} - {fmtTime(cls.endTime)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={pillBadge(B.accent + "22", B.accent)}>Booked</span>
                  <button onClick={() => handleCancel(cls.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: B.red + "15", color: B.red, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
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
                          switchTab("home");
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

        {/* Message Your Coach */}
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 12 }} onClick={openCoachChat}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: B.accent + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{"\uD83D\uDCE9"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: B.text }}>Message Your Coach</div>
            <div style={{ fontSize: 12, color: B.muted }}>Questions? Need help? Reach out anytime.</div>
          </div>
          <span style={{ color: B.accent, fontSize: 18 }}>{"\u203A"}</span>
        </div>

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
      .sort((a, b) => (b.date || b.timestamp || '').localeCompare(a.date || a.timestamp || ''))
      .slice(0, 20);

    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ textAlign: "center", padding: "6px 0 0", opacity: 0.3 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: B.muted, margin: "0 auto" }} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "20px 0 4px" }}>Workouts</h1>
        <p style={mutedText}>{dateStr}</p>

        {/* Remote Workouts */}
        {(() => {
          const today = todayISO();
          const myRemote = (remoteWorkouts || []).filter(rw =>
            rw.memberId === myId && rw.status === "active" && rw.startDate <= today && rw.endDate >= today
          );
          if (myRemote.length === 0) return null;

          const handleMarkComplete = (rwId) => {
            const notes = remoteCompletionNotes[rwId] || "";
            setRemoteWorkouts(prev => prev.map(rw => {
              if (rw.id !== rwId) return rw;
              const alreadyDone = (rw.completions || []).some(c => c.date === today);
              if (alreadyDone) return rw;
              const updated = { ...rw, completions: [...(rw.completions || []), { date: today, notes }] };
              // Auto-complete if end date reached
              const totalDays = Math.round((new Date(rw.endDate + "T00:00:00Z") - new Date(rw.startDate + "T00:00:00Z")) / 86400000) + 1;
              if (updated.completions.length >= totalDays) updated.status = "completed";
              return updated;
            }));
            setRemoteCompletionNotes(prev => ({ ...prev, [rwId]: "" }));
          };

          return (
            <>
              <h3 style={{ ...sectionTitle, marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
                &#127757; Remote Workouts
              </h3>
              {myRemote.map(rw => {
                const totalDays = Math.round((new Date(rw.endDate + "T00:00:00Z") - new Date(rw.startDate + "T00:00:00Z")) / 86400000) + 1;
                const completedDays = (rw.completions || []).length;
                const todayDone = (rw.completions || []).some(c => c.date === today);
                const templateWk = rw.workoutId ? workouts.find(w => w.id === rw.workoutId) : null;
                const exerciseList = rw.customExercises || (templateWk?.sections?.flatMap(s => (s.slots || s.exercises || []).map(sl => {
                  const ex = sl.exercise || sl;
                  return { name: ex.n || ex.name || "Exercise", sets: sl.sets || "", reps: sl.reps || "", notes: "" };
                })) || []);

                const fmtD = (d) => {
                  const date = new Date(d + "T00:00:00");
                  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                  return `${months[date.getMonth()]} ${date.getDate()}`;
                };

                return (
                  <div key={rw.id} style={{
                    ...cardStyle, marginBottom: 12,
                    background: `linear-gradient(135deg, #3b82f615 0%, ${B.card} 100%)`,
                    border: `1px solid #3b82f640`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 0.5 }}>Remote Workout</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: B.text, marginTop: 4 }}>{rw.workoutName || "Custom Workout"}</div>
                      </div>
                      <span style={pillBadge("#3b82f622", "#3b82f6")}>{fmtD(rw.startDate)} - {fmtD(rw.endDate)}</span>
                    </div>

                    {/* Progress */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: B.border, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0}%`, background: "#3b82f6", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6" }}>Day {completedDays} of {totalDays}</span>
                    </div>

                    {/* Coach notes */}
                    {rw.coachNotes && (
                      <div style={{ fontSize: 13, color: B.muted, marginBottom: 10, fontStyle: "italic", padding: "8px 12px", borderRadius: 8, background: B.dark }}>
                        &#128172; {rw.coachNotes}
                      </div>
                    )}

                    {/* Exercise list */}
                    {exerciseList.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        {exerciseList.map((ex, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < exerciseList.length - 1 ? `1px solid ${B.border}40` : "none" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", minWidth: 20 }}>{i + 1}</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: B.text, flex: 1 }}>{ex.name}</span>
                            <span style={{ fontSize: 12, color: B.muted }}>
                              {ex.sets && `${ex.sets}x`}{ex.reps || ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Start Workout + Mark complete */}
                    {todayDone ? (
                      <div style={{ textAlign: "center", padding: "10px 0", color: B.green || "#4ade80", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <span>&#10003;</span> Completed today
                      </div>
                    ) : (
                      <div>
                        <button
                          onClick={() => handleStartRemoteWorkout(rw)}
                          style={touchBtn(B.accent || "#8fbf3b", "#fff", { width: "100%", fontSize: 15, minHeight: 48, marginBottom: 8, boxSizing: "border-box" })}
                        >
                          &#x1F3CB;&#xFE0F; Start Workout
                        </button>
                        <input
                          value={remoteCompletionNotes[rw.id] || ""}
                          onChange={e => setRemoteCompletionNotes(prev => ({ ...prev, [rw.id]: e.target.value }))}
                          placeholder="Notes (optional)..."
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${B.border}`, background: B.dark, color: B.text, fontSize: 13, outline: "none", marginBottom: 8, boxSizing: "border-box" }}
                        />
                        <button
                          onClick={() => handleMarkComplete(rw.id)}
                          style={touchBtn("#3b82f6", "#fff", { width: "100%", fontSize: 14, boxSizing: "border-box" })}
                        >
                          &#10003; Mark Today as Complete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          );
        })()}

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
            <button onClick={() => { setTrainSection("book"); switchTab("train"); }} style={touchBtn(B.accent, B.darker, { marginTop: 16, fontSize: 14 })}>
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
                    <div style={mutedText}>{fmtDateNice(log.date || log.timestamp)}</div>
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
  // Cancel booking — shared between Home and Book tabs
  const handleCancel = (classId) => {
    if (!member) return;
    const cls = classes.find(c => c.id === classId);
    const nsSettings = noShowSettings || {};
    const cancelWindowHours = nsSettings.cancelWindowHours ?? 12;
    const penaltyEnabled = nsSettings.penaltyEnabled !== false;

    // Late-cancel check against the NEXT occurrence of this class (not just same-day)
    if (cls && cls.startTime && cls.dayOfWeek != null) {
      const now = new Date();
      const todayDow = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const [h, m] = cls.startTime.split(":").map(Number);
      const sessionTime = new Date(now);
      sessionTime.setDate(sessionTime.getDate() + ((cls.dayOfWeek - todayDow + 7) % 7));
      sessionTime.setHours(h, m, 0, 0);
      if (now > sessionTime) {
        const [eh, em] = (cls.endTime || "23:59").split(":").map(Number);
        const sessionEnd = new Date(sessionTime);
        sessionEnd.setHours(eh, em, 0, 0);
        if (now <= sessionEnd) { alert("This session has already started."); return; }
        // Today's occurrence is over — the cancellation applies to next week's occurrence
        sessionTime.setDate(sessionTime.getDate() + 7);
      }

      // Check penalty window
      const hoursUntil = (sessionTime - now) / (1000 * 60 * 60);
      if (hoursUntil <= cancelWindowHours && penaltyEnabled) {
        if (!window.confirm(`You are cancelling within ${cancelWindowHours} hours of your session. This will still count against your session allotment. Continue?`)) return;
        const lateCancel = { id: crypto.randomUUID(), memberId: member.id, checkInTime: new Date().toISOString(), method: "late-cancel", classId, noShow: true };
        setAttendance(prev => [...prev, lateCancel]);
        if (nsSettings.lateCancelFeeEnabled && nsSettings.feeAmount) {
          const thisMonth = lateCancel.checkInTime.slice(0, 7);
          const monthLateCancels = [...attendance, lateCancel].filter(a => a.memberId === member.id && a.method === "late-cancel" && a.checkInTime?.slice(0, 7) === thisMonth).length;
          if (monthLateCancels >= (nsSettings.lateCancelFeeThreshold || 3)) {
            setPayments(prev => [...prev, { id: "pay_" + Date.now(), member: `${member.firstName} ${member.lastName}`, memberId: member.id, amount: nsSettings.feeAmount, date: todayISO(), status: "paid", method: "Late Cancel Fee", description: `Late cancel fee (${monthLateCancels} this month)` }]);
            alert(`Late cancellation fee of $${nsSettings.feeAmount} has been charged (${monthLateCancels} late cancels this month).`);
          }
        }
      }
    }

    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      let newBookings = (c.bookings || []).filter(id => id !== member.id);
      let newWaitlist = (c.waitlist || []).filter(id => id !== member.id);
      if (newBookings.length < c.capacity && newWaitlist.length > 0 && (c.bookings || []).includes(member.id)) {
        newBookings = [...newBookings, newWaitlist[0]];
        newWaitlist = newWaitlist.slice(1);
      }
      return { ...c, bookings: newBookings, waitlist: newWaitlist };
    }));
  };

  const renderBook = () => {
    const monday = getMonday();
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });

    const handleBook = (classId) => {
      if (!member) return;
      setClasses(prev => prev.map(c => {
        if (c.id !== classId) return c;
        if (c.bookings?.includes(member.id)) return c;
        if ((c.bookings?.length || 0) < c.capacity) {
          return { ...c, bookings: [...(c.bookings || []), member.id] };
        }
        return { ...c, waitlist: [...(c.waitlist || []), member.id] };
      }));
    };

    // handleCancel is defined at component level above

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
            const isToday = localISO(d) === todayISO();
            const dayClasses = classes.filter(c => c.dayOfWeek === i && !c.exceptions?.includes(localISO(d)));
            const isDayPast = localISO(d) < todayISO();
            return (
              <div key={i} style={{
                textAlign: "center", padding: "10px 14px", borderRadius: 14,
                background: isToday ? B.accent + "20" : B.card,
                border: isToday ? `2px solid ${B.accent}` : `1px solid ${B.border}`,
                minWidth: 52, flexShrink: 0,
                opacity: isDayPast ? 0.4 : 1,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? B.accent : B.muted }}>{DAYS_SHORT[i]}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? B.accent : B.text, marginTop: 2 }}>{d.getDate()}</div>
                {dayClasses.length > 0 && (
                  <div style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: isDayPast ? B.muted : B.accent, margin: "4px auto 0",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Past-sessions toggle — only when this week actually has past sessions */}
        {(() => {
          const sessionEnded = (cls, d) => {
            const [eh, em] = (cls.endTime || "23:59").split(":").map(Number);
            const end = new Date(d); end.setHours(eh, em, 0, 0);
            return new Date() > end;
          };
          const hasPast = weekDates.some((d, i) =>
            (localISO(d) < todayISO() || localISO(d) === todayISO()) &&
            classes.some(c => c.dayOfWeek === i && !c.exceptions?.includes(localISO(d)) && sessionEnded(c, d))
          );
          if (!hasPast) return null;
          return (
            <button
              onClick={() => setShowPastSessions(s => !s)}
              style={{ background: "none", border: "none", color: B.muted, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "4px 0 0", textDecoration: "underline" }}
            >
              {showPastSessions ? "Hide past sessions" : "Show past sessions"}
            </button>
          );
        })()}

        {/* Classes by day */}
        {DAYS_SHORT.map((day, dayIdx) => {
          const dayISO = localISO(weekDates[dayIdx]);
          // Past days are hidden unless the user opts in
          if (dayISO < todayISO() && !showPastSessions) return null;
          let dayClasses = classes
            .filter(c => c.dayOfWeek === dayIdx && !c.exceptions?.includes(dayISO))
            .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
          // On today, hide sessions that already ended unless opted in
          if (dayISO === todayISO() && !showPastSessions) {
            const now = new Date();
            dayClasses = dayClasses.filter(cls => {
              const [eh, em] = (cls.endTime || "23:59").split(":").map(Number);
              const end = new Date(weekDates[dayIdx]); end.setHours(eh, em, 0, 0);
              return now <= end;
            });
          }
          if (dayClasses.length === 0) return null;

          const dateLabel = `${DAYS_FULL[dayIdx]}, ${MONTHS[weekDates[dayIdx].getMonth()]} ${weekDates[dayIdx].getDate()}`;

          return (
            <div key={dayIdx} style={{ marginTop: 20 }}>
              <div style={{ ...labelText, marginBottom: 10 }}>{dateLabel}</div>
              {dayClasses.map(cls => {
                const isBooked = cls.bookings?.includes(member.id);
                const isWaitlisted = cls.waitlist?.includes(member.id);
                // Check if session is in the past
                const sessionDate = weekDates[dayIdx];
                const now = new Date();
                const [sh, sm] = (cls.endTime || "23:59").split(":").map(Number);
                const sessionEnd = new Date(sessionDate); sessionEnd.setHours(sh, sm, 0, 0);
                const isPast = now > sessionEnd;
                const isFull = (cls.bookings?.length || 0) >= cls.capacity;
                const spotsLeft = cls.capacity - (cls.bookings?.length || 0);

                return (
                  <div key={cls.id} style={{
                    ...cardStyle,
                    border: isPast ? `1px solid ${B.border}` : isBooked ? `2px solid ${B.accent}` : isWaitlisted ? `2px solid ${B.orange}` : `1px solid ${B.border}`,
                    background: isPast ? B.card : isBooked ? B.accent + "08" : B.card,
                    opacity: isPast ? 0.45 : 1,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: isPast ? B.muted : B.text }}>{cls.name}</span>
                          {isPast && isBooked && <span style={pillBadge(B.dim + "22", B.muted)}>Completed</span>}
                          {isPast && !isBooked && <span style={pillBadge(B.dim + "22", B.muted)}>Past</span>}
                          {!isPast && isBooked && <span style={pillBadge(B.accent + "22", B.accent)}>Booked</span>}
                          {!isPast && isWaitlisted && <span style={pillBadge(B.orange + "22", B.orange)}>Waitlist</span>}
                        </div>
                        <div style={{ ...mutedText, marginTop: 4 }}>
                          {fmtTime(cls.startTime)} - {fmtTime(cls.endTime)} &middot; {cls.instructor}
                        </div>
                        {!isPast && (
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
                        )}
                      </div>

                      <div style={{ marginLeft: 12 }}>
                        {isPast ? (
                          null
                        ) : (isBooked || isWaitlisted) ? (
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

  /* ─────────── TRAIN TAB (Book + Workouts) ─────────── */
  const renderTrain = () => {
    const today = todayISO();
    const nextSession = todayClasses.length > 0 ? todayClasses[0] : null;
    const hasRemoteToday = (remoteWorkouts || []).some(rw =>
      rw.memberId === myId && rw.status === "active" && rw.startDate <= today && rw.endDate >= today
    );

    // Frozen members without a hold end date can't book — hide that segment
    const bookingHidden = isFrozen && !member?.holdEndDate;

    // Smart default: workouts if a remote workout is assigned or a session is booked today; else book
    const smartDefault = hasRemoteToday || nextSession ? "workouts" : "book";
    const section = bookingHidden ? "workouts" : (trainSection || smartDefault);

    const segPill = (key) => ({
      flex: 1, padding: "10px 0", borderRadius: 20, border: "none", cursor: "pointer",
      fontSize: 13, fontWeight: 700,
      background: section === key ? B.accent : "transparent",
      color: section === key ? B.darker : B.muted,
      transition: "all 0.15s",
    });

    return (
      <div>
        <div style={{ padding: "0 16px" }}>
          {/* Next session hero card */}
          {nextSession && (
            <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, margin: "16px 0 4px" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: B.accent + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{"📅"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: B.accent, textTransform: "uppercase", letterSpacing: 1 }}>Next session</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: B.text, marginTop: 2 }}>{nextSession.name}</div>
                <div style={{ fontSize: 12, color: B.muted, marginTop: 1 }}>
                  Today &middot; {fmtTime(nextSession.startTime)} - {fmtTime(nextSession.endTime)}
                </div>
              </div>
            </div>
          )}

          {/* Segmented control: Book Sessions / My Workouts */}
          {!bookingHidden && (
            <div style={{
              display: "flex", gap: 4, margin: "12px 0 0", padding: 4,
              background: B.card, border: `1px solid ${B.border}`, borderRadius: 24,
            }}>
              <button onClick={() => setTrainSection("book")} style={segPill("book")}>
                {"📅"} Book Sessions
              </button>
              <button onClick={() => setTrainSection("workouts")} style={segPill("workouts")}>
                {"🏋️"} My Workouts
              </button>
            </div>
          )}
        </div>

        {section === "book" ? renderBook() : renderWorkouts()}
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
          const nowISO = new Date().toISOString();
          // Write BOTH shapes (text/content, createdAt/timestamp) so staff + client renderers agree
          const comment = {
            id: crypto.randomUUID(),
            authorId: myId,
            authorName: `${member.firstName || "Member"} ${member.lastName || ""}`.trim(),
            text,
            content: text,
            createdAt: nowISO,
            timestamp: nowISO,
            likes: [],
            replies: [],
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
        // Auto-complete the oldest pending community_post task for this member
        completeOldestCommunityTask();
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
                {post.mediaType === "image" && post.mediaUrl && (
                  <img src={post.mediaUrl} alt="" loading="lazy" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8, marginBottom: 12 }} />
                )}
                {post.mediaType === "video" && post.mediaUrl && (() => {
                  const ytMatch = post.mediaUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
                  if (ytMatch) return (
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                      <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} title="Video" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen />
                    </div>
                  );
                  return null;
                })()}

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
                            <span style={{ fontSize: 10, color: B.dim }}>{timeAgo(c.createdAt ?? c.timestamp)}</span>
                          </div>
                          <p style={{ fontSize: 13, color: B.text, margin: "2px 0 0", lineHeight: 1.5 }}>{c.text ?? c.content ?? ""}</p>
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
        .filter(a => { const d = new Date(a.checkInTime || a.date || a.timestamp); return d.getFullYear() === year && d.getMonth() === month; })
        .map(a => new Date(a.checkInTime || a.date || a.timestamp).getDate())
    );

    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ textAlign: "center", padding: "6px 0 0", opacity: 0.3 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: B.muted, margin: "0 auto" }} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "20px 0 16px" }}>Progress</h1>

        {/* Progress report history */}
        {myDeliveredReports.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: B.text, marginBottom: 6 }}>
              {"📈"} Progress Reports
            </div>
            {myDeliveredReports.map(r => (
              <div key={r.id} onClick={() => openReport(r)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 0", borderTop: `1px solid ${B.border}`, cursor: "pointer",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: B.text }}>Report — {r.weekOf}</div>
                  <div style={{ fontSize: 11, color: B.muted, marginTop: 2 }}>
                    {r.seenAt ? `Viewed ${new Date(r.seenAt).toLocaleDateString()}` : "New — not viewed yet"}
                    {r.coachName ? ` · ${r.coachName}` : ""}
                  </div>
                </div>
                {r.seenAt ? (
                  <span style={{ fontSize: 12, color: B.muted, fontWeight: 600 }}>{"→"}</span>
                ) : (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 10,
                    background: B.accent, color: "#fff",
                  }}>NEW</span>
                )}
              </div>
            ))}
          </div>
        )}

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

        {/* Progress Photos */}
        <h3 style={sectionTitle}>&#x1F4F7; Progress Photos</h3>
        <div style={cardStyle}>
          <ProgressPhotos memberId={member.id} compact={true} />
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

        {/* Avatar + Name — tap the avatar to change the photo */}
        <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
          <div
            onClick={() => avatarFileRef.current?.click()}
            title="Change profile photo"
            style={{ position: "relative", width: 88, margin: "0 auto 16px", cursor: "pointer" }}
          >
            {member.photo ? (
              <img src={member.photo} alt="" style={{
                width: 88, height: 88, borderRadius: 28, objectFit: "cover",
                display: "block", boxShadow: `0 8px 24px ${B.accent}33`,
              }} />
            ) : (
              <div style={{
                width: 88, height: 88, borderRadius: 28,
                background: `linear-gradient(135deg, ${B.accent}, ${B.accent}88)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, fontWeight: 800, color: "#fff",
                boxShadow: `0 8px 24px ${B.accent}33`,
              }}>
                {getInitials(currentUser?.displayName || member.firstName)}
              </div>
            )}
            <div style={{
              position: "absolute", bottom: -4, right: -4, width: 30, height: 30,
              borderRadius: 15, background: B.card, border: `2px solid ${B.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
            }}>
              {"📷"}
            </div>
          </div>
          <input
            ref={avatarFileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file || !member) return;
              try {
                // Keep avatars small — they live inside the shared members blob
                const dataUrl = await resizeImage(file, 256);
                updateMember(member.id, { photo: dataUrl });
              } catch {
                alert("Could not process that image file.");
              }
            }}
          />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "0 0 4px" }}>
            {member.firstName} {member.lastName}
          </h1>
          <p style={{ ...mutedText, margin: 0 }}>
            Client since {memberSince ? fmtDateNice(memberSince) : "N/A"}
          </p>
        </div>

        {/* Weekly progress reports from the coach */}
        {myDeliveredReports.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: B.text, marginBottom: 10 }}>
              {"📈"} Progress Reports
            </div>
            {myDeliveredReports.slice(0, 6).map(r => (
              <div key={r.id} onClick={() => openReport(r)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0", borderTop: `1px solid ${B.border}`, cursor: "pointer",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: B.text }}>Report — {r.weekOf}</div>
                <div style={{ fontSize: 12, color: B.accent, fontWeight: 700 }}>{r.seenAt ? "View" : "NEW"} {"→"}</div>
              </div>
            ))}
          </div>
        )}

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
          onClick={openCoachChat}
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

  /* ─────────── REMOTE WORKOUT MODE ─────────── */

  // Resolve exercises for a remote workout
  const resolveRemoteExercises = useCallback((rw) => {
    if (rw.workoutId) {
      const templateWk = workouts.find(w => w.id === rw.workoutId);
      if (!templateWk) return [];
      const individualized = member?.movementScores
        ? autoIndividualize(templateWk, member.movementScores, matrix, exercises)
        : templateWk;
      const flat = [];
      (individualized.sections || []).forEach(sec => {
        (sec.slots || sec.exercises || []).forEach(slot => {
          const ex = slot.exercise || slot;
          if (ex && ex.n) {
            flat.push({
              ...slot,
              exercise: ex,
              sectionName: sec.name || sec.label || "",
            });
          }
        });
      });
      return flat;
    }
    // Custom exercises — look up full data from hf_ex
    return (rw.customExercises || []).map((ce, i) => {
      const fullEx = exercises.find(e => e.n === ce.name) || { n: ce.name || `Exercise ${i + 1}` };
      return {
        exercise: fullEx,
        sets: ce.sets || "",
        reps: ce.reps || "",
        rpe: ce.rpe || "",
        tempo: ce.tempo || "",
        sectionName: "",
      };
    });
  }, [workouts, member, matrix, exercises]);

  const handleStartRemoteWorkout = useCallback((rw) => {
    const resolved = resolveRemoteExercises(rw);
    if (resolved.length === 0) return;
    setRemoteWorkoutMode({ ...rw, _resolvedExercises: resolved });
    setRwExIndex(0);
    setRwTimer(0);
    setRwLogs([]);
    setRwShowCues(false);
    setRwVideoUrl(null);
    setRwFinished(false);
    setRwWeightInput("");
    setRwRepsInput("");
    setRwRpeInput("");
    setRwShowDrawer(false);
  }, [resolveRemoteExercises]);

  // NOTE: notification permission is intentionally NOT requested on mount —
  // browsers auto-deny permission prompts that lack a user gesture.

  // Timer for remote workout
  useEffect(() => {
    if (!remoteWorkoutMode || rwFinished) {
      if (rwTimerRef.current) clearInterval(rwTimerRef.current);
      return;
    }
    rwTimerRef.current = setInterval(() => setRwTimer(t => t + 1), 1000);
    return () => clearInterval(rwTimerRef.current);
  }, [remoteWorkoutMode, rwFinished]);

  // Remote workout navigation
  const rwFlatExercises = remoteWorkoutMode?._resolvedExercises || [];

  const rwGoNext = useCallback(() => {
    if (rwExIndex < rwFlatExercises.length - 1) {
      setRwExIndex(i => i + 1);
      setRwShowCues(false);
      setRwWeightInput("");
      setRwRepsInput("");
      setRwRpeInput("");
    }
  }, [rwExIndex, rwFlatExercises.length]);

  const rwGoPrev = useCallback(() => {
    if (rwExIndex > 0) {
      setRwExIndex(i => i - 1);
      setRwShowCues(false);
      setRwWeightInput("");
      setRwRepsInput("");
      setRwRpeInput("");
    }
  }, [rwExIndex]);

  const rwGoTo = useCallback((idx) => {
    setRwExIndex(idx);
    setRwShowCues(false);
    setRwWeightInput("");
    setRwRepsInput("");
    setRwRpeInput("");
  }, []);

  // Swipe for remote workout
  const rwHandleTouchStart = useCallback((e) => {
    rwTouchStartX.current = e.touches[0].clientX;
  }, []);

  const rwHandleTouchEnd = useCallback((e) => {
    if (rwTouchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - rwTouchStartX.current;
    if (Math.abs(diff) > 60) {
      if (diff < 0) rwGoNext();
      else rwGoPrev();
    }
    rwTouchStartX.current = null;
  }, [rwGoNext, rwGoPrev]);

  // Log a set in remote workout mode
  const rwLogSet = useCallback(() => {
    const w = parseFloat(rwWeightInput) || 0;
    const r = parseInt(rwRepsInput) || 0;
    const rpe = parseInt(rwRpeInput) || 0;
    const slot = rwFlatExercises[rwExIndex];
    if ((!w && !r && !rpe) || !slot?.exercise || !member) return;
    const logEntry = {
      id: crypto.randomUUID(),
      memberId: member.id,
      stationId: "remote",
      exerciseName: slot.exercise.n,
      weight: w,
      reps: r,
      rpe: rpe,
      timestamp: new Date().toISOString(),
    };
    // Save to hf_workout_logs
    setWorkoutLogs(prev => [...prev, logEntry]);
    // Save to session logs for summary
    setRwLogs(prev => [...prev, logEntry]);
    setRwWeightInput("");
    setRwRepsInput("");
    setRwRpeInput("");
  }, [rwWeightInput, rwRepsInput, rwRpeInput, rwFlatExercises, rwExIndex, member, setWorkoutLogs]);

  // Finish remote workout
  const rwHandleFinish = useCallback(() => {
    clearInterval(rwTimerRef.current);
    setRwFinished(true);
    // Auto-mark the day as complete
    if (remoteWorkoutMode) {
      const today = todayISO();
      setRemoteWorkouts(prev => prev.map(rw => {
        if (rw.id !== remoteWorkoutMode.id) return rw;
        const alreadyDone = (rw.completions || []).some(c => c.date === today);
        if (alreadyDone) return rw;
        const updated = { ...rw, completions: [...(rw.completions || []), { date: today, notes: "Completed via workout mode" }] };
        const totalDays = Math.round((new Date(rw.endDate + "T00:00:00Z") - new Date(rw.startDate + "T00:00:00Z")) / 86400000) + 1;
        if (updated.completions.length >= totalDays) updated.status = "completed";
        return updated;
      }));
    }
  }, [remoteWorkoutMode, setRemoteWorkouts]);

  const rwExitWorkout = useCallback(() => {
    clearInterval(rwTimerRef.current);
    setRemoteWorkoutMode(null);
    setRwFinished(false);
  }, []);

  // Get session logs for current exercise
  const rwCurrentSlot = rwFlatExercises[rwExIndex] || null;
  const rwCurrentEx = rwCurrentSlot?.exercise || null;
  const rwCurrentExLogs = useMemo(() => {
    if (!rwCurrentEx) return [];
    return rwLogs.filter(l => l.exerciseName === rwCurrentEx.n);
  }, [rwLogs, rwCurrentEx]);

  // Last session hint
  const rwLastSession = useMemo(() => {
    if (!rwCurrentEx || !member) return null;
    const pastLogs = workoutLogs.filter(
      l => l.memberId === member.id && l.exerciseName === rwCurrentEx.n && !rwLogs.some(rl => rl.id === l.id)
    );
    return pastLogs.length > 0 ? pastLogs[pastLogs.length - 1] : null;
  }, [workoutLogs, rwCurrentEx, member, rwLogs]);

  // Check if exercise has logged sets this session
  const rwIsExLogged = useCallback((exName) => {
    return rwLogs.some(l => l.exerciseName === exName);
  }, [rwLogs]);

  // Remote workout summary stats
  const rwTotalSets = rwLogs.length;
  const rwTotalWeight = rwLogs.reduce((s, l) => s + (l.weight || 0) * (l.reps || 1), 0);
  const rwExercisesCompleted = new Set(rwLogs.map(l => l.exerciseName)).size;

  // ─── Render remote workout full-screen mode ───
  const renderRemoteWorkoutMode = () => {
    if (!remoteWorkoutMode) return null;

    const D = {
      darker: "#080c12", dark: "#0d1117", card: "#161b22", border: "#21262d",
      text: "#e6edf3", muted: "#8b949e", dim: "#484f58", white: "#fff",
      accent: "#8fbf3b", red: "#ef4444", orange: "#f59e0b", green: "#22c55e",
      blue: "#3b82f6",
    };

    // Completion screen
    if (rwFinished) {
      return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 500,
          background: D.darker,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            background: `${D.green}22`, color: D.green,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 52, animation: "rwPopIn 0.5s ease-out",
          }}>
            &#10003;
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: D.text, marginTop: 20, textAlign: "center" }}>
            Great work{firstName ? `, ${firstName}` : ""}!
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 28, flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: D.accent }}>{rwExercisesCompleted}</div>
              <div style={{ fontSize: 13, color: D.muted }}>Exercises</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: D.accent }}>{rwTotalSets}</div>
              <div style={{ fontSize: 13, color: D.muted }}>Total Sets</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: D.accent }}>
                {rwTotalWeight > 0 ? `${rwTotalWeight.toLocaleString()}` : "--"}
              </div>
              <div style={{ fontSize: 13, color: D.muted }}>{rwTotalWeight > 0 ? "lbs Volume" : "Volume"}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: D.accent }}>{formatRWTimer(rwTimer)}</div>
              <div style={{ fontSize: 13, color: D.muted }}>Time</div>
            </div>
          </div>
          <button
            onClick={rwExitWorkout}
            style={{
              marginTop: 36, background: D.accent, color: "#fff", border: "none",
              borderRadius: 14, padding: "16px 48px", fontSize: 17, fontWeight: 700,
              cursor: "pointer", minHeight: 60,
            }}
          >
            Done
          </button>
          <style>{`
            @keyframes rwPopIn {
              0% { transform: scale(0.3); opacity: 0; }
              70% { transform: scale(1.1); }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      );
    }

    const currentSlot = rwFlatExercises[rwExIndex] || null;
    const currentEx = currentSlot?.exercise || null;

    const cueSteps = currentEx?.c
      ? currentEx.c.split(/(?=\d+\.\s)/).filter(Boolean)
      : [];

    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 500,
          background: D.darker,
          display: "flex", flexDirection: "column",
          overflow: "hidden", userSelect: "none",
          maxWidth: 480, margin: "0 auto",
        }}
        onTouchStart={rwHandleTouchStart}
        onTouchEnd={rwHandleTouchEnd}
      >
        {/* Video overlay */}
        {rwVideoUrl && (
          <div
            onClick={() => setRwVideoUrl(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 600,
              background: "rgba(0,0,0,0.9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
            }}
          >
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, aspectRatio: "16/9" }}>
              {(() => {
                const ytId = getYTId(rwVideoUrl);
                if (!ytId) return <div style={{ color: "#888", textAlign: "center" }}>Video unavailable</div>;
                return (
                  <iframe
                    src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                    title="Exercise video"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    style={{ width: "100%", height: "100%", border: "none", borderRadius: 12 }}
                  />
                );
              })()}
            </div>
            <button
              onClick={() => setRwVideoUrl(null)}
              style={{
                position: "absolute", top: 16, right: 16,
                width: 44, height: 44, borderRadius: 22, border: "none",
                background: "rgba(255,255,255,0.15)", color: "#fff",
                fontSize: 24, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >&#10005;</button>
          </div>
        )}

        {/* ─── Top Bar ─── */}
        <div style={{
          height: 56, minHeight: 56,
          background: D.dark,
          borderBottom: `1px solid ${D.border}`,
          display: "flex", alignItems: "center",
          padding: "0 12px",
          gap: 10,
        }}>
          <button
            onClick={rwExitWorkout}
            style={{
              width: 44, height: 44, borderRadius: 12, border: "none",
              background: D.card, color: D.text, fontSize: 20, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >&#8592;</button>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{
              fontSize: 15, fontWeight: 700, color: D.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {remoteWorkoutMode.workoutName || "Workout"}
            </div>
            <div style={{ fontSize: 12, color: D.muted }}>
              {rwExIndex + 1} of {rwFlatExercises.length}
            </div>
          </div>
          <div style={{
            fontSize: 16, fontWeight: 700, color: D.accent,
            fontFamily: "monospace", flexShrink: 0,
          }}>
            {formatRWTimer(rwTimer)}
          </div>
        </div>

        {/* ─── Main Exercise View ─── */}
        <div style={{
          flex: 1, overflow: "auto", position: "relative",
          display: "flex", flexDirection: "column",
          WebkitOverflowScrolling: "touch",
        }}>
          {/* Left/Right navigation arrows */}
          <button
            onClick={rwGoPrev}
            disabled={rwExIndex === 0}
            style={{
              position: "absolute", left: 6, top: "40%", transform: "translateY(-50%)",
              width: 48, height: 48, borderRadius: 14,
              background: rwExIndex === 0 ? D.border : D.card,
              border: `1px solid ${D.border}`,
              color: rwExIndex === 0 ? D.dim : D.text,
              fontSize: 22, cursor: rwExIndex === 0 ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 10, opacity: rwExIndex === 0 ? 0.3 : 1,
            }}
          >&#9664;</button>

          <button
            onClick={rwGoNext}
            disabled={rwExIndex >= rwFlatExercises.length - 1}
            style={{
              position: "absolute", right: 6, top: "40%", transform: "translateY(-50%)",
              width: 48, height: 48, borderRadius: 14,
              background: rwExIndex >= rwFlatExercises.length - 1 ? D.border : D.card,
              border: `1px solid ${D.border}`,
              color: rwExIndex >= rwFlatExercises.length - 1 ? D.dim : D.text,
              fontSize: 22, cursor: rwExIndex >= rwFlatExercises.length - 1 ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 10, opacity: rwExIndex >= rwFlatExercises.length - 1 ? 0.3 : 1,
            }}
          >&#9654;</button>

          {currentEx ? (
            <div style={{
              padding: "20px 56px", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 14, maxWidth: 480, margin: "0 auto", width: "100%",
              boxSizing: "border-box",
            }}>
              {/* Exercise name */}
              <h1 style={{
                fontSize: 24, fontWeight: 800, color: D.text, margin: 0,
                textAlign: "center", lineHeight: 1.2,
              }}>
                {currentEx.n}
              </h1>

              {/* Section name if available */}
              {currentSlot.sectionName && (
                <span style={{ fontSize: 12, color: D.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {currentSlot.sectionName}
                </span>
              )}

              {/* GIF or Video thumbnail */}
              {stationSettings.showMedia !== false && (
                currentEx.g ? (
                  <div style={{
                    width: "100%", maxWidth: 320, borderRadius: 14,
                    overflow: "hidden", border: `2px solid ${D.border}`,
                  }}>
                    <img
                      src={currentEx.g}
                      alt={currentEx.n}
                      style={{ width: "100%", display: "block", borderRadius: 12 }}
                    />
                  </div>
                ) : currentEx.u ? (
                  <div
                    onClick={() => setRwVideoUrl(currentEx.u)}
                    style={{
                      width: "100%", maxWidth: 320, aspectRatio: "16/9",
                      borderRadius: 14, overflow: "hidden", cursor: "pointer",
                      position: "relative", border: `2px solid ${D.border}`,
                    }}
                  >
                    <img
                      src={getYTThumb(currentEx.u)}
                      alt={currentEx.n}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div style={{
                      position: "absolute", inset: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(0,0,0,0.3)",
                    }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: "50%",
                        background: "rgba(0,0,0,0.6)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22,
                      }}>&#9654;</div>
                    </div>
                  </div>
                ) : null
              )}

              {/* Prescription */}
              <div style={{
                display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center",
                fontSize: 18, fontWeight: 600, color: D.text,
              }}>
                {currentSlot.sets && (
                  <span>{currentSlot.sets} <span style={{ color: D.muted, fontWeight: 400 }}>sets</span></span>
                )}
                {currentSlot.reps && (
                  <span>{currentSlot.reps} <span style={{ color: D.muted, fontWeight: 400 }}>reps</span></span>
                )}
                {currentSlot.rpe && (
                  <span>RPE <span style={{ color: D.orange }}>{currentSlot.rpe}</span></span>
                )}
                {currentSlot.tempo && (
                  <span style={{ color: D.muted }}>Tempo: {currentSlot.tempo}</span>
                )}
              </div>

              {/* Coaching cues (expandable) */}
              {currentEx.c && (
                <>
                  <button
                    onClick={() => setRwShowCues(c => !c)}
                    style={{
                      background: "none", border: `1px solid ${D.border}`,
                      borderRadius: 10, padding: "10px 20px",
                      color: D.muted, fontSize: 14, cursor: "pointer",
                      minHeight: 44,
                    }}
                  >
                    {rwShowCues ? "Hide Coaching Cues" : "Show Coaching Cues"}
                  </button>
                  {rwShowCues && cueSteps.length > 0 && (
                    <div style={{
                      background: D.card, borderRadius: 12, padding: 14,
                      width: "100%", border: `1px solid ${D.border}`,
                    }}>
                      {cueSteps.map((step, i) => (
                        <p key={i} style={{ fontSize: 14, color: D.text, margin: "5px 0", lineHeight: 1.5 }}>
                          {step.trim()}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Logging inputs */}
              <div style={{
                width: "100%", background: D.card, borderRadius: 14,
                padding: 14, border: `1px solid ${D.border}`,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  flexWrap: "wrap", justifyContent: "center",
                }}>
                  {stationSettings.showWeight && (
                    <input
                      type="number"
                      placeholder="lbs"
                      value={rwWeightInput}
                      onChange={e => setRwWeightInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && rwLogSet()}
                      style={{
                        width: 90, padding: "14px 10px", fontSize: 17, fontWeight: 600,
                        background: D.dark, color: D.text,
                        border: `2px solid ${D.border}`, borderRadius: 12,
                        textAlign: "center", outline: "none",
                      }}
                    />
                  )}
                  {stationSettings.showReps && (
                    <input
                      type="number"
                      placeholder="Reps"
                      value={rwRepsInput}
                      onChange={e => setRwRepsInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && rwLogSet()}
                      style={{
                        width: 80, padding: "14px 10px", fontSize: 17, fontWeight: 600,
                        background: D.dark, color: D.text,
                        border: `2px solid ${D.border}`, borderRadius: 12,
                        textAlign: "center", outline: "none",
                      }}
                    />
                  )}
                  {stationSettings.showRPE && (
                    <input
                      type="number"
                      placeholder="RPE"
                      min="1" max="10"
                      value={rwRpeInput}
                      onChange={e => setRwRpeInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && rwLogSet()}
                      style={{
                        width: 70, padding: "14px 10px", fontSize: 17, fontWeight: 600,
                        background: D.dark, color: D.text,
                        border: `2px solid ${D.border}`, borderRadius: 12,
                        textAlign: "center", outline: "none",
                      }}
                    />
                  )}
                  <button
                    onClick={rwLogSet}
                    style={{
                      background: D.accent, color: "#fff", border: "none",
                      borderRadius: 12, padding: "14px 22px",
                      fontSize: 16, fontWeight: 700, cursor: "pointer",
                      minHeight: 50,
                    }}
                  >
                    Log Set
                  </button>
                </div>

                {/* Logged sets for this exercise */}
                {rwCurrentExLogs.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {rwCurrentExLogs.map((log, i) => (
                      <div key={log.id} style={{
                        fontSize: 14, color: D.text, padding: "6px 0",
                        borderTop: i === 0 ? `1px solid ${D.border}` : "none",
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: `${D.green}22`, color: D.green,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>&#10003;</span>
                        <span style={{ fontWeight: 600 }}>Set {i + 1}:</span>
                        {log.weight > 0 && <span>{log.weight} lbs</span>}
                        {log.reps > 0 && <span>x {log.reps}</span>}
                        {log.rpe > 0 && <span style={{ color: D.orange }}>@ RPE {log.rpe}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Last session hint */}
                {rwLastSession && rwCurrentExLogs.length === 0 && (
                  <div style={{ marginTop: 10, fontSize: 13, color: D.dim, textAlign: "center" }}>
                    Last session: {rwLastSession.weight ? rwLastSession.weight + " lbs" : ""}{rwLastSession.reps ? " x " + rwLastSession.reps : ""}{rwLastSession.rpe ? " @ RPE " + rwLastSession.rpe : ""}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              color: D.muted, fontSize: 18,
            }}>No exercise</div>
          )}
        </div>

        {/* ─── Exercise Dots ─── */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 5,
          padding: "8px 12px",
          background: D.dark,
          borderTop: `1px solid ${D.border}`,
          flexWrap: "wrap",
        }}>
          {rwFlatExercises.map((_, idx) => (
            <button
              key={idx}
              onClick={() => rwGoTo(idx)}
              style={{
                width: idx === rwExIndex ? 20 : 8,
                height: 8,
                borderRadius: 4,
                border: "none",
                background: idx === rwExIndex ? D.accent : rwIsExLogged(rwFlatExercises[idx]?.exercise?.n) ? D.green : D.border,
                cursor: "pointer",
                transition: "width 0.2s",
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* ─── Exercise List Drawer Toggle ─── */}
        <button
          onClick={() => setRwShowDrawer(d => !d)}
          style={{
            width: "100%", background: D.dark, border: "none",
            borderTop: `1px solid ${D.border}`,
            color: D.muted, fontSize: 13, fontWeight: 600,
            padding: "10px 0", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          {rwShowDrawer ? "\u25BC Hide Exercises" : "\u25B2 All Exercises"}
        </button>

        {/* Exercise List Drawer */}
        {rwShowDrawer && (
          <div style={{
            maxHeight: 220, overflowY: "auto",
            background: D.dark, borderTop: `1px solid ${D.border}`,
            padding: "8px 0",
          }}>
            {rwFlatExercises.map((slot, idx) => {
              const logged = rwIsExLogged(slot.exercise?.n);
              const active = idx === rwExIndex;
              return (
                <button
                  key={idx}
                  onClick={() => { rwGoTo(idx); setRwShowDrawer(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    textAlign: "left", border: "none", cursor: "pointer",
                    background: active ? `${D.accent}22` : "transparent",
                    borderLeft: active ? `3px solid ${D.accent}` : "3px solid transparent",
                    padding: "10px 16px", fontSize: 14,
                    color: active ? D.accent : D.text,
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: logged ? `${D.green}22` : D.border,
                    color: logged ? D.green : D.dim,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, flexShrink: 0,
                  }}>
                    {logged ? "\u2713" : idx + 1}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {slot.exercise?.n || "Exercise"}
                  </span>
                  {slot.sets && slot.reps && (
                    <span style={{ fontSize: 12, color: D.dim, marginLeft: "auto", flexShrink: 0 }}>
                      {slot.sets}x{slot.reps}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Bottom: Finish Workout ─── */}
        <div style={{
          padding: "10px 16px", paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          background: D.dark,
          borderTop: `1px solid ${D.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <button
            onClick={rwHandleFinish}
            style={{
              background: D.accent, color: "#fff", border: "none",
              borderRadius: 14, padding: "16px 40px",
              fontSize: 17, fontWeight: 700, cursor: "pointer",
              minHeight: 56, width: "100%",
            }}
          >
            Finish Workout
          </button>
        </div>

        {/* Transition animation */}
        <style>{`
          @keyframes rwSlideIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  };

  /* ─────────── QUICK CHECK-IN ─────────── */
  const [checkInMsg, setCheckInMsg] = useState(null);

  // P5: reuse the single hf_attendance hook instance declared at the top of the component

  const isCheckedInForClass = (classId) => {
    const today = todayISO();
    return attendance.some(a => a.memberId === member?.id && (a.checkInTime || a.timestamp || a.date || "").slice(0, 10) === today && a.classId === classId && !a.noShow);
  };

  const isCheckedInToday = attendance.some(a => a.memberId === member?.id && (a.checkInTime || a.timestamp || a.date || "").slice(0, 10) === todayISO() && !a.noShow);

  const handleQuickCheckIn = (cls) => {
    if (isCheckedInForClass(cls?.id)) {
      setCheckInMsg("You're already checked in for this session!");
      setTimeout(() => setCheckInMsg(null), 2500);
      return;
    }
    setAttendance(prev => [...prev, {
      id: crypto.randomUUID(),
      memberId: member.id,
      checkInTime: new Date().toISOString(),
      method: "client-portal",
      classId: cls?.id || null,
    }]);
    setCheckInMsg("Checked in! Have a great workout! \uD83D\uDCAA");
    setTimeout(() => setCheckInMsg(null), 2500);
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  const ALL_TABS = [
    { key: "home", label: "Home", icon: "\uD83C\uDFE0" },
    { key: "dash", label: "Dash", icon: "\uD83D\uDCCA" },
    { key: "train", label: "Train", icon: "\uD83C\uDFCB\uFE0F" },
    { key: "progress", label: "Progress", icon: "\uD83D\uDCC8" },
    { key: "profile", label: "Profile", icon: "\uD83D\uDC64" },
  ];

  // Frozen members keep all tabs; booking is gated inside renderTrain (hidden unless holdEndDate)
  const FROZEN_TABS = new Set(["home", "dash", "train", "progress", "profile"]);
  const TABS = isFrozen ? ALL_TABS.filter(t => FROZEN_TABS.has(t.key)) : ALL_TABS;

  const frozenNotice = (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{"\u2744\uFE0F"}</div>
      <h3 style={{ color: B.text, fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Membership On Hold</h3>
      <p style={{ color: B.muted, fontSize: 14, lineHeight: 1.6 }}>This feature is paused while your membership is on hold. Contact your gym to reactivate.</p>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "home": return renderHome();
      case "dash": return isFrozen ? frozenNotice : renderDash();
      case "train": return renderTrain();
      case "progress": return renderProgress();
      case "profile": return renderProfile();
      default: return renderHome();
    }
  };

  if (memberLoading) {
    return (
      <div style={{ ...shell, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{"\uD83C\uDFCB\uFE0F"}</div>
          <h2 style={{ color: B.text, fontSize: 20, margin: "0 0 8px" }}>Loading your profile...</h2>
        </div>
      </div>
    );
  }

  if (memberMissing) {
    return (
      <div style={{ ...shell, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{"\uD83C\uDFCB\uFE0F"}</div>
          <h2 style={{ color: B.text, fontSize: 20, margin: "0 0 8px" }}>Profile not found</h2>
          <p style={{ color: B.muted, fontSize: 14 }}>Your member profile couldn't be loaded. Please sign out and back in.</p>
          <button onClick={logout} style={touchBtn(B.accent, B.darker, { marginTop: 20 })}>Sign Out</button>
        </div>
      </div>
    );
  }

  // P8: only hard-lock members whose membership is explicitly inactive/cancelled \u2014
  // plan-less active members (e.g. empty membershipPlanId) keep full portal access
  if (member && ["inactive", "cancelled"].includes(member.membershipStatus)) {
    return (
      <div style={{ ...shell, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", padding: 40, maxWidth: 400 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, margin: "0 auto 20px", background: B.accent + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
            {"\uD83D\uDD12"}
          </div>
          <h2 style={{ color: B.text, fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>
            Welcome, {member.firstName}!
          </h2>
          <p style={{ color: B.muted, fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>
            You don't have an active membership right now. Sign up for a plan to get full access to your workouts, booking, progress tracking, and more.
          </p>
          <p style={{ color: B.muted, fontSize: 13, margin: "0 0 24px" }}>
            Contact your gym to get started with a membership plan.
          </p>
          <button onClick={logout} style={touchBtn(B.accent, B.darker, { width: "100%" })}>Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      {/* Remote Workout Full-Screen Mode */}
      {remoteWorkoutMode && renderRemoteWorkoutMode()}

      {/* Course Viewer — minimal full-screen client course reader */}
      {courseViewerId && (() => {
        const closeCourse = () => { setCourseViewerId(null); setCourseLessonPath(null); };
        const course = (Array.isArray(courses) ? courses : []).find(c => c.id === courseViewerId);
        if (!course) {
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: B.darker, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{"🎓"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: B.text }}>Course not found</div>
                <p style={{ ...mutedText, marginTop: 6 }}>This course may have been removed by your coach.</p>
                <button onClick={closeCourse} style={touchBtn(B.accent, B.darker, { marginTop: 16 })}>Close</button>
              </div>
            </div>
          );
        }
        // Per-member completed lesson set (same matching as ClassroomView)
        const completedSet = new Set();
        (Array.isArray(courseProgress) ? courseProgress : [])
          .filter(p => p.courseId === course.id && (p.memberId || "admin") === myId)
          .forEach(p => (p.lessonIds || []).forEach(l => completedSet.add(l)));
        const modules = course.modules || [];
        const totalLessons = modules.reduce((s, m) => s + (m.lessons || []).filter(l => l.published).length, 0);
        const doneLessons = modules.reduce((s, m) => s + (m.lessons || []).filter(l => l.published && completedSet.has(l.id)).length, 0);
        const activeMod = courseLessonPath ? modules[courseLessonPath.moduleIdx] : null;
        const activeLesson = activeMod ? (activeMod.lessons || [])[courseLessonPath.lessonIdx] : null;
        const ytId = activeLesson ? getYTId(activeLesson.videoUrl) : null;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: B.darker, overflowY: "auto" }}>
            <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
              {/* Hero header */}
              <div style={{ background: `linear-gradient(150deg, ${B.accent} 0%, ${B.accent}77 100%)`, padding: "20px 20px 24px", position: "relative" }}>
                <button onClick={closeCourse} style={{
                  position: "absolute", top: 14, right: 14, background: "#ffffff2e",
                  border: "none", borderRadius: 16, color: "#fff", fontSize: 13, fontWeight: 800,
                  padding: "7px 14px", cursor: "pointer",
                }}>Close ✕</button>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#ffffffcc" }}>
                  {"🎓"} Course
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginTop: 6, paddingRight: 80 }}>
                  {course.title || "Untitled Course"}
                </div>
                <div style={{ fontSize: 13, color: "#ffffffdd", marginTop: 8 }}>
                  {doneLessons} / {totalLessons} lessons complete
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "#ffffff33", overflow: "hidden", marginTop: 8 }}>
                  <div style={{ height: "100%", width: `${totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0}%`, background: "#fff", borderRadius: 3, transition: "width .3s ease" }} />
                </div>
              </div>

              {!activeLesson ? (
                /* ── Module → lesson list ── */
                <div style={{ padding: 16 }}>
                  {course.description && (
                    <p style={{ ...mutedText, fontSize: 13, lineHeight: 1.5, margin: "0 0 14px" }}>{course.description}</p>
                  )}
                  {modules.map((mod, mi) => {
                    const pubLessons = (mod.lessons || []).filter(l => l.published);
                    const modDone = pubLessons.filter(l => completedSet.has(l.id)).length;
                    const allDone = pubLessons.length > 0 && modDone === pubLessons.length;
                    return (
                      <div key={mod.id || mi} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                        <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, background: B.darker + "66", borderBottom: pubLessons.length > 0 ? `1px solid ${B.border}` : "none" }}>
                          <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: B.text }}>{mod.title || `Module ${mi + 1}`}</div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? (B.green || "#22c55e") : B.muted }}>
                            {allDone ? "✓ " : ""}{modDone}/{pubLessons.length}
                          </span>
                        </div>
                        {pubLessons.length === 0 && (
                          <div style={{ padding: "10px 14px", fontSize: 12, color: B.dim }}>No lessons yet</div>
                        )}
                        {pubLessons.map(l => {
                          const li = (mod.lessons || []).indexOf(l);
                          const isDone = completedSet.has(l.id);
                          return (
                            <div key={l.id} onClick={() => setCourseLessonPath({ moduleIdx: mi, lessonIdx: li })} style={{
                              display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                              cursor: "pointer", borderTop: `1px solid ${B.border}40`,
                            }}>
                              <span style={{
                                width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                                background: isDone ? (B.green || "#22c55e") : "transparent",
                                border: isDone ? "none" : `2px solid ${B.dim}`,
                                color: "#fff", fontSize: 11, fontWeight: 900,
                                display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
                              }}>{isDone ? "✓" : ""}</span>
                              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: B.text }}>{l.title || "Untitled lesson"}</span>
                              <span style={{ color: B.dim, fontSize: 14 }}>{"›"}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  {modules.length === 0 && (
                    <div style={{ ...cardStyle, textAlign: "center", padding: "32px 20px" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{"📭"}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>No content yet</div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Lesson detail ── */
                <div style={{ padding: 16 }}>
                  <button onClick={() => setCourseLessonPath(null)} style={{
                    background: "none", border: "none", color: B.accent, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", padding: "4px 0", marginBottom: 8,
                  }}>{"←"} All lessons</button>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: B.text, margin: "0 0 14px", lineHeight: 1.3 }}>{activeLesson.title}</h2>

                  {/* Video (YouTube thumbnail — opens in new tab) */}
                  {ytId && (
                    <a href={`https://www.youtube.com/watch?v=${ytId}`} target="_blank" rel="noopener noreferrer" style={{
                      display: "block", position: "relative", borderRadius: 12, overflow: "hidden",
                      marginBottom: 16, background: "#000", textDecoration: "none",
                    }}>
                      <img src={getYTThumb(activeLesson.videoUrl)} alt={activeLesson.title} style={{ width: "100%", display: "block", opacity: 0.85 }} />
                      <div style={{
                        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{
                          width: 54, height: 54, borderRadius: 27, background: "rgba(0,0,0,0.6)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff",
                        }}>{"▶"}</div>
                      </div>
                    </a>
                  )}

                  {/* Content */}
                  {activeLesson.content && (
                    activeLesson.content.startsWith("<") ? (
                      <div style={{ fontSize: 14, lineHeight: 1.7, color: B.text, marginBottom: 20 }} dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
                    ) : (
                      <div style={{ fontSize: 14, lineHeight: 1.7, color: B.text, marginBottom: 20, whiteSpace: "pre-line" }}>
                        {activeLesson.content}
                      </div>
                    )
                  )}

                  {/* Resources */}
                  {(activeLesson.resources || []).length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: B.text, marginBottom: 8 }}>Resources</div>
                      {(activeLesson.resources || []).map((res, ri) => (
                        <a key={ri} href={res.url} target="_blank" rel="noopener noreferrer" style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10,
                          background: B.card, border: `1px solid ${B.border}`, color: B.accent, textDecoration: "none",
                          fontSize: 13, fontWeight: 600, marginBottom: 8,
                        }}>
                          <span style={{ fontSize: 16 }}>{"📄"}</span>
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{res.name || res.url}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Mark Lesson Complete */}
                  <button onClick={() => toggleLessonComplete(course.id, activeLesson.id)} style={touchBtn(
                    completedSet.has(activeLesson.id) ? (B.green || "#22c55e") : B.accent,
                    completedSet.has(activeLesson.id) ? "#fff" : B.darker,
                    { width: "100%", boxSizing: "border-box" }
                  )}>
                    {completedSet.has(activeLesson.id) ? "✓ Completed — tap to undo" : "Mark Lesson Complete"}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Doc task image overlay */}
      {docOverlay && (
        <div onClick={() => setDocOverlay(null)} style={{
          position: "fixed", inset: 0, zIndex: 4100, background: "rgba(0,0,0,0.92)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 10, textAlign: "center" }}>{docOverlay.name}</div>
          <img src={docOverlay.dataUrl} alt={docOverlay.name} onClick={e => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "78vh", borderRadius: 12 }} />
          <button onClick={() => setDocOverlay(null)} style={{
            marginTop: 14, background: "#ffffff2e", border: "none", borderRadius: 16,
            color: "#fff", fontSize: 13, fontWeight: 800, padding: "7px 16px", cursor: "pointer",
          }}>Close ✕</button>
        </div>
      )}

      {/* Progress Report Viewer — celebratory full-screen, opens from any tab */}
      {viewingReport && (() => {
        const r = viewingReport;
        const items = (v) => String(v || "").split("\n").map(t => t.trim()).filter(Boolean);
        const wins = items(r.wins);
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: B.darker, overflowY: "auto" }}>
            {/* Hero */}
            <div style={{
              background: `linear-gradient(150deg, ${B.accent} 0%, ${B.accent}77 100%)`,
              padding: "20px 20px 28px", position: "relative",
            }}>
              <button onClick={() => setViewingReport(null)} style={{
                position: "absolute", top: 14, right: 14, background: "#ffffff2e",
                border: "none", borderRadius: 16, color: "#fff", fontSize: 13, fontWeight: 800,
                padding: "7px 14px", cursor: "pointer",
              }}>Close ✕</button>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#ffffffcc" }}>
                Progress Report · {r.weekOf}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginTop: 6 }}>
                You showed up. {"💪"}
              </div>
              {wins.length > 0 && (
                <div style={{ fontSize: 14, color: "#fff", marginTop: 6, opacity: 0.95 }}>
                  <strong>{wins.length} win{wins.length === 1 ? "" : "s"}</strong> this week — momentum is building.
                </div>
              )}
            </div>
            <div style={{ padding: "16px 16px 32px" }}>
              {r.goal && (
                <div style={{ ...cardStyle, border: `2px dashed ${B.accent}`, marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", color: B.accent }}>{"🧭"} Your North Star</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: B.text, marginTop: 6, lineHeight: 1.4 }}>{r.goal}</div>
                </div>
              )}
              {items(r.targetReview).length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: B.text, marginBottom: 6 }}>{"📋"} Targets From Your Last Report</div>
                  {items(r.targetReview).map((t, i) => {
                    const border = t.startsWith("✅") ? B.accent : t.startsWith("❌") ? "#ef4444" : "#f59e0b";
                    return (
                      <div key={i} style={{
                        borderLeft: `4px solid ${border}`, background: B.dark, borderRadius: 10,
                        padding: "9px 12px", marginBottom: 6, fontSize: 13, color: B.text, lineHeight: 1.5,
                      }}>{t}</div>
                    );
                  })}
                </div>
              )}
              {wins.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: B.text, margin: "4px 0 8px" }}>{"🏆"} Your Wins</div>
                  {wins.map((w, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
                      background: B.accent + "14", borderLeft: `4px solid ${B.accent}`,
                      borderRadius: 12, padding: "12px 14px",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 14, background: B.accent, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 900, flexShrink: 0,
                      }}>✓</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: B.text, lineHeight: 1.4 }}>{w}</div>
                    </div>
                  ))}
                </div>
              )}
              {items(r.improvements).length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: B.text, marginBottom: 6 }}>{"🎯"} Where We Level Up Next</div>
                  {items(r.improvements).map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: 13, color: B.muted, lineHeight: 1.5 }}>
                      <span style={{ color: B.accent, fontWeight: 900 }}>{"›"}</span><span>{t}</span>
                    </div>
                  ))}
                </div>
              )}
              {items(r.actionSteps).length > 0 && (
                <div style={{ ...cardStyle, background: "#111", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{"🚀"} Your Mission</div>
                  {items(r.actionSteps).map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #ffffff1f" }}>
                      <div style={{ width: 18, height: 18, border: `2px solid ${B.accent}`, borderRadius: 5, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.4 }}>{t}</div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: B.accent, fontWeight: 700, marginTop: 8 }}>Check these off — review them with your coach in your next report.</div>
                </div>
              )}
              {r.notes && (
                <div style={{ ...cardStyle, marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", color: B.muted }}>{"💬"} From {r.coachName || "your coach"}</div>
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: B.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.notes}</p>
                </div>
              )}
              <p style={{ ...mutedText, textAlign: "center", padding: "4px 0 8px" }}>
                Proud of you. See you on the floor. {"🔥"}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Client Chat Modal */}
      {clientChatOpen && (() => {
        const convs = Array.isArray(messages) ? messages : [];
        const conv = convs.find(c => c.id === clientChatOpen);
        if (!conv) return null;
        const myMemberId = currentUser?.memberId;
        const chatMsgs = conv.messages || [];
        const sendClientMsg = (textOverride) => {
          const text = (typeof textOverride === "string" ? textOverride : clientChatText).trim();
          if (!text) return;
          const nowISO = new Date().toISOString();
          const msg = { id: crypto.randomUUID(), senderId: myMemberId, text, content: text, timestamp: nowISO, createdAt: nowISO, read: false };
          setMessages(prev => (Array.isArray(prev) ? prev : []).map(c => c.id === clientChatOpen ? { ...c, messages: [...(c.messages || []), msg], lastActivity: msg.timestamp } : c));
          setClientChatText("");
        };
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ background: B.card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid " + B.border }}>
              <button onClick={() => setClientChatOpen(null)} style={{ background: "none", border: "none", color: B.text, fontSize: 20, cursor: "pointer", padding: 4 }}>{"\u2190"}</button>
              <div style={{
                width: 32, height: 32, borderRadius: 16, flexShrink: 0, background: B.accent + "22",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: B.accent,
              }}>C</div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 16, color: B.text }}>Coach</div>
            </div>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, background: B.darker, display: "flex", flexDirection: "column", gap: 8 }}>
              {chatMsgs.map(msg => {
                const isMe = msg.senderId === myMemberId;
                return (
                  <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 6, alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 13, flexShrink: 0,
                      background: isMe
                        ? (member?.photo ? `url(${member.photo}) center/cover` : B.accent)
                        : B.accent + "22",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800, color: isMe ? "#fff" : B.accent,
                    }}>
                      {isMe ? (!member?.photo && (member?.firstName || "?").slice(0, 1)) : "C"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ padding: "10px 14px", borderRadius: 18, fontSize: 14, lineHeight: 1.4, background: isMe ? B.accent : B.card, color: isMe ? "#fff" : B.text, borderBottomRightRadius: isMe ? 4 : 18, borderBottomLeftRadius: isMe ? 18 : 4 }}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize: 10, color: B.dim, marginTop: 2, textAlign: isMe ? "right" : "left" }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Input */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: B.card, borderTop: "1px solid " + B.border }}>
              <input value={clientChatText} onChange={e => setClientChatText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendClientMsg(); }} placeholder="Aa" style={{ flex: 1, background: B.darker, border: "1px solid " + B.border, borderRadius: 20, padding: "10px 16px", color: B.text, fontSize: 14, outline: "none" }} />
              {clientChatText.trim() ? (
                <button onClick={() => sendClientMsg()} style={{ background: B.accent, color: "#fff", border: "none", borderRadius: "50%", width: 38, height: 38, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u27A4"}</button>
              ) : (
                <button onClick={() => sendClientMsg("\uD83D\uDC4D")} style={{ background: "none", border: "none", fontSize: 26, cursor: "pointer", color: B.accent }}>{"\uD83D\uDC4D"}</button>
              )}
            </div>
          </div>
        );
      })()}

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
                background: isActive ? B.accent + "1c" : "none",
                border: "none", cursor: "pointer", borderRadius: 18, margin: "0 2px",
                padding: "6px 0", minHeight: 44, position: "relative",
                transition: "transform 0.15s, background 0.15s",
                transform: isActive ? "scale(1.05)" : "scale(1)",
              }}
            >
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

              {/* Pending tasks badge on Dash */}
              {tab.key === "dash" && visibleTasks.length > 0 && (
                <div style={{
                  position: "absolute", top: 2, right: "calc(50% - 18px)",
                  width: 16, height: 16, borderRadius: 8,
                  background: "#ef4444", color: "#fff",
                  fontSize: 9, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {visibleTasks.length > 9 ? "9+" : visibleTasks.length}
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
