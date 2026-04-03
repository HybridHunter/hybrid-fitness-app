import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";

const SUPABASE_URL = "https://qzvxnklyeadbroesccxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM";
const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };

const CATEGORIES = ["Bug Report", "Feature Request", "Question", "Other"];

async function supabaseGet(gymId, key) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/data_store?gym_id=eq.${encodeURIComponent(gymId)}&key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: HEADERS }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  if (rows.length === 0) return null;
  try { return JSON.parse(rows[0].value); } catch { return rows[0].value; }
}

async function supabaseUpsert(gymId, key, value) {
  await fetch(`${SUPABASE_URL}/rest/v1/data_store`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({ gym_id: gymId, key, value }),
  });
}

export default function FeedbackForm() {
  const B = useTheme();
  const { currentUser } = useAuth();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Bug Report");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const gymId = localStorage.getItem("hf_gym_id") || "local";
      let gymName = "";
      try { const b = JSON.parse(localStorage.getItem("hf_branding") || "{}"); if (b.gymName) gymName = b.gymName; } catch {}
      if (!gymName) { try { const s = JSON.parse(localStorage.getItem("hf_settings") || "{}"); if (s.gymName) gymName = s.gymName; } catch {} }
      if (!gymName) gymName = gymId;

      const existing = (await supabaseGet("__super__", "hf_feedback")) || [];
      const entry = {
        id: "fb_" + Date.now(),
        gymId,
        gymName,
        submittedBy: currentUser?.displayName || currentUser?.username || "Unknown",
        subject: subject.trim(),
        category,
        message: message.trim(),
        screenshot: screenshot.trim() || null,
        timestamp: new Date().toISOString(),
        status: "new",
      };
      await supabaseUpsert("__super__", "hf_feedback", [...existing, entry]);
      setSuccess(true);
      setSubject("");
      setCategory("Bug Report");
      setMessage("");
      setScreenshot("");
    } catch (err) {
      alert("Error submitting feedback: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const s = {
    page: { padding: 32, maxWidth: 700, margin: "0 auto" },
    h1: { fontSize: 28, fontWeight: 700, color: B.text, margin: 0 },
    subtitle: { color: B.muted, fontSize: 14, marginTop: 4, marginBottom: 24 },
    label: { fontSize: 13, fontWeight: 600, color: B.muted, marginBottom: 6, display: "block" },
    input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 14, boxSizing: "border-box" },
    select: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 14, boxSizing: "border-box" },
    field: { marginBottom: 16 },
    btn: { padding: "10px 24px", borderRadius: 8, border: "none", background: B.green, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: submitting ? 0.6 : 1 },
  };

  if (success) {
    return (
      <div style={s.page}>
        <h1 style={s.h1}>Help & Feedback</h1>
        <p style={s.subtitle}>We appreciate your feedback!</p>
        <Card>
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#9989;</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: B.text, marginBottom: 8 }}>Thanks! We'll get back to you soon.</h2>
            <p style={{ color: B.muted, fontSize: 14, marginBottom: 20 }}>Your feedback has been submitted to the team.</p>
            <button style={s.btn} onClick={() => setSuccess(false)}>Submit Another</button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Help & Feedback</h1>
      <p style={s.subtitle}>Report bugs, request features, or ask questions. We read every submission.</p>
      <Card>
        <div style={s.field}>
          <label style={s.label}>Subject</label>
          <input style={s.input} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary of your feedback" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Category</label>
          <select style={s.select} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>Message</label>
          <textarea
            style={{ ...s.input, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe your feedback in detail..."
          />
        </div>
        <div style={s.field}>
          <label style={s.label}>Screenshot URL (optional)</label>
          <input style={s.input} value={screenshot} onChange={e => setScreenshot(e.target.value)} placeholder="https://example.com/screenshot.png" />
        </div>
        <button
          style={{ ...s.btn, opacity: (!subject.trim() || !message.trim() || submitting) ? 0.5 : 1 }}
          onClick={handleSubmit}
          disabled={!subject.trim() || !message.trim() || submitting}
        >
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </Card>
    </div>
  );
}
