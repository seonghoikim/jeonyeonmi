// Generates dist/en/index.html: a copy of the built index.html with English-language
// static <head> tags (lang, title, description, keywords, canonical, OG/Twitter, JSON-LD
// description). Without this, Vercel's /en rewrite served the same Korean-canonicalized
// index.html for both routes, so Googlebot's pre-render crawl saw /en self-canonicalize
// to "/" — actively working against /en ever getting indexed as a separate page.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const html = readFileSync(join(distDir, "index.html"), "utf-8");

const EN_TITLE = "Jeon Yeon-mi | 전연미 — Artist Portfolio";
const EN_SITE_NAME = "Jeon Yeon-mi | 전연미";
const EN_DESCRIPTION = "Jeon Yeon-mi is a Korean contemporary artist who explores the boundaries between form and memory by burning, tearing, and layering hanji (traditional Korean paper). Discover her works and exhibition history.";
const EN_KEYWORDS = "burned hanji painting, torn hanji collage, mixed media artist, bark-textured painting, form and memory, invisible boundaries, emerging Korean artist, Jeon Yeon-mi, 전연미, Korean contemporary artist";
const EN_JSONLD_DESC = "A Korean contemporary artist who explores form, memory, and invisible boundaries by burning and tearing hanji.";

const replacements = [
  [/<html lang="ko">/, '<html lang="en">'],
  [/<title>[^<]*<\/title>/, `<title>${EN_TITLE}</title>`],
  [/(<meta name="description" content=")[^"]*("\s*\/>)/, `$1${EN_DESCRIPTION}$2`],
  [/(<meta name="keywords" content=")[^"]*("\s*\/>)/, `$1${EN_KEYWORDS}$2`],
  [/(<link rel="canonical" href=")[^"]*("\s*\/>)/, `$1https://jeonyeonmi.com/en$2`],
  [/(<meta property="og:site_name" content=")[^"]*("\s*\/>)/, `$1${EN_SITE_NAME}$2`],
  [/(<meta property="og:title" content=")[^"]*("\s*\/>)/, `$1${EN_TITLE}$2`],
  [/(<meta property="og:description" content=")[^"]*("\s*\/>)/, `$1${EN_DESCRIPTION}$2`],
  [/(<meta property="og:url" content=")[^"]*("\s*\/>)/, `$1https://jeonyeonmi.com/en$2`],
  [/(<meta property="og:locale" content=")[^"]*("\s*\/>)/, `$1en_US$2`],
  [/(<meta property="og:locale:alternate" content=")[^"]*("\s*\/>)/, `$1ko_KR$2`],
  [/(<meta name="twitter:title" content=")[^"]*("\s*\/>)/, `$1${EN_TITLE}$2`],
  [/(<meta name="twitter:description" content=")[^"]*("\s*\/>)/, `$1${EN_DESCRIPTION}$2`],
  [/("description":\s*")[^"]*(",\s*\n\s*"url")/, `$1${EN_JSONLD_DESC}$2`],
];

let enHtml = html;
for (const [pattern, replacement] of replacements) {
  if (!pattern.test(enHtml)) throw new Error(`build-en-html: pattern not found: ${pattern}`);
  enHtml = enHtml.replace(pattern, replacement);
}

mkdirSync(join(distDir, "en"), { recursive: true });
writeFileSync(join(distDir, "en", "index.html"), enHtml);
console.log("Generated dist/en/index.html with English meta tags.");
