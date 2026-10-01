// Shrinks the images already stored in Supabase Storage, without touching the originals' files.
//
// Why: many stored "webp" files are really lossless PNGs (iPhone Safari can't encode WebP, so the
// browser's canvas quietly returned PNG) — 5-10MB each — and they blew the egress quota.
//
// What it does, per image key in portfolio_state.image_urls:
//   * full image: if it isn't real WebP (e.g. a lossless PNG), or is >1.6MB, or has a long edge >2560px  → re-encode as
//     WebP (long edge <= 2560px, quality 88) and upload as a NEW object (old object is left alone)
//   * thumbnail ("<key>-thumb"): re-created from the original, 900px / quality 78, as WebP
//   * then swaps the new URLs into portfolio_state.image_urls (only if nobody saved in between)
//
// MODE=check  → only tests that the service key is accepted (prints nothing secret)
// MODE=dry    → downloads + re-encodes in memory, prints the savings, writes nothing
// MODE=apply  → uploads + updates the row. Old URLs are written to optimize-report.json first.
//
// Runs from the "Optimize images" workflow (needs the SUPABASE_SERVICE_ROLE_KEY repo secret). Output is limited to
// storage keys and byte counts: the repo's logs are public.
import sharp from "sharp";
import fs from "node:fs";

const REF = process.env.PROJECT_REF;
// The service key comes from the repo secret SUPABASE_SERVICE_ROLE_KEY (the deploy token only has
// narrow permissions and can't read project API keys).
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODE = process.env.MODE || "dry";
const SUPABASE_URL = `https://${REF}.supabase.co`;
const MAX_FULL_PX = 2560, FULL_QUALITY = 88, THUMB_PX = 900, THUMB_QUALITY = 78;
// Real WebP files are only re-encoded when clearly oversized — re-compressing an already-lossy file costs quality for little gain.
const KEEP_IF_UNDER = 1600 * 1024;
if (!REF || !SERVICE_KEY) { console.error("PROJECT_REF / SUPABASE_SERVICE_ROLE_KEY missing - add the repo secret (see README)"); process.exit(1); }

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

// ── service key (from the repo secret) ──
console.log(`::add-mask::${SERVICE_KEY}`);
// New-style secret keys (sb_secret_...) are not JWTs and go in the apikey header only.
const H = SERVICE_KEY.startsWith("sb_secret_") ? { apikey: SERVICE_KEY } : { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const rowRes0 = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_state?id=eq.1&select=id`, { headers: H });
if (!rowRes0.ok) { console.error(`service key rejected: HTTP ${rowRes0.status}`); process.exit(2); }
console.log("service key: OK");
if (MODE === "check") process.exit(0);

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
