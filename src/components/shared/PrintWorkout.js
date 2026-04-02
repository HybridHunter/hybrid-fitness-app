import { getLabel } from "../../data/constants";

export default function PrintWorkout({ workout }) {
  if (!workout) return null;
  const w = workout;
  const secs = w.sections || [];

  return (
    <div id="print-area" style={{ display: "none" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "3px solid #1a1a1a",
          paddingBottom: 10,
          marginBottom: 14,
        }}
      >
        <img
          src="https://hybridfitnessgym.com/wp-content/uploads/2020/11/hybrid-fitness-long-website.png"
          alt="Hybrid Fitness"
          style={{ height: 36, objectFit: "contain" }}
        />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{w.name || "Workout"}</div>
          <div style={{ fontSize: 12, color: "#555" }}>
            {w.phase} &middot; {w.workoutLabel}
          </div>
        </div>
      </div>

      {/* Description */}
      {w.description && (
        <div
          style={{
            fontSize: 11,
            color: "#444",
            marginBottom: 12,
            fontStyle: "italic",
            borderLeft: "3px solid #ccc",
            paddingLeft: 8,
          }}
        >
          {w.description}
        </div>
      )}

      {/* Sections */}
      {secs.map((sec, si) => {
        const slots = sec.slots || [];
        const filled = slots.filter((s) => s.exercise);
        if (!filled.length) return null;

        return (
          <div key={si} style={{ marginBottom: 12, pageBreakInside: "avoid" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                textTransform: "uppercase",
                borderBottom: "2px solid #333",
                paddingBottom: 3,
                marginBottom: 6,
              }}
            >
              {sec.id}. {sec.name}{" "}
              <span style={{ fontWeight: 400, fontSize: 10, color: "#888" }}>
                ({sec.repRange})
              </span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ textAlign: "left", padding: "4px 6px", width: 24, borderBottom: "1px solid #ccc" }}>#</th>
                  <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>Exercise</th>
                  <th style={{ textAlign: "center", padding: "4px 6px", width: 40, borderBottom: "1px solid #ccc" }}>Sets</th>
                  <th style={{ textAlign: "center", padding: "4px 6px", width: 40, borderBottom: "1px solid #ccc" }}>Reps</th>
                  <th style={{ textAlign: "center", padding: "4px 6px", width: 34, borderBottom: "1px solid #ccc" }}>RPE</th>
                  <th style={{ textAlign: "center", padding: "4px 6px", width: 50, borderBottom: "1px solid #ccc" }}>Tempo</th>
                  <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s, i) => {
                  if (!s.exercise) return null;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #e0e0e0" }}>
                      <td style={{ padding: "5px 6px", fontWeight: 700 }}>
                        {getLabel(sec.id, i)}
                      </td>
                      <td style={{ padding: "5px 6px" }}>
                        <strong>{s.exercise.n}</strong>
                        {s.exercise.c && (
                          <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                            {s.exercise.c}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "center", padding: "5px 6px" }}>{s.sets}</td>
                      <td style={{ textAlign: "center", padding: "5px 6px" }}>{s.reps}</td>
                      <td style={{ textAlign: "center", padding: "5px 6px" }}>{s.rpe}</td>
                      <td style={{ textAlign: "center", padding: "5px 6px" }}>{s.tempo}</td>
                      <td style={{ padding: "5px 6px", fontSize: 10, color: "#555" }}>{s.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          marginTop: 16,
          fontSize: 9,
          color: "#aaa",
          borderTop: "1px solid #ddd",
          paddingTop: 8,
        }}
      >
        hybridfitnessgym.com &middot; Hybrid Systems, LLC
      </div>
    </div>
  );
}
