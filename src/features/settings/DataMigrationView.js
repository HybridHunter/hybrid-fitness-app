import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useMembers } from "../../hooks/useMembers";
import Card from "../../components/ui/Card";

/* ── CSV Parser ─────────────────────────────────────────────── */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

/* ── GymKit Fields ──────────────────────────────────────────── */
const GYMKIT_FIELDS = [
  { value: "skip", label: "-- Skip this column --" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "street", label: "Street Address" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "zip", label: "Zip Code" },
  { value: "plan", label: "Plan" },
  { value: "startDate", label: "Start Date" },
  { value: "pin", label: "PIN" },
  { value: "notes", label: "Notes" },
  { value: "tags", label: "Tags" },
  { value: "status", label: "Status" },
];

/* ── Auto-mapping dictionary ────────────────────────────────── */
const AUTO_MAP = {
  "first name": "firstName", "first_name": "firstName", "firstname": "firstName", "fname": "firstName",
  "last name": "lastName", "last_name": "lastName", "lastname": "lastName", "lname": "lastName",
  "email": "email", "email address": "email", "email_address": "email",
  "phone": "phone", "phone number": "phone", "phone_number": "phone", "mobile": "phone", "cell": "phone",
  "street": "street", "address": "street", "street address": "street", "street_address": "street", "address1": "street",
  "city": "city", "state": "state", "province": "state",
  "zip": "zip", "zipcode": "zip", "zip_code": "zip", "postal": "zip", "postal_code": "zip",
  "plan": "plan", "membership": "plan", "membership_plan": "plan",
  "start date": "startDate", "start_date": "startDate", "startdate": "startDate", "join date": "startDate", "join_date": "startDate",
  "pin": "pin", "code": "pin",
  "notes": "notes", "note": "notes", "comments": "notes",
  "tags": "tags", "tag": "tags", "labels": "tags",
  "status": "status", "membership_status": "status",
};

function autoMapColumn(header) {
  const key = header.toLowerCase().trim();
  return AUTO_MAP[key] || "skip";
}

/* ── Platforms ───────────────────────────────────────────────── */
const PLATFORMS = [
  { id: "semiprivate-pro", name: "SemiPrivate Pro", color: "#6366f1", letter: "SP", desc: "Import exercise progressions, client assessments, and workout templates" },
  { id: "mindbody", name: "Mindbody", color: "#00b4d8", letter: "MB", desc: "Import clients, classes, pricing, and payment history" },
  { id: "gymdesk", name: "GymDesk", color: "#ef4444", letter: "GD", desc: "Import clients, schedules, billing, and attendance records" },
  { id: "pushpress", name: "PushPress", color: "#f59e0b", letter: "PP", desc: "Import clients, plans, billing, and check-in data" },
  { id: "wodify", name: "Wodify", color: "#10b981", letter: "WO", desc: "Import athletes, workouts, benchmarks, and attendance" },
  { id: "zen-planner", name: "Zen Planner", color: "#8b5cf6", letter: "ZP", desc: "Import clients, billing, schedules, and reports" },
  { id: "glofox", name: "Glofox", color: "#ec4899", letter: "GF", desc: "Import clients, memberships, bookings, and payments" },
  { id: "pike13", name: "Pike13", color: "#14b8a6", letter: "P13", desc: "Import clients, plans, schedules, and transactions" },
  { id: "csv", name: "CSV / Excel", color: "#22c55e", letter: "CSV", desc: "Import from any spreadsheet with our flexible mapper" },
  { id: "manual", name: "Manual Entry", color: "#64748b", letter: "ME", desc: "Enter data manually with our guided forms" },
];

