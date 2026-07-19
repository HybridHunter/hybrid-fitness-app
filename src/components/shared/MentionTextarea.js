/*
 * MentionTextarea — social-style @tagging.
 * Type "@" and keep typing: a dropdown appears under the caret line and
 * narrows to people whose names contain the typed letters (in order).
 * Selecting inserts "@First Last " into the text and reports the tag up.
 */
import { useState, useRef, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";

export default function MentionTextarea({
  value, onChange, people = [], onMention, placeholder, rows = 3, style = {},
}) {
  const B = useTheme();
  const taRef = useRef(null);
  const [frag, setFrag] = useState(null); // { start, text } — active @fragment before caret
  const [highlight, setHighlight] = useState(0);

  const detectFragment = (text, caret) => {
    const upto = text.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at === -1) return null;
    // @ must start a word (start of text or after whitespace)
    if (at > 0 && !/\s/.test(upto[at - 1])) return null;
    const candidate = upto.slice(at + 1);
    // stop suggesting once the fragment has a line break or gets silly-long
    if (/\n/.test(candidate) || candidate.length > 24) return null;
    return { start: at, text: candidate };
  };

  const matches = useMemo(() => {
    if (frag == null) return [];
    const q = frag.text.toLowerCase();
    return people
      .filter(p => (p.name || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [frag, people]);

  const handleChange = (e) => {
    onChange(e.target.value);
    const f = detectFragment(e.target.value, e.target.selectionStart);
    setFrag(f);
    setHighlight(0);
  };

  const pick = (person) => {
    if (!frag) return;
    const caret = taRef.current ? taRef.current.selectionStart : value.length;
    const before = value.slice(0, frag.start);
    const after = value.slice(caret);
    const inserted = `@${person.name} `;
    onChange(before + inserted + after);
    setFrag(null);
    onMention && onMention(person);
    // restore focus + caret after React re-render
    requestAnimationFrame(() => {
      if (taRef.current) {
        const pos = (before + inserted).length;
        taRef.current.focus();
        taRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const handleKeyDown = (e) => {
    if (frag == null || matches.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => (h + 1) % matches.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => (h - 1 + matches.length) % matches.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[highlight]); }
    else if (e.key === "Escape") { setFrag(null); }
  };

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setFrag(null), 200)}
        onClick={(e) => setFrag(detectFragment(e.target.value, e.target.selectionStart))}
        placeholder={placeholder}
        rows={rows}
        style={style}
      />
      {frag != null && matches.length > 0 && (
        <div style={{
          position: "absolute", left: 8, right: 8, top: "100%", marginTop: -6, zIndex: 500,
          background: B.card, border: `1px solid ${B.border}`, borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)", maxHeight: 220, overflowY: "auto",
        }}>
          {matches.map((p, i) => (
            <div
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer",
                background: i === highlight ? B.accent + "18" : "transparent",
                borderBottom: `1px solid ${B.border}30`,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                background: p.photo ? `url(${p.photo}) center/cover` : B.accent + "30",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: B.accent,
              }}>
                {!p.photo && (p.name || "?").slice(0, 1)}
              </div>
              <span style={{ fontSize: 14, color: B.text, fontWeight: 600 }}>{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
