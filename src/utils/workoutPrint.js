// Printable training sheets for workouts & programs — branded, and designed
// to be WRITTEN ON: every exercise row gets empty set boxes (weight × reps)
// plus a notes column, with athlete/date lines and a session-feel scale.
import { getBranding } from "./progressReport";
import { getLabel } from "../data/constants";

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shade(hex, pct) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + pct))));
  return `#${(((f((n >> 16) & 255)) << 16) | ((f((n >> 8) & 255)) << 8) | f(n & 255)).toString(16).padStart(6, "0")}`;
}

function setColumnCount(workout) {
  let max = 3;
  for (const sec of workout.sections || []) {
    for (const s of sec.slots || []) {
      const n = parseInt(s.sets, 10);
      if (!isNaN(n)) max = Math.max(max, n);
    }
  }
  return Math.min(max, 5);
}

function workoutPage(w, branding, pageBreak) {
  const color = branding.primaryColor || "#8fbf3b";
  const dark = shade(color, -0.45);
  const gymName = branding.gymName || "GymKit";
  const nSets = setColumnCount(w);

  const setHeads = Array.from({ length: nSets }, (_, i) =>
    `<th style="width:${nSets > 4 ? 54 : 62}px;padding:6px 4px;border-bottom:2px solid #222;font-size:9px;letter-spacing:1px;color:#555;">SET ${i + 1}</th>`).join("");

  const sections = (w.sections || []).map(sec => {
    const filled = (sec.slots || []).filter(s => s.exercise);
    if (!filled.length) return "";
    const sc = sec.color || color;
    const rows = (sec.slots || []).map((s, i) => {
      if (!s.exercise) return "";
      const target = [
        s.sets && s.reps ? `<strong>${esc(s.sets)} × ${esc(s.reps)}</strong>` : (s.sets ? `<strong>${esc(s.sets)} sets</strong>` : ""),
        s.rpe ? `RPE ${esc(s.rpe)}` : "",
        s.tempo ? `⏱ ${esc(s.tempo)}` : "",
      ].filter(Boolean).join("<br>");
      const setCells = Array.from({ length: nSets }, () =>
        `<td style="border:1px solid #ccc;height:38px;vertical-align:bottom;"><div style="font-size:7px;color:#bbb;text-align:right;padding:0 3px 2px 0;">lbs × reps</div></td>`).join("");
      return `<tr style="page-break-inside:avoid;">
        <td style="padding:8px 6px;font-weight:900;font-family:monospace;color:${sc};border-bottom:1px solid #e5e5e5;">${esc(getLabel(sec.id, i))}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e5e5e5;">
          <div style="font-weight:800;font-size:12px;color:#111;">${esc(s.exercise.n)}</div>
          ${s.exercise.e ? `<div style="font-size:9px;color:#888;margin-top:1px;">${esc(s.exercise.e)}</div>` : ""}
          ${s.exercise.c ? `<div style="font-size:9px;color:#666;font-style:italic;margin-top:2px;">${esc(s.exercise.c)}</div>` : ""}
          ${s.notes ? `<div style="font-size:9px;color:${dark};font-weight:700;margin-top:2px;">→ ${esc(s.notes)}</div>` : ""}
        </td>
        <td style="padding:8px 6px;text-align:center;font-size:10px;color:#333;line-height:1.5;border-bottom:1px solid #e5e5e5;white-space:nowrap;">${target || "—"}</td>
        ${setCells}
        <td style="border:1px solid #ccc;border-style:none none solid;border-bottom:1px dotted #aaa;"></td>
      </tr>`;
    }).join("");

    return `
      <div style="margin-top:16px;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:8px;background:${sc}18;border-left:6px solid ${sc};border-radius:6px;padding:7px 12px;">
          <span style="font-size:13px;font-weight:900;color:${shade(sc, -0.35)};">${esc(sec.id)} — ${esc(sec.name || "Section")}</span>
          ${sec.repRange ? `<span style="font-size:10px;color:#777;font-weight:600;">${esc(sec.repRange)}</span>` : ""}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;">
          <thead><tr>
            <th style="width:26px;padding:6px 4px;border-bottom:2px solid #222;font-size:9px;color:#555;">#</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #222;font-size:9px;letter-spacing:1px;color:#555;">EXERCISE</th>
            <th style="width:70px;padding:6px 4px;border-bottom:2px solid #222;font-size:9px;letter-spacing:1px;color:#555;">TARGET</th>
            ${setHeads}
            <th style="min-width:70px;text-align:left;padding:6px;border-bottom:2px solid #222;font-size:9px;letter-spacing:1px;color:#555;">NOTES</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  const feelScale = Array.from({ length: 10 }, (_, i) =>
    `<div style="width:24px;height:24px;border:1.5px solid #999;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#777;">${i + 1}</div>`).join("");

  return `
    <div style="${pageBreak ? "page-break-before:always;" : ""}">
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:4px solid ${color};">
        ${branding.logo
          ? `<img src="${branding.logo}" alt="${esc(gymName)}" style="max-height:42px;max-width:180px;" />`
          : `<div style="font-size:20px;font-weight:900;color:#111;">${esc(gymName)}</div>`}
        <div style="text-align:right;">
          <div style="font-size:9px;font-weight:800;letter-spacing:2px;color:#999;">TRAINING SESSION</div>
          <div style="font-size:20px;font-weight:900;color:#111;margin-top:2px;">${esc(w.name || "Workout")}</div>
          <div style="font-size:10px;color:#777;">${[w.phase, w.workoutLabel].filter(Boolean).map(esc).join(" · ")}</div>
        </div>
      </div>

      <div style="display:flex;gap:24px;margin-top:12px;font-size:11px;color:#333;">
        <div style="flex:2;">Athlete <span style="display:inline-block;border-bottom:1.5px solid #999;width:70%;">&nbsp;</span></div>
        <div style="flex:1;">Date <span style="display:inline-block;border-bottom:1.5px solid #999;width:65%;">&nbsp;</span></div>
        <div style="flex:1;">Coach <span style="display:inline-block;border-bottom:1.5px solid #999;width:60%;">&nbsp;</span></div>
      </div>

      ${w.description ? `<div style="margin-top:12px;background:#f6f8f2;border-left:4px solid ${color};border-radius:6px;padding:9px 12px;font-size:11px;color:#444;font-style:italic;">${esc(w.description)}</div>` : ""}

      ${sections}

      <div style="margin-top:20px;page-break-inside:avoid;">
        <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:#555;">HOW DID THIS SESSION FEEL?</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
          <span style="font-size:9px;color:#999;">Easy</span>${feelScale}<span style="font-size:9px;color:#999;">Max effort</span>
        </div>
        <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:#555;margin-top:14px;">SESSION NOTES</div>
        <div style="border-bottom:1px dotted #aaa;height:22px;"></div>
        <div style="border-bottom:1px dotted #aaa;height:22px;"></div>
      </div>

      <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ddd;padding-top:8px;">
        <div style="font-size:9px;color:#aaa;">${esc(gymName)}</div>
        <div style="font-size:10px;font-weight:800;color:${dark};">Every rep counts. 🔥</div>
      </div>
    </div>`;
}

export function buildWorkoutSheetHtml(workouts, opts = {}) {
  const branding = opts.branding || getBranding();
  const color = branding.primaryColor || "#8fbf3b";
  const list = Array.isArray(workouts) ? workouts : [workouts];

  const cover = opts.title ? `
    <div style="text-align:center;padding:10px 0 4px;">
      <div style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:900;letter-spacing:2px;padding:5px 18px;border-radius:14px;">PROGRAM · ${esc(opts.title).toUpperCase()}</div>
    </div>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(opts.title || list[0]?.name || "Workout")}</title>
  <style>@page{margin:12mm;} body{margin:0;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;} thead{display:table-header-group;}</style>
  </head><body>
    ${cover}
    ${list.map((w, i) => workoutPage(w, branding, i > 0)).join("")}
  </body></html>`;
}

export function printWorkoutSheet(workouts, opts = {}) {
  const html = buildWorkoutSheetHtml(workouts, opts);
  const w = window.open("", "_blank", "width=820,height=980");
  if (!w) { alert("Pop-up blocked — allow pop-ups to print the workout sheet."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
