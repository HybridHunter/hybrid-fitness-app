import { useState, useMemo, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";
import { localISO } from "../../utils/dates";
import { getBookingsOn } from "../../utils/bookings";

const DEFAULT_STATIONS = Array.from({ length: 8 }, (_, i) => ({
  id: `station-${i + 1}`,
  label: `Station ${i + 1}`,
  memberId: null,
  classId: null,
  workoutId: null,
  active: false,
}));

export default function StationSetup() {
  const B = useTheme();
  const { members } = useMembers();
  // Station URLs must carry the gym so a fresh iPad lands in the right tenant
  const gymId = localStorage.getItem("hf_gym_id") || "default";
  const [stations, setStations] = useLocalStorage("hf_stations", DEFAULT_STATIONS);
  const [classes] = useLocalStorage("hf_schedule", []);
  const [workouts] = useLocalStorage("hf_w", []);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [workoutOverrideId, setWorkoutOverrideId] = useState("");
  const [editingLabel, setEditingLabel] = useState(null);
  const [editLabelValue, setEditLabelValue] = useState("");

  // Today's classes
  const todaysClasses = useMemo(() => {
    const today = new Date().getDay();
    const dow = today === 0 ? 6 : today - 1; // convert to Mon=0 format
    return classes.filter(c => c.dayOfWeek === dow && !(c.exceptions || []).includes(localISO()));
  }, [classes]);

  const selectedClass = useMemo(
    () => classes.find(c => c.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  // Effective workout ID: override > class workout
  const effectiveWorkoutId = workoutOverrideId || selectedClass?.workoutId || "";
  const effectiveWorkout = useMemo(
    () => workouts.find(w => w.id === effectiveWorkoutId || String(w.id) === String(effectiveWorkoutId)) || null,
    [workouts, effectiveWorkoutId]
  );

  // Booked members from selected class (today's roster: standing + date-scoped)
  const bookedMemberIds = useMemo(
    () => (selectedClass ? getBookingsOn(selectedClass, localISO()) : []),
    [selectedClass]
  );

  // Active members for dropdown
  const activeMembers = useMemo(
    () => members.filter(m => !!m.membershipPlanId),
    [members]
  );

  // Already-assigned member IDs
  const assignedMemberIds = useMemo(
    () => new Set(stations.filter(s => s.memberId).map(s => s.memberId)),
    [stations]
  );

  const PATTERNS = ["Squat","Hinge","Lunge","Push","Pull","Core","Carry"];
  const SCORE_COLORS = {
    "-3": "#ef4444", "-2": "#f97316", "-1": "#f59e0b",
    "0": "#6b7280", "1": "#22c55e", "2": "#3b82f6", "3": "#a855f7",
  };

  const handleClassChange = useCallback((classId) => {
    setSelectedClassId(classId);
    setWorkoutOverrideId("");
    const cls = classes.find(c => c.id === classId);
    if (cls) {
      setStations(prev =>
        prev.map(s => ({
          ...s,
          classId: classId,
          workoutId: cls.workoutId || s.workoutId,
        }))
      );
    }
  }, [classes, setStations]);

  const updateStation = useCallback((stationId, updates) => {
    setStations(prev =>
      prev.map(s => (s.id === stationId ? { ...s, ...updates } : s))
    );
  }, [setStations]);

  const assignMember = useCallback((stationId, memberId) => {
    updateStation(stationId, {
      memberId: memberId || null,
      workoutId: effectiveWorkoutId || null,
      classId: selectedClassId || null,
      active: !!memberId,
    });
  }, [updateStation, effectiveWorkoutId, selectedClassId]);

  const clearStation = useCallback((stationId) => {
    updateStation(stationId, {
      memberId: null,
      classId: null,
      workoutId: null,
      active: false,
    });
  }, [updateStation]);

  const autoAssign = useCallback(() => {
    const available = bookedMemberIds.length > 0
      ? bookedMemberIds
      : activeMembers.map(m => m.id);
    let idx = 0;
    setStations(prev =>
      prev.map(s => {
        if (s.memberId || idx >= available.length) return s;
        const mid = available[idx++];
        return {
          ...s,
          memberId: mid,
          classId: selectedClassId || null,
          workoutId: effectiveWorkoutId || null,
          active: true,
        };
      })
    );
  }, [bookedMemberIds, activeMembers, selectedClassId, effectiveWorkoutId, setStations]);

  const clearAll = useCallback(() => {
    setStations(prev =>
      prev.map(s => ({
        ...s,
        memberId: null,
        classId: null,
        workoutId: null,
        active: false,
      }))
    );
  }, [setStations]);

  const addStation = useCallback(() => {
    const num = stations.length + 1;
    setStations(prev => [
      ...prev,
      {
        id: `station-${Date.now()}`,
        label: `Station ${num}`,
        memberId: null,
        classId: null,
        workoutId: null,
        active: false,
      },
    ]);
  }, [stations.length, setStations]);

  const removeStation = useCallback(() => {
    if (stations.length <= 1) return;
    setStations(prev => prev.slice(0, -1));
  }, [stations.length, setStations]);

  const launchStation = useCallback((stationId) => {
    window.open(`/station/${stationId}?gym=${encodeURIComponent(gymId)}`, `_station_${stationId}`);
  }, [gymId]);

  const launchAll = useCallback(() => {
    stations.forEach(s => {
      if (s.memberId) window.open(`/station/${s.id}?gym=${encodeURIComponent(gymId)}`, `_station_${s.id}`);
    });
  }, [stations, gymId]);

  const getMemberById = useCallback(
    (id) => members.find(m => m.id === id) || null,
    [members]
  );

  const startEditLabel = (station) => {
    setEditingLabel(station.id);
    setEditLabelValue(station.label);
  };

  const saveLabel = (stationId) => {
    if (editLabelValue.trim()) {
      updateStation(stationId, { label: editLabelValue.trim() });
    }
    setEditingLabel(null);
  };

  const selectStyle = {
    background: B.dark,
    color: B.text,
    border: `1px solid ${B.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  const btnStyle = (bg, color) => ({
    background: bg,
    color: color || "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: B.text, margin: 0 }}>
          Station Setup
        </h1>
        <p style={{ color: B.muted, fontSize: 14, marginTop: 4 }}>
          Assign clients to stations before session
        </p>
      </div>

      {/* Class + Workout selectors */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Today's Session
          </label>
          <select
            value={selectedClassId}
            onChange={e => handleClassChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- Select a session --</option>
            {todaysClasses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.startTime} - {c.endTime})
              </option>
            ))}
            {todaysClasses.length === 0 && (
              <option disabled>No sessions today</option>
            )}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Workout {selectedClass?.workoutId ? "(override)" : ""}
          </label>
          <select
            value={workoutOverrideId || effectiveWorkoutId}
            onChange={e => setWorkoutOverrideId(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- Select a workout --</option>
            {workouts.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {effectiveWorkout && (
          <div style={{ flex: 1, minWidth: 220, display: "flex", alignItems: "flex-end" }}>
            <div style={{
              background: `${B.accent}22`,
              border: `1px solid ${B.accent}44`,
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              color: B.accent,
              width: "100%",
            }}>
              Workout: <strong>{effectiveWorkout.name}</strong>
              {" "}({effectiveWorkout.sections?.length || 0} sections,{" "}
              {effectiveWorkout.sections?.reduce((s, sec) => s + (sec.slots?.length || 0), 0) || 0} exercises)
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <button onClick={autoAssign} style={btnStyle(B.accent)}>Auto-Assign</button>
        <button onClick={clearAll} style={btnStyle(`${B.red}22`, B.red)}>Clear All</button>
        <button onClick={addStation} style={btnStyle(B.border, B.text)}>+ Add Station</button>
        <button onClick={removeStation} style={btnStyle(B.border, B.text)}>- Remove Station</button>
        <div style={{ flex: 1 }} />
        <button onClick={launchAll} style={btnStyle(B.accent)}>Launch All Stations</button>
      </div>

      {/* Station Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 16,
        marginBottom: 40,
      }}>
        {stations.map(station => {
          const member = station.memberId ? getMemberById(station.memberId) : null;
          const isEditing = editingLabel === station.id;

          return (
            <Card
              key={station.id}
              style={{
                border: member
                  ? `2px solid ${B.accent}66`
                  : `2px dashed ${B.border}`,
                padding: 0,
                overflow: "hidden",
              }}
            >
              {/* Station header */}
              <div style={{
                padding: "10px 14px",
                background: member ? `${B.accent}11` : "transparent",
                borderBottom: `1px solid ${B.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editLabelValue}
                    onChange={e => setEditLabelValue(e.target.value)}
                    onBlur={() => saveLabel(station.id)}
                    onKeyDown={e => e.key === "Enter" && saveLabel(station.id)}
                    style={{
                      background: B.dark,
                      color: B.text,
                      border: `1px solid ${B.accent}`,
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 14,
                      fontWeight: 700,
                      width: 140,
                      outline: "none",
                    }}
                  />
                ) : (
                  <span
                    onClick={() => startEditLabel(station)}
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: B.text,
                      cursor: "pointer",
                    }}
                    title="Click to rename"
                  >
                    {station.label}
                  </span>
                )}
                {member && (
                  <span style={{
                    background: "#22c55e22",
                    color: "#22c55e",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}>
                    Ready
                  </span>
                )}
              </div>

              {/* Station body */}
              <div style={{ padding: 14 }}>
                {member ? (
                  <>
                    {/* Assigned member display */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: `${B.accent}33`,
                        color: B.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: B.text }}>
                          {member.firstName} {member.lastName}
                        </div>
                        <div style={{ fontSize: 12, color: B.muted }}>
                          {member.membershipStatus}
                        </div>
                      </div>
                    </div>

                    {/* Movement scores dots */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                      {PATTERNS.map(p => {
                        const score = member.movementScores?.[p] ?? 0;
                        return (
                          <div
                            key={p}
                            title={`${p}: ${score}`}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: SCORE_COLORS[String(score)] || B.border,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 9,
                              fontWeight: 700,
                              color: "#fff",
                            }}
                          >
                            {p.slice(0, 2)}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => clearStation(station.id)}
                      style={{
                        ...btnStyle(`${B.red}22`, B.red),
                        width: "100%",
                        padding: "8px 0",
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <>
                    {/* Unassigned — member selector */}
                    <div style={{
                      textAlign: "center",
                      padding: "12px 0",
                      color: B.muted,
                      fontSize: 13,
                      marginBottom: 10,
                    }}>
                      Assign Client
                    </div>
                    <select
                      value=""
                      onChange={e => assignMember(station.id, e.target.value)}
                      style={{ ...selectStyle, marginBottom: 8 }}
                    >
                      <option value="">-- Select client --</option>
                      {bookedMemberIds.length > 0 && (
                        <optgroup label="Booked">
                          {bookedMemberIds.map(mid => {
                            const m = getMemberById(mid);
                            if (!m || assignedMemberIds.has(mid)) return null;
                            return (
                              <option key={mid} value={mid}>
                                {m.firstName} {m.lastName}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                      <optgroup label="All Active Clients">
                        {activeMembers
                          .filter(m => !assignedMemberIds.has(m.id))
                          .map(m => (
                            <option key={m.id} value={m.id}>
                              {m.firstName} {m.lastName}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </>
                )}

                <button
                  onClick={() => launchStation(station.id)}
                  style={{
                    ...btnStyle(B.accent),
                    width: "100%",
                    padding: "10px 0",
                    fontSize: 13,
                  }}
                >
                  Launch Station
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Station URLs section */}
      <Card style={{ marginTop: 8 }}>
        <h3 style={{ color: B.text, fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>
          Station URLs
        </h3>
        <p style={{ color: B.muted, fontSize: 13, marginBottom: 16 }}>
          Bookmark these URLs on each iPad. The station will auto-load the assigned client's workout.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stations.map(station => {
            const url = `${window.location.origin}/station/${station.id}?gym=${encodeURIComponent(gymId)}`;
            return (
              <div
                key={station.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  background: B.dark,
                  borderRadius: 8,
                  border: `1px solid ${B.border}`,
                }}
              >
                <span style={{ fontWeight: 600, color: B.text, fontSize: 13, minWidth: 90 }}>
                  {station.label}
                </span>
                <code style={{
                  flex: 1,
                  fontSize: 12,
                  color: B.muted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {url}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(url)}
                  style={{
                    ...btnStyle(B.border, B.text),
                    padding: "5px 12px",
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  Copy URL
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
