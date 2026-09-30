/* Helpers for api/seo.js (kept apart so they can be unit-tested without a server).
   The underscore prefix keeps Vercel from exposing this file as its own route. */

export const SITE = "https://jeonyeonmi.com";
export const SUPABASE_URL = "https://tkbfgxxwsfxhdhjnrdqv.supabase.co";
// Public by design — the same anon key already shipped in the site's own JS bundle.
export const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYmZneHh3c2Z4aGRoam5yZHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDk5NjMsImV4cCI6MjA5OTIyNTk2M30.8UD570SWzih34oYy-yC1sB0oASA843NtmBplOMfc4DY";

// Must mirror artworkSlug()/artworkIdFromSlug() in src/app/data.ts — the trailing id is
// what resolves the work; the text before it is cosmetic.
function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export function artworkSlug(w) {
  const base = slugify(w.titleEn || w.title || "");
  return base ? `${base}-${w.id}` : String(w.id);
}
export function artworkIdFromSlug(slug) {
  const m = String(slug).match(/(\d+)$/);
  return m ? Number(m[1]) : null;
}

const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeXml = escapeAttr;
const truncate = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");

export async function loadRow(fetchImpl = fetch) {
  const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/portfolio_state?id=eq.1&select=artworks,image_urls,content,updated_at`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

// Replace the value inside a tag the shell already has. A replacer function (not a
// "$1…$2" string) so a "$" in a title/description can't be read as a replacement pattern.
function setTag(html, pattern, value) {
  return html.replace(pattern, (_m, open, close) => open + value + close);
}
const metaRe = (attr, key) => new RegExp(`(<meta ${attr}="${key}" content=")[^"]*("\\s*/?>)`);
const linkRe = (rel, hreflang) => new RegExp(`(<link rel="${rel}"${hreflang ? ` hreflang="${hreflang}"` : ""} href=")[^"]*("\\s*/?>)`);

export function injectWorkMeta(shell, { work, row, lang, origin = SITE }) {
  const isEn = lang === "en";
  const artist = (isEn ? row.content?.heroNameEn : row.content?.heroName) || row.content?.heroName || "전연미";
  const title = `${isEn ? (work.titleEn || work.title) : work.title} — ${artist}`;
  const bio = (isEn ? row.content?.heroDescEn : row.content?.heroDesc) || row.content?.heroDesc || "";
  const detail = [work.year, isEn ? (work.mediumEn || work.medium) : work.medium, work.size].filter(Boolean).join(" · ");
  // Collapse line breaks/runs of spaces — descriptions are multi-paragraph, a preview card is one blob.
  const written = ((isEn ? work.descriptionEn : work.description) || work.description || "").replace(/\s+/g, " ").trim();
  const description = truncate(written || [detail, bio].filter(Boolean).join(" — "), 200);
  const image = row.image_urls?.[`artwork-${work.id}`] || row.image_urls?.hero || "";
  const slug = artworkSlug(work);
  const koUrl = `${origin}/works/${slug}`;
  const enUrl = `${origin}/en/works/${slug}`;
  const self = isEn ? enUrl : koUrl;

  let html = shell.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeAttr(title)}</title>`);
  html = setTag(html, metaRe("name", "description"), escapeAttr(description));
  html = setTag(html, linkRe("canonical"), self);
  html = setTag(html, linkRe("alternate", "ko"), koUrl);
  html = setTag(html, linkRe("alternate", "en"), enUrl);
  html = setTag(html, linkRe("alternate", "x-default"), koUrl);
  html = setTag(html, metaRe("property", "og:title"), escapeAttr(title));
  html = setTag(html, metaRe("property", "og:description"), escapeAttr(description));
  html = setTag(html, metaRe("property", "og:url"), self);
  html = setTag(html, metaRe("property", "og:type"), "article");
  html = setTag(html, metaRe("name", "twitter:title"), escapeAttr(title));
  html = setTag(html, metaRe("name", "twitter:description"), escapeAttr(description));
  if (image) {
    // The shell may already carry a default og:image/twitter:image — swap those out.
    html = html
      .replace(/\s*<meta property="og:image"[^>]*>/g, "")
      .replace(/\s*<meta property="og:image:alt"[^>]*>/g, "")
      .replace(/\s*<meta name="twitter:image"[^>]*>/g, "");
    const tags =
      `      <meta property="og:image" content="${escapeAttr(image)}" />\n` +
      `      <meta property="og:image:alt" content="${escapeAttr(title)}" />\n` +
      `      <meta name="twitter:image" content="${escapeAttr(image)}" />\n`;
    html = html.replace("</head>", () => `${tags}    </head>`);
  }
  return html;
}

export function buildSitemap(row) {
  const alt = (ko, en) =>
    `       <xhtml:link rel="alternate" hreflang="ko" href="${escapeXml(ko)}" />\n` +
    `       <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(en)}" />\n` +
    `       <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(ko)}" />`;
  const entry = (loc, ko, en, priority, lastmod) =>
    `  <url>\n       <loc>${escapeXml(loc)}</loc>\n${lastmod ? `       <lastmod>${lastmod}</lastmod>\n` : ""}       <priority>${priority}</priority>\n${alt(ko, en)}\n  </url>`;
  const lastmod = row?.updated_at ? new Date(row.updated_at).toISOString() : null;
  const urls = [
    entry(`${SITE}/`, `${SITE}/`, `${SITE}/en`, "1.0", lastmod),
    entry(`${SITE}/en`, `${SITE}/`, `${SITE}/en`, "0.9", lastmod),
  ];
  for (const work of Array.isArray(row?.artworks) ? row.artworks : []) {
    if (work?.id == null) continue;
    const slug = artworkSlug(work);
    const ko = `${SITE}/works/${slug}`;
    const en = `${SITE}/en/works/${slug}`;
    urls.push(entry(ko, ko, en, "0.7"), entry(en, ko, en, "0.6"));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}
