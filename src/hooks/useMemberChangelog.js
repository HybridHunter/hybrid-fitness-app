import { useLocalStorage } from "./useLocalStorage";
import { useAuth } from "../context/AuthContext";

// Tracks all member changes with undo capability
// Each entry: { id, memberId, memberName, action, field, oldValue, newValue, date, changedBy, undone }

export function useMemberChangelog() {
  const [log, setLog] = useLocalStorage("hf_member_changelog", []);
  const { currentUser } = useAuth();

  const getChangedBy = () => {
    if (!currentUser) return "System";
    return currentUser.displayName || currentUser.username || currentUser.role || "Unknown";
  };

  const logChange = (memberId, memberName, action, field, oldValue, newValue) => {
    setLog(prev => [{
      id: crypto.randomUUID(),
      memberId,
      memberName,
      action,
      field,
      oldValue,
      newValue,
      date: new Date().toISOString(),
      changedBy: getChangedBy(),
      undone: false,
    }, ...prev].slice(0, 500));
  };

  const markUndone = (entryId) => {
    setLog(prev => prev.map(e => e.id === entryId ? { ...e, undone: true } : e));
  };

  const getLogForMember = (memberId) => log.filter(e => e.memberId === memberId);

  return { log, logChange, markUndone, getLogForMember };
}
