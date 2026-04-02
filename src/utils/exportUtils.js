/* ── Export Utilities ─────────────────────────────────────── */

/**
 * Generic CSV export.
 * @param {Array<Object>} data   - rows of data
 * @param {string}        filename - download filename (without extension)
 * @param {Array<{key:string,label:string}>} columns - column definitions
 */
export function exportToCSV(data, filename, columns) {
  if (!data || data.length === 0) return;

  const header = columns.map((c) => `"${c.label}"`).join(",");
  const rows = data.map((row) =>
    columns
      .map((c) => {
        let val = row[c.key];
        if (val === null || val === undefined) val = "";
        // Escape double-quotes
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      })
      .join(",")
  );

  const csv = [header, ...rows].join("\n");
  downloadBlob(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
}

/**
 * Export member list to CSV.
 */
export function exportMembers(members) {
  const columns = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "membershipStatus", label: "Status" },
    { key: "startDate", label: "Start Date" },
    { key: "notes", label: "Notes" },
  ];
  exportToCSV(members, "members-export", columns);
}

/**
 * Export payment history to CSV.
 */
export function exportPayments(payments) {
  const columns = [
    { key: "date", label: "Date" },
    { key: "memberName", label: "Member" },
    { key: "amount", label: "Amount" },
    { key: "method", label: "Method" },
    { key: "status", label: "Status" },
    { key: "description", label: "Description" },
  ];
  exportToCSV(payments, "payments-export", columns);
}

/**
 * Export attendance records to CSV.
 * Optionally enriches each record with member name.
 */
export function exportAttendance(attendance, members) {
  const memberMap = {};
  if (members) {
    members.forEach((m) => {
      memberMap[m.id] = `${m.firstName} ${m.lastName}`;
    });
  }

  const enriched = attendance.map((rec) => ({
    ...rec,
    memberName: memberMap[rec.memberId] || rec.memberId || "",
  }));

  const columns = [
    { key: "date", label: "Date" },
    { key: "memberName", label: "Member" },
    { key: "type", label: "Type" },
    { key: "time", label: "Time" },
  ];
  exportToCSV(enriched, "attendance-export", columns);
}

/**
 * Export analytics summary to CSV.
 */
export function exportAnalyticsSummary(data) {
  const columns = [
    { key: "metric", label: "Metric" },
    { key: "value", label: "Value" },
  ];
  exportToCSV(data, "analytics-summary", columns);
}

/**
 * Print-friendly PDF export using window.print().
 * Temporarily isolates the given element for printing.
 */
export function exportToPDF(element) {
  if (!element) return;

  const printContents = element.innerHTML;
  const originalContents = document.body.innerHTML;
  const originalTitle = document.title;

  document.body.innerHTML = `
    <div style="padding: 24px; font-family: system-ui, -apple-system, sans-serif; color: #111;">
      ${printContents}
    </div>
  `;

  window.print();

  document.body.innerHTML = originalContents;
  document.title = originalTitle;

  // Re-trigger React re-mount (the app root should pick it back up)
  window.location.reload();
}

/* ── Internal helpers ──────────────────────────────────────── */
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
