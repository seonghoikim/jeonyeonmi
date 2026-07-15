import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Printer } from "lucide-react";
import type { DeckSlice } from "../../generatePortfolioDeck";
import type { UI } from "../../data";

type Lang = "ko" | "en";

type PortfolioDeckPrintViewProps = {
  slices: DeckSlice[] | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  lang: Lang;
  u: (typeof UI)[Lang];
};

export function PortfolioDeckPrintView({ slices, loading, error, onClose, lang, u }: PortfolioDeckPrintViewProps) {
  const [portalEl] = useState(() => document.createElement("div"));
  const show = loading || !!error || (!!slices && slices.length > 0);

  useEffect(() => {
    if (!show) return;
    document.body.appendChild(portalEl);
    return () => { if (portalEl.parentNode) document.body.removeChild(portalEl); };
  }, [show, portalEl]);

  useEffect(() => {
    if (!slices || slices.length === 0) return;
    const timer = setTimeout(() => window.print(), 300);
    const onAfterPrint = () => onClose();
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slices]);

  if (!show) return null;

  return createPortal(
    <div className="portfolio-deck-print" style={{ background: "#0a0a0a", color: "#fff", minHeight: "100vh" }}>
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: 16, background: "#141414", position: "sticky", top: 0, zIndex: 1 }}>
        {slices && slices.length > 0 && (
          <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, letterSpacing: "0.05em", border: "1px solid #666", background: "transparent", color: "#fff", padding: "8px 14px", cursor: "pointer" }}>
            <Printer size={13} />{u.cvPrint}
          </button>
        )}
        <button onClick={onClose} aria-label={u.lbClose} style={{ border: "1px solid #666", background: "transparent", color: "#fff", padding: "8px 10px", cursor: "pointer" }}>
          <X size={14} />
        </button>
      </div>

      {loading && <p className="no-print" style={{ padding: "80px 24px", textAlign: "center", fontSize: 13, color: "#aaa" }}>{u.deckGenerating}</p>}
      {error && <p className="no-print" style={{ padding: "80px 24px", textAlign: "center", fontSize: 13, color: "#f77" }}>{error}</p>}

      {slices?.map((s, i) => (
        <div key={i} style={{ width: "100%", breakAfter: i < slices.length - 1 ? "page" : "auto", breakInside: "avoid" }}>
          <img src={s.dataUrl} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
        </div>
      ))}
    </div>,
    portalEl
  );
}
