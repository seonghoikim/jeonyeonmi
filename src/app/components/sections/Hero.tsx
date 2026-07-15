import { ArrowUpRight, Upload, Check, Edit3 } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";

type HeroProps = {
  heroAspectRatio: number | null;
  heroCaption: string;
  heroCaptionEn: string;
  setHeroCaption: (v: string) => void;
  setHeroCaptionEn: (v: string) => void;
  editingCaption: boolean;
  setEditingCaption: (v: boolean) => void;
};

export function Hero({ heroAspectRatio, heroCaption, heroCaptionEn, setHeroCaption, setHeroCaptionEn, editingCaption, setEditingCaption }: HeroProps) {
  const { lang, u, MONO, SERIF, SANS, content, updateContent, c, editMode, img, uploadingTarget, triggerUpload, scrollTo } = usePortfolioContext();

  return (
    <section id="hero" className="hero-section min-h-screen flex flex-col md:flex-row" style={{ paddingTop: 0 }}>
      <div className="hero-panel flex flex-col justify-end px-6 lg:px-12 pb-12 sm:pb-16 pt-16 md:pt-0 shrink-0 order-2 md:order-1"
        style={{ flex: heroAspectRatio ? `0 0 ${Math.max(28, Math.min(48, Math.round(100 / (1 + heroAspectRatio * 1.4))))}%` : "0 0 42%", transition: "flex-basis 0.6s cubic-bezier(0.4,0,0.2,1)" }}>
        <span className="text-xs tracking-[0.25em] text-accent uppercase mb-3" style={MONO}>
          {editMode ? (
            <div className="flex flex-col gap-1">
              <input value={content.heroSub} onChange={(e) => updateContent("heroSub", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 outline-none text-accent w-full text-xs tracking-[0.25em]" style={MONO} placeholder="KO" />
              <input value={content.heroSubEn} onChange={(e) => updateContent("heroSubEn", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 outline-none text-accent/60 w-full text-xs tracking-[0.25em]" style={MONO} placeholder="EN" />
            </div>
          ) : (lang === "ko" ? content.heroSub : content.heroSubEn)}
        </span>
        <h1 className="font-light text-foreground leading-none mb-6 whitespace-nowrap"
          style={{ ...SERIF, fontSize: lang === "en" ? "clamp(1.8rem, 5.5vw, 5rem)" : "clamp(2.5rem, 10vw, 7rem)", letterSpacing: lang === "en" ? "0.06em" : "0.01em" }}>
          {editMode
            ? <input value={lang === "ko" ? content.heroName : content.heroNameEn} onChange={(e) => updateContent(lang === "ko" ? "heroName" : "heroNameEn", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 outline-none w-full" style={{ ...SERIF, letterSpacing: lang === "en" ? "0.01em" : "-0.02em" }} />
            : c("heroName")}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xs font-light mb-10" style={SANS}>
          {editMode
            ? <textarea value={lang === "ko" ? content.heroDesc : content.heroDescEn} onChange={(e) => updateContent(lang === "ko" ? "heroDesc" : "heroDescEn", e.target.value)} rows={3} className="bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full text-base text-muted-foreground leading-relaxed" style={SANS} />
            : c("heroDesc")}
        </p>
        <div className="flex items-center gap-3">
          <button onClick={() => scrollTo("statement")} className="flex items-center gap-2 text-xs tracking-widest text-foreground border border-border px-5 py-3 hover:border-accent hover:text-accent transition-all w-fit" style={MONO}>
            {u.navStatement}
          </button>
          <button onClick={() => scrollTo("works")} className="flex items-center gap-2 text-xs tracking-widest text-foreground border border-border px-5 py-3 hover:border-accent hover:text-accent transition-all w-fit" style={MONO}>
            {c("heroCta")} <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
      <div className={`hero-image relative min-h-[50vh] md:min-h-screen bg-card overflow-hidden flex-1 order-1 md:order-2 ${editMode && !editingCaption ? "cursor-pointer" : ""}`}
        style={{ transition: "flex 0.6s cubic-bezier(0.4,0,0.2,1)" }}
        onClick={() => { if (editMode && !editingCaption) triggerUpload("hero", heroCaptionEn); }}>
        {img("hero")
          ? <img src={img("hero")!} alt={`${c("heroName")} — ${lang === "ko" ? heroCaption : heroCaptionEn}`} className="absolute inset-0 w-full h-full object-cover opacity-70 hover:opacity-80 transition-opacity duration-700" />
          : <div className="absolute inset-0 img-placeholder" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
        {editMode && !editingCaption && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 hover:bg-background/60 transition-colors">
            <div className="flex flex-col items-center gap-2 text-foreground"><Upload size={28} /><span className="text-xs tracking-widest" style={MONO}>{uploadingTarget === "hero" ? u.worksUploading : u.worksUpload}</span></div>
          </div>
        )}
        <div className="absolute bottom-6 right-6" onClick={(e) => e.stopPropagation()}>
          {editMode && editingCaption ? (
            <div className="flex flex-col gap-1 items-end">
              <input value={heroCaption} onChange={(e) => setHeroCaption(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setEditingCaption(false)} className="bg-background/80 border border-accent text-foreground text-xs tracking-widest px-2 py-1 outline-none w-52 text-right" style={MONO} placeholder="KO" autoFocus />
              <input value={heroCaptionEn} onChange={(e) => setHeroCaptionEn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setEditingCaption(false)} className="bg-background/80 border border-accent/60 text-muted-foreground text-xs tracking-widest px-2 py-1 outline-none w-52 text-right" style={MONO} placeholder="EN" />
              <button onClick={() => setEditingCaption(false)} className="text-xs text-accent/60 hover:text-accent mt-0.5" style={MONO}><Check size={11} className="inline" /> 완료</button>
            </div>
          ) : (
            <button onClick={() => editMode && setEditingCaption(true)} className={`text-xs tracking-widest text-muted-foreground block transition-all ${editMode ? "border-b border-dashed border-accent/50 hover:text-accent pb-0.5" : ""}`} style={MONO}>
              {lang === "ko" ? heroCaption : heroCaptionEn}{editMode && <Edit3 size={10} className="inline ml-1 opacity-60" />}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
