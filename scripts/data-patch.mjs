// Applies a scripted, reviewable edit to the live portfolio_state row — for data fixes that would
// be tedious on a phone in edit mode. Each patch lives in scripts/data-patches/<name>.mjs and
// exports `default (row) => void` that edits the row in place.
//
// MODE=dry   → prints which fields would change (values of contacts are never printed — the repo's
//              logs are public), writes nothing
// MODE=apply → writes only the changed columns, and only if nobody saved in the meantime
//
// Runs from the "Data patch" workflow with the SUPABASE_SERVICE_ROLE_KEY repo secret. A dry run
// only needs read access, so it also works locally with the public anon key.
const REF = process.env.PROJECT_REF || "tkbfgxxwsfxhdhjnrdqv";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODE = process.env.MODE || "dry";
const PATCH = process.env.PATCH;
if (!KEY || !PATCH || !/^[\w-]+$/.test(PATCH)) { console.error("SUPABASE_SERVICE_ROLE_KEY and PATCH (a file name in scripts/data-patches) are required"); process.exit(1); }
const URL_ = `https://${REF}.supabase.co/rest/v1/portfolio_state`;
const H = KEY.startsWith("sb_secret_") ? { apikey: KEY } : { apikey: KEY, Authorization: `Bearer ${KEY}` };

const res = await fetch(`${URL_}?id=eq.1&select=*`, { headers: H });
if (!res.ok) { console.error(`read failed: HTTP ${res.status}`); process.exit(2); }
const [row] = await res.json();
const before = JSON.parse(JSON.stringify(row));
const { default: patch } = await import(`./data-patches/${PATCH}.mjs`);
patch(row);

const PRIVATE_COLUMNS = new Set(["contacts"]);
const changes = [];
function diff(a, b, path) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) === !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}.${k}`);
    return;
  }
  changes.push([path, a, b]);
}
const columns = Object.keys(row).filter((c) => c !== "updated_at" && JSON.stringify(row[c]) !== JSON.stringify(before[c]));
for (const c of columns) diff(before[c], row[c], c);
const show = (v) => (v === undefined ? "(없음)" : JSON.stringify(v));
for (const [path, a, b] of changes) {
  const col = path.split(".")[0];
  console.log(PRIVATE_COLUMNS.has(col) ? `${path}: (값 비공개) 변경됨` : `${path}: ${show(a)} → ${show(b)}`);
}
console.log(`\n${changes.length} field(s) in ${columns.length} column(s): ${columns.join(", ") || "-"}  [mode=${MODE}]`);

if (MODE === "apply" && columns.length) {
  const body = Object.fromEntries(columns.map((c) => [c, row[c]]));
  body.updated_at = new Date().toISOString();
  const w = await fetch(`${URL_}?id=eq.1&updated_at=eq.${encodeURIComponent(before.updated_at)}`, {
    method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(body),
  });
  const out = await w.json().catch(() => []);
  if (!w.ok || !Array.isArray(out) || out.length === 0) { console.error(`NOT APPLIED (HTTP ${w.status}): the content was saved while this ran — run it again.`); process.exit(4); }
  console.log("applied.");
}
