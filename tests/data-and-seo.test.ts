import { describe, expect, it } from "vitest";
import { artworkIdFromSlug, artworkSlug, moveInFiltered, moveItem, swapSizeOrder } from "../src/app/data";
import { artworkIdFromSlug as apiIdFromSlug, artworkSlug as apiSlug, buildSitemap, injectWorkMeta } from "../api/_seoLib.js";

describe("moveItem / moveInFiltered", () => {
  it("moves within a list without mutating the input", () => {
    const a = [1, 2, 3, 4];
    expect(moveItem(a, 0, 2)).toEqual([2, 3, 1, 4]);
    expect(a).toEqual([1, 2, 3, 4]);
  });
  it("moves one step inside a filtered view and maps back to the full list", () => {
    const full = [{ id: 1, t: "a" }, { id: 2, t: "b" }, { id: 3, t: "a" }, { id: 4, t: "a" }];
    const filtered = full.filter((x) => x.t === "a");
    expect(moveInFiltered(full, filtered, 1, -1).map((x) => x.id)).toEqual([3, 1, 2, 4]); // id 3 moves ahead of id 1; the filtered-out id 2 keeps its place
    expect(moveInFiltered(full, filtered, 0, -1)).toBe(full); // already first: unchanged
  });
});

// The Vercel function re-implements the slug rules (it can't import the app's TS), so
// this is what keeps a shared /works/<slug> link resolving to the same artwork.
describe("artwork slugs", () => {
  const works = [
    { id: 53, title: "연 결", titleEn: "Yeon-gyeol" },
    { id: 7, title: "아주 사적인 색", titleEn: "A Private Hue" },
    { id: 54, title: "", titleEn: "" },
    { id: 9, title: "봄 결", titleEn: "" },
    { id: 12, title: "Été — №5", titleEn: "Été — №5" },
  ];
  it.each(works)("app and function agree for %o", (w) => {
    expect(apiSlug(w)).toBe(artworkSlug(w));
    expect(apiIdFromSlug(artworkSlug(w))).toBe(w.id);
    expect(artworkIdFromSlug(artworkSlug(w))).toBe(w.id);
  });
  it("resolves by trailing id even after the title changes", () => {
    expect(artworkIdFromSlug("old-title-53")).toBe(53);
    expect(artworkIdFromSlug("no-number")).toBeNull();
  });
});

const shell = `<html lang="ko"><head>
<title>site</title>
<meta name="description" content="site desc" />
<link rel="canonical" href="https://jeonyeonmi.com/" />
<link rel="alternate" hreflang="ko" href="https://jeonyeonmi.com/" />
<link rel="alternate" hreflang="en" href="https://jeonyeonmi.com/en" />
<link rel="alternate" hreflang="x-default" href="https://jeonyeonmi.com/" />
<meta property="og:type" content="website" />
<meta property="og:title" content="site" />
<meta property="og:description" content="site desc" />
<meta property="og:url" content="https://jeonyeonmi.com/" />
<meta property="og:image" content="https://old/hero.webp" />
<meta name="twitter:title" content="site" />
<meta name="twitter:description" content="site desc" />
<meta name="twitter:image" content="https://old/hero.webp" />
</head><body></body></html>`;
const row = {
  content: { heroName: "전연미", heroNameEn: "Jeon Yeon-mi", heroDesc: "소개", heroDescEn: "Intro" },
  image_urls: { "artwork-53": "https://img/53.webp", hero: "https://img/hero.webp" },
};

describe("injectWorkMeta", () => {
  const work = { id: 53, title: "연 결", titleEn: "Yeon-gyeol", year: "2026", medium: "한지", mediumEn: "Hanji", size: "10F", description: "긴 설명\n\n두 문단", descriptionEn: "Long\ntext" };
  it("rewrites title, canonical, og and hreflang for the Korean page", () => {
    const html = injectWorkMeta(shell, { work, row, lang: "ko" });
    expect(html).toContain("<title>연 결 — 전연미</title>");
    expect(html).toContain('<link rel="canonical" href="https://jeonyeonmi.com/works/yeon-gyeol-53" />');
    expect(html).toContain('hreflang="en" href="https://jeonyeonmi.com/en/works/yeon-gyeol-53"');
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('content="긴 설명 두 문단"'); // whitespace collapsed
  });
  it("swaps the default og:image for the artwork's, leaving exactly one of each", () => {
    const html = injectWorkMeta(shell, { work, row, lang: "ko" });
    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    expect(html.match(/name="twitter:image"/g)).toHaveLength(1);
    expect(html).toContain("https://img/53.webp");
    expect(html).not.toContain("https://old/hero.webp");
  });
  it("uses English text and the /en URL for lang=en", () => {
    const html = injectWorkMeta(shell, { work, row, lang: "en" });
    expect(html).toContain("<title>Yeon-gyeol — Jeon Yeon-mi</title>");
    expect(html).toContain('<link rel="canonical" href="https://jeonyeonmi.com/en/works/yeon-gyeol-53" />');
  });
  it("treats '$' in text literally instead of as a replacement pattern", () => {
    const html = injectWorkMeta(shell, { work: { ...work, description: "Price $& $1 $$", descriptionEn: "Price $& $1 $$" }, row, lang: "ko" });
    expect(html).toContain("Price $&amp; $1 $$");
  });
  it("escapes quotes and angle brackets in attributes", () => {
    const html = injectWorkMeta(shell, { work: { ...work, title: 'A "quoted" <b>' }, row, lang: "ko" });
    expect(html).toContain("A &quot;quoted&quot; &lt;b&gt;");
    expect(html).not.toContain('<b>');
  });
});

describe("buildSitemap", () => {
  it("lists home, /en, and ko+en pages for every artwork with hreflang pairs", () => {
    const xml = buildSitemap({ updated_at: "2026-09-30T00:00:00Z", artworks: [{ id: 1, titleEn: "One", title: "일" }, { id: 2, titleEn: "Two", title: "이" }] });
    expect(xml.match(/<loc>/g)).toHaveLength(2 + 4);
    expect(xml).toContain("<loc>https://jeonyeonmi.com/works/one-1</loc>");
    expect(xml).toContain("<loc>https://jeonyeonmi.com/en/works/two-2</loc>");
    expect(xml).toContain("<lastmod>2026-09-30T00:00:00.000Z</lastmod>");
    expect(xml).not.toContain("xml-stylesheet");
  });
  it("still returns the two home URLs when the data couldn't be loaded", () => {
    expect(buildSitemap(null).match(/<loc>/g)).toHaveLength(2);
  });
});

describe("swapSizeOrder", () => {
  it("flips width x height into height x width", () => {
    expect(swapSizeOrder("72.7 x 90.9 cm")).toBe("90.9 x 72.7 cm");
    expect(swapSizeOrder("50 × 72.7 cm")).toBe("72.7 × 50 cm");
  });
  it("handles multi-panel and depth notations", () => {
    expect(swapSizeOrder("243 x 117 cm (81 x 117 cm x3ea)")).toBe("117 x 243 cm (117 x 81 cm x3ea)");
    expect(swapSizeOrder("30 x 40 x 5 cm")).toBe("40 x 30 x 5 cm");
  });
  it("leaves strings without a pair alone and is reversible", () => {
    expect(swapSizeOrder("가변크기")).toBe("가변크기");
    expect(swapSizeOrder(swapSizeOrder("22  x 16 cm"))).toBe("22  x 16 cm");
  });
});
