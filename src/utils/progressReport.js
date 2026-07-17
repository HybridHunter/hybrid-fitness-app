// Branded weekly progress report HTML — used for the print/PDF window and the
// email sent to the client. Branding comes from hf_branding (logo, colors, name).

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function listItems(arr) {
  const items = (Array.isArray(arr) ? arr : String(arr || "").split("\n"))
    .map(t => String(t).trim()).filter(Boolean);
  if (items.length === 0) return `<p style="color:#999;margin:4px 0;">—</p>`;
  return `<ul style="margin:6px 0 0;padding-left:20px;">${items.map(t => `<li style="margin:4px 0;line-height:1.5;">${esc(t)}</li>`).join("")}</ul>`;
}

export function getBranding() {
  try { return JSON.parse(localStorage.getItem("hf_branding") || "{}"); } catch { return {}; }
}

export function buildProgressReportHtml(report, member, branding = getBranding()) {
  const gymName = branding.gymName || "GymKit";
  const color = branding.primaryColor || "#8fbf3b";
  const logo = branding.logo
    ? `<img src="${branding.logo}" alt="${esc(gymName)}" style="max-height:56px;max-width:220px;" />`
    : `<div style="font-size:26px;font-weight:800;color:#fff;">${esc(gymName)}</div>`;
  const weekLabel = report.weekOf
    ? new Date(report.weekOf + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";

  const section = (title, body) => `
    <div style="margin:22px 0;">
      <div style="font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${color};border-bottom:2px solid ${color}33;padding-bottom:6px;">${esc(title)}</div>
      ${body}
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Progress Report — ${esc(member.firstName)} ${esc(member.lastName)}</title></head>
  <body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#222;">
    <div style="max-width:680px;margin:0 auto;background:#fff;">
      <div style="background:${color};padding:28px 32px;display:flex;align-items:center;justify-content:space-between;">
        ${logo}
        <div style="text-align:right;color:#fff;">
          <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.9;">Weekly Progress Report</div>
          <div style="font-size:12px;opacity:.8;margin-top:4px;">Week of ${esc(weekLabel)}</div>
        </div>
      </div>
      <div style="padding:28px 32px;">
        <div style="font-size:22px;font-weight:800;">${esc(member.firstName)} ${esc(member.lastName)}</div>
        <div style="font-size:13px;color:#777;margin-top:2px;">Prepared by ${esc(report.coachName || "your coach")} · ${esc(gymName)}</div>
        ${section("Your Overarching Goal", `<p style="margin:8px 0 0;line-height:1.6;font-size:15px;">${esc(report.goal) || "—"}</p>`)}
        ${section("Wins From This Week", listItems(report.wins))}
        ${section("Areas To Improve", listItems(report.improvements))}
        ${section("Action Steps For The Upcoming Week", listItems(report.actionSteps))}
        ${report.notes ? section("Coach's Notes", `<p style="margin:8px 0 0;line-height:1.6;white-space:pre-wrap;">${esc(report.notes)}</p>`) : ""}
      </div>
      <div style="padding:16px 32px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center;">
        ${esc(gymName)} — keep showing up. We're proud of you.
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
