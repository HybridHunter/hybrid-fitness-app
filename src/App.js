import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation, useParams } from "react-router-dom";
import { ThemeCtx, DARK, LIGHT } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GymProvider } from "./features/onboarding/GymContext";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { EX } from "./data/exercises";
import Shell from "./components/layout/Shell";
import LoginPage from "./features/auth/LoginPage";
import ClientPortal from "./features/client-portal/ClientPortal";
import StationDisplay from "./features/station/StationDisplay";

// SaaS pages (no auth required)
import LandingPage from "./features/landing/LandingPage";
import SignUpPage from "./features/onboarding/SignUpPage";
import TermsPage from "./features/legal/TermsPage";
import PrivacyPage from "./features/legal/PrivacyPage";

// Feature views
import BuildView from "./features/workout-builder/BuildView";
import WorkoutsView from "./features/workout-builder/WorkoutsView";
import ProgramsView from "./features/workout-builder/ProgramsView";
import LibraryView from "./features/library/LibraryView";

import CoachingDashboard from "./features/dashboard/CoachingDashboard";
import BusinessDashboard from "./features/dashboard/BusinessDashboard";
import MembersView from "./features/members/MembersView";
import MemberProfile from "./features/members/MemberProfile";
import AssessmentView from "./features/assessment/AssessmentView";
import MatrixView from "./features/movement-matrix/MatrixView";
import CommandView from "./features/coach-command/CommandView";
import ScheduleView from "./features/scheduling/ScheduleView";
import CheckInView from "./features/attendance/CheckInView";
import BillingView from "./features/billing/BillingView";
import AnalyticsView from "./features/analytics/AnalyticsView";
import GamificationView from "./features/gamification/GamificationView";
import ContentLibraryView from "./features/content/ContentLibraryView";
import ShopView from "./features/shop/ShopView";
import MessagingView from "./features/messaging/MessagingView";
import CommunityFeed from "./features/community/CommunityFeed";
import ClassroomView from "./features/classroom/ClassroomView";
import EventsView from "./features/events/EventsView";
import ResourcesView from "./features/resources/ResourcesView";
import WaiverView from "./features/waivers/WaiverView";
import SettingsView from "./features/settings/SettingsView";
import AutomationsView from "./features/settings/AutomationsView";
import IntegrationsView from "./features/settings/IntegrationsView";
import StationSetup from "./features/station/StationSetup";
import RemoteWorkoutsView from "./features/workout-builder/RemoteWorkoutsView";
import OnboardingWizard from "./features/onboarding/OnboardingWizard";
import DataMigrationView from "./features/settings/DataMigrationView";
import SuperAdminPanel from "./features/super-admin/SuperAdminPanel";
import FeedbackForm from "./features/settings/FeedbackForm";
import HelpCenter from "./features/help/HelpCenter";
import { FloatingHelpButton } from "./features/help/HelpCenter";
import OnboardingTour from "./features/onboarding/OnboardingTour";

// Public routes that don't need auth
const PUBLIC_PATHS = ["/landing", "/register", "/terms", "/privacy"];

