import { Plus, ChevronLeft, ChevronRight, Upload, Trash2 } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";
import { hSize, type Slide } from "../../data";

type ArtistStatementProps = {
  slides: Slide[];
  currentSlide: number;
  setCurrentSlide: (i: number) => void;
  isSliding: boolean;
  addSlide: () => void;
  deleteSlide: (id: number) => void;
  updateSlide: (id: number, f: keyof Slide, v: string) => void;
  goSlide: (dir: 1 | -1) => void;
};

export function ArtistStatement({ slides, currentSlide, setCurrentSlide, isSliding, addSlide, deleteSlide, updateSlide, goSlide }: ArtistStatementProps) {
  const { lang, u, MONO, SERIF, SANS, editMode, img, uploadingTarget, triggerUpload, openLightbox, C } = usePortfolioContext();

  return (
    <section id="statement" className="py-16 sm:py-24 border-t border-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex items-end justify-between mb-8 sm:mb-10">
          <div>
            <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s03label" /></div>
            <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s03heading" /></h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {slides.length > 0 && <div className="hidden sm:flex items-center gap-2 mr-1">{slides.map((s, i) => <button key={s.id} onClick={() => !isSliding && setCurrentSlide(i)} className={`rounded-full transition-all ${i === currentSlide ? "bg-foreground w-5 h-1.5" : "bg-muted-foreground/40 w-1.5 h-1.5 hover:bg-muted-foreground"}`} />)}</div>}
            <button onClick={() => !isSliding && goSlide(-1)} disabled={currentSlide === 0 || !slides.length} className="p-1.5 sm:p-2 border border-border hover:border-foreground/40 text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
            <button onClick={() => !isSliding && goSlide(1)} disabled={currentSlide === slides.length - 1 || !slides.length} className="p-1.5 sm:p-2 border border-border hover:border-foreground/40 text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
            {editMode && <button onClick={addSlide} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors ml-1" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.statAddSlide}</span></button>}
          </div>
        </div>
        {slides.length === 0 ? (
          <div className="flex items-center justify-center h-48 sm:h-64 border border-dashed border-border text-muted-foreground">
            {editMode ? <button onClick={addSlide} className="flex flex-col items-center gap-3 hover:text-foreground transition-colors"><Plus size={28} /><span className="text-xs tracking-widest" style={MONO}>{u.statFirstSlide}</span></button> : <span className="text-xs" style={MONO}>{u.statNone}</span>}
          </div>
        ) : (
          <div className="overflow-hidden">
            <div className="flex" style={{ transform: `translateX(-${currentSlide * 100}%)`, transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)" }}>
              {slides.map((sl) => {
                const imgSrc = img(`slide-${sl.id}`);
                return (
                  <div key={sl.id} className="slide-row w-full shrink-0 flex flex-col md:flex-row border border-border">
                    <div className={`slide-img-area md:w-2/5 shrink-0 flex items-center justify-center bg-card relative ${editMode ? "cursor-pointer" : imgSrc ? "cursor-zoom-in" : ""}`} style={{ minHeight: "280px" }} onClick={() => { if (editMode) { triggerUpload(`slide-${sl.id}`); } else if (imgSrc) { openLightbox(imgSrc, false); } }}>
                      {imgSrc ? <img src={imgSrc} alt={sl.heading} className="w-full h-full object-contain" style={{ maxHeight: "520px" }} loading="lazy" decoding="async" /> : <div className="absolute inset-0 img-placeholder" />}
                      {editMode && <div className="absolute inset-0 flex items-center justify-center bg-background/50 hover:bg-background/65 transition-colors"><div className="flex flex-col items-center gap-2 text-foreground"><Upload size={22} /><span className="text-xs tracking-widest" style={MONO}>{uploadingTarget === `slide-${sl.id}` ? u.statUploading : u.statUpload}</span></div></div>}
                    </div>
                    <div className="slide-text-area flex-1 hide-sb overflow-y-auto" style={{ maxHeight: "520px" }}>
                      <div className="flex flex-col justify-center min-h-full p-8 sm:p-10 lg:p-16">
                        {editMode ? (
                          <>
                            <textarea value={sl.heading} onChange={(e) => updateSlide(sl.id, "heading", e.target.value)} rows={2} className={`bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full font-light text-foreground leading-snug mb-2 ${hSize("text-xl sm:text-2xl lg:text-3xl", "text-2xl sm:text-3xl lg:text-4xl", lang)}`} style={SERIF} />
                            <textarea value={sl.headingEn} onChange={(e) => updateSlide(sl.id, "headingEn", e.target.value)} rows={1} className="bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full text-xs text-accent mb-5" style={MONO} />
                            <textarea value={sl.body} onChange={(e) => updateSlide(sl.id, "body", e.target.value)} rows={5} className="bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full text-sm text-muted-foreground leading-[2] font-light" style={SANS} />
                            <textarea value={sl.bodyEn} onChange={(e) => updateSlide(sl.id, "bodyEn", e.target.value)} rows={3} className="bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full text-xs text-muted-foreground/60 leading-relaxed mt-4" style={MONO} />
                            <button onClick={() => deleteSlide(sl.id)} className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors self-start" style={MONO}><Trash2 size={12} />{u.statDeleteSlide}</button>
                          </>
                        ) : (
                          <>
                            <h3 className={`font-light text-foreground leading-snug mb-3 whitespace-pre-line ${hSize("text-xl sm:text-2xl lg:text-3xl", "text-2xl sm:text-3xl lg:text-4xl", lang)}`} style={SERIF}>{lang === "ko" ? sl.heading : sl.headingEn}</h3>
                            <p className="text-xs text-accent mb-6 sm:mb-8" style={MONO}>{lang === "ko" ? sl.headingEn : sl.heading}</p>
                            <p className="text-sm sm:text-base text-muted-foreground leading-[2] font-light whitespace-pre-wrap" style={SANS}>{lang === "ko" ? sl.body : sl.bodyEn}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {slides.length > 0 && <div className="mt-4 flex justify-end"><span className="text-xs text-muted-foreground" style={MONO}>{currentSlide + 1} / {slides.length}</span></div>}
      </div>
    </section>
  );
}
