import jsPDF from "jspdf";

// Real, selectable/searchable text — not a rasterized screenshot of the page — so it
// needs an embedded font that actually covers Hangul (jsPDF's built-in fonts are
// Latin-only). The two files are the Korean-subset weights of Noto Sans KR, converted
// from @fontsource's woff2 to raw ttf (jsPDF's addFont only accepts ttf/otf) and
// self-hosted under public/fonts so generation never depends on a third-party font CDN.
const FONT_REGULAR_URL = "/fonts/NotoSansKR-Regular.ttf";
const FONT_BOLD_URL = "/fonts/NotoSansKR-Bold.ttf";
const FONT_FAMILY = "NotoSansKR";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_TOP = 24;
const MARGIN_BOTTOM = 24;
const MARGIN_LEFT = 22;
const MARGIN_RIGHT = 22;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const PT_TO_MM = 0.352778;
const IMAGE_BOX_HEIGHT = 55;
// Gap before a section that intentionally flows onto the same page as the one before
// it (Statement after the cover, Press after Exhibitions, Contact after Press) rather
// than forcing a page break — enough breathing room to read as a new section without
// jumping to a fresh page.
const FLOW_SECTION_GAP = 20;
const COL_GAP = 8;
const COL_WIDTH = (CONTENT_WIDTH - COL_GAP) / 2;

export type PortfolioPdfWork = { title: string; year: string; meta: string; tag: string | null; imageUrl: string | null };
export type PortfolioPdfPress = { text: string; url: string | null };
export type PortfolioPdfData = {
  coverLabel: string;
  name: string;
  subtitle: string;
  description: string;
  generatedLabel: string;
  statementHeading: string;
  slides: { heading: string; body: string }[];
  workNotes: { heading: string; body: string }[];
  worksHeading: string;
  works: PortfolioPdfWork[];
  exhibitionsHeading: string;
  currentLabel: string;
  current: string[];
  historyLabel: string;
  history: string[];
  pressHeading: string;
  press: PortfolioPdfPress[];
  contactHeading: string;
  contacts: { label: string; value: string }[];
};

async function fetchFontBase64(url: string): Promise<string> {
  const buf = await fetch(url).then((r) => r.arrayBuffer());
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchImageAsDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    const bitmap = await createImageBitmap(blob);
    // Draw onto an opaque white canvas before exporting as JPEG — WebP thumbnails can
    // carry an alpha channel around the artwork, and flattening straight to JPEG (no
    // alpha support) would otherwise default any transparent pixels to black instead
    // of white, which is what was showing up as a black backdrop around the works.
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return { dataUrl, width: canvas.width, height: canvas.height };
  } catch (err) {
    console.error("[Portfolio PDF] failed to load image:", url, err);
    return null;
  }
}

