import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { DEFAULT_MATRIX } from "../../data/movementMatrix";
import { PATS, PC } from "../../data/constants";
import { EX } from "../../data/exercises";

const LEVELS = ["-3", "-2", "-1", "0", "1", "2", "3"];
const LEVEL_LABELS = { "-3": "-3", "-2": "-2", "-1": "-1", "0": "0", "1": "+1", "2": "+2", "3": "+3" };

function levelColor(lvl) {
  const n = parseInt(lvl);
  if (n < 0) {
    const t = (n + 3) / 3;
    return `rgba(239,68,68,${0.12 + (1 - t) * 0.18})`;
  }
  if (n > 0) {
    const t = n / 3;
    return `rgba(143,191,59,${0.08 + t * 0.18})`;
  }
  return "rgba(143,191,59,0.08)";
}

function levelBorder(lvl) {
  const n = parseInt(lvl);
  if (n < 0) return `rgba(239,68,68,${0.25 + Math.abs(n) * 0.1})`;
  if (n > 0) return `rgba(143,191,59,${0.2 + n * 0.1})`;
  return "rgba(143,191,59,0.5)";
}

function genId() {
  return "chain-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
}

function getExercisesForPattern(library, pattern) {
  return library.filter(e => e.p === pattern).map(e => e.n).sort();
}

