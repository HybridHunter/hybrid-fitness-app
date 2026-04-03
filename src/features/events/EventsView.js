import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import PlanAccessPicker, { PlanLockBadge } from "../../components/ui/PlanAccessPicker";
import { ImageUploadZone } from "../../components/shared/ImageUpload";

/* ---- helpers ---- */
const uuid = () => crypto.randomUUID();

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(t) {
  const [h, m] = t.split(":");
  const hr = +h % 12 || 12;
  const ampm = +h < 12 ? "AM" : "PM";
  return `${hr}:${m} ${ampm}`;
}
function today() { return new Date().toISOString().slice(0, 10); }

function generateDemoEvents() {
  const now = new Date();
  const d = (offset) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().slice(0, 10);
  };
  return [
    { id: uuid(), title: "Community Workout", description: "Join us for a full-body workout anyone can do. All fitness levels welcome! We'll break into groups and scale appropriately. Bring water and a towel.", date: d(3), startTime: "09:00", endTime: "10:00", locationType: "in-person", locationUrl: "123 Fitness Ave, Suite 200", coverImage: "", recurring: { frequency: "weekly", dayOfWeek: new Date(now.getTime() + 3 * 86400000).getDay() }, rsvps: ["m1", "m2", "m3", "m4", "m5", "m6", "m7"], createdBy: "coach", createdAt: new Date(now.getTime() - 7 * 86400000).toISOString(), allowedPlanIds: [] },
    { id: uuid(), title: "Nutrition Workshop", description: "Learn practical meal-prep strategies and macro-friendly recipes. We'll cover grocery shopping tips, easy high-protein meals, and how to stay consistent with nutrition.", date: d(7), startTime: "18:00", endTime: "19:30", locationType: "virtual", locationUrl: "https://zoom.us/j/example123", coverImage: "", recurring: null, rsvps: ["m1", "m3", "m5", "m8", "m9"], createdBy: "coach", createdAt: new Date(now.getTime() - 5 * 86400000).toISOString(), allowedPlanIds: [] },
    { id: uuid(), title: "Monthly Challenge Kickoff", description: "Kick off the new monthly challenge! This month: 30-day consistency challenge. Show up every day, log your workouts, and earn points. Prizes for top 3 finishers.", date: d(1), startTime: "12:00", endTime: "12:45", locationType: "virtual", locationUrl: "https://meet.google.com/abc-defg-hij", coverImage: "", recurring: { frequency: "monthly", dayOfWeek: new Date(now.getTime() + 1 * 86400000).getDay() }, rsvps: ["m2", "m4", "m6", "m7", "m8", "m9", "m10", "m11"], createdBy: "coach", createdAt: new Date(now.getTime() - 3 * 86400000).toISOString(), allowedPlanIds: [] },
    { id: uuid(), title: "Q&A with Coach", description: "Open Q&A session. Bring your questions about training, nutrition, recovery, or anything fitness-related. No question is too basic!", date: d(10), startTime: "17:00", endTime: "18:00", locationType: "virtual", locationUrl: "https://zoom.us/j/example456", coverImage: "", recurring: null, rsvps: ["m1", "m2", "m3"], createdBy: "coach", createdAt: new Date(now.getTime() - 2 * 86400000).toISOString(), allowedPlanIds: [] },
    { id: uuid(), title: "Recovery & Mobility Session", description: "Guided mobility and recovery session. We'll work through foam rolling, stretching, and breathwork. Perfect for rest days or as a complement to your training.", date: d(-10), startTime: "08:00", endTime: "09:00", locationType: "in-person", locationUrl: "123 Fitness Ave, Suite 200", coverImage: "", recurring: null, rsvps: ["m1", "m5", "m6", "m9", "m10"], createdBy: "coach", createdAt: new Date(now.getTime() - 20 * 86400000).toISOString(), allowedPlanIds: [] },
    { id: uuid(), title: "Saturday Morning Bootcamp", description: "High-energy Saturday bootcamp! Expect circuits, partner work, and a great sweat. All levels welcome - every exercise has a modification.", date: d(-3), startTime: "07:30", endTime: "08:30", locationType: "in-person", locationUrl: "City Park - North Entrance", coverImage: "", recurring: { frequency: "weekly", dayOfWeek: 6 }, rsvps: ["m2", "m3", "m4", "m7", "m8", "m11", "m12"], createdBy: "coach", createdAt: new Date(now.getTime() - 14 * 86400000).toISOString(), allowedPlanIds: [] },
  ];
}

