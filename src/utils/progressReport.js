// Branded weekly progress report HTML — used for the print/PDF window and the
// email sent to the client. Branding comes from hf_branding (logo, colors, name).
// Design goal: celebratory. Big wins, bold color, momentum — a dopamine hit.

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toItems(v) {
  return (Array.isArray(v) ? v : String(v || "").split("\n")).map(t => String(t).trim()).filter(Boolean);
}

export function getBranding() {
  try { return JSON.parse(localStorage.getItem("hf_branding") || "{}"); } catch { return {}; }
}

// Darken a #rrggbb color for gradient depth
function shade(hex, pct) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + pct))));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function buildProgressReportHtml(report, member, branding = getBranding()) {
  const gymName = branding.gymName || "GymKit";
  const color = branding.primaryColor || "#8fbf3b";
  const dark = shade(color, -0.45);
  const weekLabel = report.weekOf
    ? new Date(report.weekOf + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";

  const wins = toItems(report.wins);
  const improvements = toItems(report.improvements);
  const actions = toItems(report.actionSteps);
  const targets = toItems(report.targetReview);

  // Logo sits on WHITE so any logo color works (never blends into the brand color)
  const logoBar = `
    <div style="background:#ffffff;padding:18px 36px;display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid ${color};">
      ${branding.logo
        ? `<img src="${branding.logo}" alt="${esc(gymName)}" style="max-height:48px;max-width:200px;" />`
        : `<div style="font-size:22px;font-weight:900;color:#111;">${esc(gymName)}</div>`}
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#999;">Progress Report</div>
    </div>`;

  const hero = `
    <div style="background:linear-gradient(135deg, ${color} 0%, ${dark} 100%);padding:40px 36px 34px;color:#fff;">
      <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.85;">Progress Report · ${esc(weekLabel)}</div>
      <div style="font-size:38px;font-weight:900;line-height:1.1;margin-top:8px;">${esc(member.firstName)}, you showed up. 💪</div>
      <div style="font-size:16px;margin-top:10px;opacity:.95;">
        ${wins.length > 0
          ? `<strong>${wins.length} win${wins.length === 1 ? "" : "s"}</strong> in the books since your last report — momentum is building.`
          : `More work in the books — momentum is building.`}
      </div>
    </div>`;

  const northStar = report.goal ? `
    <div style="margin:28px 36px 0;background:#f6f8f2;border:2px dashed ${color};border-radius:16px;padding:18px 22px;">
      <div style="font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${dark};">🧭 Your North Star</div>
      <div style="font-size:19px;font-weight:800;color:#1a1a1a;margin-top:6px;line-height:1.4;">${esc(report.goal)}</div>
      <div style="font-size:12px;color:#888;margin-top:4px;">Every session is a step toward this. Keep it in sight.</div>
    </div>` : "";

  const targetsBlock = targets.length === 0 ? "" : `
    <div style="margin:28px 36px 0;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:22px;">📋</div>
        <div style="font-size:17px;font-weight:900;color:#1a1a1a;">Targets From Your Last Report — How We Did</div>
      </div>
      ${targets.map(t => {
        const hit = t.startsWith("✅"), partial = t.startsWith("🟡"), miss = t.startsWith("❌");
        const border = hit ? color : partial ? "#f59e0b" : miss ? "#ef4444" : "#bbb";
        return `
        <div style="display:flex;align-items:center;gap:10px;border-left:4px solid ${border};background:#fafafa;border-radius:10px;padding:10px 14px;margin-top:8px;">
          <div style="font-size:14px;color:#333;line-height:1.5;">${esc(t)}</div>
        </div>`;
      }).join("")}
      <div style="font-size:11px;color:#999;margin-top:6px;">Accountability builds momentum — we track every target.</div>
    </div>`;

  const winsBlock = `
    <div style="margin:28px 36px 0;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:24px;">🏆</div>
        <div style="font-size:20px;font-weight:900;color:#1a1a1a;">Your Wins</div>
      </div>
      ${wins.length === 0 ? `<p style="color:#999;">—</p>` : wins.map((w, i) => `
        <div style="display:flex;align-items:center;gap:14px;background:linear-gradient(90deg, ${color}1a, ${color}08);border-left:5px solid ${color};border-radius:12px;padding:14px 18px;margin-top:10px;">
          <div style="width:34px;height:34px;border-radius:17px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;flex-shrink:0;">✓</div>
          <div style="font-size:16px;font-weight:700;color:#1a1a1a;line-height:1.4;">${esc(w)}</div>
        </div>`).join("")}
    </div>`;

  const improveBlock = `
    <div style="margin:28px 36px 0;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:22px;">🎯</div>
        <div style="font-size:17px;font-weight:900;color:#1a1a1a;">Where We Level Up Next</div>
      </div>
      ${improvements.length === 0 ? `<p style="color:#999;">—</p>` : improvements.map(t => `
        <div style="display:flex;gap:10px;padding:8px 4px;font-size:14px;color:#444;line-height:1.5;">
          <span style="color:${dark};font-weight:900;">›</span><span>${esc(t)}</span>
        </div>`).join("")}
    </div>`;

  const actionBlock = `
    <div style="margin:28px 36px 0;background:#111;border-radius:16px;padding:22px 24px;color:#fff;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:22px;">🚀</div>
        <div style="font-size:17px;font-weight:900;">Your Mission</div>
      </div>
      ${actions.length === 0 ? `<p style="color:#888;">—</p>` : actions.map((t, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #ffffff1f;">
          <div style="width:22px;height:22px;border:2px solid ${color};border-radius:6px;flex-shrink:0;"></div>
          <div style="font-size:15px;font-weight:600;line-height:1.4;">${esc(t)}</div>
        </div>`).join("")}
      <div style="font-size:12px;color:${color};font-weight:700;margin-top:12px;">Check these off — we'll review them in your next report.</div>
    </div>`;

  const notesBlock = report.notes ? `
    <div style="margin:28px 36px 0;background:#fafafa;border-radius:14px;padding:18px 22px;">
      <div style="font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#888;">💬 From ${esc(report.coachName || "your coach")}</div>
      <p style="margin:8px 0 0;line-height:1.6;font-size:14px;color:#333;white-space:pre-wrap;">${esc(report.notes)}</p>
    </div>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Progress Report — ${esc(member.firstName)} ${esc(member.lastName)}</title></head>
  <body style="margin:0;background:#eef0ea;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:680px;margin:0 auto;background:#fff;">
      ${logoBar}
      ${hero}
      ${northStar}
      ${targetsBlock}
      ${winsBlock}
      ${improveBlock}
      ${actionBlock}
      ${notesBlock}
      <div style="margin-top:28px;background:linear-gradient(135deg, ${dark}, ${color});padding:22px 36px;text-align:center;color:#fff;">
        <div style="font-size:16px;font-weight:900;">Proud of you, ${esc(member.firstName)}. See you on the floor. 🔥</div>
        <div style="font-size:11px;opacity:.85;margin-top:6px;">${esc(gymName)} · ${esc(report.coachName || "Your Coach")}</div>
      </div>
    </div>
  </body></html>`;
}

// Open the report in a print window (user saves as PDF from the dialog).
export function printProgressReport(report, member, branding) {
  const html = buildProgressReportHtml(report, member, branding);
  const w = window.open("", "_blank", "width=760,height=900");
  if (!w) { alert("Pop-up blocked — allow pop-ups to preview/print the report."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
