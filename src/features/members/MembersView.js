import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useMembershipEvents } from "../../hooks/useMembershipEvents";
import { useMemberChangelog } from "../../hooks/useMemberChangelog";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { sendEmail } from "../../utils/messaging";

const STATUS_COLORS = (B) => ({ active: B.green, trial: B.orange, frozen: B.blue, inactive: B.red });
const STATUS_OPTIONS = ["All", "Active", "Trial", "Frozen", "Inactive"];

// Derive effective status: no plan = inactive, trial plan = trial, otherwise use stored status
const getEffectiveStatus = (m, plans) => {
  if (!m.membershipPlanId) return "inactive";
  if (plans) {
    const plan = plans.find(p => p.id === m.membershipPlanId);
    if (plan?.isTrial) return "trial";
  }
  if (m.membershipStatus === "frozen") return "frozen";
  return "active";
};
const PATTERNS = ["Squat", "Hinge", "Lunge", "Push", "Pull", "Core", "Carry"];

function getInitials(f, l) {
  return ((f?.[0] || "") + (l?.[0] || "")).toUpperCase();
}

function scoreColor(v) {
  if (v < 0) return "#ef4444";
  if (v === 0) return "#eab308";
  return "#22c55e";
}

const emptyForm = () => ({
  firstName: "", lastName: "", email: "", phone: "", pin: "", startDate: "", dob: "",
  membershipStatus: "active", notes: "", tagsStr: "",
  street: "", city: "", state: "", zip: "",
  usePassword: false,
});

