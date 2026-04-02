import { createContext, useContext, useState, useEffect } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Only superadmin is forced — everything else is user-managed
const PROTECTED_USERS = [
  { id: "u0", username: "superadmin", password: "gymkit2026", role: "admin", memberId: null, displayName: "GymKit Super Admin", isSuperAdmin: true },
];

const DEFAULT_USERS = [
  ...PROTECTED_USERS,
  { id: "u1", username: "hunter", password: "hybrid123", role: "admin", memberId: null, displayName: "Hunter Grindle", gymId: "hybrid-fitness" },
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

  const login = (username, password) => {
    // Check staff accounts (includes defaults)
    let user = users.find(u => u.username === username && u.password === password);
    if (user) { setCurrentUser(user); return { success: true, user }; }

    // Check member accounts (email as username, PIN as password)
    try {
      const members = JSON.parse(localStorage.getItem("hf_members") || "[]");
      const member = members.find(m => m.email === username && m.pin === password);
      if (member) {
        const clientUser = { id: "client_" + member.id, username: member.email, role: "client", memberId: member.id, displayName: member.firstName + " " + member.lastName };
        setCurrentUser(clientUser);
        return { success: true, user: clientUser };
      }
    } catch {}

    return { success: false, error: "Invalid credentials" };
  };

  const logout = () => setCurrentUser(null);
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