// Returns the built document rather than saving it directly. Several mobile browsers
// (Chrome included) silently drop a download triggered from deep inside an async chain
// — by the time the multi-second font/image fetch resolves, the click that started it
// is no longer "fresh" enough to count as user-initiated. Building first and letting the
// caller trigger `pdf.save()` from an actual, synchronous click handler avoids that.
export async function buildPortfolioPdf(data: PortfolioPdfData): Promise<jsPDF> {
  const [regularBase64, boldBase64] = await Promise.all([fetchFontBase64(FONT_REGULAR_URL), fetchFontBase64(FONT_BOLD_URL)]);
  const images = await Promise.all(data.works.map((w) => (w.imageUrl ? fetchImageAsDataUrl(w.imageUrl) : Promise.resolve(null))));

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.addFileToVFS("NotoSansKR-Regular.ttf", regularBase64);
  pdf.addFont("NotoSansKR-Regular.ttf", FONT_FAMILY, "normal");
  pdf.addFileToVFS("NotoSansKR-Bold.ttf", boldBase64);
  pdf.addFont("NotoSansKR-Bold.ttf", FONT_FAMILY, "bold");
  pdf.setFont(FONT_FAMILY, "normal");

  let y = MARGIN_TOP;
  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > PAGE_HEIGHT - MARGIN_BOTTOM) {
      pdf.addPage();
      y = MARGIN_TOP;
    }
  };
  const startNewPage = () => {
    if (y > MARGIN_TOP) {
      pdf.addPage();
      y = MARGIN_TOP;
    }
  };
  const wrap = (text: string, maxWidth: number): string[] =>
    text.split("\n").flatMap((line) => (line.trim() ? (pdf.splitTextToSize(line, maxWidth) as string[]) : [""]));

  const paragraph = (text: string, opts: { size: number; bold?: boolean; color?: [number, number, number]; leading?: number; x?: number; maxWidth?: number; link?: string }) => {
    pdf.setFont(FONT_FAMILY, opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size);
    const [r, g, b] = opts.color ?? [0, 0, 0];
    pdf.setTextColor(r, g, b);
    const x = opts.x ?? MARGIN_LEFT;
    const maxWidth = opts.maxWidth ?? CONTENT_WIDTH;
    const lineHeight = opts.size * (opts.leading ?? 1.6) * PT_TO_MM;
    const lines = wrap(text, maxWidth);
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, x, y + lineHeight * 0.72);
      if (opts.link) pdf.link(x, y, maxWidth, lineHeight, { url: opts.link });
      y += lineHeight;
    }
  };

  const sectionHeading = (text: string) => {
    ensureSpace(14);
    paragraph(text.toUpperCase(), { size: 10, bold: true, color: [90, 90, 90] });
    pdf.setDrawColor(210, 210, 210);
    pdf.line(MARGIN_LEFT, y + 1, MARGIN_LEFT + CONTENT_WIDTH, y + 1);
    y += 7;
  };

  // ── cover ──
  paragraph(data.coverLabel, { size: 10, color: [110, 110, 110] });
  y += 2;
  paragraph(data.name, { size: 26, bold: true });
  y += 1;
  paragraph(data.subtitle, { size: 10, color: [110, 110, 110] });
  y += 5;
  paragraph(data.description, { size: 11.5, color: [50, 50, 50], leading: 1.75, maxWidth: 130 });
  y += 10;
  paragraph(data.generatedLabel, { size: 8, color: [160, 160, 160] });

  // ── artist statement (flows straight on from the cover — no forced page —
  //    so the cover doesn't sit alone as a nearly-empty page) ──
  if (data.slides.length > 0 || data.workNotes.length > 0) {
    y += FLOW_SECTION_GAP;
    sectionHeading(data.statementHeading);
    for (const s of data.slides) {
      paragraph(s.heading, { size: 13, bold: true });
      y += 1;
      paragraph(s.body, { size: 10.5, color: [40, 40, 40], leading: 1.7 });
      y += 7;
    }
    for (const n of data.workNotes) {
      paragraph(n.heading, { size: 13, bold: true });
      y += 1;
      paragraph(n.body, { size: 10.5, color: [40, 40, 40], leading: 1.7 });
      y += 7;
    }
  }

  // ── works ──
  if (data.works.length > 0) {
    startNewPage();
    sectionHeading(data.worksHeading);
    for (let i = 0; i < data.works.length; i += 2) {
      // Must capture rowStartY *after* ensureSpace() — if this row triggers a page
      // break, ensureSpace resets y to the new page's top margin, and capturing the
      // stale pre-break y here would corrupt every row's height math for the rest
      // of the section (each subsequent row would think it started far down the
      // previous page, forcing it to break too — which is why only the very first
      // page of works ever rendered more than one row).
      ensureSpace(IMAGE_BOX_HEIGHT); // row always begins together; text below is short enough not to need its own check
      const rowStartY = y;
      const row = [data.works[i], data.works[i + 1]];
      const rowImgs = [images[i], images[i + 1]];
      let maxRowHeight = 0;
      row.forEach((w, col) => {
        if (!w) return;
        const x = MARGIN_LEFT + col * (COL_WIDTH + COL_GAP);
        const imgInfo = rowImgs[col];
        // White fill so the box reads as one continuous card with the artwork photo's
        // own white background. The image is inset by IMAGE_PADDING so it can never
        // reach all the way to the box edge — otherwise a photo whose aspect ratio
        // happens to match the box exactly would cover the border line completely on
        // those sides ("먹히는" — the border getting swallowed by the photo). The
        // border itself is stroked *after* the image (not combined into one "FD" fill+
        // stroke call) so it's always painted on top, with a slightly thicker line for
        // visibility.
        pdf.setFillColor(255, 255, 255);
        pdf.rect(x, y, COL_WIDTH, IMAGE_BOX_HEIGHT, "F");
        if (imgInfo) {
          const IMAGE_PADDING = 3;
          const availW = COL_WIDTH - IMAGE_PADDING * 2;
          const availH = IMAGE_BOX_HEIGHT - IMAGE_PADDING * 2;
          const scale = Math.min(availW / imgInfo.width, availH / imgInfo.height);
          const w2 = imgInfo.width * scale;
          const h2 = imgInfo.height * scale;
          pdf.addImage(imgInfo.dataUrl, x + (COL_WIDTH - w2) / 2, y + (IMAGE_BOX_HEIGHT - h2) / 2, w2, h2);
        }
        pdf.setDrawColor(210, 210, 210);
        pdf.setLineWidth(0.4);
        pdf.rect(x, y, COL_WIDTH, IMAGE_BOX_HEIGHT, "S");
        pdf.setLineWidth(0.2); // restore the default so later section-heading underlines aren't affected
        let textY = y + IMAGE_BOX_HEIGHT + 5;
        pdf.setFont(FONT_FAMILY, "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${w.title} (${w.year})`, x, textY);
        textY += 4.6;
        pdf.setFont(FONT_FAMILY, "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(110, 110, 110);
        pdf.text(w.meta, x, textY);
        textY += 4.2;
        if (w.tag) {
          pdf.setTextColor(150, 150, 150);
          pdf.text(w.tag, x, textY);
          textY += 4.2;
        }
        maxRowHeight = Math.max(maxRowHeight, textY - rowStartY);
      });
      y = rowStartY + Math.max(maxRowHeight, IMAGE_BOX_HEIGHT) + 8;
    }
  }

  // ── exhibitions & awards ──
  if (data.current.length > 0 || data.history.length > 0) {
    startNewPage();
    sectionHeading(data.exhibitionsHeading);
    if (data.current.length > 0) {
      paragraph(data.currentLabel, { size: 9.5, bold: true, color: [110, 110, 110] });
      y += 2;
      for (const line of data.current) paragraph(line, { size: 10, leading: 1.5 });
      y += 6;
    }
    if (data.history.length > 0) {
      paragraph(data.historyLabel, { size: 9.5, bold: true, color: [110, 110, 110] });
      y += 2;
      for (const line of data.history) paragraph(line, { size: 10, leading: 1.5 });
    }
  }

  // ── press (flows straight on from Exhibitions, like Statement does from the
  //    cover, instead of forcing a fresh page — otherwise a short exhibitions
  //    list leaves a large dead gap before press starts on its own page) ──
  if (data.press.length > 0) {
    y += FLOW_SECTION_GAP;
    sectionHeading(data.pressHeading);
    for (const p of data.press) {
      paragraph(p.text, { size: 10, leading: 1.6, color: p.url ? [20, 70, 160] : [0, 0, 0], link: p.url ?? undefined });
    }
  }

  // ── contact ──
  if (data.contacts.length > 0) {
    y += FLOW_SECTION_GAP;
    sectionHeading(data.contactHeading);
    for (const c of data.contacts) paragraph(`${c.label}: ${c.value}`, { size: 10, leading: 1.6 });
  }

  return pdf;
}
