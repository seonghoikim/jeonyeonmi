// Writes dist/portfolio-fallback.json — a copy of the live content taken at build time.
// If the database can't be reached at runtime (e.g. the Supabase quota outage of
// 2026-09-30), the site shows this real, slightly older content instead of the built-in
// sample data (which lists made-up shows under the artist's name). Hidden contacts are
// left out so the static file never publishes anything the site itself hides.
// Fails soft: if Supabase can't be reached during the build, no file is written.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SUPABASE_URL = "https://tkbfgxxwsfxhdhjnrdqv.supabase.co";
// Public by design — the same anon key already shipped in the site's own JS bundle.
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYmZneHh3c2Z4aGRoam5yZHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDk5NjMsImV4cCI6MjA5OTIyNTk2M30.8UD570SWzih34oYy-yC1sB0oASA843NtmBplOMfc4DY";

try {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_state?id=eq.1&select=*`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const row = (await res.json())[0];
  if (!row || !Array.isArray(row.artworks) || row.artworks.length === 0) throw new Error("empty row");
  row.contacts = (row.contacts ?? []).filter((c) => c.visible);
  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "portfolio-fallback.json");
  writeFileSync(out, JSON.stringify(row));
  console.log(`write-fallback-snapshot: ${row.artworks.length} works, updated_at ${row.updated_at}`);
} catch (err) {
  console.warn(`write-fallback-snapshot: skipped (${err.message})`);
}
