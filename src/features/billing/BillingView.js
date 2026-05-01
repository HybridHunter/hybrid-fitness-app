import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useMembershipEvents } from "../../hooks/useMembershipEvents";
import Card from "../../components/ui/Card";
import PaymentModal from "../../components/shared/PaymentModal";
import { sendLocalNotification, getNotificationPrefs } from "../../utils/pushNotifications";

/* ── Default Plans ────────────────────────────────── */
const DEFAULT_PLANS = [
  { id: "plan_unlimited", name: "Unlimited", price: 199, billingCycle: "monthly", sessionsIncluded: null, description: "Full gym access with unlimited sessions", features: "Unlimited sessions,All equipment,Locker access", active: true, _demo: true },
  { id: "plan_3x", name: "3x/Week", price: 149, billingCycle: "monthly", sessionsIncluded: 12, description: "Perfect for consistent training", features: "12 sessions/month,All equipment,Locker access", active: true, _demo: true },
  { id: "plan_dropin", name: "Drop-In", price: 25, billingCycle: "per-session", sessionsIncluded: 1, description: "Single session access", features: "1 session,All equipment", active: true, _demo: true },
];

/* ── Demo Payments ── */
function buildDemoPayments() {
  const names = ["Sarah Johnson","Mike Chen","Emily Rodriguez","James Williams","Lisa Park","David Martinez","Tom Baker","Rachel Kim"];
  const plans = ["Unlimited","3x/Week","Drop-In","Unlimited","3x/Week","Drop-In","Unlimited","3x/Week"];
  const prices = [199,149,25,199,149,25,199,149];
  const methods = ["Card \u2022\u2022\u2022\u2022 4242","ACH","Card \u2022\u2022\u2022\u2022 8811","Cash","Card \u2022\u2022\u2022\u2022 5533","Check #1042","Card \u2022\u2022\u2022\u2022 4242","ACH"];
  const statuses = ["paid","paid","paid","paid","paid","overdue","paid","paid","pending","paid","overdue","paid","paid","pending","paid","paid","overdue","paid"];
  const rows = [];
  const today = new Date(2026, 3, 1);
  for (let i = 0; i < 18; i++) {
    const daysAgo = Math.floor((i / 18) * 90);
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const mi = i % names.length;
    rows.push({
      id: "pay_" + (i + 1),
      date: d.toISOString().slice(0, 10),
      member: names[mi],
      plan: plans[mi],
      amount: prices[mi],
      status: statuses[i],
      method: methods[mi],
      _demo: true,
    });
  }
  return rows;
}

/* ── Helpers ── */
function getPaymentMethods() {
  try { return JSON.parse(localStorage.getItem("hf_payment_methods") || "[]"); } catch { return []; }
}

function getMemberPaymentMethods(memberId) {
  return getPaymentMethods().filter(m => m.memberId === memberId);
}

function getDefaultMethod(memberId) {
  const methods = getMemberPaymentMethods(memberId);
  return methods.find(m => m.isDefault) || methods[0] || null;
}

function getInitials(f, l) {
  return ((f?.[0] || "") + (l?.[0] || "")).toUpperCase();
}

