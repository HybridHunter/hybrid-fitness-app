const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function getIntegrations() {
  try { return JSON.parse(localStorage.getItem('hf_integrations') || '{}'); } catch { return {}; }
}

function getBranding() {
  try { return JSON.parse(localStorage.getItem('hf_branding') || '{}'); } catch { return {}; }
}

function buildBrandedHtml(html) {
  const branding = getBranding();
  const gymName = branding.gymName || 'GymKit';
  return `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <div style="background:${branding.primaryColor || '#8fbf3b'};padding:20px;text-align:center;">
        ${branding.logo ? `<img src="${branding.logo}" alt="${gymName}" style="max-height:50px;">` : `<h1 style="color:#fff;margin:0;">${gymName}</h1>`}
      </div>
      <div style="padding:24px;background:#fff;color:#333;">
        ${html}
      </div>
      <div style="padding:16px;text-align:center;font-size:12px;color:#999;">
        Sent from ${gymName} via GymKit
      </div>
    </div>
  `;
}

function getFromEmail() {
  const integrations = getIntegrations();
  const branding = getBranding();
  const gymName = branding.gymName || 'GymKit';
  return integrations.emailFrom || `${gymName} <noreply@gymkit.io>`;
}

// If gym has their own keys, use them. Otherwise send empty (server uses platform keys).
function getEmailKey() {
  const integrations = getIntegrations();
  return integrations.messagingMode === 'byok' ? integrations.resendApiKey : undefined;
}

function getSmsCredentials() {
  const integrations = getIntegrations();
  if (integrations.messagingMode === 'byok') {
    return { twilioSid: integrations.twilioSid, twilioToken: integrations.twilioToken, twilioFrom: integrations.twilioFrom };
  }
  return {}; // Server will use platform keys
}

export async function sendEmail({ to, subject, html, text }) {
  const brandedHtml = buildBrandedHtml(html);
  const res = await fetch(`${API_BASE}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resendApiKey: getEmailKey(),
      to, subject, html: brandedHtml, text,
      from: getFromEmail(),
    }),
  });
  return res.json();
}

export async function sendSMS({ to, body }) {
  const creds = getSmsCredentials();
  const res = await fetch(`${API_BASE}/api/send-sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, to, body }),
  });
  return res.json();
}

export async function sendBulkEmail({ recipients, subject, html, text }) {
  const brandedHtml = buildBrandedHtml(html);
  const res = await fetch(`${API_BASE}/api/send-email-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resendApiKey: getEmailKey(),
      recipients, subject, html: brandedHtml, text,
      from: getFromEmail(),
    }),
  });
  return res.json();
}

export function replaceVariables(template, vars = {}) {
  if (!template) return '';
  return template
    .replace(/\{firstName\}/g, vars.firstName || 'Client')
    .replace(/\{gymName\}/g, vars.gymName || getBranding().gymName || 'GymKit')
    .replace(/\{amount\}/g, vars.amount || '$0.00')
    .replace(/\{className\}/g, vars.className || 'Session')
    .replace(/\{time\}/g, vars.time || 'TBD');
}
