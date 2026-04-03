import { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://gymkit-server.fly.dev";

const PLANS = [
  { id: "starter", name: "Starter", price: 99, features: ["Up to 50 members", "1 coach account", "Basic scheduling", "Client portal", "Email support"] },
  { id: "professional", name: "Professional", price: 199, features: ["Up to 200 members", "5 coach accounts", "Full scheduling + waitlists", "Client portal + PWA", "Community feed", "Analytics dashboard", "Priority support"], popular: true },
  { id: "enterprise", name: "Enterprise", price: 399, features: ["Unlimited members", "Unlimited coaches", "Everything in Professional", "Multi-location", "Custom branding", "API access", "Dedicated support", "White-label option"] },
];

export default function GymBillingView() {
  const B = useTheme();
  const [subscription, setSubscription] = useLocalStorage("hf_subscription", null);
  const [branding] = useLocalStorage("hf_branding", {});
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState(null);

  const gymName = branding.gymName || "Your Gym";
  const gymEmail = branding.email || "";
  const gymId = localStorage.getItem("hf_gym_id") || "default";

  // Current plan info
  const currentPlan = subscription ? PLANS.find(p => p.id === subscription.planId) : null;
  const isTrialing = subscription?.status === "trial";
  const isCancelled = subscription?.status === "cancelled" || subscription?.cancelAtPeriodEnd;
  const trialDaysLeft = isTrialing && subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt) - new Date()) / 86400000))
    : 0;

  // Open Stripe Customer Portal
  const openBillingPortal = async () => {
    if (!subscription?.stripeCustomerId) {
      setError("No billing account found. Contact support.");
      return;
    }
    setPortalLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/subscription/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: subscription.stripeCustomerId,
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to open billing portal");
      }
    } catch (e) {
      setError("Could not connect to billing server");
    }
    setPortalLoading(false);
  };

  // Subscribe to a plan (or change plan)
  const handleSelectPlan = async (planId) => {
    setLoading(true);
    setError(null);
    try {
      // Create or get customer
      const custRes = await fetch(`${SERVER_URL}/api/subscription/create-customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: gymEmail, gymName, gymId }),
      });
      const custData = await custRes.json();
      if (custData.error) throw new Error(custData.error);

      if (subscription?.stripeSubscriptionId) {
        // Change existing plan
        const changeRes = await fetch(`${SERVER_URL}/api/subscription/change-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId: subscription.stripeSubscriptionId, newPlanId: planId }),
        });
        const changeData = await changeRes.json();
        if (changeData.error) throw new Error(changeData.error);

        const plan = PLANS.find(p => p.id === planId);
        setSubscription(prev => ({
          ...prev,
          planId,
          planName: plan?.name,
          price: plan?.price,
          status: "active",
        }));
      } else {
        // Create new subscription with trial
        const subRes = await fetch(`${SERVER_URL}/api/subscription/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: custData.customerId, planId, trialDays: 14 }),
        });
        const subData = await subRes.json();
        if (subData.error) throw new Error(subData.error);

        const plan = PLANS.find(p => p.id === planId);
        setSubscription({
          planId,
          planName: plan?.name,
          price: plan?.price,
          status: subData.status === "trialing" ? "trial" : "active",
          stripeCustomerId: custData.customerId,
          stripeSubscriptionId: subData.subscriptionId,
          trialEndsAt: subData.trialEnd,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Cancel subscription
  const handleCancel = async () => {
    if (!subscription?.stripeSubscriptionId) return;
    if (!window.confirm("Cancel your subscription? You'll retain access until the end of your billing period.")) return;
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/subscription/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.stripeSubscriptionId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSubscription(prev => ({ ...prev, status: "cancelled", cancelAtPeriodEnd: true, cancelAt: data.cancelAt }));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Resume cancelled subscription
  const handleResume = async () => {
    if (!subscription?.stripeSubscriptionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/subscription/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.stripeSubscriptionId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSubscription(prev => ({ ...prev, status: "active", cancelAtPeriodEnd: false, cancelAt: null }));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const s = {
    planCard: (selected, popular) => ({
      flex: 1, minWidth: 220, padding: 24, borderRadius: 14, cursor: "pointer",
      border: selected ? `2px solid ${B.accent}` : `1px solid ${B.border}`,
      background: selected ? B.accent + "08" : B.card,
      position: "relative", transition: "all 0.15s",
    }),
    planName: { fontSize: 18, fontWeight: 800, color: B.text, marginBottom: 4 },
    planPrice: { fontSize: 32, fontWeight: 800, color: B.accent },
    planPer: { fontSize: 13, color: B.muted, fontWeight: 400 },
    feature: { fontSize: 13, color: B.muted, padding: "3px 0", display: "flex", alignItems: "center", gap: 8 },
    check: { color: B.accent, fontSize: 14 },
    btn: (bg, color) => ({ padding: "10px 20px", borderRadius: 10, border: "none", background: bg, color, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }),
    popularBadge: { position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: B.accent, color: "#fff", padding: "3px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700 },
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, marginBottom: 4 }}>GymKit Subscription</h1>
      <p style={{ color: B.muted, fontSize: 14, marginBottom: 24 }}>Manage your GymKit platform subscription and billing.</p>

      {error && (
        <div style={{ padding: "10px 16px", borderRadius: 10, marginBottom: 16, background: B.red + "15", color: B.red, border: "1px solid " + B.red + "30", fontSize: 13, fontWeight: 600 }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", color: B.red, cursor: "pointer", fontWeight: 700 }}>Dismiss</button>
        </div>
      )}

      {/* Current Subscription Status */}
      {subscription && (
        <Card style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Current Plan</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: B.text }}>{subscription.planName || subscription.planId}</div>
              <div style={{ fontSize: 14, color: B.muted }}>
                ${subscription.price}/month
                {isTrialing && <span style={{ color: B.orange, fontWeight: 700, marginLeft: 8 }}>Trial — {trialDaysLeft} days left</span>}
                {isCancelled && <span style={{ color: B.red, fontWeight: 700, marginLeft: 8 }}>Cancels {subscription.cancelAt ? new Date(subscription.cancelAt).toLocaleDateString() : "at period end"}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {subscription.stripeCustomerId && (
                <button onClick={openBillingPortal} disabled={portalLoading} style={s.btn(B.accent, "#fff")}>
                  {portalLoading ? "Loading..." : "Manage Billing"}
                </button>
              )}
              {isCancelled ? (
                <button onClick={handleResume} disabled={loading} style={s.btn(B.green + "22", B.green)}>Resume</button>
              ) : subscription.status !== "trial" ? (
                <button onClick={handleCancel} disabled={loading} style={s.btn(B.red + "15", B.red)}>Cancel</button>
              ) : null}
            </div>
          </div>
        </Card>
      )}

      {/* Plan Selection */}
      <div style={{ fontSize: 16, fontWeight: 700, color: B.text, marginBottom: 14 }}>
        {subscription ? "Change Plan" : "Choose Your Plan"}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        {PLANS.map(plan => {
          const isCurrentPlan = subscription?.planId === plan.id;
          return (
            <div key={plan.id} style={s.planCard(isCurrentPlan, plan.popular)}
              onClick={() => !isCurrentPlan && !loading && handleSelectPlan(plan.id)}
              onMouseEnter={e => { if (!isCurrentPlan) e.currentTarget.style.borderColor = B.accent; }}
              onMouseLeave={e => { if (!isCurrentPlan) e.currentTarget.style.borderColor = B.border; }}>
              {plan.popular && <div style={s.popularBadge}>MOST POPULAR</div>}
              <div style={s.planName}>{plan.name}</div>
              <div style={{ marginBottom: 16 }}>
                <span style={s.planPrice}>${plan.price}</span>
                <span style={s.planPer}>/month</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={s.feature}>
                    <span style={s.check}>{"\u2713"}</span>
                    {f}
                  </div>
                ))}
              </div>
              {isCurrentPlan ? (
                <div style={{ padding: "8px 16px", borderRadius: 8, background: B.accent + "15", color: B.accent, fontSize: 13, fontWeight: 700, textAlign: "center" }}>Current Plan</div>
              ) : (
                <button style={{ ...s.btn(plan.popular ? B.accent : B.border, plan.popular ? "#fff" : B.text), width: "100%" }} disabled={loading}>
                  {loading ? "Processing..." : subscription ? `Switch to ${plan.name}` : `Start Free Trial`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!subscription && (
        <div style={{ textAlign: "center", color: B.dim, fontSize: 13 }}>
          All plans include a 14-day free trial. No credit card required to start.
        </div>
      )}
    </div>
  );
}
