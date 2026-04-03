import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { PATS, PC } from "../../data/constants";

const PATTERNS = ["Squat", "Hinge", "Lunge", "Push", "Pull", "Core", "Carry"];
const SCORE_RANGE = [-3, -2, -1, 0, 1, 2, 3];
const SCORE_LABELS = {
  "-3": "Significant limitation",
  "-2": "Moderate limitation",
  "-1": "Minor limitation",
  "0": "Baseline / Average",
  "1": "Above average",
  "2": "Advanced",
  "3": "Elite",
};
const PATTERN_DESCRIPTIONS = {
  Squat: "Tests bilateral lower body mechanics, knee tracking, and hip mobility",
  Hinge: "Evaluates posterior chain loading, hip hinge pattern, and hamstring flexibility",
  Lunge: "Assesses single-leg stability, balance, and unilateral lower body strength",
  Push: "Measures upper body pressing mechanics, shoulder stability, and thoracic mobility",
  Pull: "Tests upper body pulling strength, scapular control, and lat engagement",
  Core: "Evaluates trunk stability, anti-rotation strength, and midline control",
  Carry: "Assesses loaded carry mechanics, grip strength, and postural endurance",
};

function getInitials(f, l) {
  return ((f?.[0] || "") + (l?.[0] || "")).toUpperCase();
}

