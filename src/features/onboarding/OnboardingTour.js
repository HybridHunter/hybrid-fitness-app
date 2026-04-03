import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

const STEPS = [
  { icon: "\uD83D\uDC4B", title: "Welcome to GymKit!", desc: "Let's take a quick tour of your new gym management platform. It'll only take a minute." },
  { icon: "\uD83D\uDD28", title: "Build Workouts", desc: "Create workout templates with exercises, sets, reps, and coaching cues. Organize into sections like Strength, Accessories, and Conditioning." },
  { icon: "\uD83D\uDC65", title: "Manage Clients", desc: "Add your gym clients, track their progress, run movement assessments, and manage memberships." },
  { icon: "\uD83D\uDCC5", title: "Schedule Sessions", desc: "Set up your weekly session schedule with capacity limits. Clients can book in, and you manage waitlists." },
  { icon: "\uD83D\uDCB3", title: "Billing & Payments", desc: "Create membership plans, process payments (card, ACH, cash, check), and track revenue." },
  { icon: "\uD83D\uDCFA", title: "Session View", desc: "During a live session, see all clients' individualized workouts on one screen. Adjust progressions in real-time." },
  { icon: "\uD83D\uDCF1", title: "Station Mode", desc: "Set up iPad stations for each client. Their personalized workout displays automatically with video demos." },
  { icon: "\uD83D\uDC65", title: "Community", desc: "Build engagement with a social feed, challenges, courses, events, and resources. Like Skool, built into your gym." },
  { icon: "\u2699\uFE0F", title: "Settings & Branding", desc: "Customize your logo, colors, integrations (Stripe, Zapier, GoHighLevel), automations, and more." },
  { icon: "\uD83C\uDFC6", title: "You're Ready!", desc: "Start by adding your first client or building a workout. You can restart this tour anytime from Settings.", actions: true },
];

export default function OnboardingTour({ onComplete }) {
  const B = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  const finish = useCallback(() => {
    localStorage.setItem("hf_tour_completed", "true");
    onComplete();
  }, [onComplete]);

  const goTo = useCallback((path) => {
    localStorage.setItem("hf_tour_completed", "true");
    const gymId = localStorage.getItem("hf_gym_id") || "default";
    navigate(`/gym/${gymId}/${path}`);
    onComplete();
  }, [navigate, onComplete]);

  const btn = (bg, color, extra = {}) => ({
    padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14,
    fontWeight: 700, cursor: "pointer", transition: "all 0.15s", ...extra,
    background: bg, color,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div style={{
        background: B.card, borderRadius: 20, padding: "36px 32px 28px", maxWidth: 440, width: "90%",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)", border: `1px solid ${B.border}`,
        animation: "tourFadeIn 0.3s ease",
      }}>
        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: "0 auto",
            background: B.accent + "15", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36,
          }}>
            {current.icon}
          </div>
        </div>

        {/* Content */}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: B.text, margin: "0 0 10px", textAlign: "center" }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: B.muted, margin: "0 0 24px", textAlign: "center" }}>
          {current.desc}
        </p>

        {/* Action buttons on last step */}
        {current.actions && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button onClick={() => goTo("members")} style={btn(B.accent, "#fff", { flex: 1 })}>
              {"\uD83D\uDC65"} Add Client
            </button>
            <button onClick={() => goTo("build")} style={btn(B.blue || "#063461", "#fff", { flex: 1 })}>
              {"\uD83D\uDD28"} Build Workout
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4, cursor: "pointer",
              background: i === step ? B.accent : B.border, transition: "all 0.25s",
            }} />
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={finish} style={btn("transparent", B.muted, { padding: "8px 4px", fontSize: 13 })}>
            {step === STEPS.length - 1 ? "Close" : "Skip Tour"}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={btn(B.border, B.text)}>Back</button>
            )}
            {step < STEPS.length - 1 && (
              <button onClick={() => setStep(s => s + 1)} style={btn(B.accent, "#fff")}>Next</button>
            )}
            {step === STEPS.length - 1 && !current.actions && (
              <button onClick={finish} style={btn(B.accent, "#fff")}>Finish</button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tourFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
