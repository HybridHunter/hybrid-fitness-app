import { useLocalStorage } from "./useLocalStorage";

// Event types: "join", "cancel", "freeze", "unfreeze", "upgrade", "downgrade", "plan_change"
// Each event: { id, memberId, memberName, type, date: ISO, details: { oldPlan, newPlan, oldStatus, newStatus, oldPrice, newPrice } }

// Version key — bump this to force demo data regeneration
const DEMO_DATA_VERSION = 2;

function generateDemoEvents() {
  const events = [];
  const now = new Date();

  // Helper to create a date N days ago from now
  const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60));
    return d.toISOString();
  };

  const id = () => crypto.randomUUID();

  // ── JOINS ──
  // ~90 days ago (2 months back): 4 joins
  events.push({ id: id(), memberId: "demo_join_1", memberName: "Sarah Johnson", type: "join", date: daysAgo(85), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_2", memberName: "Lisa Park", type: "join", date: daysAgo(80), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_3", memberName: "Carlos Rivera", type: "join", date: daysAgo(76), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_4", memberName: "Amy Nguyen", type: "join", date: daysAgo(72), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });

  // ~60 days ago (1 month back): 3 joins
  events.push({ id: id(), memberId: "demo_join_5", memberName: "Derek Foster", type: "join", date: daysAgo(55), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_6", memberName: "Mike Chen", type: "join", date: daysAgo(48), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_7", memberName: "Tanya Brooks", type: "join", date: daysAgo(42), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });

  // Current month (within last ~28 days): 4 joins
  events.push({ id: id(), memberId: "demo_join_8", memberName: "Jordan Lee", type: "join", date: daysAgo(22), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_9", memberName: "Priya Sharma", type: "join", date: daysAgo(15), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_10", memberName: "Tom Baker", type: "join", date: daysAgo(8), details: { newPlan: "Unlimited", newPrice: 199, newStatus: "active" } });
  events.push({ id: id(), memberId: "demo_join_11", memberName: "Hannah Cole", type: "join", date: daysAgo(3), details: { newPlan: "3x/Week", newPrice: 149, newStatus: "active" } });

  // ── CANCELLATIONS ──
  // ~90 days ago: 3 cancels
  events.push({ id: id(), memberId: "demo_cancel_1", memberName: "Rachel Kim", type: "cancel", date: daysAgo(82), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_2", memberName: "Greg Holloway", type: "cancel", date: daysAgo(78), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_3", memberName: "Nina Patel", type: "cancel", date: daysAgo(73), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });

  // ~60 days ago: 2 cancels
  events.push({ id: id(), memberId: "demo_cancel_4", memberName: "Brad Stone", type: "cancel", date: daysAgo(52), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_5", memberName: "Jess Lin", type: "cancel", date: daysAgo(45), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });

  // Current month: 2 cancels
  events.push({ id: id(), memberId: "demo_cancel_6", memberName: "Tyler Grant", type: "cancel", date: daysAgo(18), details: { oldPlan: "3x/Week", oldPrice: 149, oldStatus: "active", newStatus: "inactive" } });
  events.push({ id: id(), memberId: "demo_cancel_7", memberName: "Morgan Fields", type: "cancel", date: daysAgo(5), details: { oldPlan: "Unlimited", oldPrice: 199, oldStatus: "active", newStatus: "inactive" } });

  // ── FREEZES ──
  // Previous months: 2 freezes
  events.push({ id: id(), memberId: "demo_freeze_1", memberName: "James Williams", type: "freeze", date: daysAgo(70), details: { oldStatus: "active", newStatus: "frozen", reason: "Knee surgery recovery" } });
  events.push({ id: id(), memberId: "demo_freeze_2", memberName: "Amy Nguyen", type: "freeze", date: daysAgo(50), details: { oldStatus: "active", newStatus: "frozen", reason: "Travel" } });

  // Current month: 1 freeze
  events.push({ id: id(), memberId: "demo_freeze_3", memberName: "Carlos Rivera", type: "freeze", date: daysAgo(10), details: { oldStatus: "active", newStatus: "frozen", reason: "Work schedule conflict" } });

  // ── UNFREEZES ──
  // Previous months: 1 unfreeze
  events.push({ id: id(), memberId: "demo_freeze_1", memberName: "James Williams", type: "unfreeze", date: daysAgo(40), details: { oldStatus: "frozen", newStatus: "active" } });

  // Current month: 1 unfreeze
  events.push({ id: id(), memberId: "demo_freeze_2", memberName: "Amy Nguyen", type: "unfreeze", date: daysAgo(6), details: { oldStatus: "frozen", newStatus: "active" } });

  // ── UPGRADE (1 this month) ──
  events.push({ id: id(), memberId: "demo_join_2", memberName: "Lisa Park", type: "upgrade", date: daysAgo(12), details: { oldPlan: "3x/Week", newPlan: "Unlimited", oldPrice: 149, newPrice: 199 } });

  // ── DOWNGRADE (1 last month) ──
  events.push({ id: id(), memberId: "demo_join_6", memberName: "Mike Chen", type: "downgrade", date: daysAgo(38), details: { oldPlan: "Unlimited", newPlan: "3x/Week", oldPrice: 199, newPrice: 149 } });

  return events.map(e => ({ ...e, _demo: true }));
}

export function useMembershipEvents() {
  const [events, setEvents] = useLocalStorage("hf_membership_events", () => generateDemoEvents());
  const [demoVersion, setDemoVersion] = useLocalStorage("hf_membership_events_version", DEMO_DATA_VERSION);

  // If the stored demo version is outdated, regenerate demo data
  if (demoVersion !== DEMO_DATA_VERSION) {
    const fresh = generateDemoEvents();
    // Use setTimeout to avoid calling setState during render
    setTimeout(() => {
      setEvents(fresh);
      setDemoVersion(DEMO_DATA_VERSION);
    }, 0);
  }

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