/* ── Export Instructions ────────────────────────────────────── */
const EXPORT_INSTRUCTIONS = {
  "semiprivate-pro": [
    "Log in to your SemiPrivate Pro dashboard.",
    "Go to Settings > Data Export.",
    "Select 'Full Export' and download the CSV.",
    "Upload the file here.",
  ],
  "mindbody": [
    "Log in to Mindbody.",
    "Go to Reports > Client Export.",
    "Export as CSV.",
    "Also export Classes and Pricing from their respective sections.",
    "Upload all files here.",
  ],
  "gymdesk": [
    "Log in to GymDesk.",
    "Go to Settings > Data Export.",
    "Select Clients, Billing, Schedule.",
    "Download CSV files.",
    "Upload here.",
  ],
  "pushpress": [
    "Log in to PushPress.",
    "Go to Settings > Data Management > Export.",
    "Select the data types you want to export.",
    "Download the CSV files.",
    "Upload the files here.",
  ],
  "wodify": [
    "Log in to Wodify.",
    "Go to Admin > Data > Export.",
    "Select Athletes, Workouts, and Attendance.",
    "Download CSV exports.",
    "Upload the files here.",
  ],
  "zen-planner": [
    "Log in to Zen Planner.",
    "Go to Reports > Client Reports > Export All.",
    "Download the CSV file.",
    "Upload the file here.",
  ],
  "glofox": [
    "Log in to Glofox dashboard.",
    "Go to Settings > Export Data.",
    "Select Clients, Memberships, and Payments.",
    "Download the exported files.",
    "Upload the files here.",
  ],
  "pike13": [
    "Log in to Pike13.",
    "Go to Reports > Client List > Export.",
    "Download the CSV export.",
    "Upload the file here.",
  ],
  "csv": [
    "Prepare your spreadsheet with columns for client data.",
    "Required columns: First Name, Last Name, Email.",
    "Optional: Phone, Address, Plan, Start Date, PIN, Notes.",
    "Save as .csv format.",
    "Upload the file here.",
  ],
  "manual": [],
};

/* ── API Fields per platform ────────────────────────────────── */
const API_FIELDS = {
  "semiprivate-pro": [{ key: "apiKey", label: "API Key", placeholder: "spp_xxxxxxxxxxxx" }],
  "mindbody": [
    { key: "siteId", label: "Site ID", placeholder: "Your Mindbody Site ID" },
    { key: "apiKey", label: "API Key", placeholder: "Your Mindbody API Key" },
  ],
  "gymdesk": [{ key: "apiKey", label: "API Key", placeholder: "gd_xxxxxxxxxxxx" }],
  "pushpress": [{ key: "apiKey", label: "API Key", placeholder: "pp_xxxxxxxxxxxx" }],
  "wodify": [{ key: "apiKey", label: "API Key", placeholder: "Your Wodify API Key" }],
  "zen-planner": [{ key: "apiKey", label: "API Key", placeholder: "zp_xxxxxxxxxxxx" }],
  "glofox": [
    { key: "clubId", label: "Club ID", placeholder: "Your Glofox Club ID" },
    { key: "apiKey", label: "API Key", placeholder: "Your Glofox API Key" },
  ],
  "pike13": [{ key: "apiToken", label: "API Token", placeholder: "pk_xxxxxxxxxxxx" }],
};

/* ── Mock API response data ─────────────────────────────────── */
const MOCK_API_DATA = {
  members: 47, classes: 12, plans: 5, payments: 234,
};

