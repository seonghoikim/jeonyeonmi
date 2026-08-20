import { useEffect } from "react";
import type { Lang } from "./data";

type SeoMetaInput = {
  name: string;
  description: string;
  imageUrl?: string | null;
  lang: Lang;
};

function setMetaContent(selector: string, value: string) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute("content", value);
}

function upsertMeta(attr: "property" | "name", key: string, value: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

// Once the real portfolio data loads, refresh <title> and the OG/Twitter meta tags
// (set to generic defaults in index.html) with the artist's actual name/description/
// hero image — this is what search engines and social-share previews see once they
// render the page's JS, since this is a client-only SPA with no server rendering.
//
// Also keeps <html lang>, canonical, and og:url/og:locale in sync with the actual
// route (/ = ko, /en = en) — the two are real, separately-linked (hreflang) URLs now,
// not just a client-side toggle, so each needs to correctly self-identify.
export function useSeoMeta({ name, description, imageUrl, lang }: SeoMetaInput) {
  useEffect(() => {
    document.documentElement.lang = lang;
    const isEn = lang === "en";
    // Canonical/og:url/og:locale describe *which URL this document is* — that has to
    // come from the actual path, not from `lang`, which on "/" is only a guess (by
    // visitor timezone) about which language to display. A non-Seoul-timezone visitor
    // (any crawler included — Googlebot isn't in Asia/Seoul) landing on plain "/" used
    // to get lang="en" for display purposes, and this code declared its canonical as
    // "/en" even though it was never on that route — Search Console caught exactly
    // this, showing "/en" as the self-declared canonical for a "/" crawl.
    const isEnPath = typeof window !== "undefined" && window.location.pathname.startsWith("/en");
    const url = `https://jeonyeonmi.com${isEnPath ? "/en" : "/"}`;
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", url);
    setMetaContent('meta[property="og:url"]', url);
    setMetaContent('meta[property="og:locale"]', isEnPath ? "en_US" : "ko_KR");
    setMetaContent('meta[property="og:locale:alternate"]', isEnPath ? "ko_KR" : "en_US");

    if (!name && !description) return;
    const title = name ? `${name} — ${isEn ? "Artist Portfolio" : "작가 포트폴리오"}` : document.title;
    document.title = title;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);
    if (imageUrl) {
      upsertMeta("property", "og:image", imageUrl);
      upsertMeta("name", "twitter:image", imageUrl);
    }
  }, [name, description, imageUrl, lang]);
}
