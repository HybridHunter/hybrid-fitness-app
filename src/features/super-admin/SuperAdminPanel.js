import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";
import { EX } from "../../data/exercises";
import { useIsMobile } from "../../hooks/useIsMobile";

const SUPABASE_URL = "https://qzvxnklyeadbroesccxt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM";
const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };

const SUPER_ADMINS = ["superadmin", "hunter", "admin", "Hunter@HybridFitnessGym.com", "hunter@hybridfitnessgym.com"];
const PLAN_PRICES = { starter: 99, professional: 199, enterprise: 399, custom: 0 };

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Detroit",
  "America/Indiana/Indianapolis", "America/Boise",
];

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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/data_store?on_conflict=gym_id,key`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({ gym_id: gymId, key, value }),
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
}

async function supabaseDelete(gymId, key) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/data_store?gym_id=eq.${encodeURIComponent(gymId)}&key=eq.${encodeURIComponent(key)}`,
    { method: "DELETE", headers: HEADERS }
  );
  if (!res.ok) throw new Error(`Supabase delete error: ${res.status}`);
}

async function supabaseDeleteAllForGym(gymId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/data_store?gym_id=eq.${encodeURIComponent(gymId)}`,
    { method: "DELETE", headers: HEADERS }
  );
  if (!res.ok) throw new Error(`Supabase delete error: ${res.status}`);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function randomChars(n) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let r = "";
  for (let i = 0; i < n; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

export default function SuperAdminPanel() {
  const B = useTheme(); // Gets LIGHT theme from parent ThemeCtx.Provider
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [registry, setRegistry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGym, setExpandedGym] = useState(null);
  const [gymDetails, setGymDetails] = useState({});
  const [actionMsg, setActionMsg] = useState("");
  const [actionLog, setActionLog] = useState([]);

  // Create Location modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(null);
  const [createForm, setCreateForm] = useState({
    gymName: "", phone: "", email: "", street: "", city: "", state: "", zip: "",
    timezone: "America/New_York", website: "",
    adminDisplayName: "", adminUsername: "", adminPassword: "", adminEmail: "",
    plan: "professional", trial: false,
    loadDemo: false, loadExercises: false, loadProgression: false,
  });

  // Edit modal
  const [editGym, setEditGym] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteData, setDeleteData] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Feedback
  const [feedback, setFeedback] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const isSuperAdmin = currentUser && (currentUser.isSuperAdmin || SUPER_ADMINS.includes(currentUser.username?.toLowerCase()));

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadRegistry();
  }, [isSuperAdmin]);

  const fetchRegistry = async () => {
    const data = await supabaseGet("__super__", "hf_gyms_registry");
    return Array.isArray(data) ? data : [];
  };

  const loadRegistry = async () => {
    setLoading(true);
    setRegistry(await fetchRegistry());
    setLoading(false);
  };

  const loadGymDetails = async (gymId) => {
    if (gymDetails[gymId]) return gymDetails[gymId];
    const [info, sub, members] = await Promise.all([
      supabaseGet(gymId, "hf_gym_info"),
      supabaseGet(gymId, "hf_subscription"),
      supabaseGet(gymId, "hf_members"),
    ]);
    const details = { info, sub, members: Array.isArray(members) ? members : [] };
    setGymDetails(prev => ({ ...prev, [gymId]: details }));
    return details;
  };

  const loadFeedback = async () => {
    setFeedbackLoading(true);
    const data = await supabaseGet("__super__", "hf_feedback");
    setFeedback(Array.isArray(data) ? data : []);
    setFeedbackLoading(false);
  };

  const updateFeedbackStatus = async (fbId, newStatus) => {
    const updated = feedback.map(f => f.id === fbId ? { ...f, status: newStatus } : f);
    setFeedback(updated);
    await supabaseUpsert("__super__", "hf_feedback", updated);
  };

  const handleExpand = (gymId) => {
    if (expandedGym === gymId) { setExpandedGym(null); return; }
    setExpandedGym(gymId);
    loadGymDetails(gymId);
  };

  const [impersonateTarget, setImpersonateTarget] = useState(null);

  const handleImpersonate = async (gym, role, userOverride) => {
    const actualRole = role || "admin";
    // Pre-fetch members for this gym BEFORE touching any session state
    const memberData = await supabaseGet(gym.gymId, "hf_members");
    const gymMembers = Array.isArray(memberData) ? memberData : [];

    // Impersonating as a client requires a member to impersonate
    if (actualRole === "client" && !userOverride?.memberId && gymMembers.length === 0) {
      flash(`${gym.gymName} has no members yet — cannot impersonate as a client.`);
      return;
    }

    localStorage.setItem("hf_gym_id_backup", localStorage.getItem("hf_gym_id") || "");
    localStorage.setItem("hf_session_backup", localStorage.getItem("hf_session") || "");
    localStorage.setItem("hf_gym_id", gym.gymId);
    localStorage.setItem("hf_impersonating", "true");

    // Clear cached data so it loads fresh for this gym
    Object.keys(localStorage).filter(k => k.startsWith("hf_") && !["hf_theme","hf_session","hf_users","hf_gym_id","hf_onboarding_complete","hf_gym_id_backup","hf_session_backup","hf_impersonating"].includes(k)).forEach(k => localStorage.removeItem(k));

    const realName = currentUser?.displayName || currentUser?.username || "Super Admin";
    const sessionUser = userOverride || {
      id: "impersonate_" + Date.now(),
      username: currentUser?.email || currentUser?.username || "superadmin",
      email: currentUser?.email || "",
      role: actualRole,
      displayName: realName,
      gymId: gym.gymId,
      isSuperAdmin: true,
    };

    // Cache members data for this gym so client portal loads instantly
    if (gymMembers.length > 0) {
      localStorage.setItem("hf_members", JSON.stringify(gymMembers));
    }

    // If impersonating as client, need a memberId
    if (actualRole === "client" && !sessionUser.memberId) {
      if (gymMembers.length > 0) {
        sessionUser.memberId = gymMembers[0].id;
        sessionUser.displayName = gymMembers[0].firstName + " " + gymMembers[0].lastName + " (impersonating)";
      }
    }

    localStorage.setItem("hf_session", JSON.stringify(sessionUser));
    addAction(`Impersonated ${gym.gymName} as ${actualRole}`);
    window.location.href = `/gym/${gym.gymId}/`;
  };

  const handleStopImpersonating = () => {
    const backupGym = localStorage.getItem("hf_gym_id_backup");
    const backupSession = localStorage.getItem("hf_session_backup");
    if (backupGym) localStorage.setItem("hf_gym_id", backupGym);
    if (backupSession) localStorage.setItem("hf_session", backupSession);
    localStorage.removeItem("hf_gym_id_backup");
    localStorage.removeItem("hf_session_backup");
    localStorage.removeItem("hf_impersonating");
    window.location.href = "/super-admin";
  };

  const addAction = useCallback((text) => {
    setActionLog(prev => [{ text, time: new Date().toISOString() }, ...prev].slice(0, 20));
  }, []);

  const flash = useCallback((msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 4000);
  }, []);

  /* ================= CREATE LOCATION ================= */
  const updateCreateForm = (field, value) => setCreateForm(prev => ({ ...prev, [field]: value }));

  const resetCreateForm = () => {
    setCreateForm({
      gymName: "", phone: "", email: "", street: "", city: "", state: "", zip: "",
      timezone: "America/New_York", website: "",
      adminDisplayName: "", adminUsername: "", adminPassword: "", adminEmail: "",
      plan: "professional", trial: false,
      loadDemo: false, loadExercises: false, loadProgression: false,
    });
    setCreateSuccess(null);
  };

  const handleCreateLocation = async () => {
    const f = createForm;
    if (!f.gymName.trim() || !f.adminUsername.trim() || !f.adminPassword.trim() || !f.adminDisplayName.trim()) {
      flash("Please fill in all required fields (gym name, admin display name, username, password).");
      return;
    }
    setCreating(true);
    try {
      const gymId = slugify(f.gymName) + "-" + randomChars(4);
      const now = new Date().toISOString();
      const price = f.plan === "custom" ? (parseFloat(f.customPlanPrice) || 0) : (PLAN_PRICES[f.plan] || 199);
      const planName = f.plan === "custom" ? (f.customPlanName || "Custom") : (f.plan.charAt(0).toUpperCase() + f.plan.slice(1));
      const status = f.trial ? "trial" : "active";

      // Gym info
      await supabaseUpsert(gymId, "hf_gym_info", {
        gymId, gymName: f.gymName, phone: f.phone, email: f.email,
        address: { street: f.street, city: f.city, state: f.state, zip: f.zip },
        timezone: f.timezone, website: f.website,
        createdAt: now, status,
      });

      // Admin user
      await supabaseUpsert(gymId, "hf_users", [{
        id: "u1", username: f.adminUsername, password: f.adminPassword,
        role: "admin", memberId: null, displayName: f.adminDisplayName,
        email: f.adminEmail,
      }]);

      // Subscription
      const subData = { planId: f.plan, planName, price, status, createdAt: now };
      if (f.trial) subData.trialEndsAt = new Date(Date.now() + 14 * 86400000).toISOString();
      await supabaseUpsert(gymId, "hf_subscription", subData);

      // Setup: load demo data
      if (f.loadDemo) {
        const uid = () => crypto.randomUUID();
        const demoMembers = [
          {id:uid(),firstName:"Sarah",lastName:"Johnson",email:"sarah@example.com",phone:"555-0101",pin:"1234",membershipPlanId:"plan_unlimited",membershipStatus:"active",photo:"",familyGroupId:null,startDate:"2025-09-15",notes:"Demo client",tags:["morning"],address:{street:"",city:"",state:"",zip:"",country:"US"},movementScores:{Squat:2,Hinge:1,Lunge:0,Push:1,Pull:2,Core:1,Carry:2},gamification:{level:12,xp:2400,totalWorkouts:87,totalWeightLifted:42350,badges:["First Workout","10 Workouts","50 Workouts"],currentStreak:5,longestStreak:14},rank:{current:"Silver",promotionDate:null},inbody:{lastScan:null,history:[]},createdAt:now,_demo:true},
          {id:uid(),firstName:"Mike",lastName:"Chen",email:"mike@example.com",phone:"555-0102",pin:"2345",membershipPlanId:"plan_unlimited",membershipStatus:"active",photo:"",familyGroupId:null,startDate:"2025-11-01",notes:"Demo client",tags:["evening"],address:{street:"",city:"",state:"",zip:"",country:"US"},movementScores:{Squat:-1,Hinge:0,Lunge:-1,Push:0,Pull:-1,Core:0,Carry:0},gamification:{level:5,xp:950,totalWorkouts:32,totalWeightLifted:15200,badges:["First Workout","10 Workouts"],currentStreak:2,longestStreak:7},rank:{current:"Bronze",promotionDate:null},inbody:{lastScan:null,history:[]},createdAt:now,_demo:true},
          {id:uid(),firstName:"Emily",lastName:"Rodriguez",email:"emily@example.com",phone:"555-0103",pin:"3456",membershipPlanId:"plan_unlimited",membershipStatus:"active",photo:"",familyGroupId:null,startDate:"2025-06-20",notes:"Demo client",tags:["morning"],address:{street:"",city:"",state:"",zip:"",country:"US"},movementScores:{Squat:3,Hinge:2,Lunge:2,Push:3,Pull:2,Core:2,Carry:3},gamification:{level:22,xp:5800,totalWorkouts:156,totalWeightLifted:98400,badges:["First Workout","10 Workouts","50 Workouts","100 Workouts"],currentStreak:12,longestStreak:30},rank:{current:"Gold",promotionDate:null},inbody:{lastScan:null,history:[]},createdAt:now,_demo:true},
          {id:uid(),firstName:"Lisa",lastName:"Park",email:"lisa@example.com",phone:"555-0104",pin:"4567",membershipPlanId:"plan_unlimited",membershipStatus:"active",photo:"",familyGroupId:null,startDate:"2026-01-05",notes:"Demo client",tags:[],address:{street:"",city:"",state:"",zip:"",country:"US"},movementScores:{Squat:0,Hinge:0,Lunge:0,Push:-1,Pull:0,Core:-1,Carry:0},gamification:{level:3,xp:450,totalWorkouts:15,totalWeightLifted:6800,badges:["First Workout"],currentStreak:3,longestStreak:5},rank:{current:"White",promotionDate:null},inbody:{lastScan:null,history:[]},createdAt:now,_demo:true},
          {id:uid(),firstName:"Tom",lastName:"Baker",email:"tom@example.com",phone:"555-0105",pin:"5678",membershipPlanId:"plan_unlimited",membershipStatus:"trial",photo:"",familyGroupId:null,startDate:now.slice(0,10),notes:"Demo trial client",tags:["trial"],address:{street:"",city:"",state:"",zip:"",country:"US"},movementScores:{Squat:0,Hinge:0,Lunge:0,Push:0,Pull:0,Core:0,Carry:0},gamification:{level:1,xp:50,totalWorkouts:2,totalWeightLifted:1200,badges:["First Workout"],currentStreak:1,longestStreak:1},rank:{current:"White",promotionDate:null},inbody:{lastScan:null,history:[]},createdAt:now,_demo:true},
        ];
        await supabaseUpsert(gymId, "hf_members", demoMembers);

        const demoSchedule = [
          {id:uid(),name:"6AM Semi-Private",instructor:"Coach",dayOfWeek:1,startTime:"06:00",endTime:"06:45",capacity:8,bookings:[],waitlist:[],recurring:true,_demo:true},
          {id:uid(),name:"7AM Strength",instructor:"Coach",dayOfWeek:1,startTime:"07:00",endTime:"07:45",capacity:8,bookings:[],waitlist:[],recurring:true,_demo:true},
          {id:uid(),name:"12PM Lunch Express",instructor:"Coach",dayOfWeek:2,startTime:"12:00",endTime:"12:30",capacity:6,bookings:[],waitlist:[],recurring:true,_demo:true},
          {id:uid(),name:"5PM Evening Semi-Private",instructor:"Coach",dayOfWeek:3,startTime:"17:00",endTime:"17:45",capacity:8,bookings:[],waitlist:[],recurring:true,_demo:true},
          {id:uid(),name:"6PM Advanced",instructor:"Coach",dayOfWeek:4,startTime:"18:00",endTime:"18:45",capacity:6,bookings:[],waitlist:[],recurring:true,_demo:true},
          {id:uid(),name:"9AM Open Gym",instructor:"Coach",dayOfWeek:5,startTime:"09:00",endTime:"10:00",capacity:12,bookings:[],waitlist:[],recurring:true,_demo:true},
        ];
        await supabaseUpsert(gymId, "hf_schedule", demoSchedule);

        const demoPlans = [
          {id:"plan_unlimited",name:"Unlimited",price:199,billingCycle:"monthly",sessionsIncluded:null,description:"Full access",features:"Unlimited sessions",active:true,_demo:true},
          {id:"plan_3x",name:"3x/Week",price:149,billingCycle:"monthly",sessionsIncluded:12,description:"3 sessions per week",features:"12 sessions/month",active:true,_demo:true},
          {id:"plan_dropin",name:"Drop-In",price:25,billingCycle:"per-session",sessionsIncluded:1,description:"Single session",features:"1 session",active:true,_demo:true},
        ];
        await supabaseUpsert(gymId, "hf_plans", demoPlans);
        await supabaseUpsert(gymId, "hf_demo_loaded", true);
      }

      // Setup: load exercises
      if (f.loadExercises) {
        const masterEx = await supabaseGet("__super__", "hf_master_exercises");
        if (masterEx && Array.isArray(masterEx)) {
          await supabaseUpsert(gymId, "hf_ex", masterEx);
        }
      }
      if (f.loadProgression) {
        const defaultProg = await supabaseGet("__super__", "hf_default_progression");
        if (defaultProg) await supabaseUpsert(gymId, "hf_matrix", defaultProg);
      }

      // Registry
      const newEntry = {
        gymId, gymName: f.gymName, planId: f.plan, planName, price,
        adminEmail: f.adminEmail || f.email, adminUsername: f.adminUsername,
        status, createdAt: now, memberCount: 0,
      };
      const freshRegistry = await fetchRegistry();
      const updated = [...freshRegistry, newEntry];
      await supabaseUpsert("__super__", "hf_gyms_registry", updated);
      setRegistry(updated);

      addAction(`Created location: ${f.gymName} (${gymId})`);

      setCreateSuccess({
        gymId,
        gymName: f.gymName,
        adminUsername: f.adminUsername,
        adminPassword: f.adminPassword,
        loginUrl: `${window.location.origin}/login?gym=${gymId}`,
      });
    } catch (err) {
      flash("Error creating location: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  /* ================= EXTEND TRIAL ================= */
  const handleExtendTrial = async (gym) => {
    try {
      const details = await loadGymDetails(gym.gymId);
      const sub = { ...(details?.sub || {}), trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(), status: "trial" };
      await supabaseUpsert(gym.gymId, "hf_subscription", sub);
      setGymDetails(prev => ({ ...prev, [gym.gymId]: { ...prev[gym.gymId], sub } }));
      // Also update registry status — re-fetch first to avoid clobbering concurrent writes
      const freshRegistry = await fetchRegistry();
      const updatedReg = freshRegistry.map(g => g.gymId === gym.gymId ? { ...g, status: "trial" } : g);
      await supabaseUpsert("__super__", "hf_gyms_registry", updatedReg);
      setRegistry(updatedReg);
      addAction(`Extended trial for ${gym.gymName}`);
      flash(`Trial extended 14 days for ${gym.gymName}`);
    } catch (err) {
      flash("Error extending trial: " + err.message);
    }
  };

  /* ================= DELETE LOCATION ================= */
  const handleDeleteLocation = async (gym) => {
    setDeleting(true);
    try {
      if (deleteData) {
        await supabaseDeleteAllForGym(gym.gymId);
      } else {
        // Just remove their core keys
        await Promise.all([
          supabaseDelete(gym.gymId, "hf_gym_info"),
          supabaseDelete(gym.gymId, "hf_users"),
          supabaseDelete(gym.gymId, "hf_subscription"),
        ]);
      }
      const freshRegistry = await fetchRegistry();
      const updated = freshRegistry.filter(g => g.gymId !== gym.gymId);
      await supabaseUpsert("__super__", "hf_gyms_registry", updated);
      setRegistry(updated);
      setGymDetails(prev => { const n = { ...prev }; delete n[gym.gymId]; return n; });
      addAction(`Deleted location: ${gym.gymName} (${gym.gymId})${deleteData ? " + all data" : ""}`);
      flash(`Deleted ${gym.gymName}`);
    } catch (err) {
      flash("Error deleting: " + err.message);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
      setDeleteData(false);
    }
  };

  /* ================= EDIT LOCATION ================= */
  const openEdit = async (gym) => {
    const details = await loadGymDetails(gym.gymId);
    const info = details?.info || {};
    const sub = details?.sub || {};
    setEditForm({
      gymName: gym.gymName || "", phone: info.phone || "", email: info.email || gym.adminEmail || "",
      street: info.address?.street || "", city: info.address?.city || "", state: info.address?.state || "", zip: info.address?.zip || "",
      timezone: info.timezone || "America/New_York", website: info.website || "",
      planId: sub.planId || gym.planId || "professional",
      customPlanName: sub.planName || gym.planName || "",
      customPrice: sub.price || gym.price || "",
      status: sub.status || gym.status || "active",
      trialEndsAt: sub.trialEndsAt || "",
    });
    setEditGym(gym);
  };

  const handleSaveEdit = async () => {
    if (!editGym) return;
    setEditSaving(true);
    try {
      const existing = gymDetails[editGym.gymId]?.info || {};
      const updatedInfo = {
        ...existing,
        gymName: editForm.gymName, phone: editForm.phone, email: editForm.email,
        address: { street: editForm.street, city: editForm.city, state: editForm.state, zip: editForm.zip },
        timezone: editForm.timezone, website: editForm.website,
      };
      await supabaseUpsert(editGym.gymId, "hf_gym_info", updatedInfo);
      // Save subscription changes
      const planName = editForm.planId === "custom" ? (editForm.customPlanName || "Custom") : (editForm.planId.charAt(0).toUpperCase() + editForm.planId.slice(1));
      const price = editForm.planId === "custom" ? (parseFloat(editForm.customPrice) || 0) : (PLAN_PRICES[editForm.planId] || 199);
      const subUpdate = { planId: editForm.planId, planName, price, status: editForm.status };
      if (editForm.trialEndsAt) subUpdate.trialEndsAt = editForm.trialEndsAt;
      await supabaseUpsert(editGym.gymId, "hf_subscription", { ...(gymDetails[editGym.gymId]?.sub || {}), ...subUpdate });
      setGymDetails(prev => ({ ...prev, [editGym.gymId]: { ...prev[editGym.gymId], sub: { ...(prev[editGym.gymId]?.sub || {}), ...subUpdate } } }));
      // Update registry — re-fetch first to avoid clobbering concurrent writes
      const freshRegistry = await fetchRegistry();
      const updatedReg = freshRegistry.map(g => g.gymId === editGym.gymId ? { ...g, gymName: editForm.gymName, adminEmail: editForm.email, planId: editForm.planId, planName, price, status: editForm.status } : g);
      await supabaseUpsert("__super__", "hf_gyms_registry", updatedReg);
      setRegistry(updatedReg);
      setGymDetails(prev => ({ ...prev, [editGym.gymId]: { ...prev[editGym.gymId], info: updatedInfo } }));
      addAction(`Edited location: ${editForm.gymName}`);
      flash(`Updated ${editForm.gymName}`);
      setEditGym(null);
    } catch (err) {
      flash("Error saving: " + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  /* ===================== COMPUTED ===================== */
  const stats = useMemo(() => {
    const total = registry.length;
    const mrr = registry.reduce((sum, g) => sum + (g.price || 0), 0);
    const now = new Date();
    const thisMonth = registry.filter(g => {
      const d = new Date(g.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const byPlan = { starter: 0, professional: 0, enterprise: 0, custom: 0 };
    registry.forEach(g => { if (byPlan[g.planId] !== undefined) byPlan[g.planId]++; else byPlan.custom++; });
    const trialCount = registry.filter(g => g.status === "trial").length;
    const activeCount = registry.filter(g => g.status === "active").length;
    return { total, mrr, thisMonth, byPlan, trialCount, activeCount };
  }, [registry]);

  /* ===================== STYLES ===================== */
  const pageStyle = { padding: isMobile ? 12 : 24, color: B.text, minHeight: "100vh" };
  const headerStyle = { fontSize: 24, fontWeight: 700, marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" };
  const tabBar = { display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${B.border}`, paddingBottom: 4, overflowX: "auto", whiteSpace: "nowrap" };
  const tabBtn = (active) => ({ padding: "8px 20px", borderRadius: "8px 8px 0 0", background: active ? B.card : "transparent", color: active ? B.green : B.muted, fontWeight: active ? 700 : 500, fontSize: 14, border: "none", cursor: "pointer", borderBottom: active ? `2px solid ${B.green}` : "2px solid transparent", flexShrink: 0, whiteSpace: "nowrap" });
  const statCard = { textAlign: "center", padding: 20, flex: 1, minWidth: 130 };
  const statNum = { fontSize: 28, fontWeight: 800, color: B.green };
  const statLabel = { fontSize: 13, color: B.muted, marginTop: 4 };
  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${B.border}`, background: B.dark, color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontWeight: 600, fontSize: 13, color: B.muted, marginBottom: 6 };
  const btnPrimary = { padding: "8px 20px", borderRadius: 8, background: B.green, color: "#fff", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" };
  const btnDanger = { padding: "6px 14px", borderRadius: 6, background: B.red || "#e74c3c", color: "#fff", fontWeight: 600, fontSize: 12, border: "none", cursor: "pointer" };
  const btnSmall = { padding: "6px 14px", borderRadius: 6, background: B.blue || "#3498db", color: "#fff", fontWeight: 600, fontSize: 12, border: "none", cursor: "pointer" };
  const btnOutline = { padding: "6px 14px", borderRadius: 6, background: "transparent", color: B.muted, fontWeight: 600, fontSize: 12, border: `1px solid ${B.border}`, cursor: "pointer" };
  const tableHeader = { padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5 };
  const tableCell = { padding: "10px 12px", fontSize: 14, color: B.text, borderTop: `1px solid ${B.border}` };
  const badge = (color) => ({ display: "inline-block", padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: color + "22", color });
  const overlayStyle = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" };
  const modalStyle = { background: B.card || "#1e1e2e", borderRadius: 16, padding: isMobile ? 20 : 32, width: "min(720px, calc(100vw - 24px))", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${B.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", boxSizing: "border-box" };
  const sectionTitle = { fontSize: 14, fontWeight: 700, color: B.green, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginTop: 20 };
  const checkboxRow = { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer", fontSize: 14, color: B.text };
  const planCard = (selected, color) => ({
    flex: 1, minWidth: 110, padding: 16, borderRadius: 10, textAlign: "center", cursor: "pointer",
    border: `2px solid ${selected ? color : B.border}`, background: selected ? color + "11" : "transparent",
    transition: "all 0.15s ease",
  });

  /* ===================== ACCESS DENIED ===================== */
  if (!isSuperAdmin) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", paddingTop: 120 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#128274;</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: B.text, marginBottom: 8 }}>Access Denied</h1>
        <p style={{ color: B.muted, fontSize: 15 }}>You do not have permission to view this page.</p>
        <button style={{ ...btnPrimary, marginTop: 20 }} onClick={() => { const gid = localStorage.getItem("hf_gym_id") || "default"; navigate(`/gym/${gid}/`); }}>Go to Dashboard</button>
      </div>
    );
  }

  /* ===================== IMPERSONATION BANNER ===================== */
  const isImpersonating = localStorage.getItem("hf_impersonating") === "true";

  /* ===================== MODAL: CREATE LOCATION ===================== */
  const renderCreateModal = () => {
    if (!showCreateModal) return null;
    const f = createForm;

    // Success screen
    if (createSuccess) {
      return (
        <div style={overlayStyle} onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>&#9989;</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: B.text, margin: 0 }}>Location Created Successfully</h2>
            </div>

            <div style={{ background: B.dark, borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "100px 1fr" : "140px 1fr", gap: "10px 16px", fontSize: 14 }}>
                <span style={{ color: B.muted, fontWeight: 600 }}>Gym Name:</span>
                <span style={{ color: B.text }}>{createSuccess.gymName}</span>
                <span style={{ color: B.muted, fontWeight: 600 }}>Gym ID:</span>
                <span style={{ color: B.text, fontFamily: "monospace" }}>{createSuccess.gymId}</span>
                <span style={{ color: B.muted, fontWeight: 600 }}>Login URL:</span>
                <span style={{ color: B.blue || "#3498db", fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>{createSuccess.loginUrl}</span>
                <span style={{ color: B.muted, fontWeight: 600 }}>Username:</span>
                <span style={{ color: B.text, fontFamily: "monospace" }}>{createSuccess.adminUsername}</span>
                <span style={{ color: B.muted, fontWeight: 600 }}>Password:</span>
                <span style={{ color: B.text, fontFamily: "monospace" }}>{createSuccess.adminPassword}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                style={{ ...btnPrimary, padding: "10px 24px" }}
                onClick={() => {
                  const text = `Gym: ${createSuccess.gymName}\nGym ID: ${createSuccess.gymId}\nLogin URL: ${createSuccess.loginUrl}\nUsername: ${createSuccess.adminUsername}\nPassword: ${createSuccess.adminPassword}`;
                  navigator.clipboard.writeText(text);
                  flash("Credentials copied to clipboard!");
                }}
              >
                Copy Credentials
              </button>
              <button style={{ ...btnOutline, padding: "10px 24px" }} onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={overlayStyle} onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>
        <div style={modalStyle} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: B.text, margin: 0 }}>Create New Location</h2>
            <button style={{ background: "none", border: "none", color: B.muted, fontSize: 22, cursor: "pointer", padding: 4 }} onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>&times;</button>
          </div>
          <p style={{ color: B.muted, fontSize: 13, marginBottom: 8, marginTop: 0 }}>Set up a new gym location with admin account and subscription.</p>

          {/* Gym Info */}
          <div style={sectionTitle}>Gym Information</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Gym / Location Name *</label>
              <input style={inputStyle} value={f.gymName} onChange={e => updateCreateForm("gymName", e.target.value)} placeholder="Iron Athletics" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={f.phone} onChange={e => updateCreateForm("phone", e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={f.email} onChange={e => updateCreateForm("email", e.target.value)} placeholder="info@gym.com" />
            </div>
            <div>
              <label style={labelStyle}>Website URL</label>
              <input style={inputStyle} value={f.website} onChange={e => updateCreateForm("website", e.target.value)} placeholder="https://www.gym.com" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 1fr 1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Street Address</label>
              <input style={inputStyle} value={f.street} onChange={e => updateCreateForm("street", e.target.value)} placeholder="123 Main St" />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} value={f.city} onChange={e => updateCreateForm("city", e.target.value)} placeholder="City" />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <input style={inputStyle} value={f.state} onChange={e => updateCreateForm("state", e.target.value)} placeholder="NY" />
            </div>
            <div>
              <label style={labelStyle}>Zip</label>
              <input style={inputStyle} value={f.zip} onChange={e => updateCreateForm("zip", e.target.value)} placeholder="10001" />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Timezone</label>
            <select style={inputStyle} value={f.timezone} onChange={e => updateCreateForm("timezone", e.target.value)}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          {/* Admin Account */}
          <div style={sectionTitle}>Admin Account</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Display Name *</label>
              <input style={inputStyle} value={f.adminDisplayName} onChange={e => updateCreateForm("adminDisplayName", e.target.value)} placeholder="John Smith" />
            </div>
            <div>
              <label style={labelStyle}>Admin Email</label>
              <input style={inputStyle} value={f.adminEmail} onChange={e => updateCreateForm("adminEmail", e.target.value)} placeholder="admin@gym.com" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Username *</label>
              <input style={inputStyle} value={f.adminUsername} onChange={e => updateCreateForm("adminUsername", e.target.value)} placeholder="admin" />
            </div>
            <div>
              <label style={labelStyle}>Password *</label>
              <input style={inputStyle} type="text" value={f.adminPassword} onChange={e => updateCreateForm("adminPassword", e.target.value)} placeholder="securepassword" />
            </div>
          </div>

          {/* Plan Selection */}
          <div style={sectionTitle}>Plan Selection</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { id: "starter", label: "Starter", price: "$99/mo", color: B.blue || "#3498db" },
              { id: "professional", label: "Professional", price: "$199/mo", color: B.green },
              { id: "enterprise", label: "Enterprise", price: "$399/mo", color: B.purple || "#9b59b6" },
              { id: "custom", label: "Custom", price: "Custom", color: B.orange || "#f59e0b" },
            ].map(p => (
              <div key={p.id} style={planCard(f.plan === p.id, p.color)} onClick={() => updateCreateForm("plan", p.id)}>
                <div style={{ fontSize: 15, fontWeight: 700, color: f.plan === p.id ? p.color : B.text, marginBottom: 4 }}>{p.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: f.plan === p.id ? p.color : B.muted }}>{p.price}</div>
              </div>
            ))}
          </div>
          {f.plan === "custom" && (
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: B.muted, marginBottom: 4, fontWeight: 600 }}>Plan Name</div>
                <input value={f.customPlanName || ""} onChange={e => updateCreateForm("customPlanName", e.target.value)} placeholder="e.g. Premium" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: B.muted, marginBottom: 4, fontWeight: 600 }}>Price ($/mo)</div>
                <input type="number" value={f.customPlanPrice || ""} onChange={e => updateCreateForm("customPlanPrice", e.target.value)} placeholder="e.g. 299" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          )}
          <label style={checkboxRow} onClick={(e) => { e.preventDefault(); updateCreateForm("trial", !f.trial); }}>
            <input type="checkbox" checked={f.trial} readOnly style={{ accentColor: B.green }} />
            <span>Start with 14-day free trial</span>
          </label>

          {/* Initial Setup */}
          <div style={sectionTitle}>Initial Setup Options</div>
          <label style={checkboxRow} onClick={(e) => { e.preventDefault(); updateCreateForm("loadDemo", !f.loadDemo); }}>
            <input type="checkbox" checked={f.loadDemo} readOnly style={{ accentColor: B.green }} />
            <span>Load demo data (sample members, sessions, etc.)</span>
          </label>
          <label style={checkboxRow} onClick={(e) => { e.preventDefault(); updateCreateForm("loadExercises", !f.loadExercises); }}>
            <input type="checkbox" checked={f.loadExercises} readOnly style={{ accentColor: B.green }} />
            <span>Load exercise library (default exercises)</span>
          </label>
          <label style={checkboxRow} onClick={(e) => { e.preventDefault(); updateCreateForm("loadProgression", !f.loadProgression); }}>
            <input type="checkbox" checked={f.loadProgression} readOnly style={{ accentColor: B.green }} />
            <span>Load progression engine (default matrix)</span>
          </label>

          {/* Submit */}
          <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
            <button style={btnOutline} onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>Cancel</button>
            <button
              style={{ ...btnPrimary, padding: "10px 28px", fontSize: 14, opacity: creating ? 0.6 : 1 }}
              onClick={handleCreateLocation}
              disabled={creating}
            >
              {creating ? "Creating..." : "Create Location"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ===================== MODAL: EDIT LOCATION ===================== */
  const renderEditModal = () => {
    if (!editGym) return null;
    return (
      <div style={overlayStyle} onClick={() => setEditGym(null)}>
        <div style={{ ...modalStyle, width: "min(560px, calc(100vw - 24px))" }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: B.text, margin: 0 }}>Edit Location: {editGym.gymName}</h2>
            <button style={{ background: "none", border: "none", color: B.muted, fontSize: 22, cursor: "pointer" }} onClick={() => setEditGym(null)}>&times;</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Gym Name</label>
              <input style={inputStyle} value={editForm.gymName || ""} onChange={e => setEditForm(p => ({ ...p, gymName: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={editForm.phone || ""} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={editForm.email || ""} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input style={inputStyle} value={editForm.website || ""} onChange={e => setEditForm(p => ({ ...p, website: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 1fr 1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Street</label>
              <input style={inputStyle} value={editForm.street || ""} onChange={e => setEditForm(p => ({ ...p, street: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} value={editForm.city || ""} onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <input style={inputStyle} value={editForm.state || ""} onChange={e => setEditForm(p => ({ ...p, state: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Zip</label>
              <input style={inputStyle} value={editForm.zip || ""} onChange={e => setEditForm(p => ({ ...p, zip: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Timezone</label>
            <select style={inputStyle} value={editForm.timezone || ""} onChange={e => setEditForm(p => ({ ...p, timezone: e.target.value }))}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          {/* Plan & Subscription */}
          <div style={{ borderTop: "1px solid " + B.border, paddingTop: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: B.text, margin: "0 0 12px" }}>Subscription</h3>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Plan</label>
                <select style={inputStyle} value={editForm.planId || "professional"} onChange={e => setEditForm(p => ({ ...p, planId: e.target.value }))}>
                  <option value="starter">Starter ($99/mo)</option>
                  <option value="professional">Professional ($199/mo)</option>
                  <option value="enterprise">Enterprise ($399/mo)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={editForm.status || "active"} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            {editForm.planId === "custom" && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Custom Plan Name</label>
                  <input style={inputStyle} value={editForm.customPlanName || ""} onChange={e => setEditForm(p => ({ ...p, customPlanName: e.target.value }))} placeholder="e.g. Premium" />
                </div>
                <div>
                  <label style={labelStyle}>Custom Price ($/mo)</label>
                  <input style={inputStyle} type="number" value={editForm.customPrice || ""} onChange={e => setEditForm(p => ({ ...p, customPrice: e.target.value }))} placeholder="299" />
                </div>
              </div>
            )}
            {editForm.status === "trial" && (
              <button style={{ background: B.orange + "18", color: B.orange, border: "1px solid " + B.orange + "40", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }} onClick={() => {
                const newEnd = new Date(Date.now() + 14 * 86400000).toISOString();
                setEditForm(p => ({ ...p, trialEndsAt: newEnd }));
                flash("Trial will be extended to " + new Date(newEnd).toLocaleDateString() + " when you save.");
              }}>Extend Trial 14 Days</button>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button style={btnOutline} onClick={() => setEditGym(null)}>Cancel</button>
            <button style={{ ...btnPrimary, opacity: editSaving ? 0.6 : 1 }} onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ===================== MODAL: DELETE CONFIRM ===================== */
  const renderDeleteConfirm = () => {
    if (!deleteConfirm) return null;
    return (
      <div style={overlayStyle} onClick={() => { setDeleteConfirm(null); setDeleteData(false); }}>
        <div style={{ ...modalStyle, width: "min(460px, calc(100vw - 24px))", textAlign: "center" }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#9888;&#65039;</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: B.text, margin: "0 0 8px 0" }}>Delete Location</h2>
          <p style={{ color: B.muted, fontSize: 14, marginBottom: 20 }}>
            Are you sure you want to delete <strong style={{ color: B.text }}>{deleteConfirm.gymName}</strong>?
            <br />This action cannot be undone.
          </p>

          <label style={{ ...checkboxRow, justifyContent: "center", marginBottom: 20 }} onClick={(e) => { e.preventDefault(); setDeleteData(!deleteData); }}>
            <input type="checkbox" checked={deleteData} readOnly style={{ accentColor: B.red || "#e74c3c" }} />
            <span style={{ color: B.red || "#e74c3c" }}>Also delete ALL data for this gym from Supabase</span>
          </label>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button style={btnOutline} onClick={() => { setDeleteConfirm(null); setDeleteData(false); }}>Cancel</button>
            <button
              style={{ ...btnDanger, padding: "10px 24px", fontSize: 14, opacity: deleting ? 0.6 : 1 }}
              onClick={() => handleDeleteLocation(deleteConfirm)}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Location"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ===================== GYM DETAIL (shared: table expansion + mobile card) ===================== */
  const renderGymDetail = (g) => gymDetails[g.gymId] ? (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? 16 : 24 }}>
      <div>
        <h4 style={{ color: B.green, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Contact</h4>
        <p style={{ color: B.text, fontSize: 14, margin: "2px 0" }}>{gymDetails[g.gymId].info?.email || g.adminEmail || "N/A"}</p>
        <p style={{ color: B.muted, fontSize: 13, margin: "2px 0" }}>Admin: {g.adminUsername || "N/A"}</p>
        <p style={{ color: B.muted, fontSize: 13, margin: "2px 0" }}>Phone: {gymDetails[g.gymId].info?.phone || "N/A"}</p>
        {gymDetails[g.gymId].info?.address && (
          <p style={{ color: B.muted, fontSize: 13, margin: "2px 0" }}>
            {[gymDetails[g.gymId].info.address.street, gymDetails[g.gymId].info.address.city, gymDetails[g.gymId].info.address.state, gymDetails[g.gymId].info.address.zip].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
      <div>
        <h4 style={{ color: B.green, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Subscription</h4>
        <p style={{ color: B.text, fontSize: 14, margin: "2px 0" }}>
          {gymDetails[g.gymId].sub?.planName || "N/A"} — ${gymDetails[g.gymId].sub?.price || 0}/mo
        </p>
        <p style={{ color: B.muted, fontSize: 13, margin: "2px 0" }}>
          Status: {gymDetails[g.gymId].sub?.status || "N/A"}
        </p>
        {gymDetails[g.gymId].sub?.trialEndsAt && (
          <p style={{ color: B.muted, fontSize: 13, margin: "2px 0" }}>
            Trial ends: {new Date(gymDetails[g.gymId].sub.trialEndsAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <div>
        <h4 style={{ color: B.green, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Usage</h4>
        <p style={{ color: B.text, fontSize: 14, margin: "2px 0" }}>
          Members: {gymDetails[g.gymId].members?.length || 0}
        </p>
      </div>
    </div>
  ) : (
    <p style={{ color: B.muted }}>Loading details...</p>
  );

  return (
    <div style={pageStyle}>
      {isImpersonating && (
        <div style={{ background: (B.orange || "#e67e22") + "22", border: `1px solid ${B.orange || "#e67e22"}`, borderRadius: 8, padding: "8px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: B.orange || "#e67e22", fontWeight: 600, fontSize: 14 }}>
            Impersonating gym: {localStorage.getItem("hf_gym_id")}
          </span>
          <button style={{ ...btnDanger, background: B.orange || "#e67e22" }} onClick={handleStopImpersonating}>Stop Impersonating</button>
        </div>
      )}

      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>Super Admin Panel</span>
          <span style={{ fontSize: 12, fontWeight: 400, background: B.green + "22", color: B.green, padding: "2px 10px", borderRadius: 10 }}>SUPER ADMIN</span>
        </div>
        <button onClick={() => { logout(); window.location.href = "/login"; }} style={{ background: B.red + "15", border: "1px solid " + B.red + "30", borderRadius: 8, color: B.red, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Sign Out</button>
      </div>

      {actionMsg && (
        <div style={{ background: B.green + "22", border: `1px solid ${B.green}`, borderRadius: 8, padding: "8px 16px", marginBottom: 16, color: B.green, fontSize: 14, fontWeight: 600 }}>
          {actionMsg}
        </div>
      )}

      {/* Tab bar */}
      <div style={tabBar}>
        {[
          { id: "dashboard", label: "Dashboard" },
          { id: "gyms", label: "Gyms" },
          { id: "exercises", label: "Exercise Library" },
          { id: "revenue", label: "Revenue" },
          { id: "support", label: "Support" },
          { id: "feedback", label: "Feedback" },
        ].map(t => (
          <button key={t.id} style={tabBtn(tab === t.id)} onClick={() => { setTab(t.id); if (t.id === "feedback" && feedback.length === 0) loadFeedback(); }}>{t.label}</button>
        ))}
      </div>

      {loading && <p style={{ color: B.muted }}>Loading...</p>}

      {/* ===== DASHBOARD TAB ===== */}
      {!loading && tab === "dashboard" && (
        <>
          {/* Title row with Create button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: B.text, margin: 0 }}>Overview</h2>
            <button
              style={{ ...btnPrimary, padding: "10px 24px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}
              onClick={() => setShowCreateModal(true)}
            >
              + Create New Location
            </button>
          </div>

          {/* Quick create card */}
          <Card style={{ marginBottom: 20, padding: 20, background: B.green + "08", border: `1px solid ${B.green}33`, cursor: "pointer" }} onClick={() => setShowCreateModal(true)}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: B.green + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>+</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: B.text }}>Create New Location</div>
                <div style={{ fontSize: 13, color: B.muted }}>Set up a new gym with admin account, subscription, and initial data.</div>
              </div>
            </div>
          </Card>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <Card style={statCard}>
              <div style={statNum}>{stats.total}</div>
              <div style={statLabel}>Total Locations</div>
            </Card>
            <Card style={statCard}>
              <div style={statNum}>${stats.mrr.toLocaleString()}</div>
              <div style={statLabel}>Total MRR</div>
            </Card>
            <Card style={statCard}>
              <div style={statNum}>{stats.thisMonth}</div>
              <div style={statLabel}>New This Month</div>
            </Card>
            <Card style={statCard}>
              <div style={statNum}>{stats.activeCount}</div>
              <div style={statLabel}>Active</div>
            </Card>
            <Card style={statCard}>
              <div style={statNum}>{stats.trialCount}</div>
              <div style={statLabel}>Trials</div>
            </Card>
          </div>

          {/* Plan breakdown */}
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: B.text }}>Plan Distribution</h3>
            <div style={{ display: "flex", gap: isMobile ? 16 : 32, flexWrap: "wrap" }}>
              {[
                { label: "Starter", count: stats.byPlan.starter, color: B.blue || "#3498db" },
                { label: "Professional", count: stats.byPlan.professional, color: B.green },
                { label: "Enterprise", count: stats.byPlan.enterprise, color: B.purple || "#9b59b6" },
                { label: "Custom", count: stats.byPlan.custom, color: B.orange || "#f59e0b" },
              ].map(p => (
                <div key={p.label}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: p.color }}>{p.count}</span>
                  <span style={{ fontSize: 13, color: B.muted, marginLeft: 8 }}>{p.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Two columns: Recent registrations + Recent actions */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
            <Card>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: B.text }}>Recent Registrations</h3>
              {registry.slice(-5).reverse().map(g => (
                <div key={g.gymId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${B.border}` }}>
                  <div>
                    <span style={{ fontWeight: 600, color: B.text }}>{g.gymName}</span>
                    <span style={{ color: B.muted, fontSize: 12, marginLeft: 8 }}>{g.planName}</span>
                  </div>
                  <span style={{ color: B.dim, fontSize: 12 }}>{g.createdAt ? new Date(g.createdAt).toLocaleDateString() : "N/A"}</span>
                </div>
              ))}
              {registry.length === 0 && <p style={{ color: B.muted, fontSize: 14 }}>No gyms registered yet.</p>}
            </Card>

            <Card>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: B.text }}>Recent Actions</h3>
              {actionLog.length === 0 && <p style={{ color: B.muted, fontSize: 14 }}>No actions this session.</p>}
              {actionLog.slice(0, 8).map((a, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${B.border}` }}>
                  <span style={{ fontSize: 13, color: B.text }}>{a.text}</span>
                  <span style={{ fontSize: 11, color: B.dim }}>{new Date(a.time).toLocaleTimeString()}</span>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}

      {/* ===== GYMS TAB ===== */}
      {!loading && tab === "gyms" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: B.text, margin: 0 }}>
              All Locations <span style={{ fontSize: 14, fontWeight: 400, color: B.muted }}>({registry.length})</span>
            </h2>
            <button style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 8 }} onClick={() => setShowCreateModal(true)}>
              + Create New Location
            </button>
          </div>

          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {registry.map(g => (
                <Card key={g.gymId} style={{ padding: 14 }}>
                  <div style={{ cursor: "pointer" }} onClick={() => handleExpand(g.gymId)}>
                    <div style={{ fontWeight: 600, color: B.text, fontSize: 15 }}>{g.gymName}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: B.muted, margin: "2px 0 8px", wordBreak: "break-all" }}>{g.gymId}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                      <span style={badge(g.planId === "enterprise" ? (B.purple || "#9b59b6") : g.planId === "professional" ? B.green : g.planId === "custom" ? (B.orange || "#f59e0b") : (B.blue || "#3498db"))}>
                        {g.planName || g.planId}
                      </span>
                      <span style={badge(g.status === "active" ? B.green : g.status === "trial" ? (B.orange || "#e67e22") : (B.red || "#e74c3c"))}>
                        {g.status || "trial"}
                      </span>
                      <span style={{ fontSize: 12, color: B.muted }}>Clients: {g.memberCount ?? (gymDetails[g.gymId]?.members?.length ?? "--")}</span>
                      <span style={{ fontSize: 12, color: B.muted }}>{g.createdAt ? new Date(g.createdAt).toLocaleDateString() : "N/A"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button style={btnSmall} onClick={() => setImpersonateTarget(g)}>Impersonate</button>
                    <button style={{ ...btnSmall, background: B.green }} onClick={() => openEdit(g)}>Edit</button>
                    <button style={btnDanger} onClick={() => setDeleteConfirm(g)}>Delete</button>
                  </div>
                  {expandedGym === g.gymId && (
                    <div style={{ marginTop: 12, borderTop: `1px solid ${B.border}`, paddingTop: 12 }}>
                      {renderGymDetail(g)}
                    </div>
                  )}
                </Card>
              ))}
              {registry.length === 0 && (
                <Card><p style={{ color: B.muted, textAlign: "center", padding: 16, margin: 0 }}>No gyms registered yet.</p></Card>
              )}
            </div>
          ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: B.dark }}>
                  <th style={tableHeader}>Gym Name</th>
                  <th style={tableHeader}>Gym ID</th>
                  <th style={tableHeader}>Plan</th>
                  <th style={tableHeader}>Status</th>
                  <th style={tableHeader}>Clients</th>
                  <th style={tableHeader}>Created</th>
                  <th style={tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {registry.map(g => (
                  <React.Fragment key={g.gymId}>
                    <tr style={{ cursor: "pointer" }} onClick={() => handleExpand(g.gymId)}>
                      <td style={tableCell}>
                        <span style={{ fontWeight: 600 }}>{g.gymName}</span>
                      </td>
                      <td style={{ ...tableCell, fontFamily: "monospace", fontSize: 12, color: B.muted }}>{g.gymId}</td>
                      <td style={tableCell}>
                        <span style={badge(g.planId === "enterprise" ? (B.purple || "#9b59b6") : g.planId === "professional" ? B.green : g.planId === "custom" ? (B.orange || "#f59e0b") : (B.blue || "#3498db"))}>
                          {g.planName || g.planId}
                        </span>
                      </td>
                      <td style={tableCell}>
                        <span style={badge(g.status === "active" ? B.green : g.status === "trial" ? (B.orange || "#e67e22") : (B.red || "#e74c3c"))}>
                          {g.status || "trial"}
                        </span>
                      </td>
                      <td style={{ ...tableCell, fontSize: 13, color: B.muted }}>
                        {g.memberCount ?? (gymDetails[g.gymId]?.members?.length ?? "--")}
                      </td>
                      <td style={{ ...tableCell, fontSize: 13, color: B.muted }}>
                        {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : "N/A"}
                      </td>
                      <td style={tableCell}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button style={btnSmall} onClick={(e) => { e.stopPropagation(); setImpersonateTarget(g); }}>Impersonate</button>
                          <button style={{ ...btnSmall, background: B.green }} onClick={(e) => { e.stopPropagation(); openEdit(g); }}>Edit</button>
                          <button style={btnDanger} onClick={(e) => { e.stopPropagation(); setDeleteConfirm(g); }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                    {expandedGym === g.gymId && (
                      <tr key={g.gymId + "_detail"}>
                        <td colSpan={7} style={{ ...tableCell, background: B.dark, padding: 20 }}>
                          {renderGymDetail(g)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {registry.length === 0 && (
                  <tr><td colSpan={7} style={{ ...tableCell, textAlign: "center", color: B.muted, padding: 32 }}>No gyms registered yet.</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </Card>
          )}
        </>
      )}

      {/* ===== REVENUE TAB ===== */}
      {!loading && tab === "revenue" && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "Starter MRR", value: stats.byPlan.starter * 99, color: B.blue || "#3498db" },
              { label: "Professional MRR", value: stats.byPlan.professional * 199, color: B.green },
              { label: "Enterprise MRR", value: stats.byPlan.enterprise * 399, color: B.purple || "#9b59b6" },
            ].map(tier => (
              <Card key={tier.label} style={{ ...statCard, flex: 1 }}>
                <div style={{ ...statNum, color: tier.color }}>${tier.value.toLocaleString()}</div>
                <div style={statLabel}>{tier.label}</div>
                <div style={{ fontSize: 12, color: B.dim, marginTop: 4 }}>
                  {stats.byPlan[tier.label.split(" ")[0].toLowerCase()] || 0} gyms
                </div>
              </Card>
            ))}
          </div>

          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: B.text }}>Total MRR</h3>
            <div style={{ fontSize: 36, fontWeight: 800, color: B.green }}>${stats.mrr.toLocaleString()}</div>
            <div style={{ color: B.muted, fontSize: 14, marginTop: 4 }}>across {stats.total} gyms</div>
          </Card>

          {/* Growth chart placeholder */}
          <Card>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: B.text }}>Gym Growth (Monthly)</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, padding: "0 16px" }}>
              {[2, 4, 7, 11, 15, 22, 28, 35, 42, 50, 61, stats.total || 72].map((v, i) => {
                const max = Math.max(72, stats.total || 72);
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: "100%", height: (v / max) * 100, background: B.green, borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                    <span style={{ fontSize: 10, color: B.dim, marginTop: 4 }}>
                      {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* ===== SUPPORT TAB ===== */}
      {!loading && tab === "support" && (
        <>
          {/* Quick Actions */}
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: B.text }}>Quick Actions</h3>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              {registry.map(g => (
                <div key={g.gymId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: B.dark, borderRadius: 8, border: `1px solid ${B.border}`, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: B.text, fontSize: 14 }}>{g.gymName}</span>
                    <span style={{ color: B.muted, fontSize: 12, marginLeft: 8 }}>{g.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btnSmall} onClick={() => handleExtendTrial(g)}>Extend Trial</button>
                    <button style={btnSmall} onClick={() => setImpersonateTarget(g)}>Impersonate</button>
                  </div>
                </div>
              ))}
              {registry.length === 0 && <p style={{ color: B.muted, fontSize: 14, gridColumn: "span 2" }}>No gyms to manage yet.</p>}
            </div>
          </Card>

          {/* System Info */}
          <Card>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: B.text }}>System Info</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
              <span style={{ color: B.muted }}>Database:</span><span style={{ color: B.text }}>Supabase (data_store)</span>
              <span style={{ color: B.muted }}>Registry Key:</span><span style={{ color: B.text, fontFamily: "monospace" }}>__super__ / hf_gyms_registry</span>
              <span style={{ color: B.muted }}>Total Records:</span><span style={{ color: B.text }}>{registry.length} gyms</span>
              <span style={{ color: B.muted }}>Logged in as:</span><span style={{ color: B.green }}>{currentUser?.username}</span>
            </div>
          </Card>
        </>
      )}

      {/* ===== FEEDBACK TAB ===== */}
      {!loading && tab === "feedback" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: B.text, margin: 0 }}>
              Feedback Submissions <span style={{ fontSize: 14, fontWeight: 400, color: B.muted }}>({feedback.length})</span>
            </h2>
            <button style={btnPrimary} onClick={loadFeedback}>{feedbackLoading ? "Loading..." : "Refresh"}</button>
          </div>
          {feedbackLoading && <p style={{ color: B.muted }}>Loading feedback...</p>}
          {!feedbackLoading && feedback.length === 0 && (
            <Card><p style={{ color: B.muted, textAlign: "center", padding: 32 }}>No feedback submissions yet.</p></Card>
          )}
          {!feedbackLoading && feedback.length > 0 && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: B.dark }}>
                    <th style={tableHeader}>Date</th>
                    <th style={tableHeader}>Gym</th>
                    <th style={tableHeader}>From</th>
                    <th style={tableHeader}>Category</th>
                    <th style={tableHeader}>Subject</th>
                    <th style={tableHeader}>Status</th>
                    <th style={tableHeader}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...feedback].reverse().map(fb => (
                    <tr key={fb.id}>
                      <td style={tableCell}>{fb.timestamp ? new Date(fb.timestamp).toLocaleDateString() : "N/A"}</td>
                      <td style={tableCell}><span style={{ fontWeight: 600 }}>{fb.gymName || fb.gymId}</span></td>
                      <td style={{ ...tableCell, color: B.muted }}>{fb.submittedBy}</td>
                      <td style={tableCell}>
                        <span style={badge(
                          fb.category === "Bug Report" ? (B.red || "#e74c3c") :
                          fb.category === "Feature Request" ? (B.blue || "#3498db") :
                          fb.category === "Question" ? (B.orange || "#e67e22") : B.muted
                        )}>{fb.category}</span>
                      </td>
                      <td style={tableCell}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>{fb.subject}</div>
                          <div style={{ fontSize: 12, color: B.dim, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fb.message}</div>
                          {fb.screenshot && <a href={fb.screenshot} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: B.blue || "#3498db" }}>View Screenshot</a>}
                        </div>
                      </td>
                      <td style={tableCell}>
                        <span style={badge(
                          fb.status === "new" ? (B.orange || "#e67e22") :
                          fb.status === "reviewed" ? (B.blue || "#3498db") :
                          fb.status === "resolved" ? B.green : B.muted
                        )}>{fb.status}</span>
                      </td>
                      <td style={tableCell}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {fb.status !== "reviewed" && (
                            <button style={{ ...btnSmall, background: B.blue || "#3498db" }} onClick={() => updateFeedbackStatus(fb.id, "reviewed")}>Reviewed</button>
                          )}
                          {fb.status !== "resolved" && (
                            <button style={{ ...btnSmall, background: B.green }} onClick={() => updateFeedbackStatus(fb.id, "resolved")}>Resolved</button>
                          )}
                          {fb.status !== "new" && (
                            <button style={btnOutline} onClick={() => updateFeedbackStatus(fb.id, "new")}>Reopen</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Exercise Library Tab */}
      {!loading && tab === "exercises" && (() => {
        const PC = { Squat:"#e94560",Hinge:"#f59e0b",Lunge:"#22c55e",Push:"#3b82f6",Pull:"#a855f7",Core:"#ff7043",Carry:"#26a69a",Cardio:"#ef4444",Power:"#fbbf24",Mobility:"#78909c",Accessory:"#a1887f" };
        const PATS = ["All","Squat","Hinge","Lunge","Push","Pull","Core","Carry","Cardio","Power","Mobility","Accessory"];

        return <ExerciseLibraryTab B={B} supabaseGet={supabaseGet} supabaseUpsert={supabaseUpsert} PC={PC} PATS={PATS} registry={registry} />;
      })()}

      {/* Modals */}
      {renderCreateModal()}
      {renderEditModal()}
      {renderDeleteConfirm()}

      {/* Impersonate Role Picker */}
      {impersonateTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setImpersonateTarget(null)}>
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 440, width: "90%" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: B.text }}>Impersonate</h3>
            <p style={{ color: B.muted, fontSize: 13, margin: "0 0 20px" }}>
              View <strong>{impersonateTarget.gymName}</strong> as:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { role: "admin", label: "Admin", desc: "Full access — business dashboard, billing, settings", color: "#f59e0b", icon: "\uD83D\uDC51" },
                { role: "coach", label: "Coach", desc: "Coaching tools — session view, workouts, clients", color: "#3b82f6", icon: "\uD83C\uDFCB\uFE0F" },
                { role: "client", label: "Client", desc: "Mobile client portal — workouts, booking, progress", color: "#22c55e", icon: "\uD83D\uDCF1" },
              ].map(opt => (
                <button key={opt.role} onClick={() => { handleImpersonate(impersonateTarget, opt.role); setImpersonateTarget(null); }}
                  style={{
                    padding: "14px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                    border: "1px solid " + B.border, background: B.dark, transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 14,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = opt.color; e.currentTarget.style.background = opt.color + "10"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = B.border; e.currentTarget.style.background = B.dark; }}
                >
                  <span style={{ fontSize: 28 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: B.text }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>{opt.desc}</div>
                  </div>
                  <span style={{
                    marginLeft: "auto", padding: "3px 10px", borderRadius: 6,
                    fontSize: 10, fontWeight: 700, background: opt.color + "22", color: opt.color,
                    textTransform: "uppercase",
                  }}>{opt.role}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setImpersonateTarget(null)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExerciseLibraryTab({ B, supabaseGet, supabaseUpsert, PC, PATS, registry }) {
  const [exercises, setExercises] = useState([]);
  const [loadingEx, setLoadingEx] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPat, setFilterPat] = useState("All");
  const [editEx, setEditEx] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState("");

  // Load master exercise library from __super__ gym
  useEffect(() => {
    (async () => {
      setLoadingEx(true);
      const data = await supabaseGet("__super__", "hf_master_exercises");
      if (data && Array.isArray(data)) setExercises(data);
      else {
        // Seed from the bundled default library (src/data/exercises.js), never the browser's hf_ex cache
        try {
          setExercises(EX);
          await supabaseUpsert("__super__", "hf_master_exercises", EX);
        } catch {}
      }
      setLoadingEx(false);
    })();
  }, []);

  const save = async (updated) => {
    setExercises(updated);
    await supabaseUpsert("__super__", "hf_master_exercises", updated);
  };

  const handleSaveExercise = async (ex) => {
    if (editEx) {
      const updated = exercises.map(e => e.n === editEx.n && e.p === editEx.p ? ex : e);
      await save(updated);
    } else {
      await save([...exercises, ex]);
    }
    setEditEx(null);
    setShowAdd(false);
    setToast("Exercise saved");
    setTimeout(() => setToast(""), 2000);
  };

  const handleDelete = async (ex) => {
    if (!window.confirm(`Delete "${ex.n}"?`)) return;
    await save(exercises.filter(e => !(e.n === ex.n && e.p === ex.p)));
    setToast("Exercise deleted");
    setTimeout(() => setToast(""), 2000);
  };

  const pushToGym = async (gymId) => {
    await supabaseUpsert(gymId, "hf_ex", exercises);
    setToast(`Library pushed to ${gymId}`);
    setTimeout(() => setToast(""), 2000);
  };

  const pushToAll = async () => {
    if (!window.confirm(`Push the master exercise library to ALL ${registry.length} locations?`)) return;
    for (const gym of registry) {
      await supabaseUpsert(gym.gymId, "hf_ex", exercises);
    }
    setToast(`Library pushed to ${registry.length} locations`);
    setTimeout(() => setToast(""), 3000);
  };

  const filtered = exercises.filter(ex => {
    if (filterPat !== "All" && ex.p !== filterPat) return false;
    if (search && !ex.n.toLowerCase().includes(search.toLowerCase()) && !ex.m?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid " + B.border, background: B.darker || B.dark, color: B.text, fontSize: 13, outline: "none", boxSizing: "border-box" };

  if (loadingEx) return <div style={{ textAlign: "center", padding: 40, color: B.dim }}>Loading exercise library...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: B.text }}>Master Exercise Library</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: B.muted }}>{exercises.length} exercises — this is the default library available to all locations</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowAdd(true)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Exercise</button>
          <button onClick={pushToAll} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + B.accent, background: "transparent", color: B.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Push to All Locations</button>
        </div>
      </div>

      {/* Push to individual gym */}
      {registry.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: B.muted }}>Push to:</span>
          {registry.map(g => (
            <button key={g.gymId} onClick={() => pushToGym(g.gymId)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{g.gymName || g.gymId}</button>
          ))}
        </div>
      )}

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises..." style={{ ...inputStyle, maxWidth: 300 }} />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PATS.map(p => (
            <button key={p} onClick={() => setFilterPat(p)} style={{
              padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              background: filterPat === p ? (PC[p] || B.accent) : B.dark,
              color: filterPat === p ? "#fff" : B.muted,
            }}>{p} {p !== "All" && <span style={{ opacity: 0.6 }}>({exercises.filter(e => e.p === p).length})</span>}</button>
          ))}
        </div>
      </div>

      {/* Exercise list */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 8 }}>
        {filtered.slice(0, 100).map((ex, i) => (
          <div key={i} style={{ background: B.card, borderRadius: 10, border: "1px solid " + (PC[ex.p] || B.border) + "25", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 32, borderRadius: 2, background: PC[ex.p] || B.dim, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: B.text, fontSize: 13, fontWeight: 600 }}>{ex.n}</div>
              <div style={{ color: B.dim, fontSize: 11 }}>{ex.p} · {ex.m} · {ex.e}</div>
              {ex.g && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#a855f720", color: "#a855f7" }}>GIF</span>}
            </div>
            <button onClick={() => setEditEx(ex)} style={{ padding: "4px 8px", borderRadius: 5, border: "none", background: "#3b82f630", color: "#6ea8fe", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Edit</button>
            <button onClick={() => handleDelete(ex)} style={{ padding: "4px 8px", borderRadius: 5, border: "none", background: B.red + "20", color: B.red, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>x</button>
          </div>
        ))}
      </div>
      {filtered.length > 100 && <p style={{ color: B.dim, fontSize: 12, textAlign: "center", marginTop: 12 }}>Showing 100 of {filtered.length}</p>}

      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: B.accent, color: "#fff", padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>{toast}</div>}

      {(showAdd || editEx) && (
        <ExerciseForm
          key={editEx ? `${editEx.n}|${editEx.p}` : "add"}
          B={B}
          PATS={PATS}
          inputStyle={inputStyle}
          ex={editEx}
          onSave={handleSaveExercise}
          onCancel={() => { setEditEx(null); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function ExerciseForm({ B, PATS, inputStyle, ex, onSave, onCancel }) {
  const [f, setF] = useState(ex || { n: "", p: "Squat", m: "Quads/Glutes", e: "BW", u: "", g: "", c: "" });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }} onClick={onCancel}>
      <div style={{ background: B.card, borderRadius: 14, padding: 24, width: 440, maxWidth: "95vw", maxHeight: "85vh", overflow: "auto", border: "1px solid " + B.border }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: B.text }}>{ex ? "Edit Exercise" : "Add Exercise"}</h3>
        <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: B.muted, marginBottom: 4, fontWeight: 600 }}>Name</div><input style={inputStyle} value={f.n} onChange={e => setF(p => ({ ...p, n: e.target.value }))} /></div>
        <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: B.muted, marginBottom: 4, fontWeight: 600 }}>Pattern</div><select style={{ ...inputStyle, cursor: "pointer" }} value={f.p} onChange={e => setF(p => ({ ...p, p: e.target.value }))}>{PATS.filter(x => x !== "All").map(x => <option key={x}>{x}</option>)}</select></div>
        <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: B.muted, marginBottom: 4, fontWeight: 600 }}>Muscle Group</div><input style={inputStyle} value={f.m} onChange={e => setF(p => ({ ...p, m: e.target.value }))} /></div>
        <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: B.muted, marginBottom: 4, fontWeight: 600 }}>Equipment</div><input style={inputStyle} value={f.e} onChange={e => setF(p => ({ ...p, e: e.target.value }))} /></div>
        <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: B.muted, marginBottom: 4, fontWeight: 600 }}>YouTube URL</div><input style={inputStyle} value={f.u} onChange={e => setF(p => ({ ...p, u: e.target.value }))} placeholder="https://youtube.com/watch?v=..." /></div>
        <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: B.muted, marginBottom: 4, fontWeight: 600 }}>GIF URL</div><input style={inputStyle} value={f.g || ""} onChange={e => setF(p => ({ ...p, g: e.target.value }))} placeholder="https://example.com/demo.gif" /></div>
        <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: B.muted, marginBottom: 4, fontWeight: 600 }}>Coaching Cues</div><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} value={f.c} onChange={e => setF(p => ({ ...p, c: e.target.value }))} placeholder="1. Cue one. 2. Cue two." /></div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={() => { if (!f.n.trim()) return; onSave(f); }} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
