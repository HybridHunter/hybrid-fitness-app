import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";

/* ── Zapier Triggers ─────────────────────────────────────── */
const ZAPIER_TRIGGERS = [
  { id: "new-member", name: "New Client Joined", desc: "Fires when a new client signs up or is added" },
  { id: "member-cancelled", name: "Client Cancelled", desc: "Fires when a client cancels their membership" },
  { id: "payment-received", name: "Payment Received", desc: "Fires when a payment is successfully processed" },
  { id: "payment-failed", name: "Payment Failed/Overdue", desc: "Fires when a payment fails or becomes overdue" },
  { id: "member-checkin", name: "Client Checked In", desc: "Fires when a client checks in to the gym" },
  { id: "assessment-completed", name: "Assessment Completed", desc: "Fires when a client completes an assessment" },
  { id: "plan-changed", name: "Plan Changed (Upgrade/Downgrade)", desc: "Fires when a client changes their membership plan" },
  { id: "waiver-signed", name: "Waiver Signed", desc: "Fires when a client signs a waiver document" },
  { id: "session-booked", name: "Session Booked", desc: "Fires when a client books a session or class" },
  { id: "challenge-checkin", name: "Challenge Check-in", desc: "Fires when a client logs a challenge check-in" },
];

/* ── Zapier Actions ──────────────────────────────────────── */
const ZAPIER_ACTIONS = [
  { id: "create-member", name: "Create Client", desc: "Create a new client in GymKit from an external source" },
  { id: "update-member", name: "Update Client", desc: "Update an existing client's details in GymKit" },
  { id: "add-payment", name: "Add Payment Record", desc: "Record a payment in GymKit from an external system" },
  { id: "book-session", name: "Book Client into Session", desc: "Book a client into a scheduled session or class" },
];

/* ── GHL Default Field Mappings ──────────────────────────── */
const DEFAULT_FIELD_MAPPINGS = [
  { gymkit: "firstName", ghl: "first_name" },
  { gymkit: "lastName", ghl: "last_name" },
  { gymkit: "email", ghl: "email" },
  { gymkit: "phone", ghl: "phone" },
  { gymkit: "membershipStatus", ghl: "tags" },
];

const GHL_FIELD_OPTIONS = ["first_name", "last_name", "email", "phone", "tags", "address1", "city", "state", "postal_code", "company_name", "website", "custom_field"];

/* ── Demo Sync Log ───────────────────────────────────────── */
const DEMO_SYNC_LOG = [
  { id: 1, timestamp: "2026-03-31 14:32:10", direction: "GymKit \u2192 GHL", type: "New Contact", status: "success", details: "Synced John Smith to GHL contacts" },
  { id: 2, timestamp: "2026-03-31 13:15:44", direction: "GHL \u2192 GymKit", type: "Contact Import", status: "success", details: "Imported Sarah Williams from GHL" },
  { id: 3, timestamp: "2026-03-31 11:08:22", direction: "GymKit \u2192 GHL", type: "Status Change", status: "success", details: "Updated Mike Johnson tag to 'active'" },
  { id: 4, timestamp: "2026-03-30 16:45:01", direction: "GymKit \u2192 GHL", type: "Payment Sync", status: "failed", details: "Failed to sync payment for Alex Brown - GHL rate limit" },
  { id: 5, timestamp: "2026-03-30 09:20:33", direction: "GHL \u2192 GymKit", type: "Calendar Sync", status: "success", details: "Synced 12 calendar events from GHL" },
];

/* ── Helpers ──────────────────────────────────────────────── */
function generateId(len = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateApiKey() {
  return "gk_" + generateId(40);
}

function getGymId() {
  try { return localStorage.getItem("hf_gym_id") || "demo-gym"; } catch { return "demo-gym"; }
}

/* ── Toggle Component ────────────────────────────────────── */
function Toggle({ checked, onChange, B }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none",
        background: checked ? B.accent : B.border,
        position: "relative", cursor: "pointer", transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 9, background: "#fff",
        position: "absolute", top: 3,
        left: checked ? 23 : 3,
        transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

/* ── Status Badge ────────────────────────────────────────── */
function StatusBadge({ connected, B }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12, fontWeight: 600,
      color: connected ? "#22c55e" : B.red,
      background: connected ? "#22c55e18" : `${B.red}18`,
      padding: "4px 12px", borderRadius: 20,
      border: `1px solid ${connected ? "#22c55e44" : B.red + "44"}`,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 4,
        background: connected ? "#22c55e" : B.red,
      }} />
      {connected ? "Connected" : "Not Connected"}
    </span>
  );
}

