// Shrinks the images already stored in Supabase Storage, without touching the originals' files.
//
// Why: many stored "webp" files are really lossless PNGs (iPhone Safari can't encode WebP, so the
// browser's canvas quietly returned PNG) — 5-10MB each — and they blew the egress quota.
//
// What it does, per image key in portfolio_state.image_urls:
//   * full image: if it isn't real WebP, or is >900KB, or has a long edge >2560px  → re-encode as
//     WebP (long edge <= 2560px, quality 88) and upload as a NEW object (old object is left alone)
//   * thumbnail ("<key>-thumb"): re-created from the original, 900px / quality 78, as WebP
//   * then swaps the new URLs into portfolio_state.image_urls (only if nobody saved in between)
//
// MODE=check  → only tests that the deploy token can fetch the service key (prints nothing secret)
// MODE=dry    → downloads + re-encodes in memory, prints the savings, writes nothing
// MODE=apply  → uploads + updates the row. Old URLs are written to optimize-report.json first.
//
// Runs from the "Optimize images" workflow (needs SUPABASE_ACCESS_TOKEN). Output is limited to
// storage keys and byte counts: the repo's logs are public.
import sharp from "sharp";
import fs from "node:fs";

const REF = process.env.PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const MODE = process.env.MODE || "dry";
const SUPABASE_URL = `https://${REF}.supabase.co`;
const MAX_FULL_PX = 2560, FULL_QUALITY = 88, THUMB_PX = 900, THUMB_QUALITY = 78;
const KEEP_IF_UNDER = 900 * 1024;
if (!REF || !TOKEN) { console.error("PROJECT_REF / SUPABASE_ACCESS_TOKEN missing"); process.exit(1); }

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

// ── service key via the Management API ──
const keysRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: `Bearer ${TOKEN}` } });
if (!keysRes.ok) { console.error(`Could not read project API keys: HTTP ${keysRes.status} ${(await keysRes.text()).slice(0, 300)}`); process.exit(2); }
const service = (await keysRes.json()).find((k) => k.name === "service_role")?.api_key;
if (!service) { console.error("service_role key not found in the API response"); process.exit(2); }
console.log(`::add-mask::${service}`);
console.log("service key: OK");
if (MODE === "check") process.exit(0);

const H = { apikey: service, Authorization: `Bearer ${service}` };
const rowRes = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_state?id=eq.1&select=image_urls,updated_at`, { headers: H });
const [row] = await rowRes.json();
if (!row?.image_urls) { console.error("could not read portfolio_state"); process.exit(3); }
const urls = row.image_urls;
const baseKeys = Object.keys(urls).filter((k) => !k.endsWith("-thumb"));
const thumbOnly = Object.keys(urls).filter((k) => k.endsWith("-thumb") && !(k.slice(0, -6) in urls));
console.log(`${baseKeys.length} images, ${thumbOnly.length} thumbnails without a full image, mode=${MODE}`);

const download = async (u) => Buffer.from(await (await fetch(u)).arrayBuffer());
const webp = (buf, px, q) => sharp(buf, { failOn: "none" }).rotate().resize({ width: px, height: px, fit: "inside", withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer();

let seq = 0;
async function upload(key, buf) {
  const path = `${key}/${Date.now()}${seq++}.webp`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/portfolio/${path}`, {
    method: "POST",
    headers: { ...H, "Content-Type": "image/webp", "Cache-Control": "max-age=31536000", "x-upsert": "false" },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload ${key}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/portfolio/${path}`;
}

const newUrls = { ...urls };
const report = { startedAt: new Date().toISOString(), rowUpdatedAt: row.updated_at, changes: [] };
let before = 0, after = 0, failed = 0;

async function handle(key) {
  const thumbKey = `${key}-thumb`;
  const oldFull = urls[key] ? await download(urls[key]) : null;
  const oldThumb = urls[thumbKey] ? await download(urls[thumbKey]) : null;
  const src = oldFull ?? oldThumb;
  const meta = await sharp(src, { failOn: "none" }).metadata();
  const fullIsReal = oldFull && meta.format === "webp";
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
  let full = oldFull, fullChanged = false;
  if (oldFull && !(fullIsReal && oldFull.length <= KEEP_IF_UNDER && longEdge <= MAX_FULL_PX)) {
    const out = await webp(oldFull, MAX_FULL_PX, FULL_QUALITY);
    if (out.length < oldFull.length * 0.85) { full = out; fullChanged = true; }
  }
  // Thumbnail: rebuilt from the best source we have; kept if already a small real WebP.
  let thumb = oldThumb, thumbChanged = false;
  const thumbMeta = oldThumb ? await sharp(oldThumb, { failOn: "none" }).metadata() : null;
  const thumbOk = oldThumb && thumbMeta.format === "webp" && oldThumb.length <= 200 * 1024;
  if (oldFull && !thumbOk) {
    const out = await webp(full, THUMB_PX, THUMB_QUALITY);
    if (!oldThumb || out.length < oldThumb.length * 0.85) { thumb = out; thumbChanged = true; }
  }
  const b = (oldFull?.length ?? 0) + (oldThumb?.length ?? 0);
  const a = (fullChanged ? full.length : oldFull?.length ?? 0) + (thumbChanged ? thumb.length : oldThumb?.length ?? 0);
  before += b; after += a;
  if (!fullChanged && !thumbChanged) return;
  const change = { key, before: kb(b), after: kb(a), full: fullChanged ? `${meta.format} ${kb(oldFull.length)} → webp ${kb(full.length)}` : "kept", thumb: thumbChanged ? `${thumbMeta?.format ?? "none"} ${kb(oldThumb?.length ?? 0)} → webp ${kb(thumb.length)}` : "kept", old: {} };
  if (MODE === "apply") {
    if (fullChanged) { change.old[key] = urls[key]; newUrls[key] = await upload(key, full); }
    if (thumbChanged) { change.old[thumbKey] = urls[thumbKey] ?? null; newUrls[thumbKey] = await upload(thumbKey, thumb); }
  }
  report.changes.push(change);
  console.log(`${key.padEnd(22)} ${kb(b).padStart(8)} → ${kb(a).padStart(7)}   full: ${change.full} | thumb: ${change.thumb}`);
}

// A few at a time: each original can be 10MB and a runner has limited memory.
const queue = [...baseKeys];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const key = queue.shift();
    try { await handle(key); } catch (e) { failed++; console.log(`!! ${key}: ${String(e.message).slice(0, 200)}`); }
  }
}));

console.log(`\nTOTAL stored for these images: ${(before / 1e6).toFixed(1)}MB → ${(after / 1e6).toFixed(1)}MB (${report.changes.length} images changed, ${failed} failed)`);
report.totalBefore = before; report.totalAfter = after;
fs.writeFileSync("optimize-report.json", JSON.stringify(report, null, 1));

if (MODE === "apply" && report.changes.length) {
  if (failed) console.log(`Note: ${failed} image(s) failed and were left as they were.`);
  // Only swap the URLs in if nobody saved the row while we were working.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_state?id=eq.1&updated_at=eq.${encodeURIComponent(row.updated_at)}`, {
    method: "PATCH",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ image_urls: newUrls, updated_at: new Date().toISOString() }),
  });
  const body = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(body) || body.length === 0) {
    console.error(`ROW NOT UPDATED (HTTP ${res.status}): the content was saved while this ran, so nothing was swapped in. Run it again.`);
    process.exit(4);
  }
  console.log("portfolio_state.image_urls updated.");
}
