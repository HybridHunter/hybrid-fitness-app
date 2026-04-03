import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";

const SUPABASE_URL = "https://qzvxnklyeadbroesccxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM";
const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };

async function supabaseUpsert(gymId, key, value) {
  await fetch(`${SUPABASE_URL}/rest/v1/data_store`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({ gym_id: gymId, key, value: JSON.stringify(value) }),
  });
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function OnboardingWizard() {
  const B = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const totalSteps = 6;
  const gymId = localStorage.getItem("hf_gym_id") || "default";

  // Step 2: Branding
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#8fbf3b");
  const [tagline, setTagline] = useState("");

  // Step 3: First Class
  const [className, setClassName] = useState("");
  const [classDay, setClassDay] = useState("Monday");
  const [classTime, setClassTime] = useState("09:00");
  const [classCapacity, setClassCapacity] = useState("20");

  // Step 4: Members
  const [members, setMembers] = useState([
    { name: "", email: "", pin: "" },
    { name: "", email: "", pin: "" },
    { name: "", email: "", pin: "" },
  ]);

  const updateMember = (idx, field, val) => {
    setMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  };
  const addMemberRow = () => {
    if (members.length < 5) setMembers(prev => [...prev, { name: "", email: "", pin: "" }]);
  };

  // Check if already completed
  useEffect(() => {
    const completed = localStorage.getItem("hf_onboarding_complete");
    if (completed === "true") navigate(`/gym/${localStorage.getItem("hf_gym_id") || "default"}/`);
  }, [navigate]);

  const handleFinish = async () => {
    // Save branding
    if (logoUrl || tagline || primaryColor !== "#8fbf3b") {
      await supabaseUpsert(gymId, "hf_branding", { logoUrl, primaryColor, tagline });
      localStorage.setItem("hf_branding", JSON.stringify({ logoUrl, primaryColor, tagline }));
    }

    // Save first class
    if (className.trim()) {
      const classes = [{ id: "cls_1", name: className, day: classDay, time: classTime, capacity: parseInt(classCapacity) || 20, coach: currentUser?.displayName || "Coach" }];
      await supabaseUpsert(gymId, "hf_classes", classes);
      localStorage.setItem("hf_classes", JSON.stringify(classes));
    }

    // Save members
    const validMembers = members.filter(m => m.name.trim());
    if (validMembers.length > 0) {
      const memberRecords = validMembers.map((m, i) => {
        const parts = m.name.trim().split(" ");
        return { id: "m_" + (Date.now() + i), firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "", email: m.email, pin: m.pin || "1234", status: "active", joinDate: new Date().toISOString().split("T")[0] };
      });
      await supabaseUpsert(gymId, "hf_members", memberRecords);
      localStorage.setItem("hf_members", JSON.stringify(memberRecords));
    }

    // Mark complete
    localStorage.setItem("hf_onboarding_complete", "true");
    await supabaseUpsert(gymId, "hf_onboarding_complete", true);
    navigate(`/gym/${localStorage.getItem("hf_gym_id") || "default"}/`);
  };

  /* ===================== STYLES ===================== */
  const pageStyle = { minHeight: "100vh", background: B.darker, color: B.text, display: "flex", flexDirection: "column" };
  const containerStyle = { maxWidth: 640, margin: "0 auto", padding: "40px 24px", flex: 1 };
  const headingStyle = { fontSize: 24, fontWeight: 700, marginBottom: 8, color: B.text };
  const subStyle = { color: B.muted, fontSize: 15, marginBottom: 24, lineHeight: 1.6 };
  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${B.border}`, background: B.dark, color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontWeight: 600, fontSize: 13, color: B.muted, marginBottom: 6 };
  const fieldStyle = { marginBottom: 16 };
  const btnPrimary = { padding: "12px 32px", borderRadius: 8, background: B.green, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" };
  const btnSecondary = { padding: "12px 32px", borderRadius: 8, background: "transparent", color: B.muted, fontWeight: 600, fontSize: 15, border: `1px solid ${B.border}`, cursor: "pointer" };
  const btnText = { background: "none", border: "none", color: B.muted, fontSize: 13, cursor: "pointer", textDecoration: "underline" };

  const progressPct = (step / totalSteps) * 100;

  return (
    <div style={pageStyle}>
      {/* Progress bar */}
      <div style={{ height: 4, background: B.border }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: B.green, transition: "width 0.4s ease", borderRadius: 2 }} />
      </div>

      {/* Step indicator */}
      <div style={{ textAlign: "center", padding: "16px 0 0", color: B.muted, fontSize: 13 }}>
        Step {step} of {totalSteps}
      </div>

      <div style={containerStyle}>

        {/* ===== STEP 1: Welcome ===== */}
        {step === 1 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128170;</div>
            <h1 style={{ ...headingStyle, fontSize: 28, textAlign: "center" }}>Welcome to GymKit!</h1>
            <p style={{ ...subStyle, textAlign: "center", maxWidth: 480, margin: "0 auto 24px" }}>
              We're going to help you get set up in just a few minutes. Here's what we'll do:
            </p>
            <Card style={{ textAlign: "left", maxWidth: 400, margin: "0 auto" }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {["Customize your branding", "Set up your first session", "Add a few clients", "Build your first workout"].map((item, i) => (
                  <li key={i} style={{ padding: "8px 0", color: B.text, fontSize: 15, borderBottom: i < 3 ? `1px solid ${B.border}` : "none" }}>
                    <span style={{ color: B.green, marginRight: 8, fontWeight: 700 }}>{i + 1}.</span>{item}
                  </li>
                ))}
              </ul>
            </Card>
            <p style={{ color: B.muted, fontSize: 13, marginTop: 16 }}>This takes about 3 minutes. You can always change things later.</p>
          </div>
        )}

        {/* ===== STEP 2: Branding ===== */}
        {step === 2 && (
          <Card>
            <h2 style={headingStyle}>Customize Your Branding</h2>
            <p style={subStyle}>Make the platform feel like yours.</p>
            <div style={fieldStyle}>
              <label style={labelStyle}>Logo URL</label>
              <input style={inputStyle} value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://yourgym.com/logo.png" />
              <span style={{ fontSize: 12, color: B.dim }}>Paste a link to your gym's logo image</span>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Primary Brand Color</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: 48, height: 36, border: "none", cursor: "pointer", borderRadius: 4 }} />
                <input style={{ ...inputStyle, width: 140 }} value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Tagline</label>
              <input style={inputStyle} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Train Hard. Stay Humble." />
            </div>
          </Card>
        )}

        {/* ===== STEP 3: First Class ===== */}
        {step === 3 && (
          <Card>
            <h2 style={headingStyle}>Set Up Your First Session</h2>
            <p style={subStyle}>Create a session so your clients can start signing up.</p>
            <div style={fieldStyle}>
              <label style={labelStyle}>Session Name</label>
              <input style={inputStyle} value={className} onChange={e => setClassName(e.target.value)} placeholder="CrossFit WOD" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Day</label>
                <select style={inputStyle} value={classDay} onChange={e => setClassDay(e.target.value)}>
                  {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Time</label>
                <input type="time" style={inputStyle} value={classTime} onChange={e => setClassTime(e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Capacity</label>
                <input type="number" style={inputStyle} value={classCapacity} onChange={e => setClassCapacity(e.target.value)} />
              </div>
            </div>
            <button style={btnText} onClick={() => setStep(4)}>Skip — I'll do this later</button>
          </Card>
        )}

        {/* ===== STEP 4: Add Members ===== */}
        {step === 4 && (
          <Card>
            <h2 style={headingStyle}>Add Your First Clients</h2>
            <p style={subStyle}>Add a few clients to get started. You can import more later.</p>
            {members.map((m, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 8, marginBottom: 8 }}>
                <input style={inputStyle} value={m.name} onChange={e => updateMember(i, "name", e.target.value)} placeholder="Full name" />
                <input style={inputStyle} value={m.email} onChange={e => updateMember(i, "email", e.target.value)} placeholder="Email" />
                <input style={inputStyle} value={m.pin} onChange={e => updateMember(i, "pin", e.target.value)} placeholder="PIN" maxLength={6} />
              </div>
            ))}
            {members.length < 5 && (
              <button style={{ ...btnText, marginTop: 4 }} onClick={addMemberRow}>+ Add another</button>
            )}
            <div style={{ marginTop: 8 }}>
              <button style={btnText} onClick={() => setStep(5)}>Skip — I'll add clients later</button>
            </div>
          </Card>
        )}

        {/* ===== STEP 5: Build First Workout ===== */}
        {step === 5 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#127947;</div>
            <h2 style={{ ...headingStyle, textAlign: "center" }}>Build Your First Workout</h2>
            <p style={{ ...subStyle, textAlign: "center", maxWidth: 460, margin: "0 auto 24px" }}>
              Use the Workout Builder to create your first WOD, strength session, or custom workout. You can do this now or come back to it later.
            </p>
            <button style={btnPrimary} onClick={() => { localStorage.setItem("hf_onboarding_complete", "true"); navigate(`/gym/${localStorage.getItem("hf_gym_id") || "default"}/build`); }}>
              Open Workout Builder
            </button>
            <div style={{ marginTop: 16 }}>
              <button style={btnText} onClick={() => setStep(6)}>Skip — I'll build workouts later</button>
            </div>
          </div>
        )}

        {/* ===== STEP 6: All Set ===== */}
        {step === 6 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>&#127881;</div>
            <h1 style={{ ...headingStyle, fontSize: 28, textAlign: "center", color: B.green }}>You're All Set!</h1>
            <p style={{ ...subStyle, textAlign: "center", maxWidth: 460, margin: "0 auto 32px" }}>
              Your gym is configured and ready to go. Here are some places to start:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 480, margin: "0 auto 32px" }}>
              {[
                { label: "Dashboard", path: "/dashboard", icon: "\u{1F4CA}" },
                { label: "Schedule", path: "/scheduling", icon: "\u{1F4C5}" },
                { label: "Clients", path: "/members", icon: "\u{1F465}" },
              ].map(link => (
                <Card key={link.path} onClick={() => { handleFinish(); navigate(link.path); }} style={{ cursor: "pointer", textAlign: "center", padding: 20 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{link.icon}</div>
                  <div style={{ color: B.text, fontWeight: 600, fontSize: 14 }}>{link.label}</div>
                </Card>
              ))}
            </div>
            <button style={btnPrimary} onClick={handleFinish}>Go to Dashboard</button>
          </div>
        )}

        {/* Navigation */}
        {step !== 6 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
            {step > 1 ? (
              <button style={btnSecondary} onClick={() => setStep(s => s - 1)}>Back</button>
            ) : <div />}
            <button style={btnPrimary} onClick={() => setStep(s => s + 1)}>
              {step === 5 ? "Next" : "Next"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
