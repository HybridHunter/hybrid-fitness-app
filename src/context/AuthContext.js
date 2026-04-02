import { createContext, useContext, useState, useEffect } from "react";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Roles: "admin" (full access), "coach" (coaching tools), "client" (client portal)
// Demo accounts stored in localStorage "hf_users":
// { id, username, password, role, memberId (for clients, links to member record), displayName }

const DEFAULT_USERS = [
  { id: "u1", username: "admin", password: "admin123", role: "admin", memberId: null, displayName: "Gym Owner" },
  { id: "u2", username: "coach", password: "coach123", role: "coach", memberId: null, displayName: "Coach Mike" },
  { id: "u3", username: "coach2", password: "coach123", role: "coach", memberId: null, displayName: "Coach Sarah" },
  // Client accounts will be created from member data - use email as username, PIN as password
];

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(() => {
    try { const u = localStorage.getItem("hf_users"); return u ? JSON.parse(u) : DEFAULT_USERS; }
    catch { return DEFAULT_USERS; }
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try { const s = localStorage.getItem("hf_session"); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });

  useEffect(() => { localStorage.setItem("hf_users", JSON.stringify(users)); }, [users]);
  useEffect(() => {
    if (currentUser) localStorage.setItem("hf_session", JSON.stringify(currentUser));
    else localStorage.removeItem("hf_session");
  }, [currentUser]);

  const login = (username, password) => {
    // Check staff accounts
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

  const addUser = (user) => setUsers(prev => [...prev, { id: "u_" + Date.now(), ...user }]);
  const removeUser = (id) => setUsers(prev => prev.filter(u => u.id !== id));

  return (
    <AuthCtx.Provider value={{ currentUser, login, logout, isAdmin, isCoach, isClient, isStaff, users, addUser, removeUser }}>
      {children}
    </AuthCtx.Provider>
  );
}
