import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import Card from "../../components/ui/Card";

const SUPABASE_URL = "https://qzvxnklyeadbroesccxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM";
const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
  "Europe/London", "Europe/Berlin", "Australia/Sydney",
];

const PLANS = [
  { id: "starter", name: "Starter", price: 99, features: ["Up to 50 clients", "1 coach account", "Session scheduling", "Basic attendance tracking", "Email support"] },
  { id: "professional", name: "Professional", price: 199, features: ["Up to 200 clients", "5 coach accounts", "Everything in Starter", "Workout builder", "Client portal", "Billing & invoicing", "Priority support"] },
  { id: "enterprise", name: "Enterprise", price: 399, features: ["Unlimited clients", "Unlimited coaches", "Everything in Professional", "Custom branding", "API access", "Dedicated account manager", "Phone support"] },
];

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function randomChars(n) {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  let r = "";
  for (let i = 0; i < n; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

async function supabaseUpsert(gymId, key, value) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/data_store?on_conflict=gym_id,key`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({ gym_id: gymId, key, value }),
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
}

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

export default function SignUpPage() {
  const B = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [createdGymId, setCreatedGymId] = useState("");

  // Step 1 — Gym Info
  const [gymName, setGymName] = useState("");
  const [gymPhone, setGymPhone] = useState("");
  const [gymEmail, setGymEmail] = useState("");
  const [gymAddress, setGymAddress] = useState("");
  const [gymTimezone, setGymTimezone] = useState("America/New_York");

  // Step 2 — Admin Account
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 3 — Plan
  const [selectedPlan, setSelectedPlan] = useState("professional");

  const canNext = () => {
    if (step === 1) return gymName.trim() && gymEmail.trim();
    if (step === 2) return displayName.trim() && username.trim() && password.length >= 6 && password === confirmPassword;
    if (step === 3) return !!selectedPlan;
    return true;
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      const gymId = slugify(gymName) + "-" + randomChars(4);
      const plan = PLANS.find(p => p.id === selectedPlan);
      const now = new Date().toISOString();

      // Save gym info
      await supabaseUpsert(gymId, "hf_gym_info", {
        gymId, gymName, phone: gymPhone, email: gymEmail, address: gymAddress, timezone: gymTimezone, createdAt: now, status: "trial",
      });

      // Save admin user
      await supabaseUpsert(gymId, "hf_users", [
        { id: "u1", username, password, role: "admin", memberId: null, displayName },
      ]);

      // Save plan
      await supabaseUpsert(gymId, "hf_subscription", {
        planId: plan.id, planName: plan.name, price: plan.price, status: "trialing", trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(), createdAt: now,
      });

      // Update master registry — re-fetch right before writing to avoid clobbering concurrent signups
      let registry = await supabaseGet("__super__", "hf_gyms_registry");
      if (!Array.isArray(registry)) registry = [];
      registry.push({ gymId, gymName, planId: plan.id, planName: plan.name, price: plan.price, adminUsername: username, adminEmail: gymEmail, status: "trial", createdAt: now });
      await supabaseUpsert("__super__", "hf_gyms_registry", registry);

      // Save gym_id locally
      localStorage.setItem("hf_gym_id", gymId);

      // Also seed local hf_users so login works immediately
      localStorage.setItem("hf_users", JSON.stringify([
        { id: "u1", username, password, role: "admin", memberId: null, displayName },
      ]));

      setCreatedGymId(gymId);
      setDone(true);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /* ===================== STYLES ===================== */
  const pageStyle = { minHeight: "100vh", background: B.darker, color: B.text };
  const navStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: `1px solid ${B.border}` };
  const logoStyle = { fontWeight: 800, fontSize: 22, color: B.green };
  const navLink = { color: B.muted, textDecoration: "none", marginLeft: 24, fontSize: 14, cursor: "pointer" };
  const containerStyle = { maxWidth: 720, margin: "0 auto", padding: "40px 24px" };
  const headingStyle = { fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 8, color: B.text };
  const subStyle = { textAlign: "center", color: B.muted, marginBottom: 32, fontSize: 15 };
  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${B.border}`, background: B.dark, color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontWeight: 600, fontSize: 13, color: B.muted, marginBottom: 6 };
  const fieldStyle = { marginBottom: 16 };
  const btnPrimary = { padding: "12px 32px", borderRadius: 8, background: B.green, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" };
  const btnSecondary = { padding: "12px 32px", borderRadius: 8, background: "transparent", color: B.muted, fontWeight: 600, fontSize: 15, border: `1px solid ${B.border}`, cursor: "pointer" };
  const progressBar = { display: "flex", gap: 8, justifyContent: "center", marginBottom: 32 };

  /* ===================== SUCCESS SCREEN ===================== */
  if (done) {
    return (
      <div style={pageStyle}>
        <nav style={navStyle}>
          <span style={logoStyle}>GymKit</span>
        </nav>
        <div style={{ ...containerStyle, textAlign: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>&#10003;</div>
          <h1 style={{ ...headingStyle, fontSize: 32, color: B.green }}>Your Gym is Ready!</h1>
          <p style={{ color: B.muted, fontSize: 16, marginBottom: 8 }}>
            Gym ID: <span style={{ color: B.text, fontFamily: "monospace" }}>{createdGymId}</span>
          </p>
          <p style={{ color: B.muted, fontSize: 15, marginBottom: 32 }}>
            Your 14-day free trial has started. Log in to begin setting up your gym.
          </p>
          <button style={btnPrimary} onClick={() => navigate("/login")}>Go to Login</button>
        </div>
      </div>
    );
  }

  /* ===================== RENDER ===================== */
  return (
    <div style={pageStyle}>
      {/* Nav */}
      <nav style={navStyle}>
        <span style={logoStyle}>GymKit</span>
        <div>
          <span style={navLink} onClick={() => navigate("/")}>Home</span>
          <span style={navLink} onClick={() => navigate("/login")}>Login</span>
        </div>
      </nav>

      <div style={containerStyle}>
        <h1 style={headingStyle}>Start Your 14-Day Free Trial</h1>
        <p style={subStyle}>No credit card required. Cancel anytime.</p>

        {/* Progress bar */}
        <div style={progressBar}>
          {[1, 2, 3, 4].map(s => (
            <div key={s} style={{ width: 64, height: 6, borderRadius: 3, background: s <= step ? B.green : B.border, transition: "background 0.3s" }} />
          ))}
        </div>

        {/* Step labels */}
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 32, fontSize: 13, color: B.muted }}>
          {["Gym Info", "Admin", "Plan", "Confirm"].map((label, i) => (
            <span key={i} style={{ color: i + 1 === step ? B.green : B.muted, fontWeight: i + 1 === step ? 700 : 400 }}>{label}</span>
          ))}
        </div>

        {/* ===== STEP 1: Gym Info ===== */}
        {step === 1 && (
          <Card>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: B.text }}>Gym Information</h2>
            <div style={fieldStyle}>
              <label style={labelStyle}>Gym Name *</label>
              <input style={inputStyle} value={gymName} onChange={e => setGymName(e.target.value)} placeholder="CrossFit Alpha" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={gymPhone} onChange={e => setGymPhone(e.target.value)} placeholder="(555) 123-4567" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Email *</label>
                <input style={inputStyle} type="email" value={gymEmail} onChange={e => setGymEmail(e.target.value)} placeholder="owner@gym.com" />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Address</label>
              <input style={inputStyle} value={gymAddress} onChange={e => setGymAddress(e.target.value)} placeholder="123 Main St, City, State" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Timezone</label>
              <select style={inputStyle} value={gymTimezone} onChange={e => setGymTimezone(e.target.value)}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </Card>
        )}

        {/* ===== STEP 2: Admin Account ===== */}
        {step === 2 && (
          <Card>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: B.text }}>Create Admin Account</h2>
            <div style={fieldStyle}>
              <label style={labelStyle}>Display Name *</label>
              <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="John Smith" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Username *</label>
              <input style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} placeholder="johnsmith" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Password * (min 6 chars)</label>
                <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="********" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Confirm Password *</label>
                <input style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="********" />
              </div>
            </div>
            {password && confirmPassword && password !== confirmPassword && (
              <p style={{ color: B.red, fontSize: 13, marginTop: -8 }}>Passwords do not match</p>
            )}
          </Card>
        )}

        {/* ===== STEP 3: Plan Selection ===== */}
        {step === 3 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {PLANS.map(plan => {
                const selected = selectedPlan === plan.id;
                return (
                  <Card key={plan.id} onClick={() => setSelectedPlan(plan.id)} style={{
                    cursor: "pointer", border: selected ? `2px solid ${B.green}` : `1px solid ${B.border}`,
                    transform: selected ? "scale(1.02)" : "none", transition: "all 0.2s", position: "relative",
                  }}>
                    {plan.id === "professional" && (
                      <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: B.green, color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 12px", borderRadius: 10 }}>
                        MOST POPULAR
                      </div>
                    )}
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: B.text, marginBottom: 4 }}>{plan.name}</h3>
                    <div style={{ fontSize: 32, fontWeight: 800, color: B.green, marginBottom: 4 }}>${plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: B.muted }}>/mo</span></div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
                      {plan.features.map((f, i) => (
                        <li key={i} style={{ fontSize: 13, color: B.muted, padding: "3px 0" }}>&#10003; {f}</li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
            <p style={{ textAlign: "center", color: B.muted, fontSize: 13, marginTop: 16, fontStyle: "italic" }}>
              14-day free trial on all plans — no charge today
            </p>
          </>
        )}

        {/* ===== STEP 4: Confirmation ===== */}
        {step === 4 && (
          <Card>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: B.text }}>Confirm Your Details</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <h4 style={{ color: B.green, fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Gym Info</h4>
                <p style={{ color: B.text, fontSize: 15, margin: "4px 0" }}><strong>{gymName}</strong></p>
                <p style={{ color: B.muted, fontSize: 13, margin: "2px 0" }}>{gymEmail}</p>
                {gymPhone && <p style={{ color: B.muted, fontSize: 13, margin: "2px 0" }}>{gymPhone}</p>}
                {gymAddress && <p style={{ color: B.muted, fontSize: 13, margin: "2px 0" }}>{gymAddress}</p>}
                <p style={{ color: B.muted, fontSize: 13, margin: "2px 0" }}>{gymTimezone.replace(/_/g, " ")}</p>
              </div>
              <div>
                <h4 style={{ color: B.green, fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Admin Account</h4>
                <p style={{ color: B.text, fontSize: 15, margin: "4px 0" }}><strong>{displayName}</strong></p>
                <p style={{ color: B.muted, fontSize: 13, margin: "2px 0" }}>@{username}</p>
              </div>
            </div>
            <div style={{ marginTop: 20, padding: "16px", background: B.dark, borderRadius: 8, border: `1px solid ${B.border}` }}>
              <h4 style={{ color: B.green, fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Selected Plan</h4>
              {(() => { const p = PLANS.find(x => x.id === selectedPlan); return p ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: B.text, fontSize: 16, fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: B.green, fontSize: 20, fontWeight: 700 }}>${p.price}/mo</span>
                </div>
              ) : null; })()}
              <p style={{ color: B.muted, fontSize: 13, marginTop: 8 }}>14-day free trial — you won't be charged today</p>
            </div>
            {error && <p style={{ color: B.red, fontSize: 14, marginTop: 12 }}>{error}</p>}
          </Card>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          {step > 1 ? (
            <button style={btnSecondary} onClick={() => setStep(s => s - 1)}>Back</button>
          ) : <div />}

          {step < 4 ? (
            <button style={{ ...btnPrimary, opacity: canNext() ? 1 : 0.5 }} disabled={!canNext()} onClick={() => setStep(s => s + 1)}>
              Next
            </button>
          ) : (
            <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSubmit}>
              {saving ? "Creating..." : "Create My Gym"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