/* ── Template CSV ───────────────────────────────────────────── */
const TEMPLATE_CSV = "First Name,Last Name,Email,Phone,Street,City,State,Zip,Plan,Start Date,PIN,Notes,Tags\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gymkit_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Main Component ─────────────────────────────────────────── */
export default function DataMigrationView() {
  const B = useTheme();
  const { addMember } = useMembers();
  const [migrationHistory, setMigrationHistory] = useLocalStorage("hf_migration_history", []);

  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [importMethod, setImportMethod] = useState(null); // "api" | "file"
  const [showInstructions, setShowInstructions] = useState(false);

  // API state
  const [apiCredentials, setApiCredentials] = useState({});
  const [apiConnecting, setApiConnecting] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);

  // File state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Mapping state
  const [fieldMapping, setFieldMapping] = useState({});

  // Import state
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importPhase, setImportPhase] = useState("");
  const [importComplete, setImportComplete] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Manual entry state
  const [manualEntries, setManualEntries] = useState([
    { firstName: "", lastName: "", email: "", phone: "", plan: "", notes: "" },
  ]);

  const platform = PLATFORMS.find(p => p.id === selectedPlatform);

  /* ── Computed: mapped preview data ──────────────────────── */
  const previewRows = useMemo(() => {
    if (!parsedData || !parsedData.rows.length) return [];
    return parsedData.rows.slice(0, 5).map(row => {
      const mapped = {};
      Object.entries(fieldMapping).forEach(([srcCol, gymkitField]) => {
        if (gymkitField !== "skip") mapped[gymkitField] = row[srcCol] || "";
      });
      return mapped;
    });
  }, [parsedData, fieldMapping]);

  /* ── Computed: import summary ───────────────────────────── */
  const importSummary = useMemo(() => {
    if (importMethod === "api" && apiConnected) {
      return { members: MOCK_API_DATA.members, plans: MOCK_API_DATA.plans, sessions: MOCK_API_DATA.classes };
    }
    if (parsedData) {
      const memberCount = parsedData.rows.length;
      const missingEmail = parsedData.rows.filter(r => {
        const emailCol = Object.entries(fieldMapping).find(([, v]) => v === "email");
        return emailCol ? !r[emailCol[0]]?.trim() : true;
      }).length;
      const emails = parsedData.rows.map(r => {
        const emailCol = Object.entries(fieldMapping).find(([, v]) => v === "email");
        return emailCol ? r[emailCol[0]]?.trim().toLowerCase() : "";
      }).filter(Boolean);
      const dupes = emails.length - new Set(emails).size;
      return { members: memberCount, plans: 0, sessions: 0, missingEmail, duplicates: dupes };
    }
    if (selectedPlatform === "manual") {
      return { members: manualEntries.filter(e => e.firstName && e.lastName).length, plans: 0, sessions: 0 };
    }
    return { members: 0, plans: 0, sessions: 0 };
  }, [parsedData, fieldMapping, apiConnected, importMethod, selectedPlatform, manualEntries]);

  /* ── Handlers ───────────────────────────────────────────── */
  const handleSelectPlatform = (id) => {
    setSelectedPlatform(id);
    setStep(id === "manual" ? 3 : 2);
    setImportMethod(null);
    setUploadedFile(null);
    setParsedData(null);
    setFieldMapping({});
    setApiConnected(false);
    setApiCredentials({});
    setConfirmed(false);
    setImporting(false);
    setImportComplete(false);
    setImportResult(null);
  };

  const handleApiConnect = () => {
    setApiConnecting(true);
    setTimeout(() => {
      setApiConnecting(false);
      setApiConnected(true);
      setStep(4);
    }, 2200);
  };

  const handleFileRead = (file) => {
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        if (file.name.endsWith(".json")) {
          const json = JSON.parse(text);
          const arr = Array.isArray(json) ? json : json.data || json.members || json.clients || [json];
          if (arr.length > 0) {
            const headers = Object.keys(arr[0]);
            setParsedData({ headers, rows: arr });
            const mapping = {};
            headers.forEach(h => { mapping[h] = autoMapColumn(h); });
            setFieldMapping(mapping);
            setStep(3);
          }
        } else {
          const parsed = parseCSV(text);
          setParsedData(parsed);
          const mapping = {};
          parsed.headers.forEach(h => { mapping[h] = autoMapColumn(h); });
          setFieldMapping(mapping);
          setStep(3);
        }
      } catch {
        alert("Could not parse file. Please check the format and try again.");
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  };

  const handleBrowse = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx,.json";
    input.onchange = (e) => {
      if (e.target.files[0]) handleFileRead(e.target.files[0]);
    };
    input.click();
  };

  const handleStartImport = () => {
    setImporting(true);
    setImportProgress(0);
    setImportPhase("Preparing data...");

    const phases = [
      { pct: 15, label: "Validating records..." },
      { pct: 35, label: "Importing clients..." },
      { pct: 60, label: "Setting up plans..." },
      { pct: 80, label: "Syncing schedules..." },
      { pct: 95, label: "Finalizing..." },
      { pct: 100, label: "Complete!" },
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < phases.length) {
        setImportProgress(phases[i].pct);
        setImportPhase(phases[i].label);
        i++;
      } else {
        clearInterval(interval);
        // Actually create member records from CSV data
        let imported = 0;
        if (parsedData && parsedData.rows.length) {
          parsedData.rows.forEach(row => {
            const member = {};
            Object.entries(fieldMapping).forEach(([srcCol, gkField]) => {
              if (gkField === "skip") return;
              const val = row[srcCol] || "";
              if (gkField === "firstName") member.firstName = val;
              else if (gkField === "lastName") member.lastName = val;
              else if (gkField === "email") member.email = val;
              else if (gkField === "phone") member.phone = val;
              else if (gkField === "pin") member.pin = val;
              else if (gkField === "notes") member.notes = val;
              else if (gkField === "startDate") member.startDate = val;
              else if (gkField === "plan") member.membershipPlanId = val;
              else if (gkField === "status") member.membershipStatus = val || "active";
              else if (gkField === "tags") member.tags = val ? val.split(";").map(t => t.trim()) : [];
              else if (gkField === "street") member.address = { ...(member.address || {}), street: val };
              else if (gkField === "city") member.address = { ...(member.address || {}), city: val };
              else if (gkField === "state") member.address = { ...(member.address || {}), state: val };
              else if (gkField === "zip") member.address = { ...(member.address || {}), zip: val };
            });
            if (member.firstName || member.lastName || member.email) {
              addMember(member);
              imported++;
            }
          });
        } else if (selectedPlatform === "manual") {
          manualEntries.forEach(entry => {
            if (entry.firstName && entry.lastName) {
              addMember({
                firstName: entry.firstName,
                lastName: entry.lastName,
                email: entry.email,
                phone: entry.phone,
                notes: entry.notes,
                membershipPlanId: entry.plan,
              });
              imported++;
            }
          });
        } else if (importMethod === "api") {
          // Mock: create some sample members for API import
          const mockNames = [
            ["Alex", "Thompson"], ["Jordan", "Rivera"], ["Casey", "Morgan"],
            ["Taylor", "Brooks"], ["Morgan", "Davis"],
          ];
          mockNames.forEach(([fn, ln]) => {
            addMember({
              firstName: fn, lastName: ln,
              email: `${fn.toLowerCase()}@imported.com`,
              notes: `Imported from ${platform?.name}`,
            });
            imported++;
          });
        }

        const result = {
          members: imported || importSummary.members,
          plans: importSummary.plans,
          sessions: importSummary.sessions,
          date: new Date().toISOString(),
          platform: platform?.name || "Manual",
        };
        setImportResult(result);
        setImportComplete(true);
        setMigrationHistory(prev => [result, ...prev]);
      }
    }, 600);
  };

  const handleManualImport = () => {
    setStep(4);
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedPlatform(null);
    setImportMethod(null);
    setUploadedFile(null);
    setParsedData(null);
    setFieldMapping({});
    setApiConnected(false);
    setApiCredentials({});
    setConfirmed(false);
    setImporting(false);
    setImportComplete(false);
    setImportResult(null);
    setManualEntries([{ firstName: "", lastName: "", email: "", phone: "", plan: "", notes: "" }]);
  };

  /* ── Step indicator ─────────────────────────────────────── */
  const steps = selectedPlatform === "manual"
    ? ["Select Platform", "Enter Data", "Review & Import"]
    : ["Select Platform", "Import Method", "Map Fields", "Review & Import"];

  const effectiveStepIndex = selectedPlatform === "manual"
    ? (step === 1 ? 0 : step === 3 ? 1 : 2)
    : step - 1;

  /* ── Styles ─────────────────────────────────────────────── */
  const sBtn = (primary) => ({
    padding: "10px 24px",
    borderRadius: 8,
    border: primary ? "none" : `1px solid ${B.border}`,
    background: primary ? B.accent : "transparent",
    color: primary ? "#fff" : B.text,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const sSmallBtn = {
    padding: "6px 14px",
    borderRadius: 6,
    border: `1px solid ${B.border}`,
    background: "transparent",
    color: B.muted,
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.15s",
  };

  const sInput = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${B.border}`,
    background: B.darker,
    color: B.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: B.text, fontSize: 28, fontWeight: 700, margin: 0 }}>Data Migration</h1>
        <p style={{ color: B.muted, fontSize: 15, marginTop: 6 }}>
          Import your gym's data from another platform in minutes
        </p>
      </div>

      {/* Step Indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32, overflowX: "auto" }}>
        {steps.map((label, i) => {
          const isActive = i === effectiveStepIndex;
          const isDone = i < effectiveStepIndex || importComplete;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: "fit-content" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: isDone ? B.accent : isActive ? `${B.accent}30` : B.card,
                  border: isActive ? `2px solid ${B.accent}` : `1px solid ${B.border}`,
                  color: isDone ? "#fff" : isActive ? B.accent : B.muted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                  transition: "all 0.3s",
                }}>
                  {isDone ? "\u2713" : i + 1}
                </div>
                <span style={{
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  color: isActive ? B.text : B.muted,
                  whiteSpace: "nowrap",
                }}>
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  flex: 1, height: 2, margin: "0 12px",
                  background: i < effectiveStepIndex ? B.accent : B.border,
                  minWidth: 20, transition: "background 0.3s",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Back button */}
      {step > 1 && !importing && !importComplete && (
        <button
          onClick={() => {
            if (step === 2) { setStep(1); setSelectedPlatform(null); }
            else if (step === 3 && selectedPlatform !== "manual") setStep(2);
            else if (step === 3 && selectedPlatform === "manual") { setStep(1); setSelectedPlatform(null); }
            else if (step === 4) setStep(3);
          }}
          style={{ ...sSmallBtn, marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ fontSize: 16 }}>&larr;</span> Back
        </button>
      )}

      {/* ── STEP 1: Platform Selection ─────────────────────── */}
      {step === 1 && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260, 1fr))",
            gap: 16,
          }}>
            {PLATFORMS.map(p => (
              <Card key={p.id} style={{
                cursor: "pointer",
                transition: "all 0.2s",
                border: selectedPlatform === p.id ? `2px solid ${p.color}` : `1px solid ${B.border}`,
              }}
                onClick={() => handleSelectPlatform(p.id)}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 20px ${p.color}22`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: `${p.color}20`, color: p.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 800, letterSpacing: -0.5,
                    border: `1.5px solid ${p.color}40`,
                  }}>
                    {p.letter}
                  </div>
                  <div>
                    <div style={{ color: B.text, fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                  </div>
                </div>
                <p style={{ color: B.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
                <button
                  style={{
                    ...sBtn(false),
                    width: "100%", marginTop: 14, padding: "8px 0",
                    fontSize: 13, borderColor: p.color, color: p.color,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = p.color; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = p.color; }}
                  onClick={(e) => { e.stopPropagation(); handleSelectPlatform(p.id); }}
                >
                  Select
                </button>
              </Card>
            ))}
          </div>

          {/* Previous migration history */}
          {migrationHistory.length > 0 && (
            <Card style={{ marginTop: 32 }}>
              <h3 style={{ color: B.text, fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Recent Imports</h3>
              {migrationHistory.slice(0, 5).map((h, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: i < migrationHistory.length - 1 ? `1px solid ${B.border}` : "none",
                }}>
                  <div>
                    <span style={{ color: B.text, fontSize: 13, fontWeight: 500 }}>{h.platform}</span>
                    <span style={{ color: B.muted, fontSize: 12, marginLeft: 8 }}>
                      {h.members} clients
                    </span>
                  </div>
                  <span style={{ color: B.dim, fontSize: 12 }}>{new Date(h.date).toLocaleDateString()}</span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* ── STEP 2: Import Method ──────────────────────────── */}
      {step === 2 && platform && platform.id !== "manual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: platform.id !== "csv" ? "1fr 1fr" : "1fr", gap: 20 }}>
            {/* API Import */}
            {platform.id !== "csv" && API_FIELDS[platform.id] && (
              <Card style={{
                border: importMethod === "api" ? `2px solid ${B.accent}` : `1px solid ${B.border}`,
                cursor: "pointer",
              }}
                onClick={() => setImportMethod("api")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 22 }}>&#128279;</span>
                  <div>
                    <div style={{ color: B.text, fontWeight: 600, fontSize: 15 }}>API Import</div>
                    <div style={{ color: B.muted, fontSize: 13 }}>Connect directly to your {platform.name} account</div>
                  </div>
                </div>
                {importMethod === "api" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                    {API_FIELDS[platform.id].map(field => (
                      <div key={field.key}>
                        <label style={{ color: B.muted, fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>
                          {field.label}
                        </label>
                        <input
                          type="text"
                          placeholder={field.placeholder}
                          value={apiCredentials[field.key] || ""}
                          onChange={e => setApiCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                          style={sInput}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    ))}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleApiConnect(); }}
                      disabled={apiConnecting}
                      style={{
                        ...sBtn(true),
                        opacity: apiConnecting ? 0.7 : 1,
                        marginTop: 4,
                      }}
                    >
                      {apiConnecting ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="spin" style={{
                            display: "inline-block", width: 14, height: 14,
                            border: `2px solid rgba(255,255,255,0.3)`,
                            borderTopColor: "#fff", borderRadius: "50%",
                            animation: "spin 0.8s linear infinite",
                          }} />
                          Connecting...
                        </span>
                      ) : apiConnected ? (
                        <span>&#10003; Connected</span>
                      ) : (
                        "Connect & Scan"
                      )}
                    </button>
                    {apiConnected && (
                      <div style={{
                        background: `${B.accent}15`, border: `1px solid ${B.accent}30`,
                        borderRadius: 8, padding: 14, marginTop: 4,
                      }}>
                        <div style={{ color: B.accent, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                          Connection successful!
                        </div>
                        <div style={{ color: B.muted, fontSize: 13, lineHeight: 1.6 }}>
                          Found {MOCK_API_DATA.members} clients, {MOCK_API_DATA.classes} classes,{" "}
                          {MOCK_API_DATA.plans} plans, and {MOCK_API_DATA.payments} payment records.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* File Upload */}
            <Card style={{
              border: importMethod === "file" ? `2px solid ${B.accent}` : `1px solid ${B.border}`,
              cursor: "pointer",
            }}
              onClick={() => setImportMethod("file")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>&#128196;</span>
                <div>
                  <div style={{ color: B.text, fontWeight: 600, fontSize: 15 }}>File Upload</div>
                  <div style={{ color: B.muted, fontSize: 13 }}>Upload an export file from {platform.name}</div>
                </div>
              </div>
              {importMethod === "file" && (
                <div onClick={e => e.stopPropagation()}>
                  {/* Drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={handleBrowse}
                    style={{
                      border: `2px dashed ${dragOver ? B.accent : B.border}`,
                      borderRadius: 10,
                      padding: "36px 20px",
                      textAlign: "center",
                      cursor: "pointer",
                      background: dragOver ? `${B.accent}08` : B.darker,
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.5 }}>&#128228;</div>
                    <div style={{ color: B.text, fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                      Drag & drop your file here
                    </div>
                    <div style={{ color: B.muted, fontSize: 13 }}>Or click to browse files</div>
                    <div style={{ color: B.dim, fontSize: 11, marginTop: 8 }}>
                      Accepted: .csv, .xlsx, .json
                    </div>
                  </div>
                  {uploadedFile && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, marginTop: 10,
                      padding: "8px 12px", background: `${B.accent}10`, borderRadius: 8,
                    }}>
                      <span>&#128196;</span>
                      <span style={{ color: B.text, fontSize: 13 }}>{uploadedFile.name}</span>
                      <span style={{ color: B.accent, fontSize: 12, marginLeft: "auto" }}>&#10003; Loaded</span>
                    </div>
                  )}

                  {/* Template download for CSV mode */}
                  {platform.id === "csv" && (
                    <button onClick={downloadTemplate} style={{ ...sSmallBtn, marginTop: 12 }}>
                      &#8681; Download Import Template (.csv)
                    </button>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Export instructions */}
          {EXPORT_INSTRUCTIONS[platform.id]?.length > 0 && (
            <Card>
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: 0, color: B.text,
                }}
              >
                <span style={{
                  fontSize: 10, color: B.muted, transition: "transform 0.2s",
                  transform: showInstructions ? "rotate(90deg)" : "rotate(0deg)",
                  display: "inline-block",
                }}>&#9654;</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  How to export from {platform.name}
                </span>
              </button>
              {showInstructions && (
                <ol style={{ color: B.muted, fontSize: 13, lineHeight: 1.8, margin: "12px 0 0", paddingLeft: 20 }}>
                  {EXPORT_INSTRUCTIONS[platform.id].map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ── STEP 3: Field Mapping (file) / Manual Entry ──── */}
      {step === 3 && !importing && !importComplete && (
        <>
          {/* Manual Entry mode */}
          {selectedPlatform === "manual" && (
            <Card>
              <h3 style={{ color: B.text, fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>
                Enter Client Data
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["First Name*", "Last Name*", "Email", "Phone", "Plan", "Notes", ""].map(h => (
                        <th key={h} style={{
                          textAlign: "left", padding: "8px 6px", color: B.muted,
                          borderBottom: `1px solid ${B.border}`, fontWeight: 600, fontSize: 11,
                          textTransform: "uppercase", letterSpacing: 0.5,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {manualEntries.map((entry, i) => (
                      <tr key={i}>
                        {["firstName", "lastName", "email", "phone", "plan", "notes"].map(field => (
                          <td key={field} style={{ padding: "4px 4px" }}>
                            <input
                              value={entry[field]}
                              onChange={e => {
                                const updated = [...manualEntries];
                                updated[i] = { ...updated[i], [field]: e.target.value };
                                setManualEntries(updated);
                              }}
                              style={{ ...sInput, padding: "6px 8px", fontSize: 13 }}
                              placeholder={field === "firstName" ? "John" : field === "lastName" ? "Doe" : field === "email" ? "john@gym.com" : ""}
                            />
                          </td>
                        ))}
                        <td style={{ padding: "4px" }}>
                          {manualEntries.length > 1 && (
                            <button
                              onClick={() => setManualEntries(prev => prev.filter((_, idx) => idx !== i))}
                              style={{ background: "none", border: "none", color: B.red, cursor: "pointer", fontSize: 16, padding: 4 }}
                            >
                              &times;
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => setManualEntries(prev => [...prev, { firstName: "", lastName: "", email: "", phone: "", plan: "", notes: "" }])}
                  style={sSmallBtn}
                >
                  + Add Row
                </button>
                <button onClick={handleManualImport} style={sBtn(true)}>
                  Continue to Review
                </button>
              </div>
            </Card>
          )}

          {/* File mapping mode */}
          {selectedPlatform !== "manual" && parsedData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Mapping table */}
              <Card>
                <h3 style={{ color: B.text, fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>
                  Map Your Columns
                </h3>
                <p style={{ color: B.muted, fontSize: 13, margin: "0 0 16px" }}>
                  We auto-detected {parsedData.headers.length} columns. Verify the mappings below.
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "10px 8px", color: B.muted, borderBottom: `1px solid ${B.border}`, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Source Column
                        </th>
                        <th style={{ textAlign: "center", padding: "10px 8px", color: B.muted, borderBottom: `1px solid ${B.border}`, width: 40 }}>
                          &rarr;
                        </th>
                        <th style={{ textAlign: "left", padding: "10px 8px", color: B.muted, borderBottom: `1px solid ${B.border}`, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          GymKit Field
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.headers.map(header => (
                        <tr key={header}>
                          <td style={{ padding: "8px", borderBottom: `1px solid ${B.border}`, color: B.text }}>
                            <code style={{
                              background: `${B.accent}10`, padding: "3px 8px",
                              borderRadius: 4, fontSize: 12, color: B.accent,
                            }}>
                              {header}
                            </code>
                          </td>
                          <td style={{ textAlign: "center", padding: "8px", borderBottom: `1px solid ${B.border}`, color: B.muted }}>
                            &rarr;
                          </td>
                          <td style={{ padding: "8px", borderBottom: `1px solid ${B.border}` }}>
                            <select
                              value={fieldMapping[header] || "skip"}
                              onChange={e => setFieldMapping(prev => ({ ...prev, [header]: e.target.value }))}
                              style={{
                                ...sInput, padding: "6px 10px", width: "auto", minWidth: 180,
                                cursor: "pointer",
                              }}
                            >
                              {GYMKIT_FIELDS.map(f => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Preview */}
              {previewRows.length > 0 && (
                <Card>
                  <h3 style={{ color: B.text, fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>
                    Preview
                  </h3>
                  <p style={{ color: B.muted, fontSize: 13, margin: "0 0 14px" }}>
                    Showing first {previewRows.length} of {parsedData.rows.length} records
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          {GYMKIT_FIELDS.filter(f => f.value !== "skip" && Object.values(fieldMapping).includes(f.value)).map(f => (
                            <th key={f.value} style={{
                              textAlign: "left", padding: "8px", color: B.muted,
                              borderBottom: `1px solid ${B.border}`, fontWeight: 600,
                              fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap",
                            }}>{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i}>
                            {GYMKIT_FIELDS.filter(f => f.value !== "skip" && Object.values(fieldMapping).includes(f.value)).map(f => (
                              <td key={f.value} style={{
                                padding: "8px", borderBottom: `1px solid ${B.border}`,
                                color: B.text, whiteSpace: "nowrap",
                              }}>
                                {row[f.value] || <span style={{ color: B.dim }}>--</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setStep(4)} style={sBtn(true)}>
                  Continue to Review &rarr;
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STEP 4: Review & Import / Progress / Complete ── */}
      {step === 4 && (
        <>
          {!importing && !importComplete && (
            <Card>
              <h3 style={{ color: B.text, fontSize: 18, fontWeight: 600, margin: "0 0 20px" }}>
                Review & Import
              </h3>

              {/* Summary boxes */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
                {[
                  { label: "Clients", count: importSummary.members, color: B.accent },
                  { label: "Plans", count: importSummary.plans, color: "#8b5cf6" },
                  { label: "Sessions", count: importSummary.sessions, color: "#3b82f6" },
                ].map(item => (
                  <div key={item.label} style={{
                    background: `${item.color}10`, border: `1px solid ${item.color}30`,
                    borderRadius: 10, padding: "16px 14px", textAlign: "center",
                  }}>
                    <div style={{ color: item.color, fontSize: 28, fontWeight: 700 }}>{item.count}</div>
                    <div style={{ color: B.muted, fontSize: 12, fontWeight: 600, marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {(importSummary.missingEmail > 0 || importSummary.duplicates > 0) && (
                <div style={{
                  background: `${B.orange}10`, border: `1px solid ${B.orange}30`,
                  borderRadius: 8, padding: 14, marginBottom: 20,
                }}>
                  <div style={{ color: B.orange, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                    Data Quality Warnings
                  </div>
                  {importSummary.missingEmail > 0 && (
                    <div style={{ color: B.muted, fontSize: 13, marginBottom: 4 }}>
                      &#9888; {importSummary.missingEmail} client{importSummary.missingEmail !== 1 ? "s" : ""} missing email address
                    </div>
                  )}
                  {importSummary.duplicates > 0 && (
                    <div style={{ color: B.muted, fontSize: 13 }}>
                      &#9888; {importSummary.duplicates} duplicate entr{importSummary.duplicates !== 1 ? "ies" : "y"} found
                    </div>
                  )}
                </div>
              )}

              {/* Confirmation */}
              <label style={{
                display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                padding: "12px 14px", background: B.darker, borderRadius: 8,
                border: `1px solid ${B.border}`, marginBottom: 20,
              }}>
                <input
                  type="checkbox" checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: B.accent, cursor: "pointer" }}
                />
                <span style={{ color: B.text, fontSize: 14 }}>
                  I understand this will add data to my gym account
                </span>
              </label>

              <button
                onClick={handleStartImport}
                disabled={!confirmed}
                style={{
                  ...sBtn(true),
                  opacity: confirmed ? 1 : 0.4,
                  cursor: confirmed ? "pointer" : "not-allowed",
                  width: "100%", padding: "14px 24px", fontSize: 16,
                }}
              >
                Start Import
              </button>
            </Card>
          )}

          {/* Import Progress */}
          {importing && !importComplete && (
            <Card>
              <h3 style={{ color: B.text, fontSize: 18, fontWeight: 600, margin: "0 0 24px", textAlign: "center" }}>
                Importing Data...
              </h3>

              {/* Progress bar */}
              <div style={{
                height: 12, borderRadius: 6, background: B.darker,
                border: `1px solid ${B.border}`, overflow: "hidden", marginBottom: 16,
              }}>
                <div style={{
                  height: "100%", borderRadius: 6,
                  background: `linear-gradient(90deg, ${B.accent}, #3b82f6)`,
                  width: `${importProgress}%`,
                  transition: "width 0.5s ease",
                }} />
              </div>
              <div style={{ textAlign: "center", color: B.muted, fontSize: 14, marginBottom: 24 }}>
                {importPhase} ({importProgress}%)
              </div>

              {/* Status items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Clients", threshold: 35 },
                  { label: "Plans", threshold: 60 },
                  { label: "Schedule", threshold: 80 },
                  { label: "Payments", threshold: 95 },
                ].map(item => {
                  const done = importProgress >= item.threshold;
                  const active = !done && importProgress >= item.threshold - 25;
                  return (
                    <div key={item.label} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 8,
                      background: done ? `${B.accent}10` : active ? `${B.orange}08` : B.darker,
                      border: `1px solid ${done ? `${B.accent}30` : B.border}`,
                    }}>
                      <span style={{ fontSize: 16 }}>
                        {done ? "\u2705" : active ? "\u23F3" : "\u23F3"}
                      </span>
                      <span style={{ color: done ? B.accent : active ? B.orange : B.muted, fontSize: 14, fontWeight: 500 }}>
                        {item.label}
                      </span>
                      <span style={{ marginLeft: "auto", color: done ? B.accent : B.dim, fontSize: 12 }}>
                        {done ? "Complete" : active ? "In progress..." : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Import Complete */}
          {importComplete && importResult && (
            <Card style={{ textAlign: "center" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: `${B.accent}20`, margin: "0 auto 20px",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `3px solid ${B.accent}`,
              }}>
                <span style={{ fontSize: 36 }}>&#10003;</span>
              </div>
              <h2 style={{ color: B.text, fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
                Import Complete!
              </h2>
              <p style={{ color: B.muted, fontSize: 15, margin: "0 0 28px" }}>
                Successfully imported {importResult.members} client{importResult.members !== 1 ? "s" : ""}
                {importResult.plans > 0 ? `, ${importResult.plans} plan${importResult.plans !== 1 ? "s" : ""}` : ""}
                {importResult.sessions > 0 ? `, ${importResult.sessions} session${importResult.sessions !== 1 ? "s" : ""}` : ""}
                {" "}from {importResult.platform}.
              </p>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => window.location.href = "/members"}
                  style={sBtn(true)}
                >
                  View Clients
                </button>
                <button
                  onClick={() => window.location.href = "/billing"}
                  style={sBtn(false)}
                >
                  View Billing
                </button>
                <button
                  onClick={() => window.location.href = "/schedule"}
                  style={sBtn(false)}
                >
                  View Schedule
                </button>
              </div>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${B.border}` }}>
                <button onClick={resetWizard} style={{ ...sSmallBtn, color: B.accent }}>
                  Import More Data
                </button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Spinner animation keyframes */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
