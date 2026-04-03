require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const { Resend } = require('resend');

const app = express();
app.use(cors());
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
    const existing = await stripe.customers.list({ email: memberEmail, limit: 1 });
    if (existing.data.length > 0) { customer = existing.data[0]; }
    else { customer = await stripe.customers.create({ name: memberName, email: memberEmail || undefined }); }
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

// ── Health ──
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Stripe server running on port ${PORT}`));
