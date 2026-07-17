import { useLocalStorage } from "./useLocalStorage";

// Event types: "join", "cancel", "freeze", "unfreeze", "upgrade", "downgrade", "plan_change"
// Each event: { id, memberId, memberName, type, date: ISO, details: { oldPlan, newPlan, oldStatus, newStatus, oldPrice, newPrice } }


export function useMembershipEvents() {
  const [events, setEvents] = useLocalStorage("hf_membership_events", []);
  const getChangedBy = () => {
    try {
      const session = JSON.parse(localStorage.getItem("hf_session") || "null");
      if (!session) return "System";
      return session.displayName || session.username || session.role || "Unknown";
    } catch { return "System"; }
  };

  const logEvent = (memberId, memberName, type, details = {}) => {
    setEvents(prev => [...prev, {
      id: crypto.randomUUID(),
      memberId,
      memberName,
      type,
      date: new Date().toISOString(),
      details,
      changedBy: getChangedBy(),
    }]);
  };

  const removeLatestEvent = (memberId, type) => {
    setEvents(prev => {
      const idx = [...prev].reverse().findIndex(e => e.memberId === memberId && e.type === type);
      if (idx === -1) return prev;
      const actualIdx = prev.length - 1 - idx;
      return [...prev.slice(0, actualIdx), ...prev.slice(actualIdx + 1)];
    });
  };

  return { events, logEvent, setEvents, removeLatestEvent };
}
