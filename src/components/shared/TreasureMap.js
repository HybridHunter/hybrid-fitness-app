// TreasureMap — client-facing gamified task path.
// Pure presentational: pass the map, THIS member's tasks for the map (in map
// order), a resolved deadline (ISO "YYYY-MM-DD" or null) and a click handler.
// The card is deliberately light (parchment) in both themes so ink stays readable.
import { parseLocalDate } from "../../utils/dates";

const INK = "#4a3418";        // dark parchment ink
const INK_SOFT = "#7a5f36";   // muted ink
const GOLD = "#f59e0b";
const GOLD_DARK = "#b45309";
const RED = "#b91c1c";

function truncate(str, n) {
  const s = String(str || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function TreasureMap({ map, tasks, deadline, onTaskClick }) {
  const list = Array.isArray(tasks) ? tasks : [];
  const n = list.length;
  const doneCount = list.filter((t) => t.status === "done").length;
  const allDone = n > 0 && doneCount === n;
  const nextIdx = list.findIndex((t) => t.status !== "done");

  // Countdown
  let daysLeft = null;
  if (deadline) {
    const dl = parseLocalDate(deadline);
    if (dl) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      daysLeft = Math.round((dl - today) / 86400000);
    }
  }
  const chipText =
    daysLeft === null ? null
      : daysLeft < 0 ? "⏳ Overdue"
      : daysLeft === 0 ? "⏳ Due today"
      : daysLeft === 1 ? "⏳ 1 day left"
      : "⏳ " + daysLeft + " days left";
  const chipUrgent = daysLeft !== null && daysLeft <= 1;

  // SVG geometry: stops top->bottom, alternating left/right, chest at the end
  const stopX = (i) => (i % 2 === 0 ? 84 : 256);
  const stopY = (i) => 44 + i * 70;
  const chestY = 44 + n * 70;
  const H = chestY + 44;

  let pathD = "";
  if (n > 0) {
    pathD = "M " + stopX(0) + " " + stopY(0);
    for (let i = 1; i < n; i++) {
      pathD += " C " + stopX(i - 1) + " " + (stopY(i - 1) + 42) + ", " + stopX(i) + " " + (stopY(i) - 42) + ", " + stopX(i) + " " + stopY(i);
    }
    pathD += " C " + stopX(n - 1) + " " + (stopY(n - 1) + 42) + ", 170 " + (chestY - 46) + ", 170 " + (chestY - 24);
  }

  const card = {
    width: "100%", maxWidth: 420, margin: "0 auto", boxSizing: "border-box",
    background: "linear-gradient(160deg, #f5e6c8 0%, #eddcb4 55%, #e8d5a8 100%)",
    border: "2px dashed #a5824a", borderRadius: 16, padding: 16,
    boxShadow: "0 2px 12px rgba(0,0,0,0.18)", position: "relative",
  };

  return (
    <div style={card}>
      <style>{`
        @keyframes tmPulse {
          0% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.28); opacity: 0.25; }
          100% { transform: scale(1); opacity: 0.9; }
        }
        .tm-pulse { animation: tmPulse 1.6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        @keyframes tmGlow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(245,158,11,0.7)); }
          50% { filter: drop-shadow(0 0 12px rgba(245,158,11,0.95)); }
        }
        .tm-chest-glow { animation: tmGlow 2s ease-in-out infinite; }
      `}</style>

      {/* All-done celebratory banner */}
      {allDone && (
        <div style={{
          background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff",
          borderRadius: 12, padding: "12px 14px", marginBottom: 14, textAlign: "center",
          fontSize: 14, fontWeight: 800, lineHeight: 1.4, boxShadow: "0 2px 10px rgba(217,119,6,0.45)",
        }}>
          {"🏆"} X marks the spot &mdash; you found the treasure!
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>Claim: {map?.incentive}</div>
        </div>
      )}

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: INK, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 20 }}>{"🗺️"}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{map?.name || "Treasure Map"}</span>
        </div>
        {chipText && (
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 12, whiteSpace: "nowrap",
            background: chipUrgent ? "#fee2e2" : "rgba(74,52,24,0.12)",
            color: chipUrgent ? RED : INK_SOFT,
            border: "1px solid " + (chipUrgent ? "#fca5a5" : "rgba(74,52,24,0.25)"),
          }}>
            {chipText}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: INK_SOFT, marginBottom: 4 }}>
        Follow the trail &mdash; dig up every stop to reach the treasure.
      </div>

      {/* The map itself */}
      <svg viewBox={"0 0 340 " + H} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={"Treasure map: " + doneCount + " of " + n + " stops complete"}>
        {/* winding dashed trail */}
        {pathD && (
          <path d={pathD} fill="none" stroke={INK_SOFT} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" opacity="0.75" />
        )}

        {/* stops */}
        {list.map((t, i) => {
          const x = stopX(i);
          const y = stopY(i);
          const done = t.status === "done";
          const isNext = i === nextIdx;
          const onLeft = x < 170;
          const labelX = onLeft ? x + 28 : x - 28;
          return (
            <g key={t.id || i} onClick={() => onTaskClick && onTaskClick(t)} style={{ cursor: onTaskClick ? "pointer" : "default" }}>
              {/* Full-width invisible hit band — the whole row is tappable */}
              <rect x="0" y={y - 34} width="340" height="68" fill="transparent" />
              {done && (
                <>
                  <circle cx={x} cy={y} r="14" fill={GOLD} stroke={GOLD_DARK} strokeWidth="2.5" />
                  <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">{"✓"}</text>
                </>
              )}
              {!done && isNext && (
                <>
                  <circle className="tm-pulse" cx={x} cy={y} r="20" fill="none" stroke={RED} strokeWidth="2.5" />
                  <circle cx={x} cy={y} r="14" fill="#f3e3c0" stroke={RED} strokeWidth="2.5" />
                  <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill={RED}>{"✕"}</text>
                </>
              )}
              {!done && !isNext && (
                <circle cx={x} cy={y} r="11" fill="#e2d0a6" stroke="#a58a55" strokeWidth="2" opacity="0.85" />
              )}
              <text
                x={labelX} y={y + 4.5} textAnchor={onLeft ? "start" : "end"}
                fontSize="12.5" fontWeight={isNext ? "800" : "600"}
                fill={done ? INK_SOFT : INK}
                style={done ? { textDecoration: "line-through", opacity: 0.75 } : undefined}
              >
                {truncate(t.title, 26)}
              </text>
            </g>
          );
        })}

        {/* treasure chest */}
        <text
          x="170" y={chestY + 12} textAnchor="middle" fontSize="34"
          className={allDone ? "tm-chest-glow" : undefined}
          style={allDone ? undefined : { filter: "grayscale(1)", opacity: 0.45 }}
        >
          {"💰"}
        </text>
      </svg>

      {/* Reward */}
      <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: allDone ? GOLD_DARK : INK_SOFT, marginTop: 2, marginBottom: 10 }}>
        Reward: <span style={{ color: allDone ? GOLD_DARK : INK }}>{map?.incentive}</span>
      </div>

      {/* Progress footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: INK_SOFT }}>
          {doneCount} of {n} stops dug up
        </div>
        {!allDone && onTaskClick && (
          <div style={{ fontSize: 11, fontWeight: 700, color: GOLD_DARK }}>Tap a stop to complete it →</div>
        )}
      </div>
      <div style={{ width: "100%", height: 7, background: "rgba(74,52,24,0.18)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: (n ? Math.round((doneCount / n) * 100) : 0) + "%", height: "100%", background: "linear-gradient(90deg, #f59e0b, #d97706)", borderRadius: 4, transition: "width .4s ease" }} />
      </div>
    </div>
  );
}