const MEMBER_NAMES = { m1: "Alex R.", m2: "Jordan T.", m3: "Sam K.", m4: "Morgan L.", m5: "Casey P.", m6: "Riley W.", m7: "Jamie D.", m8: "Quinn B.", m9: "Avery N.", m10: "Drew M.", m11: "Taylor S.", m12: "Charlie F." };
const CURRENT_USER = "m1";

const ACCENT_COLORS = ["#8fbf3b", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"];
function eventColor(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return ACCENT_COLORS[Math.abs(h) % ACCENT_COLORS.length]; }

function generateCalLink(ev) {
  const s = ev.date.replace(/-/g, "") + "T" + ev.startTime.replace(":", "") + "00";
  const e = ev.date.replace(/-/g, "") + "T" + ev.endTime.replace(":", "") + "00";
  const details = encodeURIComponent(ev.description);
  const loc = encodeURIComponent(ev.locationUrl);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${s}/${e}&details=${details}&location=${loc}`;
}

/* ---- Calendar Mini Component ---- */
function MiniCalendar({ events, month, year, onChangeMonth, B }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

  const eventDays = new Set();
  events.forEach((ev) => {
    const d = new Date(ev.date + "T00:00:00");
    if (d.getMonth() === month && d.getFullYear() === year) eventDays.add(d.getDate());
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
  const todayStr = today();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = dateStr === todayStr;
    cells.push(
      <div key={d} style={{ textAlign: "center", padding: "4px 0", position: "relative", borderRadius: 6, background: isToday ? `${B.accent}22` : "transparent" }}>
        <span style={{ fontSize: 12, color: isToday ? B.accent : B.text, fontWeight: isToday ? 700 : 400 }}>{d}</span>
        {eventDays.has(d) && <div style={{ width: 5, height: 5, borderRadius: "50%", background: B.accent, margin: "2px auto 0" }} />}
      </div>
    );
  }

  return (
    <div style={{ background: B.card, borderRadius: 12, border: `1px solid ${B.border}`, padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => onChangeMonth(-1)} style={{ background: "none", border: "none", color: B.text, fontSize: 18, cursor: "pointer", padding: "4px 8px" }}>&lt;</button>
        <span style={{ fontWeight: 700, color: B.text, fontSize: 14 }}>{monthName}</span>
        <button onClick={() => onChangeMonth(1)} style={{ background: "none", border: "none", color: B.text, fontSize: 18, cursor: "pointer", padding: "4px 8px" }}>&gt;</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: B.muted, padding: "2px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>{cells}</div>
    </div>
  );
}

/* ---- Avatar Row ---- */
function AvatarRow({ rsvps, B, max = 5 }) {
  const shown = rsvps.slice(0, max);
  const extra = rsvps.length - max;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {shown.map((id, i) => {
        const name = MEMBER_NAMES[id] || id;
        return (
          <div key={id} title={name} style={{ width: 28, height: 28, borderRadius: "50%", background: ACCENT_COLORS[i % ACCENT_COLORS.length], color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${B.card}`, marginLeft: i > 0 ? -8 : 0, zIndex: max - i }}>
            {name.charAt(0)}
          </div>
        );
      })}
      {extra > 0 && <span style={{ fontSize: 11, color: B.muted, marginLeft: 6 }}>+{extra} more</span>}
    </div>
  );
}

