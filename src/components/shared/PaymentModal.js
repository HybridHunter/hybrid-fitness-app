import React, { useState, useMemo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useTheme } from '../../context/ThemeContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function getStripeKey() {
  // Settings stores the key in the hf_integrations blob (localStorage read cache).
  // SettingsView writes { stripe: { publishableKey } }; older IntegrationsView wrote a flat shape — read both.
  try {
    let integrations = JSON.parse(localStorage.getItem('hf_integrations') || '{}');
    if (typeof integrations === 'string') { try { integrations = JSON.parse(integrations); } catch { integrations = {}; } }
    return integrations?.stripe?.publishableKey || integrations?.stripePublishableKey || null;
  } catch { return null; }
}

/* ── Saved Payment Methods helpers ── */
function getSavedMethods(memberId) {
  if (!memberId) return [];
  try {
    const all = JSON.parse(localStorage.getItem('hf_payment_methods') || '[]');
    return all.filter(m => m.memberId === memberId);
  } catch { return []; }
}

function addSavedMethod(method) {
  try {
    const all = JSON.parse(localStorage.getItem('hf_payment_methods') || '[]');
    all.push(method);
    localStorage.setItem('hf_payment_methods', JSON.stringify(all));
  } catch { /* ignore */ }
}

/* ── Card Payment Form ── */
function CardPaymentForm({ amount, memberName, memberEmail, description, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const B = useTheme();
  const isDark = B.darker === '#080c12';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const cardStyle = { style: { base: { color: isDark ? '#f0f0f0' : '#1a1a2e', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '16px', '::placeholder': { color: isDark ? '#888' : '#aaa' } }, invalid: { color: '#e74c3c' } } };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !(amount > 0)) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/create-payment-intent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, memberEmail, memberName, description }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, { payment_method: { card: elements.getElement(CardElement) } });
      if (stripeError) throw new Error(stripeError.message);
      setSuccess(true);
      if (onSuccess) onSuccess({ method: 'card', paymentIntentId: paymentIntent.id, amount, status: paymentIntent.status });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  if (success) return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#16a34a22', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28, color: '#4ade80' }}>&#10003;</div>
      <h3 style={{ margin: '0 0 8px', color: '#4ade80' }}>Payment Successful</h3>
      <p style={{ color: isDark ? '#ccc' : '#555', margin: 0 }}>${amount.toFixed(2)} charged to card.</p>
      <button onClick={onClose} style={btnStyle(isDark, false)}>Close</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ background: isDark ? '#1e1e2f' : '#f5f5f5', borderRadius: 8, padding: 16, marginBottom: 12, border: `1px solid ${isDark ? '#333' : '#ddd'}` }}><CardElement options={cardStyle} /></div>
      {error && <p style={{ color: '#e74c3c', fontSize: 14, margin: '0 0 12px' }}>{error}</p>}
      <button type="submit" disabled={!stripe || loading || !(amount > 0)} style={btnStyle(isDark, loading || !(amount > 0))}>{loading ? 'Processing...' : `Pay $${amount.toFixed(2)}`}</button>
    </form>
  );
}

