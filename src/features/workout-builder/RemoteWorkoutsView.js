import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";

const uid = () => crypto.randomUUID();

const STATUS_COLORS = {
  active: { bg: "#4ade8022", color: "#4ade80" },
  completed: { bg: "#3b82f622", color: "#3b82f6" },
  cancelled: { bg: "#ef444422", color: "#ef4444" },
};

const getInitials = (name) => {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const daysBetween = (a, b) => {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.round((db - da) / 86400000) + 1;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function RemoteWorkoutsView() {
  const B = useTheme();
  const { members } = useMembers();
  const [workouts] = useLocalStorage("hf_w", []);
  const [remoteWorkouts, setRemoteWorkouts] = useLocalStorage("hf_remote_workouts", []);
  const [showAssign, setShowAssign] = useState(false);
  const [filter, setFilter] = useState("all");
  const [detailId, setDetailId] = useState(null);

  // Assign modal state
  const [assignMemberId, setAssignMemberId] = useState("");
  const [assignType, setAssignType] = useState("template"); // template | custom
  const [assignWorkoutId, setAssignWorkoutId] = useState("");
  const [customExercises, setCustomExercises] = useState([{ name: "", sets: "", reps: "", notes: "" }]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [coachNotes, setCoachNotes] = useState("");

  // Edit modal state
  const [editId, setEditId] = useState(null);

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${B.border}`, background: B.dark, color: B.text, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const btnPrimary = { padding: "8px 18px", borderRadius: 8, border: "none", background: B.green, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" };
  const btnSecondary = { padding: "8px 18px", borderRadius: 8, border: `1px solid ${B.border}`, background: "transparent", color: B.text, fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnDanger = { padding: "6px 14px", borderRadius: 8, border: "none", background: B.red || "#ef4444", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" };

  const filtered = useMemo(() => {
    if (filter === "all") return remoteWorkouts;
    return remoteWorkouts.filter(r => r.status === filter);
  }, [remoteWorkouts, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const order = { active: 0, completed: 1, cancelled: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [filtered]);

  function resetForm() {
    setAssignMemberId("");
    setAssignType("template");
    setAssignWorkoutId("");
    setCustomExercises([{ name: "", sets: "", reps: "", notes: "" }]);
    setStartDate("");
    setEndDate("");
    setCoachNotes("");
  }

  function handleAssign() {
    if (!assignMemberId || !startDate || !endDate) return;
    if (assignType === "template" && !assignWorkoutId) return;
    if (assignType === "custom" && customExercises.every(e => !e.name.trim())) return;

    const member = members.find(m => m.id === assignMemberId);
    const workout = assignType === "template" ? workouts.find(w => String(w.id) === String(assignWorkoutId)) : null;

    const newRemote = {
      id: uid(),
      memberId: assignMemberId,
      memberName: member ? `${member.firstName} ${member.lastName}`.trim() : "Unknown",
      workoutId: assignType === "template" ? assignWorkoutId : null,
      workoutName: workout ? workout.name : "Custom Workout",
      customExercises: assignType === "custom" ? customExercises.filter(e => e.name.trim()) : null,
      startDate,
      endDate,
      coachNotes,
      status: "active",
      createdAt: new Date().toISOString(),
      completions: [],
    };

    setRemoteWorkouts(prev => [...prev, newRemote]);
    setShowAssign(false);
    resetForm();
  }

  function cancelWorkout(id) {
    setRemoteWorkouts(prev => prev.map(r => r.id === id ? { ...r, status: "cancelled" } : r));
    setDetailId(null);
  }

  function completeWorkout(id) {
    setRemoteWorkouts(prev => prev.map(r => r.id === id ? { ...r, status: "completed" } : r));
    setDetailId(null);
  }

  function deleteWorkout(id) {
    setRemoteWorkouts(prev => prev.filter(r => r.id !== id));
    setDetailId(null);
  }

  function addExerciseRow() {
    setCustomExercises(prev => [...prev, { name: "", sets: "", reps: "", notes: "" }]);
  }

  function removeExerciseRow(idx) {
    setCustomExercises(prev => prev.filter((_, i) => i !== idx));
  }

  function updateExercise(idx, field, val) {
    setCustomExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  }

  // Detail view
  const detailItem = detailId ? remoteWorkouts.find(r => r.id === detailId) : null;

  /* ──── DETAIL VIEW ──── */
  if (detailItem) {
    const sc = STATUS_COLORS[detailItem.status] || STATUS_COLORS.active;
    const totalDays = daysBetween(detailItem.startDate, detailItem.endDate);
    const completedDays = detailItem.completions?.length || 0;
    const templateWorkout = detailItem.workoutId ? workouts.find(w => String(w.id) === String(detailItem.workoutId)) : null;
    const exercises = detailItem.customExercises || [];
    const templateExercises = templateWorkout?.sections?.flatMap(s => (s.slots || s.exercises || []).map(sl => sl.exercise || sl)) || [];

    return (
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <button onClick={() => setDetailId(null)} style={{ ...btnSecondary, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>&#8592;</span> Back
        </button>

        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: B.green + "22", color: B.green,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700,
                }}>
                  {getInitials(detailItem.memberName)}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: B.text }}>{detailItem.memberName}</div>
                  <div style={{ fontSize: 13, color: B.muted }}>{detailItem.workoutName || "Custom Workout"}</div>
                </div>
              </div>
            </div>
            <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color, textTransform: "capitalize" }}>
              {detailItem.status}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: B.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Start Date</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{fmtDate(detailItem.startDate)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: B.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>End Date</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{fmtDate(detailItem.endDate)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: B.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Progress</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: B.green }}>{completedDays} of {totalDays} days</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 3, background: B.border, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ height: "100%", width: `${totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0}%`, background: B.green, borderRadius: 3, transition: "width .3s ease" }} />
          </div>

          {detailItem.coachNotes && (
            <div style={{ padding: 14, borderRadius: 10, background: B.dark, border: `1px solid ${B.border}`, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: B.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Coach Notes</div>
              <div style={{ fontSize: 14, color: B.text, lineHeight: 1.6 }}>{detailItem.coachNotes}</div>
            </div>
          )}
        </Card>

        {/* Exercises */}
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 16px" }}>Exercises</h3>
          {(detailItem.customExercises || templateExercises).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(detailItem.customExercises || []).map((ex, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: B.dark, border: `1px solid ${B.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: B.green, minWidth: 24 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{ex.name}</div>
                    <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>
                      {ex.sets && <span>{ex.sets} sets</span>}
                      {ex.sets && ex.reps && <span> x </span>}
                      {ex.reps && <span>{ex.reps} reps</span>}
                      {ex.notes && <span style={{ marginLeft: 8, fontStyle: "italic" }}>{ex.notes}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {!detailItem.customExercises && templateExercises.map((ex, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: B.dark, border: `1px solid ${B.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: B.green, minWidth: 24 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{ex.n || ex.name || "Exercise"}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: B.dim, textAlign: "center", padding: 16 }}>No exercise details available</div>
          )}
        </Card>

        {/* Completions */}
        {detailItem.completions && detailItem.completions.length > 0 && (
          <Card style={{ padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 16px" }}>Completion Log</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detailItem.completions.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderRadius: 8, background: B.dark, border: `1px solid ${B.border}` }}>
                  <span style={{ color: B.green, fontSize: 16 }}>&#10003;</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: B.text }}>{fmtDate(c.date)}</div>
                    {c.notes && <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>{c.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          {detailItem.status === "active" && (
            <>
              <button onClick={() => completeWorkout(detailItem.id)} style={btnPrimary}>Mark Completed</button>
              <button onClick={() => cancelWorkout(detailItem.id)} style={btnDanger}>Cancel</button>
            </>
          )}
          <button onClick={() => deleteWorkout(detailItem.id)} style={{ ...btnSecondary, color: B.red || "#ef4444", borderColor: (B.red || "#ef4444") + "44" }}>Delete</button>
        </div>
      </div>
    );
  }

  /* ──── ASSIGN MODAL ──── */
  const assignModal = showAssign ? (
    <div
      onClick={() => { setShowAssign(false); resetForm(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: B.card, borderRadius: 16, padding: 28, width: "100%", maxWidth: 560,
          maxHeight: "85vh", overflowY: "auto", border: `1px solid ${B.border}`,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 800, color: B.text, margin: "0 0 20px" }}>Assign Remote Workout</h2>

        {/* Client selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 }}>Client</label>
          <select value={assignMemberId} onChange={e => setAssignMemberId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="">Select a client...</option>
            {members
              .filter(m => m.membershipStatus !== "inactive")
              .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
              .map(m => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName} {m.membershipStatus !== "active" ? `(${m.membershipStatus})` : ""}
                </option>
              ))
            }
          </select>
        </div>

        {/* Workout type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 }}>Workout Type</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setAssignType("template")}
              style={{
                ...btnSecondary, flex: 1,
                background: assignType === "template" ? B.green + "22" : "transparent",
                color: assignType === "template" ? B.green : B.text,
                borderColor: assignType === "template" ? B.green : B.border,
              }}
            >
              From Template
            </button>
            <button
              onClick={() => setAssignType("custom")}
              style={{
                ...btnSecondary, flex: 1,
                background: assignType === "custom" ? B.green + "22" : "transparent",
                color: assignType === "custom" ? B.green : B.text,
                borderColor: assignType === "custom" ? B.green : B.border,
              }}
            >
              Custom Workout
            </button>
          </div>
        </div>

        {/* Template selector */}
        {assignType === "template" && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 }}>Workout Template</label>
            <select value={assignWorkoutId} onChange={e => setAssignWorkoutId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">Select a workout...</option>
              {workouts.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        {/* Custom exercises */}
        {assignType === "custom" && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 8 }}>Exercises</label>
            {customExercises.map((ex, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 12, color: B.dim, fontWeight: 700, minWidth: 20, paddingTop: 10 }}>{i + 1}</span>
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 60px 60px 1fr", gap: 6 }}>
                  <input value={ex.name} onChange={e => updateExercise(i, "name", e.target.value)} placeholder="Exercise name" style={inputStyle} />
                  <input value={ex.sets} onChange={e => updateExercise(i, "sets", e.target.value)} placeholder="Sets" style={{ ...inputStyle, textAlign: "center" }} />
                  <input value={ex.reps} onChange={e => updateExercise(i, "reps", e.target.value)} placeholder="Reps" style={{ ...inputStyle, textAlign: "center" }} />
                  <input value={ex.notes} onChange={e => updateExercise(i, "notes", e.target.value)} placeholder="Notes" style={inputStyle} />
                </div>
                {customExercises.length > 1 && (
                  <button onClick={() => removeExerciseRow(i)} style={{ background: "none", border: "none", color: B.red || "#ef4444", fontSize: 16, cursor: "pointer", padding: "6px 4px" }}>&#10005;</button>
                )}
              </div>
            ))}
            <button onClick={addExerciseRow} style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px" }}>+ Add Exercise</button>
          </div>
        )}

        {/* Date range */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 }}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 }}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Coach notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 }}>Notes to Client</label>
          <textarea value={coachNotes} onChange={e => setCoachNotes(e.target.value)} rows={3} placeholder="Focus on bodyweight movements while traveling..." style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={() => { setShowAssign(false); resetForm(); }} style={btnSecondary}>Cancel</button>
          <button onClick={handleAssign} style={btnPrimary}>Assign Workout</button>
        </div>
      </div>
    </div>
  ) : null;

  /* ──── MAIN LIST ──── */
  return (
    <div>
      {assignModal}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: 0 }}>Remote Workouts</h1>
          <p style={{ fontSize: 14, color: B.muted, margin: "4px 0 0" }}>Assign workouts for clients training away from the gym</p>
        </div>
        <button onClick={() => setShowAssign(true)} style={btnPrimary}>+ Assign Remote Workout</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["all", "active", "completed", "cancelled"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 16px", borderRadius: 20, border: `1px solid ${filter === f ? B.green : B.border}`,
              background: filter === f ? B.green + "22" : "transparent",
              color: filter === f ? B.green : B.muted,
              fontWeight: 600, fontSize: 13, cursor: "pointer", textTransform: "capitalize",
            }}
          >
            {f} {f !== "all" && <span style={{ opacity: 0.6 }}>({remoteWorkouts.filter(r => f === "all" || r.status === f).length})</span>}
          </button>
        ))}
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <Card>
          <div style={{ padding: 40, textAlign: "center", color: B.dim }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#127956;&#65039;</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Remote Workouts</div>
            <div style={{ fontSize: 13 }}>Assign a workout to a client who is training away from the gym.</div>
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {sorted.map(rw => {
            const sc = STATUS_COLORS[rw.status] || STATUS_COLORS.active;
            const totalDays = daysBetween(rw.startDate, rw.endDate);
            const completedDays = rw.completions?.length || 0;
            const today = todayISO();
            const isInRange = rw.startDate <= today && today <= rw.endDate;

            return (
              <Card
                key={rw.id}
                onClick={() => setDetailId(rw.id)}
                style={{
                  padding: 18, cursor: "pointer", transition: "border-color .15s",
                  border: isInRange && rw.status === "active" ? `1px solid ${B.green}40` : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9, background: B.green + "22", color: B.green,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                    }}>
                      {getInitials(rw.memberName)}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: B.text }}>{rw.memberName}</div>
                      <div style={{ fontSize: 12, color: B.muted }}>{rw.workoutName || "Custom Workout"}</div>
                    </div>
                  </div>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, textTransform: "capitalize" }}>
                    {rw.status}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: B.muted }}>
                    {fmtDate(rw.startDate)} - {fmtDate(rw.endDate)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: B.green }}>
                    {completedDays}/{totalDays} days
                  </div>
                </div>

                {/* Mini progress bar */}
                <div style={{ height: 4, borderRadius: 2, background: B.border, overflow: "hidden", marginTop: 10 }}>
                  <div style={{ height: "100%", width: `${totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0}%`, background: B.green, borderRadius: 2 }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
