import { useLocalStorage } from "./useLocalStorage";

// Event types: "join", "cancel", "freeze", "unfreeze", "upgrade", "downgrade", "plan_change"
// Each event: { id, memberId, memberName, type, date: ISO, details: { oldPlan, newPlan, oldStatus, newStatus, oldPrice, newPrice } }

function generateDemoEvents() {
  const events = [];
  const now = new Date(2026, 3, 1); // April 1, 2026

  // Helper to create a date N days ago from "now"
  const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60));
    return d.toISOString();
  };

  const id = () => crypto.randomUUID();

  // ── JOINS (13 across 3 months) ──
  // Month 1 (Jan/~90 days ago): 5 joins
  events.push({ id: id(), memberId: "demo_join_1", memberName: "Sarah Johnson", type: "join", date: daysAgo(88), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_2", memberName: "Lisa Park", type: "join", date: daysAgo(85), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_3", memberName: "Carlos Rivera", type: "join", date: daysAgo(80), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_4", memberName: "Amy Nguyen", type: "join", date: daysAgo(76), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_5", memberName: "Derek Foster", type: "join", date: daysAgo(72), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });

  // Month 2 (Feb/~60 days ago): 4 joins
  events.push({ id: id(), memberId: "demo_join_6", memberName: "Mike Chen", type: "join", date: daysAgo(58), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_7", memberName: "Tanya Brooks", type: "join", date: daysAgo(52), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_8", memberName: "Jordan Lee", type: "join", date: daysAgo(47), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_9", memberName: "Priya Sharma", type: "join", date: daysAgo(42), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });

  // Month 3 (Mar/~30 days ago): 4 joins
  events.push({ id: id(), memberId: "demo_join_10", memberName: "Tom Baker", type: "join", date: daysAgo(28), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_11", memberName: "Emily Rodriguez", type: "join", date: daysAgo(22), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_12", memberName: "David Martinez", type: "join", date: daysAgo(15), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_13", memberName: "Hannah Cole", type: "join", date: daysAgo(8), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });

  // ── CANCELLATIONS (16 across 3 months) ──
  // Month 1: 6 cancels
  events.push({ id: id(), memberId: "demo_cancel_1", memberName: "Rachel Kim", type: "cancel", date: daysAgo(87), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_2", memberName: "Greg Holloway", type: "cancel", date: daysAgo(82), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_3", memberName: "Nina Patel", type: "cancel", date: daysAgo(79), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_4", memberName: "Brad Stone", type: "cancel", date: daysAgo(75), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_5", memberName: "Jess Lin", type: "cancel", date: daysAgo(73), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_6", memberName: "Tyler Grant", type: "cancel", date: daysAgo(70), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });

  // Month 2: 5 cancels
  events.push({ id: id(), memberId: "demo_cancel_7", memberName: "Morgan Fields", type: "cancel", date: daysAgo(56), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_8", memberName: "Ashley Dunn", type: "cancel", date: daysAgo(50), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_9", memberName: "Kyle Murphy", type: "cancel", date: daysAgo(45), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_10", memberName: "Danielle Ross", type: "cancel", date: daysAgo(41), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_11", memberName: "Eric Walsh", type: "cancel", date: daysAgo(38), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });

  // Month 3: 5 cancels
  events.push({ id: id(), memberId: "demo_cancel_12", memberName: "Samantha Cruz", type: "cancel", date: daysAgo(26), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_13", memberName: "Victor Reyes", type: "cancel", date: daysAgo(20), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_14", memberName: "Megan Hart", type: "cancel", date: daysAgo(14), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_15", memberName: "Chris Lowe", type: "cancel", date: daysAgo(9), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_16", memberName: "Brittany Owens", type: "cancel", date: daysAgo(4), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });

  // ── FREEZES (9 freeze events) ──
  events.push({ id: id(), memberId: "demo_freeze_1", memberName: "James Williams", type: "freeze", date: daysAgo(84), details: { oldStatus: "active", newStatus: "frozen", reason: "Knee surgery recovery" } });
  events.push({ id: id(), memberId: "demo_freeze_2", memberName: "Amy Nguyen", type: "freeze", date: daysAgo(68), details: { oldStatus: "active", newStatus: "frozen", reason: "Travel" } });
  events.push({ id: id(), memberId: "demo_freeze_3", memberName: "Carlos Rivera", type: "freeze", date: daysAgo(60), details: { oldStatus: "active", newStatus: "frozen", reason: "Work schedule conflict" } });
  events.push({ id: id(), memberId: "demo_freeze_4", memberName: "Tanya Brooks", type: "freeze", date: daysAgo(48), details: { oldStatus: "active", newStatus: "frozen", reason: "Vacation" } });
  events.push({ id: id(), memberId: "demo_freeze_5", memberName: "Derek Foster", type: "freeze", date: daysAgo(40), details: { oldStatus: "active", newStatus: "frozen", reason: "Injury" } });
  events.push({ id: id(), memberId: "demo_freeze_6", memberName: "Priya Sharma", type: "freeze", date: daysAgo(33), details: { oldStatus: "active", newStatus: "frozen", reason: "Personal" } });
  events.push({ id: id(), memberId: "demo_freeze_7", memberName: "Jordan Lee", type: "freeze", date: daysAgo(25), details: { oldStatus: "active", newStatus: "frozen", reason: "Medical" } });
  events.push({ id: id(), memberId: "demo_freeze_8", memberName: "Sarah Johnson", type: "freeze", date: daysAgo(18), details: { oldStatus: "active", newStatus: "frozen", reason: "Travel" } });
  events.push({ id: id(), memberId: "demo_freeze_9", memberName: "Tom Baker", type: "freeze", date: daysAgo(10), details: { oldStatus: "active", newStatus: "frozen", reason: "Family emergency" } });

  // ── UNFREEZES (9 unfreeze events — some overlap with freezes above) ──
  events.push({ id: id(), memberId: "demo_freeze_1", memberName: "James Williams", type: "unfreeze", date: daysAgo(55), details: { oldStatus: "frozen", newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_freeze_2", memberName: "Amy Nguyen", type: "unfreeze", date: daysAgo(50), details: { oldStatus: "frozen", newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_freeze_3", memberName: "Carlos Rivera", type: "unfreeze", date: daysAgo(43), details: { oldStatus: "frozen", newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_freeze_4", memberName: "Tanya Brooks", type: "unfreeze", date: daysAgo(35), details: { oldStatus: "frozen", newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_freeze_5", memberName: "Derek Foster", type: "unfreeze", date: daysAgo(28), details: { oldStatus: "frozen", newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_freeze_6", memberName: "Priya Sharma", type: "unfreeze", date: daysAgo(21), details: { oldStatus: "frozen", newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_freeze_7", memberName: "Jordan Lee", type: "unfreeze", date: daysAgo(14), details: { oldStatus: "frozen", newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_freeze_8", memberName: "Sarah Johnson", type: "unfreeze", date: daysAgo(7), details: { oldStatus: "frozen", newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_freeze_9", memberName: "Tom Baker", type: "unfreeze", date: daysAgo(3), details: { oldStatus: "frozen", newStatus: "active" } });

  // ── UPGRADE (1) ──
  events.push({ id: id(), memberId: "demo_join_2", memberName: "Lisa Park", type: "upgrade", date: daysAgo(30), details: { oldPlan: "3x/Week", newPlan: "Unlimited", oldPrice: 149, newPrice: 199 } });

  // ── DOWNGRADE (1) ──
  events.push({ id: id(), memberId: "demo_join_8", memberName: "Jordan Lee", type: "downgrade", date: daysAgo(16), details: { oldPlan: "Unlimited", newPlan: "3x/Week", oldPrice: 199, newPrice: 149 } });

  return events;
}

export function useMembershipEvents() {
  const [events, setEvents] = useLocalStorage("hf_membership_events", generateDemoEvents());

  const logEvent = (memberId, memberName, type, details = {}) => {
    setEvents(prev => [...prev, {
      id: crypto.randomUUID(),
      memberId,
      memberName,
      type,
      date: new Date().toISOString(),
      details,
    }]);
  };

  return { events, logEvent, setEvents };
}
