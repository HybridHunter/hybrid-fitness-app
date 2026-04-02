import { useState, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";

/* ========== constants ========== */
const TABS = ["General", "Integrations", "Branding", "Locations", "Users"];
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
  "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney",
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DEFAULT_SETTINGS = {
  gymName: "Hybrid Fitness",
  phone: "(555) 000-1234",
  email: "info@hybridfitness.com",
  address: "123 Main Street, Austin, TX 78701",
  timezone: "America/Chicago",
  businessHours: Object.fromEntries(DAYS.map(d => [d, {
    open: d === "Sunday" ? "08:00" : "05:30",
    close: d === "Sunday" ? "18:00" : d === "Saturday" ? "20:00" : "21:00",
    closed: false,
  }])),
};

const DEFAULT_BRANDING = {
  logo: "",
  primaryColor: "#8fbf3b",
  secondaryColor: "#063461",
  tagline: "Train Smarter. Live Stronger.",
  gymName: "Hybrid Fitness",
};

const DEFAULT_LOCATIONS = [
  { id: "loc_1", name: "Hybrid Fitness \u2014 Main", address: "123 Main Street, Austin, TX 78701", phone: "(555) 000-1234", timezone: "America/Chicago", isDefault: true },
];

export default function SettingsView() {
  const B = useTheme();
  const { currentUser, users, addUser, removeUser } = useAuth();
  const [activeTab, setActiveTab] = useState("General");
  const [toast, setToast] = useState("");

  const [settings, setSettings] = useLocalStorage("hf_settings", DEFAULT_SETTINGS);
  const [integrations, setIntegrations] = useLocalStorage("hf_integrations", {
    stripe: { publishableKey: "", connected: false },
    inbody: { apiKey: "", environment: "sandbox", lastSync: null },
  });
  const [branding, setBranding] = useLocalStorage("hf_branding", DEFAULT_BRANDING);
  const [locations, setLocations] = useLocalStorage("hf_locations", DEFAULT_LOCATIONS);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "coach", displayName: "" });

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const updateSettings = useCallback((key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  }, [setSettings]);

  const updateHours = useCallback((day, field, val) => {
    setSettings(prev => ({
      ...prev,
      businessHours: { ...prev.businessHours, [day]: { ...prev.businessHours[day], [field]: val } },
    }));
  }, [setSettings]);

  /* ========== styles ========== */
  const s = {
    page: { padding: 32, maxWidth: 1100, margin: "0 auto" },
    h1: { fontSize: 28, fontWeight: 700, color: B.text, margin: 0 },
    subtitle: { color: B.muted, fontSize: 14, marginTop: 4 },
    tabs: { display: "flex", gap: 4, marginTop: 24, marginBottom: 24, borderBottom: "1px solid " + B.border, paddingBottom: 0 },
    tab: (active) => ({ padding: "10px 20px", fontSize: 14, fontWeight: active ? 600 : 400, color: active ? B.green : B.muted, background: "none", border: "none", borderBottom: active ? "2px solid " + B.green : "2px solid transparent", cursor: "pointer", marginBottom: -1 }),
    label: { fontSize: 13, fontWeight: 600, color: B.muted, marginBottom: 6, display: "block" },
    input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 14, boxSizing: "border-box" },
    select: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 14, boxSizing: "border-box" },
    btn: (bg, fg) => ({ padding: "9px 20px", borderRadius: 8, border: "none", background: bg || B.green, color: fg || "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }),
    btnSm: (bg, fg) => ({ padding: "5px 12px", borderRadius: 6, border: "none", background: bg || B.border, color: fg || B.text, fontWeight: 500, fontSize: 12, cursor: "pointer" }),
    row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
    field: { marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 600, color: B.text, marginBottom: 12, marginTop: 20 },
    badge: (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: color + "22", color }),
    dot: (color) => ({ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 8 }),
    table: { width: "100%", borderCollapse: "collapse" },
    th: { textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 600, color: B.muted, borderBottom: "1px solid " + B.border, textTransform: "uppercase", letterSpacing: 0.5 },
    td: { padding: "10px 12px", borderBottom: "1px solid " + B.border, fontSize: 14, color: B.text },
    toast: { position: "fixed", bottom: 24, right: 24, background: B.green, color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" },
  };

  /* ========== General ========== */
  const renderGeneral = () => (
    <Card>
      <h3 style={s.sectionTitle}>Gym Information</h3>
      <div style={s.row}>
        <div>
          <label style={s.label}>Gym Name</label>
          <input style={s.input} value={settings.gymName} onChange={e => updateSettings("gymName", e.target.value)} />
        </div>
        <div>
          <label style={s.label}>Phone</label>
          <input style={s.input} value={settings.phone} onChange={e => updateSettings("phone", e.target.value)} />
        </div>
      </div>
      <div style={s.row}>
        <div>
          <label style={s.label}>Email</label>
          <input style={s.input} value={settings.email} onChange={e => updateSettings("email", e.target.value)} />
        </div>
        <div>
          <label style={s.label}>Timezone</label>
          <select style={s.select} value={settings.timezone} onChange={e => updateSettings("timezone", e.target.value)}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>
      <div style={s.field}>
        <label style={s.label}>Address</label>
        <input style={s.input} value={settings.address} onChange={e => updateSettings("address", e.target.value)} />
      </div>

      <h3 style={s.sectionTitle}>Business Hours</h3>
      <div style={{ display: "grid", gap: 8 }}>
        {DAYS.map(day => {
          const h = settings.businessHours?.[day] || { open: "06:00", close: "21:00", closed: false };
          return (
            <div key={day} style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr auto", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 14, color: B.text, fontWeight: 500 }}>{day}</span>
              <input type="time" style={{ ...s.input, opacity: h.closed ? 0.3 : 1 }} value={h.open} disabled={h.closed} onChange={e => updateHours(day, "open", e.target.value)} />
              <input type="time" style={{ ...s.input, opacity: h.closed ? 0.3 : 1 }} value={h.close} disabled={h.closed} onChange={e => updateHours(day, "close", e.target.value)} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: B.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={h.closed || false} onChange={e => updateHours(day, "closed", e.target.checked)} style={{ accentColor: B.green }} />
                Closed
              </label>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20 }}>
        <button style={s.btn()} onClick={() => showToast("Settings saved!")}>Save Settings</button>
      </div>
    </Card>
  );

  /* ========== Integrations ========== */
  const renderIntegrations = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ ...s.sectionTitle, margin: 0 }}>Stripe Payments</h3>
          <span style={s.badge(integrations.stripe.connected ? B.green : B.orange)}>
            <span style={s.dot(integrations.stripe.connected ? B.green : B.orange)} />
            {integrations.stripe.connected ? "Connected" : "Not Connected"}
          </span>
        </div>
        <div style={{ ...s.field, marginTop: 16 }}>
          <label style={s.label}>Publishable Key</label>
          <input style={s.input} value={integrations.stripe.publishableKey} onChange={e => setIntegrations(prev => ({ ...prev, stripe: { ...prev.stripe, publishableKey: e.target.value } }))} placeholder="pk_live_..." />
        </div>
        <p style={{ fontSize: 12, color: B.muted, margin: "0 0 16px" }}>Secret key should be configured server-side only. Never expose it in the client.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.btn()} onClick={() => {
            setIntegrations(prev => ({ ...prev, stripe: { ...prev.stripe, connected: !!prev.stripe.publishableKey } }));
            showToast(integrations.stripe.publishableKey ? "Stripe connection successful!" : "Please enter a publishable key first.");
          }}>Test Connection</button>
          <button style={s.btn(B.border, B.text)} onClick={() => {
            setIntegrations(prev => ({ ...prev, stripe: { publishableKey: "", connected: false } }));
            showToast("Stripe disconnected.");
          }}>Disconnect</button>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ ...s.sectionTitle, margin: 0 }}>InBody Scanner</h3>
          <span style={s.badge(integrations.inbody.apiKey ? B.green : B.dim)}>
            <span style={s.dot(integrations.inbody.apiKey ? B.green : B.dim)} />
            {integrations.inbody.apiKey ? "Configured" : "Not Configured"}
          </span>
        </div>
        <div style={{ ...s.row, marginTop: 16 }}>
          <div>
            <label style={s.label}>API Key</label>
            <input style={s.input} value={integrations.inbody.apiKey} onChange={e => setIntegrations(prev => ({ ...prev, inbody: { ...prev.inbody, apiKey: e.target.value } }))} placeholder="Enter InBody API key" />
          </div>
          <div>
            <label style={s.label}>Environment</label>
            <select style={s.select} value={integrations.inbody.environment} onChange={e => setIntegrations(prev => ({ ...prev, inbody: { ...prev.inbody, environment: e.target.value } }))}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
        </div>
        {integrations.inbody.lastSync && (
          <p style={{ fontSize: 12, color: B.muted, margin: "0 0 12px" }}>Last sync: {new Date(integrations.inbody.lastSync).toLocaleString()}</p>
        )}
        <button style={s.btn()} onClick={() => {
          if (!integrations.inbody.apiKey) { showToast("Please enter an API key first."); return; }
          setIntegrations(prev => ({ ...prev, inbody: { ...prev.inbody, lastSync: new Date().toISOString() } }));
          showToast("InBody sync complete!");
        }}>Sync Now</button>
      </Card>
    </div>
  );

  /* ========== Branding ========== */
  const renderBranding = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>White-Label Branding</h3>
        <div style={s.field}>
          <label style={s.label}>Gym Name</label>
          <input style={s.input} value={branding.gymName} onChange={e => setBranding(prev => ({ ...prev, gymName: e.target.value }))} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Tagline</label>
          <input style={s.input} value={branding.tagline} onChange={e => setBranding(prev => ({ ...prev, tagline: e.target.value }))} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Logo URL</label>
          <input style={s.input} value={branding.logo} onChange={e => setBranding(prev => ({ ...prev, logo: e.target.value }))} placeholder="https://example.com/logo.png" />
          {branding.logo && (
            <div style={{ marginTop: 8, background: B.darker, borderRadius: 8, padding: 12, border: "1px solid " + B.border }}>
              <img src={branding.logo} alt="Logo preview" style={{ maxHeight: 60, maxWidth: "100%" }} onError={e => { e.target.style.display = "none"; }} />
            </div>
          )}
        </div>
        <div style={s.row}>
          <div>
            <label style={s.label}>Primary Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ ...s.input, flex: 1 }} value={branding.primaryColor} onChange={e => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))} placeholder="#8fbf3b" />
              <div style={{ width: 36, height: 36, borderRadius: 8, background: branding.primaryColor, border: "1px solid " + B.border, flexShrink: 0 }} />
            </div>
          </div>
          <div>
            <label style={s.label}>Secondary Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ ...s.input, flex: 1 }} value={branding.secondaryColor} onChange={e => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))} placeholder="#063461" />
              <div style={{ width: 36, height: 36, borderRadius: 8, background: branding.secondaryColor, border: "1px solid " + B.border, flexShrink: 0 }} />
            </div>
          </div>
        </div>
        <button style={s.btn()} onClick={() => showToast("Branding applied!")}>Apply Branding</button>
      </Card>

      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>Preview</h3>
        <div style={{ background: branding.secondaryColor || B.blue, borderRadius: 12, padding: 24, textAlign: "center" }}>
          {branding.logo ? (
            <img src={branding.logo} alt="Logo" style={{ maxHeight: 48, marginBottom: 12 }} onError={e => { e.target.style.display = "none"; }} />
          ) : (
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{branding.gymName || "Your Gym"}</div>
          )}
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>{branding.tagline}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            <div style={{ padding: "8px 20px", borderRadius: 8, background: branding.primaryColor || B.green, color: "#fff", fontWeight: 600, fontSize: 13 }}>Primary Button</div>
            <div style={{ padding: "8px 20px", borderRadius: 8, background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 500, fontSize: 13 }}>Secondary</div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 16, borderRadius: 8, border: "1px solid " + B.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: branding.primaryColor || B.green, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>
              {(branding.gymName || "G")[0]}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: B.text, fontSize: 14 }}>{branding.gymName || "Your Gym"}</div>
              <div style={{ color: B.muted, fontSize: 12 }}>Member Portal Header</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: branding.primaryColor }} />
            <div style={{ width: 12, height: 12, borderRadius: 3, background: branding.secondaryColor }} />
            <span style={{ fontSize: 11, color: B.muted, marginLeft: 4 }}>Brand Colors</span>
          </div>
        </div>
      </Card>
    </div>
  );

  /* ========== Locations ========== */
  const renderLocations = () => (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...s.sectionTitle, margin: 0 }}>Locations</h3>
        <button style={s.btn()} onClick={() => setLocations(prev => [...prev, {
          id: "loc_" + Date.now(),
          name: "New Location",
          address: "",
          phone: "",
          timezone: "America/Chicago",
          isDefault: false,
        }])}>+ Add Location</button>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        {locations.map(loc => (
          <div key={loc.id} style={{ background: B.darker, borderRadius: 10, padding: 16, border: "1px solid " + B.border }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={s.label}>Location Name</label>
                <input style={s.input} value={loc.name} onChange={e => setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, name: e.target.value } : l))} />
              </div>
              <div>
                <label style={s.label}>Phone</label>
                <input style={s.input} value={loc.phone} onChange={e => setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, phone: e.target.value } : l))} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={s.label}>Address</label>
              <input style={s.input} value={loc.address} onChange={e => setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, address: e.target.value } : l))} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: B.muted, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="defaultLocation"
                  checked={loc.isDefault}
                  onChange={() => setLocations(prev => prev.map(l => ({ ...l, isDefault: l.id === loc.id })))}
                  style={{ accentColor: B.green }}
                />
                Default Location
              </label>
              {locations.length > 1 && (
                <button style={s.btnSm(B.red + "22", B.red)} onClick={() => {
                  const wasDefault = loc.isDefault;
                  setLocations(prev => {
                    const next = prev.filter(l => l.id !== loc.id);
                    if (wasDefault && next.length > 0) next[0].isDefault = true;
                    return next;
                  });
                  showToast("Location removed.");
                }}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  /* ========== Users ========== */
  const renderUsers = () => (
    <div style={{ display: "grid", gap: 20 }}>
      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>User Accounts</h3>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Display Name</th>
              <th style={s.th}>Username</th>
              <th style={s.th}>Role</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.filter(u => u.role !== "client").map(u => (
              <tr key={u.id}>
                <td style={s.td}>{u.displayName}</td>
                <td style={{ ...s.td, color: B.muted }}>{u.username}</td>
                <td style={s.td}>
                  <span style={s.badge(u.role === "admin" ? B.purple : B.green)}>{u.role}</span>
                </td>
                <td style={s.td}>
                  {currentUser?.id === u.id ? (
                    <span style={{ fontSize: 12, color: B.muted }}>Current user</span>
                  ) : (
                    <button style={s.btnSm(B.red + "22", B.red)} onClick={() => { removeUser(u.id); showToast("User removed."); }}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>Add User</h3>
        <div style={s.row}>
          <div>
            <label style={s.label}>Display Name</label>
            <input style={s.input} value={newUser.displayName} onChange={e => setNewUser(p => ({ ...p, displayName: e.target.value }))} placeholder="Coach Jane" />
          </div>
          <div>
            <label style={s.label}>Username</label>
            <input style={s.input} value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} placeholder="jane" />
          </div>
        </div>
        <div style={s.row}>
          <div>
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Enter password" />
          </div>
          <div>
            <label style={s.label}>Role</label>
            <select style={s.select} value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
              <option value="admin">Admin</option>
              <option value="coach">Coach</option>
            </select>
          </div>
        </div>
        <button style={{ ...s.btn(), opacity: (newUser.username && newUser.password && newUser.displayName) ? 1 : 0.4 }} onClick={() => {
          if (!newUser.username || !newUser.password || !newUser.displayName) return;
          addUser({ ...newUser });
          setNewUser({ username: "", password: "", role: "coach", displayName: "" });
          showToast("User added!");
        }}>Add User</button>
      </Card>
    </div>
  );

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Settings</h1>
      <p style={s.subtitle}>Configure your gym, integrations, branding, and user access.</p>

      <div style={s.tabs}>
        {TABS.map(tab => (
          <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {activeTab === "General" && renderGeneral()}
      {activeTab === "Integrations" && renderIntegrations()}
      {activeTab === "Branding" && renderBranding()}
      {activeTab === "Locations" && renderLocations()}
      {activeTab === "Users" && renderUsers()}

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
