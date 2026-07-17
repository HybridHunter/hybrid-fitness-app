// Local-time date helpers. Use these instead of toISOString().slice(...) —
// toISOString() is UTC and shifts "today" for US timezones in the evening.

export function localISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localMonth(d = new Date()) {
  return localISO(d).slice(0, 7);
}

// Parse a bare "YYYY-MM-DD" as local midnight (new Date("YYYY-MM-DD") is UTC midnight).
export function parseLocalDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
