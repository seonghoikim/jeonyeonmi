// Captures the whole live site — rendered at a fixed desktop width, regardless of the
// device actually triggering the download — as one tall image, then crops it into one
// page per section (splitting only if a single section is unusually tall) for a
// PPT-style PDF export via the browser print dialog. Runs the capture inside a hidden
// same-origin iframe so a visitor on mobile still gets the desktop layout, and so the
// visible page isn't disrupted mid-capture.

export type DeckSlice = { dataUrl: string; width: number; height: number };

const CAPTURE_WIDTH = 1440;
const MAX_PAGE_HEIGHT = 2600; // fallback split point for a single oversized section
const SECTION_IDS = ["hero", "current-exhibitions", "works", "statement", "exhibitions", "press", "activities", "videos", "contact"];
const IFRAME_LOAD_TIMEOUT_MS = 20000;
const CONTENT_READY_TIMEOUT_MS = 10000;
const IMAGE_SETTLE_TIMEOUT_MS = 15000;

function waitFor(condition: () => boolean, timeoutMs: number, intervalMs = 200): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (condition() || Date.now() - start > timeoutMs) { resolve(); return; }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("캡처한 이미지를 불러오지 못했습니다"));
    img.src = src;
  });
}

// Native lazy-loading only fires once an image nears the viewport — since this
// iframe is never actually scrolled, anything below the first screenful would
// otherwise never load at all. Force everything to load immediately.
function forceEagerImages(doc: Document) {
  Array.from(doc.images).forEach((img) => {
    if (img.loading === "lazy") img.loading = "eager";
  });
}

type Bound = { top: number; bottom: number };

function getSectionBoundaries(doc: Document, rootHeight: number): Bound[] {
  const tops = SECTION_IDS
    .map((id) => doc.getElementById(id))
    .filter((el): el is HTMLElement => !!el)
    .map((el) => Math.round(el.getBoundingClientRect().top))
    .sort((a, b) => a - b);
  if (tops.length === 0) return [{ top: 0, bottom: rootHeight }];
  return tops.map((top, i) => ({ top, bottom: i < tops.length - 1 ? tops[i + 1] : rootHeight }));
}

// Splits any section taller than MAX_PAGE_HEIGHT into a few evenly-sized pages —
// every other (normal-height) section becomes exactly one page, so cuts never land
// in the middle of an unrelated section or image.
function planPages(bounds: Bound[]): Bound[] {
  const pages: Bound[] = [];
  for (const b of bounds) {
    const h = b.bottom - b.top;
    if (h <= 0) continue;
    if (h <= MAX_PAGE_HEIGHT) { pages.push(b); continue; }
    const chunks = Math.ceil(h / MAX_PAGE_HEIGHT);
    const chunkHeight = Math.ceil(h / chunks);
    for (let y = b.top; y < b.bottom; y += chunkHeight) {
      pages.push({ top: y, bottom: Math.min(y + chunkHeight, b.bottom) });
    }
  }
  return pages;
}

function cropPage(img: HTMLImageElement, width: number, page: Bound): DeckSlice {
  const height = page.bottom - page.top;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, page.top, width, height, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

export async function generatePortfolioDeck(): Promise<DeckSlice[]> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed; top:-99999px; left:-99999px; width:${CAPTURE_WIDTH}px; height:900px; border:0; visibility:hidden;`;
  const url = new URL(window.location.href);
  url.searchParams.set("capture", "1");
  iframe.src = url.toString();

  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve, reject) => {
      iframe.addEventListener("load", () => resolve(), { once: true });
      setTimeout(() => reject(new Error("페이지 로딩 시간이 초과되었습니다")), IFRAME_LOAD_TIMEOUT_MS);
    });

    const doc = iframe.contentDocument;
    const root = doc?.getElementById("root");
    if (!doc || !root) throw new Error("캡처할 콘텐츠를 찾지 못했습니다");

    // Wait for the SPA to finish its initial render (past the loading overlay).
    await waitFor(() => !!doc.getElementById("works"), CONTENT_READY_TIMEOUT_MS);
    forceEagerImages(doc);
    await waitFor(() => Array.from(doc.images).every((img) => img.complete), IMAGE_SETTLE_TIMEOUT_MS);

    const fullHeight = root.scrollHeight;
    const pages = planPages(getSectionBoundaries(doc, fullHeight));

    const { domToPng } = await import("modern-screenshot");
    const dataUrl = await domToPng(root, {
      width: CAPTURE_WIDTH,
      height: fullHeight,
      backgroundColor: "#0a0a0a",
      timeout: 20000,
    });

    const img = await loadImage(dataUrl);
    return pages.map((p) => cropPage(img, CAPTURE_WIDTH, p));
  } finally {
    document.body.removeChild(iframe);
  }
}