export default function MatrixView() {
  const B = useTheme();
  const [matrix, setMatrix] = useLocalStorage("hf_matrix", DEFAULT_MATRIX);
  const [exLib] = useLocalStorage("hf_ex", EX);
  const [filter, setFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // New chain form state
  const [newName, setNewName] = useState("");
  const [newPattern, setNewPattern] = useState("Squat");
  const [newLevels, setNewLevels] = useState({ "-3": "", "-2": "", "-1": "", "0": "", "1": "", "2": "", "3": "" });

  const filteredMatrix = filter === "All" ? matrix : matrix.filter(c => c.pattern === filter);
  const patternFilters = PATS;

  function updateChainLevel(chainId, level, exerciseName) {
    setMatrix(prev => prev.map(c => {
      if (c.id !== chainId) return c;
      const levels = { ...c.levels };
      if (exerciseName === "") {
        delete levels[level];
      } else {
        levels[level] = exerciseName;
      }
      return { ...c, levels };
    }));
  }

  function deleteChain(chainId) {
    setMatrix(prev => prev.filter(c => c.id !== chainId));
  }

  function saveNewChain() {
    if (!newName.trim()) return;
    const levels = {};
    LEVELS.forEach(l => { if (newLevels[l]) levels[l] = newLevels[l]; });
    const chain = { id: genId(), name: newName.trim(), pattern: newPattern, levels };
    setMatrix(prev => [...prev, chain]);
    setShowModal(false);
    setNewName("");
    setNewPattern("Squat");
    setNewLevels({ "-3": "", "-2": "", "-1": "", "0": "", "1": "", "2": "", "3": "" });
  }

  function resetToDefaults() {
    setMatrix(DEFAULT_MATRIX);
    setShowReset(false);
  }

  const library = exLib && exLib.length ? exLib : EX;
  const patternExercises = {};
  PATS.filter(p => p !== "All").forEach(p => { patternExercises[p] = getExercisesForPattern(library, p); });

  // --- Styles ---
  const overlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)"
  };

  const modalBox = {
    background: B.card, border: "1px solid " + B.border, borderRadius: 16,
    padding: 28, width: 560, maxWidth: "90vw", maxHeight: "85vh",
    overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
  };

  const inputStyle = {
    background: B.darker, border: "1px solid " + B.border, borderRadius: 8,
    color: B.text, padding: "8px 12px", fontSize: 14, width: "100%",
    outline: "none", boxSizing: "border-box"
  };

  const selectStyle = {
    ...inputStyle, cursor: "pointer", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238b949e' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
    paddingRight: 28
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: B.text, margin: 0, letterSpacing: -0.5 }}>
            Progression Engine
          </h1>
          <p style={{ color: B.muted, fontSize: 14, margin: "6px 0 0" }}>
            7-level progression chains for exercise individualization
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: B.accent, color: "#000", border: "none", borderRadius: 10,
            padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap"
          }}
        >
          + New Chain
        </button>
      </div>

      {/* Pattern filter tabs */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24,
        padding: "4px 0"
      }}>
        {patternFilters.map(p => {
          const active = filter === p;
          const color = p === "All" ? B.accent : PC[p];
          return (
            <button
              key={p}
              onClick={() => setFilter(p)}
              style={{
                background: active ? color : "transparent",
                color: active ? "#000" : B.muted,
                border: active ? "none" : "1px solid " + B.border,
                borderRadius: 8, padding: "6px 14px", fontSize: 13,
                fontWeight: active ? 700 : 500, cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Level legend */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
        padding: "10px 16px", background: B.darker, borderRadius: 10,
        border: "1px solid " + B.border, fontSize: 12, color: B.muted
      }}>
        <span style={{ fontWeight: 600, color: B.dim }}>LEVELS:</span>
        <span style={{ color: B.red }}>-3 Easiest</span>
        <span style={{ color: "#f87171" }}>-2</span>
        <span style={{ color: "#fca5a5" }}>-1</span>
        <span style={{
          color: B.accent, fontWeight: 700, padding: "2px 8px",
          background: "rgba(143,191,59,0.12)", borderRadius: 4
        }}>0 Base</span>
        <span style={{ color: "#86efac" }}>+1</span>
        <span style={{ color: "#4ade80" }}>+2</span>
        <span style={{ color: B.green }}>+3 Hardest</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: B.dim, fontStyle: "italic" }}>
          Regression ← → Progression
        </span>
      </div>

      {/* Chain cards */}
      {filteredMatrix.length === 0 && (
        <div style={{
          padding: 60, textAlign: "center", color: B.dim,
          background: B.card, borderRadius: 12, border: "1px solid " + B.border
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            No chains found
          </div>
          <div style={{ fontSize: 13 }}>
            {filter !== "All"
              ? `No progression chains for "${filter}" pattern. Try another filter or add a new chain.`
              : "Add a new progression chain to get started."}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredMatrix.map(chain => {
          const pc = PC[chain.pattern] || B.accent;
          const exercises = patternExercises[chain.pattern] || [];

          return (
            <div
              key={chain.id}
              style={{
                background: B.card, borderRadius: 12,
                border: "1px solid " + B.border,
                borderLeft: "4px solid " + pc,
                overflow: "hidden"
              }}
            >
              {/* Chain header row */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderBottom: "1px solid " + B.border
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: B.text }}>
                    {chain.name}
                  </span>
                  <span style={{
                    background: pc + "22", color: pc, fontSize: 11,
                    fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    border: "1px solid " + pc + "44", letterSpacing: 0.3
                  }}>
                    {chain.pattern}
                  </span>
                </div>
                <button
                  onClick={() => { if (window.confirm(`Delete "${chain.name}"?`)) deleteChain(chain.id); }}
                  style={{
                    background: "transparent", color: B.dim, border: "1px solid " + B.border,
                    borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer",
                    fontWeight: 500, transition: "all 0.15s"
                  }}
                  onMouseEnter={e => { e.target.style.color = B.red; e.target.style.borderColor = B.red; }}
                  onMouseLeave={e => { e.target.style.color = B.dim; e.target.style.borderColor = B.border; }}
                >
                  Delete
                </button>
              </div>

              {/* Levels row */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6, padding: "12px 16px"
              }}>
                {LEVELS.map(lvl => {
                  const isBase = lvl === "0";
                  const val = chain.levels[lvl] || "";

                  return (
                    <div key={lvl} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {/* Level label */}
                      <div style={{
                        fontSize: 11, fontWeight: isBase ? 800 : 600,
                        color: isBase ? B.accent : B.dim,
                        textAlign: "center", letterSpacing: 0.5
                      }}>
                        {LEVEL_LABELS[lvl]}
                      </div>

                      {/* Exercise cell */}
                      <div style={{
                        background: val ? levelColor(lvl) : "transparent",
                        border: val
                          ? (isBase ? "2px solid " + B.accent : "1px solid " + levelBorder(lvl))
                          : "1px dashed " + B.border,
                        borderRadius: 8,
                        padding: isBase ? 1 : 2,
                        minHeight: 60,
                        display: "flex", flexDirection: "column"
                      }}>
                        <select
                          value={val}
                          onChange={e => updateChainLevel(chain.id, lvl, e.target.value)}
                          style={{
                            background: "transparent", border: "none",
                            color: val ? B.text : B.dim,
                            fontSize: isBase ? 12.5 : 12,
                            fontWeight: isBase ? 700 : 500,
                            padding: "6px 4px", cursor: "pointer",
                            width: "100%", flex: 1, outline: "none",
                            appearance: "none", textAlign: "center",
                            lineHeight: 1.3
                          }}
                          title={val || "Empty"}
                        >
                          <option value="" style={{ background: B.darker, color: B.dim }}>—</option>
                          {exercises.map(ex => (
                            <option key={ex} value={ex} style={{ background: B.darker, color: B.text }}>
                              {ex}
                            </option>
                          ))}
                          {/* Include current value if not in exercises list */}
                          {val && !exercises.includes(val) && (
                            <option value={val} style={{ background: B.darker, color: B.text }}>
                              {val}
                            </option>
                          )}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset button */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid " + B.border, textAlign: "center" }}>
        <button
          onClick={() => setShowReset(true)}
          style={{
            background: "transparent", color: B.dim, border: "1px solid " + B.border,
            borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer",
            fontWeight: 500
          }}
          onMouseEnter={e => { e.target.style.color = B.red; e.target.style.borderColor = B.red; }}
          onMouseLeave={e => { e.target.style.color = B.dim; e.target.style.borderColor = B.border; }}
        >
          Reset to Defaults
        </button>
      </div>

      {/* Reset confirm dialog */}
      {showReset && (
        <div style={overlay} onClick={() => setShowReset(false)}>
          <div
            style={{ ...modalBox, width: 400, textAlign: "center" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: B.text, marginBottom: 12 }}>
              Reset Progression Engine?
            </div>
            <p style={{ color: B.muted, fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
              This will discard all your custom changes and restore the default progression chains. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setShowReset(false)}
                style={{
                  background: "transparent", color: B.muted, border: "1px solid " + B.border,
                  borderRadius: 8, padding: "8px 20px", fontSize: 14, cursor: "pointer",
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={resetToDefaults}
                style={{
                  background: B.red, color: B.white, border: "none",
                  borderRadius: 8, padding: "8px 20px", fontSize: 14, cursor: "pointer",
                  fontWeight: 700
                }}
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Chain modal */}
      {showModal && (
        <div style={overlay} onClick={() => setShowModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 700, color: B.text, marginBottom: 4 }}>
              New Progression Chain
            </div>
            <p style={{ color: B.muted, fontSize: 13, margin: "0 0 20px" }}>
              Create a 7-level exercise progression from easiest (-3) to hardest (+3).
            </p>

            {/* Chain name */}
            <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 6 }}>
              Chain Name
            </label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Bilateral Squat"
              style={{ ...inputStyle, marginBottom: 16 }}
            />

            {/* Pattern select */}
            <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 6 }}>
              Movement Pattern
            </label>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <select
                value={newPattern}
                onChange={e => {
                  setNewPattern(e.target.value);
                  setNewLevels({ "-3": "", "-2": "", "-1": "", "0": "", "1": "", "2": "", "3": "" });
                }}
                style={selectStyle}
              >
                {PATS.filter(p => p !== "All").map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Level dropdowns */}
            <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, display: "block", marginBottom: 10 }}>
              Exercise Levels
            </label>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6
            }}>
              {LEVELS.map(lvl => {
                const isBase = lvl === "0";
                const exs = patternExercises[newPattern] || [];
                return (
                  <div key={lvl} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{
                      fontSize: 11, fontWeight: isBase ? 800 : 600,
                      color: isBase ? B.accent : B.dim,
                      textAlign: "center"
                    }}>
                      {LEVEL_LABELS[lvl]}
                    </div>
                    <div style={{
                      background: levelColor(lvl),
                      border: isBase ? "2px solid " + B.accent : "1px solid " + levelBorder(lvl),
                      borderRadius: 8, padding: 2
                    }}>
                      <select
                        value={newLevels[lvl]}
                        onChange={e => setNewLevels(prev => ({ ...prev, [lvl]: e.target.value }))}
                        style={{
                          background: "transparent", border: "none", color: B.text,
                          fontSize: 11, padding: "6px 2px", cursor: "pointer",
                          width: "100%", outline: "none", appearance: "none",
                          textAlign: "center"
                        }}
                      >
                        <option value="" style={{ background: B.darker, color: B.dim }}>—</option>
                        {exs.map(ex => (
                          <option key={ex} value={ex} style={{ background: B.darker, color: B.text }}>
                            {ex}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save / Cancel */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "transparent", color: B.muted, border: "1px solid " + B.border,
                  borderRadius: 8, padding: "8px 20px", fontSize: 14, cursor: "pointer",
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveNewChain}
                disabled={!newName.trim()}
                style={{
                  background: newName.trim() ? B.accent : B.dim,
                  color: newName.trim() ? "#000" : B.muted,
                  border: "none", borderRadius: 8, padding: "8px 24px",
                  fontSize: 14, cursor: newName.trim() ? "pointer" : "not-allowed",
                  fontWeight: 700
                }}
              >
                Save Chain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
