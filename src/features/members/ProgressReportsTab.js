import { useState, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { sendEmail } from "../../utils/messaging";
import { buildProgressReportHtml, printProgressReport, getBranding } from "../../utils/progressReport";
import { localISO } from "../../utils/dates";

const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

/* Mic button — dictates into a field via the Web Speech API (no audio stored). */
function DictationButton({ onText, B }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  if (!SR) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const t = e.results[i][0].transcript.trim();
          if (t) onText(t);
        }
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop dictation" : "Dictate with your voice"}
      style={{
        background: listening ? "#ef444422" : B.card,
        border: `1px solid ${listening ? "#ef4444" : B.border}`,
        borderRadius: 8, cursor: "pointer", fontSize: 14, padding: "4px 10px",
        color: listening ? "#ef4444" : B.muted, flexShrink: 0,
      }}
    >
      {listening ? "◼ Stop" : "🎤"}
    </button>
  );
}

function Field({ label, hint, value, onChange, B, rows = 3 }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
        <DictationButton B={B} onText={(t) => onChange(value ? value.replace(/\s*$/, "") + "\n" + t : t)} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={hint}
        style={{
          width: "100%", boxSizing: "border-box", background: B.dark, color: B.text,
          border: `1px solid ${B.border}`, borderRadius: 8, padding: "10px 12px",
          fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
        }}
      />
    </div>
  );
}

function mondayOfThisWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return localISO(d);
}

const emptyReport = (memberId, coachName) => ({
  id: crypto.randomUUID(),
  memberId,
  weekOf: mondayOfThisWeek(),
  goal: "", targetReview: "", wins: "", improvements: "", actionSteps: "", notes: "",
  coachName, status: "draft",
  createdAt: new Date().toISOString(),
});

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3002";

/* One voice memo → AI drafts the whole report. Records via the Web Speech API
   (transcript is editable), then the server turns it into structured fields. */
