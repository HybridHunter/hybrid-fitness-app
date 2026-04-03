import { createContext, useContext, useState, useEffect } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Only superadmin is forced — everything else is user-managed
const PROTECTED_USERS = [
  { id: "u0", username: "superadmin", email: "admin@gymkit.io", password: "gymkit2026", role: "admin", memberId: null, displayName: "GymKit Super Admin", isSuperAdmin: true },
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

  // Always have default accounts available
  const users = mergeUsers(storedUsers);

  const [currentUser, setCurrentUser] = useState(session);

  // Sync session to storage
  useEffect(() => {
    setSession(currentUser);
  }, [currentUser, setSession]);

  const login = async (emailOrUsername, password) => {
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
          const gymUsers = Array.isArray(row.value) ? row.value : [];
          const found = gymUsers.find(u => (u.email?.toLowerCase() === input || u.username?.toLowerCase() === input) && u.password === password);
          if (found) {
            // Set gym context to this user's gym
            localStorage.setItem("hf_gym_id", row.gym_id);
            // Clear local data caches so the hook fetches fresh data for this gym
            const keysToKeep = ["hf_theme", "hf_session", "hf_users", "hf_gym_id", "hf_onboarding_complete"];
            Object.keys(localStorage).filter(k => k.startsWith("hf_") && !keysToKeep.includes(k)).forEach(k => localStorage.removeItem(k));
            const gymUser = { ...found, gymId: row.gym_id };
            setCurrentUser(gymUser);
            return { success: true, user: gymUser, requiresReload: true };
          }
        }
      }
    } catch (e) { console.log("Supabase user lookup failed:", e); }

    // Check member accounts (email + PIN) — search local first, then Supabase
    try {
      const localMembers = JSON.parse(localStorage.getItem("hf_members") || "[]");
      const localMember = localMembers.find(m => m.email?.toLowerCase() === input && m.pin === password);
      if (localMember) {
        const gymId = localStorage.getItem("hf_gym_id") || "default";
        const clientUser = { id: "client_" + localMember.id, username: localMember.email, role: "client", memberId: localMember.id, displayName: localMember.firstName + " " + localMember.lastName, gymId };
        setCurrentUser(clientUser);
        return { success: true, user: clientUser };
      }
    } catch {}

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
          const gymMembers = Array.isArray(row.value) ? row.value : [];
          const found = gymMembers.find(m => m.email?.toLowerCase() === input && m.pin === password);
          if (found) {
            localStorage.setItem("hf_gym_id", row.gym_id);
            // Pre-cache members so client portal loads instantly
            localStorage.setItem("hf_members", JSON.stringify(gymMembers));
            // Clear other gym data
            const keysToKeep = ["hf_theme", "hf_session", "hf_users", "hf_gym_id", "hf_onboarding_complete", "hf_members"];
            Object.keys(localStorage).filter(k => k.startsWith("hf_") && !keysToKeep.includes(k)).forEach(k => localStorage.removeItem(k));
            const clientUser = { id: "client_" + found.id, username: found.email, role: "client", memberId: found.id, displayName: found.firstName + " " + found.lastName, gymId: row.gym_id };
            setCurrentUser(clientUser);
            return { success: true, user: clientUser, requiresReload: true };
          }
        }
      }
    } catch (e) { console.log("Supabase member lookup failed:", e); }

    return { success: false, error: "Invalid credentials" };
  };

  const logout = () => {
    setCurrentUser(null);
    // Reset to default gym
    localStorage.setItem("hf_gym_id", "default");
  };
  const isAdmin = currentUser?.role === "admin";
  const isCoach = currentUser?.role === "coach";
  const isClient = currentUser?.role === "client";
  const isStaff = isAdmin || isCoach;

  const addUser = (user) => setStoredUsers(prev => [...(Array.isArray(prev) ? prev : []), { id: "u_" + Date.now(), ...user }]);
  const removeUser = (id) => setStoredUsers(prev => (Array.isArray(prev) ? prev : []).filter(u => u.id !== id));
  const updateUser = (id, updates) => {
    setStoredUsers(prev => (Array.isArray(prev) ? prev : []).map(u => u.id === id ? { ...u, ...updates } : u));
    if (currentUser?.id === id) setCurrentUser(prev => ({ ...prev, ...updates }));
  };

  return (
    <AuthCtx.Provider value={{ currentUser, login, logout, isAdmin, isCoach, isClient, isStaff, users, addUser, removeUser, updateUser }}>
      {children}
    </AuthCtx.Provider>
  );
}
