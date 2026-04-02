require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

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

// ── Health ──
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Stripe server running on port ${PORT}`));
