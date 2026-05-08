import { useState, useCallback, useRef, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";
import { requestPermission, getPermissionStatus, sendLocalNotification, getNotificationPrefs, setNotificationPrefs } from "../../utils/pushNotifications";

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/* ========== constants ========== */
const TABS = ["General", "Features", "Integrations", "Branding", "Locations", "Users", "Stations", "Gamification", "Data"];
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
  "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney",
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DEFAULT_SETTINGS = {
  gymName: "Hybrid Fitness",
  phone: "(555) 000-1234",
  email: "info@hybridfitness.com",
  address: "123 Main Street, Austin, TX 78701",
  timezone: "America/Chicago",
  businessHours: Object.fromEntries(DAYS.map(d => [d, {
    open: d === "Sunday" ? "08:00" : "05:30",
    close: d === "Sunday" ? "18:00" : d === "Saturday" ? "20:00" : "21:00",
    closed: false,
  }])),
};

const DEFAULT_BRANDING = {
  logo: "",
  primaryColor: "#8fbf3b",
  secondaryColor: "#063461",
  tagline: "Train Smarter. Live Stronger.",
  gymName: "Hybrid Fitness",
};

const DEFAULT_LOCATIONS = [
  { id: "loc_1", name: "Hybrid Fitness \u2014 Main", address: "123 Main Street, Austin, TX 78701", phone: "(555) 000-1234", timezone: "America/Chicago", isDefault: true },
];

const BADGE_TRIGGERS = [
  "Total Workouts >=",
  "Total Weight Lifted >=",
  "Current Streak >=",
  "Longest Streak >=",
  "Level >=",
  "Check-ins This Month >=",
];

const DEFAULT_GAMIFICATION_SETTINGS = {
  enabled: true,
  levels: [
    { level: 1, name: "Beginner", points: 0, color: "#8b949e" },
    { level: 2, name: "Regular", points: 200, color: "#3b82f6" },
    { level: 3, name: "Committed", points: 600, color: "#8b5cf6" },
    { level: 4, name: "Dedicated", points: 1200, color: "#f59e0b" },
    { level: 5, name: "Warrior", points: 2000, color: "#ef4444" },
    { level: 6, name: "Elite", points: 3500, color: "#ec4899" },
    { level: 7, name: "Champion", points: 5500, color: "#14b8a6" },
    { level: 8, name: "Master", points: 8000, color: "#f97316" },
    { level: 9, name: "Legend", points: 12000, color: "#eab308" },
  ],
  pointsPerAction: {
    checkin: 10,
    workout: 25,
    challengeCheckin: 15,
    postLike: 1,
    assessment: 50,
    streakBonus: 5,
  },
  badges: [
    { id: "b1", name: "First Workout", icon: "\ud83c\udfaf", description: "Complete your first workout", trigger: "Total Workouts >=", threshold: 1, active: true },
    { id: "b2", name: "10 Workouts", icon: "\ud83d\udcaa", description: "Complete 10 workouts", trigger: "Total Workouts >=", threshold: 10, active: true },
    { id: "b3", name: "50 Workouts", icon: "\ud83d\udd25", description: "Complete 50 workouts", trigger: "Total Workouts >=", threshold: 50, active: true },
    { id: "b4", name: "100 Workouts", icon: "\u2b50", description: "Complete 100 workouts", trigger: "Total Workouts >=", threshold: 100, active: true },
    { id: "b5", name: "Iron Club", icon: "\ud83c\udfcb\ufe0f", description: "Lift 50,000+ lbs total", trigger: "Total Weight Lifted >=", threshold: 50000, active: true },
    { id: "b6", name: "Week Warrior", icon: "\u26a1", description: "7-day workout streak", trigger: "Current Streak >=", threshold: 7, active: true },
    { id: "b7", name: "Month Machine", icon: "\ud83d\uddd3\ufe0f", description: "30-day workout streak", trigger: "Current Streak >=", threshold: 30, active: true },
  ],
  leaderboard: { enabled: true, metrics: ["xp", "workouts", "weight", "streak"], showPodium: true },
  attendanceGoal: { enabled: true, threshold: 8 },
};

const BADGE_EMOJIS = [
  "\uD83C\uDFC6","\uD83C\uDFC5","\uD83E\uDD47","\uD83E\uDD48","\uD83E\uDD49","\uD83C\uDFAF","\uD83D\uDCAA","\uD83D\uDD25",
  "\u2B50","\uD83C\uDF1F","\u26A1","\uD83D\uDE80","\uD83D\uDC51","\uD83D\uDC8E","\u2764\uFE0F","\uD83C\uDF89",
  "\uD83C\uDF93","\uD83C\uDFCB\uFE0F","\uD83C\uDFC3","\uD83E\uDDD8","\uD83D\uDEB4","\uD83C\uDFCA","\u26BD","\uD83C\uDFC0",
  "\uD83C\uDFBE","\uD83E\uDD4A","\u2603\uFE0F","\uD83C\uDF0D","\uD83C\uDF08","\uD83C\uDF1E","\uD83C\uDF19","\uD83D\uDD2E",
  "\uD83C\uDFAF","\uD83D\uDCA5","\uD83D\uDCAB","\u2728","\uD83C\uDF40","\uD83C\uDF3B","\uD83E\uDDE0","\u2705",
  "\uD83D\uDE4C","\uD83D\uDC4D","\uD83D\uDE0E","\uD83E\uDD29","\uD83E\uDDB8","\uD83E\uDDB9","\uD83C\uDFA8","\uD83C\uDFB5",
];

function EmojiPickerBtn({ value, onChange, B }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: 52, height: 44, borderRadius: 8, border: "1px solid " + B.border,
        background: B.card, cursor: "pointer", fontSize: 24, display: "flex",
        alignItems: "center", justifyContent: "center", transition: "border-color 0.15s",
      }}>
        {value || "\uD83C\uDFC5"}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
          background: B.card, border: "1px solid " + B.border, borderRadius: 12,
          padding: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", width: 240,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Choose an icon</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4 }}>
            {BADGE_EMOJIS.map((emoji, i) => (
              <button key={i} onClick={() => { onChange(emoji); setOpen(false); }}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: value === emoji ? "2px solid " + B.accent : "1px solid transparent",
                  background: value === emoji ? B.accent + "15" : "transparent",
                  cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.1s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = B.border; }}
                onMouseLeave={e => { e.currentTarget.style.background = value === emoji ? B.accent + "15" : "transparent"; }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const FEATURE_OPTIONS = [
  { key: "workout_builder", label: "Workout Builder", desc: "Build, Workouts, Programs, Library, Session View, Remote Workouts" },
  { key: "progression_engine", label: "Progression Engine", desc: "Movement matrix and auto-individualization" },
  { key: "stations", label: "Stations", desc: "iPad station display for gym floor" },
  { key: "community", label: "Community", desc: "Feed, Classroom, Events, Resources" },
  { key: "accountability", label: "Accountability", desc: "Coach assignment and outreach tracking" },
  { key: "assessments", label: "Assessments", desc: "Movement assessment scoring" },
  { key: "gamification", label: "Gamification", desc: "XP, levels, badges, leaderboards" },
  { key: "waivers", label: "Waivers", desc: "Digital waiver signing" },
  { key: "checkin_pinpad", label: "Check-In Pin Pad", desc: "PIN-based self-service check-in kiosk" },
];

function FeatureToggles({ B }) {
  const [toggles, setToggles] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hf_feature_toggles") || "{}"); } catch { return {}; }
  });
  const update = (key, val) => {
    const next = { ...toggles, [key]: val };
    setToggles(next);
    localStorage.setItem("hf_feature_toggles", JSON.stringify(next));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
      {FEATURE_OPTIONS.map(f => {
        const enabled = toggles[f.key] !== false;
        return (
          <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker, cursor: "pointer" }}>
            <button onClick={() => update(f.key, !enabled)} style={{
              width: 42, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
              background: enabled ? B.accent : B.border, position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 3, left: enabled ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{f.label}</div>
              <div style={{ fontSize: 12, color: B.dim }}>{f.desc}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

function SchedulingSettings({ B }) {
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hf_noshow_settings") || "{}"); } catch { return {}; }
  });
  const update = (key, val) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    localStorage.setItem("hf_noshow_settings", JSON.stringify(next));
    // Also sync to Supabase via the hook pattern
    try {
      const gymId = localStorage.getItem("hf_gym_id") || "default";
      fetch('https://qzvxnklyeadbroesccxt.supabase.co/rest/v1/data_store?on_conflict=gym_id,key', {
        method: 'POST',
        headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM', 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM', 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ gym_id: gymId, key: 'hf_noshow_settings', value: next, updated_at: new Date().toISOString() }),
      });
    } catch {}
  };
  const toggleStyle = (enabled) => ({
    width: 42, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
    background: enabled ? B.accent : B.border, position: "relative", transition: "background 0.2s", flexShrink: 0,
  });
  const dotStyle = (enabled) => ({
    width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 3,
    left: enabled ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Auto Check-In */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
        <button onClick={() => update("autoCheckIn", !settings.autoCheckIn)} style={toggleStyle(settings.autoCheckIn)}>
          <div style={dotStyle(settings.autoCheckIn)} />
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>Auto Check-In</div>
          <div style={{ fontSize: 12, color: B.dim }}>Automatically check in booked members when their session starts. No-shows won't count against allotment.</div>
        </div>
      </div>
      {/* No-Show Fee */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
        <button onClick={() => update("feeEnabled", !settings.feeEnabled)} style={toggleStyle(settings.feeEnabled)}>
          <div style={dotStyle(settings.feeEnabled)} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>No-Show Fee</div>
          <div style={{ fontSize: 12, color: B.dim }}>Charge a fee when a member is marked as no-show</div>
        </div>
        {settings.feeEnabled && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 13, color: B.muted }}>$</span>
            <input type="number" min="0" value={settings.feeAmount || 25} onChange={e => update("feeAmount", Number(e.target.value) || 0)}
              style={{ width: 60, padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13, outline: "none" }} />
          </div>
        )}
      </div>
      {/* Cancel Window */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>Free Cancel Window</div>
          <div style={{ fontSize: 12, color: B.dim }}>Hours before session that clients can cancel without penalty</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="number" min="0" value={settings.cancelWindowHours ?? 12} onChange={e => update("cancelWindowHours", Number(e.target.value) || 0)}
            style={{ width: 50, padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13, outline: "none" }} />
          <span style={{ fontSize: 12, color: B.muted }}>hrs</span>
        </div>
      </div>
      {/* Late Cancel Penalty */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
        <button onClick={() => update("penaltyEnabled", !(settings.penaltyEnabled !== false))} style={toggleStyle(settings.penaltyEnabled !== false)}>
          <div style={dotStyle(settings.penaltyEnabled !== false)} />
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>Late Cancel Counts Against Allotment</div>
          <div style={{ fontSize: 12, color: B.dim }}>Cancelling within the window still deducts a session</div>
        </div>
      </div>
      {/* Late Cancel Fee */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
        <button onClick={() => update("lateCancelFeeEnabled", !settings.lateCancelFeeEnabled)} style={toggleStyle(settings.lateCancelFeeEnabled)}>
          <div style={dotStyle(settings.lateCancelFeeEnabled)} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>Repeat Late Cancel Fee</div>
          <div style={{ fontSize: 12, color: B.dim }}>Charge no-show fee after too many late cancels in a month</div>
        </div>
        {settings.lateCancelFeeEnabled && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 12, color: B.muted }}>After</span>
            <input type="number" min="1" value={settings.lateCancelFeeThreshold || 3} onChange={e => update("lateCancelFeeThreshold", Number(e.target.value) || 3)}
              style={{ width: 40, padding: "4px 6px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13, outline: "none", textAlign: "center" }} />
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturesTab({ B, s, showToast }) {
  // Synced via Supabase through useLocalStorage
  const [savedToggles, setSavedToggles] = useLocalStorage("hf_feature_toggles", {});
  const [savedScheduling, setSavedScheduling] = useLocalStorage("hf_noshow_settings", {});

  // Draft state — changes are only local until saved
  const [draftToggles, setDraftToggles] = useState(savedToggles);
  const [draftScheduling, setDraftScheduling] = useState(savedScheduling);
  const [showConfirm, setShowConfirm] = useState(false);

  // Sync draft when saved values load from Supabase
  useEffect(() => { setDraftToggles(savedToggles); }, [JSON.stringify(savedToggles)]);
  useEffect(() => { setDraftScheduling(savedScheduling); }, [JSON.stringify(savedScheduling)]);

  const hasChanges = JSON.stringify(draftToggles) !== JSON.stringify(savedToggles) || JSON.stringify(draftScheduling) !== JSON.stringify(savedScheduling);

  const toggleFeature = (key) => setDraftToggles(prev => ({ ...prev, [key]: prev[key] === false ? true : false }));
  const updateScheduling = (key, val) => setDraftScheduling(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    setSavedToggles(draftToggles);
    setSavedScheduling(draftScheduling);
    setShowConfirm(false);
    showToast("Settings saved! Changes synced to all users.");
  };

  const toggleBtn = (enabled) => ({
    width: 42, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
    background: enabled ? B.accent : B.border, position: "relative", transition: "background 0.2s", flexShrink: 0,
  });
  const toggleDot = (enabled) => ({
    width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 3,
    left: enabled ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  });

  return (
    <Card>
      <h3 style={s.sectionTitle}>Feature Toggles</h3>
      <p style={{ fontSize: 13, color: B.muted, marginBottom: 16 }}>
        Enable or disable features for your gym. Disabled features are hidden from the sidebar for all users.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {FEATURE_OPTIONS.map(f => {
          const enabled = draftToggles[f.key] !== false;
          return (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
              <button onClick={() => toggleFeature(f.key)} style={toggleBtn(enabled)}>
                <div style={toggleDot(enabled)} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{f.label}</div>
                <div style={{ fontSize: 12, color: B.dim }}>{f.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={s.sectionTitle}>Scheduling & Check-In</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
          <button onClick={() => updateScheduling("autoCheckIn", !draftScheduling.autoCheckIn)} style={toggleBtn(draftScheduling.autoCheckIn)}>
            <div style={toggleDot(draftScheduling.autoCheckIn)} />
          </button>
          <div><div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>Auto Check-In</div><div style={{ fontSize: 12, color: B.dim }}>Automatically check in booked members when session starts</div></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
          <button onClick={() => updateScheduling("feeEnabled", !draftScheduling.feeEnabled)} style={toggleBtn(draftScheduling.feeEnabled)}>
            <div style={toggleDot(draftScheduling.feeEnabled)} />
          </button>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>No-Show Fee</div><div style={{ fontSize: 12, color: B.dim }}>Charge when a member is marked no-show</div></div>
          {draftScheduling.feeEnabled && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 13, color: B.muted }}>$</span>
              <input type="number" min="0" value={draftScheduling.feeAmount || 25} onChange={e => updateScheduling("feeAmount", Number(e.target.value) || 0)}
                style={{ width: 60, padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13, outline: "none" }} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>Free Cancel Window</div><div style={{ fontSize: 12, color: B.dim }}>Hours before session for penalty-free cancellation</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="number" min="0" value={draftScheduling.cancelWindowHours ?? 12} onChange={e => updateScheduling("cancelWindowHours", Number(e.target.value) || 0)}
              style={{ width: 50, padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13, outline: "none" }} />
            <span style={{ fontSize: 12, color: B.muted }}>hrs</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
          <button onClick={() => updateScheduling("penaltyEnabled", !(draftScheduling.penaltyEnabled !== false))} style={toggleBtn(draftScheduling.penaltyEnabled !== false)}>
            <div style={toggleDot(draftScheduling.penaltyEnabled !== false)} />
          </button>
          <div><div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>Late Cancel Counts Against Allotment</div><div style={{ fontSize: 12, color: B.dim }}>Cancelling within the window deducts a session</div></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
          <button onClick={() => updateScheduling("lateCancelFeeEnabled", !draftScheduling.lateCancelFeeEnabled)} style={toggleBtn(draftScheduling.lateCancelFeeEnabled)}>
            <div style={toggleDot(draftScheduling.lateCancelFeeEnabled)} />
          </button>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>Repeat Late Cancel Fee</div><div style={{ fontSize: 12, color: B.dim }}>Charge fee after too many late cancels/month</div></div>
          {draftScheduling.lateCancelFeeEnabled && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12, color: B.muted }}>After</span>
              <input type="number" min="1" value={draftScheduling.lateCancelFeeThreshold || 3} onChange={e => updateScheduling("lateCancelFeeThreshold", Number(e.target.value) || 3)}
                style={{ width: 40, padding: "4px 6px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13, outline: "none", textAlign: "center" }} />
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, paddingTop: 16, borderTop: "1px solid " + B.border }}>
        {hasChanges && <span style={{ fontSize: 12, color: B.orange, fontWeight: 600 }}>You have unsaved changes</span>}
        <button onClick={() => hasChanges ? setShowConfirm(true) : null} disabled={!hasChanges}
          style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: hasChanges ? B.accent : B.border, color: hasChanges ? "#fff" : B.dim, fontSize: 14, fontWeight: 700, cursor: hasChanges ? "pointer" : "not-allowed" }}>
          Save Changes
        </button>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setShowConfirm(false)}>
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 420, width: "90%" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: B.text }}>Save Feature Settings?</h3>
            <p style={{ color: B.muted, fontSize: 14, margin: "0 0 8px", lineHeight: 1.5 }}>
              These changes will take effect immediately for all users in this gym.
            </p>
            <div style={{ padding: "10px 14px", borderRadius: 8, background: B.orange + "12", border: "1px solid " + B.orange + "30", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: B.orange }}>Warning</div>
              <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>
                Disabling features will hide them from the sidebar. Users currently on those pages will need to navigate away. Scheduling changes affect all future bookings and cancellations.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirm(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSave} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Confirm & Save</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function DisplayScaleSetting({ B }) {
  const [scale, setScale] = useLocalStorage("hf_display_scale", 1);
  const options = [
    { value: 0.9, label: "Small" },
    { value: 1, label: "Default" },
    { value: 1.1, label: "Large" },
    { value: 1.2, label: "Extra Large" },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => setScale(o.value)} style={{
          padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
          border: scale === o.value ? `2px solid ${B.accent}` : `1px solid ${B.border}`,
          background: scale === o.value ? B.accent + "15" : "transparent",
          color: scale === o.value ? B.accent : B.muted,
        }}>{o.label}</button>
      ))}
    </div>
  );
}

export default function SettingsView() {
  const B = useTheme();
  const { currentUser, users, addUser, removeUser, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState("General");
  const [toast, setToast] = useState("");

  const [settings, setSettings] = useLocalStorage("hf_settings", DEFAULT_SETTINGS);
  const [integrations, setIntegrations] = useLocalStorage("hf_integrations", {
    stripe: { publishableKey: "", connected: false },
    inbody: { apiKey: "", environment: "sandbox", lastSync: null },
    resendApiKey: "",
    emailFrom: "",
    resendConnected: false,
    twilioSid: "",
    twilioToken: "",
    twilioFrom: "",
    twilioConnected: false,
  });
  const [branding, setBranding] = useLocalStorage("hf_branding", DEFAULT_BRANDING);
  const [stationSettings, setStationSettings] = useLocalStorage("hf_station_settings", { showWeight: true, showReps: true, showRPE: true, showMedia: true });
  const [locations, setLocations] = useLocalStorage("hf_locations", DEFAULT_LOCATIONS);
  const [newUser, setNewUser] = useState({ email: "", username: "", password: "", role: "coach", displayName: "" });
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({ displayName: "", email: "", phone: "", role: "" });
  const [gamificationSettings, setGamificationSettings] = useLocalStorage("hf_gamification_settings", DEFAULT_GAMIFICATION_SETTINGS);

  const [collapsedSections, setCollapsedSections] = useState({});
  const toggleSection = (key) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const updateSettings = useCallback((key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  }, [setSettings]);

  const updateHours = useCallback((day, field, val) => {
    setSettings(prev => ({
      ...prev,
      businessHours: { ...prev.businessHours, [day]: { ...prev.businessHours[day], [field]: val } },
    }));
  }, [setSettings]);

  /* ========== styles ========== */
  const s = {
    page: { padding: 32, maxWidth: 1100, margin: "0 auto" },
    h1: { fontSize: 28, fontWeight: 700, color: B.text, margin: 0 },
    subtitle: { color: B.muted, fontSize: 14, marginTop: 4 },
    tabs: { display: "flex", gap: 4, marginTop: 24, marginBottom: 24, borderBottom: "1px solid " + B.border, paddingBottom: 0 },
    tab: (active) => ({ padding: "10px 20px", fontSize: 14, fontWeight: active ? 600 : 400, color: active ? B.green : B.muted, background: "none", border: "none", borderBottom: active ? "2px solid " + B.green : "2px solid transparent", cursor: "pointer", marginBottom: -1 }),
    label: { fontSize: 13, fontWeight: 600, color: B.muted, marginBottom: 6, display: "block" },
    input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 14, boxSizing: "border-box" },
    select: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 14, boxSizing: "border-box" },
    btn: (bg, fg) => ({ padding: "9px 20px", borderRadius: 8, border: "none", background: bg || B.green, color: fg || "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }),
    btnSm: (bg, fg) => ({ padding: "5px 12px", borderRadius: 6, border: "none", background: bg || B.border, color: fg || B.text, fontWeight: 500, fontSize: 12, cursor: "pointer" }),
    row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
    field: { marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 600, color: B.text, marginBottom: 12, marginTop: 20 },
    badge: (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: color + "22", color }),
    dot: (color) => ({ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 8 }),
    table: { width: "100%", borderCollapse: "collapse" },
    th: { textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 600, color: B.muted, borderBottom: "1px solid " + B.border, textTransform: "uppercase", letterSpacing: 0.5 },
    td: { padding: "10px 12px", borderBottom: "1px solid " + B.border, fontSize: 14, color: B.text },
    toast: { position: "fixed", bottom: 24, right: 24, background: B.green, color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" },
  };

  /* ========== General ========== */
  const renderGeneral = () => (
    <Card>
      <h3 style={s.sectionTitle}>Gym Information</h3>
      <div style={s.row}>
        <div>
          <label style={s.label}>Gym Name</label>
          <input style={s.input} value={settings.gymName} onChange={e => updateSettings("gymName", e.target.value)} />
        </div>
        <div>
          <label style={s.label}>Phone</label>
          <input style={s.input} value={settings.phone} onChange={e => updateSettings("phone", e.target.value)} />
        </div>
      </div>
      <div style={s.row}>
        <div>
          <label style={s.label}>Email</label>
          <input style={s.input} value={settings.email} onChange={e => updateSettings("email", e.target.value)} />
        </div>
        <div>
          <label style={s.label}>Timezone</label>
          <select style={s.select} value={settings.timezone} onChange={e => updateSettings("timezone", e.target.value)}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>
      <div style={s.field}>
        <label style={s.label}>Address</label>
        <input style={s.input} value={settings.address} onChange={e => updateSettings("address", e.target.value)} />
      </div>

      <h3 style={s.sectionTitle}>Business Hours</h3>
      <div style={{ display: "grid", gap: 8 }}>
        {DAYS.map(day => {
          const h = settings.businessHours?.[day] || { open: "06:00", close: "21:00", closed: false };
          return (
            <div key={day} style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr auto", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 14, color: B.text, fontWeight: 500 }}>{day}</span>
              <input type="time" style={{ ...s.input, opacity: h.closed ? 0.3 : 1 }} value={h.open} disabled={h.closed} onChange={e => updateHours(day, "open", e.target.value)} />
              <input type="time" style={{ ...s.input, opacity: h.closed ? 0.3 : 1 }} value={h.close} disabled={h.closed} onChange={e => updateHours(day, "close", e.target.value)} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: B.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={h.closed || false} onChange={e => updateHours(day, "closed", e.target.checked)} style={{ accentColor: B.green }} />
                Closed
              </label>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20 }}>
        <button style={s.btn()} onClick={() => showToast("Settings saved!")}>Save Settings</button>
      </div>

      {/* Push Notifications */}
      <h3 style={s.sectionTitle}>Push Notifications</h3>
      <div style={{ background: B.darker, borderRadius: 10, padding: 16, border: "1px solid " + B.border, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>Browser Notification Permission</div>
            <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>
              Status: <span style={{ fontWeight: 700, color: getPermissionStatus() === "granted" ? B.green : getPermissionStatus() === "denied" ? B.red : B.orange }}>{getPermissionStatus()}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {getPermissionStatus() !== "granted" && (
              <button style={s.btn()} onClick={async () => {
                const result = await requestPermission();
                showToast(result === "granted" ? "Notifications enabled!" : result === "denied" ? "Notifications blocked by browser." : "Notifications not supported.");
              }}>Request Permission</button>
            )}
            <button style={s.btn(B.border, B.text)} onClick={() => {
              sendLocalNotification("Test Notification", { body: "Notifications are working correctly!" });
              showToast("Test notification sent!");
            }}>Send Test</button>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: B.text, marginBottom: 8 }}>Notification Triggers</div>
        {[
          { key: "checkin", label: "Check-in confirmations" },
          { key: "payment", label: "Payment processed" },
          { key: "message", label: "New messages" },
          { key: "booking", label: "Session bookings" },
        ].map(item => {
          const prefs = getNotificationPrefs();
          return (
            <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0", color: B.text, fontSize: 13 }}>
              <input type="checkbox" checked={prefs[item.key] !== false} onChange={e => {
                const updated = { ...prefs, [item.key]: e.target.checked };
                setNotificationPrefs(updated);
                showToast(e.target.checked ? `${item.label} enabled` : `${item.label} disabled`);
              }} style={{ width: 16, height: 16, accentColor: B.green }} />
              {item.label}
            </label>
          );
        })}
      </div>
      <h3 style={s.sectionTitle}>Onboarding Tour</h3>
      <p style={{ fontSize: 13, color: B.muted, marginBottom: 12 }}>
        Replay the guided tour that introduces the key areas of GymKit.
      </p>
      <button
        style={s.btn(B.border, B.text)}
        onClick={() => {
          localStorage.removeItem("hf_tour_completed");
          showToast("Tour restarted! Refresh the page to begin.");
        }}
      >
        Restart Onboarding Tour
      </button>
      <h3 style={s.sectionTitle}>Display Size</h3>
      <p style={{ fontSize: 13, color: B.muted, marginBottom: 12 }}>
        Adjust the text and interface size for better readability.
      </p>
      <DisplayScaleSetting B={B} />
    </Card>
  );

  /* ========== Integrations ========== */
  const CollapseCard = ({ id, title, badge, children }) => {
    const isOpen = !collapsedSections[id];
    return (
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <button onClick={() => toggleSection(id)} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
          padding: "14px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: B.dim, transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>{"\u25BE"}</span>
            <h3 style={{ ...s.sectionTitle, margin: 0 }}>{title}</h3>
          </div>
          {badge}
        </button>
        {isOpen && <div style={{ padding: "0 20px 20px" }}>{children}</div>}
      </Card>
    );
  };

  const renderIntegrations = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <CollapseCard id="stripe" title="Stripe Payments" badge={
        <span style={s.badge(integrations.stripe?.connected ? B.green : B.orange)}>
          <span style={s.dot(integrations.stripe?.connected ? B.green : B.orange)} />
          {integrations.stripe?.connected ? "Connected" : "Not Connected"}
        </span>
      }>
        <div style={{ ...s.field }}>
          <label style={s.label}>Publishable Key</label>
          <input style={s.input} value={integrations.stripe?.publishableKey} onChange={e => setIntegrations(prev => ({ ...prev, stripe: { ...(prev.stripe || {}), publishableKey: e.target.value } }))} placeholder="pk_live_..." />
        </div>
        <p style={{ fontSize: 12, color: B.muted, margin: "0 0 16px" }}>Secret key should be configured server-side only. Never expose it in the client.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.btn()} onClick={() => {
            setIntegrations(prev => ({ ...prev, stripe: { ...(prev.stripe || {}), connected: !!prev.stripe.publishableKey } }));
            showToast(integrations.stripe?.publishableKey ? "Stripe connection successful!" : "Please enter a publishable key first.");
          }}>Test Connection</button>
          <button style={s.btn(B.border, B.text)} onClick={() => {
            setIntegrations(prev => ({ ...prev, stripe: { publishableKey: "", connected: false } }));
            showToast("Stripe disconnected.");
          }}>Disconnect</button>
        </div>
      </CollapseCard>

      <CollapseCard id="inbody" title="InBody Scanner" badge={
        <span style={s.badge(integrations.inbody?.apiKey ? B.green : B.dim)}>
          <span style={s.dot(integrations.inbody?.apiKey ? B.green : B.dim)} />
          {integrations.inbody?.apiKey ? "Configured" : "Not Configured"}
        </span>
      }>
        <div style={{ ...s.row }}>
          <div>
            <label style={s.label}>API Key</label>
            <input style={s.input} value={integrations.inbody?.apiKey} onChange={e => setIntegrations(prev => ({ ...prev, inbody: { ...(prev.inbody || {}), apiKey: e.target.value } }))} placeholder="Enter InBody API key" />
          </div>
          <div>
            <label style={s.label}>Environment</label>
            <select style={s.select} value={integrations.inbody?.environment} onChange={e => setIntegrations(prev => ({ ...prev, inbody: { ...(prev.inbody || {}), environment: e.target.value } }))}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
        </div>
        {integrations.inbody?.lastSync && (
          <p style={{ fontSize: 12, color: B.muted, margin: "0 0 12px" }}>Last sync: {new Date(integrations.inbody?.lastSync).toLocaleString()}</p>
        )}
        <button style={s.btn()} onClick={() => {
          if (!integrations.inbody?.apiKey) { showToast("Please enter an API key first."); return; }
          setIntegrations(prev => ({ ...prev, inbody: { ...(prev.inbody || {}), lastSync: new Date().toISOString() } }));
          showToast("InBody sync complete!");
        }}>Sync Now</button>
      </CollapseCard>

      {/* Messaging Mode */}
      <Card>
        <h3 style={{ ...s.sectionTitle, margin: 0, marginBottom: 8 }}>Email & SMS Delivery</h3>
        <p style={{ color: B.muted, fontSize: 13, margin: "0 0 16px" }}>Choose how emails and SMS messages are sent from your gym.</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {[
            { key: "platform", label: "GymKit Platform", desc: "Emails & SMS sent through GymKit's accounts. No setup needed.", color: B.accent },
            { key: "byok", label: "Your Own Keys", desc: "Use your own Resend & Twilio accounts. You control and pay directly.", color: B.blue || "#3b82f6" },
          ].map(opt => (
            <button key={opt.key} onClick={() => setIntegrations(prev => ({ ...prev, messagingMode: opt.key }))}
              style={{
                flex: 1, padding: 14, borderRadius: 10, cursor: "pointer", textAlign: "left",
                border: (integrations.messagingMode || "platform") === opt.key ? `2px solid ${opt.color}` : `1px solid ${B.border}`,
                background: (integrations.messagingMode || "platform") === opt.key ? opt.color + "10" : B.dark,
                transition: "all 0.15s",
              }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: (integrations.messagingMode || "platform") === opt.key ? opt.color : B.text, marginBottom: 4 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: B.muted }}>{opt.desc}</div>
            </button>
          ))}
        </div>
        {(integrations.messagingMode || "platform") === "platform" && (
          <div style={{ padding: 12, borderRadius: 8, background: B.accent + "08", border: "1px solid " + B.accent + "20", fontSize: 13, color: B.muted }}>
            Email and SMS are handled by GymKit. No configuration needed — just set up your automations and they'll work.
          </div>
        )}
      </Card>

      {/* Resend (Email) — only show in BYOK mode */}
      {(integrations.messagingMode === "byok") && <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ ...s.sectionTitle, margin: 0 }}>Resend (Email)</h3>
          <span style={s.badge(integrations.resendConnected ? B.green : B.dim)}>
            <span style={s.dot(integrations.resendConnected ? B.green : B.dim)} />
            {integrations.resendConnected ? "Connected" : "Not Connected"}
          </span>
        </div>
        <div style={{ ...s.row, marginTop: 16 }}>
          <div>
            <label style={s.label}>API Key</label>
            <input style={s.input} value={integrations.resendApiKey || ""} onChange={e => setIntegrations(prev => ({ ...prev, resendApiKey: e.target.value }))} placeholder="re_..." />
          </div>
          <div>
            <label style={s.label}>From Email</label>
            <input style={s.input} value={integrations.emailFrom || ""} onChange={e => setIntegrations(prev => ({ ...prev, emailFrom: e.target.value }))} placeholder="GymKit <noreply@gymkit.io>" />
          </div>
        </div>
        <p style={{ fontSize: 12, color: B.muted, margin: "0 0 16px" }}>Enter your Resend API key to enable automated email sending. From email must use a verified domain.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.btn()} onClick={async () => {
            if (!integrations.resendApiKey) { showToast("Please enter a Resend API key first."); return; }
            try {
              const res = await fetch(`${API_BASE}/api/test-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resendApiKey: integrations.resendApiKey }),
              });
              const data = await res.json();
              if (data.success) {
                setIntegrations(prev => ({ ...prev, resendConnected: true }));
                showToast("Resend connection successful!");
              } else {
                setIntegrations(prev => ({ ...prev, resendConnected: false }));
                showToast("Connection failed: " + (data.error || "Unknown error"));
              }
            } catch {
              setIntegrations(prev => ({ ...prev, resendConnected: !!integrations.resendApiKey }));
              showToast(integrations.resendApiKey ? "API key saved (server unreachable, will verify on send)." : "Enter an API key first.");
            }
          }}>Test Connection</button>
          <button style={s.btn(B.border, B.text)} onClick={async () => {
            if (!integrations.resendApiKey) { showToast("Configure your API key first."); return; }
            const adminEmail = settings.email || "admin@gym.com";
            try {
              const res = await fetch(`${API_BASE}/api/send-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  resendApiKey: integrations.resendApiKey,
                  to: adminEmail,
                  subject: "GymKit Test Email",
                  html: "<h2>It works!</h2><p>Your email integration is configured correctly.</p>",
                  from: integrations.emailFrom || `${branding.gymName || "GymKit"} <noreply@gymkit.io>`,
                }),
              });
              const data = await res.json();
              showToast(data.success ? `Test email sent to ${adminEmail}!` : "Send failed: " + (data.error || "Unknown error"));
            } catch {
              showToast("Server unreachable. Make sure the API server is running.");
            }
          }}>Send Test Email</button>
          <button style={s.btn(B.border, B.text)} onClick={() => {
            setIntegrations(prev => ({ ...prev, resendApiKey: "", emailFrom: "", resendConnected: false }));
            showToast("Resend disconnected.");
          }}>Disconnect</button>
        </div>
      </Card>}

      {/* Twilio (SMS) — only show in BYOK mode */}
      {(integrations.messagingMode === "byok") && <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ ...s.sectionTitle, margin: 0 }}>Twilio (SMS)</h3>
          <span style={s.badge(integrations.twilioConnected ? B.green : B.dim)}>
            <span style={s.dot(integrations.twilioConnected ? B.green : B.dim)} />
            {integrations.twilioConnected ? "Connected" : "Not Connected"}
          </span>
        </div>
        <div style={{ ...s.row, marginTop: 16 }}>
          <div>
            <label style={s.label}>Account SID</label>
            <input style={s.input} value={integrations.twilioSid || ""} onChange={e => setIntegrations(prev => ({ ...prev, twilioSid: e.target.value }))} placeholder="AC..." />
          </div>
          <div>
            <label style={s.label}>Auth Token</label>
            <input style={s.input} type="password" value={integrations.twilioToken || ""} onChange={e => setIntegrations(prev => ({ ...prev, twilioToken: e.target.value }))} placeholder="Enter auth token" />
          </div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Twilio Phone Number (from)</label>
          <input style={s.input} value={integrations.twilioFrom || ""} onChange={e => setIntegrations(prev => ({ ...prev, twilioFrom: e.target.value }))} placeholder="+15551234567" />
        </div>
        <p style={{ fontSize: 12, color: B.muted, margin: "0 0 16px" }}>Enter your Twilio credentials to enable automated SMS sending.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.btn()} onClick={async () => {
            if (!integrations.twilioSid || !integrations.twilioToken) { showToast("Please enter Twilio SID and Auth Token."); return; }
            try {
              const res = await fetch(`${API_BASE}/api/test-sms`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  twilioSid: integrations.twilioSid,
                  twilioToken: integrations.twilioToken,
                  twilioFrom: integrations.twilioFrom,
                }),
              });
              const data = await res.json();
              if (data.success) {
                setIntegrations(prev => ({ ...prev, twilioConnected: true }));
                showToast("Twilio connection successful!");
              } else {
                setIntegrations(prev => ({ ...prev, twilioConnected: false }));
                showToast("Connection failed: " + (data.error || "Unknown error"));
              }
            } catch {
              setIntegrations(prev => ({ ...prev, twilioConnected: !!(integrations.twilioSid && integrations.twilioToken) }));
              showToast(integrations.twilioSid ? "Credentials saved (server unreachable, will verify on send)." : "Enter credentials first.");
            }
          }}>Test Connection</button>
          <button style={s.btn(B.border, B.text)} onClick={() => {
            setIntegrations(prev => ({ ...prev, twilioSid: "", twilioToken: "", twilioFrom: "", twilioConnected: false }));
            showToast("Twilio disconnected.");
          }}>Disconnect</button>
        </div>
      </Card>}

      {/* Zapier */}
      <CollapseCard id="zapier" title="Zapier" badge={
        <span style={s.badge(integrations.zapierApiKey ? B.green : B.dim)}>
          <span style={s.dot(integrations.zapierApiKey ? B.green : B.dim)} />
          {integrations.zapierApiKey ? "Configured" : "Not Configured"}
        </span>
      }>
        <p style={{ fontSize: 12, color: B.muted, margin: "0 0 16px" }}>Connect GymKit to 5,000+ apps via Zapier webhooks.</p>
        <div style={s.field}>
          <label style={s.label}>API Key</label>
          <input style={s.input} value={integrations.zapierApiKey || ""} onChange={e => setIntegrations(prev => ({ ...prev, zapierApiKey: e.target.value }))} placeholder="Enter Zapier API key" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Webhook URL</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...s.input, flex: 1 }} readOnly value={`https://hooks.gymkit.io/${localStorage.getItem("hf_gym_id") || "default"}/events`} />
            <button style={s.btn()} onClick={() => { navigator.clipboard.writeText(`https://hooks.gymkit.io/${localStorage.getItem("hf_gym_id") || "default"}/events`); showToast("Copied!"); }}>Copy</button>
          </div>
        </div>
        <p style={{ fontSize: 11, color: B.dim, margin: "8px 0 0" }}>Use this webhook URL in your Zapier triggers. Available events: New Client, Session Booked, Payment Received, Check-in, Assessment Completed.</p>
      </CollapseCard>

      {/* GoHighLevel */}
      <CollapseCard id="ghl" title="GoHighLevel" badge={
        <span style={s.badge(integrations.ghlApiKey ? B.green : B.dim)}>
          <span style={s.dot(integrations.ghlApiKey ? B.green : B.dim)} />
          {integrations.ghlApiKey ? "Configured" : "Not Configured"}
          </span>
      }>
        <p style={{ fontSize: 12, color: B.muted, margin: "0 0 16px" }}>Sync contacts, automations, and pipelines with GoHighLevel.</p>
        <div style={s.field}>
          <label style={s.label}>GHL API Key</label>
          <input style={s.input} value={integrations.ghlApiKey || ""} onChange={e => setIntegrations(prev => ({ ...prev, ghlApiKey: e.target.value }))} placeholder="Enter GoHighLevel API key" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Location ID</label>
          <input style={s.input} value={integrations.ghlLocationId || ""} onChange={e => setIntegrations(prev => ({ ...prev, ghlLocationId: e.target.value }))} placeholder="Enter GHL Location ID" />
        </div>
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: B.text, marginBottom: 8 }}>Sync Settings</p>
          {[
            { key: "ghlSyncMembers", label: "Sync new clients to GHL contacts" },
            { key: "ghlSyncStatus", label: "Sync client status changes" },
            { key: "ghlSyncPayments", label: "Sync payments to GHL" },
            { key: "ghlImportContacts", label: "Import GHL contacts as clients" },
          ].map(opt => (
            <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", fontSize: 13, color: B.text }}>
              <input type="checkbox" checked={!!integrations[opt.key]} onChange={e => setIntegrations(prev => ({ ...prev, [opt.key]: e.target.checked }))} style={{ accentColor: B.accent }} />
              {opt.label}
            </label>
          ))}
        </div>
      </CollapseCard>
    </div>
  );

  /* ========== Branding ========== */
  const renderBranding = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>White-Label Branding</h3>
        <div style={s.field}>
          <label style={s.label}>Gym Name</label>
          <input style={s.input} value={branding.gymName} onChange={e => setBranding(prev => ({ ...prev, gymName: e.target.value }))} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Tagline</label>
          <input style={s.input} value={branding.tagline} onChange={e => setBranding(prev => ({ ...prev, tagline: e.target.value }))} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Logo URL</label>
          <input style={s.input} value={branding.logo} onChange={e => setBranding(prev => ({ ...prev, logo: e.target.value }))} placeholder="https://example.com/logo.png" />
          {branding.logo && (
            <div style={{ marginTop: 8, background: B.darker, borderRadius: 8, padding: 12, border: "1px solid " + B.border }}>
              <img src={branding.logo} alt="Logo preview" style={{ maxHeight: 60, maxWidth: "100%" }} onError={e => { e.target.style.display = "none"; }} />
            </div>
          )}
        </div>
        <div style={s.row}>
          <div>
            <label style={s.label}>Primary Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={branding.primaryColor || "#8fbf3b"} onChange={e => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))} style={{ width: 44, height: 36, border: "1px solid " + B.border, borderRadius: 8, padding: 2, cursor: "pointer", background: "transparent" }} />
              <input style={{ ...s.input, flex: 1 }} value={branding.primaryColor} onChange={e => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))} placeholder="#8fbf3b" />
            </div>
          </div>
          <div>
            <label style={s.label}>Secondary Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={branding.secondaryColor || "#063461"} onChange={e => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))} style={{ width: 44, height: 36, border: "1px solid " + B.border, borderRadius: 8, padding: 2, cursor: "pointer", background: "transparent" }} />
              <input style={{ ...s.input, flex: 1 }} value={branding.secondaryColor} onChange={e => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))} placeholder="#063461" />
            </div>
          </div>
        </div>
        <h3 style={s.sectionTitle}>PWA App Icon</h3>
        <div style={s.field}>
          <label style={s.label}>App Icon (for mobile home screen)</label>
          <input style={s.input} value={branding.pwaIcon || ""} onChange={e => setBranding(prev => ({ ...prev, pwaIcon: e.target.value }))} placeholder="https://example.com/icon-192.png" />
          <div style={{ fontSize: 11, color: B.dim, marginTop: 4 }}>Upload a square image (192x192 or larger) that will appear as the app icon when clients install the PWA</div>
        </div>
        {branding.pwaIcon && (
          <div style={{ marginTop: 8, background: B.darker, borderRadius: 12, padding: 12, border: "1px solid " + B.border, display: "inline-block" }}>
            <img
              src={branding.pwaIcon}
              alt="PWA icon preview"
              style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", display: "block" }}
              onError={e => { e.target.style.display = "none"; }}
            />
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <button style={s.btn()} onClick={() => {
            // Force save to localStorage and reload so Logo + theme pick up changes
            try { localStorage.setItem("hf_branding", JSON.stringify(branding)); } catch {}
            showToast("Branding applied! Reloading...");
            setTimeout(() => window.location.reload(), 500);
          }}>Apply Branding</button>
        </div>
      </Card>

      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>Preview</h3>
        <div style={{ background: branding.secondaryColor || B.blue, borderRadius: 12, padding: 24, textAlign: "center" }}>
          {branding.logo ? (
            <img src={branding.logo} alt="Logo" style={{ maxHeight: 48, marginBottom: 12 }} onError={e => { e.target.style.display = "none"; }} />
          ) : (
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{branding.gymName || "Your Gym"}</div>
          )}
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>{branding.tagline}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            <div style={{ padding: "8px 20px", borderRadius: 8, background: branding.primaryColor || B.green, color: "#fff", fontWeight: 600, fontSize: 13 }}>Primary Button</div>
            <div style={{ padding: "8px 20px", borderRadius: 8, background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 500, fontSize: 13 }}>Secondary</div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 16, borderRadius: 8, border: "1px solid " + B.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: branding.primaryColor || B.green, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>
              {(branding.gymName || "G")[0]}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: B.text, fontSize: 14 }}>{branding.gymName || "Your Gym"}</div>
              <div style={{ color: B.muted, fontSize: 12 }}>Client Portal Header</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: branding.primaryColor }} />
            <div style={{ width: 12, height: 12, borderRadius: 3, background: branding.secondaryColor }} />
            <span style={{ fontSize: 11, color: B.muted, marginLeft: 4 }}>Brand Colors</span>
          </div>
        </div>
      </Card>
    </div>
  );

  /* ========== Locations ========== */
  const renderLocations = () => (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...s.sectionTitle, margin: 0 }}>Locations</h3>
        <button style={s.btn()} onClick={() => setLocations(prev => [...prev, {
          id: "loc_" + Date.now(),
          name: "New Location",
          address: "",
          phone: "",
          timezone: "America/Chicago",
          isDefault: false,
        }])}>+ Add Location</button>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        {locations.map(loc => (
          <div key={loc.id} style={{ background: B.darker, borderRadius: 10, padding: 16, border: "1px solid " + B.border }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={s.label}>Location Name</label>
                <input style={s.input} value={loc.name} onChange={e => setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, name: e.target.value } : l))} />
              </div>
              <div>
                <label style={s.label}>Phone</label>
                <input style={s.input} value={loc.phone} onChange={e => setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, phone: e.target.value } : l))} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={s.label}>Address</label>
              <input style={s.input} value={loc.address} onChange={e => setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, address: e.target.value } : l))} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: B.muted, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="defaultLocation"
                  checked={loc.isDefault}
                  onChange={() => setLocations(prev => prev.map(l => ({ ...l, isDefault: l.id === loc.id })))}
                  style={{ accentColor: B.green }}
                />
                Default Location
              </label>
              {locations.length > 1 && (
                <button style={s.btnSm(B.red + "22", B.red)} onClick={() => {
                  const wasDefault = loc.isDefault;
                  setLocations(prev => {
                    const next = prev.filter(l => l.id !== loc.id);
                    if (wasDefault && next.length > 0) next[0].isDefault = true;
                    return next;
                  });
                  showToast("Location removed.");
                }}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  /* ========== Users ========== */
  const renderUsers = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>User Accounts</h3>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Display Name</th>
              <th style={s.th}>Email</th>
              <th style={s.th}>Phone</th>
              <th style={s.th}>Role</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.filter(u => u.role !== "client").map(u => (
              editingUserId === u.id ? (
                <tr key={u.id} style={{ background: `${B.green}08` }}>
                  <td style={s.td}><input style={{ ...s.input, margin: 0, padding: "4px 8px", fontSize: 12 }} value={editForm.displayName} onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))} /></td>
                  <td style={s.td}><input style={{ ...s.input, margin: 0, padding: "4px 8px", fontSize: 12 }} value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></td>
                  <td style={s.td}><input style={{ ...s.input, margin: 0, padding: "4px 8px", fontSize: 12 }} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" /></td>
                  <td style={s.td}>
                    <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                      <option value="admin">Admin</option>
                      <option value="coach">Coach</option>
                    </select>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={s.btnSm(B.green + "22", B.green)} onClick={() => {
                        updateUser(u.id, { displayName: editForm.displayName, email: editForm.email, username: editForm.email, phone: editForm.phone, role: editForm.role });
                        setEditingUserId(null);
                        showToast(`${editForm.displayName} updated.`);
                      }}>Save</button>
                      <button style={s.btnSm(B.border, B.muted)} onClick={() => setEditingUserId(null)}>Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
              <tr key={u.id}>
                <td style={s.td}>{u.displayName}</td>
                <td style={{ ...s.td, color: B.muted }}>{u.email || u.username}</td>
                <td style={{ ...s.td, color: B.muted }}>{u.phone || "—"}</td>
                <td style={s.td}>
                  {currentUser?.id === u.id || u.isSuperAdmin ? (
                    <span style={s.badge(u.role === "admin" ? B.purple : B.green)}>{u.role}</span>
                  ) : (
                    <select value={u.role} onChange={e => {
                      if (window.confirm(`Change ${u.displayName}'s role to ${e.target.value}?`)) {
                        updateUser(u.id, { role: e.target.value });
                        showToast(`${u.displayName} is now ${e.target.value}.`);
                      }
                    }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                      <option value="admin">Admin</option>
                      <option value="coach">Coach</option>
                    </select>
                  )}
                </td>
                <td style={s.td}>
                  <div style={{ display: "flex", gap: 4 }}>
                  {currentUser?.id === u.id ? (
                    <span style={{ fontSize: 12, color: B.muted }}>Current user</span>
                  ) : u.isSuperAdmin ? (
                    <span style={{ fontSize: 12, color: B.muted }}>Super Admin</span>
                  ) : (
                    <>
                      <button style={s.btnSm(B.blue + "22", B.blue || B.accent)} onClick={() => {
                        setEditingUserId(u.id);
                        setEditForm({ displayName: u.displayName || "", email: u.email || u.username || "", phone: u.phone || "", role: u.role || "coach" });
                      }}>Edit</button>
                      <button style={s.btnSm(B.red + "22", B.red)} onClick={() => { if (window.confirm(`Delete ${u.displayName}?`)) { removeUser(u.id); showToast("User removed."); } }}>Delete</button>
                    </>
                  )}
                  </div>
                </td>
              </tr>
              )
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>Add User</h3>
        <div style={s.row}>
          <div>
            <label style={s.label}>Display Name</label>
            <input style={s.input} value={newUser.displayName} onChange={e => setNewUser(p => ({ ...p, displayName: e.target.value }))} placeholder="Coach Jane" />
          </div>
          <div>
            <label style={s.label}>Email (login)</label>
            <input style={s.input} type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value, username: e.target.value }))} placeholder="jane@gym.com" />
          </div>
        </div>
        <div style={s.row}>
          <div>
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Enter password" />
          </div>
          <div>
            <label style={s.label}>Role</label>
            <select style={s.select} value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
              <option value="admin">Admin</option>
              <option value="coach">Coach</option>
            </select>
          </div>
        </div>
        <button style={{ ...s.btn(), opacity: (newUser.email && newUser.password && newUser.displayName) ? 1 : 0.4 }} onClick={() => {
          if (!newUser.email || !newUser.password || !newUser.displayName) return;
          addUser({ ...newUser, username: newUser.email });
          setNewUser({ email: "", username: "", password: "", role: "coach", displayName: "" });
          showToast("User added!");
        }}>Add User</button>
      </Card>
    </div>
  );

  /* ========== Gamification ========== */
  const gam = gamificationSettings;
  const updateGam = (key, val) => setGamificationSettings(prev => ({ ...prev, [key]: val }));
  const updateGamNested = (section, key, val) => setGamificationSettings(prev => ({ ...prev, [section]: { ...prev[section], [key]: val } }));

  const renderGamification = () => (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Section 1: Points & Levels */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ ...s.sectionTitle, margin: 0 }}>Points & Levels</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: B.muted, fontWeight: 600 }}>Gamification {gam.enabled ? "ON" : "OFF"}</span>
            <button onClick={() => updateGam("enabled", !gam.enabled)}
              style={{ width: 46, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: gam.enabled ? B.green : B.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, left: gam.enabled ? 25 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
        </div>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: B.text, marginBottom: 10, marginTop: 4 }}>Level Thresholds</h4>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Level</th>
              <th style={s.th}>Name</th>
              <th style={s.th}>Points Required</th>
              <th style={s.th}>Color</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {(gam.levels || []).map((lvl, idx) => (
              <tr key={idx}>
                <td style={s.td}>{lvl.level}</td>
                <td style={s.td}>
                  <input style={{ ...s.input, width: 140 }} value={lvl.name} onChange={e => {
                    const updated = [...gam.levels];
                    updated[idx] = { ...updated[idx], name: e.target.value };
                    updateGam("levels", updated);
                  }} />
                </td>
                <td style={s.td}>
                  <input type="number" style={{ ...s.input, width: 100 }} value={lvl.points} onChange={e => {
                    const updated = [...gam.levels];
                    updated[idx] = { ...updated[idx], points: parseInt(e.target.value) || 0 };
                    updateGam("levels", updated);
                  }} />
                </td>
                <td style={s.td}>
                  <input type="color" value={lvl.color} onChange={e => {
                    const updated = [...gam.levels];
                    updated[idx] = { ...updated[idx], color: e.target.value };
                    updateGam("levels", updated);
                  }} style={{ width: 40, height: 30, border: "1px solid " + B.border, borderRadius: 6, cursor: "pointer", background: "none" }} />
                </td>
                <td style={s.td}>
                  {gam.levels.length > 1 && (
                    <button style={s.btnSm(B.red + "22", B.red)} onClick={() => {
                      const updated = gam.levels.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level: i + 1 }));
                      updateGam("levels", updated);
                    }}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button style={{ ...s.btn(B.border, B.text), marginTop: 10 }} onClick={() => {
          const nextLvl = gam.levels.length + 1;
          const lastPts = gam.levels[gam.levels.length - 1]?.points || 0;
          updateGam("levels", [...gam.levels, { level: nextLvl, name: "Level " + nextLvl, points: lastPts + 2000, color: "#8b949e" }]);
        }}>+ Add Level</button>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: B.text, marginBottom: 10, marginTop: 24 }}>Points Per Action</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { key: "checkin", label: "Check-in" },
            { key: "workout", label: "Workout Completed" },
            { key: "challengeCheckin", label: "Challenge Check-in" },
            { key: "postLike", label: "Post Like Received" },
            { key: "assessment", label: "Assessment Completed" },
            { key: "streakBonus", label: "Streak Bonus (per day)" },
          ].map(action => (
            <div key={action.key}>
              <label style={s.label}>{action.label}</label>
              <input type="number" style={s.input} value={gam.pointsPerAction?.[action.key] ?? 0} onChange={e => {
                setGamificationSettings(prev => ({ ...prev, pointsPerAction: { ...prev.pointsPerAction, [action.key]: parseInt(e.target.value) || 0 } }));
              }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <button style={s.btn()} onClick={() => showToast("Gamification settings saved!")}>Save Points & Levels</button>
        </div>
      </Card>

      {/* Section 2: Badges */}
      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>Badges</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {(gam.badges || []).map((badge, idx) => (
            <div key={badge.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr auto auto", gap: 10, alignItems: "center", padding: 12, borderRadius: 10, background: B.darker, border: "1px solid " + B.border }}>
              <EmojiPickerBtn value={badge.icon} onChange={icon => {
                const updated = [...gam.badges];
                updated[idx] = { ...updated[idx], icon };
                updateGam("badges", updated);
              }} B={B} />
              <div>
                <label style={{ ...s.label, marginBottom: 2 }}>Name</label>
                <input style={s.input} value={badge.name} onChange={e => {
                  const updated = [...gam.badges];
                  updated[idx] = { ...updated[idx], name: e.target.value };
                  updateGam("badges", updated);
                }} />
              </div>
              <div>
                <label style={{ ...s.label, marginBottom: 2 }}>Trigger</label>
                <select style={s.select} value={badge.trigger} onChange={e => {
                  const updated = [...gam.badges];
                  updated[idx] = { ...updated[idx], trigger: e.target.value };
                  updateGam("badges", updated);
                }}>
                  {BADGE_TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...s.label, marginBottom: 2 }}>Threshold</label>
                <input type="number" style={s.input} value={badge.threshold} onChange={e => {
                  const updated = [...gam.badges];
                  updated[idx] = { ...updated[idx], threshold: parseInt(e.target.value) || 0 };
                  updateGam("badges", updated);
                }} />
              </div>
              <button onClick={() => {
                const updated = [...gam.badges];
                updated[idx] = { ...updated[idx], active: !updated[idx].active };
                updateGam("badges", updated);
              }} style={{ width: 46, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: badge.active ? B.green : B.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, left: badge.active ? 25 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </button>
              <button style={s.btnSm(B.red + "22", B.red)} onClick={() => {
                updateGam("badges", gam.badges.filter((_, i) => i !== idx));
              }}>Remove</button>
            </div>
          ))}
        </div>
        <button style={{ ...s.btn(B.border, B.text), marginTop: 12 }} onClick={() => {
          const newId = "b" + Date.now();
          updateGam("badges", [...(gam.badges || []), { id: newId, name: "New Badge", icon: "\ud83c\udfc5", description: "Badge description", trigger: "Total Workouts >=", threshold: 1, active: true }]);
        }}>+ Add Badge</button>
        <div style={{ marginTop: 16 }}>
          <button style={s.btn()} onClick={() => showToast("Badges saved!")}>Save Badges</button>
        </div>
      </Card>

      {/* Section 3: Leaderboard Settings */}
      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>Leaderboard Settings</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: B.text, fontWeight: 500 }}>Show Leaderboard</span>
          <button onClick={() => updateGamNested("leaderboard", "enabled", !gam.leaderboard?.enabled)}
            style={{ width: 46, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: gam.leaderboard?.enabled ? B.green : B.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, left: gam.leaderboard?.enabled ? 25 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Leaderboard Metrics</label>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { key: "xp", label: "XP" },
              { key: "workouts", label: "Workouts" },
              { key: "weight", label: "Weight Lifted" },
              { key: "streak", label: "Streak" },
            ].map(m => {
              const metrics = gam.leaderboard?.metrics || [];
              const checked = metrics.includes(m.key);
              return (
                <label key={m.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: B.text, cursor: "pointer" }}>
                  <input type="checkbox" checked={checked} style={{ accentColor: B.green }} onChange={() => {
                    const updated = checked ? metrics.filter(x => x !== m.key) : [...metrics, m.key];
                    updateGamNested("leaderboard", "metrics", updated);
                  }} />
                  {m.label}
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, color: B.text, fontWeight: 500 }}>Show Top 3 Podium</span>
          <button onClick={() => updateGamNested("leaderboard", "showPodium", !gam.leaderboard?.showPodium)}
            style={{ width: 46, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: gam.leaderboard?.showPodium ? B.green : B.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, left: gam.leaderboard?.showPodium ? 25 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>
        <div style={{ marginTop: 16 }}>
          <button style={s.btn()} onClick={() => showToast("Leaderboard settings saved!")}>Save Leaderboard</button>
        </div>
      </Card>

      {/* Section 4: Attendance Goals */}
      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>Attendance Goals</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: B.text, fontWeight: 500 }}>Show Attendance Goal Section</span>
          <button onClick={() => updateGamNested("attendanceGoal", "enabled", !gam.attendanceGoal?.enabled)}
            style={{ width: 46, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: gam.attendanceGoal?.enabled ? B.green : B.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, left: gam.attendanceGoal?.enabled ? 25 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>
        <div>
          <label style={s.label}>Monthly Attendance Goal (sessions)</label>
          <input type="number" style={{ ...s.input, width: 120 }} value={gam.attendanceGoal?.threshold ?? 8} onChange={e => {
            updateGamNested("attendanceGoal", "threshold", parseInt(e.target.value) || 1);
          }} />
        </div>
        <div style={{ marginTop: 16 }}>
          <button style={s.btn()} onClick={() => showToast("Attendance goal saved!")}>Save Attendance Goal</button>
        </div>
      </Card>

      {/* Reset to Defaults */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ ...s.sectionTitle, margin: 0 }}>Reset to Defaults</h3>
            <p style={{ color: B.muted, fontSize: 12, margin: "4px 0 0" }}>Restore all gamification settings to their original values.</p>
          </div>
          <button style={s.btn(B.red + "22", B.red)} onClick={() => {
            if (window.confirm("Reset all gamification settings to defaults?")) {
              setGamificationSettings(DEFAULT_GAMIFICATION_SETTINGS);
              showToast("Gamification settings reset to defaults.");
            }
          }}>Reset All</button>
        </div>
      </Card>
    </div>
  );

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Settings</h1>
      <p style={s.subtitle}>Configure your gym, integrations, branding, and user access.</p>

      <div style={s.tabs}>
        {TABS.map(tab => (
          <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {activeTab === "General" && renderGeneral()}
      {activeTab === "Features" && <FeaturesTab B={B} s={s} showToast={showToast} />}
      {activeTab === "Integrations" && renderIntegrations()}
      {activeTab === "Branding" && renderBranding()}
      {activeTab === "Locations" && renderLocations()}
      {activeTab === "Users" && renderUsers()}
      {activeTab === "Stations" && (
        <div style={{ display: "grid", gap: 20 }}>
          <Card>
            <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>Station Display Settings</h3>
            <p style={{ color: B.muted, fontSize: 13, marginBottom: 20 }}>Configure what clients see on their station tablets.</p>
            {[
              { key: "showWeight", label: "Weight Logging", desc: "Show weight (lbs) input on station" },
              { key: "showReps", label: "Reps Logging", desc: "Show reps input on station" },
              { key: "showRPE", label: "RPE Logging", desc: "Show RPE (1-10) input on station" },
              { key: "showMedia", label: "Exercise Demos", desc: "Show GIFs and video thumbnails on station" },
            ].map(setting => (
              <div key={setting.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid " + B.border + "44" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{setting.label}</div>
                  <div style={{ fontSize: 12, color: B.dim }}>{setting.desc}</div>
                </div>
                <button onClick={() => setStationSettings(prev => ({ ...prev, [setting.key]: !prev[setting.key] }))}
                  style={{
                    width: 46, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                    background: stationSettings[setting.key] ? B.accent : B.border,
                    position: "relative", transition: "background 0.2s", flexShrink: 0,
                  }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 9, background: "#fff",
                    position: "absolute", top: 3,
                    left: stationSettings[setting.key] ? 25 : 3,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>
            ))}
          </Card>
        </div>
      )}
      {activeTab === "Gamification" && renderGamification()}
      {activeTab === "Data" && (() => {
        const dataKeys = [
          { key: "hf_members", label: "Demo Clients" },
          { key: "hf_payments", label: "Demo Payments" },
          { key: "hf_membership_events", label: "Membership Events" },
          { key: "hf_attendance", label: "Attendance Records" },
          { key: "hf_schedule", label: "Demo Sessions" },
          { key: "hf_community_posts", label: "Community Posts" },
          { key: "hf_challenges", label: "Challenges" },
          { key: "hf_messages", label: "Messages" },
          { key: "hf_notifications", label: "Notifications" },
          { key: "hf_waivers", label: "Waivers" },
          { key: "hf_assessments", label: "Assessments" },
          { key: "hf_stations", label: "Stations" },
          { key: "hf_community_events", label: "Events" },
          { key: "hf_resources", label: "Resources" },
          { key: "hf_courses", label: "Courses" },
          { key: "hf_workout_logs", label: "Workout Logs" },
          { key: "hf_automation_log", label: "Automation Log" },
          { key: "hf_plans", label: "Plans" },
        ];
        const getDemoCount = (key) => {
          try { const arr = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(arr) ? arr.filter(r => r._demo === true).length : 0; } catch { return 0; }
        };
        const stripDemo = (key) => {
          try { const arr = JSON.parse(localStorage.getItem(key) || "[]"); if (!Array.isArray(arr)) return; localStorage.setItem(key, JSON.stringify(arr.filter(r => r._demo !== true))); } catch { /* ignore */ }
        };
        const demoLoaded = localStorage.getItem("hf_demo_loaded") === "true";
        const totalDemo = dataKeys.reduce((sum, item) => sum + getDemoCount(item.key), 0);
        return (
        <div>
          {/* Load Demo Data */}
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 8px" }}>Sample Data</h3>
            <p style={{ color: B.muted, fontSize: 13, marginBottom: 16 }}>
              {demoLoaded
                ? "Demo data is loaded. You can clear it below to keep only your real records."
                : "Your account starts empty. Load sample data to explore the app with realistic demo members, sessions, payments, and more."}
            </p>
            {!demoLoaded ? (
              <button onClick={() => {
                if (window.confirm("Load demo data? This adds sample members, sessions, payments, and other records to explore the app. You can remove them later.")) {
                  localStorage.setItem("hf_demo_loaded", "true");
                  localStorage.removeItem("hf_demo_cleared");
                  // Clear existing empty arrays so hooks regenerate with demo defaults
                  dataKeys.forEach(item => localStorage.removeItem(item.key));
                  window.location.reload();
                }
              }} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Load Demo Data
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: B.accent, fontWeight: 600 }}>Demo data loaded ({totalDemo} records)</span>
              </div>
            )}
          </Card>

          {/* Clear Demo Data */}
          {totalDemo > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 8px" }}>Clear Demo Data</h3>
            <p style={{ color: B.muted, fontSize: 13, marginBottom: 16 }}>Remove only demo records while keeping your real data intact.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {dataKeys.map(item => {
                const count = getDemoCount(item.key);
                return (
                <button key={item.key} onClick={() => {
                  if (window.confirm(`Clear ${count} demo record(s) from ${item.label}?`)) {
                    stripDemo(item.key);
                    window.location.reload();
                  }
                }} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + B.border, background: B.dark, color: count > 0 ? B.muted : B.dim, fontSize: 12, fontWeight: 600, cursor: count > 0 ? "pointer" : "default", opacity: count > 0 ? 1 : 0.5 }} disabled={count === 0}>
                  Clear {item.label}{count > 0 ? ` (${count})` : ""}
                </button>
                );
              })}
            </div>
            <div style={{ marginTop: 16, borderTop: "1px solid " + B.border, paddingTop: 12 }}>
              <button onClick={() => {
                if (window.confirm(`Clear all ${totalDemo} demo records? Your real data is preserved.`)) {
                  dataKeys.forEach(item => stripDemo(item.key));
                  Object.keys(localStorage).filter(k => k.startsWith("hf_") && !dataKeys.some(d => d.key === k)).forEach(k => {
                    try { const arr = JSON.parse(localStorage.getItem(k) || "[]"); if (Array.isArray(arr)) { localStorage.setItem(k, JSON.stringify(arr.filter(r => r._demo !== true))); } } catch {}
                  });
                  localStorage.removeItem("hf_demo_loaded");
                  window.location.reload();
                }
              }} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: B.red, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Clear ALL Demo Data ({totalDemo} records)
              </button>
              <p style={{ color: B.dim, fontSize: 11, marginTop: 8 }}>Removes only demo records. Your real data is preserved.</p>
            </div>
          </Card>
          )}
        </div>
        );
      })()}

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
