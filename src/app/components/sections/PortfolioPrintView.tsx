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
  // KakaoTalk, etc.). A direct Blob download works far more broadly, but several
  // mobile browsers (Chrome included) will still silently drop it if it fires deep
  // inside this async chain — by the time the multi-second font/image fetch
  // resolves, the original tap no longer counts as a fresh user gesture. So this
  // only *builds* the PDF here, attempts one best-effort auto-download, and always
  // leaves a real button behind so the user has a guaranteed, freshly-clicked way
  // to trigger the save if the automatic one didn't go through.
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
        try { pdf.save(filenameRef.current); } catch { /* fall through to the manual button below */ }
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
                onClick={() => pdfRef.current?.save(filenameRef.current)}
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
