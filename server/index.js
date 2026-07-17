require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const { Resend } = require('resend');

const app = express();
app.use(cors());

// Stripe webhook — must be registered BEFORE express.json() so the raw body
// is available for signature verification (express.json would consume it).
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    let event;
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = JSON.parse(req.body);
    }

    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        console.log(`[Stripe Webhook] ${event.type}:`, event.data.object.id);
        // In production: update Supabase gym subscription status here
        break;
      default:
        console.log(`[Stripe Webhook] Unhandled: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.use(express.json({ limit: '10mb' }));

// ── Stripe: Card Payments ──

app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', memberEmail, memberName, description } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), currency, description,
      receipt_email: memberEmail, metadata: { memberName },
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/create-setup-intent', async (req, res) => {
  try {
    const setupIntent = await stripe.setupIntents.create({ payment_method_types: ['card'] });
    res.json({ clientSecret: setupIntent.client_secret });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Stripe: ACH via Financial Connections ──

app.post('/api/create-fc-session', async (req, res) => {
  try {
    const { memberName, memberEmail } = req.body;
    let customer;
    if (memberEmail) {
      const existing = await stripe.customers.list({ email: memberEmail, limit: 1 });
      if (existing.data.length > 0) customer = existing.data[0];
    }
    if (!customer) { customer = await stripe.customers.create({ name: memberName, email: memberEmail || undefined }); }
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id, payment_method_types: ['us_bank_account'],
      payment_method_options: { us_bank_account: { financial_connections: { permissions: ['payment_method'] } } },
    });
    res.json({ clientSecret: setupIntent.client_secret, customerId: customer.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/create-ach-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', customerId, paymentMethodId, memberName, description } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), currency, customer: customerId,
      payment_method: paymentMethodId, payment_method_types: ['us_bank_account'],
      description, metadata: { memberName },
      mandate_data: { customer_acceptance: { type: 'online', online: { ip_address: req.ip, user_agent: req.get('user-agent') } } },
    });
    const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id);
    res.json({ status: confirmed.status, paymentIntentId: confirmed.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Email via Resend ──

app.post('/api/send-email', async (req, res) => {
  try {
    const apiKey = req.body.resendApiKey || process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 'placeholder') return res.status(400).json({ error: 'Resend API key not configured' });

    const resend = new Resend(apiKey);
    const { to, subject, html, text, from, replyTo } = req.body;

    const result = await resend.emails.send({
      from: from || process.env.EMAIL_FROM || 'GymKit <noreply@gymkit.io>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || undefined,
      text: text || undefined,
      reply_to: replyTo || undefined,
    });

    res.json({ success: true, id: result.data?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk email
app.post('/api/send-email-bulk', async (req, res) => {
  try {
    const apiKey = req.body.resendApiKey || process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Resend API key not configured' });

    const resend = new Resend(apiKey);
    const { recipients, subject, html, text, from } = req.body;
    // recipients: [{email, name, variables}]

    const results = [];
    for (const r of recipients) {
      try {
        let personalHtml = html;
        let personalText = text;
        if (r.variables) {
          Object.entries(r.variables).forEach(([key, val]) => {
            const re = new RegExp(`\\{${key}\\}`, 'g');
            if (personalHtml) personalHtml = personalHtml.replace(re, val);
            if (personalText) personalText = personalText.replace(re, val);
          });
        }
        const result = await resend.emails.send({
          from: from || process.env.EMAIL_FROM || 'GymKit <noreply@gymkit.io>',
          to: [r.email],
          subject: subject.replace(/\{firstName\}/g, r.name || ''),
          html: personalHtml || undefined,
          text: personalText || undefined,
        });
        results.push({ email: r.email, success: true, id: result.data?.id });
      } catch (err) {
        results.push({ email: r.email, success: false, error: err.message });
      }
    }

    res.json({ results, sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SMS via Twilio ──

app.post('/api/send-sms', async (req, res) => {
  try {
    const accountSid = req.body.twilioSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = req.body.twilioToken || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = req.body.twilioFrom || process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) return res.status(400).json({ error: 'Twilio not configured' });

    const twilio = require('twilio')(accountSid, authToken);
    const { to, body } = req.body;

    const message = await twilio.messages.create({
      body,
      from: fromNumber,
      to,
    });

    res.json({ success: true, sid: message.sid, status: message.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk SMS
app.post('/api/send-sms-bulk', async (req, res) => {
  try {
    const accountSid = req.body.twilioSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = req.body.twilioToken || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = req.body.twilioFrom || process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) return res.status(400).json({ error: 'Twilio not configured' });

    const twilio = require('twilio')(accountSid, authToken);
    const { recipients } = req.body;
    // recipients: [{phone, body}]

    const results = [];
    for (const r of recipients) {
      try {
        const msg = await twilio.messages.create({ body: r.body, from: fromNumber, to: r.phone });
        results.push({ phone: r.phone, success: true, sid: msg.sid });
      } catch (err) {
        results.push({ phone: r.phone, success: false, error: err.message });
      }
    }

    res.json({ results, sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test email connection
app.post('/api/test-email', async (req, res) => {
  try {
    const apiKey = req.body.resendApiKey || process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'No API key' });
    const resend = new Resend(apiKey);
    // Just validate the key by listing domains
    await resend.domains.list();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test SMS connection
app.post('/api/test-sms', async (req, res) => {
  try {
    const accountSid = req.body.twilioSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = req.body.twilioToken || process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return res.status(400).json({ error: 'No credentials' });
    const twilio = require('twilio')(accountSid, authToken);
    await twilio.api.accounts(accountSid).fetch();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stripe: GymKit Platform Subscriptions ──

// Price IDs — set these in .env or they'll be created dynamically
const PLAN_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || null,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL || null,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || null,
};

// Create or retrieve a Stripe customer for a gym
app.post('/api/subscription/create-customer', async (req, res) => {
  try {
    const { email, gymName, gymId } = req.body;
    // Check if customer already exists
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      return res.json({ customerId: existing.data[0].id });
    }
    const customer = await stripe.customers.create({
      email,
      name: gymName,
      metadata: { gymId, platform: 'gymkit' },
    });
    res.json({ customerId: customer.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create a subscription with a trial period
app.post('/api/subscription/create', async (req, res) => {
  try {
    const { customerId, planId, trialDays = 14 } = req.body;
    const priceId = PLAN_PRICES[planId];

    if (!priceId) {
      return res.status(400).json({ error: `No Stripe price configured for plan: ${planId}. Set STRIPE_PRICE_${planId.toUpperCase()} in your environment.` });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: trialDays,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    res.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret || null,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get subscription status
app.post('/api/subscription/status', async (req, res) => {
  try {
    const { customerId } = req.body;
    const subs = await stripe.subscriptions.list({ customer: customerId, limit: 1, status: 'all' });
    if (subs.data.length === 0) return res.json({ subscription: null });

    const sub = subs.data[0];
    res.json({
      subscription: {
        id: sub.id,
        status: sub.status,
        planId: sub.items.data[0]?.price?.id,
        planAmount: sub.items.data[0]?.price?.unit_amount / 100,
        planInterval: sub.items.data[0]?.price?.recurring?.interval,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create a Stripe Customer Portal session (for gym owners to manage billing)
app.post('/api/subscription/portal', async (req, res) => {
  try {
    const { customerId, returnUrl } = req.body;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${req.headers.origin || 'http://localhost:3001'}/`,
    });
    res.json({ url: session.url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cancel subscription
app.post('/api/subscription/cancel', async (req, res) => {
  try {
    const { subscriptionId, immediate = false } = req.body;
    if (immediate) {
      const sub = await stripe.subscriptions.cancel(subscriptionId);
      res.json({ status: sub.status });
    } else {
      const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      res.json({ status: sub.status, cancelAt: new Date(sub.current_period_end * 1000).toISOString() });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Resume cancelled subscription
app.post('/api/subscription/resume', async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
    res.json({ status: sub.status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Change plan
app.post('/api/subscription/change-plan', async (req, res) => {
  try {
    const { subscriptionId, newPlanId } = req.body;
    const priceId = PLAN_PRICES[newPlanId];
    if (!priceId) return res.status(400).json({ error: `No price for plan: ${newPlanId}` });

    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: sub.items.data[0].id, price: priceId }],
      proration_behavior: 'always_invoice',
    });
    res.json({
      status: updated.status,
      planAmount: updated.items.data[0]?.price?.unit_amount / 100,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI: voice memo → structured progress report (via OpenRouter) ──
// Keeps the OpenRouter key server-side. Set OPENROUTER_API_KEY (and optionally
// OPENROUTER_MODEL) as Fly secrets.
app.post('/api/ai/progress-report', async (req, res) => {
  try {
    const { transcript, memberName, previousGoal, previousActionSteps } = req.body || {};
    if (!transcript || !String(transcript).trim()) {
      return res.status(400).json({ error: 'No transcript provided' });
    }
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI not configured — set OPENROUTER_API_KEY on the server' });
    }
    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

    const system = `You turn a fitness coach's rambling voice memo about a client's week into a structured weekly progress report. Respond with ONLY a JSON object (no markdown fences) with these string fields:
- "goal": the client's overarching long-term goal. ${previousGoal ? `If the memo doesn't mention one, keep the previous goal: ${JSON.stringify(previousGoal)}` : 'If the memo does not state one, infer it briefly or leave "".'}
- "targetReview": ${previousActionSteps ? `review of LAST week's targets, one per line. Last week's targets were: ${JSON.stringify(previousActionSteps)}. For each, state the target and how the client did based on the memo — start the line with "✅" (hit it), "🟡" (partial), or "❌" (missed). If the memo doesn't mention a target, use "🟡" and note "not mentioned this week".` : 'leave "" (there was no previous report).'}
- "wins": the wins from this week, one per line (newline-separated). Written TO the client ("You hit all 3 sessions"), celebratory but factual.
- "improvements": areas to improve, one per line, constructive and kind.
- "actionSteps": specific action steps for the upcoming week, one per line, concrete and doable.
- "notes": a short warm personal note from the coach to the client capturing anything else from the memo, or "".
Only include things grounded in the memo. Keep each line under 100 characters.`;

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gymkit-app.netlify.app',
        'X-Title': 'GymKit Progress Reports',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Client: ${memberName || 'the client'}\n\nCoach's voice memo:\n${transcript}` },
        ],
        temperature: 0.4,
        max_tokens: 900,
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return res.status(502).json({ error: `OpenRouter error ${r.status}`, detail: detail.slice(0, 300) });
    }
    const data = await r.json();
    let text = data.choices?.[0]?.message?.content || '';
    // Strip accidental markdown fences and parse
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    let report;
    try { report = JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { report = JSON.parse(m[0]); } catch {} }
    }
    if (!report || typeof report !== 'object') {
      return res.status(502).json({ error: 'AI returned unparseable output', detail: text.slice(0, 300) });
    }
    const str = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? v.join('\n') : '');
    res.json({
      goal: str(report.goal), targetReview: str(report.targetReview), wins: str(report.wins),
      improvements: str(report.improvements), actionSteps: str(report.actionSteps), notes: str(report.notes),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Health ──
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Stripe server running on port ${PORT}`));
