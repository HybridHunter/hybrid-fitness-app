import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useLocalStorage, healValue } from "../hooks/useLocalStorage";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Only superadmin is forced — everything else is user-managed
const PROTECTED_USERS = [
  { id: "u0", username: "Hunter@HybridFitnessGym.com", email: "Hunter@HybridFitnessGym.com", password: "13RichSquared11!!", role: "admin", memberId: null, displayName: "Hunter Grindle", isSuperAdmin: true },
];

const DEFAULT_USERS = [
  ...PROTECTED_USERS,
];

// Only force-merge protected accounts (superadmin). Everything else is deletable.
function mergeUsers(stored) {
  if (!Array.isArray(stored)) return DEFAULT_USERS;
  const merged = [...stored];
  PROTECTED_USERS.forEach(p => {
    if (!merged.find(m => m.username === p.username)) {
      merged.push(p);
    }
  });
  return merged;
}

export function AuthProvider({ children }) {
  const [storedUsers, setStoredUsers] = useLocalStorage("hf_users", DEFAULT_USERS);
  const [session, setSession] = useLocalStorage("hf_session", null);
  // Gym the hf_users hook fetched under — after an in-app gym switch, writing
  // through it would push the OLD gym's users into the NEW gym's row (E5)
  const usersGymRef = useRef(localStorage.getItem("hf_gym_id") || "default");
  const usersGymMatches = () => {
    const now = localStorage.getItem("hf_gym_id") || "default";
    if (now !== usersGymRef.current) {
      console.warn(`Skipping hf_users write: gym context changed (${usersGymRef.current} → ${now}); reload first`);
      return false;
    }
    return true;
  };

  // Always have default accounts available
  const users = mergeUsers(storedUsers);

  const [currentUser, setCurrentUser] = useState(session);

  // Sync session to storage
  useEffect(() => {
    setSession(currentUser);
  }, [currentUser, setSession]);

  const login = async (emailOrUsername, password) => {
    // E9: never match on empty passwords/PINs (members saved without a PIN
    // would otherwise be loggable-into with a blank password)
    if (!password || !String(password).trim()) {
      return { success: false, error: "Invalid credentials" };
    }
    // Check local staff accounts — match by email or username
    const input = emailOrUsername.toLowerCase().trim();
    let user = users.find(u => (u.email?.toLowerCase() === input || u.username?.toLowerCase() === input) && u.password === password);
    if (user) {
      if (user.isSuperAdmin) {
        // Super admin operates outside any gym — use __super__ context
        localStorage.setItem("hf_gym_id", "__super__");
      } else if (user.gymId) {
        localStorage.setItem("hf_gym_id", user.gymId);
      }
      setCurrentUser(user);
      return { success: true, user };
    }

    // Check Supabase for users from other gyms
    try {
      const SUPABASE_URL = 'https://qzvxnklyeadbroesccxt.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM';

      // Search all gyms' user lists in Supabase
      const res = await fetch(`${SUPABASE_URL}/rest/v1/data_store?key=eq.hf_users&select=gym_id,value`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const rows = await res.json();
        for (const row of rows) {
          const rowVal = healValue(row.value);
          const gymUsers = Array.isArray(rowVal) ? rowVal : [];
          const found = gymUsers.find(u => (u.email?.toLowerCase() === input || u.username?.toLowerCase() === input) && u.password === password);
          if (found) {
            // Set gym context to this user's gym
            localStorage.setItem("hf_gym_id", row.gym_id);
            // Clear local data caches so the hook fetches fresh data for this gym
            const keysToKeep = ["hf_theme", "hf_session", "hf_users", "hf_gym_id", "hf_onboarding_complete"];
            Object.keys(localStorage).filter(k => k.startsWith("hf_") && !keysToKeep.includes(k)).forEach(k => localStorage.removeItem(k));
            const gymUser = { ...found, gymId: row.gym_id };
            // N7: persist the session synchronously so the hard redirect finds it.
            // Deliberately NOT calling setCurrentUser here (E5): our hooks were
            // mounted under the old gym; state writes before the reload would
            // leak the old gym's data into the new gym's rows.
            localStorage.setItem("hf_session", JSON.stringify(gymUser));
            return { success: true, user: gymUser, requiresReload: true };
          }
        }
      }
    } catch (e) { console.log("Supabase user lookup failed:", e); }

    // Skip local member check — always search Supabase for members to ensure correct gym_id

    // Search Supabase member lists across all gyms
    try {
      const SUPABASE_URL = 'https://qzvxnklyeadbroesccxt.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM';

      const res = await fetch(`${SUPABASE_URL}/rest/v1/data_store?key=eq.hf_members&select=gym_id,value`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const rows = await res.json();
        for (const row of rows) {
          const rowVal = healValue(row.value);
          const gymMembers = Array.isArray(rowVal) ? rowVal : [];
          const found = gymMembers.find(m => m.email?.toLowerCase() === input && m.pin === password);
          if (found) {
            localStorage.setItem("hf_gym_id", row.gym_id);
            // Pre-cache members so client portal loads instantly
            localStorage.setItem("hf_members", JSON.stringify(gymMembers));
            // Clear other gym data
            const keysToKeep = ["hf_theme", "hf_session", "hf_users", "hf_gym_id", "hf_onboarding_complete", "hf_members"];
            Object.keys(localStorage).filter(k => k.startsWith("hf_") && !keysToKeep.includes(k)).forEach(k => localStorage.removeItem(k));
            const clientUser = { id: "client_" + found.id, username: found.email, role: "client", memberId: found.id, displayName: found.firstName + " " + found.lastName, gymId: row.gym_id };
            // N7/E5: persist synchronously for the hard redirect; skip setCurrentUser
            localStorage.setItem("hf_session", JSON.stringify(clientUser));
            return { success: true, user: clientUser, requiresReload: true };
          }
        }
      }
    } catch (e) { console.log("Supabase member lookup failed:", e); }

    return { success: false, error: "Invalid credentials" };
  };

  const logout = () => {
    setCurrentUser(null);
    // E6: clear any leftover impersonation state so it can't leak into the next session
    localStorage.removeItem("hf_impersonating");
    localStorage.removeItem("hf_gym_id_backup");
    localStorage.removeItem("hf_session_backup");
    // Reset to default gym
    localStorage.setItem("hf_gym_id", "default");
  };
  const isAdmin = currentUser?.role === "admin";
  const isCoach = currentUser?.role === "coach";
  const isClient = currentUser?.role === "client";
  const isStaff = isAdmin || isCoach;

  const addUser = (user) => {
    if (!usersGymMatches()) return;
    setStoredUsers(prev => [...(Array.isArray(prev) ? prev : []), { id: "u_" + Date.now(), ...user }]);
  };
  const removeUser = (id) => {
    if (!usersGymMatches()) return;
    setStoredUsers(prev => (Array.isArray(prev) ? prev : []).filter(u => u.id !== id));
  };
  const updateUser = (id, updates) => {
    if (!usersGymMatches()) return;
    setStoredUsers(prev => (Array.isArray(prev) ? prev : []).map(u => u.id === id ? { ...u, ...updates } : u));
    if (currentUser?.id === id) setCurrentUser(prev => ({ ...prev, ...updates }));
  };

  return (
    <AuthCtx.Provider value={{ currentUser, login, logout, isAdmin, isCoach, isClient, isStaff, users, addUser, removeUser, updateUser }}>
      {children}
    </AuthCtx.Provider>
  );
}
