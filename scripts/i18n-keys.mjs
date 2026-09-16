/**
 * i18n key extractor — lists every string key referenced through t() in the
 * frontend source, both literal `t("...")` calls, ternary `t(c ? "a" : "b")`
 * calls, and `t(\`template\`)` calls.
 *
 * Usage:  node scripts/i18n-keys.mjs
 * A companion gate is scripts/i18n-verify.mjs (checks coverage + duplicates);
 * run both after adding strings or editing the AR/FR dictionaries.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const jsx = [];
for (const p of ["src/Planning.jsx", "src/App.jsx", "src/Shell.jsx", "src/Dashboard.jsx",
                 "src/LoginScreen.jsx", "src/ui.jsx"]) jsx.push(p);
jsx.push(...fs.readdirSync(path.join(root, "src/modules"))
  .filter(f => f.endsWith(".jsx"))
  .map(f => `src/modules/${f}`));

const keys = new Set();
for (const f of jsx) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  for (const m of src.matchAll(/\bt\("([^"\\]*(?:\\.[^"\\]*)*)"\)/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\bt\([^)]*\?\s*"([^"]+)"\s*:\s*"([^"]+)"\s*\)/g)) { keys.add(m[1]); keys.add(m[2]); }
  for (const m of src.matchAll(/\bt\(`([^`]+)`\)/g)) keys.add(m[1]);
}

console.log("TOTAL:", keys.size, "\n---");
for (const k of [...keys].sort()) console.log(JSON.stringify(k));