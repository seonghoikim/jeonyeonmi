import { Plus, Upload, GripVertical, Eye, EyeOff, Edit3, Check, Trash2, ArrowUpRight, ChevronRight } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";
import { moveItem, hSize, type CurrentExhibition } from "../../data";

type CurrentExhibitionsProps = {
  currentExList: CurrentExhibition[];
  setCurrentExList: React.Dispatch<React.SetStateAction<CurrentExhibition[]>>;
  editingCurrentId: number | null;
  setEditingCurrentId: (id: number | null) => void;
  showPastEx: boolean;
  setShowPastEx: React.Dispatch<React.SetStateAction<boolean>>;
  addCurrentEx: () => void;
  toggleCurrentExVisible: (id: number) => void;
  updateCurrentEx: (id: number, f: keyof CurrentExhibition, v: string) => void;
  deleteCurrentEx: (id: number) => void;
};

export function CurrentExhibitions({
  currentExList, setCurrentExList, editingCurrentId, setEditingCurrentId, showPastEx, setShowPastEx,
  addCurrentEx, toggleCurrentExVisible, updateCurrentEx, deleteCurrentEx,
}: CurrentExhibitionsProps) {
  const { lang, u, MONO, SERIF, editMode, img, uploadingTarget, dragSrc, dragOverKey, setDragOverKey, scrollTo, triggerUpload, C } = usePortfolioContext();

  const activeList = editMode
    ? currentExList.filter((e) => e.status !== "지난전시")
    : currentExList.filter((e) => e.status !== "지난전시" && e.visible);
  const pastList = editMode
    ? currentExList.filter((e) => e.status === "지난전시")
    : currentExList.filter((e) => e.status === "지난전시" && e.visible);

  return (
    <section id="current-exhibitions" className="py-16 sm:py-20 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="px-4 sm:px-6 lg:px-12 flex items-end justify-between mb-10">
          <div>
            <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s01label" /></div>
            <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s01heading" /></h2>
          </div>
          {editMode && <button onClick={addCurrentEx} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.currentAdd}</span></button>}
        </div>

        {/* active / upcoming cards */}
        <div className="flex gap-px overflow-x-auto hide-sb pl-4 sm:pl-6 lg:pl-12 pr-4 sm:pr-6 lg:pr-12 pb-2" style={{ scrollSnapType: "x mandatory" }}>
          {activeList.map((ex, idx) => {
            const isEditing = editMode && editingCurrentId === ex.id;
            const exImg = img(`current-${ex.id}`);
            const statusLabel = ex.status === "진행중" ? u.statusOngoing : u.statusUpcoming;
            const statusCls = ex.status === "진행중" ? "bg-accent text-accent-foreground" : "bg-background/90 border border-border text-muted-foreground";
            return (
              <div key={ex.id}
                draggable={editMode}
                onDragStart={() => { dragSrc.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("cur-" + idx); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSrc.current !== null && dragSrc.current !== idx) {
                    setCurrentExList(prev => {
                      const filtered = editMode ? prev.filter(e => e.status !== "지난전시") : prev.filter(e => e.status !== "지난전시" && e.visible);
                      const full = [...prev];
                      const fromId = filtered[dragSrc.current!].id;
                      const toId = filtered[idx].id;
                      const fromFullIdx = full.findIndex(e => e.id === fromId);
                      const toFullIdx = full.findIndex(e => e.id === toId);
                      return moveItem(full, fromFullIdx, toFullIdx);
                    });
                  }
                  dragSrc.current = null; setDragOverKey(null);
                }}
                onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                className={`shrink-0 bg-background border flex flex-col overflow-hidden transition-all ${ex.visible ? "border-border" : "border-dashed border-border/40 opacity-50"}`}
                style={{ width: "clamp(240px, 72vw, 300px)", scrollSnapAlign: "start", outline: dragOverKey === "cur-" + idx ? "2px solid var(--accent)" : "none" }}>
                <div className={`current-ex-img relative overflow-hidden bg-card ${editMode ? "cursor-pointer" : ""}`} style={{ height: "340px" }} onClick={() => editMode && triggerUpload(`current-${ex.id}`, ex.titleEn)}>
                  {exImg ? <img src={exImg} alt={ex.title} className="w-full h-full object-cover" loading="lazy" decoding="async" /> : <div className="w-full h-full bg-secondary flex items-center justify-center"><span className="text-xs text-muted-foreground" style={MONO}>{u.currentUpload}</span></div>}
                  {!isEditing && (
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <span className={`text-xs px-2.5 py-1 tracking-widest font-medium ${statusCls}`} style={MONO}>{statusLabel}</span>
                      {!ex.visible && editMode && <span className="text-xs px-2 py-1 bg-background/80 border border-dashed border-border text-muted-foreground" style={MONO}>숨김</span>}
                    </div>
                  )}
                  {editMode && <div className="absolute inset-0 flex items-center justify-center bg-background/50 hover:bg-background/65 transition-colors"><div className="flex flex-col items-center gap-2 text-foreground"><Upload size={20} /><span className="text-xs" style={MONO}>{uploadingTarget === `current-${ex.id}` ? u.currentUploading : u.currentUpload}</span></div></div>}
                  {editMode && <div className="absolute top-1.5 left-1.5 z-10 text-accent/60 cursor-grab"><GripVertical size={14} /></div>}
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  {isEditing ? (
                    <div className="space-y-2 flex-1">
                      {/* status cycle */}
                      <button onClick={() => { const cycle = { "진행중": "예정", "예정": "지난전시", "지난전시": "진행중" } as const; updateCurrentEx(ex.id, "status", cycle[ex.status]); }}
                        className={`text-xs px-2 py-0.5 border mb-2 ${ex.status === "진행중" ? "border-accent text-accent" : ex.status === "예정" ? "border-border text-muted-foreground" : "border-border/40 text-muted-foreground/50"}`} style={MONO}>
                        {ex.status === "진행중" ? u.statusOngoing : ex.status === "예정" ? u.statusUpcoming : u.statusPast} ⇄
                      </button>
                      <input value={ex.title} onChange={(e) => updateCurrentEx(ex.id, "title", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-base font-light text-foreground outline-none" style={SERIF} placeholder="전시명 KO" />
                      <input value={ex.titleEn} onChange={(e) => updateCurrentEx(ex.id, "titleEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none" style={MONO} placeholder="Title EN" />
                      <div className="flex gap-2">
                        <input value={ex.venue} onChange={(e) => updateCurrentEx(ex.id, "venue", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="장소 KO" />
                        <input value={ex.venueEn} onChange={(e) => updateCurrentEx(ex.id, "venueEn", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="Venue EN" />
                      </div>
                      <div className="flex gap-2">
                        <input value={ex.location} onChange={(e) => updateCurrentEx(ex.id, "location", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="지역 KO" />
                        <input value={ex.locationEn} onChange={(e) => updateCurrentEx(ex.id, "locationEn", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="Location EN" />
                      </div>
                      <div className="flex gap-2">
                        <input value={ex.startDate} onChange={(e) => updateCurrentEx(ex.id, "startDate", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="시작일" />
                        <input value={ex.endDate} onChange={(e) => updateCurrentEx(ex.id, "endDate", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="종료일" />
                      </div>
                      <input value={ex.url ?? ""} onChange={(e) => updateCurrentEx(ex.id, "url", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="링크 URL (선택)" />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <h3 className={`font-light text-foreground mb-1 leading-snug ${hSize("text-sm sm:text-base", "text-base sm:text-lg", lang)}`} style={SERIF}>{lang === "ko" ? ex.title : ex.titleEn}</h3>
                      <p className="text-xs text-accent mb-3" style={MONO}>{lang === "ko" ? ex.titleEn : ex.title}</p>
                      <p className="text-xs text-muted-foreground mb-1">{lang === "ko" ? ex.venue : ex.venueEn}</p>
                      <p className="text-xs text-muted-foreground mb-1">{lang === "ko" ? ex.location : ex.locationEn}</p>
                      <p className="text-xs text-muted-foreground" style={MONO}>{ex.startDate} — {ex.endDate}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                    {!isEditing && (ex.url
                      ? <a href={ex.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors" style={MONO}>{u.viewMore} <ArrowUpRight size={11} /></a>
                      : <button onClick={() => scrollTo("works")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors" style={MONO}>{u.viewMore} <ArrowUpRight size={11} /></button>
                    )}
                    {editMode && (
                      <div className="flex gap-1 ml-auto">
                        <button onClick={() => toggleCurrentExVisible(ex.id)} className={`p-1.5 transition-colors ${ex.visible ? "text-muted-foreground hover:text-foreground" : "text-accent"}`} title={ex.visible ? "숨기기" : "보이기"}>
                          {ex.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button onClick={() => setEditingCurrentId(isEditing ? null : ex.id)} className={`p-1.5 transition-colors ${isEditing ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}>{isEditing ? <Check size={13} /> : <Edit3 size={13} />}</button>
                        <button onClick={() => deleteCurrentEx(ex.id)} className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {editMode && <button onClick={addCurrentEx} className="shrink-0 border border-dashed border-border hover:border-accent transition-colors flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-accent" style={{ width: "clamp(240px, 72vw, 300px)", height: "520px", scrollSnapAlign: "start" }}><Plus size={24} /><span className="text-xs tracking-widest" style={MONO}>{u.currentAdd}</span></button>}
        </div>

        {/* past exhibitions */}
        {(pastList.length > 0 || editMode) && (
          <div className="px-4 sm:px-6 lg:px-12 mt-8">
            <button onClick={() => setShowPastEx((p) => !p)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-0" style={MONO}>
              <span className="w-4 h-px bg-muted-foreground/40" />
              {showPastEx ? u.hidePastEx : u.showPastEx}
              <span className="text-muted-foreground/40">({pastList.length})</span>
              <ChevronRight size={12} className={`transition-transform duration-200 ${showPastEx ? "rotate-90" : ""}`} />
            </button>
            {showPastEx && (
              <div className="mt-4 border-t border-border/40">
                {pastList.map((ex, pidx) => {
                  const isEditing = editMode && editingCurrentId === ex.id;
                  const pastThumb = img(`current-${ex.id}`);
                  return (
                    <div key={ex.id}
                      draggable={editMode}
                      onDragStart={() => { dragSrc.current = pidx; }}
                      onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== pidx) setDragOverKey("past-" + pidx); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragSrc.current !== null && dragSrc.current !== pidx) {
                          setCurrentExList(prev => {
                            const full = [...prev];
                            const fromId = pastList[dragSrc.current!].id;
                            const toId = pastList[pidx].id;
                            const fromIdx = full.findIndex(e => e.id === fromId);
                            const toIdx = full.findIndex(e => e.id === toId);
                            return moveItem(full, fromIdx, toIdx);
                          });
                        }
                        dragSrc.current = null; setDragOverKey(null);
                      }}
                      onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                      className={`group flex items-center gap-3 sm:gap-5 py-3 border-b border-border/30 hover:bg-secondary/20 transition-colors px-2 -mx-2 ${ex.visible ? "" : "opacity-40"}`}
                      style={{ outline: dragOverKey === "past-" + pidx ? "2px solid var(--accent)" : "none" }}>
                      {editMode && <div className="text-accent/40 cursor-grab shrink-0"><GripVertical size={13} /></div>}
                      <span className="text-xs text-muted-foreground/50 w-16 shrink-0" style={MONO}>{ex.startDate.slice(0, 7)}</span>
                      {/* thumbnail */}
                      <div className="shrink-0 overflow-hidden bg-secondary" style={{ width: 52, height: 68 }}>
                        {pastThumb
                          ? <img src={pastThumb} alt={lang === "ko" ? ex.title : ex.titleEn} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" decoding="async" />
                          : <div className="w-full h-full flex items-center justify-center"><span className="text-muted-foreground/20 text-xs">✦</span></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-2">
                            <button onClick={() => { const cycle = { "진행중": "예정", "예정": "지난전시", "지난전시": "진행중" } as const; updateCurrentEx(ex.id, "status", cycle[ex.status]); }} className="text-xs px-2 py-0.5 border border-border/40 text-muted-foreground/50 mb-1" style={MONO}>{u.statusPast} ⇄</button>
                            <input value={ex.title} onChange={(e) => updateCurrentEx(ex.id, "title", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" style={SERIF} />
                            <input value={ex.titleEn} onChange={(e) => updateCurrentEx(ex.id, "titleEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none" style={MONO} />
                            <div className="flex gap-2">
                              <input value={ex.venue} onChange={(e) => updateCurrentEx(ex.id, "venue", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="KO" />
                              <input value={ex.venueEn} onChange={(e) => updateCurrentEx(ex.id, "venueEn", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="EN" />
                            </div>
                            <div className="flex gap-2">
                              <input value={ex.location} onChange={(e) => updateCurrentEx(ex.id, "location", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="지역 KO" />
                              <input value={ex.locationEn} onChange={(e) => updateCurrentEx(ex.id, "locationEn", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="EN" />
                            </div>
                            <div className="flex gap-2">
                              <input value={ex.startDate} onChange={(e) => updateCurrentEx(ex.id, "startDate", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} />
                              <input value={ex.endDate} onChange={(e) => updateCurrentEx(ex.id, "endDate", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} />
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-light text-foreground/80 leading-snug" style={SERIF}>{lang === "ko" ? ex.title : ex.titleEn}</p>
                            <p className="text-xs text-muted-foreground/50 mt-0.5">{lang === "ko" ? ex.venue : ex.venueEn} · {lang === "ko" ? ex.location : ex.locationEn}</p>
                            <p className="text-xs text-muted-foreground/30 mt-0.5" style={MONO}>{ex.startDate} — {ex.endDate}</p>
                          </>
                        )}
                      </div>
                      {editMode && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => toggleCurrentExVisible(ex.id)} className={`p-1.5 transition-colors ${ex.visible ? "text-muted-foreground hover:text-foreground" : "text-accent"}`}>{ex.visible ? <Eye size={12} /> : <EyeOff size={12} />}</button>
                          <button onClick={() => setEditingCurrentId(isEditing ? null : ex.id)} className={`p-1.5 transition-colors ${isEditing ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}>{isEditing ? <Check size={12} /> : <Edit3 size={12} />}</button>
                          <button onClick={() => deleteCurrentEx(ex.id)} className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
