/*
 * Summarize report/bugs.json into a readable markdown report.
 * Run: node lib/report.js
 */
const fs = require('fs');
const path = require('path');

const BUGS_FILE = path.join(__dirname, '..', 'report', 'bugs.json');
const OUT = path.join(__dirname, '..', 'report', 'SUMMARY.md');

let bugs = [];
try { bugs = JSON.parse(fs.readFileSync(BUGS_FILE, 'utf8')); } catch {}

// Dedupe identical messages seen on multiple pages
const seen = new Map();
for (const b of bugs) {
  const k = `${b.type}|${b.message}`;
  if (!seen.has(k)) seen.set(k, { ...b, count: 0, urls: new Set() });
  const e = seen.get(k);
  e.count++;
  if (b.url) e.urls.add(b.url.replace('http://localhost:3100', ''));
}

const groups = {};
for (const e of seen.values()) {
  (groups[e.type] = groups[e.type] || []).push(e);
}

const ORDER = ['uncaught-exception', 'crash-overlay', 'blank-screen', 'broken-flow', 'console-error', 'http-error', 'request-failed', 'check-failed', 'react-warning'];
let md = `# Simulation Bug Report\n\nGenerated: ${new Date().toISOString()}\nTotal events: ${bugs.length} — distinct issues: ${seen.size}\n\n`;
for (const type of ORDER) {
  const list = groups[type];
  if (!list) continue;
  md += `\n## ${type} (${list.length})\n\n`;
  for (const e of list.sort((a, b) => b.count - a.count)) {
    md += `- **[${e.scenario} / ${e.persona || '?'}]** ${e.message}\n`;
    if (e.urls.size) md += `  - seen at: ${[...e.urls].slice(0, 5).join(', ')}${e.urls.size > 5 ? ` (+${e.urls.size - 5} more)` : ''} (×${e.count})\n`;
  }
}
fs.writeFileSync(OUT, md);
console.log(md);
console.log(`\nWritten to ${OUT}`);
