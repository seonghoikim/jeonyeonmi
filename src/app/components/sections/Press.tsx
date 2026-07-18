import { Plus, GripVertical, Link2, ArrowUpRight, Edit3, Check, Trash2, RefreshCw } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";
import { moveItem, hSize, type PressEntry } from "../../data";
import { ReorderButtons } from "../ReorderButtons";

type PressProps = {
  pressList: PressEntry[];
  setPressList: React.Dispatch<React.SetStateAction<PressEntry[]>>;
  editingPressId: number | null;
  setEditingPressId: (id: number | null) => void;
  fetchingPressId: number | null;
  addPress: () => void;
  updatePress: (id: number, f: keyof PressEntry, v: string) => void;
  deletePress: (id: number) => void;
  fetchPressPreview: (id: number, url: string) => void;
};

export function Press({
  pressList, setPressList, editingPressId, setEditingPressId, fetchingPressId,
  addPress, updatePress, deletePress, fetchPressPreview,
}: PressProps) {
  const { lang, u, MONO, SERIF, editMode, dragSrc, dragOverKey, setDragOverKey, C } = usePortfolioContext();

  if (pressList.length === 0 && !editMode) return null;

  const typeLabel = (t: PressEntry["type"]) => t === "인터뷰" ? u.pressInterview : t === "방송" ? u.pressBroadcast : t === "스크랩" ? u.pressScrap : u.pressArticle;
  const nextType = (t: PressEntry["type"]): PressEntry["type"] =>
    t === "기사" ? "인터뷰" : t === "인터뷰" ? "방송" : t === "방송" ? "스크랩" : "기사";

  return (
    <section id="press" className="py-16 sm:py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex items-end justify-between mb-10 sm:mb-12">
          <div>
            <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s08label" /></div>
            <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s08heading" /></h2>
          </div>
          {editMode && <button onClick={addPress} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.pressAdd}</span></button>}
        </div>

        {pressList.map((item, idx) => {
          const isEditing = editMode && editingPressId === item.id;
          const isFetching = fetchingPressId === item.id;
          return (
            <div key={item.id}
              draggable={editMode && !isEditing}
              onDragStart={() => { dragSrc.current = idx; }}
              onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("press-" + idx); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragSrc.current !== null && dragSrc.current !== idx) {
                  setPressList((prev) => moveItem(prev, dragSrc.current!, idx));
                }
                dragSrc.current = null; setDragOverKey(null);
              }}
              onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
              className={isEditing
                ? "flex flex-col gap-2 py-4 border-b border-border px-2 -mx-2 bg-secondary/20"
                : "group flex items-center gap-3 sm:gap-4 py-4 border-b border-border hover:bg-secondary/20 transition-colors px-2 -mx-2"}
              style={{ outline: dragOverKey === "press-" + idx ? "2px solid var(--accent)" : "none" }}>
              {isEditing ? (
                <>
                  <div className="flex items-center gap-2">
                    {editMode && (
                      <div className="flex items-center gap-0.5 text-accent/40 cursor-grab shrink-0">
                        <GripVertical size={13} />
                        <ReorderButtons
                          onMoveUp={() => setPressList((prev) => moveItem(prev, idx, idx - 1))}
                          onMoveDown={() => setPressList((prev) => moveItem(prev, idx, idx + 1))}
                          disableUp={idx === 0}
                          disableDown={idx === pressList.length - 1}
                        />
                      </div>
                    )}
                    <button onClick={() => updatePress(item.id, "type", nextType(item.type))} className="text-xs px-1.5 py-0.5 border border-accent text-accent shrink-0" style={MONO}>{typeLabel(item.type)} ⇄</button>
                    <div className="flex items-center gap-1 ml-auto shrink-0">
                      <button onClick={() => setEditingPressId(null)} className="p-1 text-accent transition-colors"><Check size={13} /></button>
                      <button onClick={() => deletePress(item.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input value={item.url} onChange={(e) => updatePress(item.id, "url", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder={u.pressUrlPh} />
                    <button onClick={() => fetchPressPreview(item.id, item.url)} disabled={isFetching} className="flex items-center gap-1.5 text-xs border border-accent text-accent px-2.5 py-1 shrink-0 hover:bg-accent/10 transition-colors disabled:opacity-50" style={MONO}>
                      <RefreshCw size={11} className={isFetching ? "animate-spin" : ""} />{isFetching ? u.pressFetching : u.pressFetch}
                    </button>
                  </div>
                  <input value={item.title} onChange={(e) => updatePress(item.id, "title", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" style={SERIF} placeholder="제목 KO" />
                  <input value={item.titleEn} onChange={(e) => updatePress(item.id, "titleEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none" style={MONO} placeholder="Title EN" />
                  <div className="flex gap-2">
                    <input value={item.outlet} onChange={(e) => updatePress(item.id, "outlet", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="매체명 KO" />
                    <input value={item.outletEn} onChange={(e) => updatePress(item.id, "outletEn", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="Outlet EN" />
                    <input value={item.date} onChange={(e) => updatePress(item.id, "date", e.target.value)} className="w-24 shrink-0 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="YYYY.MM" />
                  </div>
                </>
              ) : (
                <>
                  <div className="shrink-0 overflow-hidden bg-secondary flex items-center justify-center" style={{ width: 56, height: 56 }}>
                    {item.image ? <img src={item.image} alt={lang === "ko" ? item.title : item.titleEn} className="w-full h-full object-cover" loading="lazy" /> : <Link2 size={16} className="text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground/70 mb-0.5" style={MONO}>{lang === "ko" ? item.outlet : (item.outletEn || item.outlet)}{item.date && <span> · {item.date}</span>}</p>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-light text-foreground hover:text-accent transition-colors leading-snug flex items-center gap-1" style={SERIF}>
                        {lang === "ko" ? item.title : item.titleEn} <ArrowUpRight size={12} className="shrink-0 opacity-60" />
                      </a>
                    ) : (
                      <p className="text-sm font-light text-foreground leading-snug" style={SERIF}>{lang === "ko" ? item.title : item.titleEn}</p>
                    )}
                  </div>
                  <span className="text-xs px-1.5 py-0.5 border border-border text-muted-foreground shrink-0" style={MONO}>{typeLabel(item.type)}</span>
                  {editMode && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditingPressId(item.id)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><Edit3 size={12} /></button>
                      <button onClick={() => deletePress(item.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