function formatDate(d) {
  if (!d) return "---";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getScoreColor(val) {
  if (val <= -3) return "#ef4444";
  if (val === -2) return "#f87171";
  if (val === -1) return "#fb923c";
  if (val === 0) return "#facc15";
  if (val === 1) return "#a3e635";
  if (val === 2) return "#4ade80";
  return "#22c55e";
}

export default function AssessmentView() {
  const B = useTheme();
  const navigate = useNavigate();
  const _gp = (p) => `/gym/${localStorage.getItem("hf_gym_id") || "default"}/${p}`;
  const { members, updateMember, getMember } = useMembers();
  const [assessments, setAssessments] = useLocalStorage("hf_assessments", []);

  // Flow state: "select" | "assess" | "review" | "done"
  const [step, setStep] = useState("select");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [currentPatternIdx, setCurrentPatternIdx] = useState(0);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [assessorName, setAssessorName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAssessment, setExpandedAssessment] = useState(null);
  const [successMsg, setSuccessMsg] = useState(false);

  const activeMembers = members.filter((m) => m.membershipStatus !== "inactive");
  const selectedMember = selectedMemberId ? getMember(selectedMemberId) : null;
  const currentPattern = PATTERNS[currentPatternIdx];

  const filteredMembers = activeMembers.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (m.firstName + " " + m.lastName).toLowerCase().includes(q);
  });

  // --- Handlers ---
  const handleStartAssessment = () => {
    if (!selectedMemberId) return;
    const initScores = {};
    const initNotes = {};
    PATTERNS.forEach((p) => { initScores[p] = null; initNotes[p] = ""; });
    setScores(initScores);
    setNotes(initNotes);
    setCurrentPatternIdx(0);
    setStep("assess");
  };

  const handleScore = (pattern, value) => {
    setScores((prev) => ({ ...prev, [pattern]: value }));
  };

  const handleNotes = (pattern, text) => {
    setNotes((prev) => ({ ...prev, [pattern]: text }));
  };

  const handleNext = () => {
    if (currentPatternIdx < PATTERNS.length - 1) {
      setCurrentPatternIdx((i) => i + 1);
    } else {
      setStep("review");
    }
  };

  const handleBack = () => {
    if (currentPatternIdx > 0) {
      setCurrentPatternIdx((i) => i - 1);
    } else {
      setStep("select");
    }
  };

  const handleSave = () => {
    const scoreValues = {};
    const fullScores = {};
    PATTERNS.forEach((p) => {
      scoreValues[p] = scores[p] ?? 0;
      fullScores[p] = { score: scores[p] ?? 0, notes: notes[p] || "" };
    });

    // Update member movement scores
    updateMember(selectedMemberId, { movementScores: scoreValues });

    // Save assessment record
    const record = {
      id: crypto.randomUUID(),
      memberId: selectedMemberId,
      date: new Date().toISOString(),
      assessorName: assessorName || "Coach",
      scores: fullScores,
    };
    setAssessments((prev) => [record, ...prev]);
    setSuccessMsg(true);
    setStep("done");
  };

  const handleReset = () => {
    setStep("select");
    setSelectedMemberId("");
    setCurrentPatternIdx(0);
    setScores({});
    setNotes({});
    setSuccessMsg(false);
  };

  // --- Styles ---
  const s = {
    page: { minHeight: "100%" },
    header: { marginBottom: 28 },
    title: { fontSize: 26, fontWeight: 800, color: B.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: B.muted, fontWeight: 500 },
    card: { background: B.card, borderRadius: 14, border: "1px solid " + B.border, padding: 24, marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: 700, color: B.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
    label: { fontSize: 13, fontWeight: 600, color: B.muted, marginBottom: 6, display: "block" },
    input: { width: "100%", padding: "10px 14px", fontSize: 14, background: B.darker, border: "1px solid " + B.border, borderRadius: 10, color: B.text, outline: "none", boxSizing: "border-box" },
    select: { width: "100%", padding: "10px 14px", fontSize: 14, background: B.darker, border: "1px solid " + B.border, borderRadius: 10, color: B.text, outline: "none", boxSizing: "border-box", appearance: "none" },
    btnPrimary: (disabled) => ({
      padding: "12px 28px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 10,
      background: disabled ? B.border : B.accent, color: disabled ? B.dim : "#fff",
      cursor: disabled ? "not-allowed" : "pointer", transition: "all .2s",
    }),
    btnSecondary: { padding: "10px 20px", fontSize: 13, fontWeight: 600, border: "1px solid " + B.border, borderRadius: 10, background: "transparent", color: B.muted, cursor: "pointer" },
    btnSuccess: { padding: "12px 28px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 10, background: B.green, color: "#fff", cursor: "pointer" },
    avatar: (color) => ({
      width: 44, height: 44, borderRadius: "50%", background: (color || B.accent) + "22",
      color: color || B.accent, display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: 15, flexShrink: 0,
    }),
    progressBar: { height: 6, background: B.border, borderRadius: 3, marginBottom: 24, overflow: "hidden" },
    progressFill: (pct) => ({ height: "100%", width: pct + "%", background: B.accent, borderRadius: 3, transition: "width .3s" }),
    patternTitle: (color) => ({ fontSize: 28, fontWeight: 800, color: color, marginBottom: 4, textAlign: "center" }),
    patternDesc: { fontSize: 13, color: B.muted, textAlign: "center", marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" },
    scoreRow: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 },
    scoreBtn: (active, value) => {
      const color = getScoreColor(value);
      return {
        width: 72, padding: "14px 4px", textAlign: "center", borderRadius: 10, cursor: "pointer",
        border: active ? "2px solid " + color : "2px solid " + B.border + "66",
        background: active ? color + "22" : B.darker, transition: "all .15s",
      };
    },
    scoreBtnValue: (active, value) => ({ fontSize: 18, fontWeight: 800, color: active ? getScoreColor(value) : B.dim, marginBottom: 2 }),
    scoreBtnLabel: { fontSize: 9, color: B.dim, lineHeight: 1.2 },
    textarea: { width: "100%", padding: "10px 14px", fontSize: 13, background: B.darker, border: "1px solid " + B.border, borderRadius: 10, color: B.text, outline: "none", resize: "vertical", minHeight: 60, fontFamily: "inherit", boxSizing: "border-box" },
    navRow: { display: "flex", justifyContent: "space-between", marginTop: 20 },
    reviewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12, marginBottom: 20 },
    reviewCard: (color) => ({
      background: B.darker, borderRadius: 10, padding: 14, textAlign: "center",
      borderTop: "3px solid " + color,
    }),
    reviewLabel: { fontSize: 12, fontWeight: 700, color: B.muted, marginBottom: 6 },
    reviewScore: (value) => ({ fontSize: 24, fontWeight: 800, color: getScoreColor(value) }),
    reviewBar: (value) => ({
      height: 4, borderRadius: 2, marginTop: 6,
      background: B.border,
      position: "relative", overflow: "hidden",
    }),
    reviewBarFill: (value) => ({
      position: "absolute", left: "50%", height: "100%", borderRadius: 2,
      width: Math.abs(value) / 3 * 50 + "%",
      marginLeft: value < 0 ? -Math.abs(value) / 3 * 50 + "%" : 0,
      background: getScoreColor(value),
    }),
    historyRow: (expanded) => ({
      background: expanded ? B.darker : B.card, borderRadius: 12,
      border: "1px solid " + B.border, padding: 16, marginBottom: 8,
      cursor: "pointer", transition: "all .15s",
    }),
    historyHeader: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
    historyName: { fontSize: 14, fontWeight: 700, color: B.text, flex: 1 },
    historyDate: { fontSize: 12, color: B.muted, fontWeight: 500 },
    historyAssessor: { fontSize: 11, color: B.dim, fontWeight: 500 },
    historyScores: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 },
    historyPill: (value) => ({
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
      background: getScoreColor(value) + "22", color: getScoreColor(value),
    }),
    successCard: { background: B.green + "15", border: "1px solid " + B.green + "44", borderRadius: 14, padding: 32, textAlign: "center", marginBottom: 20 },
    successIcon: { fontSize: 48, marginBottom: 12 },
    successText: { fontSize: 18, fontWeight: 700, color: B.green, marginBottom: 4 },
    successSub: { fontSize: 13, color: B.muted, marginBottom: 20 },
    memberOption: (selected) => ({
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      background: selected ? B.accent + "15" : "transparent",
      border: selected ? "1px solid " + B.accent + "44" : "1px solid " + B.border + "44",
      borderRadius: 10, cursor: "pointer", marginBottom: 4, transition: "all .15s",
    }),
  };

  // --- Render Steps ---
  const renderSelect = () => (
    <div style={s.card}>
      <div style={s.sectionTitle}>{"\ud83d\udc64"} Select Client</div>
      <label style={s.label}>Search Clients</label>
      <input
        style={{ ...s.input, marginBottom: 12 }}
        placeholder="Type to search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 16 }}>
        {filteredMembers.map((m) => (
          <div key={m.id} style={s.memberOption(selectedMemberId === m.id)} onClick={() => setSelectedMemberId(m.id)}>
            <div style={s.avatar(B.accent)}>{getInitials(m.firstName, m.lastName)}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{m.firstName} {m.lastName}</div>
              <div style={{ fontSize: 11, color: B.dim }}>{m.membershipStatus} {"\u00b7"} Level {m.gamification?.level || 1}</div>
            </div>
          </div>
        ))}
        {filteredMembers.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: B.dim, fontSize: 13 }}>No clients found</div>
        )}
      </div>
      <label style={s.label}>Assessor Name</label>
      <input
        style={{ ...s.input, marginBottom: 20 }}
        placeholder="Your name"
        value={assessorName}
        onChange={(e) => setAssessorName(e.target.value)}
      />
      <button style={s.btnPrimary(!selectedMemberId)} onClick={handleStartAssessment} disabled={!selectedMemberId}>
        Start Assessment
      </button>
    </div>
  );

  const renderAssess = () => {
    const pct = ((currentPatternIdx + 1) / PATTERNS.length) * 100;
    const color = PC[currentPattern] || B.accent;
    return (
      <div style={s.card}>
        {/* Progress */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: B.muted }}>
            Pattern {currentPatternIdx + 1} of {PATTERNS.length}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: B.dim }}>
            {selectedMember?.firstName} {selectedMember?.lastName}
          </div>
        </div>
        <div style={s.progressBar}>
          <div style={s.progressFill(pct)} />
        </div>

        {/* Pattern Name */}
        <div style={s.patternTitle(color)}>{currentPattern}</div>
        <div style={s.patternDesc}>{PATTERN_DESCRIPTIONS[currentPattern]}</div>

        {/* Scoring Buttons */}
        <div style={s.scoreRow}>
          {SCORE_RANGE.map((val) => (
            <div
              key={val}
              style={s.scoreBtn(scores[currentPattern] === val, val)}
              onClick={() => handleScore(currentPattern, val)}
            >
              <div style={s.scoreBtnValue(scores[currentPattern] === val, val)}>
                {val > 0 ? "+" + val : val}
              </div>
              <div style={s.scoreBtnLabel}>{SCORE_LABELS[String(val)]}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <label style={s.label}>Notes (optional)</label>
        <textarea
          style={s.textarea}
          placeholder={"Observations for " + currentPattern + "..."}
          value={notes[currentPattern] || ""}
          onChange={(e) => handleNotes(currentPattern, e.target.value)}
        />

        {/* Navigation */}
        <div style={s.navRow}>
          <button style={s.btnSecondary} onClick={handleBack}>
            {currentPatternIdx === 0 ? "\u2190 Back to Select" : "\u2190 Back"}
          </button>
          <button
            style={s.btnPrimary(scores[currentPattern] === null)}
            onClick={handleNext}
            disabled={scores[currentPattern] === null}
          >
            {currentPatternIdx < PATTERNS.length - 1 ? "Next \u2192" : "Review \u2192"}
          </button>
        </div>
      </div>
    );
  };

  const renderReview = () => (
    <div style={s.card}>
      <div style={s.sectionTitle}>{"\ud83d\udccb"} Review Assessment</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={s.avatar(B.accent)}>{getInitials(selectedMember?.firstName, selectedMember?.lastName)}</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: B.text }}>{selectedMember?.firstName} {selectedMember?.lastName}</div>
          <div style={{ fontSize: 12, color: B.dim }}>Assessed by: {assessorName || "Coach"}</div>
        </div>
      </div>

      <div style={s.reviewGrid}>
        {PATTERNS.map((p) => {
          const val = scores[p] ?? 0;
          return (
            <div key={p} style={s.reviewCard(PC[p] || B.accent)}>
              <div style={s.reviewLabel}>{p}</div>
              <div style={s.reviewScore(val)}>{val > 0 ? "+" + val : val}</div>
              <div style={s.reviewBar(val)}>
                <div style={s.reviewBarFill(val)} />
              </div>
              {notes[p] && <div style={{ fontSize: 10, color: B.dim, marginTop: 6, fontStyle: "italic" }}>{notes[p]}</div>}
            </div>
          );
        })}
      </div>

      <div style={s.navRow}>
        <button style={s.btnSecondary} onClick={() => { setCurrentPatternIdx(PATTERNS.length - 1); setStep("assess"); }}>
          {"\u2190"} Edit Scores
        </button>
        <button style={s.btnSuccess} onClick={handleSave}>
          Save Assessment
        </button>
      </div>
    </div>
  );

  const renderDone = () => (
    <>
      <div style={s.successCard}>
        <div style={s.successIcon}>{"\u2705"}</div>
        <div style={s.successText}>Assessment Saved!</div>
        <div style={s.successSub}>
          Movement scores for {selectedMember?.firstName} {selectedMember?.lastName} have been updated.
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={s.btnPrimary(false)} onClick={handleReset}>
            Assess Another Client
          </button>
          <button style={s.btnSecondary} onClick={() => navigate(_gp("members/" + selectedMemberId))}>
            View Client Profile
          </button>
        </div>
      </div>
    </>
  );

  // --- Assessment History ---
  const renderHistory = () => {
    const sorted = [...assessments].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sorted.length === 0) {
      return (
        <div style={{ ...s.card, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{"\ud83d\udccb"}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: B.dim }}>No assessments recorded yet</div>
        </div>
      );
    }
    return sorted.map((a) => {
      const m = getMember(a.memberId);
      const name = m ? m.firstName + " " + m.lastName : "Unknown Client";
      const expanded = expandedAssessment === a.id;
      return (
        <div key={a.id} style={s.historyRow(expanded)} onClick={() => setExpandedAssessment(expanded ? null : a.id)}>
          <div style={s.historyHeader}>
            <div style={s.historyName}>{name}</div>
            <div style={s.historyAssessor}>{a.assessorName}</div>
            <div style={s.historyDate}>{formatDate(a.date)}</div>
          </div>
          <div style={s.historyScores}>
            {PATTERNS.map((p) => {
              const sc = a.scores?.[p]?.score ?? 0;
              return <span key={p} style={s.historyPill(sc)}>{p}: {sc > 0 ? "+" + sc : sc}</span>;
            })}
          </div>
          {expanded && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid " + B.border + "44" }}>
              {PATTERNS.map((p) => {
                const entry = a.scores?.[p];
                if (!entry) return null;
                return (
                  <div key={p} style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: PC[p] || B.accent, width: 50 }}>{p}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: getScoreColor(entry.score) }}>
                      {entry.score > 0 ? "+" + entry.score : entry.score}
                    </span>
                    {entry.notes && <span style={{ fontSize: 12, color: B.dim, fontStyle: "italic" }}>{entry.notes}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.title}>Movement Assessment</div>
        <div style={s.subtitle}>Score clients on 7 movement patterns (-3 to +3)</div>
      </div>

      {/* Flow */}
      {step === "select" && renderSelect()}
      {step === "assess" && renderAssess()}
      {step === "review" && renderReview()}
      {step === "done" && renderDone()}

      {/* Assessment History */}
      <div style={{ marginTop: 12 }}>
        <div style={s.sectionTitle}>{"\ud83d\udcc6"} Assessment History</div>
        {renderHistory()}
      </div>
    </div>
  );
}
