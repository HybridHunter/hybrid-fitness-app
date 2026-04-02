import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useMembershipEvents } from "../../hooks/useMembershipEvents";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PATTERNS = ["Squat", "Hinge", "Lunge", "Push", "Pull", "Core", "Carry"];
const SCORE_RANGE = [-3, -2, -1, 0, 1, 2, 3];
const TABS = ["Overview", "Movement Scores", "Body Composition", "Gamification", "Billing", "History"];

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
  const { getMember, updateMember } = useMembers();
  const { logEvent } = useMembershipEvents();
  const [tab, setTab] = useState("Overview");
  const [plans] = useLocalStorage("hf_plans", []);
  const [payments, setPayments] = useLocalStorage("hf_payments", []);
  const [paymentMethods, setPaymentMethods] = useLocalStorage("hf_payment_methods", []);
  const [attendance] = useLocalStorage("hf_attendance", []);
  const [schedule] = useLocalStorage("hf_schedule", []);
  const [editingMethod, setEditingMethod] = useState(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanForm, setScanForm] = useState({ date: "", weight: "", bodyFatPercent: "", skeletalMuscleMass: "", bmi: "", bmr: "", bodyFatMass: "", totalBodyWater: "", visceralFatLevel: "", leftArm: "", rightArm: "", trunk: "", leftLeg: "", rightLeg: "" });
  const [inbodyApiKey, setInbodyApiKey] = useLocalStorage("hf_inbody_api_key", "");
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  const member = getMember(id);
  if (!member) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: B.text, marginBottom: 8 }}>Member not found</div>
        <button onClick={() => navigate("/members")} style={{ background: B.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Back to Members</button>
      </div>
    );
  }

  const sc = STATUS_COLORS(B);
  const statusColor = sc[member.membershipStatus] || B.muted;
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

  const renderOverview = () => (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Member Info</div>
        {[
          ["Email", member.email],
          ["Phone", member.phone],
          ["PIN", member.pin || "---"],
          ["Address", formatAddress(member.address)],
          ["Start Date", formatDate(member.startDate)],
          ["Notes", member.notes || "---"],
        ].map(([label, value]) => (
          <div key={label} style={s.infoRow}>
            <span style={s.infoLabel}>{label}</span>
            <span style={s.infoValue}>{value}</span>
          </div>
        ))}
        <div style={{ ...s.infoRow, borderBottom: "none" }}>
          <span style={s.infoLabel}>Tags</span>
          <span style={s.infoValue}>
            {(member.tags || []).length > 0
              ? member.tags.map((t) => <span key={t} style={s.tagPill}>{t}</span>)
              : "---"}
          </span>
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
        <div style={s.statBox}>
          <div style={{ ...s.statValue, color: B.purple }}>{member.rank?.current || "---"}</div>
          <div style={s.statLabel}>Rank</div>
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
  const memberAttendance = attendance.filter(a => a.memberId === member.id).sort((a, b) => b.checkInTime.localeCompare(a.checkInTime));
  const classById = (cid) => { const c = (schedule || []).find(x => x.id === cid); return c ? c.name : "Open Gym"; };

  const handleDeleteMethod = (pmId) => {
    setPaymentMethods(prev => prev.filter(pm => pm.id !== pmId));
  };
  const handleSetDefault = (pmId) => {
    setPaymentMethods(prev => prev.map(pm => pm.memberId === member.id ? { ...pm, isDefault: pm.id === pmId } : pm));
  };
  const handleAssignPlan = (planId) => {
    const oldPlan = plans.find(p => p.id === member.membershipPlanId);
    const newPlan = plans.find(p => p.id === planId);
    const memberName = member.firstName + " " + member.lastName;

    if (oldPlan && newPlan && oldPlan.id !== newPlan.id) {
      const eventType = oldPlan.price < newPlan.price ? "upgrade" : oldPlan.price > newPlan.price ? "downgrade" : "plan_change";
      logEvent(member.id, memberName, eventType, { oldPlan: oldPlan.name, newPlan: newPlan.name, oldPrice: oldPlan.price, newPrice: newPlan.price });
    } else if (!oldPlan && newPlan) {
      logEvent(member.id, memberName, "plan_change", { newPlan: newPlan.name, newPrice: newPlan.price });
    }

    updateMember(member.id, { membershipPlanId: planId });
  };

  const renderBilling = () => (
    <>
      {/* Current Membership */}
      <div style={s.card}>
        <div style={s.cardTitle}>Membership Plan</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <select
            value={member.membershipPlanId || ""}
            onChange={e => handleAssignPlan(e.target.value)}
            style={{ background: B.darker, border: "1px solid " + B.border, borderRadius: 8, color: B.text, padding: "8px 12px", fontSize: 13, outline: "none", flex: 1 }}
          >
            <option value="">No Plan Assigned</option>
            {plans.filter(p => p.active).map(p => (
              <option key={p.id} value={p.id}>{p.name} — ${p.price}/{p.billingCycle}</option>
            ))}
          </select>
        </div>
        {memberPlan ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={s.statBox}><div style={s.statValue}>${memberPlan.price}</div><div style={s.statLabel}>{memberPlan.billingCycle}</div></div>
            <div style={s.statBox}><div style={s.statValue}>{memberPlan.sessionsIncluded || "\u221E"}</div><div style={s.statLabel}>Sessions / Cycle</div></div>
          </div>
        ) : (
          <div style={{ color: B.dim, fontSize: 13 }}>No plan assigned. Select one above.</div>
        )}
      </div>

      {/* Saved Payment Methods */}
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={s.cardTitle}>Saved Payment Methods</div>
        </div>
        {memberMethods.length === 0 ? (
          <div style={{ color: B.dim, fontSize: 13, padding: "12px 0" }}>No saved payment methods. Payment methods are saved when processing a payment with "Save for future" checked.</div>
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
    </>
  );

  const renderHistory = () => (
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
  );

  return (
    <div style={s.page}>
      <button style={s.backBtn} onClick={() => navigate("/members")}>
        &#8592; Back to Members
      </button>

      {/* Header */}
      <div style={s.header}>
        <div style={s.avatarLg}>{getInitials(member.firstName, member.lastName)}</div>
        <div style={s.headerInfo}>
          <div style={s.name}>{member.firstName} {member.lastName}</div>
          <div style={s.metaRow}>
            <span style={s.metaText}>{member.email}</span>
            <span style={s.metaText}>{member.phone}</span>
            <span style={s.badge(statusColor)}>{member.membershipStatus}</span>
            {member.rank?.current && <span style={s.badge(B.purple)}>{member.rank.current}</span>}
            <span style={s.metaText}>Member since {formatDate(member.startDate)}</span>
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
      {tab === "Gamification" && renderGamification()}
      {tab === "Billing" && renderBilling()}
      {tab === "History" && renderHistory()}
    </div>
  );
}
