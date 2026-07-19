import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useIsMobile } from "../../hooks/useIsMobile";
import { localISO } from "../../utils/dates";
import TaskTypeFields, { TYPE_META } from "./TaskTypeFields";

/* dataURLs can't be opened as a top-level page in modern browsers,
   so we open a blank window and frame the file inside it. */
function viewUpload(up) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(
    `<title>${(up.name || "Upload").replace(/</g, "&lt;")}</title>` +
    `<body style="margin:0"><iframe src="${up.dataUrl}" style="border:0;width:100vw;height:100vh"></iframe></body>`
  );
}

const emptyForm = () => ({
  title: "", description: "", type: "custom",
  courseId: "", doc: null, prompt: "",
  targetCount: 5, challengeId: "", challengeName: "",
  scheduledFor: localISO(), dueDate: "",
});

const emptyTplRow = () => ({
  title: "", description: "", type: "custom",
  courseId: "", doc: null, prompt: "",
  targetCount: 5, challengeId: "", challengeName: "",
  offsetDays: 0, dueOffsetDays: null,
});

export default function ClientTasksTab({ member }) {
  const B = useTheme();
  const { currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useLocalStorage("hf_client_tasks", []);
  const [templates, setTemplates] = useLocalStorage("hf_task_templates", []);
  const [courses] = useLocalStorage("hf_courses", []);
  const [challenges] = useLocalStorage("hf_challenges", []);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showTemplates, setShowTemplates] = useState(false);
  const [tplEdit, setTplEdit] = useState(null); // template being created/edited in the modal
  const [toast, setToast] = useState("");

  const coachName = (currentUser && currentUser.displayName) || "Coach";
  const courseList = Array.isArray(courses) ? courses : [];
  const challengeList = Array.isArray(challenges) ? challenges : [];
  const templateList = Array.isArray(templates) ? templates : [];
  const todayISO = localISO();

  const myTasks = (Array.isArray(tasks) ? tasks : [])
    .filter((t) => t.memberId === member.id)
    .sort((a, b) => (b.scheduledFor || "").localeCompare(a.scheduledFor || ""));

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  /* ── Styles (match ProgressReportsTab) ── */
  const card = { background: B.card, border: `1px solid ${B.border}`, borderRadius: 12, padding: 16, marginBottom: 12 };
  const btn = (bg, fg, solid) => ({
    background: solid ? bg : bg + "18", color: solid ? "#fff" : fg || bg,
    border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  });
  const input = {
    width: "100%", boxSizing: "border-box", background: B.dark, color: B.text,
    border: `1px solid ${B.border}`, borderRadius: 8, padding: "8px 10px",
    fontSize: 13, outline: "none", fontFamily: "inherit",
  };
  const label = { fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 };
  const chip = (bg, color) => ({ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 10, background: bg, color });

  /* ── Actions ── */
  const saveTask = () => {
    if (!form.title.trim()) { window.alert("Title is required."); return; }
    if (form.type === "course" && !form.courseId) { window.alert("Pick a course for this task."); return; }
    if (form.type === "doc" && !form.doc) { window.alert("Attach a file for this task."); return; }
    if (form.type === "challenge" && !form.challengeId) { window.alert("Pick a challenge for this task."); return; }
    const t = {
      id: crypto.randomUUID(),
      memberId: member.id,
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      scheduledFor: form.scheduledFor || todayISO,
      status: "pending",
      createdBy: coachName,
      createdAt: new Date().toISOString(),
    };
    if (form.type === "course") t.courseId = form.courseId;
    if (form.type === "doc") t.doc = form.doc;
    if (form.type === "community_post") t.prompt = form.prompt.trim();
    if (form.type === "attendance") t.targetCount = Math.max(1, Number(form.targetCount) || 5);
    if (form.type === "challenge") {
      t.challengeId = form.challengeId;
      t.challengeName = form.challengeName || "";
    }
    if (form.dueDate) t.dueDate = form.dueDate;
    setTasks((prev) => [...(Array.isArray(prev) ? prev : []), t]);
    setShowForm(false);
    setForm(emptyForm());
    flash(`Task assigned to ${member.firstName} ✓`);
  };

  const deleteTask = (t) => {
    if (!window.confirm(`Delete task "${t.title}"? This cannot be undone.`)) return;
    setTasks((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== t.id));
  };

  const assignTemplate = (tplId) => {
    const tpl = templateList.find((t) => t.id === tplId);
    if (!tpl) return;
    const created = (tpl.tasks || []).map((tt) => {
      const task = {
        id: crypto.randomUUID(),
        memberId: member.id,
        title: tt.title,
        description: tt.description || "",
        type: tt.type,
        scheduledFor: localISO(new Date(Date.now() + (tt.offsetDays || 0) * 86400000)),
        status: "pending",
        createdBy: coachName,
        createdAt: new Date().toISOString(),
        templateId: tpl.id,
      };
      if (tt.type === "course" && tt.courseId) task.courseId = tt.courseId;
      if (tt.type === "doc" && tt.doc) task.doc = tt.doc;
      if (tt.type === "community_post" && tt.prompt) task.prompt = tt.prompt;
      if (tt.type === "attendance") task.targetCount = Math.max(1, Number(tt.targetCount) || 5);
      if (tt.type === "challenge" && tt.challengeId) {
        task.challengeId = tt.challengeId;
        task.challengeName = tt.challengeName || "";
      }
      if (tt.dueOffsetDays !== null && tt.dueOffsetDays !== undefined) {
        task.dueDate = localISO(new Date(Date.now() + tt.dueOffsetDays * 86400000));
      }
      return task;
    });
    if (created.length === 0) { flash("That template has no tasks."); return; }
    setTasks((prev) => [...(Array.isArray(prev) ? prev : []), ...created]);
    flash(`"${tpl.name}" assigned — ${created.length} task${created.length === 1 ? "" : "s"} created 📋`);
  };

  /* ── Template editor helpers ── */
  const updateTplRow = (i, patch) =>
    setTplEdit((p) => ({ ...p, tasks: p.tasks.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));

  const saveTemplate = () => {
    if (!tplEdit.name.trim()) { window.alert("Template name is required."); return; }
    const rows = tplEdit.tasks
      .filter((r) => r.title.trim())
      .map((r) => ({
        title: r.title.trim(),
        description: (r.description || "").trim(),
        type: r.type,
        ...(r.type === "course" && r.courseId ? { courseId: r.courseId } : {}),
        ...(r.type === "doc" && r.doc ? { doc: r.doc } : {}),
        ...(r.type === "community_post" && r.prompt ? { prompt: r.prompt.trim() } : {}),
        ...(r.type === "attendance" ? { targetCount: Math.max(1, Number(r.targetCount) || 5) } : {}),
        ...(r.type === "challenge" && r.challengeId ? { challengeId: r.challengeId, challengeName: r.challengeName || "" } : {}),
        offsetDays: Number(r.offsetDays) || 0,
        dueOffsetDays: r.dueOffsetDays === null || r.dueOffsetDays === undefined || r.dueOffsetDays === "" ? null : Number(r.dueOffsetDays),
      }));
    if (rows.length === 0) { window.alert("Add at least one task with a title."); return; }
    const tpl = { id: tplEdit.id, name: tplEdit.name.trim(), tasks: rows };
    setTemplates((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.some((t) => t.id === tpl.id) ? list.map((t) => (t.id === tpl.id ? tpl : t)) : [...list, tpl];
    });
    setTplEdit(null);
    flash(`Template "${tpl.name}" saved ✓`);
  };

  const deleteTemplate = (tpl) => {
    if (!window.confirm(`Delete template "${tpl.name}"? This cannot be undone.`)) return;
    setTemplates((prev) => (Array.isArray(prev) ? prev : []).filter((t) => t.id !== tpl.id));
  };

  /* ── Templates manager modal ── */
  const renderTemplatesModal = () => (
    <div style={{
      position: "fixed", inset: 0, background: "#000a", zIndex: 1000,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: isMobile ? 10 : 40, overflowY: "auto",
    }}>
      <div style={{ ...card, width: "100%", maxWidth: 760, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: B.text }}>
            {tplEdit ? (templateList.some((t) => t.id === tplEdit.id) ? "Edit Template" : "New Template") : "Task Templates"}
          </div>
          <button style={btn(B.border, B.muted)} onClick={() => { setTplEdit(null); setShowTemplates(false); }}>Close</button>
        </div>

        {!tplEdit && (
          <>
            {templateList.length === 0 && (
              <p style={{ color: B.muted, fontSize: 13, margin: "8px 0" }}>
                No templates yet. Build one — e.g. an onboarding sequence — then assign it to any client in one click.
              </p>
            )}
            {templateList.map((tpl) => (
              <div key={tpl.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap",
                padding: "10px 12px", borderRadius: 10, border: `1px solid ${B.border}`, marginBottom: 8,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: B.text }}>{tpl.name}</div>
                  <div style={{ fontSize: 11, color: B.muted, marginTop: 2 }}>
                    {(tpl.tasks || []).length} task{(tpl.tasks || []).length === 1 ? "" : "s"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button style={btn(B.accent)} onClick={() => setTplEdit({ id: tpl.id, name: tpl.name, tasks: (tpl.tasks || []).map((r) => ({ ...emptyTplRow(), ...r })) })}>Edit</button>
                  <button style={btn("#ef4444")} onClick={() => deleteTemplate(tpl)}>Delete</button>
                </div>
              </div>
            ))}
            <button style={{ ...btn(B.accent, null, true), marginTop: 6 }}
              onClick={() => setTplEdit({ id: crypto.randomUUID(), name: "", tasks: [emptyTplRow()] })}>
              + New Template
            </button>
          </>
        )}

        {tplEdit && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Template name</label>
              <input value={tplEdit.name} placeholder="e.g. New Client Onboarding"
                onChange={(e) => setTplEdit((p) => ({ ...p, name: e.target.value }))} style={input} />
            </div>

            {tplEdit.tasks.map((row, i) => (
              <div key={i} style={{ border: `1px solid ${B.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={label}>Task title</label>
                    <input value={row.title} placeholder="e.g. Read the welcome packet"
                      onChange={(e) => updateTplRow(i, { title: e.target.value })} style={input} />
                  </div>
                  <div>
                    <label style={label}>Type</label>
                    <select value={row.type} onChange={(e) => updateTplRow(i, { type: e.target.value })} style={input}>
                      {Object.entries(TYPE_META).map(([k, m]) => (
                        <option key={k} value={k}>{m.icon} {m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={label}>Description</label>
                  <textarea rows={2} value={row.description} placeholder="What do they need to do?"
                    onChange={(e) => updateTplRow(i, { description: e.target.value })}
                    style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
                </div>
                {row.type !== "custom" && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={label}>{TYPE_META[row.type].label} details</label>
                    <TaskTypeFields B={B} row={row} onChange={(patch) => updateTplRow(i, patch)} courses={courseList} challenges={challengeList} input={input} />
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={label}>Start day (0 = immediately)</label>
                    <input type="number" min="0" value={row.offsetDays}
                      onChange={(e) => updateTplRow(i, { offsetDays: e.target.value === "" ? 0 : Number(e.target.value) })} style={input} />
                  </div>
                  <div>
                    <label style={label}>Due day (optional)</label>
                    <input type="number" min="0" placeholder="No due date"
                      value={row.dueOffsetDays === null || row.dueOffsetDays === undefined ? "" : row.dueOffsetDays}
                      onChange={(e) => updateTplRow(i, { dueOffsetDays: e.target.value === "" ? null : Number(e.target.value) })} style={input} />
                  </div>
                </div>
                <button style={{ ...btn("#ef4444"), marginTop: 8 }}
                  onClick={() => setTplEdit((p) => ({ ...p, tasks: p.tasks.filter((_, idx) => idx !== i) }))}>
                  ✕ Remove task
                </button>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <button style={btn(B.accent)} onClick={() => setTplEdit((p) => ({ ...p, tasks: [...p.tasks, emptyTplRow()] }))}>
                + Add Task Row
              </button>
              <button style={btn(B.accent, null, true)} onClick={saveTemplate}>Save Template</button>
              <button style={btn(B.border, B.muted)} onClick={() => setTplEdit(null)}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  /* ── Assign form ── */
  const renderForm = () => (
    <div style={{ border: `1px dashed ${B.accent}66`, background: B.accent + "08", borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: B.text, marginBottom: 10 }}>Assign a task to {member.firstName}</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={label}>Title *</label>
          <input value={form.title} placeholder="e.g. Watch your form video"
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} style={input} />
        </div>
        <div>
          <label style={label}>Type</label>
          <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={input}>
            {Object.entries(TYPE_META).map(([k, m]) => (
              <option key={k} value={k}>{m.icon} {m.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={label}>Description</label>
        <textarea rows={2} value={form.description} placeholder="What do they need to do?"
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
      </div>
      {form.type !== "custom" && (
        <div style={{ marginBottom: 8 }}>
          <label style={label}>{TYPE_META[form.type].label} details</label>
          <TaskTypeFields B={B} row={form} onChange={(patch) => setForm((p) => ({ ...p, ...patch }))} courses={courseList} challenges={challengeList} input={input} />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={label}>Scheduled date</label>
          <input type="date" value={form.scheduledFor}
            onChange={(e) => setForm((p) => ({ ...p, scheduledFor: e.target.value }))} style={input} />
        </div>
        <div>
          <label style={label}>Due date (optional)</label>
          <input type="date" value={form.dueDate}
            onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} style={input} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={btn(B.accent, null, true)} onClick={saveTask}>Assign Task</button>
        <button style={btn(B.border, B.muted)} onClick={() => { setShowForm(false); setForm(emptyForm()); }}>Cancel</button>
      </div>
    </div>
  );

  /* ── Main ── */
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: B.text }}>Tasks</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value=""
            onChange={(e) => { if (e.target.value) assignTemplate(e.target.value); }}
            title={templateList.length === 0 ? "No templates yet — create one under Manage Templates" : "Assign every task in a template to this client"}
            style={{ ...input, width: "auto", padding: "7px 10px", fontSize: 12, fontWeight: 700 }}
          >
            <option value="">Assign Template...</option>
            {templateList.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button style={btn(B.accent, null, true)} onClick={() => setShowForm((v) => !v)}>+ Assign Task</button>
          <button style={btn(B.accent)} onClick={() => setShowTemplates(true)}>Manage Templates</button>
        </div>
      </div>

      {toast && <div style={{ marginBottom: 10, fontSize: 12, color: B.accent, fontWeight: 600 }}>{toast}</div>}

      {showForm && renderForm()}

      {myTasks.length === 0 && !showForm && (
        <p style={{ color: B.muted, fontSize: 13, margin: "8px 0" }}>
          No tasks yet. Assign one — send {member.firstName} a document, a course, a community post prompt, or any custom to-do. They'll see it in their app.
        </p>
      )}

      {myTasks.map((t) => {
        const meta = TYPE_META[t.type] || TYPE_META.custom;
        const future = (t.scheduledFor || "") > todayISO;
        const done = t.status === "done";
        return (
          <div key={t.id} style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
            padding: "10px 12px", borderRadius: 10, border: `1px solid ${B.border}`, marginBottom: 8,
            opacity: done ? 0.75 : 1,
          }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: B.text }}>{meta.icon} {t.title}</div>
              {t.description && (
                <div style={{ fontSize: 12, color: B.muted, marginTop: 2, whiteSpace: "pre-wrap" }}>{t.description}</div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                {done ? (
                  <span style={chip(B.border, B.muted)}>
                    DONE{t.completedAt ? ` ${new Date(t.completedAt).toLocaleDateString()}` : ""}
                  </span>
                ) : (
                  <span style={chip(B.accent + "22", B.accent)}>PENDING</span>
                )}
                <span style={chip(B.dark, B.muted)}>
                  {future ? `Scheduled ${t.scheduledFor}` : t.scheduledFor}
                </span>
                {t.dueDate && <span style={chip("#f59e0b22", "#f59e0b")}>Due {t.dueDate}</span>}
                {t.type === "attendance" && (
                  <span style={chip("#8b5cf622", "#8b5cf6")}>💪 {t.targetCount || 5} workouts</span>
                )}
                {t.type === "challenge" && t.challengeName && (
                  <span style={chip("#3b82f622", "#3b82f6")}>🎯 {t.challengeName}</span>
                )}
                {t.upload && (
                  <button
                    onClick={() => viewUpload(t.upload)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 700, color: "#3b82f6", textDecoration: "underline" }}
                  >
                    → view upload
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => deleteTask(t)}
              title="Delete task"
              style={{ background: "none", border: "none", cursor: "pointer", color: B.muted, fontSize: 14, padding: "2px 6px", flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        );
      })}

      {showTemplates && renderTemplatesModal()}
    </div>
  );
}