export default function MembersView() {
  const B = useTheme();
  const navigate = useNavigate();
  const { members, addMember, updateMember, deleteMember } = useMembers();
  const { events, logEvent, removeLatestEvent } = useMembershipEvents();
  const { log: changelog, markUndone, logChange } = useMemberChangelog();
  const [plans] = useLocalStorage("hf_plans", []);
  const [attendance] = useLocalStorage("hf_attendance", []);
  const sc = STATUS_COLORS(B);
  const [showHistory, setShowHistory] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSelection, setMergeSelection] = useState(null); // { a, b, picks }


  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name-az"); // name-az, name-za, date-new, date-old, birthday, plan
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const [toast, setToast] = useState(null);
  const [sendingCredentials, setSendingCredentials] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Duplicate detection ──
  const duplicateGroups = useMemo(() => {
    const groups = [];
    const seen = new Set();
    for (let i = 0; i < members.length; i++) {
      if (seen.has(members[i].id)) continue;
      const a = members[i];
      for (let j = i + 1; j < members.length; j++) {
        if (seen.has(members[j].id)) continue;
        const b = members[j];
        const reasons = [];
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase().trim();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase().trim();
        if (nameA && nameA === nameB) reasons.push("Same name");
        if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) reasons.push("Same email");
        if (a.phone && b.phone && a.phone.replace(/\D/g, "") === b.phone.replace(/\D/g, "") && a.phone.replace(/\D/g, "").length >= 7) reasons.push("Same phone");
        if (reasons.length > 0) {
          groups.push({ a, b, reasons });
          seen.add(a.id);
          seen.add(b.id);
        }
      }
    }
    return groups;
  }, [members]);

  const MERGE_FIELDS = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "pin", label: "PIN" },
    { key: "startDate", label: "Start Date" },
    { key: "notes", label: "Notes" },
    { key: "membershipPlanId", label: "Plan" },
    { key: "dob", label: "Date of Birth" },
    { key: "gender", label: "Gender" },
    { key: "source", label: "Lead Source" },
  ];

  const startMerge = (group) => {
    const picks = {};
    MERGE_FIELDS.forEach(f => {
      const aVal = group.a[f.key];
      const bVal = group.b[f.key];
      // Default: pick whichever has data, prefer A
      picks[f.key] = aVal ? "a" : bVal ? "b" : "a";
    });
    // For address, pick whichever has more data
    const aAddr = group.a.address || {};
    const bAddr = group.b.address || {};
    picks._address = (aAddr.street || aAddr.city) ? "a" : (bAddr.street || bAddr.city) ? "b" : "a";
    setMergeSelection({ a: group.a, b: group.b, picks, reasons: group.reasons });
  };

  const executeMerge = () => {
    if (!mergeSelection) return;
    const { a, b, picks } = mergeSelection;
    const merged = {};
    MERGE_FIELDS.forEach(f => {
      merged[f.key] = picks[f.key] === "a" ? a[f.key] : b[f.key];
    });
    // Merge address
    merged.address = picks._address === "a" ? (a.address || {}) : (b.address || {});
    // Merge tags (combine unique)
    const allTags = [...new Set([...(a.tags || []), ...(b.tags || [])])];
    merged.tags = allTags;
    // Merge notes (combine if both have content)
    if (a.notes && b.notes && a.notes !== b.notes) {
      merged.notes = `${a.notes}\n---\n${b.notes}`;
    }
    // Keep higher gamification stats
    const gA = a.gamification || {};
    const gB = b.gamification || {};
    merged.gamification = {
      level: Math.max(gA.level || 1, gB.level || 1),
      xp: Math.max(gA.xp || 0, gB.xp || 0),
      totalWorkouts: (gA.totalWorkouts || 0) + (gB.totalWorkouts || 0),
      totalWeightLifted: (gA.totalWeightLifted || 0) + (gB.totalWeightLifted || 0),
      badges: [...new Set([...(gA.badges || []), ...(gB.badges || [])])],
      currentStreak: Math.max(gA.currentStreak || 0, gB.currentStreak || 0),
      longestStreak: Math.max(gA.longestStreak || 0, gB.longestStreak || 0),
    };
    // Keep better movement scores
    const msA = a.movementScores || {};
    const msB = b.movementScores || {};
    merged.movementScores = {};
    ["Squat","Hinge","Lunge","Push","Pull","Core","Carry"].forEach(p => {
      merged.movementScores[p] = Math.max(msA[p] || 0, msB[p] || 0);
    });
    // Keep inbody with more history
    const ibA = a.inbody || { history: [] };
    const ibB = b.inbody || { history: [] };
    merged.inbody = (ibA.history || []).length >= (ibB.history || []).length ? ibA : ibB;
    // Emergency contact — pick whichever exists
    merged.emergencyContact = a.emergencyContact?.name ? a.emergencyContact : b.emergencyContact;
    // Auto-charge — keep if either had it
    merged.autoCharge = a.autoCharge || b.autoCharge;

    // Keep record A, update with merged data, delete B
    const keepId = a.id;
    const deleteId = b.id;
    updateMember(keepId, merged);
    deleteMember(deleteId);
    logChange(keepId, `${merged.firstName} ${merged.lastName}`, "field_updated", "merge", deleteId, keepId);
    setMergeSelection(null);
    showToast(`Merged into ${merged.firstName} ${merged.lastName}`);
  };

  const getBranding = () => {
    try { return JSON.parse(localStorage.getItem("hf_branding") || "{}"); } catch { return {}; }
  };

  const sendCredentialsEmail = async (member) => {
    if (!member.email) {
      showToast("No email address on file", "error");
      return;
    }
    setSendingCredentials(member.id);
    try {
      const branding = getBranding();
      const gymName = branding.gymName || "GymKit";
      const gymUrl = branding.gymUrl || window.location.origin;
      const credLabel = (member.pin && member.pin.length === 4 && /^\d{4}$/.test(member.pin)) ? "PIN" : "Password";
      await sendEmail({
        to: member.email,
        subject: `Your ${gymName} Login Credentials`,
        html: `<h2>Hi ${member.firstName},</h2><p>Here are your login credentials:</p><p><strong>Login URL:</strong> <a href="${gymUrl}">${gymUrl}</a></p><p><strong>Email:</strong> ${member.email}</p><p><strong>${credLabel}:</strong> <span style="font-size:18px;letter-spacing:2px;font-weight:bold;">${member.pin}</span></p><p>Use these to log in to the client portal from your phone.</p><p>If you have any questions, message your coach through the app.</p>`,
      });
      showToast(`Credentials sent to ${member.email}`);
    } catch (err) {
      console.error("Failed to send credentials email:", err);
      showToast("Failed to send credentials email", "error");
    } finally {
      setSendingCredentials(null);
    }
  };

  // filtering + sorting
  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || getEffectiveStatus(m, plans) === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    switch (sortBy) {
      case "name-az": return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      case "name-za": return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`);
      case "date-new": return (b.startDate || b.createdAt || "").localeCompare(a.startDate || a.createdAt || "");
      case "date-old": return (a.startDate || a.createdAt || "").localeCompare(b.startDate || b.createdAt || "");
      case "birthday": {
        const aM = a.dob ? new Date(a.dob + "T12:00:00").getMonth() * 100 + new Date(a.dob + "T12:00:00").getDate() : 9999;
        const bM = b.dob ? new Date(b.dob + "T12:00:00").getMonth() * 100 + new Date(b.dob + "T12:00:00").getDate() : 9999;
        return aM - bM;
      }
      case "plan": {
        const aP = plans.find(p => p.id === a.membershipPlanId)?.name || "zzz";
        const bP = plans.find(p => p.id === b.membershipPlanId)?.name || "zzz";
        return aP.localeCompare(bP);
      }
      default: return 0;
    }
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (m) => {
    setEditId(m.id);
    setForm({
      firstName: m.firstName, lastName: m.lastName, email: m.email, phone: m.phone,
      pin: m.pin || "", startDate: m.startDate || "", dob: m.dob || "", membershipStatus: m.membershipStatus,
      notes: m.notes || "", tagsStr: (m.tags || []).join(", "),
      street: m.address?.street || "", city: m.address?.city || "",
      state: m.address?.state || "", zip: m.address?.zip || "",
      holdStartDate: m.holdStartDate || "", holdEndDate: m.holdEndDate || "",
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    const data = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      pin: form.pin.trim(),
      startDate: form.startDate,
      dob: form.dob,
      notes: form.notes.trim(),
      tags: form.tagsStr.split(",").map(t => t.trim()).filter(Boolean),
      address: { street: form.street.trim(), city: form.city.trim(), state: form.state.trim(), zip: form.zip.trim(), country: "US" },
    };
    if (!data.firstName || !data.lastName) return;
    if (!editId && !data.dob) { showToast("Date of birth is required", "error"); return; }
    const fullName = data.firstName + " " + data.lastName;
    if (editId) {
      // Only include status changes for edits (frozen/unfrozen)
      if (form.membershipStatus) data.membershipStatus = form.membershipStatus;
      const existing = members.find(m => m.id === editId);
      const oldStatus = existing?.membershipStatus;
      const newStatus = data.membershipStatus;
      if (oldStatus && newStatus && oldStatus !== newStatus) {
        if (newStatus === "frozen") {
          const holdStart = form.holdStartDate || new Date().toISOString().slice(0, 10);
          const holdEnd = form.holdEndDate || "";
          data.holdStartDate = holdStart;
          data.holdEndDate = holdEnd;
          logEvent(editId, fullName, "freeze", { oldStatus, newStatus, holdStartDate: holdStart, holdEndDate: holdEnd });
          // Remove bookings ONLY during the hold period (not after holdEndDate)
          try {
            const sched = JSON.parse(localStorage.getItem("hf_schedule") || "[]");
            const updated = sched.map(c => {
              // If hold has an end date, only remove bookings for sessions on days within the hold period
              // Sessions are recurring by day-of-week, so we remove from all if no end date
              if (holdEnd) {
                // Keep bookings — they can re-book for after hold ends
                // Only remove if it's a current/upcoming session during hold
                return {
                  ...c,
                  bookings: (c.bookings || []).filter(id => id !== editId),
                  waitlist: (c.waitlist || []).filter(id => id !== editId),
                };
              }
              return {
                ...c,
                bookings: (c.bookings || []).filter(id => id !== editId),
                waitlist: (c.waitlist || []).filter(id => id !== editId),
              };
            });
            localStorage.setItem("hf_schedule", JSON.stringify(updated));
          } catch {}
        } else if (oldStatus === "frozen" && newStatus === "active") {
          data.holdStartDate = null;
          data.holdEndDate = null;
          logEvent(editId, fullName, "unfreeze", { oldStatus, newStatus });
        }
      }
      updateMember(editId, data);
    } else {
      // New client — no join event yet, that happens when a plan is assigned
      const newMember = addMember(data);
      // Auto-send welcome email
      if (data.email) {
        const branding = getBranding();
        const gymName = branding.gymName || "GymKit";
        const gymUrl = branding.gymUrl || window.location.origin;
        const credLabel = form.usePassword ? "Password" : "PIN";
        sendEmail({
          to: data.email,
          subject: `Welcome to ${gymName}! Your login credentials`,
          html: `<h2>Welcome, ${data.firstName}!</h2><p>Your account has been created. Here are your login details:</p><p><strong>Login URL:</strong> <a href="${gymUrl}">${gymUrl}</a></p><p><strong>Email:</strong> ${data.email}</p><p><strong>${credLabel}:</strong> <span style="font-size:18px;letter-spacing:2px;font-weight:bold;">${data.pin}</span></p><p>You can use these to log in to the client portal from your phone.</p><p>If you have any questions, message your coach through the app.</p>`,
        }).then(() => {
          showToast(`Welcome email sent to ${data.email}`);
        }).catch((err) => {
          console.error("Failed to send welcome email:", err);
        });
      } else {
        showToast("Client created (no email to send to)", "info");
      }
    }
    setModalOpen(false);
  };


  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // styles
  const s = {
    page: { minHeight: "100%" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 },
    title: { fontSize: 24, fontWeight: 800, color: B.text },
    count: { fontSize: 13, color: B.muted, marginLeft: 8, fontWeight: 400 },
    addBtn: { background: B.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
    searchRow: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" },
    searchInput: { flex: 1, minWidth: 200, background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "10px 14px", color: B.text, fontSize: 14, outline: "none" },
    pills: { display: "flex", gap: 6, flexWrap: "wrap" },
    pill: (active) => ({ padding: "6px 14px", borderRadius: 20, border: "1px solid " + (active ? B.accent : B.border), background: active ? B.accent : "transparent", color: active ? "#fff" : B.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .15s" }),
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340, 1fr))", gap: 14 },
    card: { background: B.card, borderRadius: 12, border: "1px solid " + B.border, padding: 18, display: "flex", flexDirection: "column", gap: 10 },
    cardTop: { display: "flex", alignItems: "center", gap: 14 },
    avatar: (color) => ({ width: 46, height: 46, borderRadius: "50%", background: color + "22", color: color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }),
    name: { fontSize: 15, fontWeight: 700, color: B.text, lineHeight: 1.2 },
    email: { fontSize: 12, color: B.muted },
    phone: { fontSize: 12, color: B.dim },
    badge: (color) => ({ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: color + "22", color: color, textTransform: "capitalize" }),
    rankBadge: { display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: B.purple + "22", color: B.purple, marginLeft: 6 },
    dots: { display: "flex", gap: 4, alignItems: "center", marginTop: 2 },
    dot: (color) => ({ width: 8, height: 8, borderRadius: "50%", background: color }),
    actions: { display: "flex", gap: 8, marginTop: "auto", paddingTop: 6 },
    actionBtn: (bg, fg) => ({ background: bg, color: fg, border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }),
    // Modal
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    modal: { background: B.dark, borderRadius: 14, border: "1px solid " + B.border, padding: 28, width: 440, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" },
    modalTitle: { fontSize: 18, fontWeight: 800, color: B.text, marginBottom: 18 },
    field: { marginBottom: 14 },
    label: { display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 },
    input: { width: "100%", background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "9px 12px", color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
    textarea: { width: "100%", background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "9px 12px", color: B.text, fontSize: 14, outline: "none", minHeight: 70, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" },
    select: { width: "100%", background: B.darker, border: "1px solid " + B.border, borderRadius: 8, padding: "9px 12px", color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
    modalActions: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 },
    cancelBtn: { background: "transparent", border: "1px solid " + B.border, borderRadius: 8, padding: "8px 18px", color: B.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" },
    saveBtn: { background: B.accent, border: "none", borderRadius: 8, padding: "8px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" },
    // Confirm dialog
    confirmOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 },
    confirmBox: { background: B.dark, borderRadius: 14, border: "1px solid " + B.border, padding: 28, width: 360, maxWidth: "90vw", textAlign: "center" },
    confirmText: { fontSize: 15, color: B.text, marginBottom: 20, lineHeight: 1.5 },
    deleteBtn: { background: B.red, border: "none", borderRadius: 8, padding: "8px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" },
    empty: { padding: 48, textAlign: "center", color: B.dim, fontSize: 14 },
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>
          Clients<span style={s.count}>({members.length})</span>
        </h1>
        <div style={{ display: "flex", gap: 10 }}>
          {duplicateGroups.length > 0 && (
            <button onClick={() => setShowMerge(!showMerge)} style={{
              background: showMerge ? B.orange + "18" : "transparent",
              border: "1px solid " + (showMerge ? B.orange + "40" : B.border),
              borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700,
              color: B.orange, cursor: "pointer",
            }}>
              Merge Duplicates ({duplicateGroups.length})
            </button>
          )}
          <button style={s.addBtn} onClick={openAdd}>+ Add Client</button>
        </div>
      </div>

      {/* Search + Filter + Sort */}
      <div style={s.searchRow}>
        <input
          style={s.searchInput}
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 13, outline: "none", cursor: "pointer" }}>
          <option value="name-az">Name A-Z</option>
          <option value="name-za">Name Z-A</option>
          <option value="date-new">Newest First</option>
          <option value="date-old">Oldest First</option>
          <option value="birthday">Birthday</option>
          <option value="plan">Plan</option>
        </select>
        <div style={s.pills}>
          {STATUS_OPTIONS.map((st) => (
            <button key={st} style={s.pill(statusFilter === st)} onClick={() => setStatusFilter(st)}>{st}</button>
          ))}
        </div>
      </div>

      {/* Merge Duplicates Panel */}
      {showMerge && duplicateGroups.length > 0 && (
        <div style={{ background: B.card, border: "1px solid " + (B.orange || "#f59e0b") + "30", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 12 }}>
            {duplicateGroups.length} Potential Duplicate{duplicateGroups.length !== 1 ? "s" : ""} Found
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {duplicateGroups.map((g, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: B.darker, border: "1px solid " + B.border + "44" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: B.text }}>
                    {g.a.firstName} {g.a.lastName} &amp; {g.b.firstName} {g.b.lastName}
                  </div>
                  <div style={{ fontSize: 11, color: B.muted, marginTop: 2 }}>
                    {g.reasons.join(" \u2022 ")}
                    {g.a.email && <span> \u2022 {g.a.email}</span>}
                  </div>
                </div>
                <button onClick={() => startMerge(g)} style={{
                  padding: "6px 16px", borderRadius: 8, border: "none",
                  background: B.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                  Merge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeSelection && (() => {
        const { a, b, picks, reasons } = mergeSelection;
        const getVal = (member, key) => {
          if (key === "membershipPlanId") {
            const plan = plans.find(p => p.id === member[key]);
            return plan ? plan.name : member[key] || "";
          }
          return member[key] || "";
        };
        const fieldBtn = (fieldKey, side) => {
          const selected = picks[fieldKey] === side;
          const member = side === "a" ? a : b;
          const val = getVal(member, fieldKey);
          return (
            <button onClick={() => setMergeSelection(prev => ({ ...prev, picks: { ...prev.picks, [fieldKey]: side } }))}
              style={{
                flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                border: selected ? `2px solid ${B.accent}` : `1px solid ${B.border}`,
                background: selected ? B.accent + "12" : B.dark,
                color: val ? B.text : B.dim, fontSize: 13, transition: "all 0.1s",
                fontWeight: selected ? 600 : 400,
              }}>
              {val || "(empty)"}
            </button>
          );
        };
        const addrA = a.address || {};
        const addrB = b.address || {};
        const addrStrA = [addrA.street, addrA.city, addrA.state, addrA.zip].filter(Boolean).join(", ");
        const addrStrB = [addrB.street, addrB.city, addrB.state, addrB.zip].filter(Boolean).join(", ");

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setMergeSelection(null)}>
            <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 16, padding: 28, maxWidth: 620, width: "95%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: B.text }}>Merge Duplicates</h3>
              <p style={{ color: B.muted, fontSize: 12, margin: "0 0 16px" }}>
                {reasons.join(" \u2022 ")} — click to pick which value to keep for each field.
              </p>

              {/* Column headers */}
              <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 100, fontSize: 11, fontWeight: 700, color: B.dim, textTransform: "uppercase" }}>Field</div>
                <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: B.accent, textTransform: "uppercase" }}>{a.firstName} {a.lastName}</div>
                <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: B.orange, textTransform: "uppercase" }}>{b.firstName} {b.lastName}</div>
              </div>

              {/* Field rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {MERGE_FIELDS.map(f => (
                  <div key={f.key} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 100, fontSize: 12, color: B.muted, fontWeight: 600, flexShrink: 0 }}>{f.label}</div>
                    {fieldBtn(f.key, "a")}
                    {fieldBtn(f.key, "b")}
                  </div>
                ))}
                {/* Address row */}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 100, fontSize: 12, color: B.muted, fontWeight: 600, flexShrink: 0 }}>Address</div>
                  <button onClick={() => setMergeSelection(prev => ({ ...prev, picks: { ...prev.picks, _address: "a" } }))}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left", border: picks._address === "a" ? `2px solid ${B.accent}` : `1px solid ${B.border}`, background: picks._address === "a" ? B.accent + "12" : B.dark, color: addrStrA ? B.text : B.dim, fontSize: 13, fontWeight: picks._address === "a" ? 600 : 400 }}>
                    {addrStrA || "(empty)"}
                  </button>
                  <button onClick={() => setMergeSelection(prev => ({ ...prev, picks: { ...prev.picks, _address: "b" } }))}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left", border: picks._address === "b" ? `2px solid ${B.accent}` : `1px solid ${B.border}`, background: picks._address === "b" ? B.accent + "12" : B.dark, color: addrStrB ? B.text : B.dim, fontSize: 13, fontWeight: picks._address === "b" ? 600 : 400 }}>
                    {addrStrB || "(empty)"}
                  </button>
                </div>
              </div>

              <p style={{ fontSize: 11, color: B.dim, margin: "0 0 16px", lineHeight: 1.5 }}>
                Tags, badges, and workout stats will be combined. Movement scores will keep the higher value. The second record will be deleted.
              </p>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setMergeSelection(null)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + B.border, background: "transparent", color: B.muted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
                <button onClick={executeMerge} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: B.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                  Merge Records
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Activity Log Toggle */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setShowHistory(!showHistory)} style={{
          background: showHistory ? B.accent + "15" : "transparent",
          border: "1px solid " + (showHistory ? B.accent + "40" : B.border),
          borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600,
          color: showHistory ? B.accent : B.muted, cursor: "pointer", transition: "all 0.15s",
        }}>
          {showHistory ? "\u25BC" : "\u25B6"} Activity Log
        </button>
      </div>

      {showHistory && (() => {
        const EVENT_ICONS = { join: "\u2795", cancel: "\u274C", freeze: "\u2744\uFE0F", unfreeze: "\u2600\uFE0F", upgrade: "\u2B06\uFE0F", downgrade: "\u2B07\uFE0F", plan_change: "\u21C4" };
        const ACTION_LABELS = { plan_assigned: "Plan Assigned", plan_removed: "Plan Removed", plan_changed: "Plan Changed", cancel_scheduled: "Cancel Scheduled", cancel_instant: "Cancelled", cancel_revoked: "Cancel Revoked", status_changed: "Status Changed", field_updated: "Updated" };

        const allEvents = [...(Array.isArray(events) ? events : [])].sort((a, b) => b.date.localeCompare(a.date));
        const activeChangelog = changelog.filter(e => !e.undone);

        const handleUndo = (entry) => {
          const m = members.find(x => x.id === entry.memberId);
          if (!m) return;
          if (entry.field === "membershipPlanId") {
            updateMember(m.id, { membershipPlanId: entry.oldValue, cancelScheduled: null });
            if (entry.action === "plan_assigned" || entry.action === "plan_changed") {
              removeLatestEvent(m.id, "join");
            } else if (entry.action === "plan_removed" || entry.action === "cancel_instant") {
              removeLatestEvent(m.id, "cancel");
            }
          } else if (entry.field === "cancelScheduled") {
            updateMember(m.id, { cancelScheduled: entry.oldValue || null });
            removeLatestEvent(m.id, "cancel");
          } else if (entry.field === "membershipStatus") {
            updateMember(m.id, { membershipStatus: entry.oldValue });
          }
          markUndone(entry.id);
          showToast("Change undone");
        };

        return (
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
            {/* Changelog entries with undo */}
            {activeChangelog.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Recent Changes (Undoable)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {activeChangelog.slice(0, 15).map(e => {
                    const d = new Date(e.date);
                    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    const label = ACTION_LABELS[e.action] || e.action;
                    const oldPlan = e.field === "membershipPlanId" && e.oldValue ? plans.find(p => p.id === e.oldValue) : null;
                    const newPlan = e.field === "membershipPlanId" && e.newValue ? plans.find(p => p.id === e.newValue) : null;
                    let detail = "";
                    if (oldPlan && newPlan) detail = `${oldPlan.name} \u2192 ${newPlan.name}`;
                    else if (oldPlan && !newPlan) detail = `Removed: ${oldPlan.name}`;
                    else if (!oldPlan && newPlan) detail = `Assigned: ${newPlan.name}`;
                    else if (e.field === "cancelScheduled" && e.newValue) detail = `Effective: ${new Date(e.newValue).toLocaleDateString()}`;
                    return (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: B.darker, border: "1px solid " + B.border + "33" }}>
                        <span style={{ fontSize: 14 }}>{"\uD83D\uDD04"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: B.text }}><strong>{e.memberName}</strong> — {label}</div>
                          {detail && <div style={{ fontSize: 12, color: B.muted }}>{detail}</div>}
                          <div style={{ fontSize: 11, color: B.dim }}>{dateStr} at {timeStr}{e.changedBy ? ` \u2022 by ${e.changedBy}` : ""}</div>
                        </div>
                        <button onClick={() => handleUndo(e)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid " + (B.orange || "#f59e0b") + "40", background: (B.orange || "#f59e0b") + "12", color: B.orange || "#f59e0b", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          Undo
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All membership events */}
            <div style={{ fontSize: 12, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Membership Events</div>
            {allEvents.length === 0 ? (
              <div style={{ color: B.dim, fontSize: 13, padding: "8px 0" }}>No events recorded yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
                {allEvents.slice(0, 50).map(e => {
                  const d = new Date(e.date);
                  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                  const icon = EVENT_ICONS[e.type] || "\uD83D\uDD18";
                  let desc = e.type;
                  if (e.type === "join") desc = `Joined${e.details?.newPlan ? " \u2014 " + e.details.newPlan + (e.details.newPrice ? " ($" + e.details.newPrice + ")" : "") : ""}`;
                  else if (e.type === "cancel") desc = `Cancelled${e.details?.oldPlan ? " \u2014 " + e.details.oldPlan + (e.details.oldPrice ? " ($" + e.details.oldPrice + ")" : "") : ""}${e.details?.cancelType === "end_of_cycle" ? " (end of cycle)" : e.details?.cancelType === "future" ? " (scheduled)" : ""}`;
                  else if (e.type === "upgrade") desc = `Upgraded: ${e.details?.oldPlan || "?"} \u2192 ${e.details?.newPlan || "?"}`;
                  else if (e.type === "downgrade") desc = `Downgraded: ${e.details?.oldPlan || "?"} \u2192 ${e.details?.newPlan || "?"}`;
                  else if (e.type === "freeze") desc = `Frozen${e.details?.reason ? " \u2014 " + e.details.reason : ""}`;
                  else if (e.type === "unfreeze") desc = "Unfrozen";
                  else if (e.type === "plan_change") desc = `Plan changed: ${e.details?.oldPlan || "?"} \u2192 ${e.details?.newPlan || "?"}`;
                  return (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: B.darker }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: B.text }}><strong>{e.memberName}</strong> — {desc}</div>
                        <div style={{ fontSize: 11, color: B.dim }}>{dateStr} at {timeStr}{e.changedBy ? ` \u2022 by ${e.changedBy}` : ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Member Cards */}
      {filtered.length === 0 ? (
        <div style={s.empty}>No clients match your filters.</div>
      ) : (
        <div style={s.grid}>
          {filtered.map((m) => {
            const effectiveStatus = getEffectiveStatus(m, plans);
            const color = sc[effectiveStatus] || B.muted;
            return (
              <div key={m.id} style={s.card}>
                <div style={s.cardTop}>
                  {m.photo ? (
                    <img src={m.photo} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={s.avatar(color)}>{getInitials(m.firstName, m.lastName)}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.name}>{m.firstName} {m.lastName}</div>
                    <div style={s.email}>{m.email}</div>
                    <div style={s.phone}>{m.phone}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={s.badge(color)}>{effectiveStatus}</span>
                  </div>
                </div>

                {/* Movement score dots */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: B.dim, marginRight: 2 }}>Movement:</span>
                  {PATTERNS.map((p) => {
                    const v = m.movementScores?.[p] ?? 0;
                    return (
                      <div key={p} title={`${p}: ${v > 0 ? "+" : ""}${v}`} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 9, color: B.dim }}>{p[0]}</span>
                        <div style={s.dot(scoreColor(v))} />
                      </div>
                    );
                  })}
                </div>

                {/* Gamification summary */}
                <div style={{ fontSize: 11, color: B.dim, display: "flex", gap: 12 }}>
                  <span>Lvl {m.gamification?.level || 1}</span>
                  <span>{m.gamification?.totalWorkouts || 0} workouts</span>
                  <span>Streak: {m.gamification?.currentStreak || 0}</span>
                </div>

                {/* Session utilization */}
                {(() => {
                  const plan = plans.find(p => p.id === m.membershipPlanId);
                  if (!plan?.sessionsIncluded) return null;
                  const cm = new Date().toISOString().slice(0, 7);
                  const used = attendance.filter(a => a.memberId === m.id && !a.noShow && a.checkInTime?.slice(0, 7) === cm).length;
                  const util = Math.min(Math.round((used / plan.sessionsIncluded) * 100), 100);
                  const over = used > plan.sessionsIncluded;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: B.dim }}>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: B.border + "44", overflow: "hidden" }}>
                        <div style={{ width: Math.min(util, 100) + "%", height: "100%", borderRadius: 3, background: over ? B.red : util >= 80 ? B.orange : B.green }} />
                      </div>
                      <span style={{ fontWeight: 600, color: over ? B.red : util >= 80 ? B.orange : B.green, whiteSpace: "nowrap" }}>{used}/{plan.sessionsIncluded} sessions ({util}%)</span>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div style={s.actions}>
                  <button style={s.actionBtn(B.accent + "22", B.accent)} onClick={() => navigate(`/members/${m.id}`)}>View</button>
                  <button style={s.actionBtn(B.border, B.text)} onClick={() => openEdit(m)}>Edit</button>
                  <button
                    style={{ ...s.actionBtn(B.blue + "18", B.blue), opacity: sendingCredentials === m.id ? 0.6 : 1 }}
                    onClick={() => sendCredentialsEmail(m)}
                    disabled={sendingCredentials === m.id}
                  >
                    {sendingCredentials === m.id ? "Sending..." : "Send Credentials"}
                  </button>
                  <button style={s.actionBtn(B.purple + "18", B.purple || "#a855f7")} onClick={() => {
                    const gymId = localStorage.getItem("hf_gym_id") || "default";
                    localStorage.setItem("hf_session_backup", localStorage.getItem("hf_session") || "");
                    localStorage.setItem("hf_impersonating", "true");
                    localStorage.setItem("hf_session", JSON.stringify({
                      id: "impersonate_client_" + m.id,
                      username: m.email,
                      role: "client",
                      memberId: m.id,
                      displayName: m.firstName + " " + m.lastName + " (viewing as client)",
                      gymId,
                    }));
                    window.location.href = `/gym/${gymId}/`;
                  }}>View as Client</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div style={s.overlay} onClick={() => setModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalTitle}>{editId ? "Edit Client" : "Add Client"}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={s.field}>
                <label style={s.label}>First Name *</label>
                <input style={s.input} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Last Name *</label>
                <input style={s.input} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={s.field}>
                <label style={s.label}>Phone</label>
                <input style={s.input} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div style={s.field}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ ...s.label, marginBottom: 0 }}>{form.usePassword ? "Password" : "PIN (4-digit)"}</label>
                  <button
                    type="button"
                    onClick={() => { set("usePassword", !form.usePassword); set("pin", ""); }}
                    style={{ background: "transparent", border: "none", color: B.accent, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    {form.usePassword ? "Use PIN instead" : "Use Password instead"}
                  </button>
                </div>
                {form.usePassword ? (
                  <input style={s.input} type="password" value={form.pin} onChange={(e) => set("pin", e.target.value)} placeholder="Enter password" />
                ) : (
                  <input style={s.input} maxLength={4} value={form.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, "").slice(0, 4))} />
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={s.field}>
                <label style={s.label}>Date of Birth *</label>
                <input style={s.input} type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>Start Date</label>
                <input style={s.input} type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
            </div>

            {editId && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                <div style={s.field}>
                  <label style={s.label}>Status</label>
                  <select style={s.select} value={form.membershipStatus} onChange={(e) => set("membershipStatus", e.target.value)}>
                    <option value="active">Active</option>
                    <option value="frozen">Frozen (Hold)</option>
                  </select>
                </div>
            </div>
            )}

            {editId && form.membershipStatus === "frozen" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={s.field}>
                  <label style={s.label}>Hold Start Date</label>
                  <input style={s.input} type="date" value={form.holdStartDate || ""} onChange={(e) => set("holdStartDate", e.target.value)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Hold End Date</label>
                  <input style={s.input} type="date" value={form.holdEndDate || ""} onChange={(e) => set("holdEndDate", e.target.value)} />
                </div>
              </div>
            )}

            <div style={s.field}>
              <label style={s.label}>Street Address</label>
              <input style={s.input} value={form.street} onChange={(e) => set("street", e.target.value)} placeholder="123 Main St" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div style={s.field}>
                <label style={s.label}>City</label>
                <input style={s.input} value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div style={s.field}>
                <label style={s.label}>State</label>
                <input style={s.input} value={form.state} onChange={(e) => set("state", e.target.value)} maxLength={2} placeholder="TX" />
              </div>
              <div style={s.field}>
                <label style={s.label}>ZIP</label>
                <input style={s.input} value={form.zip} onChange={(e) => set("zip", e.target.value)} maxLength={10} placeholder="78701" />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Notes</label>
              <textarea style={s.textarea} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Tags (comma-separated)</label>
              <input style={s.input} value={form.tagsStr} onChange={(e) => set("tagsStr", e.target.value)} placeholder="e.g. morning, athlete, rehab" />
            </div>

            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
              <button style={s.saveBtn} onClick={handleSave}>{editId ? "Save Changes" : "Add Client"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1100,
          background: toast.type === "error" ? "#7f1d1d" : toast.type === "info" ? B.blue : "#14532d",
          color: toast.type === "error" ? "#fca5a5" : toast.type === "info" ? "#bfdbfe" : "#86efac",
          padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)", maxWidth: 360,
        }}>
          {toast.msg}
        </div>
      )}

    </div>
  );
}