/* ── ACH / Bank Account via Stripe Financial Connections ── */
function AchPaymentForm({ amount, memberName, memberEmail, description, onSuccess, onClose, memberId }) {
  const B = useTheme();
  const isDark = B.darker === '#080c12';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [bankConnected, setBankConnected] = useState(false);
  const [bankLabel, setBankLabel] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [saveBank, setSaveBank] = useState(false);

  // Step 1: Open Stripe Financial Connections (bank login)
  const handleConnectBank = async () => {
    setLoading(true); setError(null);
    try {
      // Create a Financial Connections session on the server
      const res = await fetch(`${API_BASE}/api/create-fc-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberName, memberEmail }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Use Stripe.js to collect the bank account
      const stripe = await loadStripe(getStripeKey());
      const { setupIntent, error: confirmError } = await stripe.collectBankAccountForSetup({
        clientSecret: data.clientSecret,
        params: {
          payment_method_type: 'us_bank_account',
          payment_method_data: {
            billing_details: { name: memberName, email: memberEmail || undefined },
          },
        },
      });

      if (confirmError) throw new Error(confirmError.message);

      if (setupIntent.status === 'requires_payment_method') {
        // User closed the modal without selecting a bank
        setLoading(false);
        return;
      }

      // Confirm the setup (accept mandate)
      const { setupIntent: confirmed, error: confirmErr2 } = await stripe.confirmUsBankAccountSetup(data.clientSecret);
      if (confirmErr2) throw new Error(confirmErr2.message);

      // Bank is now connected
      const pm = confirmed.payment_method;
      const pmDetails = typeof pm === 'object' ? pm : null;
      const bankName = pmDetails?.us_bank_account?.bank_name || 'Bank Account';
      const last4 = pmDetails?.us_bank_account?.last4 || '****';

      setBankConnected(true);
      setBankLabel(`${bankName} \u2022\u2022\u2022\u2022 ${last4}`);
      setCustomerId(data.customerId);
      setPaymentMethodId(typeof pm === 'string' ? pm : pm?.id);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Process ACH payment
  const handleAchPayment = async () => {
    if (!(amount > 0)) return;
    setLoading(true); setError(null);
    try {
      // Real payment via server
      const res = await fetch(`${API_BASE}/api/create-ach-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, customerId, paymentMethodId, memberName, description }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Save bank if requested
      if (saveBank && memberId && bankLabel) {
        const last4 = bankLabel.match(/(\d{4})$/)?.[1] || '0000';
        const bName = bankLabel.replace(/\s*\u2022+\s*\d*$/, '').trim();
        const existing = getSavedMethods(memberId);
        addSavedMethod({
          id: 'pm_' + Date.now(), memberId, type: 'ach',
          label: bankLabel, brand: null, last4, expiry: null,
          bankName: bName, isDefault: existing.length === 0,
          stripeCustomerId: customerId, stripePaymentMethodId: paymentMethodId,
          createdAt: new Date().toISOString(),
        });
      }

      setSuccess(true);
      if (onSuccess) onSuccess({ method: 'ach', paymentIntentId: data.paymentIntentId, bankName: bankLabel, amount, status: data.status || 'processing' });

    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  if (success) return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#16a34a22', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28, color: '#4ade80' }}>&#10003;</div>
      <h3 style={{ margin: '0 0 8px', color: '#4ade80' }}>ACH Payment Initiated</h3>
      <p style={{ color: isDark ? '#ccc' : '#555', margin: 0 }}>${amount.toFixed(2)} will be debited from {bankLabel}. ACH transfers typically take 2-3 business days.</p>
      {saveBank && <p style={{ color: '#818cf8', fontSize: 12, marginTop: 8 }}>Bank account saved for recurring payments.</p>}
      <button onClick={onClose} style={btnStyle(isDark, false)}>Close</button>
    </div>
  );

  return (
    <div>
      {/* Info banner */}
      <div style={{ background: isDark ? '#1e1e2f' : '#eff6ff', borderRadius: 8, padding: 14, marginBottom: 16, border: `1px solid ${isDark ? '#333' : '#bfdbfe'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{'\u{1F3E6}'}</span>
        <span style={{ fontSize: 13, color: isDark ? '#aaa' : '#555' }}>Connect your bank account securely. You'll log in to your online banking to verify instantly — no micro-deposits needed.</span>
      </div>

      {!bankConnected ? (
        <button onClick={handleConnectBank} disabled={loading} style={btnStyle(isDark, loading)}>
          {loading ? 'Connecting to your bank...' : 'Connect Bank Account'}
        </button>
      ) : (
        <div>
          <div style={{ background: isDark ? '#1e1e2f' : '#f0fdf4', borderRadius: 8, padding: 16, marginBottom: 12, border: `1px solid ${isDark ? '#333' : '#bbf7d0'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#16a34a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{'\u{1F3E6}'}</div>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: isDark ? '#f0f0f0' : '#1a1a2e' }}>{bankLabel}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#4ade80' }}>Verified via Stripe Financial Connections</p>
            </div>
          </div>
          {memberId && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontSize: 13, color: isDark ? '#aaa' : '#666' }}>
              <input type="checkbox" checked={saveBank} onChange={e => setSaveBank(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#818cf8', cursor: 'pointer' }} />
              Save for recurring payments
            </label>
          )}
          <button onClick={handleAchPayment} disabled={loading || !(amount > 0)} style={btnStyle(isDark, loading || !(amount > 0))}>{loading ? 'Processing...' : `Pay $${amount.toFixed(2)} via ACH`}</button>
        </div>
      )}
      {error && <p style={{ color: '#e74c3c', fontSize: 14, marginTop: 12 }}>{error}</p>}
    </div>
  );
}

/* ── Cash Payment Form ── */
function CashPaymentForm({ amount, onSuccess, onClose }) {
  const B = useTheme();
  const isDark = B.darker === '#080c12';
  const [cashAmount, setCashAmount] = useState(amount.toFixed(2));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${isDark ? '#333' : '#ddd'}`, background: isDark ? '#1e1e2f' : '#f5f5f5', color: isDark ? '#f0f0f0' : '#1a1a2e', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: isDark ? '#888' : '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };

  if (success) return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#16a34a22', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28, color: '#4ade80' }}>&#10003;</div>
      <h3 style={{ margin: '0 0 8px', color: '#4ade80' }}>Cash Payment Recorded</h3>
      <p style={{ color: isDark ? '#ccc' : '#555', margin: 0 }}>${parseFloat(cashAmount).toFixed(2)} received in cash.</p>
      <button onClick={onClose} style={btnStyle(isDark, false)}>Close</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: isDark ? '#1e1e2f' : '#f0fdf4', borderRadius: 8, padding: 14, border: `1px solid ${isDark ? '#333' : '#bbf7d0'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{'\u{1F4B5}'}</span>
        <span style={{ fontSize: 13, color: isDark ? '#aaa' : '#555' }}>Record a cash payment received from the member.</span>
      </div>
      <div><label style={labelStyle}>Amount ($)</label><input style={inputStyle} type="number" min="0" step="0.01" value={cashAmount} onChange={e => setCashAmount(e.target.value)} /></div>
      <div><label style={labelStyle}>Reference / Receipt # (optional)</label><input style={inputStyle} value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. REC-001" /></div>
      <div><label style={labelStyle}>Notes (optional)</label><textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." /></div>
      <button onClick={() => { const amt = parseFloat(cashAmount); if (isNaN(amt) || amt <= 0) return; setSuccess(true); if (onSuccess) onSuccess({ method: 'cash', amount: amt, reference, notes }); }} style={btnStyle(isDark, false)}>Record Cash Payment</button>
    </div>
  );
}

/* ── Check Payment Form ── */
function CheckPaymentForm({ amount, onSuccess, onClose }) {
  const B = useTheme();
  const isDark = B.darker === '#080c12';
  const [checkAmount, setCheckAmount] = useState(amount.toFixed(2));
  const [checkNumber, setCheckNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${isDark ? '#333' : '#ddd'}`, background: isDark ? '#1e1e2f' : '#f5f5f5', color: isDark ? '#f0f0f0' : '#1a1a2e', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: isDark ? '#888' : '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };

  if (success) return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#16a34a22', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28, color: '#4ade80' }}>&#10003;</div>
      <h3 style={{ margin: '0 0 8px', color: '#4ade80' }}>Check Payment Recorded</h3>
      <p style={{ color: isDark ? '#ccc' : '#555', margin: 0 }}>${parseFloat(checkAmount).toFixed(2)} recorded via check{checkNumber ? ` #${checkNumber}` : ''}.</p>
      <button onClick={onClose} style={btnStyle(isDark, false)}>Close</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: isDark ? '#1e1e2f' : '#eff6ff', borderRadius: 8, padding: 14, border: `1px solid ${isDark ? '#333' : '#bfdbfe'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{'\u{1F4DD}'}</span>
        <span style={{ fontSize: 13, color: isDark ? '#aaa' : '#555' }}>Record a check payment received from the member.</span>
      </div>
      <div><label style={labelStyle}>Amount ($)</label><input style={inputStyle} type="number" min="0" step="0.01" value={checkAmount} onChange={e => setCheckAmount(e.target.value)} /></div>
      <div><label style={labelStyle}>Check Number</label><input style={inputStyle} value={checkNumber} onChange={e => setCheckNumber(e.target.value)} placeholder="e.g. 1042" /></div>
      <div><label style={labelStyle}>Bank Name</label><input style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Chase, Wells Fargo" /></div>
      <div><label style={labelStyle}>Notes (optional)</label><textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." /></div>
      <button onClick={() => { const amt = parseFloat(checkAmount); if (isNaN(amt) || amt <= 0) return; setSuccess(true); if (onSuccess) onSuccess({ method: 'check', amount: amt, checkNumber, bankName, notes }); }} style={btnStyle(isDark, false)}>Record Check Payment</button>
    </div>
  );
}

/* ── Main PaymentModal ── */
function getDiscountRules() {
  try { return JSON.parse(localStorage.getItem('hf_payment_discounts') || '[]'); } catch { return []; }
}

function calcDiscount(amount, methodKey) {
  const rules = getDiscountRules();
  const methodMap = { card: null, ach: 'ACH', cash: 'Cash', check: 'Check' };
  const methodName = methodMap[methodKey];
  if (!methodName) return null;
  const rule = rules.find(r => r.method === methodName && r.active && r.value > 0);
  if (!rule) return null;
  let discount = 0;
  if (rule.discountType === 'Percentage') {
    discount = amount * (rule.value / 100);
  } else {
    discount = rule.value;
  }
  discount = Math.min(discount, amount);
  return { rule, discount: Math.round(discount * 100) / 100, adjusted: Math.round((amount - discount) * 100) / 100 };
}

export default function PaymentModal({ isOpen, onClose, onSuccess, amount = 0, memberName = '', memberEmail = '', description = '', memberId = null }) {
  const B = useTheme();
  const isDark = B.darker === '#080c12';
  const [tab, setTab] = useState('card');
  const [isFEO, setIsFEO] = useState(false);
  const [amountInput, setAmountInput] = useState(amount > 0 ? amount.toFixed(2) : '');
  const stripeKey = getStripeKey();
  const stripeConfigured = !!stripeKey;
  const stripePromise = useMemo(() => (stripeKey ? loadStripe(stripeKey) : null), [stripeKey]);

  if (!isOpen) return null;

  const baseAmount = Math.round((parseFloat(amountInput) || 0) * 100) / 100;
  const disc = calcDiscount(baseAmount, tab);
  const chargeAmount = disc ? disc.adjusted : baseAmount;

  const tabs = [
    { key: 'card', label: 'Card', icon: '\u{1F4B3}' },
    { key: 'ach', label: 'Bank (ACH)', icon: '\u{1F3E6}' },
    { key: 'cash', label: 'Cash', icon: '\u{1F4B5}' },
    { key: 'check', label: 'Check', icon: '\u{1F4DD}' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: isDark ? '#12121f' : '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: `1px solid ${isDark ? '#222' : '#e5e5e5'}` }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: isDark ? '#f0f0f0' : '#1a1a2e' }}>Payment</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: isDark ? '#888' : '#999', padding: 4 }}>&#x2715;</button>
        </div>

        {/* Amount */}
        <div style={{ background: isDark ? '#16162a' : '#eef2ff', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'center' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isDark ? '#888' : '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Amount ($)</label>
          <input
            type="number" min="0" step="0.01" value={amountInput} onChange={e => setAmountInput(e.target.value)} placeholder="0.00"
            style={{ width: 160, padding: '8px 12px', borderRadius: 8, border: `1px solid ${isDark ? '#333' : '#c7d2fe'}`, background: isDark ? '#1e1e2f' : '#fff', color: isDark ? '#818cf8' : '#4f46e5', fontSize: 24, fontWeight: 700, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
          />
          {disc && (
            <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: '#4ade80' }}>
              {disc.rule.discountType === 'Percentage' ? `${disc.rule.value}% ${disc.rule.method} discount` : `$${disc.rule.value} ${disc.rule.method} discount`}
              {' '}&mdash; saving ${disc.discount.toFixed(2)}, charging ${disc.adjusted.toFixed(2)}
            </p>
          )}
          {memberName && <p style={{ margin: '4px 0 0', fontSize: 14, color: isDark ? '#aaa' : '#666' }}>{memberName}</p>}
          {description && <p style={{ margin: '2px 0 0', fontSize: 13, color: isDark ? '#888' : '#999' }}>{description}</p>}
        </div>

        {/* FEO toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 13, color: isDark ? '#aaa' : '#666', padding: '8px 12px', borderRadius: 8, background: isFEO ? (isDark ? '#16a34a18' : '#f0fdf4') : 'transparent', border: isFEO ? '1px solid #16a34a40' : '1px solid transparent', transition: 'all 0.15s' }}>
          <input type="checkbox" checked={isFEO} onChange={e => setIsFEO(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#16a34a', cursor: 'pointer' }} />
          <div>
            <div style={{ fontWeight: 600, color: isFEO ? '#16a34a' : (isDark ? '#ccc' : '#444') }}>Front End Offer (FEO)</div>
            <div style={{ fontSize: 11, color: isDark ? '#666' : '#999' }}>Mark as FEO — counts under FEO Collected on dashboard</div>
          </div>
        </label>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: `1px solid ${isDark ? '#333' : '#ddd'}` }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === t.key ? (isDark ? '#818cf8' : '#4f46e5') : (isDark ? '#1e1e2f' : '#fff'), color: tab === t.key ? '#fff' : (isDark ? '#aaa' : '#666'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 13 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {(() => {
          const wrappedSuccess = onSuccess ? (data) => onSuccess({ ...data, isFEO }) : undefined;
          const stripeNotConfigured = (
            <div style={{ padding: '18px 16px', borderRadius: 8, background: isDark ? '#1e1e2f' : '#fef2f2', border: `1px solid ${isDark ? '#333' : '#fecaca'}`, color: isDark ? '#fca5a5' : '#b91c1c', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              Stripe is not configured. Add your Stripe publishable key in Settings &rarr; Integrations to accept card and bank payments. Cash and check payments can still be recorded.
            </div>
          );
          return <>
            {tab === 'card' && (stripeConfigured
              ? <Elements stripe={stripePromise}><CardPaymentForm amount={chargeAmount} memberName={memberName} memberEmail={memberEmail} description={description} onSuccess={wrappedSuccess} onClose={onClose} /></Elements>
              : stripeNotConfigured)}
            {tab === 'ach' && (stripeConfigured
              ? <AchPaymentForm amount={chargeAmount} memberName={memberName} memberEmail={memberEmail} description={description} onSuccess={wrappedSuccess} onClose={onClose} memberId={memberId} />
              : stripeNotConfigured)}
            {tab === 'cash' && <CashPaymentForm amount={chargeAmount} onSuccess={wrappedSuccess} onClose={onClose} />}
            {tab === 'check' && <CheckPaymentForm amount={chargeAmount} onSuccess={wrappedSuccess} onClose={onClose} />}
          </>;
        })()}
      </div>
    </div>
  );
}

/* ── Shared styles ── */
function btnStyle(isDark, disabled) {
  return { width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, background: isDark ? '#818cf8' : '#4f46e5', color: '#fff', marginTop: 12, transition: 'opacity 0.2s' };
}