/* ---- Event Card ---- */
function EventCard({ ev, B, onRsvp, onClick }) {
  const isGoing = ev.rsvps.includes(CURRENT_USER);
  const color = eventColor(ev.id);
  return (
    <div
      onClick={() => onClick(ev)}
      style={{ background: B.card, borderRadius: 12, border: `1px solid ${B.border}`, overflow: "hidden", cursor: "pointer", transition: "box-shadow 0.15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 4px 20px ${B.accent}22`)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      {/* Cover */}
      {ev.coverImage ? (
        <img src={ev.coverImage} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
      ) : (
        <div style={{ width: "100%", height: 80, background: `linear-gradient(135deg, ${color}44, ${color}11)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 28, opacity: 0.5 }}>{ev.locationType === "virtual" ? "\uD83D\uDCF9" : "\uD83C\uDFCB\uFE0F"}</span>
        </div>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: B.text }}>{ev.title}</span>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: ev.locationType === "virtual" ? "#3b82f622" : "#8fbf3b22", color: ev.locationType === "virtual" ? "#3b82f6" : "#8fbf3b", fontWeight: 600 }}>
            {ev.locationType === "virtual" ? "Virtual" : "In-Person"}
          </span>
          {isGoing && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: `${B.accent}22`, color: B.accent, fontWeight: 600 }}>You're going!</span>
          )}
          <PlanLockBadge allowedPlanIds={ev.allowedPlanIds} B={B} />
        </div>
        <div style={{ fontSize: 12, color: B.muted, marginBottom: 8 }}>
          {fmtDate(ev.date)} &middot; {fmtTime(ev.startTime)} - {fmtTime(ev.endTime)}
        </div>
        <div style={{ fontSize: 12, color: B.dim, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {ev.description}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AvatarRow rsvps={ev.rsvps} B={B} />
            <span style={{ fontSize: 11, color: B.muted }}>{ev.rsvps.length} going</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {isGoing && (
              <a href={generateCalLink(ev)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: B.accent, textDecoration: "none", padding: "4px 10px", borderRadius: 6, border: `1px solid ${B.accent}44` }}>
                Add to Calendar
              </a>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRsvp(ev.id); }}
              style={{ fontSize: 11, fontWeight: 600, padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: isGoing ? `${B.red}22` : B.accent, color: isGoing ? B.red : "#fff" }}
            >
              {isGoing ? "Cancel RSVP" : "RSVP"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Event Detail Modal ---- */
function EventDetailModal({ ev, B, onClose, onRsvp }) {
  if (!ev) return null;
  const isGoing = ev.rsvps.includes(CURRENT_USER);
  const color = eventColor(ev.id);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: B.card, borderRadius: 16, border: `1px solid ${B.border}`, width: "100%", maxWidth: 540, maxHeight: "85vh", overflowY: "auto" }}>
        {ev.coverImage ? (
          <img src={ev.coverImage} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: "16px 16px 0 0" }} />
        ) : (
          <div style={{ width: "100%", height: 120, background: `linear-gradient(135deg, ${color}44, ${color}11)`, borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 40, opacity: 0.5 }}>{ev.locationType === "virtual" ? "\uD83D\uDCF9" : "\uD83C\uDFCB\uFE0F"}</span>
          </div>
        )}
        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, color: B.text, fontSize: 20 }}>{ev.title}</h2>
              <div style={{ fontSize: 13, color: B.muted, marginTop: 4 }}>
                {fmtDate(ev.date)} &middot; {fmtTime(ev.startTime)} - {fmtTime(ev.endTime)}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: B.muted, fontSize: 20, cursor: "pointer", padding: 4 }}>x</button>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: ev.locationType === "virtual" ? "#3b82f622" : "#8fbf3b22", color: ev.locationType === "virtual" ? "#3b82f6" : "#8fbf3b", fontWeight: 600 }}>
              {ev.locationType === "virtual" ? "Virtual" : "In-Person"}
            </span>
            {ev.recurring && (
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: `${B.purple}22`, color: B.purple, fontWeight: 600 }}>
                Repeats {ev.recurring.frequency}
              </span>
            )}
            {isGoing && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: `${B.accent}22`, color: B.accent, fontWeight: 600 }}>You're going!</span>}
          </div>

          {/* Location */}
          <div style={{ background: B.dark, borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: B.muted, marginBottom: 4, fontWeight: 600 }}>Location</div>
            {ev.locationType === "virtual" ? (
              <a href={ev.locationUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: B.accent, wordBreak: "break-all" }}>{ev.locationUrl}</a>
            ) : (
              <span style={{ fontSize: 13, color: B.text }}>{ev.locationUrl}</span>
            )}
          </div>

          {/* Description */}
          <div style={{ fontSize: 13, color: B.text, lineHeight: 1.6, marginBottom: 20, whiteSpace: "pre-wrap" }}>{ev.description}</div>

          {/* Attendees */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: B.muted, fontWeight: 600, marginBottom: 8 }}>Attendees ({ev.rsvps.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ev.rsvps.map((id) => {
                const name = MEMBER_NAMES[id] || id;
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, background: B.dark, borderRadius: 99, padding: "4px 12px 4px 4px" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: B.accent, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{name.charAt(0)}</div>
                    <span style={{ fontSize: 12, color: B.text }}>{name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => onRsvp(ev.id)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: isGoing ? `${B.red}22` : B.accent, color: isGoing ? B.red : "#fff" }}
            >
              {isGoing ? "Cancel RSVP" : "RSVP"}
            </button>
            {isGoing && (
              <a href={generateCalLink(ev)} target="_blank" rel="noreferrer" style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${B.accent}`, color: B.accent, fontWeight: 600, fontSize: 13, textDecoration: "none", textAlign: "center", display: "block" }}>
                Add to Calendar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- New Event Form Modal ---- */
function NewEventModal({ B, onClose, onSave }) {
  const [form, setForm] = useState({ title: "", description: "", date: today(), startTime: "09:00", endTime: "10:00", locationType: "virtual", locationUrl: "", coverImage: "", recurringEnabled: false, recurringFreq: "weekly", allowedPlanIds: [] });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${B.border}`, background: B.dark, color: B.text, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: B.muted, fontWeight: 600, marginBottom: 4, display: "block" };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.date) return;
    const ev = {
      id: uuid(),
      title: form.title.trim(),
      description: form.description.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      locationType: form.locationType,
      locationUrl: form.locationUrl.trim(),
      coverImage: form.coverImage.trim(),
      recurring: form.recurringEnabled ? { frequency: form.recurringFreq, dayOfWeek: new Date(form.date + "T00:00:00").getDay() } : null,
      allowedPlanIds: form.allowedPlanIds,
      rsvps: [],
      createdBy: "coach",
      createdAt: new Date().toISOString(),
    };
    onSave(ev);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: B.card, borderRadius: 16, border: `1px solid ${B.border}`, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: B.text, fontSize: 18 }}>New Event</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: B.muted, fontSize: 20, cursor: "pointer" }}>x</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Event title" />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What's this event about?" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" style={inputStyle} value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Start Time</label>
              <input type="time" style={inputStyle} value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>End Time</label>
              <input type="time" style={inputStyle} value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Location Type</label>
            <select style={inputStyle} value={form.locationType} onChange={(e) => set("locationType", e.target.value)}>
              <option value="virtual">Virtual</option>
              <option value="in-person">In-Person</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>{form.locationType === "virtual" ? "Meeting Link" : "Address"}</label>
            <input style={inputStyle} value={form.locationUrl} onChange={(e) => set("locationUrl", e.target.value)} placeholder={form.locationType === "virtual" ? "https://zoom.us/j/..." : "123 Gym Street"} />
          </div>
          <div>
            <label style={labelStyle}>Cover Image (optional)</label>
            <ImageUploadZone value={form.coverImage} onChange={(url) => set("coverImage", url)} label="Upload Cover Image" />
          </div>
          <div>
            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={form.recurringEnabled} onChange={(e) => set("recurringEnabled", e.target.checked)} />
              Recurring event
            </label>
            {form.recurringEnabled && (
              <select style={{ ...inputStyle, marginTop: 6 }} value={form.recurringFreq} onChange={(e) => set("recurringFreq", e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>
          <PlanAccessPicker allowedPlanIds={form.allowedPlanIds} onChange={(ids) => set("allowedPlanIds", ids)} B={B} labelStyle={labelStyle} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${B.border}`, background: "transparent", color: B.text, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSubmit} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: B.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: form.title.trim() ? 1 : 0.5 }}>Create Event</button>
        </div>
      </div>
    </div>
  );
}

/* ==== MAIN VIEW ==== */
export default function EventsView() {
  const B = useTheme();
  const [events, setEvents] = useLocalStorage("hf_community_events", []);
  const [tab, setTab] = useState("upcoming");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const todayStr = today();
  const safeEvents = Array.isArray(events) ? events : [];
  const { upcoming, past } = useMemo(() => {
    const u = [], p = [];
    safeEvents.forEach((ev) => (ev.date >= todayStr ? u : p).push(ev));
    u.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    p.sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
    return { upcoming: u, past: p };
  }, [safeEvents, todayStr]);

  const displayed = tab === "upcoming" ? upcoming : past;

  const handleRsvp = (id) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== id) return ev;
        const has = ev.rsvps.includes(CURRENT_USER);
        return { ...ev, rsvps: has ? ev.rsvps.filter((r) => r !== CURRENT_USER) : [...ev.rsvps, CURRENT_USER] };
      })
    );
    // Update selectedEvent if open
    setSelectedEvent((prev) => {
      if (!prev || prev.id !== id) return prev;
      const has = prev.rsvps.includes(CURRENT_USER);
      return { ...prev, rsvps: has ? prev.rsvps.filter((r) => r !== CURRENT_USER) : [...prev.rsvps, CURRENT_USER] };
    });
  };

  const handleNewEvent = (ev) => {
    setEvents((prev) => [...prev, ev]);
    setShowNew(false);
  };

  const changeMonth = (dir) => {
    let m = calMonth + dir, y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalMonth(m);
    setCalYear(y);
  };

  const tabBtn = (label, value) => ({
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: tab === value ? B.accent : "transparent",
    color: tab === value ? "#fff" : B.muted,
  });

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, color: B.text, fontSize: 22 }}>Events</h1>
        <button onClick={() => setShowNew(true)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>+ New Event</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button style={tabBtn("Upcoming", "upcoming")} onClick={() => setTab("upcoming")}>Upcoming ({upcoming.length})</button>
        <button style={tabBtn("Past", "past")} onClick={() => setTab("past")}>Past ({past.length})</button>
      </div>

      {/* Mini Calendar */}
      <MiniCalendar events={safeEvents} month={calMonth} year={calYear} onChangeMonth={changeMonth} B={B} />

      {/* Event List */}
      {displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: B.muted, fontSize: 14 }}>No {tab} events</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {displayed.map((ev) => (
            <EventCard key={ev.id} ev={ev} B={B} onRsvp={handleRsvp} onClick={setSelectedEvent} />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedEvent && <EventDetailModal ev={selectedEvent} B={B} onClose={() => setSelectedEvent(null)} onRsvp={handleRsvp} />}

      {/* New Event Modal */}
      {showNew && <NewEventModal B={B} onClose={() => setShowNew(false)} onSave={handleNewEvent} />}
    </div>
  );
}
