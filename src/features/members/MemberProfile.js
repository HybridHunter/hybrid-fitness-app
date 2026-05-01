import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useMembershipEvents } from "../../hooks/useMembershipEvents";
import { useMemberChangelog } from "../../hooks/useMemberChangelog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import PaymentModal from "../../components/shared/PaymentModal";
import { sendEmail } from "../../utils/messaging";
import ProgressPhotos from "./ProgressPhotos";
import ProfileAvatar from "../../components/shared/ProfileAvatar";

const PATTERNS = ["Squat", "Hinge", "Lunge", "Push", "Pull", "Core", "Carry"];
const SCORE_RANGE = [-3, -2, -1, 0, 1, 2, 3];
const TABS = ["Overview", "Movement Scores", "Body Composition", "Progress Photos", "Gamification", "Billing", "History"];

const STATUS_COLORS = (B) => ({ active: B.green, trial: B.orange, frozen: B.blue, inactive: B.red });

function getInitials(f, l) {
  return ((f?.[0] || "") + (l?.[0] || "")).toUpperCase();
}

function formatDate(d) {
  if (!d) return "---";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function MemberProfile() {
  const B = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();
  const _gp = (p) => `/gym/${localStorage.getItem("hf_gym_id") || "default"}/${p}`;
  const { getMember, updateMember } = useMembers();
  const { events, logEvent, removeLatestEvent } = useMembershipEvents();
  const { logChange, markUndone, getLogForMember } = useMemberChangelog();
  const [tab, setTab] = useState("Overview");
  const [cancelModal, setCancelModal] = useState(null);
  const [planChangePrompt, setPlanChangePrompt] = useState(null);
  const [plans] = useLocalStorage("hf_plans", []);
  const [payments, setPayments] = useLocalStorage("hf_payments", []);
  const [paymentMethods, setPaymentMethods] = useLocalStorage("hf_payment_methods", []);
  const [attendance] = useLocalStorage("hf_attendance", []);
  const [schedule] = useLocalStorage("hf_schedule", []);
  const [editingMethod, setEditingMethod] = useState(null);
  const [addPaymentMethodOpen, setAddPaymentMethodOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanForm, setScanForm] = useState({ date: "", weight: "", bodyFatPercent: "", skeletalMuscleMass: "", bmi: "", bmr: "", bodyFatMass: "", totalBodyWater: "", visceralFatLevel: "", leftArm: "", rightArm: "", trunk: "", leftLeg: "", rightLeg: "" });
  const [inbodyApiKey, setInbodyApiKey] = useLocalStorage("hf_inbody_api_key", "");
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [sendingCreds, setSendingCreds] = useState(false);
  const [credToast, setCredToast] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");

  const showCredToast = (msg, type = "success") => {
    setCredToast({ msg, type });
    setTimeout(() => setCredToast(null), 4000);
  };

  const handleSendCredentials = async () => {
    if (!member.email) {
      showCredToast("No email address on file", "error");
      return;
    }
    setSendingCreds(true);
    try {
      const branding = JSON.parse(localStorage.getItem("hf_branding") || "{}");
      const gymName = branding.gymName || "GymKit";
      const gymUrl = branding.gymUrl || window.location.origin;
      const credLabel = (member.pin && member.pin.length === 4 && /^\d{4}$/.test(member.pin)) ? "PIN" : "Password";
      await sendEmail({
        to: member.email,
        subject: `Your ${gymName} Login Credentials`,
        html: `<h2>Hi ${member.firstName},</h2><p>Here are your login credentials:</p><p><strong>Login URL:</strong> <a href="${gymUrl}">${gymUrl}</a></p><p><strong>Email:</strong> ${member.email}</p><p><strong>${credLabel}:</strong> <span style="font-size:18px;letter-spacing:2px;font-weight:bold;">${member.pin}</span></p><p>Use these to log in to the client portal from your phone.</p><p>If you have any questions, message your coach through the app.</p>`,
      });
      showCredToast(`Credentials sent to ${member.email}`);
    } catch (err) {
      console.error("Failed to send credentials:", err);
      showCredToast("Failed to send credentials email", "error");
    } finally {
      setSendingCreds(false);
    }
  };

  const member = getMember(id);
  if (!member) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: B.text, marginBottom: 8 }}>Client not found</div>
        <button onClick={() => navigate(_gp("members"))} style={{ background: B.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Back to Clients</button>
      </div>
    );
  }

  const sc = STATUS_COLORS(B);
  const memberPlanObj = plans.find(p => p.id === member.membershipPlanId);
  const effectiveStatus = !member.membershipPlanId ? "inactive" : memberPlanObj?.isTrial ? "trial" : member.membershipStatus === "frozen" ? "frozen" : "active";
  const statusColor = sc[effectiveStatus] || B.muted;
  const g = member.gamification || {};
  const ms = member.movementScores || {};
  const xpForNext = (g.level || 1) * 200;
  const xpProgress = Math.min((g.xp || 0) / xpForNext, 1);

  const handleScoreClick = (pattern, value) => {
    updateMember(member.id, {
      movementScores: { ...ms, [pattern]: value },
    });
  };

  // --- styles ---
  const s = {
    page: { minHeight: "100%" },
    backBtn: { background: "transparent", border: "1px solid " + B.border, borderRadius: 8, padding: "7px 16px", color: B.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 6 },
    header: { display: "flex", alignItems: "center", gap: 22, marginBottom: 28, flexWrap: "wrap" },
    avatarLg: { width: 80, height: 80, borderRadius: "50%", background: statusColor + "22", color: statusColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 28, flexShrink: 0 },
    headerInfo: { flex: 1 },
    name: { fontSize: 24, fontWeight: 800, color: B.text, lineHeight: 1.2 },
    metaRow: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 6 },
    metaText: { fontSize: 13, color: B.muted },
    badge: (color) => ({ display: "inline-block", padding: "3px 12px", borderRadius: 14, fontSize: 12, fontWeight: 700, background: color + "22", color: color, textTransform: "capitalize" }),
    tabs: { display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid " + B.border, paddingBottom: 0 },
    tab: (active) => ({ padding: "10px 18px", fontSize: 13, fontWeight: 600, color: active ? B.accent : B.muted, background: "transparent", border: "none", borderBottom: active ? "2px solid " + B.accent : "2px solid transparent", cursor: "pointer", marginBottom: -1, transition: "all .15s" }),
    card: { background: B.card, borderRadius: 12, border: "1px solid " + B.border, padding: 20, marginBottom: 16 },
    cardTitle: { fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 14 },
    infoRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid " + B.border + "44" },
    infoLabel: { fontSize: 13, color: B.muted, fontWeight: 500 },
    infoValue: { fontSize: 13, color: B.text, fontWeight: 600, textAlign: "right", maxWidth: "60%", wordBreak: "break-word" },
    statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 },
    statBox: { background: B.darker, borderRadius: 10, padding: 16, textAlign: "center" },
    statValue: { fontSize: 22, fontWeight: 800, color: B.text },
    statLabel: { fontSize: 11, color: B.dim, marginTop: 2, fontWeight: 600 },
    // Movement scores
    scoreRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid " + B.border + "44" },
    scoreLabel: { width: 60, fontSize: 13, fontWeight: 700, color: B.text },
    scoreBar: { display: "flex", gap: 4, flex: 1, alignItems: "center" },
    scoreCell: (active, value) => {
      let bg = B.border + "44";
      let fg = B.dim;
      if (active) {
        if (value < 0) { bg = B.red; fg = "#fff"; }
        else if (value === 0) { bg = "#eab308"; fg = "#000"; }
        else { bg = B.green; fg = "#fff"; }
      }
      return { width: 36, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: bg, color: fg, cursor: "pointer", transition: "all .15s", border: active ? "none" : "1px solid " + B.border + "33" };
    },
    // Gamification
    xpBar: { width: "100%", height: 12, borderRadius: 6, background: B.darker, overflow: "hidden", marginBottom: 6 },
    xpFill: (pct) => ({ width: (pct * 100) + "%", height: "100%", background: B.accent, borderRadius: 6, transition: "width .3s" }),
    xpText: { fontSize: 12, color: B.dim, marginBottom: 18 },
    badgesGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
    badgePill: { padding: "5px 14px", borderRadius: 16, fontSize: 12, fontWeight: 600, background: B.accent + "22", color: B.accent },
    tagPill: { display: "inline-block", padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: B.blue + "22", color: B.blue, marginRight: 6 },
    placeholder: { padding: 48, textAlign: "center", color: B.dim, fontSize: 14 },
  };

  const formatAddress = (addr) => {
    if (!addr || (!addr.street && !addr.city)) return "---";
    const parts = [addr.street, addr.city, addr.state ? `${addr.state} ${addr.zip || ""}`.trim() : addr.zip].filter(Boolean);
    return parts.join(", ");
  };

  const startEdit = (field, val) => { setEditingField(field); setEditValue(val || ""); };
  const saveEdit = (field) => {
    if (!member) return;
    const updates = {};
    if (field === "email") updates.email = editValue.trim();
    else if (field === "phone") updates.phone = editValue.trim();
    else if (field === "pin") updates.pin = editValue.trim();
    else if (field === "startDate") updates.startDate = editValue;
    else if (field === "notes") updates.notes = editValue.trim();
    else if (field === "dob") updates.dob = editValue;
    else if (field === "gender") updates.gender = editValue.trim();
    else if (field === "source") updates.source = editValue.trim();
    else if (field === "tags") updates.tags = editValue.split(",").map(t => t.trim()).filter(Boolean);
    else if (field === "street") updates.address = { ...(member.address || {}), street: editValue.trim() };
    else if (field === "city") updates.address = { ...(member.address || {}), city: editValue.trim() };
    else if (field === "state") updates.address = { ...(member.address || {}), state: editValue.trim() };
    else if (field === "zip") updates.address = { ...(member.address || {}), zip: editValue.trim() };
    else if (field === "emergencyName") updates.emergencyContact = { ...(member.emergencyContact || {}), name: editValue.trim() };
    else if (field === "emergencyPhone") updates.emergencyContact = { ...(member.emergencyContact || {}), phone: editValue.trim() };
    else if (field === "emergencyRel") updates.emergencyContact = { ...(member.emergencyContact || {}), relationship: editValue.trim() };
    updateMember(member.id, updates);
    setEditingField(null);
  };

  const EditableRow = ({ label, field, value, type }) => {
    const isEditing = editingField === field;
    const inputStyle = { background: B.darker, border: "1px solid " + B.accent + "60", borderRadius: 6, color: B.text, padding: "5px 8px", fontSize: 13, outline: "none", flex: 1, maxWidth: 260 };
    return (
      <div style={s.infoRow}>
        <span style={s.infoLabel}>{label}</span>
        {isEditing ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {type === "textarea" ? (
              <textarea value={editValue} onChange={e => setEditValue(e.target.value)} style={{ ...inputStyle, minHeight: 50, resize: "vertical", fontFamily: "inherit" }} autoFocus />
            ) : (
              <input type={type || "text"} value={editValue} onChange={e => setEditValue(e.target.value)} style={inputStyle} autoFocus onKeyDown={e => { if (e.key === "Enter") saveEdit(field); if (e.key === "Escape") setEditingField(null); }} />
            )}
            <button onClick={() => saveEdit(field)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: B.accent, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
            <button onClick={() => setEditingField(null)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + B.border, background: "transparent", color: B.muted, fontSize: 11, cursor: "pointer" }}>Cancel</button>
          </div>
        ) : (
          <span style={{ ...s.infoValue, cursor: "pointer", borderBottom: "1px dashed " + B.border }} onClick={() => startEdit(field, value)}>
            {value || "---"}
          </span>
        )}
      </div>
    );
  };

  const renderOverview = () => (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Client Info</div>
        <EditableRow label="Email" field="email" value={member.email} type="email" />
        <EditableRow label="Phone" field="phone" value={member.phone} type="tel" />
        <EditableRow label="PIN" field="pin" value={member.pin} />
        <EditableRow label="Date of Birth" field="dob" value={member.dob} type="date" />
        <EditableRow label="Gender" field="gender" value={member.gender} />
        <EditableRow label="Street" field="street" value={member.address?.street} />
        <EditableRow label="City" field="city" value={member.address?.city} />
        <EditableRow label="State" field="state" value={member.address?.state} />
        <EditableRow label="Zip" field="zip" value={member.address?.zip} />
        <EditableRow label="Start Date" field="startDate" value={member.startDate} type="date" />
        <EditableRow label="Lead Source" field="source" value={member.source} />
        <EditableRow label="Notes" field="notes" value={member.notes} type="textarea" />
        <EditableRow label="Tags" field="tags" value={(member.tags || []).join(", ")} />

        {/* Emergency Contact */}
        <div style={{ ...s.cardTitle, marginTop: 16, fontSize: 14 }}>Emergency Contact</div>
        <EditableRow label="Name" field="emergencyName" value={member.emergencyContact?.name} />
        <EditableRow label="Phone" field="emergencyPhone" value={member.emergencyContact?.phone} type="tel" />
        <EditableRow label="Relationship" field="emergencyRel" value={member.emergencyContact?.relationship} />

        <div style={{ paddingTop: 12 }}>
          <button
            onClick={handleSendCredentials}
            disabled={sendingCreds}
            style={{
              background: B.accent, color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              opacity: sendingCreds ? 0.6 : 1,
            }}
          >
            {sendingCreds ? "Sending..." : "Send Login Credentials"}
          </button>
        </div>
      </div>

      <div style={s.statsRow}>
        <div style={s.statBox}>
          <div style={s.statValue}>{g.totalWorkouts || 0}</div>
          <div style={s.statLabel}>Total Workouts</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statValue}>{g.currentStreak || 0}</div>
          <div style={s.statLabel}>Current Streak</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statValue}>{g.level || 1}</div>
          <div style={s.statLabel}>Level</div>
        </div>
      </div>
    </>
  );

  const renderMovementScores = () => (
    <div style={s.card}>
      <div style={s.cardTitle}>Movement Assessment Scores</div>
      <div style={{ fontSize: 12, color: B.dim, marginBottom: 14 }}>Click a score to update. Range: -3 (major limitation) to +3 (optimal).</div>
      {PATTERNS.map((p) => {
        const current = ms[p] ?? 0;
        return (
          <div key={p} style={s.scoreRow}>
            <span style={s.scoreLabel}>{p}</span>
            <div style={s.scoreBar}>
              {SCORE_RANGE.map((v) => (
                <div
                  key={v}
                  style={s.scoreCell(current === v, v)}
                  onClick={() => handleScoreClick(p, v)}
                  title={`Set ${p} to ${v > 0 ? "+" : ""}${v}`}
                >
                  {v > 0 ? "+" : ""}{v}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderGamification = () => (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Level {g.level || 1}</div>
        <div style={s.xpBar}>
          <div style={s.xpFill(xpProgress)} />
        </div>
        <div style={s.xpText}>{g.xp || 0} / {xpForNext} XP to next level</div>

        <div style={s.statsRow}>
          <div style={s.statBox}>
            <div style={s.statValue}>{g.totalWorkouts || 0}</div>
            <div style={s.statLabel}>Total Workouts</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statValue}>{(g.totalWeightLifted || 0).toLocaleString()}</div>
            <div style={s.statLabel}>Total Weight Lifted (lbs)</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statValue}>{g.currentStreak || 0}</div>
            <div style={s.statLabel}>Current Streak</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statValue}>{g.longestStreak || 0}</div>
            <div style={s.statLabel}>Longest Streak</div>
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Badges</div>
        {(g.badges || []).length === 0 ? (
          <div style={{ color: B.dim, fontSize: 13 }}>No badges earned yet.</div>
        ) : (
          <div style={s.badgesGrid}>
            {g.badges.map((b) => (
              <span key={b} style={s.badgePill}>{b}</span>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const handleAddScan = () => {
    const scan = {
      id: crypto.randomUUID(),
      date: scanForm.date || new Date().toISOString().slice(0, 10),
      weight: parseFloat(scanForm.weight) || 0,
      bodyFatPercent: parseFloat(scanForm.bodyFatPercent) || 0,
      skeletalMuscleMass: parseFloat(scanForm.skeletalMuscleMass) || 0,
      bmi: parseFloat(scanForm.bmi) || 0,
      bmr: parseFloat(scanForm.bmr) || 0,
      bodyFatMass: parseFloat(scanForm.bodyFatMass) || 0,
      totalBodyWater: parseFloat(scanForm.totalBodyWater) || 0,
      visceralFatLevel: parseFloat(scanForm.visceralFatLevel) || 0,
      segmentalLean: {
        leftArm: parseFloat(scanForm.leftArm) || 0,
        rightArm: parseFloat(scanForm.rightArm) || 0,
        trunk: parseFloat(scanForm.trunk) || 0,
        leftLeg: parseFloat(scanForm.leftLeg) || 0,
        rightLeg: parseFloat(scanForm.rightLeg) || 0,
      },
    };
    const history = [...(member.inbody?.history || []), scan].sort((a, b) => a.date.localeCompare(b.date));
    updateMember(member.id, { inbody: { lastScan: scan.date, history } });
    setScanModalOpen(false);
    setScanForm({ date: "", weight: "", bodyFatPercent: "", skeletalMuscleMass: "", bmi: "", bmr: "", bodyFatMass: "", totalBodyWater: "", visceralFatLevel: "", leftArm: "", rightArm: "", trunk: "", leftLeg: "", rightLeg: "" });
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setLastSynced("just now"); }, 2000);
  };

  const renderBodyComposition = () => {
    const ib = member.inbody || { lastScan: null, history: [] };
    const history = ib.history || [];
    const latest = history.length > 0 ? history[history.length - 1] : null;
    const seg = latest?.segmentalLean;

    const chartData = history.map(h => ({
      date: new Date(h.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      "Body Fat %": h.bodyFatPercent,
      "SMM (lbs)": h.skeletalMuscleMass,
    }));

    const segmentData = seg ? [
      { label: "Left Arm", value: seg.leftArm },
      { label: "Right Arm", value: seg.rightArm },
      { label: "Trunk", value: seg.trunk },
      { label: "Left Leg", value: seg.leftLeg },
      { label: "Right Leg", value: seg.rightLeg },
    ] : [];

    const maxSeg = segmentData.length > 0 ? Math.max(...segmentData.map(d => d.value)) : 1;

    const scanField = (label, key, placeholder) => (
      <div style={{ flex: 1, minWidth: 100 }}>
        <label style={s.infoLabel}>{label}</label>
        <input style={{ ...s_input, marginTop: 4 }} value={scanForm[key]} onChange={e => setScanForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder || ""} />
      </div>
    );

    const s_input = { width: "100%", background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "9px 12px", color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" };

    return (
      <>
        {/* Latest Scan Summary */}
        {latest ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              ["Weight", `${latest.weight} lbs`, B.accent],
              ["Body Fat %", `${latest.bodyFatPercent}%`, B.orange],
              ["SMM", `${latest.skeletalMuscleMass} lbs`, B.green],
              ["BMI", latest.bmi, B.blue],
              ["BMR", `${latest.bmr} kcal`, B.purple],
            ].map(([label, value, color]) => (
              <div key={label} style={{ background: B.card, borderRadius: 12, border: "1px solid " + B.border, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 12, color: B.dim, marginTop: 4, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={s.card}>
            <div style={{ textAlign: "center", color: B.dim, padding: 24, fontSize: 14 }}>No InBody scans recorded yet. Add a scan to get started.</div>
          </div>
        )}

        {/* Body Composition Chart */}
        {history.length > 1 && (
          <div style={s.card}>
            <div style={s.cardTitle}>Body Composition Over Time</div>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={B.border} />
                  <XAxis dataKey="date" stroke={B.muted} fontSize={12} />
                  <YAxis stroke={B.muted} fontSize={12} />
                  <Tooltip contentStyle={{ background: B.card, border: "1px solid " + B.border, borderRadius: 8, color: B.text }} />
                  <Legend />
                  <Line type="monotone" dataKey="Body Fat %" stroke={B.orange} strokeWidth={2} dot={{ fill: B.orange }} />
                  <Line type="monotone" dataKey="SMM (lbs)" stroke={B.green} strokeWidth={2} dot={{ fill: B.green }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Segmental Lean Analysis */}
        {seg && (
          <div style={s.card}>
            <div style={s.cardTitle}>Segmental Lean Analysis</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {segmentData.map(({ label, value }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 80, fontSize: 13, fontWeight: 600, color: B.text }}>{label}</span>
                  <div style={{ flex: 1, height: 20, borderRadius: 10, background: B.darker, overflow: "hidden" }}>
                    <div style={{ width: `${(value / maxSeg) * 100}%`, height: "100%", borderRadius: 10, background: B.accent, transition: "width .3s" }} />
                  </div>
                  <span style={{ width: 50, textAlign: "right", fontSize: 13, fontWeight: 700, color: B.text }}>{value} lbs</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scan History Table */}
        {history.length > 0 && (
          <div style={s.card}>
            <div style={s.cardTitle}>Scan History</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>{["Date", "Weight", "BF%", "SMM", "BMI"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid " + B.border, color: B.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {[...history].reverse().map(scan => (
                    <tr key={scan.id} style={{ borderBottom: "1px solid " + B.border + "44" }}>
                      <td style={{ padding: "8px 10px", color: B.text }}>{formatDate(scan.date)}</td>
                      <td style={{ padding: "8px 10px", color: B.text }}>{scan.weight} lbs</td>
                      <td style={{ padding: "8px 10px", color: B.text }}>{scan.bodyFatPercent}%</td>
                      <td style={{ padding: "8px 10px", color: B.text }}>{scan.skeletalMuscleMass} lbs</td>
                      <td style={{ padding: "8px 10px", color: B.text }}>{scan.bmi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Scan Button */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setScanModalOpen(true)} style={{ background: B.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Add Scan</button>
        </div>

        {/* InBody API Connection */}
        <div style={s.card}>
          <div style={s.cardTitle}>InBody Cloud Integration</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={s.infoLabel}>API Key</label>
              <input style={{ ...s_input, marginTop: 4 }} type="password" value={inbodyApiKey} onChange={e => setInbodyApiKey(e.target.value)} placeholder="Enter your InBody API key" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={handleSync} disabled={syncing || !inbodyApiKey} style={{ background: inbodyApiKey ? B.accent : B.border, color: inbodyApiKey ? "#fff" : B.dim, border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: inbodyApiKey ? "pointer" : "default", opacity: syncing ? 0.6 : 1 }}>
                {syncing ? "Syncing..." : "Sync"}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: inbodyApiKey ? B.green : B.red }} />
                <span style={{ fontSize: 12, color: inbodyApiKey ? B.green : B.red, fontWeight: 600 }}>{inbodyApiKey ? "Connected" : "Not Connected"}</span>
              </div>
              {lastSynced && <span style={{ fontSize: 11, color: B.dim }}>Last synced: {lastSynced}</span>}
            </div>
            <div style={{ fontSize: 12, color: B.dim }}>Connect your InBody account to automatically sync scan results.</div>
          </div>
        </div>

        {/* Add Scan Modal */}
        {scanModalOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setScanModalOpen(false)}>
            <div style={{ background: B.dark, borderRadius: 14, border: "1px solid " + B.border, padding: 28, width: 520, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 800, color: B.text, marginBottom: 18 }}>Add InBody Scan</div>

              <div style={{ marginBottom: 14 }}>
                <label style={s.infoLabel}>Scan Date</label>
                <input style={{ ...s_input, marginTop: 4 }} type="date" value={scanForm.date} onChange={e => setScanForm(p => ({ ...p, date: e.target.value }))} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                {scanField("Weight (lbs)", "weight", "175")}
                {scanField("Body Fat %", "bodyFatPercent", "22.5")}
                {scanField("SMM (lbs)", "skeletalMuscleMass", "65.0")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                {scanField("BMI", "bmi", "24.5")}
                {scanField("BMR (kcal)", "bmr", "1650")}
                {scanField("Body Fat Mass", "bodyFatMass", "35.0")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {scanField("Total Body Water", "totalBodyWater", "90.0")}
                {scanField("Visceral Fat Level", "visceralFatLevel", "7")}
              </div>

              <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 10 }}>Segmental Lean (lbs)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                {scanField("Left Arm", "leftArm", "6.5")}
                {scanField("Right Arm", "rightArm", "6.8")}
                {scanField("Trunk", "trunk", "45.0")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {scanField("Left Leg", "leftLeg", "18.0")}
                {scanField("Right Leg", "rightLeg", "18.2")}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                <button onClick={() => setScanModalOpen(false)} style={{ background: "transparent", border: "1px solid " + B.border, borderRadius: 8, padding: "8px 18px", color: B.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleAddScan} style={{ background: B.accent, border: "none", borderRadius: 8, padding: "8px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Save Scan</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const memberPlan = plans.find(p => p.id === member.membershipPlanId);
  const memberMethods = paymentMethods.filter(pm => pm.memberId === member.id);
  const memberPayments = payments.filter(p => p.memberId === member.id || p.member === (member.firstName + " " + member.lastName)).sort((a, b) => b.date.localeCompare(a.date));
  const memberAttendance = attendance.filter(a => a.memberId === member.id && !a.noShow).sort((a, b) => b.checkInTime.localeCompare(a.checkInTime));
  const classById = (cid) => { const c = (schedule || []).find(x => x.id === cid); return c ? c.name : "Open Gym"; };

  const handleDeleteMethod = (pmId) => {
    setPaymentMethods(prev => prev.filter(pm => pm.id !== pmId));
  };
  const handleSetDefault = (pmId) => {
    setPaymentMethods(prev => prev.map(pm => pm.memberId === member.id ? { ...pm, isDefault: pm.id === pmId } : pm));
  };
  const handlePlanDropdownChange = (planId) => {
    const oldPlan = plans.find(p => p.id === member.membershipPlanId);
    const newPlan = plans.find(p => p.id === planId);

    // Removing plan → show cancel modal with options
    if (oldPlan && !planId) {
      setCancelModal({ oldPlan });
      return;
    }

    // Changing plan → prompt: is this an upgrade/downgrade or should they cancel instead?
    if (oldPlan && newPlan && oldPlan.id !== newPlan.id) {
      setPlanChangePrompt({ oldPlan, newPlan, planId });
      return;
    }

    // Assigning first plan
    if (!oldPlan && newPlan) {
      executePlanAssign(planId, null, newPlan, "join");
    }
  };

  const executePlanAssign = (planId, oldPlan, newPlan, eventType, changeDetails = {}) => {
    const memberName = member.firstName + " " + member.lastName;
    const details = { ...changeDetails };
    if (oldPlan) { details.oldPlan = oldPlan.name; details.oldPrice = oldPlan.price; details.isTrial = !!oldPlan.isTrial; }
    if (newPlan) { details.newPlan = newPlan.name; details.newPrice = newPlan.price; details.isTrial = !!newPlan.isTrial; }
    logEvent(member.id, memberName, eventType, details);
    logChange(member.id, memberName, eventType === "join" ? "plan_assigned" : eventType === "cancel" ? "plan_removed" : "plan_changed", "membershipPlanId", oldPlan?.id || null, planId || null);
    let planEndDate = null;
    if (newPlan?.durationType === "fixed" && newPlan?.durationWeeks) {
      const end = new Date();
      end.setDate(end.getDate() + newPlan.durationWeeks * 7);
      planEndDate = end.toISOString().slice(0, 10);
    }
    updateMember(member.id, { membershipPlanId: planId || null, cancelScheduled: null, planEndDate });
  };

  const handleCancelConfirm = (cancelType, futureDate) => {
    const memberName = member.firstName + " " + member.lastName;
    const oldPlan = cancelModal.oldPlan;

    if (cancelType === "instant") {
      logEvent(member.id, memberName, "cancel", { oldPlan: oldPlan.name, oldPrice: oldPlan.price, cancelType: "instant" });
      logChange(member.id, memberName, "cancel_instant", "membershipPlanId", oldPlan.id, null);
      updateMember(member.id, { membershipPlanId: null, cancelScheduled: null });
    } else if (cancelType === "end_of_cycle") {
      const cancelDate = getNextBillingDate(oldPlan);
      logEvent(member.id, memberName, "cancel", { oldPlan: oldPlan.name, oldPrice: oldPlan.price, cancelType: "end_of_cycle", effectiveDate: cancelDate });
      logChange(member.id, memberName, "cancel_scheduled", "cancelScheduled", null, cancelDate);
      updateMember(member.id, { cancelScheduled: cancelDate });
      showCredToast(`Cancellation scheduled for ${new Date(cancelDate).toLocaleDateString()}`);
    } else if (cancelType === "future" && futureDate) {
      logEvent(member.id, memberName, "cancel", { oldPlan: oldPlan.name, oldPrice: oldPlan.price, cancelType: "future", effectiveDate: futureDate });
      logChange(member.id, memberName, "cancel_scheduled", "cancelScheduled", null, futureDate);
      updateMember(member.id, { cancelScheduled: futureDate });
      showCredToast(`Cancellation scheduled for ${new Date(futureDate).toLocaleDateString()}`);
    }
    setCancelModal(null);
  };

  const getNextBillingDate = (plan) => {
    const d = new Date();
    if (plan.billingCycle === "monthly") d.setMonth(d.getMonth() + 1);
    else if (plan.billingCycle === "every-4-weeks") d.setDate(d.getDate() + 28);
    else if (plan.billingCycle === "weekly") d.setDate(d.getDate() + 7);
    else if (plan.billingCycle === "yearly") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  };

  const renderBilling = () => (
    <>
      {/* Send Credentials + Current Membership */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          onClick={handleSendCredentials}
          disabled={sendingCreds}
          style={{
            background: B.accent, color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            opacity: sendingCreds ? 0.6 : 1,
          }}
        >
          {sendingCreds ? "Sending..." : "Send Login Credentials"}
        </button>
      </div>
      <div style={s.card}>
        <div style={s.cardTitle}>Membership Plan</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <select
            value={member.membershipPlanId || ""}
            onChange={e => handlePlanDropdownChange(e.target.value)}
            style={{ background: B.darker, border: "1px solid " + B.border, borderRadius: 8, color: B.text, padding: "8px 12px", fontSize: 13, outline: "none", flex: 1 }}
          >
            <option value="">No Plan Assigned</option>
            {plans.filter(p => p.active).map(p => (
              <option key={p.id} value={p.id}>{p.name} — ${p.price}/{p.billingCycle}</option>
            ))}
          </select>
        </div>
        {memberPlan ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: member.planEndDate ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
              <div style={s.statBox}><div style={s.statValue}>${memberPlan.price}</div><div style={s.statLabel}>{memberPlan.billingCycle}</div></div>
              <div style={s.statBox}><div style={s.statValue}>{memberPlan.sessionsIncluded || "\u221E"}</div><div style={s.statLabel}>Sessions / Cycle</div></div>
              {member.planEndDate && (
                <div style={s.statBox}>
                  <div style={s.statValue}>{new Date(member.planEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                  <div style={s.statLabel}>{memberPlan.endBehavior === "rollover" ? "Rolls Over" : "Ends"}</div>
                </div>
              )}
            </div>
            {memberPlan.sessionsIncluded && (() => {
              const currentMonth = new Date().toISOString().slice(0, 7);
              const sessionsUsed = attendance.filter(a => a.memberId === member.id && !a.noShow && a.checkInTime?.slice(0, 7) === currentMonth).length;
              const util = Math.min(Math.round((sessionsUsed / memberPlan.sessionsIncluded) * 100), 100);
              const overUtil = sessionsUsed > memberPlan.sessionsIncluded;
              return (
                <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: B.darker, border: "1px solid " + B.border + "44" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: B.text, marginBottom: 10 }}>Session Usage</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: B.dim, marginBottom: 6 }}>
                    <span>{sessionsUsed} of {memberPlan.sessionsIncluded} sessions used</span>
                    <span style={{ fontWeight: 700, color: overUtil ? B.red : util >= 80 ? B.orange : B.green }}>{util}%</span>
                  </div>
                  <div style={{ width: "100%", height: 8, borderRadius: 4, background: B.border + "44" }}>
                    <div style={{ width: Math.min(util, 100) + "%", height: "100%", borderRadius: 4, background: overUtil ? B.red : util >= 80 ? B.orange : B.green, transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })()}
            {member.cancelScheduled && (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: B.red + "12", border: "1px solid " + B.red + "30", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: B.red }}>Cancellation Scheduled</div>
                  <div style={{ fontSize: 12, color: B.red + "cc" }}>Effective {new Date(member.cancelScheduled).toLocaleDateString()}</div>
                </div>
                <button onClick={() => {
                  updateMember(member.id, { cancelScheduled: null });
                  logChange(member.id, member.firstName + " " + member.lastName, "cancel_revoked", "cancelScheduled", member.cancelScheduled, null);
                  showCredToast("Cancellation revoked");
                }} style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: B.red + "22", color: B.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Revoke
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: B.dim, fontSize: 13 }}>No plan assigned. Select one above.</div>
        )}
        {/* Auto-charge toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "12px 0", borderTop: "1px solid " + B.border + "44" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: B.text }}>Auto-charge</div>
            <div style={{ fontSize: 11, color: B.dim }}>Automatically charge this client on their billing date</div>
          </div>
          <button
            onClick={() => updateMember(member.id, { autoCharge: !member.autoCharge })}
            style={{
              width: 46, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: member.autoCharge ? B.accent : B.border,
              position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 9, background: "#fff",
              position: "absolute", top: 3,
              left: member.autoCharge ? 25 : 3,
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </button>
        </div>
      </div>

      {/* Saved Payment Methods */}
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={s.cardTitle}>Saved Payment Methods</div>
        </div>
        {memberMethods.length === 0 ? (
          <div style={{ padding: "12px 0" }}>
            <div style={{ color: B.dim, fontSize: 13, marginBottom: 12 }}>No saved payment methods. Payment methods are saved when processing a payment with "Save for future" checked.</div>
            <button onClick={() => setAddPaymentMethodOpen(true)} style={{ background: B.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Add Payment Method</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {memberMethods.map(pm => (
              <div key={pm.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: B.darker, border: pm.isDefault ? "2px solid " + B.accent : "1px solid " + B.border }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: pm.type === "card" ? B.blue + "22" : B.green + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  {pm.type === "card" ? "\uD83D\uDCB3" : "\uD83C\uDFE6"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: B.text }}>{pm.label || (pm.type === "card" ? (pm.brand || "Card") + " \u2022\u2022\u2022\u2022 " + (pm.last4 || "----") : "Bank: " + (pm.bankName || "Unknown"))}</div>
                  <div style={{ fontSize: 11, color: B.dim }}>{pm.type === "card" ? "Exp: " + (pm.expiry || "N/A") : "ACH Direct Debit"}{pm.isDefault ? " \u2022 Default" : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {!pm.isDefault && (
                    <button onClick={() => handleSetDefault(pm.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid " + B.accent + "40", background: B.accent + "15", color: B.accent, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Set Default</button>
                  )}
                  <button onClick={() => handleDeleteMethod(pm.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid " + B.red + "40", background: B.red + "15", color: B.red, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div style={s.card}>
        <div style={s.cardTitle}>Payment History</div>
        {memberPayments.length === 0 ? (
          <div style={{ color: B.dim, fontSize: 13, padding: "12px 0" }}>No payment records found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>{["Date", "Plan", "Amount", "Method", "Status"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid " + B.border, color: B.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {memberPayments.slice(0, 20).map(p => {
                  const stColor = p.status === "paid" ? B.green : p.status === "overdue" ? B.red : B.orange;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid " + B.border + "44" }}>
                      <td style={{ padding: "8px 10px", color: B.text }}>{p.date}</td>
                      <td style={{ padding: "8px 10px", color: B.text }}>{p.plan || "—"}</td>
                      <td style={{ padding: "8px 10px", color: B.text, fontWeight: 600 }}>${p.amount}</td>
                      <td style={{ padding: "8px 10px" }}><span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: B.card, color: B.muted, border: "1px solid " + B.border }}>{p.method || "—"}</span></td>
                      <td style={{ padding: "8px 10px" }}><span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: stColor + "20", color: stColor, textTransform: "capitalize" }}>{p.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Payment Method Modal */}
      {addPaymentMethodOpen && (
        <PaymentModal
          isOpen
          onClose={() => setAddPaymentMethodOpen(false)}
          amount={0}
          memberName={member.firstName + " " + member.lastName}
          memberEmail={member.email}
          description="Save payment method"
          memberId={member.id}
          savedMethods={memberMethods}
          onSuccess={() => setAddPaymentMethodOpen(false)}
        />
      )}
    </>
  );

  const memberChangelog = member ? getLogForMember(member.id) : [];
  const memberEvents = member ? events.filter(e => e.memberId === member.id).sort((a, b) => b.date.localeCompare(a.date)) : [];

  const EVENT_ICONS = { join: "\u2795", cancel: "\u274C", freeze: "\u2744\uFE0F", unfreeze: "\u2600\uFE0F", upgrade: "\u2B06\uFE0F", downgrade: "\u2B07\uFE0F", plan_change: "\u21C4" };
  const ACTION_LABELS = { plan_assigned: "Plan Assigned", plan_removed: "Plan Removed", plan_changed: "Plan Changed", cancel_scheduled: "Cancel Scheduled", cancel_instant: "Cancelled Instantly", cancel_revoked: "Cancel Revoked", status_changed: "Status Changed", field_updated: "Updated" };

  const handleUndo = (entry) => {
    if (!member) return;
    if (entry.field === "membershipPlanId") {
      updateMember(member.id, { membershipPlanId: entry.oldValue, cancelScheduled: null });
      // Remove the corresponding event instead of creating a new one
      if (entry.action === "plan_assigned" || entry.action === "plan_changed") {
        removeLatestEvent(member.id, "join");
      } else if (entry.action === "plan_removed" || entry.action === "cancel_instant") {
        removeLatestEvent(member.id, "cancel");
      }
    } else if (entry.field === "cancelScheduled") {
      updateMember(member.id, { cancelScheduled: entry.oldValue || null });
      removeLatestEvent(member.id, "cancel");
    } else if (entry.field === "membershipStatus") {
      updateMember(member.id, { membershipStatus: entry.oldValue });
    }
    markUndone(entry.id);
    showCredToast("Change undone");
  };

  const renderHistory = () => (
    <>
      {/* Member Change Log */}
      <div style={s.card}>
        <div style={s.cardTitle}>Change Log</div>
        {memberChangelog.length === 0 && memberEvents.length === 0 ? (
          <div style={{ color: B.dim, fontSize: 13, padding: "12px 0" }}>No changes recorded.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Membership events */}
            {memberEvents.slice(0, 30).map(e => {
              const d = new Date(e.date);
              const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              const icon = EVENT_ICONS[e.type] || "\uD83D\uDD18";
              let desc = e.type;
              if (e.type === "join") desc = `Joined${e.details?.newPlan ? " — " + e.details.newPlan : ""}`;
              else if (e.type === "cancel") desc = `Cancelled${e.details?.oldPlan ? " — " + e.details.oldPlan : ""}${e.details?.cancelType === "end_of_cycle" ? " (end of cycle)" : e.details?.cancelType === "future" ? ` (effective ${e.details.effectiveDate})` : ""}`;
              else if (e.type === "upgrade") desc = `Upgraded: ${e.details?.oldPlan || "?"} → ${e.details?.newPlan || "?"}`;
              else if (e.type === "downgrade") desc = `Downgraded: ${e.details?.oldPlan || "?"} → ${e.details?.newPlan || "?"}`;
              else if (e.type === "freeze") desc = `Membership frozen${e.details?.reason ? " — " + e.details.reason : ""}`;
              else if (e.type === "unfreeze") desc = "Membership unfrozen";
              else if (e.type === "plan_change") desc = `Plan changed: ${e.details?.oldPlan || "?"} → ${e.details?.newPlan || "?"}`;
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: B.text }}>{desc}</div>
                    <div style={{ fontSize: 11, color: B.dim }}>{dateStr} at {timeStr}{e.changedBy ? ` \u2022 by ${e.changedBy}` : ""}</div>
                  </div>
                </div>
              );
            })}

            {/* Changelog entries with undo */}
            {memberChangelog.filter(e => !e.undone).slice(0, 20).map(e => {
              const d = new Date(e.date);
              const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const label = ACTION_LABELS[e.action] || e.action;
              const oldPlan = e.field === "membershipPlanId" && e.oldValue ? plans.find(p => p.id === e.oldValue) : null;
              const newPlan = e.field === "membershipPlanId" && e.newValue ? plans.find(p => p.id === e.newValue) : null;
              let detail = "";
              if (oldPlan && newPlan) detail = `${oldPlan.name} → ${newPlan.name}`;
              else if (oldPlan && !newPlan) detail = `Removed: ${oldPlan.name}`;
              else if (!oldPlan && newPlan) detail = `Assigned: ${newPlan.name}`;
              else if (e.field === "cancelScheduled" && e.newValue) detail = `Effective: ${new Date(e.newValue).toLocaleDateString()}`;
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: B.card, border: "1px solid " + B.border + "44" }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{"\uD83D\uDD04"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: B.text, fontWeight: 600 }}>{label}</div>
                    {detail && <div style={{ fontSize: 12, color: B.muted }}>{detail}</div>}
                    <div style={{ fontSize: 11, color: B.dim }}>{dateStr}{e.changedBy ? ` \u2022 by ${e.changedBy}` : ""}</div>
                  </div>
                  <button onClick={() => handleUndo(e)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid " + B.orange + "40", background: B.orange + "12", color: B.orange, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Undo
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attendance History */}
      <div style={s.card}>
        <div style={s.cardTitle}>Attendance History</div>
        {memberAttendance.length === 0 ? (
          <div style={{ color: B.dim, fontSize: 13, padding: "12px 0" }}>No check-in records found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {memberAttendance.slice(0, 50).map(a => {
              const d = new Date(a.checkInTime);
              const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              const className = a.classId ? classById(a.classId) : "Open Gym";
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: B.green, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, color: B.text }}>{dateStr} at {timeStr}</div>
                  <span style={{ fontSize: 11, color: B.muted, padding: "2px 8px", borderRadius: 6, background: B.card }}>{className}</span>
                  <span style={{ fontSize: 11, color: B.dim }}>{a.method || "pin"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div style={s.page}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <button style={s.backBtn} onClick={() => navigate(_gp("members"))}>
          &#8592; Back to Clients
        </button>
        <button style={{ background: (B.purple || "#a855f7") + "18", color: B.purple || "#a855f7", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={() => {
          const gymId = localStorage.getItem("hf_gym_id") || "default";
          localStorage.setItem("hf_session_backup", localStorage.getItem("hf_session") || "");
          localStorage.setItem("hf_impersonating", "true");
          localStorage.setItem("hf_session", JSON.stringify({
            id: "impersonate_client_" + member.id,
            username: member.email,
            role: "client",
            memberId: member.id,
            displayName: member.firstName + " " + member.lastName + " (viewing as client)",
            gymId,
          }));
          window.location.href = `/gym/${gymId}/`;
        }}>
          View as Client
        </button>
      </div>

      {/* Header */}
      <div style={s.header}>
        <ProfileAvatar
          photo={member.photo}
          name={`${member.firstName} ${member.lastName}`}
          size={72}
          editable
          onPhotoChange={(url) => updateMember(member.id, { photo: url })}
          style={{ background: statusColor + "22", color: statusColor }}
        />
        <div style={s.headerInfo}>
          <div style={s.name}>{member.firstName} {member.lastName}</div>
          <div style={s.metaRow}>
            <span style={s.metaText}>{member.email}</span>
            <span style={s.metaText}>{member.phone}</span>
            <span style={s.badge(statusColor)}>{effectiveStatus}</span>
            {member.dob && <span style={s.metaText}>Age {Math.floor((Date.now() - new Date(member.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}</span>}
            <span style={s.metaText}>Client since {formatDate(member.startDate)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {TABS.map((t) => (
          <button key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "Overview" && renderOverview()}
      {tab === "Movement Scores" && renderMovementScores()}
      {tab === "Body Composition" && renderBodyComposition()}
      {tab === "Progress Photos" && (
        <div style={s.card}>
          <ProgressPhotos memberId={member.id} />
        </div>
      )}
      {tab === "Gamification" && renderGamification()}
      {tab === "Billing" && renderBilling()}
      {tab === "History" && renderHistory()}

      {/* Toast Notification */}
      {credToast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1100,
          background: credToast.type === "error" ? "#7f1d1d" : "#14532d",
          color: credToast.type === "error" ? "#fca5a5" : "#86efac",
          padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)", maxWidth: 360,
        }}>
          {credToast.msg}
        </div>
      )}

      {/* Cancel Membership Modal */}
      {cancelModal && (() => {
        const CancelOption = ({ icon, title, desc, type }) => (
          <button onClick={() => {
            if (type === "future") setCancelModal(prev => ({ ...prev, showDatePicker: true, selectedType: type }));
            else handleCancelConfirm(type);
          }} style={{
            width: "100%", padding: "14px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
            border: "1px solid " + B.border, background: B.dark, display: "flex", alignItems: "center", gap: 14,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = B.accent; e.currentTarget.style.background = B.accent + "08"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = B.border; e.currentTarget.style.background = B.dark; }}>
            <span style={{ fontSize: 24 }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: B.text }}>{title}</div>
              <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>{desc}</div>
            </div>
          </button>
        );
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setCancelModal(null)}>
            <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 480, width: "90%" }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: B.text }}>Cancel Membership</h3>
              <p style={{ color: B.muted, fontSize: 13, margin: "0 0 6px" }}>
                <strong>{member.firstName} {member.lastName}</strong> — {cancelModal.oldPlan.name} (${cancelModal.oldPlan.price}/{cancelModal.oldPlan.billingCycle})
              </p>
              <p style={{ color: B.muted, fontSize: 12, margin: "0 0 16px" }}>
                Would they like to switch to a different plan instead? Cancelling affects your attrition metrics.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <CancelOption icon={"\uD83D\uDD04"} title="End of Billing Cycle" desc={`Keeps access until ${getNextBillingDate(cancelModal.oldPlan)}`} type="end_of_cycle" />
                <CancelOption icon={"\u26A1"} title="Cancel Immediately" desc="Removes plan and access right now" type="instant" />
                <CancelOption icon={"\uD83D\uDCC5"} title="Schedule Future Date" desc="Choose a specific date to cancel" type="future" />
              </div>

              {cancelModal.showDatePicker && (
                <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="date" value={cancelModal.futureDate || ""} onChange={e => setCancelModal(prev => ({ ...prev, futureDate: e.target.value }))}
                    style={{ flex: 1, background: B.darker, border: "1px solid " + B.border, borderRadius: 8, color: B.text, padding: "8px 12px", fontSize: 13, outline: "none" }} />
                  <button onClick={() => cancelModal.futureDate && handleCancelConfirm("future", cancelModal.futureDate)}
                    disabled={!cancelModal.futureDate}
                    style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: cancelModal.futureDate ? B.red : B.dim, color: "#fff", fontSize: 13, fontWeight: 700, cursor: cancelModal.futureDate ? "pointer" : "not-allowed", opacity: cancelModal.futureDate ? 1 : 0.5 }}>
                    Confirm
                  </button>
                </div>
              )}

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid " + B.border + "44", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setCancelModal(null)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Go Back
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Plan Change Prompt — suggests upgrade/downgrade classification */}
      {planChangePrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setPlanChangePrompt(null)}>
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 480, width: "90%" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: B.text }}>Confirm Plan Change</h3>
            <p style={{ color: B.text, fontSize: 14, margin: "0 0 8px" }}>
              Change <strong>{member.firstName} {member.lastName}</strong>'s plan?
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", margin: "8px 0 16px" }}>
              <div style={{ padding: "6px 12px", borderRadius: 8, background: B.red + "15", color: B.red, fontSize: 13, fontWeight: 600 }}>
                {planChangePrompt.oldPlan.name} (${planChangePrompt.oldPlan.price})
              </div>
              <span style={{ color: B.muted, fontSize: 18 }}>{"\u2192"}</span>
              <div style={{ padding: "6px 12px", borderRadius: 8, background: B.accent + "15", color: B.accent, fontSize: 13, fontWeight: 600 }}>
                {planChangePrompt.newPlan.name} (${planChangePrompt.newPlan.price})
              </div>
            </div>
            <p style={{ color: B.muted, fontSize: 12, margin: "0 0 12px", lineHeight: 1.5 }}>
              Classify this change correctly — it affects your analytics. Don't cancel and re-add as a new membership, that will count as attrition.
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[
                { type: "upgrade", label: "Upgrade", color: B.accent, icon: "\u2B06\uFE0F" },
                { type: "downgrade", label: "Downgrade", color: B.orange, icon: "\u2B07\uFE0F" },
                { type: "plan_change", label: "Lateral Change", color: B.blue || "#3b82f6", icon: "\u21C4" },
              ].map(opt => (
                <button key={opt.type} onClick={() => setPlanChangePrompt(prev => ({ ...prev, changeType: opt.type }))}
                  style={{
                    flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                    border: planChangePrompt.changeType === opt.type ? `2px solid ${opt.color}` : `1px solid ${B.border}`,
                    background: planChangePrompt.changeType === opt.type ? opt.color + "15" : B.dark,
                    color: planChangePrompt.changeType === opt.type ? opt.color : B.muted,
                    transition: "all 0.15s",
                  }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setPlanChangePrompt(null)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button onClick={() => {
                const ct = planChangePrompt.changeType;
                if (!ct) return;
                executePlanAssign(planChangePrompt.planId, planChangePrompt.oldPlan, planChangePrompt.newPlan, ct);
                setPlanChangePrompt(null);
              }}
                disabled={!planChangePrompt.changeType}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: planChangePrompt.changeType ? B.accent : B.dim, color: "#fff", cursor: planChangePrompt.changeType ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, opacity: planChangePrompt.changeType ? 1 : 0.5 }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
