import { useState, useRef } from "react";
import { Plus, GripVertical, ArrowUpRight, Trash2, Edit3, Check, Upload, Maximize2, X, AlignLeft } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";
import { moveItem, moveInFiltered, hSize, type Artwork, type Series } from "../../data";
import { useModalLock } from "../../useModalLock";
import { ReorderButtons } from "../ReorderButtons";
import { contactIcon } from "./Contact";

type WorksProps = {
  artworkList: Artwork[];
  setArtworkList: React.Dispatch<React.SetStateAction<Artwork[]>>;
  selectedWorkId: number | null;
  setSelectedWorkId: (id: number | null) => void;
  seriesList: Series[];
  setSeriesList: React.Dispatch<React.SetStateAction<Series[]>>;
  selectedSeries: string;
  setSelectedSeries: (name: string) => void;
  editingSeriesId: number | null;
  setEditingSeriesId: (id: number | null) => void;
  filteredWorks: Artwork[];
  addArtwork: () => void;
  deleteWork: (id: number) => void;
  updateWork: (id: number, f: keyof Artwork, v: string | boolean) => void;
  addSeries: () => void;
  updateSeries: (id: number, f: keyof Series, v: string) => void;
  deleteSeries: (id: number) => void;
};

export function Works({
  artworkList, setArtworkList, selectedWorkId, setSelectedWorkId, seriesList, setSeriesList,
  selectedSeries, setSelectedSeries, editingSeriesId, setEditingSeriesId, filteredWorks,
  addArtwork, deleteWork, updateWork, addSeries, updateSeries, deleteSeries,
}: WorksProps) {
  const { lang, u, MONO, SERIF, editMode, img, uploadingTarget, dragSrc, dragOverKey, setDragOverKey, triggerUpload, openLightbox, contactItems, C } = usePortfolioContext();
  const selectedWork = artworkList.find((w) => w.id === selectedWorkId) ?? null;
  const modalRef = useModalLock<HTMLDivElement>(!!selectedWork, () => setSelectedWorkId(null));
  const [showInquiry, setShowInquiry] = useState(false);
  const inquiryRef = useModalLock<HTMLDivElement>(showInquiry, () => setShowInquiry(false));
  const visibleContacts = contactItems.filter((item) => item.visible);

  // Mobile: swipe left/right inside the artwork modal to jump straight to the
  // next/previous work's popup, within whatever series filter is currently active.
  const modalTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleModalTouchStart = (e: React.TouchEvent) => {
    modalTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleModalTouchEnd = (e: React.TouchEvent) => {
    const start = modalTouchStartRef.current;
    modalTouchStartRef.current = null;
    // Disabled in edit mode — a horizontal drag there is more likely selecting text
    // inside a field than a navigation gesture.
    if (!start || editMode) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = filteredWorks.findIndex((w) => w.id === selectedWorkId);
    if (idx === -1) return;
    const nextIdx = idx + (dx < 0 ? 1 : -1);
    if (nextIdx < 0 || nextIdx >= filteredWorks.length) return;
    setSelectedWorkId(filteredWorks[nextIdx].id);
  };

  return (
    <>
      {/* ── WORKS ── */}
      <section id="works" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 sm:mb-16 gap-6">
          <div>
            <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s02label" /></div>
            <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl lg:text-5xl", "text-4xl sm:text-5xl lg:text-6xl", lang)}`} style={SERIF}><C field="s02heading" /></h2>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setSelectedSeries("전체")}
              className={`text-xs tracking-wider px-3 sm:px-4 py-2 border transition-all ${selectedSeries === "전체" ? "border-accent text-accent" : "border-border text-muted-foreground hover:border-foreground/40"}`}
              style={MONO}>{u.worksAll}</button>
            {seriesList.map((s, idx) => {
              const name = lang === "ko" ? s.name : s.nameEn;
              const isActive = selectedSeries === s.name;
              const isEditingThis = editMode && editingSeriesId === s.id;
              return (
                <div key={s.id} className="relative flex items-center group/series"
                  draggable={editMode}
                  onDragStart={() => { dragSrc.current = idx; }}
                  onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("ser-" + idx); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragSrc.current !== null && dragSrc.current !== idx) {
                      setSeriesList(prev => moveItem(prev, dragSrc.current!, idx));
                    }
                    dragSrc.current = null; setDragOverKey(null);
                  }}
                  onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                  style={{ outline: dragOverKey === "ser-" + idx ? "2px solid var(--accent)" : "none" }}>
                  {isEditingThis ? (
                    <div className="flex items-center gap-1 border border-accent px-2 py-1">
                      <input value={s.name} onChange={(e) => updateSeries(s.id, "name", e.target.value)} className="bg-transparent text-xs text-accent outline-none w-16 sm:w-20" style={MONO} autoFocus />
                      <span className="text-muted-foreground/40 text-xs">/</span>
                      <input value={s.nameEn} onChange={(e) => updateSeries(s.id, "nameEn", e.target.value)} className="bg-transparent text-xs text-muted-foreground outline-none w-16 sm:w-20" style={MONO} />
                      <button onClick={() => setEditingSeriesId(null)} className="ml-1 text-accent"><Check size={11} /></button>
                      <button onClick={() => deleteSeries(s.id)} className="text-muted-foreground hover:text-red-400"><Trash2 size={11} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setSelectedSeries(s.name)} className={`text-xs tracking-wider px-3 sm:px-4 py-2 border transition-all ${isActive ? "border-accent text-accent" : "border-border text-muted-foreground hover:border-foreground/40"}`} style={MONO}>{name}</button>
                  )}
                  {editMode && !isEditingThis && <button onClick={() => setEditingSeriesId(s.id)} className="absolute -top-2 -right-2 bg-background border border-border text-muted-foreground hover:text-foreground p-0.5 opacity-0 group-hover/series:opacity-100 transition-opacity"><Edit3 size={9} /></button>}
                  {editMode && !isEditingThis && (
                    <ReorderButtons
                      className="absolute -top-2 -left-2 bg-background border border-border opacity-0 group-hover/series:opacity-100 transition-opacity"
                      onMoveUp={() => setSeriesList((prev) => moveItem(prev, idx, idx - 1))}
                      onMoveDown={() => setSeriesList((prev) => moveItem(prev, idx, idx + 1))}
                      disableUp={idx === 0}
                      disableDown={idx === seriesList.length - 1}
                    />
                  )}
                </div>
              );
            })}
            {editMode && <button onClick={addSeries} className="flex items-center gap-1 text-xs border border-dashed border-accent/40 text-accent/70 px-3 py-2 hover:border-accent hover:text-accent transition-colors" style={MONO}><Plus size={11} /><span className="hidden sm:inline">{u.seriesAdd}</span></button>}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-background">
          {filteredWorks.map((work, idx) => (
            <div key={work.id}
              className="group bg-background flex flex-col cursor-pointer border-r border-b border-border/30"
              draggable={editMode}
              onDragStart={() => { dragSrc.current = idx; }}
              onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("work-" + idx); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragSrc.current !== null && dragSrc.current !== idx) {
                  setArtworkList(prev => {
                    const filtered = selectedSeries === "전체" ? prev : prev.filter(w => w.series === selectedSeries);
                    const full = [...prev];
                    const fromId = filtered[dragSrc.current!].id;
                    const toId = filtered[idx].id;
                    const fromFullIdx = full.findIndex(w => w.id === fromId);
                    const toFullIdx = full.findIndex(w => w.id === toId);
                    return moveItem(full, fromFullIdx, toFullIdx);
                  });
                }
                dragSrc.current = null; setDragOverKey(null);
              }}
              onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
              style={{ outline: dragOverKey === "work-" + idx ? "2px solid var(--accent)" : "none" }}
              onClick={() => setSelectedWorkId(work.id)}>
              <div className="relative aspect-[4/5] overflow-hidden bg-background shrink-0">
                {editMode && <div className="absolute top-1.5 left-1.5 z-10 text-accent/60 cursor-grab"><GripVertical size={14} /></div>}
                {editMode && (
                  <ReorderButtons
                    className="absolute top-1.5 right-1.5 z-10 bg-background/70"
                    onMoveUp={() => setArtworkList((prev) => moveInFiltered(prev, filteredWorks, idx, -1))}
                    onMoveDown={() => setArtworkList((prev) => moveInFiltered(prev, filteredWorks, idx, 1))}
                    disableUp={idx === 0}
                    disableDown={idx === filteredWorks.length - 1}
                  />
                )}
                {img(`artwork-${work.id}`) ? <img src={img(`artwork-${work.id}`)!} alt={work.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" decoding="async" /> : <div className="w-full h-full img-placeholder" />}
                <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-all duration-500" />
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowUpRight size={16} className="text-foreground" /></div>
                {editMode && <button onClick={(e) => { e.stopPropagation(); deleteWork(work.id); }} className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 bg-background/80 hover:bg-background text-foreground p-1.5 transition-all"><Trash2 size={13} /></button>}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                  {work.series && (() => { const s = seriesList.find((s) => s.name === work.series); const label = lang === "ko" ? work.series : (s?.nameEn ?? work.series); return <span className="text-xs px-2 py-0.5 bg-background/70 text-muted-foreground" style={MONO}>{label}</span>; })()}
                  {work.collected && <span className="text-xs px-2 py-0.5 bg-accent/90 text-accent-foreground ml-auto" style={MONO}>{u.worksCollected}</span>}
                </div>
              </div>
              <div className="p-3 sm:p-5 flex flex-col gap-1">
                <div className="flex justify-between items-baseline gap-2">
                  <h3 className="text-xs sm:text-sm font-light text-foreground line-clamp-1 flex-1 flex items-center gap-1.5" style={SERIF}>
                    {lang === "ko" ? work.title : work.titleEn}
                    {(work.description || work.descriptionEn) && <AlignLeft size={11} className="text-accent/85 shrink-0" title={u.fieldDescription} />}
                  </h3>
                  <span className="text-xs text-accent shrink-0" style={MONO}>{work.year}</span>
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block" style={MONO}>{lang === "ko" ? work.medium : work.mediumEn}</p>
              </div>
            </div>
          ))}
          {editMode && <button onClick={addArtwork} className="group aspect-[4/5] bg-background border border-dashed border-border hover:border-accent transition-colors flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-accent"><Plus size={24} /><span className="text-xs tracking-widest" style={MONO}>{u.worksAdd}</span></button>}
        </div>
      </section>

      {/* ── ARTWORK MODAL ── */}
      {selectedWork && (
        <div ref={modalRef} tabIndex={-1} className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 lg:p-8 outline-none" onClick={() => setSelectedWorkId(null)} onTouchStart={handleModalTouchStart} onTouchEnd={handleModalTouchEnd}>
          <div className="relative max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-card max-h-[95dvh] overflow-y-auto hide-sb" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-3 right-3 z-10 bg-card/80 text-muted-foreground hover:text-foreground p-1.5 transition-colors" onClick={() => setSelectedWorkId(null)}><X size={18} /></button>
            {/* image panel */}
            <div className={`relative bg-background overflow-hidden flex items-center justify-center ${editMode ? "cursor-pointer" : ""}`} style={{ minHeight: "260px", maxHeight: "min(60vh, 560px)" }} onClick={() => editMode && triggerUpload(`artwork-${selectedWork.id}`, selectedWork.titleEn)}>
              {img(`artwork-${selectedWork.id}`) || selectedWork.image
                ? <img src={img(`artwork-${selectedWork.id}`)!} alt={selectedWork.title} className="w-full h-full object-contain" style={{ maxHeight: "min(60vh, 560px)" }} decoding="async" />
                : <div className="w-full img-placeholder" style={{ minHeight: "260px" }} />}
              {editMode && <div className="absolute inset-0 flex items-center justify-center bg-background/50 hover:bg-background/65 transition-colors"><div className="flex flex-col items-center gap-2 text-foreground"><Upload size={22} /><span className="text-xs tracking-widest" style={MONO}>{uploadingTarget === `artwork-${selectedWork.id}` ? u.worksUploading : u.worksUpload}</span></div></div>}
              {!editMode && (img(`artwork-${selectedWork.id}`) || selectedWork.image) && (
                <button
                  onClick={(e) => { e.stopPropagation(); openLightbox(img(`artwork-${selectedWork.id}`) ?? selectedWork.image); }}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-background/80 hover:bg-background border border-border/60 hover:border-foreground/40 text-muted-foreground hover:text-foreground text-xs px-2.5 py-1.5 transition-all"
                  style={MONO}>
                  <Maximize2 size={12} />{u.worksViewOriginal}
                </button>
              )}
            </div>
            {/* info panel */}
            <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-between md:overflow-y-auto md:max-h-[95dvh] hide-sb">
              <div>
                <div className="mb-6 sm:mb-8 pr-8">
                  {editMode ? (
                    <><input value={selectedWork.title} onChange={(e) => updateWork(selectedWork.id, "title", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-lg sm:text-xl font-light text-foreground leading-snug mb-1 outline-none" style={SERIF} /><input value={selectedWork.titleEn} onChange={(e) => updateWork(selectedWork.id, "titleEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-accent mt-2 outline-none" style={MONO} /></>
                  ) : (
                    <><h3 className={`font-light text-foreground mb-1 ${hSize("text-lg sm:text-xl", "text-xl sm:text-2xl", lang)}`} style={SERIF}>{lang === "ko" ? selectedWork.title : selectedWork.titleEn}</h3><p className="text-sm text-accent">{lang === "ko" ? selectedWork.titleEn : selectedWork.title}</p></>
                  )}
                </div>
                <div className="space-y-3 sm:space-y-4 border-t border-border pt-5">
                  {([["year", u.fieldYear], ["medium", u.fieldMedium], ["size", u.fieldSize], ["category", u.fieldCategory]] as [keyof Artwork, string][]).map(([field, label]) => {
                    const displayVal = () => {
                      if (field === "medium") return lang === "en" ? selectedWork.mediumEn : selectedWork.medium;
                      if (field === "category") return lang === "en" ? (selectedWork.categoryEn || selectedWork.category) : selectedWork.category;
                      return String(selectedWork[field]);
                    };
                    return (
                    <div key={field} className="flex gap-4 sm:gap-6 items-start">
                      <span className="text-xs w-12 sm:w-14 text-muted-foreground shrink-0 pt-0.5" style={MONO}>{label}</span>
                      {editMode ? (
                        (field === "medium" || field === "category")
                          ? <div className="flex-1 flex gap-2">
                              <input value={String(selectedWork[field])} onChange={(e) => updateWork(selectedWork.id, field, e.target.value)} placeholder="KO" className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" />
                              <input value={field === "medium" ? selectedWork.mediumEn : (selectedWork.categoryEn || "")} onChange={(e) => updateWork(selectedWork.id, field === "medium" ? "mediumEn" : "categoryEn", e.target.value)} placeholder="EN" className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" />
                            </div>
                          : <input value={String(selectedWork[field])} onChange={(e) => updateWork(selectedWork.id, field, e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" />
                      ) : <span className="text-sm text-foreground font-light">{displayVal()}</span>}
                    </div>
                  );})}
                  <div className="flex gap-4 sm:gap-6 items-start">
                    <span className="text-xs w-12 sm:w-14 text-muted-foreground shrink-0 pt-0.5" style={MONO}>{u.fieldSeries}</span>
                    {editMode ? (
                      <div className="flex flex-wrap gap-2 flex-1">
                        <button onClick={() => updateWork(selectedWork.id, "series", "")} className={`text-xs px-2 py-0.5 border transition-colors ${!selectedWork.series ? "border-accent text-accent" : "border-border text-muted-foreground hover:border-foreground/40"}`} style={MONO}>—</button>
                        {seriesList.map((s) => <button key={s.id} onClick={() => updateWork(selectedWork.id, "series", s.name)} className={`text-xs px-2 py-0.5 border transition-colors ${selectedWork.series === s.name ? "border-accent text-accent" : "border-border text-muted-foreground hover:border-foreground/40"}`} style={MONO}>{lang === "ko" ? s.name : s.nameEn}</button>)}
                      </div>
                    ) : <span className="text-sm text-foreground font-light">{(() => { const s = seriesList.find((s) => s.name === selectedWork.series); return lang === "ko" ? (selectedWork.series || "—") : (s?.nameEn ?? selectedWork.series ?? "—"); })()}</span>}
                  </div>
                  {/* collected row */}
                  <div className="flex gap-4 sm:gap-6 items-center pt-3 border-t border-border mt-1">
                    <span className="text-xs w-12 sm:w-14 text-muted-foreground shrink-0" style={MONO}>{u.fieldCollected}</span>
                    {editMode ? (
                      <button onClick={() => updateWork(selectedWork.id, "collected", !selectedWork.collected)}
                        className={`flex items-center gap-2 text-xs px-3 py-1.5 border transition-all ${selectedWork.collected ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:border-foreground/40"}`} style={MONO}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedWork.collected ? "bg-accent" : "bg-muted-foreground/40"}`} />
                        {selectedWork.collected ? u.worksCollected : u.worksNotCollected}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedWork.collected ? "bg-accent" : "bg-muted-foreground/20"}`} />
                        <span className={`text-sm font-light ${selectedWork.collected ? "text-accent" : "text-muted-foreground"}`}>{selectedWork.collected ? u.worksCollected : u.worksNotCollected}</span>
                      </div>
                    )}
                  </div>
                </div>
                {(editMode || selectedWork.description || selectedWork.descriptionEn) && (
                  <div className="mt-5 sm:mt-6 pt-5 border-t border-border">
                    <span className="text-xs text-accent uppercase tracking-widest block mb-3" style={MONO}>{u.fieldDescription}</span>
                    {editMode ? (
                      <div className="space-y-2">
                        <textarea value={selectedWork.description ?? ""} onChange={(e) => updateWork(selectedWork.id, "description", e.target.value)} rows={4} placeholder={u.descriptionPlaceholderKo} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light leading-relaxed outline-none resize-none" />
                        <textarea value={selectedWork.descriptionEn ?? ""} onChange={(e) => updateWork(selectedWork.id, "descriptionEn", e.target.value)} rows={4} placeholder={u.descriptionPlaceholderEn} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground leading-relaxed outline-none resize-none" />
                      </div>
                    ) : (
                      <p className="text-sm text-foreground/90 font-light leading-[1.9] whitespace-pre-wrap">{lang === "ko" ? selectedWork.description : selectedWork.descriptionEn}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-6 sm:mt-8 flex items-center justify-between flex-wrap gap-3">
                <button onClick={() => setShowInquiry(true)} className="text-xs tracking-widest text-muted-foreground hover:text-accent border border-border px-4 py-2 hover:border-accent transition-all" style={MONO}>{u.worksInquiry}</button>
                {editMode && <button onClick={() => deleteWork(selectedWork.id)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors" style={MONO}><Trash2 size={12} />{u.worksDelete}</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── INQUIRY CONTACT PICKER ── */}
      {showInquiry && (
        <div ref={inquiryRef} tabIndex={-1} className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 outline-none" onClick={() => setShowInquiry(false)}>
          <div className="w-full max-w-xs bg-card border border-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-xs tracking-widest text-muted-foreground" style={MONO}>{u.contactPick}</span>
              <button onClick={() => setShowInquiry(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="p-1">
              {visibleContacts.map((item) => (
                <a key={item.id} href={item.href} target={item.type === "email" || item.type === "phone" ? "_self" : "_blank"} rel="noopener noreferrer"
                  onClick={() => setShowInquiry(false)}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 transition-colors">
                  <span className="text-muted-foreground shrink-0">{contactIcon(item.type)}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground" style={MONO}>{lang === "ko" ? item.labelKo : item.labelEn}</p>
                    <p className="text-sm text-foreground font-light truncate">{item.display}</p>
                  </div>
                </a>
              ))}
              {visibleContacts.length === 0 && <p className="px-3 py-4 text-xs text-muted-foreground text-center" style={MONO}>—</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
