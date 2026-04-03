import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to GymKit!",
    description: "Let's take a quick tour of your new gym management platform. We'll show you the key areas so you can hit the ground running.",
    position: "center",
  },
  {
    id: "sidebar",
    title: "Sidebar Navigation",
    description: "Use the sidebar to navigate between sections. You can collapse groups to keep things tidy, and the sidebar collapses on mobile.",
    position: "right",
    pointAt: { top: "50%", left: 0 },
  },
  {
    id: "build",
    title: "Build Workouts",
    description: "Create workout templates with exercises, sets, and reps. Use sections and slots to organize complex training sessions.",
    position: "right",
    pointAt: { top: 180, left: 0 },
  },
  {
    id: "clients",
    title: "Client Management",
    description: "Add and manage your gym clients here. Track their progress, assign workouts, and manage their membership status.",
    position: "right",
    pointAt: { top: 300, left: 0 },
  },
  {
    id: "schedule",
    title: "Schedule Sessions",
    description: "Set up your weekly session schedule. Clients can book into sessions and you can manage capacity and waitlists.",
    position: "right",
    pointAt: { top: 380, left: 0 },
  },
  {
    id: "billing",
    title: "Billing",
    description: "Manage membership plans, process payments, and track revenue. Integrates with Stripe for seamless billing.",
    position: "right",
    pointAt: { top: 460, left: 0 },
  },
  {
    id: "session-view",
    title: "Session View",
    description: "See all clients' individualized workouts during a live session. Coach from a single screen with real-time tracking.",
    position: "right",
    pointAt: { top: 220, left: 0 },
  },
  {
    id: "community",
    title: "Community",
    description: "Build engagement with a social feed, challenges, courses, and events. Keep your members connected and motivated.",
    position: "right",
    pointAt: { top: 140, left: 0 },
  },
  {
    id: "settings",
    title: "Settings",
    description: "Customize your branding, configure integrations, manage user roles, and set up automations.",
    position: "right",
    pointAt: { top: 540, left: 0 },
  },
  {
    id: "ready",
    title: "You're Ready!",
    description: "That's the tour! Start by adding your first client or building a workout template. You can restart this tour anytime from Settings.",
    position: "center",
    actions: true,
  },
];

export default function OnboardingTour({ onComplete }) {
  const B = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const current = STEPS[step];

  useEffect(() => {
    // Fade in on mount
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }, [step]);

  const handlePrev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  const handleSkip = useCallback(() => {
    localStorage.setItem("hf_tour_completed", "true");
    onComplete();
  }, [onComplete]);

  const handleFinish = useCallback(() => {
    localStorage.setItem("hf_tour_completed", "true");
    onComplete();
  }, [onComplete]);

  const handleAction = useCallback((path) => {
    localStorage.setItem("hf_tour_completed", "true");
    const gymId = localStorage.getItem("hf_gym_id") || "default";
    navigate(`/gym/${gymId}/${path}`);
    onComplete();
  }, [navigate, onComplete]);

  const isCenter = current.position === "center";

  // Tooltip position for non-center steps
  const getTooltipStyle = () => {
    if (isCenter) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: 480,
        width: "90%",
      };
    }
    const pt = current.pointAt || { top: "50%", left: 0 };
    return {
      position: "fixed",
      top: typeof pt.top === "number" ? pt.top : pt.top,
      left: 280,
      maxWidth: 380,
      width: "90%",
    };
  };

  // Spotlight cutout for non-center steps
  const getSpotlightStyle = () => {
    if (isCenter) return null;
    const pt = current.pointAt || { top: "50%", left: 0 };
    const top = typeof pt.top === "number" ? pt.top : 200;
    return {
      position: "fixed",
      top: top - 20,
      left: 0,
      width: 260,
      height: 50,
      borderRadius: 8,
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
      zIndex: 10001,
      pointerEvents: "none",
    };
  };

  const spotlightStyle = getSpotlightStyle();

  const btnBase = {
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.15s",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Backdrop */}
      {isCenter && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000 }} />
      )}
      {!isCenter && spotlightStyle && (
        <div style={spotlightStyle} />
      )}
      {!isCenter && !spotlightStyle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 10000 }} />
      )}

      {/* Tooltip Card */}
      <div
        style={{
          ...getTooltipStyle(),
          background: B.card,
          border: `1px solid ${B.border}`,
          borderRadius: 16,
          padding: 28,
          zIndex: 10002,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Step badge */}
        {!isCenter && (
          <div style={{ fontSize: 11, fontWeight: 700, color: B.green, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Step {step + 1} of {STEPS.length}
          </div>
        )}

        <h2 style={{ fontSize: 20, fontWeight: 700, color: B.text, margin: "0 0 10px" }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: B.muted, margin: "0 0 24px" }}>
          {current.description}
        </p>

        {/* Action buttons for final step */}
        {current.actions && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              onClick={() => handleAction("members")}
              style={{ ...btnBase, background: B.green, color: "#fff", flex: 1 }}
            >
              Add Client
            </button>
            <button
              onClick={() => handleAction("build")}
              style={{ ...btnBase, background: B.blue || "#063461", color: "#fff", flex: 1 }}
            >
              Build Workout
            </button>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={handleSkip}
            style={{ ...btnBase, background: "transparent", color: B.muted, padding: "8px 4px" }}
          >
            {step === STEPS.length - 1 ? "Close" : "Skip Tour"}
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button
                onClick={handlePrev}
                style={{ ...btnBase, background: B.border, color: B.text }}
              >
                Previous
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button
                onClick={handleNext}
                style={{ ...btnBase, background: B.green, color: "#fff" }}
              >
                Next
              </button>
            )}
            {step === STEPS.length - 1 && (
              <button
                onClick={handleFinish}
                style={{ ...btnBase, background: B.green, color: "#fff" }}
              >
                Finish Tour
              </button>
            )}
          </div>
        </div>

        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 18 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                borderRadius: 4,
                background: i === step ? B.green : B.border,
                transition: "all 0.2s",
                cursor: "pointer",
              }}
              onClick={() => setStep(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
