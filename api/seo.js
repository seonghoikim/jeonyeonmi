/* Serverless SEO helper (Vercel Node function), reached through vercel.json rewrites:
     /works/:slug     -> the static Korean shell with that artwork's own <head> tags
     /en/works/:slug  -> the same for the English shell
     /sitemap.xml     -> a sitemap generated from the live artwork list
   The site is a client-rendered SPA, so link-preview crawlers (KakaoTalk, Slack,
   Facebook, X) never run its JS — without this, every shared /works/... link previews as
   the generic site card. Fails soft: on any data problem it serves the plain shell (or a
   minimal sitemap) instead of an error. */

import { readFile } from "node:fs/promises";
import { artworkIdFromSlug, buildSitemap, injectWorkMeta, loadRow } from "./_seoLib.js";

async function loadShell(req, lang) {
  const file = lang === "en" ? "en/index.html" : "index.html";
  // Prefer the copy bundled with the function (includeFiles in vercel.json); otherwise
  // fetch the deployed static shell over HTTP.
  try { return await readFile(`${process.cwd()}/dist/${file}`, "utf-8"); } catch { /* fall through */ }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const res = await fetch(`https://${host}/${file}`);
  if (!res.ok) throw new Error(`shell ${res.status}`);
  return res.text();
}

export default async function handler(req, res) {
  const { type, slug, lang: langParam } = req.query ?? {};
  const lang = langParam === "en" ? "en" : "ko";

  if (type === "sitemap") {
    let row = null;
    try { row = await loadRow(); } catch (err) { console.error("[seo] sitemap data:", err); }
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
    return res.status(200).send(buildSitemap(row));
  }

  let shell;
  try { shell = await loadShell(req, lang); } catch (err) {
    console.error("[seo] shell:", err);
    return res.status(500).send("shell unavailable");
  }
  let html = shell;
  try {
    const id = artworkIdFromSlug(String(slug ?? ""));
    const row = id != null ? await loadRow() : null;
    const work = row && Array.isArray(row.artworks) ? row.artworks.find((w) => w.id === id) : null;
    if (work) html = injectWorkMeta(shell, { work, row, lang });
  } catch (err) {
    console.error("[seo] work meta:", err);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return res.status(200).send(html);
}