/* ===================== GYM ROUTES ===================== */
function GymRoutes() {
  const { gymId } = useParams();
  const { currentUser } = useAuth();
  const [theme, setTheme] = useLocalStorage("hf_theme", "dark");
  const [exercises, setExercises] = useLocalStorage("hf_ex", [...EX]);
  const [workouts, setWorkouts] = useLocalStorage("hf_w", []);
  const [programs, setPrograms] = useLocalStorage("hf_p", []);
  const [loadedWorkout, setLoadedWorkout] = useState(null);
  const [showTour, setShowTour] = useState(() => {
    const completed = localStorage.getItem("hf_tour_completed");
    return !completed;
  });
  const navigate = useNavigate();
  const B = theme === "dark" ? DARK : LIGHT;

  // Sync gymId from URL to localStorage
  useEffect(() => {
    if (gymId) {
      localStorage.setItem("hf_gym_id", gymId);
    }
  }, [gymId]);

  const handleLoadWorkout = (w) => {
    setLoadedWorkout(w);
    navigate(`/gym/${gymId}/build`);
  };

  const isImpersonating = localStorage.getItem("hf_impersonating") === "true";
  const stopImpersonating = () => {
    const backupGym = localStorage.getItem("hf_gym_id_backup");
    const backupSession = localStorage.getItem("hf_session_backup");
    if (backupGym) localStorage.setItem("hf_gym_id", backupGym);
    if (backupSession) localStorage.setItem("hf_session", backupSession);
    localStorage.removeItem("hf_gym_id_backup");
    localStorage.removeItem("hf_session_backup");
    localStorage.removeItem("hf_impersonating");
    Object.keys(localStorage).filter(k => k.startsWith("hf_") && !["hf_theme","hf_session","hf_users","hf_gym_id","hf_onboarding_complete"].includes(k)).forEach(k => localStorage.removeItem(k));
    window.location.href = "/super-admin";
  };

  const ImpersonateBanner = () => isImpersonating ? (
    <div style={{ background: "#ef4444", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 13, fontWeight: 600, zIndex: 10000 }}>
      <span>You are impersonating as {currentUser.role} in {gymId}</span>
      <button onClick={stopImpersonating} style={{ background: "#fff", color: "#ef4444", border: "none", borderRadius: 6, padding: "4px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        Stop Impersonating
      </button>
    </div>
  ) : null;

  // Not logged in — redirect to login
  if (!currentUser) {
    return <LoginPage />;
  }

  // Client role — mobile-first client portal
  if (currentUser.role === "client") {
    return (
      <ThemeCtx.Provider value={B}>
        <ImpersonateBanner />
        <ClientPortal />
      </ThemeCtx.Provider>
    );
  }

  // Staff (admin / coach) — full app
  return (
    <ThemeCtx.Provider value={B}>
      <ImpersonateBanner />
      <Shell theme={theme} onToggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")}>
        <Routes>
          <Route path="/" element={currentUser.role === "admin" ? <BusinessDashboard /> : <CoachingDashboard />} />
          <Route path="coaching" element={<CoachingDashboard />} />
          <Route path="business" element={<BusinessDashboard />} />
          <Route path="build" element={
            <BuildView
              exercises={exercises} setExercises={setExercises}
              workouts={workouts} setWorkouts={setWorkouts}
              loadedWorkout={loadedWorkout}
              onSaved={() => setLoadedWorkout(null)}
            />
          } />
          <Route path="workouts" element={
            <WorkoutsView workouts={workouts} setWorkouts={setWorkouts} exercises={exercises} onLoad={handleLoadWorkout} />
          } />
          <Route path="programs" element={
            <ProgramsView programs={programs} setPrograms={setPrograms} workouts={workouts} />
          } />
          <Route path="library" element={<LibraryView exercises={exercises} setExercises={setExercises} />} />
          <Route path="matrix" element={<MatrixView />} />
          <Route path="members" element={<MembersView />} />
          <Route path="members/:id" element={<MemberProfile />} />
          <Route path="assessments" element={<AssessmentView />} />
          <Route path="command" element={<CommandView />} />
          <Route path="stations" element={<StationSetup />} />
          <Route path="remote-workouts" element={<RemoteWorkoutsView />} />
          <Route path="schedule" element={<ScheduleView />} />
          <Route path="checkin" element={<CheckInView />} />
          <Route path="billing" element={<BillingView />} />
          <Route path="analytics" element={<AnalyticsView />} />
          <Route path="gamification" element={<GamificationView />} />
          <Route path="content" element={<ContentLibraryView />} />
          <Route path="shop" element={<ShopView />} />
          <Route path="messages" element={<MessagingView />} />
          <Route path="community" element={<CommunityFeed />} />
          <Route path="classroom" element={<ClassroomView />} />
          <Route path="events" element={<EventsView />} />
          <Route path="resources" element={<ResourcesView />} />
          <Route path="waivers" element={<WaiverView />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="automations" element={<AutomationsView />} />
          <Route path="integrations" element={<IntegrationsView />} />
          <Route path="migration" element={<DataMigrationView />} />
          <Route path="onboarding" element={<OnboardingWizard />} />
          <Route path="feedback" element={<FeedbackForm />} />
          <Route path="help" element={<HelpCenter />} />
        </Routes>
      </Shell>
      <FloatingHelpButton />
      {showTour && currentUser.role === "admin" && (
        <OnboardingTour onComplete={() => setShowTour(false)} />
      )}
    </ThemeCtx.Provider>
  );
}

/* ===================== AUTH GATE ===================== */
function AuthGate() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Public pages — no auth required
  if (PUBLIC_PATHS.some(p => location.pathname.startsWith(p))) {
    return (
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/register" element={<SignUpPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Routes>
    );
  }

  // Station display — no auth, dedicated tablet URL
  if (location.pathname.startsWith("/station/")) {
    return (
      <Routes>
        <Route path="/station/:stationId" element={<StationDisplay />} />
      </Routes>
    );
  }

  // Super admin — stays at root level
  if (location.pathname === "/super-admin") {
    if (!currentUser) return <LoginPage />;
    return (
      <Routes>
        <Route path="/super-admin" element={<ThemeCtx.Provider value={LIGHT}><SuperAdminPanel /></ThemeCtx.Provider>} />
      </Routes>
    );
  }

  // Not logged in — show landing page at root, login page at /login
  if (!currentUser) {
    if (location.pathname === "/login") return <LoginPage />;
    // If trying to access /gym/... without auth, show login
    if (location.pathname.startsWith("/gym/")) return <LoginPage />;
    return <LandingPage />;
  }

  // Logged in at root — redirect to gym-scoped URL
  if (location.pathname === "/" || location.pathname === "") {
    const gymId = localStorage.getItem("hf_gym_id") || "default";
    navigate(`/gym/${gymId}/`, { replace: true });
    return null;
  }

  // All gym routes
  return (
    <Routes>
      <Route path="/gym/:gymId/*" element={<GymRoutes />} />
      {/* Catch-all: redirect old root-level paths to gym-scoped paths */}
      <Route path="*" element={<LegacyRedirect />} />
    </Routes>
  );
}

/* Redirect old root-level paths like /build, /members to /gym/:gymId/build etc. */
function LegacyRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const gymId = localStorage.getItem("hf_gym_id") || "default";
    const path = location.pathname.replace(/^\//, "");
    navigate(`/gym/${gymId}/${path}${location.search}${location.hash}`, { replace: true });
  }, [location, navigate]);

  return null;
}

export default function App() {
  return (
    <GymProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </GymProvider>
  );
}
