// Bakes site-level social-preview data into the built index.html at build time:
// the hero image as og:image/twitter:image (crawlers that don't run JS otherwise get
// a preview card with no picture) and image + sameAs on the static Person JSON-LD.
// Runs before build-en-html.mjs so dist/en/index.html inherits it. Fails soft — if
// Supabase can't be reached during a build, the shell is left as-is rather than
// breaking the deploy.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SUPABASE_URL = "https://tkbfgxxwsfxhdhjnrdqv.supabase.co";
// Public by design — the same anon key already shipped in the site's own JS bundle.
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYmZneHh3c2Z4aGRoam5yZHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDk5NjMsImV4cCI6MjA5OTIyNTk2M30.8UD570SWzih34oYy-yC1sB0oASA843NtmBplOMfc4DY";

const indexPath = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.html");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let row;
try {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_state?id=eq.1&select=image_urls,contacts`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  row = (await res.json())[0];
} catch (err) {
  console.warn(`inject-seo-defaults: skipped (${err.message})`);
  process.exit(0);
}

let html = readFileSync(indexPath, "utf-8");
const hero = row?.image_urls?.hero;
if (hero && /^https?:\/\//.test(hero) && !html.includes('property="og:image"')) {
  const tags =
    `      <meta property="og:image" content="${esc(hero)}" />\n` +
    `      <meta name="twitter:image" content="${esc(hero)}" />\n`;
  html = html.replace("</head>", () => `${tags}    </head>`);
}

const sameAs = (Array.isArray(row?.contacts) ? row.contacts : [])
  .filter((c) => c?.visible && (c.type === "instagram" || c.type === "blog") && /^https?:\/\//.test(c.href ?? ""))
  .map((c) => c.href);
const jsonLdUrl = /("url":\s*"https:\/\/jeonyeonmi\.com\/")(\s*\n)/;
if (jsonLdUrl.test(html) && (hero || sameAs.length) && !html.includes('"sameAs"')) {
  const extra = [
    hero && /^https?:\/\//.test(hero) ? `"image": ${JSON.stringify(hero)}` : null,
    sameAs.length ? `"sameAs": ${JSON.stringify(sameAs)}` : null,
  ].filter(Boolean).join(",\n        ");
  html = html.replace(jsonLdUrl, (_m, url, nl) => `${url},\n        ${extra}${nl}`);
}

writeFileSync(indexPath, html);
console.log(`inject-seo-defaults: og:image ${hero ? "set" : "unavailable"}, sameAs ${sameAs.length}`);
