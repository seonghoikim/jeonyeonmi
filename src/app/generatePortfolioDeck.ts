// Captures the whole live site — rendered at a fixed desktop width, regardless of the
// device actually triggering the download — as one tall image, then slices it into
// 16:9 presentation-sized pages for a PPT-style PDF export (via the browser print
// dialog). Runs the capture inside a hidden same-origin iframe so a visitor on mobile
// still gets the desktop layout, and so the visible page isn't disrupted mid-capture.

export type DeckSlice = { dataUrl: string; width: number; height: number };

const CAPTURE_WIDTH = 1440;
const SLIDE_RATIO = 16 / 9;
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

function sliceIntoSlides(img: HTMLImageElement, width: number, totalHeight: number): DeckSlice[] {
  const slideHeight = Math.round(width / SLIDE_RATIO);
  const slices: DeckSlice[] = [];
  for (let y = 0; y < totalHeight; y += slideHeight) {
    const h = Math.min(slideHeight, totalHeight - y);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = slideHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, slideHeight);
    ctx.drawImage(img, 0, y, width, h, 0, 0, width, h);
    slices.push({ dataUrl: canvas.toDataURL("image/png"), width, height: slideHeight });
  }
  return slices;
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
    // Best-effort wait for images inside the capture to finish loading.
    await waitFor(() => Array.from(doc.images).every((img) => img.complete), IMAGE_SETTLE_TIMEOUT_MS);

    const fullHeight = root.scrollHeight;
    const { domToPng } = await import("modern-screenshot");
    const dataUrl = await domToPng(root, {
      width: CAPTURE_WIDTH,
      height: fullHeight,
      backgroundColor: "#0a0a0a",
      timeout: 20000,
    });

    const img = await loadImage(dataUrl);
    return sliceIntoSlides(img, CAPTURE_WIDTH, fullHeight);
  } finally {
    document.body.removeChild(iframe);
  }
}
