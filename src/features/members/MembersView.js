import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useMembershipEvents } from "../../hooks/useMembershipEvents";

const STATUS_COLORS = (B) => ({ active: B.green, trial: B.orange, frozen: B.blue, inactive: B.red });
const STATUS_OPTIONS = ["All", "Active", "Trial", "Frozen", "Inactive"];
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
  firstName: "", lastName: "", email: "", phone: "", pin: "", startDate: "",
  membershipStatus: "active", notes: "", tagsStr: "",
  street: "", city: "", state: "", zip: "",
});

export default function MembersView() {
  const B = useTheme();
  const navigate = useNavigate();
  const { members, addMember, updateMember, deleteMember } = useMembers();
  const { logEvent } = useMembershipEvents();
  const sc = STATUS_COLORS(B);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // filtering
  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || m.membershipStatus === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (m) => {
    setEditId(m.id);
    setForm({
      firstName: m.firstName, lastName: m.lastName, email: m.email, phone: m.phone,
      pin: m.pin || "", startDate: m.startDate || "", membershipStatus: m.membershipStatus,
      notes: m.notes || "", tagsStr: (m.tags || []).join(", "),
      street: m.address?.street || "", city: m.address?.city || "",
      state: m.address?.state || "", zip: m.address?.zip || "",
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
      membershipStatus: form.membershipStatus,
      notes: form.notes.trim(),
      tags: form.tagsStr.split(",").map(t => t.trim()).filter(Boolean),
      address: { street: form.street.trim(), city: form.city.trim(), state: form.state.trim(), zip: form.zip.trim(), country: "US" },
    };
    if (!data.firstName || !data.lastName) return;
    const fullName = data.firstName + " " + data.lastName;
    if (editId) {
      const existing = members.find(m => m.id === editId);
      const oldStatus = existing?.membershipStatus;
      const newStatus = data.membershipStatus;
      if (oldStatus && newStatus && oldStatus !== newStatus) {
        if (newStatus === "inactive") {
          logEvent(editId, fullName, "cancel", { oldStatus, newStatus });
        } else if (newStatus === "frozen") {
          logEvent(editId, fullName, "freeze", { oldStatus, newStatus });
        } else if (oldStatus === "frozen" && newStatus === "active") {
          logEvent(editId, fullName, "unfreeze", { oldStatus, newStatus });
        }
      }
      updateMember(editId, data);
    } else {
      const newMember = addMember(data);
      logEvent(newMember.id, fullName, "join", { newStatus: data.membershipStatus });
    }
    setModalOpen(false);
  };

  const handleDelete = (id) => { deleteMember(id); setConfirmDeleteId(null); };

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
        <button style={s.addBtn} onClick={openAdd}>+ Add Client</button>
      </div>

      {/* Search + Filter */}
      <div style={s.searchRow}>
        <input
          style={s.searchInput}
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={s.pills}>
          {STATUS_OPTIONS.map((st) => (
            <button key={st} style={s.pill(statusFilter === st)} onClick={() => setStatusFilter(st)}>{st}</button>
          ))}
        </div>
      </div>

      {/* Member Cards */}
      {filtered.length === 0 ? (
        <div style={s.empty}>No clients match your filters.</div>
      ) : (
        <div style={s.grid}>
          {filtered.map((m) => {
            const color = sc[m.membershipStatus] || B.muted;
            return (
              <div key={m.id} style={s.card}>
                <div style={s.cardTop}>
                  <div style={s.avatar(color)}>{getInitials(m.firstName, m.lastName)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.name}>{m.firstName} {m.lastName}</div>
                    <div style={s.email}>{m.email}</div>
                    <div style={s.phone}>{m.phone}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={s.badge(color)}>{m.membershipStatus}</span>
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

                {/* Actions */}
                <div style={s.actions}>
                  <button style={s.actionBtn(B.accent + "22", B.accent)} onClick={() => navigate(`/members/${m.id}`)}>View</button>
                  <button style={s.actionBtn(B.border, B.text)} onClick={() => openEdit(m)}>Edit</button>
                  <button style={s.actionBtn(B.red + "18", B.red)} onClick={() => setConfirmDeleteId(m.id)}>Delete</button>
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
                <label style={s.label}>PIN (4-digit)</label>
                <input style={s.input} maxLength={4} value={form.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, "").slice(0, 4))} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={s.field}>
                <label style={s.label}>Start Date</label>
                <input style={s.input} type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Status</label>
                <select style={s.select} value={form.membershipStatus} onChange={(e) => set("membershipStatus", e.target.value)}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="frozen">Frozen</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

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

      {/* Delete Confirm Dialog */}
      {confirmDeleteId && (
        <div style={s.confirmOverlay} onClick={() => setConfirmDeleteId(null)}>
          <div style={s.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div style={s.confirmText}>
              <strong>Delete this client?</strong><br />
              This action cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button style={s.cancelBtn} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button style={s.deleteBtn} onClick={() => handleDelete(confirmDeleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
