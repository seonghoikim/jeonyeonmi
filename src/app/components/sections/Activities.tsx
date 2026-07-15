import { Plus, GripVertical, Upload, Trash2, Edit3, Maximize2 } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";
import { moveItem, hSize, type ActivityPhoto } from "../../data";
import { ReorderButtons } from "../ReorderButtons";

type ActivitiesProps = {
  activityPhotos: ActivityPhoto[];
  setActivityPhotos: React.Dispatch<React.SetStateAction<ActivityPhoto[]>>;
  editingActivityCaption: number | null;
  setEditingActivityCaption: (id: number | null) => void;
  highlightedPhotoId: number | null;
  addActivityPhoto: () => void;
  deleteActivityPhoto: (id: number) => void;
  updateActivityPhoto: (id: number, f: keyof ActivityPhoto, v: string) => void;
};

export function Activities({
  activityPhotos, setActivityPhotos, editingActivityCaption, setEditingActivityCaption,
  highlightedPhotoId, addActivityPhoto, deleteActivityPhoto, updateActivityPhoto,
}: ActivitiesProps) {
  const { lang, u, MONO, SERIF, editMode, img, uploadingTarget, dragSrc, dragOverKey, setDragOverKey, triggerUpload, openLightbox, C } = usePortfolioContext();

  return (
    <section id="activities" className="py-16 sm:py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex items-end justify-between mb-10 sm:mb-12">
          <div>
            <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s05label" /></div>
            <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s05heading" /></h2>
          </div>
          {editMode && <button onClick={addActivityPhoto} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.activityAdd}</span></button>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-background items-start">
          {activityPhotos.map((photo, idx) => {
            const actImg = img(`activity-${photo.id}`);
            const isEditingCap = editMode && editingActivityCaption === photo.id;
            const isHighlighted = highlightedPhotoId === photo.id;
            return (
              <div key={photo.id} id={`activity-photo-${photo.id}`}
                draggable={editMode}
                onDragStart={() => { dragSrc.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("act-" + idx); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSrc.current !== null && dragSrc.current !== idx) {
                    setActivityPhotos(prev => moveItem(prev, dragSrc.current!, idx));
                  }
                  dragSrc.current = null; setDragOverKey(null);
                }}
                onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                className="group bg-background relative overflow-hidden transition-all duration-500"
                style={{ outline: isHighlighted || dragOverKey === "act-" + idx ? "2px solid var(--accent)" : "none" }}>
                {editMode && <div className="absolute top-1.5 left-1.5 z-10 text-accent/60 cursor-grab"><GripVertical size={14} /></div>}
                {editMode && (
                  <ReorderButtons
                    className="absolute top-1.5 right-1.5 z-10 bg-background/70"
                    onMoveUp={() => setActivityPhotos((prev) => moveItem(prev, idx, idx - 1))}
                    onMoveDown={() => setActivityPhotos((prev) => moveItem(prev, idx, idx + 1))}
                    disableUp={idx === 0}
                    disableDown={idx === activityPhotos.length - 1}
                  />
                )}
                <div
                  className={`relative aspect-square overflow-hidden bg-background ${editMode ? "cursor-pointer" : "cursor-zoom-in"}`}
                  onClick={() => {
                    if (editMode) { triggerUpload(`activity-${photo.id}`, photo.captionEn); return; }
                    if (actImg) openLightbox(actImg);
                  }}>
                  {actImg ? <img src={actImg} alt={photo.caption} className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${isHighlighted ? "opacity-100" : "opacity-80"}`} loading="lazy" decoding="async" /> : <div className="absolute inset-0 img-placeholder" />}
                  {editMode && <div className="absolute inset-0 flex items-center justify-center bg-background/50 hover:bg-background/65 transition-colors"><div className="flex flex-col items-center gap-2 text-foreground"><Upload size={18} /><span className="text-xs" style={MONO}>{uploadingTarget === `activity-${photo.id}` ? u.activityUploading : u.activityUpload}</span></div></div>}
                  {editMode && <button onClick={(e) => { e.stopPropagation(); deleteActivityPhoto(photo.id); }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-background/80 hover:bg-background text-foreground p-1 transition-all"><Trash2 size={12} /></button>}
                  {/* hover overlay hint — desktop only */}
                  {!editMode && actImg && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/30 transition-colors pointer-events-none">
                      <Maximize2 size={20} className="text-foreground opacity-0 group-hover:opacity-70 transition-opacity" />
                    </div>
                  )}
                </div>
                <div className="p-2 sm:p-3">
                  {isEditingCap ? (
                    <div className="space-y-1">
                      <input value={photo.caption} onChange={(e) => updateActivityPhoto(photo.id, "caption", e.target.value)} onKeyDown={(e) => e.key === "Enter" && setEditingActivityCaption(null)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none w-full" style={MONO} placeholder="KO" autoFocus />
                      <input value={photo.captionEn} onChange={(e) => updateActivityPhoto(photo.id, "captionEn", e.target.value)} onKeyDown={(e) => e.key === "Enter" && setEditingActivityCaption(null)} onBlur={() => setEditingActivityCaption(null)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground/60 outline-none w-full" style={MONO} placeholder="EN" />
                    </div>
                  ) : (
                    <button onClick={() => editMode && setEditingActivityCaption(photo.id)} className={`text-xs text-muted-foreground text-left w-full transition-all ${editMode ? "hover:text-foreground" : ""}`} style={MONO}>{lang === "ko" ? photo.caption : photo.captionEn}{editMode && <Edit3 size={9} className="inline ml-1 opacity-50" />}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
