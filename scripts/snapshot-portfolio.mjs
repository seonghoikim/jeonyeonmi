// Downloads the live portfolio_state row (public read) and writes it as deterministic JSON.
//   node scripts/snapshot-portfolio.mjs <output.json>
// Exits non-zero, writing nothing, if the row can't be fetched or doesn't look real.
import { writeFileSync, appendFileSync } from "node:fs";
import { assertLooksValid, stableStringify, summarize } from "./lib/backup.mjs";

const SUPABASE_URL = "https://tkbfgxxwsfxhdhjnrdqv.supabase.co";
// Public by design — the same anon key already shipped in the site's own JS bundle.
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYmZneHh3c2Z4aGRoam5yZHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDk5NjMsImV4cCI6MjA5OTIyNTk2M30.8UD570SWzih34oYy-yC1sB0oASA843NtmBplOMfc4DY";

const out = process.argv[2];
if (!out) { console.error("usage: snapshot-portfolio.mjs <output.json>"); process.exit(2); }

const res = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_state?id=eq.1&select=*`, {
  headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  signal: AbortSignal.timeout(30000),
});
if (!res.ok) { console.error(`fetch failed: HTTP ${res.status}`); process.exit(1); }
const row = (await res.json())[0];
try { assertLooksValid(row); } catch (err) { console.error(`refusing to back up: ${err.message}`); process.exit(1); }

writeFileSync(out, stableStringify(row));
const summary = summarize(row);
console.log(`snapshot written: ${summary} updated_at=${row.updated_at}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `summary=${summary}\nupdated_at=${row.updated_at}\n`);