function formatDate(d) {
  if (!d) return "---";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ── Badge Component ── */
function StatusBadge({ status, B }) {
  const colors = { paid: B.green, current: B.green, overdue: B.red, due: B.orange, pending: B.orange, refunded: B.purple || "#a855f7", refund: B.purple || "#a855f7", "no plan": B.dim };
  const bg = colors[status] || B.dim;
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700, color: "#fff", background: bg, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

/* ── KPI Card ── */
function KPI({ label, value, sub, B, color }) {
  return (
    <Card style={{ flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || B.text }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: B.dim, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

/* ── Plan Form Modal ── */
function PlanModal({ plan, onSave, onClose, B, schedule, allPlans }) {
  const [form, setForm] = useState(plan || { name: "", price: "", billingCycle: "monthly", sessionsIncluded: "", description: "", features: "", active: true, allowedSessionIds: [], allSessions: true });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 };
  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 14, padding: 28, width: 440, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: B.text, marginBottom: 20 }}>{plan ? "Edit Plan" : "New Plan"}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Plan Name</label>
            <input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Unlimited" />
          </div>
          <div>
            <label style={labelStyle}>Price ($)</label>
            <input style={inputStyle} type="number" min="0" value={form.price} onChange={e => set("price", e.target.value)} placeholder="199" />
          </div>
          <div>
            <label style={labelStyle}>Billing Cycle</label>
            <select style={{ ...inputStyle, cursor: "pointer" }} value={form.billingCycle} onChange={e => set("billingCycle", e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="every-4-weeks">Every 4 Weeks</option>
              <option value="annual">Annual</option>
              <option value="weekly">Weekly</option>
              <option value="per-session">Per Session</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Sessions Included</label>
            <input style={inputStyle} type="number" min="0" value={form.sessionsIncluded ?? ""} onChange={e => set("sessionsIncluded", e.target.value === "" ? null : Number(e.target.value))} placeholder="Blank = Unlimited" />
            {form.sessionsIncluded && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={!!form.allowCarryover} onChange={e => set("allowCarryover", e.target.checked)} style={{ width: 16, height: 16, accentColor: B.accent }} />
                <span style={{ fontSize: 13, color: B.text }}>Carry over unused sessions to next cycle</span>
              </label>
            )}
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} value={form.description || ""} onChange={e => set("description", e.target.value)} placeholder="Plan description..." />
          </div>
          <div>
            <label style={labelStyle}>Features (comma-separated)</label>
            <input style={inputStyle} value={form.features || ""} onChange={e => set("features", e.target.value)} placeholder="Unlimited sessions, All equipment, Locker access" />
          </div>
          {/* Allowed Sessions */}
          <div>
            <label style={labelStyle}>Allowed Sessions</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input type="checkbox" checked={form.allSessions !== false} onChange={e => { set("allSessions", e.target.checked); if (e.target.checked) set("allowedSessionIds", []); }} style={{ width: 16, height: 16, accentColor: B.accent, cursor: "pointer" }} />
              <label style={{ fontSize: 13, fontWeight: 600, color: B.text, cursor: "pointer" }}>All sessions (unlimited access)</label>
            </div>
            {!form.allSessions && (
              <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid " + B.border, borderRadius: 8, padding: 8, background: B.dark }}>
                {(schedule || []).length === 0 ? (
                  <div style={{ color: B.dim, fontSize: 12, padding: 8 }}>No sessions in schedule yet.</div>
                ) : (
                  (schedule || []).map(sess => {
                    const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
                    const checked = (form.allowedSessionIds || []).includes(sess.id);
                    const fmtT = (t) => { const [h,m] = (t||"").split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; };
                    return (
                      <label key={sess.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px", cursor: "pointer", fontSize: 13, color: B.text }}>
                        <input type="checkbox" checked={checked} onChange={e => {
                          const ids = form.allowedSessionIds || [];
                          set("allowedSessionIds", e.target.checked ? [...ids, sess.id] : ids.filter(id => id !== sess.id));
                        }} style={{ width: 15, height: 15, accentColor: B.accent }} />
                        {sess.name} - {dayNames[sess.dayOfWeek] || "?"} {fmtT(sess.startTime)}-{fmtT(sess.endTime)}
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {/* Duration */}
          <div>
            <label style={labelStyle}>Plan Duration</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select style={{ ...inputStyle, flex: 1, cursor: "pointer" }} value={form.durationType || "ongoing"} onChange={e => { set("durationType", e.target.value); if (e.target.value === "ongoing") { set("durationWeeks", ""); set("rolloverPlanId", ""); } }}>
                <option value="ongoing">Ongoing (no end date)</option>
                <option value="fixed">Fixed Duration</option>
              </select>
              {form.durationType === "fixed" && (
                <input style={{ ...inputStyle, width: 80 }} type="number" min="1" value={form.durationWeeks || ""} onChange={e => set("durationWeeks", e.target.value ? Number(e.target.value) : "")} placeholder="Weeks" />
              )}
              {form.durationType === "fixed" && <span style={{ fontSize: 13, color: B.muted, alignSelf: "center", whiteSpace: "nowrap" }}>weeks</span>}
            </div>
          </div>
          {/* Rollover / End Behavior */}
          {form.durationType === "fixed" && (
            <div>
              <label style={labelStyle}>When Plan Ends</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.endBehavior || "cancel"} onChange={e => { set("endBehavior", e.target.value); if (e.target.value !== "rollover") set("rolloverPlanId", ""); }}>
                <option value="cancel">Auto-cancel (remove plan)</option>
                <option value="rollover">Roll into another plan</option>
              </select>
              {form.endBehavior === "rollover" && (
                <select style={{ ...inputStyle, marginTop: 8, cursor: "pointer" }} value={form.rolloverPlanId || ""} onChange={e => set("rolloverPlanId", e.target.value)}>
                  <option value="">-- Select plan to roll into --</option>
                  {(allPlans || []).filter(p => p.active && p.id !== form.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ${p.price}/{p.billingCycle}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={!!form.isTrial} onChange={e => set("isTrial", e.target.checked)} style={{ width: 16, height: 16, accentColor: B.orange, cursor: "pointer" }} />
            <label style={{ fontSize: 13, fontWeight: 600, color: B.text, cursor: "pointer" }}>Trial Plan</label>
            <span style={{ fontSize: 11, color: B.muted }}> — members on this plan show as "trial" and don't count as new clients in analytics</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.active !== false} onChange={e => set("active", e.target.checked)} style={{ width: 16, height: 16, accentColor: B.accent, cursor: "pointer" }} />
            <label style={{ fontSize: 13, fontWeight: 600, color: B.text, cursor: "pointer" }}>Active</label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button onClick={() => { if (!form.name || !form.price) return; onSave({ ...form, price: Number(form.price), id: form.id || "plan_" + Date.now(), allowedSessionIds: form.allSessions ? [] : (form.allowedSessionIds || []), allSessions: form.allSessions !== false }); }} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Save Plan</button>
        </div>
      </div>
    </div>
  );
}

/* ── Settings Modal ── */
function SettingsModal({ onClose, B, recurringEnabled, setRecurringEnabled }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 14, padding: 28, width: 400, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: B.text, marginBottom: 20 }}>Billing Settings</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid " + B.border }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>Auto-charge on billing date</div>
            <div style={{ fontSize: 12, color: B.dim, marginTop: 2 }}>Automatically charge clients with saved payment methods on their billing date.</div>
          </div>
          <button
            onClick={() => setRecurringEnabled(!recurringEnabled)}
            style={{
              width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative", flexShrink: 0, marginLeft: 12,
              background: recurringEnabled ? B.green : (B.border || "#555"), transition: "background 0.2s",
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3,
              left: recurringEnabled ? 25 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Done</button>
        </div>
      </div>
    </div>
  );
}

/* ── Member History Modal ── */
function MemberHistoryModal({ memberName, payments, onClose, B }) {
  const memberPayments = payments.filter(p => p.member === memberName);
  const thStyle = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: "1px solid " + B.border };
  const tdStyle = { padding: "10px 14px", fontSize: 13, color: B.text, borderBottom: "1px solid " + B.border };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 14, padding: 28, width: 560, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: B.text }}>Payment History - {memberName}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: B.muted, padding: 4 }}>{"\u2715"}</button>
        </div>
        {memberPayments.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: B.dim, fontSize: 14 }}>No payment history found.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: B.darker }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Method</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {memberPayments.map(p => (
                <tr key={p.id}>
                  <td style={tdStyle}>{p.date}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>${p.amount}</td>
                  <td style={tdStyle}>{p.method}</td>
                  <td style={tdStyle}><StatusBadge status={p.status} B={B} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ==============================================================
   BILLING VIEW
   ============================================================== */
export default function BillingView() {
  const B = useTheme();
  const { members, updateMember } = useMembers();
  const [plans, setPlans] = useLocalStorage("hf_plans", []);
  const [payments, setPayments] = useLocalStorage("hf_payments", []);
  const [recurringEnabled, setRecurringEnabled] = useLocalStorage("hf_recurring_enabled", false);
  const [schedule] = useLocalStorage("hf_schedule", []);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [historyMember, setHistoryMember] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [pendingPlanChange, setPendingPlanChange] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [discountRules, setDiscountRules] = useLocalStorage("hf_payment_discounts", [
    { id: "disc_1", method: "ACH", discountType: "Percentage", value: 5, active: true },
  ]);
  const { logEvent } = useMembershipEvents();

  /* ── KPI Calculations ── */
  const kpi = useMemo(() => {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const monthPayments = payments.filter(p => p.date.startsWith(thisMonth) && p.status === "paid");
    const totalRevenue = monthPayments.reduce((s, p) => s + p.amount, 0);
    const allRevenue = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const activeCount = members.filter(m => m.membershipPlanId).length;
    const overdueCount = payments.filter(p => p.status === "overdue").length;
    const mrr = members.reduce((sum, m) => {
      if (!m.membershipPlanId) return sum;
      const plan = plans.find(p => p.id === m.membershipPlanId);
      if (!plan || plan.isTrial) return sum;
      if (plan.billingCycle === "monthly") return sum + plan.price;
      if (plan.billingCycle === "every-4-weeks") return sum + Math.round(plan.price * 13 / 12);
      if (plan.billingCycle === "annual") return sum + Math.round(plan.price / 12);
      if (plan.billingCycle === "weekly") return sum + Math.round(plan.price * 4.33);
      return sum;
    }, 0);
    return { totalRevenue, allRevenue, activeCount, overdueCount, mrr };
  }, [payments, members, plans]);

  /* ── Plan handlers ── */
  const savePlan = (p) => {
    setPlans(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = p; return copy; }
      return [...prev, p];
    });
    setShowPlanModal(false);
    setEditPlan(null);
  };
  const togglePlanActive = (id) => setPlans(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));

  /* ── Payment handlers ── */
  const markPaid = (id) => setPayments(prev => prev.map(p => p.id === id ? { ...p, status: "paid" } : p));
  const [refundTarget, setRefundTarget] = useState(null);
  const processRefund = (payment, refundAmount, reason) => {
    setPayments(prev => {
      const updated = prev.map(p => p.id === payment.id ? { ...p, status: "refunded", refundedAt: new Date().toISOString(), refundAmount, refundReason: reason } : p);
      // Add a refund record
      const refundRecord = {
        id: "ref_" + Date.now(),
        date: new Date().toISOString().slice(0, 10),
        member: payment.member,
        memberId: payment.memberId,
        plan: payment.plan,
        amount: -refundAmount,
        method: payment.method,
        status: "refund",
        originalPaymentId: payment.id,
        refundReason: reason,
      };
      return [refundRecord, ...updated];
    });
    setRefundTarget(null);
  };
  const sendReminder = (name) => alert("Reminder sent to " + name + "!");

  const handlePaymentSuccess = (detail) => {
    const target = paymentTarget;
    if (!target) return;
    if (target.paymentId) {
      markPaid(target.paymentId);
    } else {
      const methodLabel = detail.method === "cash" ? "Cash" : detail.method === "check" ? ("Check" + (detail.checkNumber ? " #" + detail.checkNumber : "")) : detail.method === "ach" ? "ACH" : (detail.label || "Card");
      const newPayment = {
        id: "pay_" + Date.now(),
        date: new Date().toISOString().slice(0, 10),
        member: target.memberName || "Manual",
        plan: target.planName || "---",
        amount: detail.amount || target.amount,
        status: "paid",
        method: methodLabel,
      };
      setPayments(prev => [newPayment, ...prev]);

      // Send notification
      if (getNotificationPrefs().payment !== false) {
        sendLocalNotification("Payment received", {
          body: `Payment of $${detail.amount || target.amount} from ${target.memberName || "Manual"}`,
        });
      }
    }
    setPaymentTarget(null);
  };

  const assignPlan = (memberId, planId, changeType) => {
    const member = members.find(m => m.id === memberId);
    const oldPlan = plans.find(p => p.id === member?.membershipPlanId);
    const newPlan = plans.find(p => p.id === planId);
    const memberName = member ? member.firstName + " " + member.lastName : "Unknown";

    const eventType = changeType || (oldPlan && newPlan ? "plan_change" : "plan_change");
    if (oldPlan && newPlan && oldPlan.id !== newPlan.id) {
      logEvent(memberId, memberName, eventType, { oldPlan: oldPlan.name, newPlan: newPlan.name, oldPrice: oldPlan.price, newPrice: newPlan.price, isTrial: !!newPlan.isTrial });
    } else if (!oldPlan && newPlan) {
      logEvent(memberId, memberName, "join", { newPlan: newPlan.name, newPrice: newPlan.price, isTrial: !!newPlan.isTrial });
    } else if (oldPlan && !planId) {
      logEvent(memberId, memberName, "cancel", { oldPlan: oldPlan.name, oldPrice: oldPlan.price, isTrial: !!oldPlan.isTrial });
    }

    // Calculate plan end date for fixed-duration plans
    let planEndDate = null;
    if (newPlan?.durationType === "fixed" && newPlan?.durationWeeks) {
      const end = new Date();
      end.setDate(end.getDate() + newPlan.durationWeeks * 7);
      planEndDate = end.toISOString().slice(0, 10);
    }
    updateMember(memberId, { membershipPlanId: planId || null, cancelScheduled: null, planEndDate });
  };

  const getNextBillingDate = (plan) => {
    const d = new Date();
    if (plan.billingCycle === "monthly") d.setMonth(d.getMonth() + 1);
    else if (plan.billingCycle === "every-4-weeks") d.setDate(d.getDate() + 28);
    else if (plan.billingCycle === "weekly") d.setDate(d.getDate() + 7);
    else if (plan.billingCycle === "yearly" || plan.billingCycle === "annual") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  };

  const handleCancelConfirm = (cancelType, futureDate) => {
    if (!cancelModal) return;
    const { memberId, memberName, oldPlan } = cancelModal;
    if (cancelType === "instant") {
      logEvent(memberId, memberName, "cancel", { oldPlan: oldPlan.name, oldPrice: oldPlan.price, cancelType: "instant" });
      updateMember(memberId, { membershipPlanId: null, cancelScheduled: null });
    } else if (cancelType === "end_of_cycle") {
      const cancelDate = getNextBillingDate(oldPlan);
      logEvent(memberId, memberName, "cancel", { oldPlan: oldPlan.name, oldPrice: oldPlan.price, cancelType: "end_of_cycle", effectiveDate: cancelDate });
      updateMember(memberId, { cancelScheduled: cancelDate });
    } else if (cancelType === "future" && futureDate) {
      logEvent(memberId, memberName, "cancel", { oldPlan: oldPlan.name, oldPrice: oldPlan.price, cancelType: "future", effectiveDate: futureDate });
      updateMember(memberId, { cancelScheduled: futureDate });
    }
    setCancelModal(null);
  };

  /* ── Derived data ── */
  const membersWithBilling = useMemo(() => {
    return members.map(m => {
      const plan = plans.find(p => p.id === m.membershipPlanId);
      const memberPayments = payments.filter(p => p.member === (m.firstName + " " + m.lastName));
      const lastPayment = memberPayments[0] || null;
      const paymentMethod = getDefaultMethod(m.id);
      const overdueForMember = memberPayments.some(p => p.status === "overdue");
      const pendingForMember = memberPayments.some(p => p.status === "pending");
      let status = "no plan";
      if (plan) {
        if (overdueForMember) status = "overdue";
        else if (pendingForMember) status = "due";
        else status = "current";
      }
      return { ...m, plan, lastPayment, paymentMethod, billingStatus: status };
    });
  }, [members, plans, payments]);

  const filteredPayments = useMemo(() => {
    if (paymentFilter === "all") return payments;
    if (paymentFilter === "cash") return payments.filter(p => p.method === "Cash");
    if (paymentFilter === "check") return payments.filter(p => p.method.startsWith("Check"));
    return payments.filter(p => p.status === paymentFilter);
  }, [payments, paymentFilter]);

  const planMemberCounts = useMemo(() => {
    const counts = {};
    members.forEach(m => {
      if (m.membershipPlanId) counts[m.membershipPlanId] = (counts[m.membershipPlanId] || 0) + 1;
    });
    return counts;
  }, [members]);

  const recurringMembers = useMemo(() => {
    return membersWithBilling.filter(m => m.plan && m.paymentMethod);
  }, [membersWithBilling]);

  /* ── Shared Styles ── */
  const sectionTitle = { fontSize: 18, fontWeight: 700, color: B.text, margin: 0 };
  const thStyle = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: "1px solid " + B.border };
  const tdStyle = { padding: "10px 14px", fontSize: 13, color: B.text, borderBottom: "1px solid " + B.border };
  const btnSmall = (bg) => ({ padding: "5px 12px", borderRadius: 6, border: "none", background: bg, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" });
  const sectionNav = { display: "flex", gap: 4, marginBottom: 24, overflowX: "auto", paddingBottom: 2 };
  const sectionTab = (active) => ({
    padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap",
    background: active ? B.accent : "transparent", color: active ? "#fff" : B.muted, transition: "all .15s",
  });
  const avatarSmall = (m) => ({
    width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 700, flexShrink: 0, background: B.accent + "22", color: B.accent,
  });

  const sections = [
    { key: "overview", label: "Client Billing" },
    { key: "plans", label: "Plans" },
    { key: "payments", label: "Payment History" },
    { key: "recurring", label: "Recurring" },
    { key: "discounts", label: "Discounts" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Refund Modal */}
      {refundTarget && (() => {
        const RefundModal = () => {
          const [refundAmount, setRefundAmount] = useState(refundTarget.amount);
          const [reason, setReason] = useState("");
          const [refundType, setRefundType] = useState("full");
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
              <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 440, width: "90%" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: B.text }}>Process Refund</h3>
                <div style={{ padding: 12, borderRadius: 8, background: B.darker, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: B.muted }}>Original Payment</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: B.text, marginTop: 4 }}>${refundTarget.amount} — {refundTarget.member}</div>
                  <div style={{ fontSize: 12, color: B.dim, marginTop: 2 }}>{refundTarget.date} via {refundTarget.method}</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[{ key: "full", label: "Full Refund" }, { key: "partial", label: "Partial Refund" }].map(t => (
                    <button key={t.key} onClick={() => { setRefundType(t.key); if (t.key === "full") setRefundAmount(refundTarget.amount); }}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer", border: refundType === t.key ? `2px solid ${B.red}` : "1px solid " + B.border, background: refundType === t.key ? B.red + "15" : B.dark, color: refundType === t.key ? B.red : B.muted, fontWeight: 700, fontSize: 13, transition: "all 0.15s" }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {refundType === "partial" && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: B.muted, marginBottom: 4, fontWeight: 600 }}>Refund Amount ($)</div>
                    <input type="number" step="0.01" min="0.01" max={refundTarget.amount} value={refundAmount} onChange={e => setRefundAmount(Math.min(parseFloat(e.target.value) || 0, refundTarget.amount))} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 16, fontWeight: 700, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
                  </div>
                )}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: B.muted, marginBottom: 4, fontWeight: 600 }}>Reason (optional)</div>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for refund..." rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setRefundTarget(null)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
                  <button onClick={() => processRefund(refundTarget, refundAmount, reason)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: B.red, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Refund ${refundAmount.toFixed ? refundAmount.toFixed(2) : refundAmount}</button>
                </div>
              </div>
            </div>
          );
        };
        return <RefundModal />;
      })()}

      {/* Plan Change Confirmation — asks upgrade/downgrade/lateral */}
      {pendingPlanChange && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 480, width: "90%" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: B.text }}>Confirm Plan Change</h3>
            <p style={{ color: B.text, fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>
              Change <strong>{pendingPlanChange.memberName}</strong>'s plan?
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", margin: "8px 0 16px" }}>
              <div style={{ padding: "6px 12px", borderRadius: 8, background: B.red + "15", color: B.red, fontSize: 13, fontWeight: 600 }}>
                {pendingPlanChange.oldName}
              </div>
              <span style={{ color: B.muted, fontSize: 18 }}>&rarr;</span>
              <div style={{ padding: "6px 12px", borderRadius: 8, background: B.accent + "15", color: B.accent, fontSize: 13, fontWeight: 600 }}>
                {pendingPlanChange.newName}
              </div>
            </div>
            <p style={{ color: B.text, fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>How should this change be classified?</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[
                { type: "upgrade", label: "Upgrade", color: B.accent, icon: "\u2B06" },
                { type: "downgrade", label: "Downgrade", color: B.orange, icon: "\u2B07" },
                { type: "plan_change", label: "Lateral Change", color: B.blue || "#3b82f6", icon: "\u2194" },
              ].map(opt => (
                <button key={opt.type} onClick={() => setPendingPlanChange(prev => ({ ...prev, changeType: opt.type }))}
                  style={{
                    flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                    border: pendingPlanChange.changeType === opt.type ? `2px solid ${opt.color}` : `1px solid ${B.border}`,
                    background: pendingPlanChange.changeType === opt.type ? opt.color + "15" : B.dark,
                    color: pendingPlanChange.changeType === opt.type ? opt.color : B.muted,
                    transition: "all 0.15s",
                  }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{opt.label}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setPendingPlanChange(null)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button onClick={() => { assignPlan(pendingPlanChange.memberId, pendingPlanChange.planId, pendingPlanChange.changeType); setPendingPlanChange(null); }}
                disabled={!pendingPlanChange.changeType}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: pendingPlanChange.changeType ? B.accent : B.dim, color: "#fff", cursor: pendingPlanChange.changeType ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, opacity: pendingPlanChange.changeType ? 1 : 0.5 }}>
                Confirm {pendingPlanChange.changeType === "upgrade" ? "Upgrade" : pendingPlanChange.changeType === "downgrade" ? "Downgrade" : pendingPlanChange.changeType === "plan_change" ? "Change" : "Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Membership Modal */}
      {cancelModal && (() => {
        const CancelOpt = ({ icon, title, desc, type }) => (
          <button onClick={() => {
            if (type === "future") setCancelModal(prev => ({ ...prev, showDatePicker: true }));
            else handleCancelConfirm(type);
          }} style={{
            width: "100%", padding: "14px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
            border: "1px solid " + B.border, background: B.dark, display: "flex", alignItems: "center", gap: 14,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = B.accent; e.currentTarget.style.background = B.accent + "08"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = B.border; e.currentTarget.style.background = B.dark; }}>
            <span style={{ fontSize: 24 }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: B.text }}>{title}</div>
              <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>{desc}</div>
            </div>
          </button>
        );
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setCancelModal(null)}>
            <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 480, width: "90%" }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: B.text }}>Cancel Membership</h3>
              <p style={{ color: B.muted, fontSize: 13, margin: "0 0 6px" }}>
                <strong>{cancelModal.memberName}</strong> — {cancelModal.oldPlan.name} (${cancelModal.oldPlan.price}/{cancelModal.oldPlan.billingCycle})
              </p>
              <p style={{ color: B.muted, fontSize: 12, margin: "0 0 16px" }}>
                Would they like to switch to a different plan instead? Cancelling affects your attrition metrics.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <CancelOpt icon={"\uD83D\uDD04"} title="End of Billing Cycle" desc={`Keeps access until ${getNextBillingDate(cancelModal.oldPlan)}`} type="end_of_cycle" />
                <CancelOpt icon={"\u26A1"} title="Cancel Immediately" desc="Removes plan and access right now" type="instant" />
                <CancelOpt icon={"\uD83D\uDCC5"} title="Schedule Future Date" desc="Choose a specific date to cancel" type="future" />
              </div>
              {cancelModal.showDatePicker && (
                <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="date" value={cancelModal.futureDate || ""} onChange={e => setCancelModal(prev => ({ ...prev, futureDate: e.target.value }))}
                    style={{ flex: 1, background: B.darker, border: "1px solid " + B.border, borderRadius: 8, color: B.text, padding: "8px 12px", fontSize: 13, outline: "none" }} />
                  <button onClick={() => cancelModal.futureDate && handleCancelConfirm("future", cancelModal.futureDate)}
                    disabled={!cancelModal.futureDate}
                    style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: cancelModal.futureDate ? B.red : B.dim, color: "#fff", fontSize: 13, fontWeight: 700, cursor: cancelModal.futureDate ? "pointer" : "not-allowed", opacity: cancelModal.futureDate ? 1 : 0.5 }}>
                    Confirm
                  </button>
                </div>
              )}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid " + B.border + "44", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setCancelModal(null)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Go Back</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment Modal */}
      {paymentTarget && (
        <PaymentModal
          isOpen
          onClose={() => setPaymentTarget(null)}
          amount={paymentTarget.amount}
          memberName={paymentTarget.memberName}
          memberEmail={paymentTarget.memberEmail}
          description={paymentTarget.description}
          memberId={paymentTarget.memberId}
          savedMethods={paymentTarget.memberId ? getMemberPaymentMethods(paymentTarget.memberId) : []}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Plan Modal */}
      {showPlanModal && <PlanModal plan={editPlan} onSave={savePlan} onClose={() => { setShowPlanModal(false); setEditPlan(null); }} B={B} schedule={schedule} allPlans={plans} />}

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} B={B} recurringEnabled={recurringEnabled} setRecurringEnabled={setRecurringEnabled} />}

      {/* History Modal */}
      {historyMember && <MemberHistoryModal memberName={historyMember} payments={payments} onClose={() => setHistoryMember(null)} B={B} />}

      {/* ── A. Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: B.text, margin: 0 }}>Billing</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setPaymentTarget({ amount: 0, memberName: "", memberEmail: "", description: "Manual Payment", paymentId: null, memberId: null, planName: "" })}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12 }}
          >
            Collect Payment
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Billing Settings"
          >
            {"\u2699"}
          </button>
        </div>
      </div>
      <p style={{ color: B.muted, marginBottom: 24, fontSize: 14 }}>Membership plans, payment tracking, and billing management.</p>

      {/* ── B. KPI Row ── */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
        <KPI label="Monthly Revenue" value={"$" + kpi.totalRevenue.toLocaleString()} sub="This month" B={B} />
        <KPI label="Active Clients" value={kpi.activeCount} sub="Active + trial" B={B} />
        <KPI label="Overdue" value={kpi.overdueCount} sub="Needs follow-up" B={B} color={kpi.overdueCount > 0 ? B.red : undefined} />
        <KPI label="MRR" value={"$" + kpi.mrr.toLocaleString()} sub="Monthly recurring" B={B} color={B.accent} />
      </div>

      {/* ── Section Navigation ── */}
      <div style={sectionNav}>
        {sections.map(s => (
          <button key={s.key} style={sectionTab(activeSection === s.key)} onClick={() => setActiveSection(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── D. Member Billing Overview ── */}
      {activeSection === "overview" && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={sectionTitle}>Client Billing Overview</h2>
            <div style={{ fontSize: 12, color: B.dim }}>{members.length} clients</div>
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: B.darker }}>
                    <th style={thStyle}>Client</th>
                    <th style={thStyle}>Plan</th>
                    <th style={thStyle}>Payment Method</th>
                    <th style={thStyle}>Last Payment</th>
                    <th style={thStyle}>Status</th>
                    <th style={{...thStyle, textAlign: "center"}}>Auto-charge</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {membersWithBilling.map(m => {
                    const fullName = m.firstName + " " + m.lastName;
                    return (
                      <tr key={m.id} style={{ transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = B.darker} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={avatarSmall(m)}>{getInitials(m.firstName, m.lastName)}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{fullName}</div>
                              <div style={{ fontSize: 11, color: B.dim }}>{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <select
                            value={m.membershipPlanId || ""}
                            onChange={e => {
                              const newPlanId = e.target.value;
                              const oldPlan = plans.find(p => p.id === m.membershipPlanId);
                              const newPlan = plans.find(p => p.id === newPlanId);
                              const memberName = m.firstName + " " + m.lastName;
                              // Removing plan → cancel flow
                              if (oldPlan && !newPlanId) {
                                setCancelModal({ memberId: m.id, memberName, oldPlan });
                                return;
                              }
                              const oldName = oldPlan ? oldPlan.name + " ($" + oldPlan.price + ")" : "No plan";
                              const newName = newPlan ? newPlan.name + " ($" + newPlan.price + ")" : "No plan";
                              setPendingPlanChange({ memberId: m.id, memberName, planId: newPlanId, oldName, newName });
                            }}
                            style={{
                              padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: "1px solid " + B.border, background: B.dark, color: B.text, outline: "none",
                              maxWidth: 140,
                            }}
                          >
                            <option value="">No plan</option>
                            {plans.filter(p => p.active).map(p => (
                              <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>
                            ))}
                          </select>
                        </td>
                        <td style={tdStyle}>
                          {m.paymentMethod ? (
                            <span style={{ fontSize: 12, fontWeight: 600, color: B.accent }}>{m.paymentMethod.label}</span>
                          ) : (
                            <span style={{ fontSize: 12, color: B.dim }}>None</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {m.lastPayment ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>${m.lastPayment.amount}</div>
                              <div style={{ fontSize: 11, color: B.dim }}>{m.lastPayment.date}</div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: B.dim }}>---</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <StatusBadge status={m.billingStatus} B={B} />
                        </td>
                        <td style={{...tdStyle, textAlign: "center"}}>
                          <button
                            onClick={() => updateMember(m.id, { autoCharge: !m.autoCharge })}
                            style={{
                              width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                              background: m.autoCharge ? B.accent : B.border,
                              position: "relative", transition: "background 0.2s",
                            }}
                          >
                            <div style={{
                              width: 16, height: 16, borderRadius: 8, background: "#fff",
                              position: "absolute", top: 3,
                              left: m.autoCharge ? 21 : 3,
                              transition: "left 0.2s",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            }} />
                          </button>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => setPaymentTarget({
                                amount: m.plan ? m.plan.price : 0,
                                memberName: fullName,
                                memberEmail: m.email,
                                description: m.plan ? m.plan.name + " - " + fullName : "Payment - " + fullName,
                                paymentId: null,
                                memberId: m.id,
                                planName: m.plan ? m.plan.name : "",
                              })}
                              style={btnSmall(B.accent)}
                            >
                              Charge
                            </button>
                            <button onClick={() => setHistoryMember(fullName)} style={btnSmall(B.blue || "#3b82f6")}>
                              History
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: 32, color: B.dim }}>No members found. Add members to start billing.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── C. Membership Plans ── */}
      {activeSection === "plans" && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={sectionTitle}>Membership Plans</h2>
            <button onClick={() => { setEditPlan(null); setShowPlanModal(true); }} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ New Plan</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
            {plans.map(p => {
              const memberCount = planMemberCounts[p.id] || 0;
              const cycleLabel = { monthly: "Monthly", "every-4-weeks": "Every 4 Weeks", annual: "Annual", weekly: "Weekly", "per-session": "Per Session" }[p.billingCycle] || p.billingCycle;
              const features = (p.features || "").split(",").map(f => f.trim()).filter(Boolean);
              return (
                <Card key={p.id} style={{ opacity: p.active ? 1 : 0.5, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: B.text }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>{cycleLabel}</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: B.accent }}>${p.price}</div>
                  </div>
                  <div style={{ fontSize: 12, color: B.dim, marginBottom: 8 }}>
                    {p.sessionsIncluded ? p.sessionsIncluded + " sessions/cycle" : "Unlimited sessions"}
                  </div>
                  {p.description && <div style={{ fontSize: 12, color: B.muted, marginBottom: 8 }}>{p.description}</div>}
                  {features.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {features.map((f, i) => (
                        <div key={i} style={{ fontSize: 11, color: B.dim, padding: "2px 0", display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: B.green, fontSize: 12 }}>{"\u2713"}</span> {f}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "6px 10px", borderRadius: 6, background: B.darker }}>
                    <span style={{ fontSize: 11, color: B.muted, fontWeight: 600 }}>Clients on plan</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: B.text }}>{memberCount}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => togglePlanActive(p.id)} style={{ ...btnSmall(p.active ? B.dim : B.green), flex: 1 }}>{p.active ? "Deactivate" : "Activate"}</button>
                    <button onClick={() => { setEditPlan(p); setShowPlanModal(true); }} style={{ ...btnSmall(B.blue || "#3b82f6"), flex: 1 }}>Edit</button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── E. Payment History ── */}
      {activeSection === "payments" && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <h2 style={sectionTitle}>Payment History</h2>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {[
                { key: "all", label: "All" },
                { key: "paid", label: "Paid" },
                { key: "overdue", label: "Overdue" },
                { key: "pending", label: "Pending" },
                { key: "cash", label: "Cash" },
                { key: "check", label: "Check" },
                { key: "refund", label: "Refunds" },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setPaymentFilter(f.key)}
                  style={{
                    padding: "4px 12px", borderRadius: 6, border: "1px solid " + B.border, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    background: paymentFilter === f.key ? B.accent : "transparent",
                    color: paymentFilter === f.key ? "#fff" : B.muted,
                    transition: "all .15s",
                  }}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={() => setPaymentTarget({ amount: 0, memberName: "", memberEmail: "", description: "Manual Entry", paymentId: null, memberId: null, planName: "" })}
                style={{ ...btnSmall(B.accent), padding: "5px 14px" }}
              >
                Record Payment
              </button>
            </div>
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: B.darker }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Client</th>
                    <th style={thStyle}>Plan</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Method</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map(p => (
                    <tr key={p.id} style={{ transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = B.darker} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={tdStyle}>{p.date}</td>
                      <td style={tdStyle}>
                        <span
                          style={{ cursor: "pointer", color: B.accent, fontWeight: 600 }}
                          onClick={() => setHistoryMember(p.member)}
                        >
                          {p.member}
                        </span>
                      </td>
                      <td style={tdStyle}>{p.plan}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>${p.amount}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: B.darker, fontWeight: 600 }}>{p.method}</span>
                      </td>
                      <td style={tdStyle}><StatusBadge status={p.status} B={B} /></td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(p.status === "overdue" || p.status === "pending") && (
                            <>
                              <button onClick={() => sendReminder(p.member)} style={btnSmall(B.orange)}>Remind</button>
                              <button onClick={() => setPaymentTarget({ amount: p.amount, memberName: p.member, memberEmail: "", description: p.plan + " - " + p.member, paymentId: p.id, memberId: null, planName: p.plan })} style={btnSmall(B.accent)}>Collect</button>
                              <button onClick={() => markPaid(p.id)} style={btnSmall(B.green)}>Mark Paid</button>
                            </>
                          )}
                          {p.status === "paid" && p.amount > 0 && (
                            <button onClick={() => setRefundTarget(p)} style={btnSmall(B.red)}>Refund</button>
                          )}
                          {(p.status === "refunded" || p.status === "refund") && (
                            <span style={{ fontSize: 11, color: B.red, fontWeight: 600 }}>{p.status === "refund" ? "Refund" : "Refunded"}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: 32, color: B.dim }}>No payments match the current filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── G. Recurring Billing ── */}
      {activeSection === "recurring" && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={sectionTitle}>Recurring Billing</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: B.muted, fontWeight: 600 }}>Auto-charge</span>
              <button
                onClick={() => setRecurringEnabled(!recurringEnabled)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative",
                  background: recurringEnabled ? B.green : (B.border || "#555"), transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3,
                  left: recurringEnabled ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }} />
              </button>
            </div>
          </div>

          {!recurringEnabled ? (
            <Card>
              <div style={{ padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>{"\u{1F504}"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: B.text, marginBottom: 8 }}>Recurring billing is disabled</div>
                <div style={{ fontSize: 13, color: B.dim, marginBottom: 16 }}>Enable auto-charge to automatically bill members with saved payment methods on their billing date.</div>
                <button onClick={() => setRecurringEnabled(true)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Enable Auto-Charge</button>
              </div>
            </Card>
          ) : (
            <>
              <Card style={{ marginBottom: 14, padding: 14, background: B.darker }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18, color: B.green }}>{"\u2713"}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: B.text }}>Auto-charge is active</div>
                    <div style={{ fontSize: 12, color: B.dim }}>Clients with saved payment methods and an assigned plan will be charged automatically on their billing date.</div>
                  </div>
                </div>
              </Card>
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: B.darker }}>
                        <th style={thStyle}>Client</th>
                        <th style={thStyle}>Plan</th>
                        <th style={thStyle}>Amount</th>
                        <th style={thStyle}>Payment Method</th>
                        <th style={thStyle}>Next Charge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurringMembers.map(m => {
                        const nextDate = new Date();
                        nextDate.setMonth(nextDate.getMonth() + 1);
                        nextDate.setDate(1);
                        return (
                          <tr key={m.id} style={{ transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = B.darker} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={avatarSmall(m)}>{getInitials(m.firstName, m.lastName)}</div>
                                <span style={{ fontWeight: 600 }}>{m.firstName} {m.lastName}</span>
                              </div>
                            </td>
                            <td style={tdStyle}>{m.plan.name}</td>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>${m.plan.price}</td>
                            <td style={tdStyle}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: B.accent }}>{m.paymentMethod.label}</span>
                            </td>
                            <td style={tdStyle}>{formatDate(nextDate)}</td>
                          </tr>
                        );
                      })}
                      {recurringMembers.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ ...tdStyle, textAlign: "center", padding: 32, color: B.dim }}>
                            No members have both an assigned plan and a saved payment method. Assign plans and save payment methods to enable recurring billing.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── H. Payment Method Discounts ── */}
      {activeSection === "discounts" && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={sectionTitle}>Payment Method Discounts</h2>
            <button
              onClick={() => setDiscountRules(prev => [...prev, { id: "disc_" + Date.now(), method: "ACH", discountType: "Percentage", value: 0, active: true }])}
              style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              + Add Discount Rule
            </button>
          </div>
          <p style={{ color: B.muted, fontSize: 13, marginBottom: 16 }}>
            Define discounts for specific payment methods. When a client pays using a method with an active discount, the adjusted amount will be shown in the payment modal.
          </p>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: B.darker }}>
                    <th style={thStyle}>Payment Method</th>
                    <th style={thStyle}>Discount Type</th>
                    <th style={thStyle}>Value</th>
                    <th style={thStyle}>Active</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {discountRules.map(rule => (
                    <tr key={rule.id}>
                      <td style={tdStyle}>
                        <select
                          value={rule.method}
                          onChange={e => setDiscountRules(prev => prev.map(r => r.id === rule.id ? { ...r, method: e.target.value } : r))}
                          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13 }}
                        >
                          <option value="ACH">ACH</option>
                          <option value="Cash">Cash</option>
                          <option value="Check">Check</option>
                          <option value="Annual Pre-pay">Annual Pre-pay</option>
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={rule.discountType}
                          onChange={e => setDiscountRules(prev => prev.map(r => r.id === rule.id ? { ...r, discountType: e.target.value } : r))}
                          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13 }}
                        >
                          <option value="Percentage">Percentage</option>
                          <option value="Fixed Amount">Fixed Amount</option>
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {rule.discountType === "Fixed Amount" && <span style={{ color: B.muted, fontSize: 13 }}>$</span>}
                          <input
                            type="number"
                            min="0"
                            value={rule.value}
                            onChange={e => setDiscountRules(prev => prev.map(r => r.id === rule.id ? { ...r, value: Number(e.target.value) } : r))}
                            style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid " + B.border, background: B.dark, color: B.text, fontSize: 13 }}
                          />
                          {rule.discountType === "Percentage" && <span style={{ color: B.muted, fontSize: 13 }}>%</span>}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => setDiscountRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))}
                          style={{
                            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative",
                            background: rule.active ? B.green : (B.border || "#555"), transition: "background 0.2s",
                          }}
                        >
                          <div style={{
                            width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3,
                            left: rule.active ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }} />
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => setDiscountRules(prev => prev.filter(r => r.id !== rule.id))}
                          style={btnSmall(B.red || "#e74c3c")}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {discountRules.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, textAlign: "center", padding: 32, color: B.dim }}>No discount rules defined. Click "+ Add Discount Rule" to create one.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
