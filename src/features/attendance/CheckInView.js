import { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";
import { sendLocalNotification, getNotificationPrefs } from "../../utils/pushNotifications";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${m} ${ampm}`;
}

function fmtScheduleTime(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function getTodayDayOfWeek() {
  // Schedule format: 0=Mon...6=Sun
  const jsDay = new Date().getDay(); // 0=Sun,1=Mon...6=Sat
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getCurrentTimeHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function buildDemoAttendance(members) {
  const today = new Date();
  const records = [];
  // Seed a few check-ins from today for demo purposes
  const demoMembers = members.slice(0, 3);
  const hours = [6, 7, 9];
  demoMembers.forEach((m, i) => {
    const t = new Date(today);
    t.setHours(hours[i], Math.floor(Math.random() * 30), 0, 0);
    if (t < new Date()) {
      records.push({
        id: crypto.randomUUID(),
        memberId: m.id,
        checkInTime: t.toISOString(),
        method: "pin",
        _demo: true,
      });
    }
  });
  return records;
}

export default function CheckInView() {
  const B = useTheme();
  const { members, getMember, updateMember } = useMembers();
  const [attendance, setAttendance] = useLocalStorage("hf_attendance", []);
  const [schedule] = useLocalStorage("hf_schedule", []);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("idle"); // idle | success | error
  const [checkedInMember, setCheckedInMember] = useState(null);
  const [checkedInClass, setCheckedInClass] = useState(null);
  const [now, setNow] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-dismiss success
  useEffect(() => {
    if (status === "success") {
      const t = setTimeout(() => { setStatus("idle"); setCheckedInMember(null); setCheckedInClass(null); }, 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const todayRecords = useMemo(() =>
    attendance
      .filter(a => a.checkInTime.slice(0, 10) === todayISO())
      .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime))
  , [attendance]);

  // Today's classes from schedule
  const todayDow = getTodayDayOfWeek();
  const todayClasses = useMemo(() =>
    schedule
      .filter(c => c.dayOfWeek === todayDow)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  , [schedule, todayDow]);

  // Find currently active classes (within time window or 15 min before start)
  const findCurrentClasses = useCallback(() => {
    const nowMins = timeToMinutes(getCurrentTimeHHMM());
    return todayClasses.filter(c => {
      const start = timeToMinutes(c.startTime);
      const end = timeToMinutes(c.endTime);
      // Active if within 15 min before start through end of class
      return nowMins >= start - 15 && nowMins <= end;
    });
  }, [todayClasses]);

  // Detect which class a member should check into
  const detectClassForMember = useCallback((memberId) => {
    const currentClasses = findCurrentClasses();
    if (currentClasses.length === 0) return null;

    // Check if member is booked into any current class
    const bookedClass = currentClasses.find(c => c.bookings && c.bookings.includes(memberId));
    if (bookedClass) return bookedClass;

    // If only one class running and member not booked, suggest it
    if (currentClasses.length === 1) return currentClasses[0];

    return null;
  }, [findCurrentClasses]);

  const handleDigit = useCallback((d) => {
    if (status !== "idle") return;
    setPin(prev => prev.length < 4 ? prev + d : prev);
  }, [status]);

  const handleClear = useCallback(() => {
    setPin("");
    setStatus("idle");
  }, []);

  const handleEnter = useCallback(() => {
    if (pin.length !== 4) return;
    const member = members.find(m => m.pin === pin);
    if (member) {
      const detectedClass = detectClassForMember(member.id);
      const record = {
        id: crypto.randomUUID(),
        memberId: member.id,
        checkInTime: new Date().toISOString(),
        method: "pin",
        ...(detectedClass ? { classId: detectedClass.id } : {})
      };
      setAttendance(prev => [...prev, record]);
      setCheckedInMember(member);
      setCheckedInClass(detectedClass);

      // Send notification
      if (getNotificationPrefs().checkin !== false) {
        sendLocalNotification(`Welcome back, ${member.firstName}!`, {
          body: detectedClass ? `Checked in for: ${detectedClass.name}` : "Open gym check-in",
        });
      }

      // Gamification stats are now derived from attendance records

      setStatus("success");
      setPin("");
    } else {
      setStatus("error");
      setTimeout(() => { setStatus("idle"); setPin(""); }, 800);
    }
  }, [pin, members, setAttendance, detectClassForMember, attendance, updateMember]);

  // Keyboard support
  useEffect(() => {
    const handler = (e) => {
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Enter") handleEnter();
      else if (e.key === "Backspace" || e.key === "Escape") handleClear();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDigit, handleEnter, handleClear]);

  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

  const keyBtn = (label, action, extra = {}) => (
    <button
      key={label}
      onClick={action}
      style={{
        width: 80, height: 80, borderRadius: 16, border: `1px solid ${B.border}`,
        background: B.darker, color: B.text, fontSize: 28, fontWeight: 700,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s, transform 0.1s",
        ...extra
      }}
      onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      {label}
    </button>
  );

  // Success screen
  if (status === "success" && checkedInMember) {
    const g = checkedInMember.gamification || {};
    const alreadyCheckedInToday = attendance.some(
      a => a.memberId === checkedInMember.id && a.checkInTime.slice(0, 10) === todayISO() && a.id !== attendance[attendance.length - 1]?.id
    );
    const displayWorkouts = (g.totalWorkouts || 0) + 1;
    const displayStreak = alreadyCheckedInToday ? (g.currentStreak || 0) : (g.currentStreak || 0) + 1;
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "70vh", animation: "fadeIn 0.3s ease-out"
      }}>
        <div style={{
          width: 120, height: 120, borderRadius: "50%", background: B.green + "22",
          border: `3px solid ${B.green}`, display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 24
        }}>
          <span style={{ fontSize: 56 }}>&#10003;</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: B.text, margin: "0 0 8px" }}>
          Welcome back!
        </h1>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: B.accent, margin: "0 0 12px" }}>
          {checkedInMember.firstName} {checkedInMember.lastName}
        </h2>
        <div style={{
          fontSize: 15, fontWeight: 600, marginBottom: 28,
          color: checkedInClass ? B.green : B.muted,
          background: checkedInClass ? B.green + "15" : B.darker,
          padding: "6px 16px", borderRadius: 20
        }}>
          {checkedInClass ? `Checked in for: ${checkedInClass.name}` : "Open gym check-in"}
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: B.text }}>{displayWorkouts}</div>
            <div style={{ fontSize: 13, color: B.muted, fontWeight: 600 }}>Workouts</div>
          </div>
          <div style={{ width: 1, background: B.border }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: B.orange }}>{displayStreak}</div>
            <div style={{ fontSize: 13, color: B.muted, fontWeight: 600 }}>Day Streak</div>
          </div>
        </div>
        <div style={{ marginTop: 32, fontSize: 13, color: B.dim }}>Returning to check-in...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Date/Time Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: B.muted, fontWeight: 500 }}>{dateStr}</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: B.text, fontVariantNumeric: "tabular-nums" }}>{timeStr}</div>
      </div>

      {/* PIN Entry Card */}
      <Card style={{ padding: 32, marginBottom: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: B.text, margin: "0 0 16px" }}>Enter Your PIN</h2>
          {/* PIN dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 48, height: 56, borderRadius: 12,
                border: `2px solid ${status === "error" ? B.red : pin.length > i ? B.accent : B.border}`,
                background: pin.length > i ? B.accent + "15" : B.darker,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
                animation: status === "error" ? "shake 0.3s ease-in-out" : "none"
              }}>
                <span style={{
                  fontSize: 24, fontWeight: 800,
                  color: pin.length > i ? B.accent : "transparent"
                }}>
                  {pin[i] || ""}
                </span>
              </div>
            ))}
          </div>
          {status === "error" && (
            <div style={{ color: B.red, fontSize: 13, fontWeight: 600, marginTop: 8 }}>
              Invalid PIN. Please try again.
            </div>
          )}
        </div>

        {/* Keypad */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {keyBtn("1", () => handleDigit("1"))}
            {keyBtn("2", () => handleDigit("2"))}
            {keyBtn("3", () => handleDigit("3"))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {keyBtn("4", () => handleDigit("4"))}
            {keyBtn("5", () => handleDigit("5"))}
            {keyBtn("6", () => handleDigit("6"))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {keyBtn("7", () => handleDigit("7"))}
            {keyBtn("8", () => handleDigit("8"))}
            {keyBtn("9", () => handleDigit("9"))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleClear}
              style={{
                width: 80, height: 80, borderRadius: 16, border: `1px solid ${B.border}`,
                background: B.red + "15", color: B.red, fontSize: 14, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              Clear
            </button>
            {keyBtn("0", () => handleDigit("0"))}
            <button
              onClick={handleEnter}
              style={{
                width: 80, height: 80, borderRadius: 16, border: "none",
                background: pin.length === 4 ? B.accent : B.accent + "44",
                color: B.darker, fontSize: 14, fontWeight: 700,
                cursor: pin.length === 4 ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.2s"
              }}
            >
              Enter
            </button>
          </div>
        </div>
      </Card>

      {/* Recent Check-ins */}
      <Card style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: B.text, margin: "0 0 12px" }}>
          Today's Check-ins
          <span style={{
            marginLeft: 8, fontSize: 12, fontWeight: 600, color: B.accent,
            background: B.accent + "18", padding: "2px 8px", borderRadius: 10
          }}>
            {todayRecords.length}
          </span>
        </h3>
        {todayRecords.length === 0 && (
          <p style={{ color: B.dim, fontSize: 13, fontStyle: "italic", margin: 0 }}>No check-ins yet today.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {todayRecords.map(rec => {
            const m = getMember(rec.memberId);
            const cls = rec.classId ? schedule.find(c => c.id === rec.classId) : null;
            return (
              <div key={rec.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", borderRadius: 8, background: B.darker
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", background: B.accent + "22",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: B.accent
                  }}>
                    {m ? m.firstName[0] + m.lastName[0] : "??"}
                  </div>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: B.text }}>
                      {m ? `${m.firstName} ${m.lastName}` : "Unknown"}
                    </span>
                    {cls && (
                      <div style={{ fontSize: 11, color: B.muted, fontWeight: 500 }}>{cls.name}</div>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: B.muted, fontVariantNumeric: "tabular-nums" }}>
                  {fmtTime(rec.checkInTime)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Today's Class Schedule */}
      {todayClasses.length > 0 && (
        <Card style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: B.text, margin: "0 0 12px" }}>
            Today's Sessions
            <span style={{
              marginLeft: 8, fontSize: 12, fontWeight: 600, color: B.accent,
              background: B.accent + "18", padding: "2px 8px", borderRadius: 10
            }}>
              {todayClasses.length}
            </span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayClasses.map(cls => {
              const nowMins = timeToMinutes(getCurrentTimeHHMM());
              const startMins = timeToMinutes(cls.startTime);
              const endMins = timeToMinutes(cls.endTime);
              const isActive = nowMins >= startMins - 15 && nowMins <= endMins;
              const isPast = nowMins > endMins;
              const spotsLeft = (cls.capacity || 0) - (cls.bookings ? cls.bookings.length : 0);
              return (
                <div key={cls.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: 8,
                  background: isActive ? B.accent + "12" : B.darker,
                  border: isActive ? `1px solid ${B.accent}44` : "1px solid transparent",
                  opacity: isPast ? 0.5 : 1
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isActive && (
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: B.green, flexShrink: 0
                      }} />
                    )}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{cls.name}</div>
                      <div style={{ fontSize: 12, color: B.muted }}>
                        {fmtScheduleTime(cls.startTime)} - {fmtScheduleTime(cls.endTime)}
                        {cls.instructor ? ` \u00b7 ${cls.instructor}` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 600,
                    color: spotsLeft <= 0 ? B.orange : spotsLeft <= 2 ? B.orange : B.muted,
                    textAlign: "right"
                  }}>
                    {spotsLeft <= 0 ? "Full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* CSS keyframes for shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
