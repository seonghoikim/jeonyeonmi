import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import jsPDF from "jspdf";
import { usePortfolioContext } from "../../PortfolioContext";
import { buildPortfolioPdf } from "../../generatePortfolioPdf";
import type { Slide, Artwork, Series, CurrentExhibition, ExhibitionEntry, PressEntry } from "../../data";

type PortfolioPrintViewProps = {
  show: boolean;
  onClose: () => void;
  slides: Slide[];
  artworks: Artwork[];
  seriesList: Series[];
  current: CurrentExhibition[];
  history: ExhibitionEntry[];
  press: PressEntry[];
};

const tagLabel = (tag: ExhibitionEntry["tag"], u: ReturnType<typeof usePortfolioContext>["u"]) =>
  tag === "개인전" ? u.exSolo : tag === "단체전" ? u.exGroup : tag === "아트페어" ? u.exFair : u.exCompetition;

export function PortfolioPrintView({ show, onClose, slides, artworks, seriesList, current, history, press }: PortfolioPrintViewProps) {
  const { lang, u, c, img, contactItems } = usePortfolioContext();
  const [portalEl] = useState(() => document.createElement("div"));
  const [status, setStatus] = useState<"working" | "ready" | "error">("working");
  const pdfRef = useRef<jsPDF | null>(null);
  const filenameRef = useRef("portfolio.pdf");

  // window.print() silently does nothing in several in-app WebViews (Instagram,
  // KakaoTalk, etc.), and a plain a[download] click can *also* go nowhere findable
  // (some mobile browsers save it somewhere the user has no reason to look, with
  // no confirmation at all) if it fires deep inside this async chain — by the time
  // the multi-second font/image fetch resolves, the original tap may no longer
  // count as a fresh user gesture. So this only *builds* the PDF here; saving it
  // always happens later, from handleSave() below, in direct response to an actual
  // click on the button rendered once status is "ready".
  useEffect(() => {
    if (!show) return;
    document.body.appendChild(portalEl);
    let cancelled = false;
    setStatus("working");
    pdfRef.current = null;

    const run = async () => {
      const contacts = contactItems.filter((item) => item.visible);
      const workNotes = artworks.filter((w) => ((lang === "ko" ? w.description : w.descriptionEn || w.description) ?? "").trim());

      try {
        const pdf = await buildPortfolioPdf(
          {
            coverLabel: lang === "ko" ? "포트폴리오" : "PORTFOLIO",
            name: c("heroName"),
            subtitle: c("heroSub"),
            description: c("heroDesc"),
            generatedLabel: `${u.cvGenerated}: ${new Date().toISOString().slice(0, 10)}`,
            statementHeading: c("s03heading"),
            slides: slides.map((s) => ({ heading: lang === "ko" ? s.heading : s.headingEn, body: lang === "ko" ? s.body : s.bodyEn })),
            workNotes: workNotes.map((w) => {
              const title = lang === "ko" ? w.title : (w.titleEn || w.title);
              const note = (lang === "ko" ? w.description : (w.descriptionEn || w.description)) || "";
              return { heading: lang === "ko" ? `${title}의 작가노트` : `${title} — Artist's Note`, body: note };
            }),
            worksHeading: c("s02heading"),
            works: artworks.map((w) => {
              const seriesName = w.series ? (lang === "ko" ? w.series : (seriesList.find((s) => s.name === w.series)?.nameEn ?? w.series)) : null;
              const category = lang === "ko" ? w.category : (w.categoryEn || w.category);
              const tagParts = [category, seriesName].filter(Boolean) as string[];
              return {
                title: lang === "ko" ? w.title : w.titleEn,
                year: w.year,
                meta: `${lang === "ko" ? w.medium : w.mediumEn} · ${w.size}`,
                tag: [tagParts.join(" · "), w.collected ? u.worksCollected : null].filter(Boolean).join("  ·  ") || null,
                imageUrl: img(`artwork-${w.id}`),
              };
            }),
            exhibitionsHeading: c("s04heading"),
            currentLabel: u.cvCurrent,
            current: current.map((ex) => `${ex.startDate} — ${ex.endDate}   ${lang === "ko" ? ex.title : ex.titleEn} — ${lang === "ko" ? ex.venue : ex.venueEn}, ${lang === "ko" ? ex.location : ex.locationEn}`),
            historyLabel: u.cvHistory,
            history: history.map((ex) => {
              const award = ex.award ? ` — ${ex.award}` : "";
              return `${ex.year}   ${lang === "ko" ? ex.title : ex.titleEn} — ${lang === "ko" ? ex.venue : (ex.venueEn || ex.venue)}, ${ex.location}  [${tagLabel(ex.tag, u)}]${award}`;
            }),
            pressHeading: c("s08heading"),
            press: press.map((p) => ({
              text: `${p.date}   ${lang === "ko" ? p.outlet : (p.outletEn || p.outlet)} — ${lang === "ko" ? p.title : p.titleEn}`,
              url: p.url || null,
            })),
            contactHeading: u.cvContact,
            contacts: contacts.map((item) => ({ label: lang === "ko" ? item.labelKo : item.labelEn, value: item.display })),
          }
        );
        if (cancelled) return;
        pdfRef.current = pdf;
        filenameRef.current = `${c("heroName")}_${lang === "ko" ? "포트폴리오" : "portfolio"}.pdf`;
        setStatus("ready");
      } catch (err) {
        console.error("[Portfolio PDF] generation failed:", err);
        if (!cancelled) setStatus("error");
      }
    };
    run();

    return () => {
      cancelled = true;
      if (portalEl.parentNode) document.body.removeChild(portalEl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, portalEl]);

  // Runs only from a direct button click, never automatically — so it's always a
  // fresh, genuine user gesture. Prefers the File System Access API (a real native
  // "save as" dialog letting the user pick the exact location) where the browser
  // supports it; everywhere else, navigates the current tab to the PDF blob so the
  // browser's own PDF viewer takes over — its Share/Save affordance is far more
  // discoverable on mobile than a silent background download nobody can find
  // afterward. This deliberately navigates in place rather than opening a new tab:
  // Safari has a long-standing bug where a blob: URL opened via window.open()/
  // target="_blank" fails silently in the new tab — the same URL loads fine when
  // it's the current document's own navigation instead.
  const handleSave = async () => {
    const pdf = pdfRef.current;
    if (!pdf) return;
    const showSaveFilePicker = (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker;
    if (showSaveFilePicker) {
      try {
        const handle = await showSaveFilePicker({
          suggestedName: filenameRef.current,
          types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(pdf.output("blob"));
        await writable.close();
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return; // user cancelled the picker themselves
        console.error("[Portfolio PDF] showSaveFilePicker failed, falling back to opening the PDF directly:", err);
      }
    }
    window.location.href = String(pdf.output("bloburl"));
  };

  if (!show) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", color: "#000", padding: "24px 28px", maxWidth: 320, textAlign: "center", fontFamily: "sans-serif" }}>
        {status === "working" && <p style={{ fontSize: 13, margin: 0 }}>{u.portfolioPreparing}</p>}
        {status === "error" && (
          <>
            <p style={{ fontSize: 13, margin: "0 0 16px" }}>{u.portfolioError}</p>
            <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, border: "1px solid #999", background: "#fff", color: "#000", padding: "8px 14px", cursor: "pointer" }}>
              <X size={13} />{u.lbClose}
            </button>
          </>
        )}
        {status === "ready" && (
          <>
            <p style={{ fontSize: 13, margin: "0 0 16px" }}>{u.portfolioReady}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={handleSave}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, border: "1px solid #333", background: "#000", color: "#fff", padding: "8px 14px", cursor: "pointer" }}
              >
                <Download size={13} />{u.portfolioDownload}
              </button>
              <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, border: "1px solid #999", background: "#fff", color: "#000", padding: "8px 14px", cursor: "pointer" }}>
                <X size={13} />{u.lbClose}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    portalEl
  );
}
