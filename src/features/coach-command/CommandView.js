import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { PATS, PC } from "../../data/constants";
import { EX } from "../../data/exercises";
import { DEFAULT_MATRIX } from "../../data/movementMatrix";
import { autoIndividualize } from "../../utils/autoIndividualize";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

/* ---------- helpers ---------- */
// ScheduleView uses Mon=0 … Sun=6; JS getDay() uses Sun=0 … Sat=6
const SCHED_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const jsDayToSchedDay = (jsDay) => (jsDay === 0 ? 6 : jsDay - 1); // Sun(0)->6, Mon(1)->0, etc.
const todaySchedIdx = () => jsDayToSchedDay(new Date().getDay());
const todayISO = () => new Date().toISOString().slice(0, 10);
const initials = (m) => (m.firstName?.[0] || "") + (m.lastName?.[0] || "");

/** Parse "HH:MM" to minutes since midnight */
function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Current time in minutes since midnight */
function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function scoreColor(score, B) {
  if (score >= 2) return B.green;
  if (score === 1) return "#66bb6a";
  if (score === 0) return B.muted;
  if (score === -1) return B.orange;
  return B.red;
}

function levelColor(score, B) {
  if (score >= 1) return B.green;
  if (score === 0) return "#f9a825"; // yellow
  return B.red;
}

function scoreLabel(score) {
  if (score > 0) return { text: `+${score} Advanced`, color: "green" };
  if (score < 0) return { text: `${score} Regressed`, color: "orange" };
  return { text: "Base", color: "muted" };
}

/** Convert a saved workout (string exercise names) to object-based exercises */
function hydrateWorkout(workout, exByName) {
  if (!workout) return null;
  if (!workout.sections) {
    // if flat slots, wrap in a single section
    const slots = workout.slots || [];
    return {
      ...workout,
      sections: [{ id: "flat", label: "Main", slots: slots.map(s => ({
        ...s,
        exercise: s.exercise ? (exByName[s.exercise] || { n: s.exercise, p: "Accessory" }) : null,
      })) }],
    };
  }
  return {
    ...workout,
    sections: workout.sections.map(sec => ({
      ...sec,
      slots: (sec.slots || []).map(s => ({
        ...s,
        exercise: s.exercise
          ? (typeof s.exercise === "string"
              ? (exByName[s.exercise] || { n: s.exercise, p: "Accessory" })
              : s.exercise)
          : null,
      })),
    })),
  };
}

const TIMER_OPTIONS = [
  { label: "30s", seconds: 30 },
  { label: "45s", seconds: 45 },
  { label: "60s", seconds: 60 },
  { label: "90s", seconds: 90 },
  { label: "2min", seconds: 120 },
  { label: "3min", seconds: 180 },
];

