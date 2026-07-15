import { useEffect } from "react";

type SeoMetaInput = {
  name: string;
  description: string;
  imageUrl?: string | null;
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
export function useSeoMeta({ name, description, imageUrl }: SeoMetaInput) {
  useEffect(() => {
    if (!name && !description) return;
    const title = name ? `${name} — 작가 포트폴리오` : document.title;
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
  }, [name, description, imageUrl]);
}
