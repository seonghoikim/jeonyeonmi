import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Printer } from "lucide-react";
import { UI } from "../../data";
import type { Lang, ContactItem, CurrentExhibition, ExhibitionEntry } from "../../data";

type CvPrintViewProps = {
  show: boolean;
  onClose: () => void;
  lang: Lang;
  u: (typeof UI)[Lang];
  name: string;
  contacts: ContactItem[];
  current: CurrentExhibition[];
  history: ExhibitionEntry[];
};

const tagLabel = (tag: ExhibitionEntry["tag"], u: (typeof UI)[Lang]) =>
  tag === "전시" ? u.exExhibition : tag === "아트페어" ? u.exFair : u.exAward;

export function CvPrintView({ show, onClose, lang, u, name, contacts, current, history }: CvPrintViewProps) {
  const [portalEl] = useState(() => document.createElement("div"));

  useEffect(() => {
    if (!show) return;
    document.body.appendChild(portalEl);
    const timer = setTimeout(() => window.print(), 150);
    const onAfterPrint = () => onClose();
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
      if (portalEl.parentNode) document.body.removeChild(portalEl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, portalEl]);

  if (!show) return null;

  return createPortal(
    <div style={{ background: "#fff", color: "#1a1a1a", minHeight: "100vh" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 16, background: "#f2f2f2", position: "sticky", top: 0 }}>
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, letterSpacing: "0.05em", border: "1px solid #999", background: "#fff", color: "#1a1a1a", padding: "8px 14px", cursor: "pointer" }}>
          <Printer size={13} />{u.cvPrint}
        </button>
        <button onClick={onClose} aria-label={u.lbClose} style={{ border: "1px solid #999", background: "#fff", color: "#1a1a1a", padding: "8px 10px", cursor: "pointer" }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 32px 64px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, margin: 0 }}>{name}</h1>
        <p style={{ fontSize: 13, letterSpacing: "0.1em", color: "#666", marginTop: 4, textTransform: "uppercase" }}>{u.cvTitle}</p>

        {contacts.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#888", borderBottom: "1px solid #ccc", paddingBottom: 6, marginBottom: 10 }}>{u.cvContact}</h2>
            {contacts.map((item) => (
              <p key={item.id} style={{ fontSize: 13, margin: "2px 0" }}>
                <span style={{ color: "#888" }}>{lang === "ko" ? item.labelKo : item.labelEn}: </span>{item.display}
              </p>
            ))}
          </section>
        )}

        {current.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#888", borderBottom: "1px solid #ccc", paddingBottom: 6, marginBottom: 10 }}>{u.cvCurrent}</h2>
            {current.map((ex) => (
              <p key={ex.id} style={{ fontSize: 13, margin: "4px 0", lineHeight: 1.5 }}>
                <span style={{ color: "#888" }}>{ex.startDate} — {ex.endDate}  </span>
                {lang === "ko" ? ex.title : ex.titleEn}
                <span style={{ color: "#888" }}> — {lang === "ko" ? ex.venue : ex.venueEn}, {lang === "ko" ? ex.location : ex.locationEn}</span>
              </p>
            ))}
          </section>
        )}

        {history.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#888", borderBottom: "1px solid #ccc", paddingBottom: 6, marginBottom: 10 }}>{u.cvHistory}</h2>
            {history.map((ex) => (
              <p key={ex.id} style={{ fontSize: 13, margin: "4px 0", lineHeight: 1.5 }}>
                <span style={{ color: "#888" }}>{ex.year}  </span>
                {lang === "ko" ? ex.title : ex.titleEn}
                <span style={{ color: "#888" }}> — {lang === "ko" ? ex.venue : (ex.venueEn || ex.venue)}, {ex.location}  [{tagLabel(ex.tag, u)}]</span>
              </p>
            ))}
          </section>
        )}

        <p style={{ fontSize: 10, color: "#aaa", marginTop: 48 }}>{u.cvGenerated}: {new Date().toISOString().slice(0, 10)}</p>
      </div>
    </div>,
    portalEl
  );
}
