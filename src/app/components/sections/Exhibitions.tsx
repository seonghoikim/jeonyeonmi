import { Plus, GripVertical, Link2, Edit3, Check, Trash2 } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";
import { moveItem, moveInFiltered, hSize, type ExhibitionEntry, type ActivityPhoto } from "../../data";
import { ReorderButtons } from "../ReorderButtons";

type ExFilter = "전체" | "전시" | "수상" | "아트페어";

type ExhibitionsProps = {
  exhibitionList: ExhibitionEntry[];
  setExhibitionList: React.Dispatch<React.SetStateAction<ExhibitionEntry[]>>;
  filteredEx: ExhibitionEntry[];
  exFilter: ExFilter;
  exVisible: boolean;
  editingExId: number | null;
  setEditingExId: (id: number | null) => void;
  activityPhotos: ActivityPhoto[];
  changeExFilter: (f: ExFilter) => void;
  addExhibition: () => void;
  updateEx: (id: number, f: keyof ExhibitionEntry, v: string | number | undefined) => void;
  deleteEx: (id: number) => void;
};

export function Exhibitions({
  exhibitionList, setExhibitionList, filteredEx, exFilter, exVisible, editingExId, setEditingExId,
  activityPhotos, changeExFilter, addExhibition, updateEx, deleteEx,
}: ExhibitionsProps) {
  const { lang, u, MONO, SERIF, editMode, img, dragSrc, dragOverKey, setDragOverKey, scrollToActivity, C } = usePortfolioContext();

  return (
    <section id="exhibitions" className="py-16 sm:py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 sm:mb-12 gap-5">
          <div>
            <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s04label" /></div>
            <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s04heading" /></h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {([["전체", u.exAll], ["전시", u.exExhibition], ["아트페어", u.exFair], ["수상", u.exAward]] as const).map(([f, label]) => (
              <button key={f} onClick={() => changeExFilter(f as ExFilter)} className={`text-xs tracking-wider px-3 sm:px-4 py-2 border transition-all ${exFilter === f ? "border-accent text-accent" : "border-border text-muted-foreground hover:border-foreground/40"}`} style={MONO}>{label}</button>
            ))}
            {editMode && <button onClick={addExhibition} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.exAdd}</span></button>}
          </div>
        </div>
        <div className="transition-opacity duration-200" style={{ opacity: exVisible ? 1 : 0 }}>
          {filteredEx.map((ex, idx) => {
            const isEditing = editMode && editingExId === ex.id;
            const linkedPhoto = activityPhotos.find((p) => p.id === ex.activityId);
            const exThumb = ex.activityId ? img(`activity-${ex.activityId}`) : null;
            return (
              <div key={ex.id}
                draggable={editMode && !isEditing}
                onDragStart={() => { dragSrc.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("ex-" + idx); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSrc.current !== null && dragSrc.current !== idx) {
                    setExhibitionList(prev => {
                      const full = [...prev];
                      const fromId = filteredEx[dragSrc.current!].id;
                      const toId = filteredEx[idx].id;
                      const fromFullIdx = full.findIndex(e => e.id === fromId);
                      const toFullIdx = full.findIndex(e => e.id === toId);
                      return moveItem(full, fromFullIdx, toFullIdx);
                    });
                  }
                  dragSrc.current = null; setDragOverKey(null);
                }}
                onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                className={isEditing
                  ? "group flex flex-col gap-2 py-3 sm:py-4 border-b border-border px-2 -mx-2 bg-secondary/20"
                  : "group grid grid-cols-12 gap-1 sm:gap-2 py-3 sm:py-4 border-b border-border hover:bg-secondary/30 transition-colors px-2 -mx-2 items-center"}
                style={{ outline: dragOverKey === "ex-" + idx ? "2px solid var(--accent)" : "none" }}>
                {isEditing ? (
                  <>
                    <div className="flex items-center gap-2">
                      {editMode && (
                        <div className="flex items-center gap-0.5 text-accent/40 cursor-grab shrink-0">
                          <GripVertical size={13} />
                          <ReorderButtons
                            onMoveUp={() => setExhibitionList((prev) => moveInFiltered(prev, filteredEx, idx, -1))}
                            onMoveDown={() => setExhibitionList((prev) => moveInFiltered(prev, filteredEx, idx, 1))}
                            disableUp={idx === 0}
                            disableDown={idx === filteredEx.length - 1}
                          />
                        </div>
                      )}
                      <input value={ex.year} onChange={(e) => updateEx(ex.id, "year", e.target.value)} className="w-16 shrink-0 bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none" style={MONO} placeholder="연도" />
                      <button onClick={() => updateEx(ex.id, "tag", ex.tag === "전시" ? "아트페어" : ex.tag === "아트페어" ? "수상" : "전시")} className={`text-xs px-1.5 py-0.5 border transition-colors shrink-0 ${ex.tag === "수상" ? "border-yellow-600/60 text-yellow-500" : ex.tag === "아트페어" ? "border-blue-500/60 text-blue-400" : "border-accent text-accent"}`} style={MONO}>{ex.tag === "전시" ? u.exExhibition : ex.tag === "아트페어" ? u.exFair : u.exAward} ⇄</button>
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        <button onClick={() => setEditingExId(null)} className="p-1 text-accent transition-colors"><Check size={13} /></button>
                        <button onClick={() => deleteEx(ex.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <input value={ex.title} onChange={(e) => updateEx(ex.id, "title", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" style={SERIF} placeholder="제목 KO" />
                    <input value={ex.titleEn} onChange={(e) => updateEx(ex.id, "titleEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none" style={MONO} placeholder="Title EN" />
                    <div className="flex gap-2">
                      <input value={ex.venue} onChange={(e) => updateEx(ex.id, "venue", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="장소 KO" />
                      <input value={ex.location} onChange={(e) => updateEx(ex.id, "location", e.target.value)} className="w-20 shrink-0 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="지역" />
                    </div>
                    <input value={ex.venueEn ?? ""} onChange={(e) => updateEx(ex.id, "venueEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="Venue EN" />
                    <div className="flex items-center gap-1">
                      <Link2 size={10} className="text-muted-foreground shrink-0" />
                      <select value={ex.activityId ?? ""} onChange={(e) => updateEx(ex.id, "activityId", e.target.value ? Number(e.target.value) : undefined)} className="bg-transparent text-xs text-muted-foreground outline-none flex-1 cursor-pointer" style={MONO}>
                        <option value="">{u.exNoLink}</option>
                        {activityPhotos.map((p) => <option key={p.id} value={p.id}>{lang === "ko" ? p.caption : p.captionEn}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    {editMode && (
                      <div className="col-span-1 flex items-center justify-center gap-0.5 text-accent/40 cursor-grab">
                        <GripVertical size={13} />
                        <ReorderButtons
                          onMoveUp={() => setExhibitionList((prev) => moveInFiltered(prev, filteredEx, idx, -1))}
                          onMoveDown={() => setExhibitionList((prev) => moveInFiltered(prev, filteredEx, idx, 1))}
                          disableUp={idx === 0}
                          disableDown={idx === filteredEx.length - 1}
                        />
                      </div>
                    )}
                    {/* thumbnail */}
                    <div className={`${editMode ? "col-span-1" : "col-span-2 sm:col-span-1"} flex items-center justify-center`}>
                      {exThumb ? (
                        <button onClick={() => linkedPhoto && scrollToActivity(linkedPhoto.id)} className="shrink-0 overflow-hidden bg-secondary" style={{ width: 40, height: 40 }}>
                          <img src={exThumb} alt={lang === "ko" ? ex.title : ex.titleEn} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" loading="lazy" decoding="async" />
                        </button>
                      ) : (
                        <div className="shrink-0 overflow-hidden bg-secondary flex items-center justify-center" style={{ width: 40, height: 40 }}>
                          <span className="text-muted-foreground/20 text-xs">✦</span>
                        </div>
                      )}
                    </div>
                    <div className={editMode ? "col-span-4 lg:col-span-4" : "col-span-5 lg:col-span-4"}>
                      <span className="text-xs text-accent block mb-0.5" style={MONO}>{ex.year}</span>
                      <p className="text-xs sm:text-sm text-foreground font-light leading-snug" style={SERIF}>{lang === "ko" ? ex.title : ex.titleEn}</p>
                    </div>
                    <div className="hidden lg:block col-span-3">
                      <p className="text-xs text-muted-foreground">{lang === "ko" ? ex.venue : (ex.venueEn || ex.venue)} · {ex.location}</p>
                    </div>
                    <div className="col-span-2 lg:col-span-1 flex justify-center">
                      <span className={`text-xs px-1.5 py-0.5 border ${ex.tag === "수상" ? "border-yellow-600/60 text-yellow-500" : ex.tag === "아트페어" ? "border-blue-500/40 text-blue-400" : "border-border text-muted-foreground"}`} style={MONO}>{ex.tag === "전시" ? u.exExhibition : ex.tag === "아트페어" ? u.exFair : u.exAward}</span>
                    </div>
                    <div className="col-span-1 flex justify-end">{linkedPhoto && !exThumb && <button onClick={() => scrollToActivity(linkedPhoto.id)} className="text-muted-foreground hover:text-accent transition-colors p-1" title={lang === "ko" ? linkedPhoto.caption : linkedPhoto.captionEn}><Link2 size={14} /></button>}</div>
                    <div className="col-span-1 flex justify-end">{editMode && <div className="flex gap-1"><button onClick={() => setEditingExId(ex.id)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><Edit3 size={12} /></button><button onClick={() => deleteEx(ex.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={12} /></button></div>}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