function VoiceMemoPanel({ B, member, previousGoal, previousActionSteps, onGenerated }) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef(null);

  const toggleRecord = () => {
    if (!SR) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const t = e.results[i][0].transcript.trim();
          if (t) setTranscript(prev => (prev ? prev + " " : "") + t);
        }
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };

  const generate = async () => {
    if (!transcript.trim()) { setError("Record or type your memo first."); return; }
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/ai/progress-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          memberName: `${member.firstName} ${member.lastName}`,
          previousGoal: previousGoal || undefined,
          previousActionSteps: previousActionSteps || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      onGenerated(data, transcript);
    } catch (e) {
      setError(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{
      background: B.accent + "10", border: `1px dashed ${B.accent}66`, borderRadius: 12,
      padding: "14px 16px", marginBottom: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: B.text }}>{"🎙️"} One voice memo — AI writes the report</div>
          <div style={{ fontSize: 11, color: B.muted, marginTop: 2 }}>
            Just talk about {member.firstName}'s week: how they did on last week's targets, wins, struggles, what's next.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {SR && (
            <button type="button" onClick={toggleRecord} style={{
              background: listening ? "#ef4444" : B.accent, color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer",
            }}>
              {listening ? "◼ Stop Recording" : "● Record"}
            </button>
          )}
          <button type="button" onClick={generate} disabled={generating || !transcript.trim()} style={{
            background: transcript.trim() ? "#111" : B.border, color: "#fff", border: "none",
            borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 800,
            cursor: transcript.trim() ? "pointer" : "default", opacity: generating ? 0.6 : 1,
          }}>
            {generating ? "Generating..." : "✨ Generate Report"}
          </button>
        </div>
      </div>
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={3}
        placeholder={SR
          ? "Hit Record and talk — your memo transcript lands here (or just type it), then Generate"
          : "Voice input isn't supported in this browser — type or paste your memo here, then Generate"}
        style={{
          width: "100%", boxSizing: "border-box", marginTop: 10, background: B.dark, color: B.text,
          border: `1px solid ${B.border}`, borderRadius: 8, padding: "8px 10px",
          fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
        }}
      />
      {error && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

export default function ProgressReportsTab({ member }) {
  const B = useTheme();
  const { currentUser } = useAuth();
  const [reports, setReports] = useLocalStorage("hf_progress_reports", []);
  const [editing, setEditing] = useState(null); // report object being edited
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");

  const myReports = (Array.isArray(reports) ? reports : [])
    .filter(r => r.memberId === member.id)
    .sort((a, b) => (b.weekOf || "").localeCompare(a.weekOf || ""));

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const saveReport = (rep) => {
    setReports(prev => {
      const list = Array.isArray(prev) ? prev : [];
      return list.some(r => r.id === rep.id)
        ? list.map(r => (r.id === rep.id ? rep : r))
        : [...list, rep];
    });
  };

  const startNew = () => {
    const last = myReports[0];
    const rep = emptyReport(member.id, currentUser?.displayName || "Coach");
    // Carry the overarching goal forward, and seed last week's targets for review
    if (last?.goal) rep.goal = last.goal;
    if (last?.actionSteps) {
      rep.targetReview = String(last.actionSteps).split("\n").map(t => t.trim()).filter(Boolean).map(t => `🟡 ${t} — `).join("\n");
    }
    setEditing(rep);
  };

  const markDelivered = (rep, channel) => ({
    ...rep,
    status: "delivered",
    deliveredAt: rep.deliveredAt || new Date().toISOString(),
    via: [...new Set([...(rep.via || []), channel])],
  });

  // Push to the client's app — the report appears on their portal home with a
  // "new report" banner and under Progress → report history.
  const handlePushToApp = (rep) => {
    const delivered = markDelivered(rep, "app");
    saveReport(delivered);
    setEditing(null);
    flash(`Pushed to ${member.firstName}'s app 📲 — they'll see it on their home screen`);
  };

  const handleSend = async (rep) => {
    if (!member.email) { flash("This client has no email on file."); return; }
    setSending(true);
    try {
      const html = buildProgressReportHtml(rep, member, getBranding());
      await sendEmail({
        to: member.email,
        subject: `Your Weekly Progress Report — week of ${rep.weekOf}`,
        html,
      });
      const delivered = markDelivered(rep, "email");
      saveReport(delivered);
      setEditing(null);
      flash(`Report emailed to ${member.email} ✓`);
    } catch (e) {
      flash("Send failed: " + (e.message || "unknown error"));
    } finally {
      setSending(false);
    }
  };

  const card = { background: B.card, border: `1px solid ${B.border}`, borderRadius: 12, padding: 16, marginBottom: 12 };
  const btn = (bg, fg, solid) => ({
    background: solid ? bg : bg + "18", color: solid ? "#fff" : fg || bg,
    border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  });

  /* ── Editor ── */
  if (editing) {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: B.text }}>
              {editing.status === "delivered" ? "Progress Report (delivered)" : "Weekly Progress Report"}
            </div>
            <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>
              Week of{" "}
              <input
                type="date" value={editing.weekOf}
                onChange={(e) => setEditing(p => ({ ...p, weekOf: e.target.value }))}
                style={{ background: B.dark, color: B.text, border: `1px solid ${B.border}`, borderRadius: 6, padding: "2px 6px", fontSize: 12 }}
              />
              {" "}· use the 🎤 on any field to dictate
            </div>
          </div>
          <button style={btn(B.border, B.muted)} onClick={() => setEditing(null)}>Close</button>
        </div>

        <VoiceMemoPanel
          B={B}
          member={member}
          previousGoal={myReports.find(r => r.id !== editing.id)?.goal}
          previousActionSteps={myReports.find(r => r.id !== editing.id)?.actionSteps}
          onGenerated={(data, transcript) => {
            setEditing(p => ({
              ...p,
              goal: data.goal || p.goal,
              targetReview: data.targetReview || p.targetReview,
              wins: data.wins || p.wins,
              improvements: data.improvements || p.improvements,
              actionSteps: data.actionSteps || p.actionSteps,
              notes: data.notes || p.notes,
              memoTranscript: transcript,
            }));
            flash("Report drafted from your memo ✨ — review and adjust below");
          }}
        />

        <Field B={B} label="Reminder of overarching goal" rows={2}
          hint="What is this client working toward long-term?"
          value={editing.goal} onChange={(v) => setEditing(p => ({ ...p, goal: v }))} />
        <Field B={B} label="Last week's targets — how'd we do?"
          hint={"One per line, e.g.\n✅ Drink 80oz water daily — crushed it\n❌ Book Saturday session — didn't happen"}
          value={editing.targetReview || ""} onChange={(v) => setEditing(p => ({ ...p, targetReview: v }))} />
        <Field B={B} label="Wins from this week"
          hint="One win per line — e.g. Hit all 3 scheduled sessions"
          value={editing.wins} onChange={(v) => setEditing(p => ({ ...p, wins: v }))} />
        <Field B={B} label="Areas to improve"
          hint="One per line — keep it constructive"
          value={editing.improvements} onChange={(v) => setEditing(p => ({ ...p, improvements: v }))} />
        <Field B={B} label="Action steps for the upcoming week"
          hint="One per line — specific and doable"
          value={editing.actionSteps} onChange={(v) => setEditing(p => ({ ...p, actionSteps: v }))} />
        <Field B={B} label="Coach's notes (optional)" rows={2}
          hint="Anything else you want the client to read"
          value={editing.notes} onChange={(v) => setEditing(p => ({ ...p, notes: v }))} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <button style={btn(B.accent, null, true)} disabled={sending}
            onClick={() => { saveReport(editing); setEditing(null); flash("Draft saved"); }}>
            Save Draft
          </button>
          <button style={btn("#3b82f6")} onClick={() => { saveReport(editing); printProgressReport(editing, member); }}>
            Preview / Save PDF
          </button>
          <button style={btn(B.accent, null, true)} onClick={() => handlePushToApp(editing)}>
            {"📲"} Push to App
          </button>
          <button style={btn(B.accent)} disabled={sending} onClick={() => handleSend(editing)}>
            {sending ? "Sending..." : `Email to ${member.firstName}`}
          </button>
        </div>
        {toast && <div style={{ marginTop: 10, fontSize: 12, color: B.accent, fontWeight: 600 }}>{toast}</div>}
      </div>
    );
  }

  /* ── List ── */
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: B.text }}>Weekly Progress Reports</div>
        <button style={btn(B.accent, null, true)} onClick={startNew}>+ New Report</button>
      </div>
      {toast && <div style={{ marginBottom: 10, fontSize: 12, color: B.accent, fontWeight: 600 }}>{toast}</div>}
      {myReports.length === 0 && (
        <p style={{ color: B.muted, fontSize: 13, margin: "8px 0" }}>
          No reports yet. Create one — dictate your notes with the 🎤 buttons, preview the branded PDF, then email it straight to {member.firstName}.
        </p>
      )}
      {myReports.map(r => (
        <div key={r.id} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", borderRadius: 10, border: `1px solid ${B.border}`, marginBottom: 8,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: B.text }}>Week of {r.weekOf}</div>
            <div style={{ fontSize: 11, color: B.muted, marginTop: 2 }}>
              {r.status === "delivered"
                ? `Delivered ${r.deliveredAt ? new Date(r.deliveredAt).toLocaleDateString() : ""}${(r.via || []).includes("app") ? " 📲" : ""}${(r.via || []).includes("email") ? " ✉️" : ""}${r.seenAt ? " · Seen ✓" : ""}`
                : "Draft"}
              {r.coachName ? ` · ${r.coachName}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 10, alignSelf: "center",
              background: r.status === "delivered" ? B.accent + "22" : B.border,
              color: r.status === "delivered" ? B.accent : B.muted,
            }}>
              {r.status === "delivered" ? "DELIVERED" : "DRAFT"}
            </span>
            {(r.via || []).includes("app") ? (
              <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 10, alignSelf: "center", background: B.border, color: B.muted }}>
                IN APP ✓
              </span>
            ) : (
              <button style={btn(B.accent, null, true)} onClick={() => handlePushToApp(r)}>{"📲"} Push</button>
            )}
            <button style={btn("#3b82f6")} onClick={() => printProgressReport(r, member)}>PDF</button>
            <button style={btn(B.accent)} onClick={() => setEditing(r)}>{r.status === "delivered" ? "View" : "Edit"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