/* ---------- Timer component ---------- */
function TimerBar({ B }) {
  const [selected, setSelected] = useState(60);
  const [remaining, setRemaining] = useState(null);
  const [running, setRunning] = useState(false);
  const interval = useRef(null);

  const start = useCallback(() => {
    setRemaining(selected);
    setRunning(true);
  }, [selected]);

  const stop = useCallback(() => {
    setRunning(false);
    setRemaining(null);
    if (interval.current) clearInterval(interval.current);
  }, []);

  useEffect(() => {
    if (!running) return;
    interval.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { setRunning(false); clearInterval(interval.current); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval.current);
  }, [running]);

  const fmt = (s) => {
    if (s === null) return "--:--";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const pct = remaining !== null ? (remaining / selected) * 100 : 100;

  return (
    <div style={{ background: B.darker, borderTop: "1px solid " + B.border, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 6 }}>
        {TIMER_OPTIONS.map((t) => (
          <button key={t.seconds} onClick={() => { if (!running) setSelected(t.seconds); }}
            style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid " + (selected === t.seconds ? B.accent : B.border),
              background: selected === t.seconds ? B.accent + "20" : "transparent",
              color: selected === t.seconds ? B.accent : B.muted, fontSize: 12, fontWeight: 700, cursor: running ? "default" : "pointer",
              opacity: running ? 0.5 : 1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, height: 8, background: B.card, borderRadius: 4, overflow: "hidden", minWidth: 120 }}>
        <div style={{
          width: pct + "%", height: "100%", borderRadius: 4, transition: "width 1s linear",
          background: remaining !== null && remaining <= 5 ? B.red : B.accent,
        }} />
      </div>

      <div style={{
        fontSize: 32, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: remaining === 0 ? B.red : B.text,
        minWidth: 90, textAlign: "center",
        animation: remaining === 0 ? "none" : undefined,
      }}>
        {fmt(remaining)}
      </div>

      {!running ? (
        <Button onClick={start} style={{ padding: "10px 24px", fontSize: 14 }}>Start Timer</Button>
      ) : (
        <Button onClick={stop} variant="danger" style={{ padding: "10px 24px", fontSize: 14 }}>Stop</Button>
      )}
    </div>
  );
}

/* ---------- Pulsing Dot (CSS-in-JS keyframes injected once) ---------- */
const PULSE_INJECTED = { current: false };
function injectPulseKeyframes() {
  if (PULSE_INJECTED.current) return;
  PULSE_INJECTED.current = true;
  const style = document.createElement("style");
  style.textContent = `@keyframes cv-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`;
  document.head.appendChild(style);
}

/* ---------- Client Workout Card ---------- */
function ClientWorkoutCard({ member, individualizedSlots, B, onAdjust, checkedIn }) {
  const ms = member.movementScores || {};

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {/* header */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid " + B.border }}>
        <div style={{
          width: 40, height: 40, borderRadius: 20, background: B.accent + "25", color: B.accent,
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0,
        }}>
          {initials(member)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: B.text }}>{member.firstName} {member.lastName}</span>
            {checkedIn && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
                borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: "#4caf5022", color: "#4caf50",
              }}>
                &#10003; Checked In
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: B.muted }}>{member.membershipStatus === "active" ? "" : "(" + member.membershipStatus + ")"}</div>
        </div>
      </div>

      {/* movement score badges */}
      <div style={{ padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 4, borderBottom: "1px solid " + B.border }}>
        {PATS.filter((p) => p !== "All").map((pat) => {
          const s = ms[pat] ?? 0;
          return (
            <span key={pat} style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
              borderRadius: 4, fontSize: 10, fontWeight: 700, background: scoreColor(s, B) + "18", color: scoreColor(s, B),
            }}>
              {pat} {s >= 0 ? "+" : ""}{s}
            </span>
          );
        })}
      </div>

      {/* exercises */}
      <div style={{ padding: "8px 0" }}>
        {individualizedSlots.map((slot, i) => {
          if (!slot.exercise) return null;
          const ex = slot.exercise; // already an object { n, p, ... }
          const pattern = ex.p;
          const score = slot._memberScore ?? (ms[pattern] ?? 0);
          const wasSwapped = slot._wasSwapped;
          const originalEx = slot._originalExercise;
          const patColor = PC[pattern] || B.accent;
          const lvlColor = levelColor(score, B);

          return (
            <div key={i} style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: i < individualizedSlots.length - 1 ? "1px solid " + B.border + "40" : "none" }}>
              {/* pattern pip */}
              <div style={{ width: 4, height: 32, borderRadius: 2, background: patColor, flexShrink: 0 }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: B.text }}>{ex.n}</span>
                  {/* colored level indicator */}
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4,
                    background: lvlColor + "20",
                    color: lvlColor,
                    minWidth: 28, textAlign: "center",
                  }}>
                    {score >= 0 ? "+" : ""}{score}
                  </span>
                </div>
                {/* show original exercise if swapped */}
                {wasSwapped && originalEx && (
                  <div style={{
                    fontSize: 11, color: B.dim, marginTop: 2,
                    textDecoration: "line-through", opacity: 0.6,
                  }}>
                    Template: {originalEx.n}
                  </div>
                )}
                <div style={{ fontSize: 11, color: B.dim, marginTop: 2 }}>
                  {[slot.sets && `${slot.sets} sets`, slot.reps && `${slot.reps} reps`, slot.rpe && `RPE ${slot.rpe}`, slot.tempo && `Tempo ${slot.tempo}`].filter(Boolean).join(" / ") || "No prescription set"}
                </div>
              </div>

              {/* quick adjust */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => onAdjust(member.id, pattern, -1)}
                  style={{
                    width: 26, height: 26, borderRadius: 6, border: "1px solid " + B.border, background: B.darker,
                    color: B.orange, fontWeight: 900, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>-</button>
                <button onClick={() => onAdjust(member.id, pattern, 1)}
                  style={{
                    width: 26, height: 26, borderRadius: 6, border: "1px solid " + B.border, background: B.darker,
                    color: B.green, fontWeight: 900, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>+</button>
              </div>
            </div>
          );
        })}

        {individualizedSlots.every((s) => !s.exercise) && (
          <div style={{ padding: "24px 16px", textAlign: "center", color: B.dim, fontSize: 13 }}>No exercises in selected template</div>
        )}
      </div>
    </Card>
  );
}

