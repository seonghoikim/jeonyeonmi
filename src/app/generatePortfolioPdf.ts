import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// 1 CSS px = 1/96 inch, converted to mm — keeps every measurement (container width,
// block positions, page height) in one consistent unit system without relying on
// jsPDF's own px-unit quirks.
const PX_TO_MM = 25.4 / 96;
const A4_ASPECT = 297 / 210; // page height / width
const BASE_SCALE = 1.5;
const MAX_CANVAS_HEIGHT_PX = 14000; // stay well under mobile browsers' canvas size limits
const IMAGE_WAIT_TIMEOUT_MS = 10000;

// Rasterizing (rather than a real-text PDF) is a deliberate choice here: it's the only
// approach that works from *any* browser context — including in-app WebViews (Instagram,
// KakaoTalk, etc.) that silently no-op on window.print() — and it renders Korean text
// via the browser's own fonts instead of needing a bundled CJK font for a text-based PDF
// library. Filesystem save is a plain Blob download, which those WebViews do support.
export async function waitForImages(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll("img"));
  const loaders = imgs.map((el) => {
    const image = el as HTMLImageElement;
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  });
  await Promise.race([
    Promise.all(loaders),
    new Promise<void>((resolve) => setTimeout(resolve, IMAGE_WAIT_TIMEOUT_MS)),
  ]);
}

type PdfBlock = { top: number; bottom: number; height: number; sectionId: string | null; url: string | null };

// Splits the tall single capture into pages along the boundaries between
// `[data-pdf-atom]` elements only — never through one — and forces a fresh page
// whenever a `[data-pdf-section]` ancestor changes, mirroring what the old
// print-media CSS (`break-inside: avoid` / `break-before: page`) did for the
// browser's own paginator, which isn't available in this raster path.
function paginate(blocks: PdfBlock[], pageHeightPx: number): { start: number; blocks: PdfBlock[] }[] {
  const pages: { start: number; blocks: PdfBlock[] }[] = [];
  let current: { start: number; blocks: PdfBlock[] } | null = null;
  let lastSection: string | null = null;

  for (const block of blocks) {
    const enteringNewSection = block.sectionId !== null && block.sectionId !== lastSection;
    const overflowing = !!current && block.bottom - current.start > pageHeightPx;
    if (!current || enteringNewSection || overflowing) {
      if (current) pages.push(current);
      current = { start: block.top, blocks: [] };
    }
    current.blocks.push(block);
    lastSection = block.sectionId ?? lastSection;
  }
  if (current) pages.push(current);
  return pages;
}

export async function generatePortfolioPdf(container: HTMLElement, filename: string): Promise<void> {
  await waitForImages(container);

  const containerRect = container.getBoundingClientRect();
  const containerWidthPx = containerRect.width;
  const pageHeightPx = containerWidthPx * A4_ASPECT;

  const atomEls = Array.from(container.querySelectorAll<HTMLElement>("[data-pdf-atom]"));
  const blocks: PdfBlock[] = atomEls.map((el) => {
    const r = el.getBoundingClientRect();
    const section = el.closest<HTMLElement>("[data-pdf-section]");
    const link = el.matches("a[href]") ? (el as HTMLAnchorElement) : el.querySelector<HTMLAnchorElement>("a[href]");
    return {
      top: r.top - containerRect.top,
      bottom: r.bottom - containerRect.top,
      height: r.height,
      sectionId: section?.getAttribute("data-pdf-section") ?? null,
      url: link?.getAttribute("href") ?? null,
    };
  });

  // Cap the capture scale so very long portfolios (many works) can't produce a
  // canvas taller than what mobile browsers reliably support.
  const contentHeightPx = container.scrollHeight;
  const scale = Math.max(0.75, Math.min(BASE_SCALE, MAX_CANVAS_HEIGHT_PX / contentHeightPx));

  const canvas = await html2canvas(container, { scale, backgroundColor: "#ffffff", useCORS: true });
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const canvasCssHeightPx = canvas.height / scale;

  const pages = paginate(blocks, pageHeightPx);
  const pageWidthMm = containerWidthPx * PX_TO_MM;
  const pageHeightMm = pageHeightPx * PX_TO_MM;

  const pdf = new jsPDF({ unit: "mm", format: [pageWidthMm, pageHeightMm] });
  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage([pageWidthMm, pageHeightMm]);
    pdf.addImage(imgData, "JPEG", 0, -page.start * PX_TO_MM, containerWidthPx * PX_TO_MM, canvasCssHeightPx * PX_TO_MM);
    for (const block of page.blocks) {
      if (!block.url) continue;
      pdf.link(0, (block.top - page.start) * PX_TO_MM, containerWidthPx * PX_TO_MM, block.height * PX_TO_MM, { url: block.url });
    }
  });

  pdf.save(filename);
}
