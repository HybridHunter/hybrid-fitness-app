/* Shared task-type metadata + type-specific field editor.
   Used by ClientTasksTab (assign form + template rows) and
   GamificationView (treasure map stop rows). */

export const TYPE_META = {
  custom: { icon: "📝", label: "Custom" },
  doc: { icon: "📄", label: "Document" },
  course: { icon: "🎓", label: "Course" },
  community_post: { icon: "📣", label: "Community Post" },
  attendance: { icon: "💪", label: "Complete N Workouts" },
  challenge: { icon: "🎯", label: "Join a Challenge" },
};

export const MAX_DOC_BYTES = 2 * 1024 * 1024; // 2MB

/* Read a file into { name, dataUrl }. Rejects files over 2MB with an alert. */
export function readDoc(file, cb) {
  if (file.size > MAX_DOC_BYTES) {
    window.alert(`"${file.name}" is too large — files must be 2MB or smaller.`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => cb({ name: file.name, dataUrl: reader.result });
  reader.readAsDataURL(file);
}

/* Type-specific inputs.
   row: { type, courseId, doc, prompt, targetCount, challengeId, challengeName };
   onChange receives a partial patch. */
export default function TaskTypeFields({ B, row, onChange, courses, challenges, input }) {
  if (row.type === "course") {
    return (
      <select value={row.courseId || ""} onChange={(e) => onChange({ courseId: e.target.value })} style={input}>
        <option value="">Select a course...</option>
        {(courses || []).map((c) => (
          <option key={c.id} value={c.id}>{c.title || "Untitled course"}</option>
        ))}
      </select>
    );
  }
  if (row.type === "doc") {
    return (
      <div>
        <input
          type="file"
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            e.target.value = "";
            if (f) readDoc(f, (doc) => onChange({ doc }));
          }}
          style={{ fontSize: 12, color: B.muted }}
        />
        {row.doc && <div style={{ fontSize: 11, color: B.accent, marginTop: 4, fontWeight: 600 }}>📄 {row.doc.name} attached</div>}
      </div>
    );
  }
  if (row.type === "community_post") {
    return (
      <textarea
        rows={2}
        placeholder="What should they post about?"
        value={row.prompt || ""}
        onChange={(e) => onChange({ prompt: e.target.value })}
        style={{ ...input, resize: "vertical", lineHeight: 1.5 }}
      />
    );
  }
  if (row.type === "attendance") {
    return (
      <div>
        <input
          type="number"
          min="1"
          value={row.targetCount === undefined || row.targetCount === null || row.targetCount === "" ? "" : row.targetCount}
          placeholder="5"
          onChange={(e) => onChange({ targetCount: e.target.value === "" ? "" : Number(e.target.value) })}
          style={input}
        />
        <div style={{ fontSize: 11, color: B.muted, marginTop: 4 }}>
          Workouts to complete — auto-completes when they log this many check-ins.
        </div>
      </div>
    );
  }
  if (row.type === "challenge") {
    const list = challenges || [];
    return (
      <div>
        <select
          value={row.challengeId || ""}
          onChange={(e) => {
            const ch = list.find((c) => c.id === e.target.value);
            onChange({
              challengeId: e.target.value,
              challengeName: ch ? (ch.name || ch.title || "") : "",
            });
          }}
          style={input}
        >
          <option value="">Select a challenge...</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>{c.name || c.title || "Untitled challenge"}</option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: B.muted, marginTop: 4 }}>
          Auto-completes when they join this challenge.
        </div>
      </div>
    );
  }
  return null;
}
