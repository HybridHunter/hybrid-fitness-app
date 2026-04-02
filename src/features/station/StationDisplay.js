import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useMembers } from "../../hooks/useMembers";
import { autoIndividualize } from "../../utils/autoIndividualize";
import { EX } from "../../data/exercises";
import { DEFAULT_MATRIX } from "../../data/movementMatrix";
import { getYTId, getYTThumb } from "../../utils/youtube";

// Dark theme constants (station always dark)
const B = {
  darker: "#080c12", dark: "#0d1117", card: "#161b22", border: "#21262d",
  text: "#e6edf3", muted: "#8b949e", dim: "#484f58", white: "#fff",
  accent: "#8fbf3b", red: "#ef4444", orange: "#f59e0b", green: "#22c55e",
  blue: "#3b82f6", purple: "#a855f7",
};

const PATTERNS = ["Squat","Hinge","Lunge","Push","Pull","Core","Carry"];
const SCORE_COLORS = {
  "-3": B.red, "-2": B.orange, "-1": B.orange,
  "0": B.dim, "1": B.green, "2": B.blue, "3": B.purple,
};

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Waiting Screen ────────────────────────────────────────────────────────
function WaitingScreen({ stationLabel }) {
  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      background: B.darker,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: `${B.accent}22`, color: B.accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, fontWeight: 800,
      }}>
        HF
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color: B.text }}>
        {stationLabel}
      </div>
      <div style={{
        fontSize: 20, color: B.muted,
        animation: "stationPulse 2s ease-in-out infinite",
      }}>
        Waiting for assignment...
      </div>
      <style>{`
        @keyframes stationPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── No Workout Screen ─────────────────────────────────────────────────────
function NoWorkoutScreen({ memberName, stationLabel }) {
  return (
    <div style={{
      height: "100vh", width: "100vw", background: B.darker,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 16,
    }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: B.text }}>{memberName}</div>
      <div style={{ fontSize: 20, color: B.muted }}>{stationLabel}</div>
      <div style={{ fontSize: 18, color: B.orange, marginTop: 16 }}>No workout assigned</div>
    </div>
  );
}

// ─── Completion Screen ──────────────────────────────────────────────────────
function CompletionScreen({ memberName, exerciseCount, totalWeight, elapsed, onBack }) {
  return (
    <div style={{
      height: "100vh", width: "100vw", background: B.darker,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 20,
    }}>
      <div style={{
        width: 100, height: 100, borderRadius: "50%",
        background: `${B.green}22`, color: B.green,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 52, animation: "popIn 0.5s ease-out",
      }}>
        &#10003;
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: B.text, marginTop: 8 }}>
        Great work, {memberName}!
      </div>
      <div style={{ display: "flex", gap: 32, marginTop: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: B.accent }}>{exerciseCount}</div>
          <div style={{ fontSize: 14, color: B.muted }}>Exercises</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: B.accent }}>
            {totalWeight > 0 ? `${totalWeight.toLocaleString()} lbs` : "--"}
          </div>
          <div style={{ fontSize: 14, color: B.muted }}>Total Weight Logged</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: B.accent }}>{formatTimer(elapsed)}</div>
          <div style={{ fontSize: 14, color: B.muted }}>Time</div>
        </div>
      </div>
      <button
        onClick={onBack}
        style={{
          marginTop: 32, background: B.accent, color: "#fff", border: "none",
          borderRadius: 12, padding: "16px 48px", fontSize: 18, fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Back to Waiting
      </button>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.3); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Video Overlay ──────────────────────────────────────────────────────────
function VideoOverlay({ url, onClose }) {
  const ytId = getYTId(url);
  if (!ytId) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "80vw", maxWidth: 900, aspectRatio: "16/9" }}>
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
          title="Exercise video"
          allow="autoplay; fullscreen"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: "none", borderRadius: 12 }}
        />
      </div>
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 20, right: 24,
          background: "none", border: "none", color: "#fff",
          fontSize: 36, cursor: "pointer",
        }}
      >
        &#10005;
      </button>
    </div>
  );
}

// ─── Main Station Display ───────────────────────────────────────────────────
export default function StationDisplay() {
  const { stationId } = useParams();
  const [stations, setStations] = useLocalStorage("hf_stations", []);
  const [allWorkouts] = useLocalStorage("hf_w", []);
  const [classes] = useLocalStorage("hf_schedule", []);
  const [matrix] = useLocalStorage("hf_matrix", DEFAULT_MATRIX);
  const [exercises] = useLocalStorage("hf_ex", [...EX]);
  const [workoutLogs, setWorkoutLogs] = useLocalStorage("hf_workout_logs", []);
  const { members } = useMembers();

  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCues, setShowCues] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [weightInput, setWeightInput] = useState("");
  const [finished, setFinished] = useState(false);

  const timerRef = useRef(null);
  const touchStartX = useRef(null);

  // Find current station
  const station = useMemo(
    () => stations.find(s => s.id === stationId) || null,
    [stations, stationId]
  );

  const stationLabel = station?.label || stationId || "Station";

  // Auto-refresh station data every 2 seconds (for waiting state)
  useEffect(() => {
    if (station?.memberId) return;
    const interval = setInterval(() => {
      try {
        const raw = localStorage.getItem("hf_stations");
        if (raw) {
          const parsed = JSON.parse(raw);
          const updated = parsed.find(s => s.id === stationId);
          if (updated?.memberId && !station?.memberId) {
            setStations(parsed);
          }
        }
      } catch (e) { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [stationId, station?.memberId, setStations]);

  // Member and workout
  const member = useMemo(
    () => (station?.memberId ? members.find(m => m.id === station.memberId) : null),
    [station?.memberId, members]
  );

  const rawWorkout = useMemo(
    () => (station?.workoutId ? allWorkouts.find(w => w.id === station.workoutId) : null),
    [station?.workoutId, allWorkouts]
  );

  const classInfo = useMemo(
    () => (station?.classId ? classes.find(c => c.id === station.classId) : null),
    [station?.classId, classes]
  );

  // Individualized workout
  const workout = useMemo(() => {
    if (!rawWorkout || !member) return rawWorkout;
    return autoIndividualize(rawWorkout, member.movementScores, matrix, exercises);
  }, [rawWorkout, member, matrix, exercises]);

  // Flatten exercises from all sections
  const flatExercises = useMemo(() => {
    if (!workout?.sections) return [];
    const result = [];
    workout.sections.forEach(sec => {
      (sec.slots || []).forEach(slot => {
        if (slot.exercise) {
          result.push({
            ...slot,
            sectionName: sec.name || sec.label || "",
          });
        }
      });
    });
    return result;
  }, [workout]);

  const currentSlot = flatExercises[currentExIndex] || null;
  const currentEx = currentSlot?.exercise || null;

  // Timer
  useEffect(() => {
    if (!member || !workout || finished) return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [member, workout, finished]);

  // Reset state when member changes
  useEffect(() => {
    if (member && workout) {
      setCurrentExIndex(0);
      setElapsed(0);
      setFinished(false);
      setShowSidebar(false);
      setShowCues(false);
    }
  }, [member?.id, workout?.id]);

  // Weight log for current exercise
  const lastLogged = useMemo(() => {
    if (!currentEx || !member) return null;
    const logs = workoutLogs.filter(
      l => l.memberId === member.id && l.exerciseName === currentEx.n
    );
    return logs.length > 0 ? logs[logs.length - 1] : null;
  }, [workoutLogs, currentEx, member]);

  // Check if exercise has been logged this session
  const isLogged = useCallback((exName) => {
    if (!member) return false;
    return workoutLogs.some(
      l => l.memberId === member.id && l.exerciseName === exName && l.stationId === stationId
    );
  }, [workoutLogs, member, stationId]);

  const logWeight = useCallback(() => {
    const w = parseFloat(weightInput);
    if (!w || !currentEx || !member) return;
    setWorkoutLogs(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        memberId: member.id,
        stationId,
        exerciseName: currentEx.n,
        weight: w,
        timestamp: new Date().toISOString(),
      },
    ]);
    setWeightInput("");
  }, [weightInput, currentEx, member, stationId, setWorkoutLogs]);

  const totalLoggedWeight = useMemo(() => {
    if (!member) return 0;
    return workoutLogs
      .filter(l => l.memberId === member.id && l.stationId === stationId)
      .reduce((sum, l) => sum + (l.weight || 0), 0);
  }, [workoutLogs, member, stationId]);

  // Navigation
  const goNext = useCallback(() => {
    if (currentExIndex < flatExercises.length - 1) {
      setCurrentExIndex(i => i + 1);
      setShowCues(false);
      setWeightInput("");
    }
  }, [currentExIndex, flatExercises.length]);

  const goPrev = useCallback(() => {
    if (currentExIndex > 0) {
      setCurrentExIndex(i => i - 1);
      setShowCues(false);
      setWeightInput("");
    }
  }, [currentExIndex]);

  const goTo = useCallback((idx) => {
    setCurrentExIndex(idx);
    setShowCues(false);
    setWeightInput("");
  }, []);

  // Swipe handling
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 60) {
      if (diff < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  }, [goNext, goPrev]);

  const handleFinish = useCallback(() => {
    clearInterval(timerRef.current);
    setFinished(true);
  }, []);

  const handleBackToWaiting = useCallback(() => {
    // Clear this station's assignment
    setStations(prev =>
      prev.map(s => s.id === stationId
        ? { ...s, memberId: null, classId: null, workoutId: null, active: false }
        : s
      )
    );
    setFinished(false);
    setElapsed(0);
    setCurrentExIndex(0);
  }, [stationId, setStations]);

  // ─── Render: Waiting ────────────────────────────────────────────────────
  if (!station || !station.memberId) {
    return <WaitingScreen stationLabel={stationLabel} />;
  }

  if (!member) {
    return <WaitingScreen stationLabel={stationLabel} />;
  }

  if (!workout) {
    return <NoWorkoutScreen memberName={`${member.firstName} ${member.lastName}`} stationLabel={stationLabel} />;
  }

  // ─── Render: Completed ──────────────────────────────────────────────────
  if (finished) {
    return (
      <CompletionScreen
        memberName={member.firstName}
        exerciseCount={flatExercises.length}
        totalWeight={totalLoggedWeight}
        elapsed={elapsed}
        onBack={handleBackToWaiting}
      />
    );
  }

  // ─── Render: Main Workout Display ───────────────────────────────────────
  const scoreForPattern = currentEx ? (member.movementScores?.[currentEx.p] ?? 0) : 0;
  const wasSwapped = currentSlot?._wasSwapped;
  const originalEx = currentSlot?._originalExercise;

  const levelLabel = scoreForPattern < 0
    ? `Modified (${scoreForPattern})`
    : scoreForPattern > 0
    ? `Advanced (+${scoreForPattern})`
    : "Standard";
  const levelColor = scoreForPattern < 0 ? B.orange : scoreForPattern > 0 ? B.green : B.dim;

  const cueSteps = currentEx?.c
    ? currentEx.c.split(/(?=\d+\.\s)/).filter(Boolean)
    : [];

  return (
    <div
      style={{
        height: "100vh", width: "100vw", background: B.darker,
        display: "flex", flexDirection: "column", overflow: "hidden",
        userSelect: "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Video overlay */}
      {videoUrl && <VideoOverlay url={videoUrl} onClose={() => setVideoUrl(null)} />}

      {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 60, minHeight: 60,
        background: B.dark,
        borderBottom: `1px solid ${B.border}`,
        display: "flex", alignItems: "center",
        padding: "0 20px",
        gap: 16,
      }}>
        {/* Left: Member */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: B.text }}>
            {member.firstName} {member.lastName}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            padding: "2px 8px", borderRadius: 6,
            background: `${levelColor}22`, color: levelColor,
          }}>
            Lvl {scoreForPattern > 0 ? "+" : ""}{scoreForPattern}
          </span>
        </div>

        {/* Center: Class + Station */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: B.muted }}>
            {classInfo?.name || ""}
          </div>
          <div style={{ fontSize: 12, color: B.dim }}>{stationLabel}</div>
        </div>

        {/* Right: Progress + Timer */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: B.muted }}>
            {currentExIndex + 1} of {flatExercises.length}
          </span>
          <span style={{
            fontSize: 18, fontWeight: 700, color: B.accent,
            fontFamily: "monospace",
          }}>
            {formatTimer(elapsed)}
          </span>
        </div>
      </div>

      {/* ─── Main Area ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
        {/* Sidebar toggle */}
        <button
          onClick={() => setShowSidebar(s => !s)}
          style={{
            position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
            zIndex: 20, background: B.card, border: `1px solid ${B.border}`,
            borderLeft: "none", borderRadius: "0 8px 8px 0",
            color: B.muted, fontSize: 18, padding: "12px 6px",
            cursor: "pointer",
          }}
        >
          {showSidebar ? "\u25C0" : "\u25B6"}
        </button>

        {/* ─── Exercise List Sidebar ─────────────────────────────────────── */}
        {showSidebar && (
          <div style={{
            width: 260, minWidth: 260,
            background: B.dark, borderRight: `1px solid ${B.border}`,
            overflowY: "auto", padding: "12px 0",
          }}>
            <div style={{ padding: "0 14px 10px", fontSize: 12, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 1 }}>
              Exercises
            </div>
            {flatExercises.map((slot, idx) => {
              const logged = isLogged(slot.exercise.n);
              const active = idx === currentExIndex;
              return (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    textAlign: "left", border: "none", cursor: "pointer",
                    background: active ? `${B.accent}22` : "transparent",
                    borderLeft: active ? `3px solid ${B.accent}` : "3px solid transparent",
                    padding: "10px 14px", fontSize: 14,
                    color: active ? B.accent : B.text,
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: logged ? `${B.green}22` : B.border,
                    color: logged ? B.green : B.dim,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, flexShrink: 0,
                  }}>
                    {logged ? "\u2713" : idx + 1}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {slot.exercise.n}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Current Exercise ──────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px 60px", position: "relative",
        }}>
          {/* Left arrow */}
          <button
            onClick={goPrev}
            disabled={currentExIndex === 0}
            style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              width: 64, height: 64, borderRadius: 16,
              background: currentExIndex === 0 ? B.border : B.card,
              border: `1px solid ${B.border}`,
              color: currentExIndex === 0 ? B.dim : B.text,
              fontSize: 28, cursor: currentExIndex === 0 ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 10,
            }}
          >
            &#9664;
          </button>

          {/* Right arrow */}
          <button
            onClick={goNext}
            disabled={currentExIndex >= flatExercises.length - 1}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              width: 64, height: 64, borderRadius: 16,
              background: currentExIndex >= flatExercises.length - 1 ? B.border : B.card,
              border: `1px solid ${B.border}`,
              color: currentExIndex >= flatExercises.length - 1 ? B.dim : B.text,
              fontSize: 28, cursor: currentExIndex >= flatExercises.length - 1 ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 10,
            }}
          >
            &#9654;
          </button>

          {currentEx ? (
            <div style={{
              maxWidth: 800, width: "100%",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            }}>
              {/* Exercise name */}
              <h1 style={{ fontSize: 36, fontWeight: 800, color: B.text, margin: 0, textAlign: "center" }}>
                {currentEx.n}
              </h1>

              {/* Movement level badge + swap info */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{
                  padding: "4px 14px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                  background: `${levelColor}22`, color: levelColor,
                }}>
                  {levelLabel}
                </span>
                {currentEx.p && (
                  <span style={{ fontSize: 13, color: B.muted }}>{currentEx.p}</span>
                )}
              </div>
              {wasSwapped && originalEx && (
                <div style={{ fontSize: 13, color: B.dim }}>
                  Template: {originalEx.n}
                </div>
              )}

              {/* GIF or Video thumbnail */}
              {currentEx.g ? (
                <div style={{ width: 360, maxWidth: "100%", borderRadius: 12, overflow: "hidden", border: `2px solid ${B.border}` }}>
                  <img src={currentEx.g} alt={currentEx.n} style={{ width: "100%", display: "block", borderRadius: 10 }} />
                </div>
              ) : currentEx.u ? (
                <div
                  onClick={() => setVideoUrl(currentEx.u)}
                  style={{
                    width: 360, maxWidth: "100%", aspectRatio: "16/9",
                    borderRadius: 12, overflow: "hidden", cursor: "pointer",
                    position: "relative", border: `2px solid ${B.border}`,
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
                      width: 56, height: 56, borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 24,
                    }}>
                      &#9654;
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Prescription row */}
              <div style={{
                display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center",
                fontSize: 20, fontWeight: 600, color: B.text,
              }}>
                {currentSlot.sets && (
                  <span>{currentSlot.sets} <span style={{ color: B.muted, fontWeight: 400 }}>sets</span></span>
                )}
                {currentSlot.reps && (
                  <span>{currentSlot.reps} <span style={{ color: B.muted, fontWeight: 400 }}>reps</span></span>
                )}
                {currentSlot.rpe && (
                  <span>RPE {currentSlot.rpe}</span>
                )}
                {currentSlot.tempo && (
                  <span style={{ color: B.muted }}>Tempo: {currentSlot.tempo}</span>
                )}
              </div>

              {/* Coaching cues */}
              <button
                onClick={() => setShowCues(c => !c)}
                style={{
                  background: "none", border: `1px solid ${B.border}`,
                  borderRadius: 8, padding: "8px 20px",
                  color: B.muted, fontSize: 14, cursor: "pointer",
                }}
              >
                {showCues ? "Hide Coaching Cues" : "Show Coaching Cues"}
              </button>
              {showCues && cueSteps.length > 0 && (
                <div style={{
                  background: B.card, borderRadius: 12, padding: 16,
                  width: "100%", maxWidth: 600, border: `1px solid ${B.border}`,
                }}>
                  {cueSteps.map((step, i) => (
                    <p key={i} style={{ fontSize: 16, color: B.text, margin: "6px 0", lineHeight: 1.5 }}>
                      {step.trim()}
                    </p>
                  ))}
                </div>
              )}

              {/* Weight log input */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                marginTop: 4,
              }}>
                <input
                  type="number"
                  placeholder="Weight (lbs)"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && logWeight()}
                  style={{
                    width: 160, padding: "14px 16px", fontSize: 20, fontWeight: 600,
                    background: B.dark, color: B.text,
                    border: `2px solid ${B.border}`, borderRadius: 12,
                    textAlign: "center", outline: "none",
                  }}
                />
                <button
                  onClick={logWeight}
                  style={{
                    background: B.accent, color: "#fff", border: "none",
                    borderRadius: 12, padding: "14px 28px",
                    fontSize: 18, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Log
                </button>
              </div>
              {lastLogged && (
                <div style={{ fontSize: 14, color: B.dim }}>
                  Last time: {lastLogged.weight} lbs
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: B.muted, fontSize: 20 }}>No exercise</div>
          )}
        </div>
      </div>

      {/* ─── Exercise Dots ───────────────────────────────────────────────── */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 6,
        padding: "8px 0",
        background: B.dark,
        borderTop: `1px solid ${B.border}`,
      }}>
        {flatExercises.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            style={{
              width: idx === currentExIndex ? 24 : 10,
              height: 10,
              borderRadius: 5,
              border: "none",
              background: idx === currentExIndex ? B.accent : B.border,
              cursor: "pointer",
              transition: "width 0.2s",
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* ─── Bottom Bar ──────────────────────────────────────────────────── */}
      <div style={{
        height: 64, minHeight: 64,
        background: B.dark,
        borderTop: `1px solid ${B.border}`,
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: B.muted, fontFamily: "monospace" }}>
          {formatTimer(elapsed)}
        </span>
        <button
          onClick={handleFinish}
          style={{
            background: B.accent, color: "#fff", border: "none",
            borderRadius: 12, padding: "14px 40px",
            fontSize: 18, fontWeight: 700, cursor: "pointer",
          }}
        >
          Finish Workout
        </button>
      </div>
    </div>
  );
}
