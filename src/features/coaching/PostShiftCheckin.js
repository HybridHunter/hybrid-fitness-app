import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";

const todayISO = () => new Date().toISOString().slice(0, 10);

/* ═══════════════════════════════════════════════════════════
   POST-SHIFT CHECK-IN MODAL
   Shows after a coach's sessions are done for the day.
   Collects: client wins, hours worked, breaks.
   ═══════════════════════════════════════════════════════════ */

export function PostShiftCheckinModal({ onClose, onSubmit, coachName, date }) {
  const B = useTheme();
  const { members } = useMembers();
  const [attendance] = useLocalStorage("hf_attendance", []);

  // Wins
  const [wins, setWins] = useState([{ memberId: "", text: "" }]);
  const addWin = () => setWins(prev => [...prev, { memberId: "", text: "" }]);
  const updateWin = (i, field, val) => setWins(prev => prev.map((w, idx) => idx === i ? { ...w, [field]: val } : w));
  const removeWin = (i) => setWins(prev => prev.filter((_, idx) => idx !== i));

  // Hours
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [breaks, setBreaks] = useState([]);
  const addBreak = () => setBreaks(prev => [...prev, { start: "", end: "" }]);
  const updateBreak = (i, field, val) => setBreaks(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b));
  const removeBreak = (i) => setBreaks(prev => prev.filter((_, idx) => idx !== i));

  // Notes
  const [shiftNotes, setShiftNotes] = useState("");

  // Compute total hours
  const totalHours = useMemo(() => {
    if (!clockIn || !clockOut) return null;
    const [h1, m1] = clockIn.split(":").map(Number);
    const [h2, m2] = clockOut.split(":").map(Number);
    let totalMin = (h2 * 60 + m2) - (h1 * 60 + m1);
    breaks.forEach(b => {
      if (b.start && b.end) {
        const [bh1, bm1] = b.start.split(":").map(Number);
        const [bh2, bm2] = b.end.split(":").map(Number);
        totalMin -= (bh2 * 60 + bm2) - (bh1 * 60 + bm1);
      }
    });
    return Math.max(0, totalMin / 60).toFixed(1);
  }, [clockIn, clockOut, breaks]);

  // Members who checked in today (suggest for wins)
  const todayMembers = useMemo(() => {
    const today = date || todayISO();
    const checkedIn = attendance.filter(a => a.checkInTime?.slice(0, 10) === today && !a.noShow).map(a => a.memberId);
    return members.filter(m => checkedIn.includes(m.id));
  }, [attendance, members, date]);

  const handleSubmit = () => {
    const validWins = wins.filter(w => w.text.trim());
    onSubmit({
      coachName,
      date: date || todayISO(),
      wins: validWins.map(w => ({
        memberId: w.memberId,
        memberName: w.memberId ? (() => { const m = members.find(x => x.id === w.memberId); return m ? `${m.firstName} ${m.lastName}` : ""; })() : "",
        text: w.text.trim(),
      })),
      clockIn,
      clockOut,
      totalHours: totalHours ? Number(totalHours) : null,
      breaks: breaks.filter(b => b.start && b.end),
      shiftNotes: shiftNotes.trim(),
      submittedAt: new Date().toISOString(),
    });
  };

  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { fontSize: 12, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 560, width: "95%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: B.text }}>Post-Shift Check-In</h2>
        <p style={{ color: B.muted, fontSize: 13, margin: "0 0 20px" }}>
          {date !== todayISO() ? `Missed check-in for ${new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}` : "How did today's sessions go?"}
        </p>

        {/* Client Wins */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Client Wins</label>
          <p style={{ fontSize: 12, color: B.dim, margin: "0 0 8px" }}>What wins did your clients have today? These can be shared to the community feed.</p>
          {wins.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <select value={w.memberId} onChange={e => updateWin(i, "memberId", e.target.value)}
                style={{ ...inputStyle, width: 140, flexShrink: 0 }}>
                <option value="">Any / General</option>
                {todayMembers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </select>
              <input style={{ ...inputStyle, flex: 1 }} value={w.text} onChange={e => updateWin(i, "text", e.target.value)}
                placeholder="e.g. Hit a PR on back squat, first pull-up..." />
              {wins.length > 1 && (
                <button onClick={() => removeWin(i)} style={{ background: "transparent", border: "none", color: B.red, fontSize: 16, cursor: "pointer", padding: "4px" }}>{"\u2715"}</button>
              )}
            </div>
          ))}
          <button onClick={addWin} style={{ background: B.accent + "15", color: B.accent, border: "1px dashed " + B.accent + "40", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Add Win
          </button>
        </div>

        {/* Hours Worked */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Hours Worked</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, color: B.dim }}>Clock In</span>
              <input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, color: B.dim }}>Clock Out</span>
              <input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} style={inputStyle} />
            </div>
            {totalHours && (
              <div style={{ textAlign: "center", minWidth: 60 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: B.accent }}>{totalHours}</div>
                <div style={{ fontSize: 10, color: B.dim }}>hours</div>
              </div>
            )}
          </div>

          {/* Breaks */}
          {breaks.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, paddingLeft: 12 }}>
              <span style={{ fontSize: 11, color: B.dim, width: 40 }}>Break:</span>
              <input type="time" value={b.start} onChange={e => updateBreak(i, "start", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <span style={{ color: B.dim }}>-</span>
              <input type="time" value={b.end} onChange={e => updateBreak(i, "end", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => removeBreak(i)} style={{ background: "transparent", border: "none", color: B.red, fontSize: 14, cursor: "pointer" }}>{"\u2715"}</button>
            </div>
          ))}
          <button onClick={addBreak} style={{ background: "transparent", color: B.muted, border: "1px dashed " + B.border, borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer", marginTop: 4 }}>
            + Add Break
          </button>
        </div>

        {/* Shift Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Shift Notes (optional)</label>
          <textarea value={shiftNotes} onChange={e => setShiftNotes(e.target.value)} placeholder="Anything notable from your shift..."
            style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Skip</button>
          <button onClick={handleSubmit} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Submit Check-In</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN VIEW: Coach Shift Submissions
   Shows all submitted shift check-ins for admin review.
   ═══════════════════════════════════════════════════════════ */

export function CoachShiftSubmissions({ B, shiftLogs, members, plans, onCreateWinsPost }) {
  const [expandedId, setExpandedId] = useState(null);
  const [winsRange, setWinsRange] = useState("week"); // "week", "custom"
  const [winsStart, setWinsStart] = useState("");
  const [winsEnd, setWinsEnd] = useState("");

  if (!shiftLogs || shiftLogs.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: B.dim, fontSize: 13 }}>
        No coach shift check-ins submitted yet.
      </div>
    );
  }

  const sorted = [...shiftLogs].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const collectWins = (logs) => {
    const allWins = [];
    logs.forEach(l => {
      (l.wins || []).forEach(w => {
        if (w.text) allWins.push({ ...w, coachName: l.coachName, date: l.date });
      });
    });
    return allWins;
  };

  // Get wins for selected range
  const getFilteredWins = () => {
    const today = new Date();
    let startDate, endDate;
    if (winsRange === "week") {
      const d = new Date(today);
      d.setDate(d.getDate() - d.getDay()); // Sunday
      startDate = d.toISOString().slice(0, 10);
      endDate = todayISO();
    } else if (winsRange === "custom" && winsStart && winsEnd) {
      startDate = winsStart;
      endDate = winsEnd;
    } else {
      return [];
    }
    const filtered = sorted.filter(l => l.date >= startDate && l.date <= endDate);
    return collectWins(filtered);
  };

  const rangeWins = getFilteredWins();
  const rangeLabel = winsRange === "week" ? "This Week's" : "Selected";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: B.text }}>Coach Shift Submissions</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select value={winsRange} onChange={e => setWinsRange(e.target.value)}
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.card, color: B.text, fontSize: 12, cursor: "pointer", outline: "none" }}>
            <option value="week">This Week</option>
            <option value="custom">Custom Range</option>
          </select>
          {winsRange === "custom" && (
            <>
              <input type="date" value={winsStart} onChange={e => setWinsStart(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.card, color: B.text, fontSize: 12, outline: "none" }} />
              <span style={{ color: B.dim, fontSize: 12 }}>to</span>
              <input type="date" value={winsEnd} onChange={e => setWinsEnd(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.card, color: B.text, fontSize: 12, outline: "none" }} />
            </>
          )}
          {rangeWins.length > 0 && (
            <button onClick={() => onCreateWinsPost(rangeWins)}
              style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Post {rangeLabel} Wins ({rangeWins.length})
            </button>
          )}
        </div>
      </div>

      {sorted.slice(0, 30).map(log => {
        const expanded = expandedId === log.id;
        const d = new Date(log.submittedAt);
        return (
          <div key={log.id} style={{ marginBottom: 8, borderRadius: 10, border: "1px solid " + B.border, background: B.card, overflow: "hidden" }}>
            <div onClick={() => setExpandedId(expanded ? null : log.id)} style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: B.text }}>{log.coachName}</span>
                <span style={{ fontSize: 12, color: B.muted, marginLeft: 10 }}>
                  {new Date(log.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {log.totalHours && <span style={{ fontSize: 13, fontWeight: 700, color: B.accent }}>{log.totalHours}h</span>}
                <span style={{ fontSize: 12, color: B.accent, padding: "2px 10px", borderRadius: 10, background: B.accent + "15" }}>{(log.wins || []).length} wins</span>
                <span style={{ color: B.dim, fontSize: 14 }}>{expanded ? "\u25B2" : "\u25BC"}</span>
              </div>
            </div>

            {expanded && (
              <div style={{ padding: "0 16px 14px", borderTop: "1px solid " + B.border + "44" }}>
                {/* Wins */}
                {(log.wins || []).length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 6 }}>Wins</div>
                    {log.wins.map((w, i) => (
                      <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: B.darker, marginBottom: 4, fontSize: 13, color: B.text }}>
                        {w.memberName && <strong>{w.memberName}: </strong>}
                        {w.text}
                      </div>
                    ))}
                  </div>
                )}

                {/* Hours */}
                {log.clockIn && (
                  <div style={{ marginTop: 10, fontSize: 13, color: B.muted }}>
                    <strong>Hours:</strong> {log.clockIn} - {log.clockOut}
                    {log.totalHours && ` (${log.totalHours}h)`}
                    {(log.breaks || []).length > 0 && (
                      <span> | Breaks: {log.breaks.map(b => `${b.start}-${b.end}`).join(", ")}</span>
                    )}
                  </div>
                )}

                {/* Notes */}
                {log.shiftNotes && (
                  <div style={{ marginTop: 8, fontSize: 13, color: B.muted }}>
                    <strong>Notes:</strong> {log.shiftNotes}
                  </div>
                )}

                <div style={{ fontSize: 11, color: B.dim, marginTop: 8 }}>
                  Submitted {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
