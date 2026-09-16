/**
 * i18n coverage gate — the single command to run after touching any UI string
 * or editing the AR/FR dictionaries. Verifies, in order:
 *
 *   1. Every literal key referenced via t("...") / t(c ? "a" : "b") /
 *      t(`...`) exists in BOTH src/i18n/ar.js and src/i18n/fr.js.
 *   2. Every dynamically-constructed key (values from data arrays / objects
 *      that flow into t(variable)) is present too — those are invisible to
 *      literal extraction, so they are enumerated below by module.
 *   3. No duplicate keys and no empty/non-string values inside either dict.
 *
 * Usage:  node scripts/i18n-verify.mjs     (exit 0 = green, 1 = red)
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const { ar } = await import(path.join(root, "src/i18n/ar.js"));
const { fr } = await import(path.join(root, "src/i18n/fr.js"));

const jsx = [
  "src/Planning.jsx", "src/App.jsx", "src/Shell.jsx", "src/Dashboard.jsx",
  "src/LoginScreen.jsx", "src/ui.jsx",
  ...fs.readdirSync(path.join(root, "src/modules"))
    .filter(f => f.endsWith(".jsx"))
    .map(f => `src/modules/${f}`),
];

/* ---- 1. literal keys ---- */
const referenced = new Set();
for (const f of jsx) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  for (const m of src.matchAll(/\bt\("([^"\\]*(?:\\.[^"\\]*)*)"\)/g)) referenced.add(m[1]);
  for (const m of src.matchAll(/\bt\([^)]*\?\s*"([^"]+)"\s*:\s*"([^"]+)"\s*\)/g)) { referenced.add(m[1]); referenced.add(m[2]); }
  for (const m of src.matchAll(/\bt\(`([^`]+)`\)/g)) referenced.add(m[1]);
}

/* ---- 2. dynamic keys (values of data arrays that reach t(variable)) ---- */
const DYNAMIC = [
  // ReportsCenter: tabs, columns, notes, empty/status (ReportsCenter.jsx)
  "Plan completion", "Unapproved plans", "CPD hours", "Curriculum coverage",
  "Group", "Plans", "Approved", "Pending", "Completion", "Teacher",
  "Subject · Grade", "Term · Week", "Status", "Last updated", "Overdue",
  "Department", "Target (hrs)", "Completed (hrs)", "Progress", "Units",
  "Planned %", "Achieved %", "Gap", "No data yet.", "On track",
  "Plans that still need approval — from any week. Overdue = from an earlier week than the latest one on record and still not approved.",
  "Average planned vs. achieved completion across units; a negative gap means coverage is behind plan.",
  // Calendar: event types + weekday abbreviations (Calendar.jsx)
  "Quiz", "Exam", "Event", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
  // AdminPanel: simple-table fields (AdminPanel.jsx)
  "Name", "Code", "Location", "Label",
  // AdminPanel: report tiles (AdminPanel.jsx)
  "Plan completion rate", "Unapproved / overdue plans",
  "CPD progress vs target", "Curriculum coverage vs planned",
  // UsersEditor: chip labels + picker roles default
  "Assigned grades", "Assigned subjects", "Roles",
  // pickers.jsx defaults
  "Teaching strategies", "Choose from the Resources library",
  // CurriculumEditor: unit + remedial field labels
  "Learning objectives", "Topics / content", "Activities", "Differentiation",
  "Assessment", "Homework", "Resources", "Technology used", "Reflection",
  "Branch", "Department", "Subject", "Grade", "Term", "Week range", "Unit",
  "Topic", "Objectives", "Standards", "Missing topics", "Reason",
  "Lessons required", "Revised dates", "Responsible teacher",
  "Required resources", "New target date", "Template Fields", "Reports",
  // AdminPanel: tab labels (AdminPanel.jsx TABS)
  "Staff & Roles", "Branches", "Subjects", "Grade Bands", "Audit Log",
  "Notes & Announcements", "Report Center",
  // LessonsEditor status options (STATUS_OPTIONS)
  "Draft", "Final",
];

const check = (dict, name) => {
  const missingLiteral = [...referenced].filter(k => !(k in dict));
  const missingDynamic = DYNAMIC.filter(k => !(k in dict));
  let red = 0;
  if (missingLiteral.length) { red = 1; console.log(`${name}: MISSING LITERAL KEYS (${missingLiteral.length}):`); for (const k of missingLiteral) console.log(`  - ${JSON.stringify(k)}`); }
  if (missingDynamic.length) { red = 1; console.log(`${name}: MISSING DYNAMIC KEYS (${missingDynamic.length}):`); for (const k of missingDynamic) console.log(`  - ${JSON.stringify(k)}`); }
  return red;
};

/* ---- 3. dict hygiene ---- */
const dupes = [];
const empties = [];
for (const [name, dict, dictPath] of [["ar", ar, "src/i18n/ar.js"], ["fr", fr, "src/i18n/fr.js"]]) {
  const src = fs.readFileSync(path.join(root, dictPath), "utf8");
  const seen = new Map();
  for (const m of src.matchAll(/^\s*"([^"]+)":/gm)) {
    if (seen.has(m[1])) dupes.push(`${name}: "${m[1]}"`);
    else seen.set(m[1], m.index);
  }
  for (const [k, v] of Object.entries(dict)) {
    if (!v || typeof v !== "string") empties.push(`${name}: "${k}" = ${JSON.stringify(v)}`);
  }
}

let red = check(ar, "ar");
red |= check(fr, "fr");
if (dupes.length) { red = 1; console.log("DUPLICATE KEYS:", dupes.join(" | ")); }
if (empties.length) { red = 1; console.log("EMPTY/INVALID VALUES:", empties.join(" | ")); }

if (red) { console.log(`\n✗ i18n check failed. (${referenced.size} literal keys · ${DYNAMIC.length} dynamic keys · ${Object.keys(ar).length}/${Object.keys(fr).length} dict entries)`); process.exit(1); }
console.log(`\n✓ i18n check passed. ${referenced.size} literal keys · ${DYNAMIC.length} dynamic keys · all present in ar (${Object.keys(ar).length}) and fr (${Object.keys(fr).length}).`);