/* ---------- Live Session Stats Bar ---------- */
function SessionStatsBar({ B, checkedInCount, totalBooked, className, classTime, workoutName, isLive }) {
  useEffect(() => { injectPulseKeyframes(); }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      padding: "12px 16px", marginBottom: 16, borderRadius: 10,
      background: B.card, border: "1px solid " + B.border,
    }}>
      {/* live dot + class name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isLive && (
          <span style={{
            width: 10, height: 10, borderRadius: "50%", background: "#4caf50", display: "inline-block",
            animation: "cv-pulse 1.5s ease-in-out infinite",
          }} />
        )}
        <span style={{ fontWeight: 700, fontSize: 14, color: B.text }}>{className}</span>
        {classTime && <span style={{ fontSize: 12, color: B.muted }}>{classTime}</span>}
      </div>

      {/* separator */}
      <span style={{ width: 1, height: 20, background: B.border, flexShrink: 0 }} />

      {/* checked in count */}
      <span style={{
        padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
        background: "#4caf5018", color: "#4caf50",
      }}>
        {checkedInCount} of {totalBooked} checked in
      </span>

      {/* separator */}
      <span style={{ width: 1, height: 20, background: B.border, flexShrink: 0 }} />

      {/* workout name */}
      {workoutName && (
        <span style={{
          padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
          background: B.accent + "15", color: B.accent,
        }}>
          {workoutName}
        </span>
      )}
    </div>
  );
}

