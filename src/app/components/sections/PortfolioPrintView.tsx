import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";
import { generatePortfolioPdf } from "../../generatePortfolioPdf";
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

const CAPTURE_WIDTH = 800;

const tagLabel = (tag: ExhibitionEntry["tag"], u: ReturnType<typeof usePortfolioContext>["u"]) =>
  tag === "개인전" ? u.exSolo : tag === "단체전" ? u.exGroup : tag === "아트페어" ? u.exFair : u.exCompetition;

export function PortfolioPrintView({ show, onClose, slides, artworks, seriesList, current, history, press }: PortfolioPrintViewProps) {
  const { lang, u, c, img, contactItems } = usePortfolioContext();
  const [portalEl] = useState(() => document.createElement("div"));
  const [status, setStatus] = useState<"working" | "error">("working");
  const captureRef = useRef<HTMLDivElement>(null);
  const contacts = contactItems.filter((item) => item.visible);

  // window.print() silently does nothing in several in-app WebViews (Instagram,
  // KakaoTalk, etc.) with no error and no way to detect the failure — so this
  // renders the document off-screen and rasterizes + downloads it directly
  // instead of relying on the OS print dialog at all. See generatePortfolioPdf.ts
  // for the capture/pagination/link-annotation logic.
  useEffect(() => {
    if (!show) return;
    document.body.appendChild(portalEl);
    let cancelled = false;
    setStatus("working");

    const run = async () => {
      // let the off-screen content mount before measuring/capturing it
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled || !captureRef.current) return;
      try {
        const filename = `${c("heroName")}_${lang === "ko" ? "포트폴리오" : "portfolio"}.pdf`;
        await generatePortfolioPdf(captureRef.current, filename);
        if (!cancelled) onClose();
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

  const sectionHeading: React.CSSProperties = { fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#000", borderBottom: "1px solid #ccc", paddingBottom: 6, marginBottom: 16 };
  // Per-artwork descriptions read as an artist's note on the specific piece, so
  // they're appended after the general statement instead of cluttering the
  // works list — templated as "<title>의 작가노트" per the requested format.
  const workNotes = artworks.filter((w) => (lang === "ko" ? w.description : w.descriptionEn || w.description)?.trim());

  return createPortal(
    <>
      {/* ── on-screen status overlay ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", color: "#000", padding: "24px 28px", maxWidth: 320, textAlign: "center", fontFamily: "sans-serif" }}>
          {status === "working" ? (
            <p style={{ fontSize: 13, margin: 0 }}>{u.portfolioPreparing}</p>
          ) : (
            <>
              <p style={{ fontSize: 13, margin: "0 0 16px" }}>{u.portfolioError}</p>
              <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, border: "1px solid #999", background: "#fff", color: "#000", padding: "8px 14px", cursor: "pointer" }}>
                <X size={13} />{u.lbClose}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── off-screen capture target — never shown to the visitor, only rasterized ── */}
      <div ref={captureRef} style={{ position: "fixed", top: 0, left: -99999, width: CAPTURE_WIDTH, background: "#fff", color: "#000" }}>
        {/* ── cover ── */}
        <div style={{ padding: "64px 32px 24px" }}>
          <p style={{ fontSize: 12, letterSpacing: "0.25em", textTransform: "uppercase", color: "#666", marginBottom: 8 }}>{lang === "ko" ? "포트폴리오" : "PORTFOLIO"}</p>
          <h1 style={{ fontSize: 40, fontWeight: 400, margin: 0 }}>{c("heroName")}</h1>
          <p style={{ fontSize: 13, letterSpacing: "0.1em", color: "#666", marginTop: 6, textTransform: "uppercase" }}>{c("heroSub")}</p>
          <p style={{ fontSize: 14, color: "#333", maxWidth: 420, lineHeight: 1.7, marginTop: 24 }}>{c("heroDesc")}</p>
          <p style={{ fontSize: 10, color: "#999", marginTop: 32 }}>{u.cvGenerated}: {new Date().toISOString().slice(0, 10)}</p>
        </div>

        {/* ── artist statement (cover flows straight into it — no forced page —
             so the cover isn't left mostly empty on its own) ── */}
        {(slides.length > 0 || workNotes.length > 0) && (
          <div style={{ padding: "24px 32px 48px" }}>
            <h2 style={sectionHeading}>{c("s03heading")}</h2>
            {slides.map((s) => (
              <div key={s.id} data-pdf-atom="" style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 8px", whiteSpace: "pre-line" }}>{lang === "ko" ? s.heading : s.headingEn}</h3>
                <p style={{ fontSize: 13, color: "#333", lineHeight: 1.8, margin: 0 }}>{lang === "ko" ? s.body : s.bodyEn}</p>
              </div>
            ))}
            {workNotes.map((w) => {
              const title = lang === "ko" ? w.title : (w.titleEn || w.title);
              const note = (lang === "ko" ? w.description : (w.descriptionEn || w.description)) || "";
              return (
                <div key={w.id} data-pdf-atom="" style={{ marginBottom: 28 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 8px" }}>{lang === "ko" ? `${title}의 작가노트` : `${title} — Artist's Note`}</h3>
                  <p style={{ fontSize: 13, color: "#333", lineHeight: 1.8, margin: 0 }}>{note}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── works ── */}
        {artworks.length > 0 && (
          <div data-pdf-section="works" style={{ padding: "48px 32px" }}>
            <h2 style={sectionHeading}>{c("s02heading")}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px 24px" }}>
              {artworks.map((w) => {
                const imageUrl = img(`artwork-${w.id}`);
                const seriesName = w.series ? (lang === "ko" ? w.series : (seriesList.find((s) => s.name === w.series)?.nameEn ?? w.series)) : null;
                const category = lang === "ko" ? w.category : (w.categoryEn || w.category);
                return (
                  <div key={w.id} data-pdf-atom="">
                    <div style={{ width: "100%", aspectRatio: "4 / 5", background: "#f0f0f0", overflow: "hidden", marginBottom: 8 }}>
                      {imageUrl && <img src={imageUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 2px" }}>{lang === "ko" ? w.title : w.titleEn} <span style={{ fontSize: 11, color: "#666", fontWeight: 400 }}>({w.year})</span></p>
                    <p style={{ fontSize: 11, color: "#666", margin: 0 }}>{lang === "ko" ? w.medium : w.mediumEn} · {w.size}</p>
                    {(category || seriesName) && (
                      <p style={{ fontSize: 11, color: "#999", margin: "2px 0 0" }}>{[category, seriesName].filter(Boolean).join(" · ")}</p>
                    )}
                    {w.collected && <p style={{ fontSize: 11, color: "#999", margin: "2px 0 0" }}>{u.worksCollected}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── exhibitions & awards ── */}
        {(current.length > 0 || history.length > 0) && (
          <div data-pdf-section="exhibitions" style={{ padding: "48px 32px" }}>
            <h2 style={sectionHeading}>{c("s04heading")}</h2>
            {current.length > 0 && (
              <section style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", marginBottom: 10 }}>{u.cvCurrent}</h3>
                {current.map((ex) => (
                  <p key={ex.id} data-pdf-atom="" style={{ fontSize: 13, margin: "4px 0", lineHeight: 1.5 }}>
                    <span style={{ color: "#000" }}>{ex.startDate} — {ex.endDate}  </span>
                    {lang === "ko" ? ex.title : ex.titleEn}
                    <span style={{ color: "#000" }}> — {lang === "ko" ? ex.venue : ex.venueEn}, {lang === "ko" ? ex.location : ex.locationEn}</span>
                  </p>
                ))}
              </section>
            )}
            {history.length > 0 && (
              <section>
                <h3 style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", marginBottom: 10 }}>{u.cvHistory}</h3>
                {history.map((ex) => (
                  <p key={ex.id} data-pdf-atom="" style={{ fontSize: 13, margin: "4px 0", lineHeight: 1.5 }}>
                    <span style={{ color: "#000" }}>{ex.year}  </span>
                    {lang === "ko" ? ex.title : ex.titleEn}
                    <span style={{ color: "#000" }}> — {lang === "ko" ? ex.venue : (ex.venueEn || ex.venue)}, {ex.location}  [{tagLabel(ex.tag, u)}]</span>
                    {ex.award && <span style={{ color: "#000" }}> — {ex.award}</span>}
                  </p>
                ))}
              </section>
            )}
          </div>
        )}

        {/* ── press ── */}
        {press.length > 0 && (
          <div data-pdf-section="press" style={{ padding: "48px 32px" }}>
            <h2 style={sectionHeading}>{c("s08heading")}</h2>
            {press.map((p) => {
              const label = (
                <>
                  <span style={{ color: "#666" }}>{p.date}  </span>
                  {lang === "ko" ? p.outlet : (p.outletEn || p.outlet)}
                  {" — "}{lang === "ko" ? p.title : p.titleEn}
                </>
              );
              return p.url ? (
                <a key={p.id} href={p.url} data-pdf-atom="" style={{ display: "block", fontSize: 13, margin: "6px 0", lineHeight: 1.5, color: "#000", textDecoration: "underline" }}>
                  {label}
                </a>
              ) : (
                <p key={p.id} data-pdf-atom="" style={{ fontSize: 13, margin: "6px 0", lineHeight: 1.5 }}>{label}</p>
              );
            })}
          </div>
        )}

        {/* ── contact ── */}
        {contacts.length > 0 && (
          <div style={{ padding: "48px 32px 64px" }}>
            <h2 style={sectionHeading}>{u.cvContact}</h2>
            {contacts.map((item) => (
              <p key={item.id} data-pdf-atom="" style={{ fontSize: 13, margin: "4px 0" }}>
                <span style={{ color: "#000" }}>{lang === "ko" ? item.labelKo : item.labelEn}: </span>{item.display}
              </p>
            ))}
          </div>
        )}
      </div>
    </>,
    portalEl
  );
}