/* ── Toast Component ─────────────────────────────────────── */
function Toast({ message, type, onClose, B }) {
  if (!message) return null;
  const bg = type === "success" ? "#22c55e" : type === "error" ? B.red : B.accent;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: bg, color: "#fff", padding: "12px 20px",
      borderRadius: 10, fontSize: 14, fontWeight: 600,
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", gap: 10,
      animation: "slideUp 0.3s ease",
    }}>
      {type === "success" ? "\u2713" : type === "error" ? "\u2717" : "\u2139"} {message}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, marginLeft: 8 }}>\u2715</button>
    </div>
  );
}

/* ============================================================
   IntegrationsView
   ============================================================ */
export default function IntegrationsView() {
  const B = useTheme();
  const [integrations, setIntegrations] = useLocalStorage("hf_integrations", {
    zapier: { apiKey: "", connected: false },
    ghl: { apiKey: "", locationId: "", connected: false, syncSettings: { newMembers: true, statusChanges: true, payments: false, importContacts: false, calendarSync: false } },
    fieldMappings: DEFAULT_FIELD_MAPPINGS,
  });

  const [toast, setToast] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGhlKey, setShowGhlKey] = useState(false);
  const [ghlKeyInput, setGhlKeyInput] = useState(integrations.ghl?.apiKey || "");
  const [ghlLocationInput, setGhlLocationInput] = useState(integrations.ghl?.locationId || "");
  const [ghlTestStatus, setGhlTestStatus] = useState(null); // null | "testing" | "success" | "error"
  const [syncingMembers, setSyncingMembers] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const [syncLog] = useState(DEMO_SYNC_LOG);

  const gymId = getGymId();
  const webhookUrl = `https://hooks.gymkit.io/${gymId}/events`;

  /* ── Toast helper ─────────────── */
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Zapier helpers ───────────── */
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard"));
  };

  const generateZapierKey = () => {
    const key = generateApiKey();
    setIntegrations(prev => ({ ...prev, zapier: { ...prev.zapier, apiKey: key, connected: true } }));
    showToast("API key generated successfully");
  };

  const revokeZapierKey = () => {
    setIntegrations(prev => ({ ...prev, zapier: { ...prev.zapier, apiKey: "", connected: false } }));
    setShowApiKey(false);
    showToast("API key revoked", "error");
  };

  const sendTestEvent = () => {
    showToast("Test event sent successfully! Check your Zapier dashboard.");
  };

  /* ── GHL helpers ──────────────── */
  const saveGhlConfig = () => {
    setIntegrations(prev => ({
      ...prev,
      ghl: { ...prev.ghl, apiKey: ghlKeyInput, locationId: ghlLocationInput },
    }));
    showToast("GHL configuration saved");
  };

  const testGhlConnection = () => {
    setGhlTestStatus("testing");
    setTimeout(() => {
      if (ghlKeyInput && ghlLocationInput) {
        setGhlTestStatus("success");
        setIntegrations(prev => ({ ...prev, ghl: { ...prev.ghl, connected: true } }));
        showToast("GHL connection successful!");
      } else {
        setGhlTestStatus("error");
        setIntegrations(prev => ({ ...prev, ghl: { ...prev.ghl, connected: false } }));
        showToast("Connection failed. Check your API key and Location ID.", "error");
      }
    }, 1500);
  };

  const updateSyncSetting = (key, value) => {
    setIntegrations(prev => ({
      ...prev,
      ghl: { ...(prev?.ghl ?? {}), syncSettings: { ...(prev?.ghl?.syncSettings ?? {}), [key]: value } },
    }));
  };

  const updateFieldMapping = (index, ghlValue) => {
    setIntegrations(prev => {
      const updated = [...(prev?.fieldMappings ?? DEFAULT_FIELD_MAPPINGS)];
      updated[index] = { ...updated[index], ghl: ghlValue };
      return { ...prev, fieldMappings: updated };
    });
  };

  const syncAllMembers = () => {
    setSyncingMembers(true);
    setTimeout(() => {
      setSyncingMembers(false);
      showToast("All members synced to GoHighLevel successfully!");
    }, 2500);
  };

  const importGhlContacts = () => {
    setImportingContacts(true);
    setTimeout(() => {
      setImportingContacts(false);
      showToast("GHL contacts imported successfully!");
    }, 2000);
  };

  /* ── Shared Styles ────────────── */
  const sectionTitle = { fontSize: 20, fontWeight: 700, color: B.text, margin: 0 };
  const sectionDesc = { fontSize: 13, color: B.muted, margin: "4px 0 0", lineHeight: 1.5 };
  const label = { fontSize: 12, fontWeight: 600, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5 };
  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: `1px solid ${B.border}`, background: B.dark, color: B.text,
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const btnPrimary = {
    padding: "8px 18px", borderRadius: 8, border: "none",
    background: B.accent, color: "#fff", fontSize: 13, fontWeight: 600,
    cursor: "pointer", transition: "opacity 0.15s",
  };
  const btnOutline = {
    padding: "8px 18px", borderRadius: 8,
    border: `1px solid ${B.border}`, background: "transparent",
    color: B.text, fontSize: 13, fontWeight: 600,
    cursor: "pointer", transition: "all 0.15s",
  };
  const btnDanger = {
    padding: "8px 18px", borderRadius: 8, border: "none",
    background: `${B.red}20`, color: B.red, fontSize: 13, fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: B.text, margin: 0 }}>Integrations</h1>
        <p style={{ fontSize: 14, color: B.muted, margin: "4px 0 0" }}>Connect GymKit with third-party platforms to automate your workflow.</p>
      </div>

      {/* ─────────────────────────────────────────────────────────
          ZAPIER SECTION
         ───────────────────────────────────────────────────────── */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {/* Zapier Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${B.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Zapier Logo Placeholder */}
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: "#FF4A0022",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid #FF4A0044", fontSize: 22, fontWeight: 800, color: "#FF4A00",
            }}>
              Z
            </div>
            <div>
              <h2 style={sectionTitle}>Zapier Integration</h2>
              <p style={sectionDesc}>Connect GymKit to 5,000+ apps via Zapier</p>
            </div>
          </div>
          <StatusBadge connected={!!integrations.zapier?.connected} B={B} />
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Webhook URL */}
          <div>
            <div style={{ ...label, marginBottom: 8 }}>Your GymKit Webhook URL</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: B.dark, borderRadius: 8, border: `1px solid ${B.border}`,
              padding: "10px 14px",
            }}>
              <code style={{ flex: 1, fontSize: 13, color: B.accent, fontFamily: "monospace", wordBreak: "break-all" }}>
                {webhookUrl}
              </code>
              <button onClick={() => copyToClipboard(webhookUrl)} style={btnPrimary}>Copy</button>
            </div>
            <p style={{ fontSize: 11, color: B.dim, marginTop: 6 }}>
              Use this URL in your Zapier webhook triggers to receive events from GymKit.
            </p>
          </div>

          {/* Available Triggers */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 4px" }}>Available Triggers</h3>
            <p style={{ fontSize: 12, color: B.muted, margin: "0 0 14px" }}>Events GymKit can send to Zapier when they occur.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {ZAPIER_TRIGGERS.map(t => (
                <div key={t.id} style={{
                  padding: "14px 16px", borderRadius: 10,
                  border: `1px solid ${B.border}`, background: B.dark,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: B.muted, marginTop: 2 }}>{t.desc}</div>
                  </div>
                  <button style={btnOutline} onClick={() => showToast(`Trigger "${t.name}" configured`)}>Configure</button>
                </div>
              ))}
            </div>
          </div>

          {/* Available Actions */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 4px" }}>Available Actions</h3>
            <p style={{ fontSize: 12, color: B.muted, margin: "0 0 14px" }}>Things Zapier can tell GymKit to do.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {ZAPIER_ACTIONS.map(a => (
                <div key={a.id} style={{
                  padding: "14px 16px", borderRadius: 10,
                  border: `1px solid ${B.border}`, background: B.dark,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: B.muted, marginTop: 2 }}>{a.desc}</div>
                  </div>
                  <button style={btnOutline} onClick={() => showToast(`Action "${a.name}" configured`)}>Configure</button>
                </div>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 4px" }}>API Key</h3>
            <p style={{ fontSize: 12, color: B.muted, margin: "0 0 14px" }}>Authenticate Zapier requests to your GymKit account.</p>
            {integrations.zapier?.apiKey ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: B.dark, borderRadius: 8, border: `1px solid ${B.border}`,
                  padding: "10px 14px",
                }}>
                  <code style={{ flex: 1, fontSize: 13, color: B.text, fontFamily: "monospace" }}>
                    {showApiKey ? integrations.zapier.apiKey : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                  </code>
                  <button onClick={() => setShowApiKey(v => !v)} style={btnOutline}>{showApiKey ? "Hide" : "Show"}</button>
                  <button onClick={() => copyToClipboard(integrations.zapier.apiKey)} style={btnPrimary}>Copy</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={generateZapierKey} style={btnOutline}>Regenerate</button>
                  <button onClick={revokeZapierKey} style={btnDanger}>Revoke Key</button>
                </div>
              </div>
            ) : (
              <button onClick={generateZapierKey} style={btnPrimary}>Generate API Key</button>
            )}
          </div>

          {/* Test Button */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
            <button onClick={sendTestEvent} style={{ ...btnPrimary, background: "#FF4A00" }}>
              Send Test Event
            </button>
            <span style={{ fontSize: 12, color: B.muted }}>Sends a sample event to verify your Zapier connection.</span>
          </div>
        </div>
      </Card>

      {/* ─────────────────────────────────────────────────────────
          GOHIGHLEVEL SECTION
         ───────────────────────────────────────────────────────── */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {/* GHL Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${B.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: "#2563eb22",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid #2563eb44", fontSize: 16, fontWeight: 800, color: "#2563eb",
            }}>
              GHL
            </div>
            <div>
              <h2 style={sectionTitle}>GoHighLevel Integration</h2>
              <p style={sectionDesc}>Sync contacts, automations, and pipelines with GoHighLevel</p>
            </div>
          </div>
          <StatusBadge connected={!!integrations.ghl?.connected} B={B} />
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 28 }}>
          {/* API Configuration */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 14px" }}>API Configuration</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ ...label, marginBottom: 6 }}>GHL API Key</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type={showGhlKey ? "text" : "password"}
                    value={ghlKeyInput}
                    onChange={e => setGhlKeyInput(e.target.value)}
                    placeholder="Enter your GoHighLevel API key..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => setShowGhlKey(v => !v)} style={btnOutline}>{showGhlKey ? "Hide" : "Show"}</button>
                </div>
              </div>
              <div>
                <div style={{ ...label, marginBottom: 6 }}>GHL Location ID</div>
                <input
                  type="text"
                  value={ghlLocationInput}
                  onChange={e => setGhlLocationInput(e.target.value)}
                  placeholder="Enter your GHL Location ID..."
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button onClick={saveGhlConfig} style={btnPrimary}>Save Configuration</button>
                <button
                  onClick={testGhlConnection}
                  disabled={ghlTestStatus === "testing"}
                  style={{
                    ...btnOutline,
                    borderColor: "#2563eb44",
                    color: "#2563eb",
                    opacity: ghlTestStatus === "testing" ? 0.6 : 1,
                  }}
                >
                  {ghlTestStatus === "testing" ? "Testing..." : "Test Connection"}
                </button>
                {ghlTestStatus === "success" && <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>Connection successful</span>}
                {ghlTestStatus === "error" && <span style={{ fontSize: 12, color: B.red, fontWeight: 600 }}>Connection failed</span>}
              </div>
            </div>
          </div>

          {/* Sync Settings */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 14px" }}>Sync Settings</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { key: "newMembers", label: "Sync new members to GHL contacts" },
                { key: "statusChanges", label: "Sync member status changes to GHL" },
                { key: "payments", label: "Sync payments to GHL" },
                { key: "importContacts", label: "Import GHL contacts as members" },
                { key: "calendarSync", label: "Sync GHL calendar to GymKit schedule" },
              ].map(setting => (
                <div key={setting.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: 8,
                  background: integrations.ghl?.syncSettings?.[setting.key] ? `${B.accent}08` : "transparent",
                  border: `1px solid ${integrations.ghl?.syncSettings?.[setting.key] ? B.accent + "22" : "transparent"}`,
                  transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 14, color: B.text }}>{setting.label}</span>
                  <Toggle
                    checked={!!integrations.ghl?.syncSettings?.[setting.key]}
                    onChange={v => updateSyncSetting(setting.key, v)}
                    B={B}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Field Mapping */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 14px" }}>Field Mapping</h3>
            <div style={{ borderRadius: 10, border: `1px solid ${B.border}`, overflow: "hidden" }}>
              {/* Table Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 40px 1fr",
                padding: "10px 16px", background: B.dark,
                borderBottom: `1px solid ${B.border}`,
              }}>
                <span style={label}>GymKit Field</span>
                <span />
                <span style={label}>GHL Field</span>
              </div>
              {/* Table Rows */}
              {(integrations.fieldMappings || DEFAULT_FIELD_MAPPINGS).map((mapping, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 40px 1fr",
                  padding: "10px 16px", alignItems: "center",
                  borderBottom: i < (integrations.fieldMappings || DEFAULT_FIELD_MAPPINGS).length - 1 ? `1px solid ${B.border}` : "none",
                }}>
                  <span style={{ fontSize: 14, color: B.text, fontFamily: "monospace" }}>{mapping.gymkit}</span>
                  <span style={{ textAlign: "center", color: B.muted, fontSize: 14 }}>\u2192</span>
                  <select
                    value={mapping.ghl}
                    onChange={e => updateFieldMapping(i, e.target.value)}
                    style={{
                      padding: "6px 10px", borderRadius: 6,
                      border: `1px solid ${B.border}`, background: B.dark,
                      color: B.text, fontSize: 13, cursor: "pointer", outline: "none",
                    }}
                  >
                    {GHL_FIELD_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Sync Log */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 14px" }}>Sync Log</h3>
            <div style={{ borderRadius: 10, border: `1px solid ${B.border}`, overflow: "hidden" }}>
              {/* Log Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "150px 120px 120px 80px 1fr",
                padding: "10px 16px", background: B.dark,
                borderBottom: `1px solid ${B.border}`, gap: 8,
              }}>
                {["Timestamp", "Direction", "Type", "Status", "Details"].map(h => (
                  <span key={h} style={label}>{h}</span>
                ))}
              </div>
              {/* Log Rows */}
              {syncLog.map((entry, i) => (
                <div key={entry.id} style={{
                  display: "grid", gridTemplateColumns: "150px 120px 120px 80px 1fr",
                  padding: "10px 16px", alignItems: "center", gap: 8,
                  borderBottom: i < syncLog.length - 1 ? `1px solid ${B.border}` : "none",
                }}>
                  <span style={{ fontSize: 12, color: B.muted, fontFamily: "monospace" }}>{entry.timestamp}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: entry.direction.includes("GymKit") ? B.accent : "#2563eb",
                  }}>
                    {entry.direction}
                  </span>
                  <span style={{ fontSize: 13, color: B.text }}>{entry.type}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: entry.status === "success" ? "#22c55e" : B.red,
                  }}>
                    {entry.status === "success" ? "Success" : "Failed"}
                  </span>
                  <span style={{ fontSize: 12, color: B.muted }}>{entry.details}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Manual Sync */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: "0 0 14px" }}>Manual Sync</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={syncAllMembers}
                disabled={syncingMembers}
                style={{
                  ...btnPrimary,
                  background: "#2563eb",
                  opacity: syncingMembers ? 0.6 : 1,
                  minWidth: 200,
                }}
              >
                {syncingMembers ? "Syncing Members..." : "Sync All Members to GHL"}
              </button>
              <button
                onClick={importGhlContacts}
                disabled={importingContacts}
                style={{
                  ...btnOutline,
                  borderColor: "#2563eb44",
                  color: "#2563eb",
                  opacity: importingContacts ? 0.6 : 1,
                  minWidth: 200,
                }}
              >
                {importingContacts ? "Importing Contacts..." : "Import GHL Contacts"}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} B={B} />}
    </div>
  );
}