/* ---------- Main CommandView ---------- */
export default function CommandView() {
  const B = useTheme();
  const { members, updateMember } = useMembers();
  const [schedule] = useLocalStorage("hf_schedule", []);
  const [workouts] = useLocalStorage("hf_w", []);
  const [matrix] = useLocalStorage("hf_matrix", DEFAULT_MATRIX);
  const [exercises] = useLocalStorage("hf_ex", EX);
  const [attendance] = useLocalStorage("hf_attendance", []);

  const [sessionMode, setSessionMode] = useState("custom"); // class id or "custom"
  const [customSelected, setCustomSelected] = useState([]);
  const [selectedWorkoutIdx, setSelectedWorkoutIdx] = useState(0);
  const [showCheckedInOnly, setShowCheckedInOnly] = useState(false);
  const [autoSelectDone, setAutoSelectDone] = useState(false);

  // today's classes — match dayOfWeek to today's schedule index
  const todayClasses = useMemo(() =>
    schedule.filter((c) => c.dayOfWeek === todaySchedIdx()),
  [schedule]);

  // --- Auto-select current/upcoming class on mount ---
  useEffect(() => {
    if (autoSelectDone || todayClasses.length === 0) return;
    setAutoSelectDone(true);
    const now = nowMinutes();
    // Find a class currently in session
    let best = todayClasses.find(c =>
      timeToMinutes(c.startTime) <= now && timeToMinutes(c.endTime) > now
    );
    // Or starting within the next 30 minutes
    if (!best) {
      best = todayClasses
        .filter(c => {
          const start = timeToMinutes(c.startTime);
          return start > now && start <= now + 30;
        })
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))[0];
    }
    if (best) {
      setSessionMode(best.id);
    }
  }, [todayClasses, autoSelectDone]);

  // --- Auto-load workout template when class changes ---
  useEffect(() => {
    if (sessionMode === "custom") return;
    const cls = schedule.find((c) => c.id === sessionMode);
    if (!cls || !cls.workoutId) return;
    const idx = workouts.findIndex((w) => w.id === cls.workoutId);
    if (idx >= 0) {
      setSelectedWorkoutIdx(idx);
    }
  }, [sessionMode, schedule, workouts]);

  // today's attendance lookup: Set of member IDs who checked in today
  const todayCheckedInIds = useMemo(() => {
    const iso = todayISO();
    const ids = new Set();
    attendance.forEach((a) => {
      if (a.checkInTime && a.checkInTime.slice(0, 10) === iso) {
        ids.add(a.memberId);
      }
    });
    return ids;
  }, [attendance]);

  // selected members
  const sessionMembers = useMemo(() => {
    if (sessionMode === "custom") {
      return members.filter((m) => customSelected.includes(m.id));
    }
    const cls = schedule.find((c) => c.id === sessionMode);
    if (!cls) return [];
    const ids = cls.bookings || cls.memberIds || cls.members || [];
    return members.filter((m) => ids.includes(m.id));
  }, [sessionMode, members, customSelected, schedule]);

  // filtered members (checked-in toggle)
  const displayMembers = useMemo(() => {
    if (!showCheckedInOnly) return sessionMembers;
    return sessionMembers.filter((m) => todayCheckedInIds.has(m.id));
  }, [sessionMembers, showCheckedInOnly, todayCheckedInIds]);

  // checked-in count within this session
  const checkedInCount = useMemo(() =>
    sessionMembers.filter((m) => todayCheckedInIds.has(m.id)).length,
  [sessionMembers, todayCheckedInIds]);

  // is the selected class currently live?
  const selectedClass = sessionMode !== "custom" ? schedule.find((c) => c.id === sessionMode) : null;
  const isLive = useMemo(() => {
    if (!selectedClass) return false;
    const now = nowMinutes();
    return timeToMinutes(selectedClass.startTime) <= now && timeToMinutes(selectedClass.endTime) > now;
  }, [selectedClass]);

  // exercise lookup map
  const exByName = useMemo(() => {
    const map = {};
    exercises.forEach(ex => { map[ex.n] = ex; });
    return map;
  }, [exercises]);

  // workout template (hydrated with exercise objects)
  const workout = workouts[selectedWorkoutIdx] || null;
  const hydratedWorkout = useMemo(() => hydrateWorkout(workout, exByName), [workout, exByName]);

  // flatten all slots from the hydrated workout (for display when no individualization)
  const allSlots = useMemo(() => {
    if (!hydratedWorkout) return [];
    if (hydratedWorkout.sections) {
      return hydratedWorkout.sections.flatMap((sec) => sec.slots || []);
    }
    return [];
  }, [hydratedWorkout]);

  // per-member individualized slots
  const memberIndividualizedSlots = useMemo(() => {
    const result = {};
    sessionMembers.forEach(m => {
      if (!hydratedWorkout) { result[m.id] = []; return; }
      const individualized = autoIndividualize(hydratedWorkout, m.movementScores || {}, matrix, exercises);
      if (individualized && individualized.sections) {
        result[m.id] = individualized.sections.flatMap(sec => sec.slots || []);
      } else {
        result[m.id] = allSlots;
      }
    });
    return result;
  }, [sessionMembers, hydratedWorkout, matrix, exercises, allSlots]);

  // adjust score handler
  const handleAdjust = useCallback((memberId, pattern, delta) => {
    const m = members.find((x) => x.id === memberId);
    if (!m) return;
    const current = m.movementScores?.[pattern] ?? 0;
    const next = Math.max(-3, Math.min(3, current + delta));
    updateMember(memberId, { movementScores: { ...m.movementScores, [pattern]: next } });
  }, [members, updateMember]);

  // toggle custom member
  const toggleMember = (id) => {
    setCustomSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const activeMembers = members.filter((m) => m.membershipStatus !== "inactive");

  // Format class time for display
  const fmtTime = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: 0 }}>Session View</h1>
        <p style={{ color: B.muted, fontSize: 13, margin: "4px 0 0" }}>See every client's individualized workout in one session view.</p>
      </div>

      {/* CONTROLS BAR */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        {/* session selector */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: B.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Session</label>
          <select value={sessionMode} onChange={(e) => setSessionMode(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + B.border,
              background: B.card, color: B.text, fontSize: 13, fontWeight: 600, outline: "none",
            }}>
            <option value="custom">Custom Session</option>
            {todayClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.title || "Session"} ({fmtTime(c.startTime)} - {fmtTime(c.endTime)})</option>
            ))}
          </select>
        </div>

        {/* workout template selector */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: B.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Workout Template</label>
          <select value={selectedWorkoutIdx} onChange={(e) => setSelectedWorkoutIdx(Number(e.target.value))}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + B.border,
              background: B.card, color: B.text, fontSize: 13, fontWeight: 600, outline: "none",
            }}>
            {workouts.length === 0 && <option value={0}>No templates saved</option>}
            {workouts.map((w, i) => (
              <option key={i} value={i}>{w.name || w.title || `Workout ${i + 1}`}</option>
            ))}
          </select>
        </div>

        {/* checked-in filter toggle */}
        {sessionMode !== "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 6 }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12,
              fontWeight: 600, color: showCheckedInOnly ? "#4caf50" : B.muted, userSelect: "none",
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 4, border: "2px solid " + (showCheckedInOnly ? "#4caf50" : B.dim),
                background: showCheckedInOnly ? "#4caf50" : "transparent",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "#fff", fontWeight: 900, transition: "all .15s",
              }}>
                {showCheckedInOnly ? "\u2713" : ""}
              </span>
              Checked-in only
            </label>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 2 }}>
          <span style={{
            padding: "6px 14px", borderRadius: 8, background: B.accent + "15", color: B.accent,
            fontSize: 13, fontWeight: 700,
          }}>
            {displayMembers.length} client{displayMembers.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* CUSTOM SESSION MEMBER PICKER */}
      {sessionMode === "custom" && (
        <Card style={{ marginBottom: 16, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Select Clients</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {activeMembers.map((m) => {
              const sel = customSelected.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggleMember(m.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
                    border: "1px solid " + (sel ? B.accent : B.border), background: sel ? B.accent + "15" : "transparent",
                    color: sel ? B.accent : B.muted, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, border: "2px solid " + (sel ? B.accent : B.dim),
                    background: sel ? B.accent : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#fff", fontWeight: 900,
                  }}>
                    {sel ? "\u2713" : ""}
                  </span>
                  {m.firstName} {m.lastName}
                </button>
              );
            })}
            {activeMembers.length === 0 && <span style={{ color: B.dim, fontSize: 13 }}>No active clients found</span>}
          </div>
        </Card>
      )}

      {/* LIVE SESSION STATS BAR (only for class sessions) */}
      {sessionMode !== "custom" && selectedClass && (
        <SessionStatsBar
          B={B}
          checkedInCount={checkedInCount}
          totalBooked={sessionMembers.length}
          className={selectedClass.name || selectedClass.title || "Session"}
          classTime={`${fmtTime(selectedClass.startTime)} - ${fmtTime(selectedClass.endTime)}`}
          workoutName={workout?.name || workout?.title || (workouts.length === 0 ? "No template" : null)}
          isLive={isLive}
        />
      )}

      {/* MAIN GRID */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 16 }}>
        {displayMembers.length === 0 ? (
          <Card style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>&#9776;</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: B.muted, marginBottom: 6 }}>
              {showCheckedInOnly && sessionMembers.length > 0 ? "No checked-in clients" : "No clients selected"}
            </div>
            <div style={{ fontSize: 13, color: B.dim }}>
              {showCheckedInOnly && sessionMembers.length > 0
                ? `${sessionMembers.length} client${sessionMembers.length !== 1 ? "s" : ""} booked but none have checked in yet.`
                : sessionMode === "custom" ? "Pick clients above to build your session." : "This session has no clients assigned."}
            </div>
          </Card>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 16,
          }}>
            {displayMembers.map((m) => (
              <ClientWorkoutCard
                key={m.id}
                member={m}
                individualizedSlots={memberIndividualizedSlots[m.id] || allSlots}
                B={B}
                onAdjust={handleAdjust}
                checkedIn={todayCheckedInIds.has(m.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* TIMER BAR */}
      <TimerBar B={B} />
    </div>
  );
}
