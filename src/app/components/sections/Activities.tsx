import { useRef, useState } from "react";
import { Plus, GripVertical, Upload, Trash2, Maximize2, X, ChevronLeft, ChevronRight, Images, Star } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";
import { moveItem, hSize, type ActivityPhoto } from "../../data";
import { ReorderButtons } from "../ReorderButtons";
import { useModalLock } from "../../useModalLock";

type ActivitiesProps = {
  activityPhotos: ActivityPhoto[];
  setActivityPhotos: React.Dispatch<React.SetStateAction<ActivityPhoto[]>>;
  highlightedPhotoId: number | null;
  addActivityPhoto: () => void;
  deleteActivityPhoto: (id: number) => void;
  updateActivityPhoto: (id: number, f: keyof ActivityPhoto, v: string) => void;
  triggerMultiUpload: (photoId: number) => void;
  uploadingExtraFor: number | null;
  setPhotoAsCover: (photoId: number, subId: number) => void;
  deleteExtraPhoto: (photoId: number, subId: number) => void;
  reorderExtraPhotos: (photoId: number, newIds: number[]) => void;
};

export function Activities({
  activityPhotos, setActivityPhotos, highlightedPhotoId,
  addActivityPhoto, deleteActivityPhoto, updateActivityPhoto,
  triggerMultiUpload, uploadingExtraFor, setPhotoAsCover, deleteExtraPhoto, reorderExtraPhotos,
}: ActivitiesProps) {
  const { lang, u, MONO, SERIF, editMode, img, uploadingTarget, dragSrc, dragOverKey, setDragOverKey, triggerUpload, openLightbox, C } = usePortfolioContext();

  const [managingId, setManagingId] = useState<number | null>(null);
  const managingPhoto = activityPhotos.find((p) => p.id === managingId) ?? null;
  const extraDragSrc = useRef<number | null>(null);
  const managingModalRef = useModalLock<HTMLDivElement>(!!managingPhoto, () => setManagingId(null));

  const [gallery, setGallery] = useState<{ photoId: number; index: number } | null>(null);
  const galleryPhoto = activityPhotos.find((p) => p.id === gallery?.photoId) ?? null;
  const galleryKeys = galleryPhoto
    ? [`activity-${galleryPhoto.id}`, ...(galleryPhoto.extraPhotoIds ?? []).map((sid) => `activity-${galleryPhoto.id}-${sid}`)]
    : [];
  const galleryModalRef = useModalLock<HTMLDivElement>(!!gallery, () => setGallery(null));
  const galleryTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  const goGallery = (dir: 1 | -1) => {
    setGallery((g) => {
      if (!g) return g;
      const next = g.index + dir;
      if (next < 0 || next >= galleryKeys.length) return g;
      return { ...g, index: next };
    });
  };
  const handleGalleryTouchStart = (e: React.TouchEvent) => { galleryTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    const start = galleryTouchStartRef.current; galleryTouchStartRef.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    goGallery(dx < 0 ? 1 : -1);
  };

  return (
    <>
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
              const extraCount = photo.extraPhotoIds?.length ?? 0;
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
                    className={`relative aspect-square overflow-hidden bg-background ${editMode ? "cursor-pointer" : extraCount > 0 || actImg ? "cursor-zoom-in" : ""}`}
                    onClick={() => {
                      if (editMode) { setManagingId(photo.id); return; }
                      if (extraCount > 0) { setGallery({ photoId: photo.id, index: 0 }); return; }
                      if (actImg) openLightbox(actImg);
                    }}>
                    {actImg ? <img src={actImg} alt={photo.caption} className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${isHighlighted ? "opacity-100" : "opacity-80"}`} loading="lazy" decoding="async" /> : <div className="absolute inset-0 img-placeholder" />}
                    {editMode && <div className="absolute inset-0 flex items-center justify-center bg-background/50 hover:bg-background/65 transition-colors"><div className="flex flex-col items-center gap-2 text-foreground"><Upload size={18} /><span className="text-xs text-center px-2" style={MONO}>{u.activityManage}</span></div></div>}
                    {editMode && <button onClick={(e) => { e.stopPropagation(); deleteActivityPhoto(photo.id); }} className="absolute top-2 right-2 bg-background/80 hover:bg-background text-foreground p-1 transition-all"><Trash2 size={12} /></button>}
                    {extraCount > 0 && (
                      <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 bg-background/80 text-foreground text-xs px-1.5 py-0.5" style={MONO}>
                        <Images size={11} />{extraCount + 1}
                      </div>
                    )}
                    {/* hover overlay hint — desktop only */}
                    {!editMode && actImg && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/30 transition-colors pointer-events-none">
                        <Maximize2 size={20} className="text-foreground opacity-0 group-hover:opacity-70 transition-opacity" />
                      </div>
                    )}
                  </div>
                  <div className="p-2 sm:p-3">
                    <p className="text-xs text-muted-foreground" style={MONO}>{lang === "ko" ? photo.caption : photo.captionEn}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PHOTO MANAGEMENT MODAL (edit mode) ── */}
      {managingPhoto && (
        <div ref={managingModalRef} tabIndex={-1} className="fixed inset-0 z-[250] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 outline-none" onClick={() => setManagingId(null)}>
          <div className="relative w-full max-w-lg bg-card border border-border max-h-[90dvh] overflow-y-auto hide-sb" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
              <span className="text-xs tracking-widest text-muted-foreground" style={MONO}>{u.activityManage}</span>
              <button onClick={() => setManagingId(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-5">
              {/* cover */}
              <div>
                <span className="text-xs text-accent uppercase tracking-widest block mb-2" style={MONO}>{u.activityCover}</span>
                <div className="relative aspect-square w-28 sm:w-36 overflow-hidden bg-secondary cursor-pointer" onClick={() => triggerUpload(`activity-${managingPhoto.id}`, managingPhoto.captionEn)}>
                  {img(`activity-${managingPhoto.id}`) ? <img src={img(`activity-${managingPhoto.id}`)!} alt="" className="w-full h-full object-cover" /> : <div className="absolute inset-0 img-placeholder" />}
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                    <Upload size={16} className="text-foreground" />
                  </div>
                  {uploadingTarget === `activity-${managingPhoto.id}` && <div className="absolute inset-0 flex items-center justify-center bg-background/80"><span className="text-xs" style={MONO}>{u.activityUploading}</span></div>}
                </div>
              </div>
              {/* extras */}
              <div>
                <span className="text-xs text-accent uppercase tracking-widest block mb-2" style={MONO}>{u.activityAddMore}</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {(managingPhoto.extraPhotoIds ?? []).map((subId, idx) => {
                    const ids = managingPhoto.extraPhotoIds ?? [];
                    const key = `activity-${managingPhoto.id}-${subId}`;
                    const url = img(key);
                    return (
                      <div key={subId}
                        className="relative aspect-square overflow-hidden bg-secondary"
                        draggable
                        onDragStart={() => { extraDragSrc.current = idx; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (extraDragSrc.current !== null && extraDragSrc.current !== idx) {
                            reorderExtraPhotos(managingPhoto.id, moveItem(ids, extraDragSrc.current, idx));
                          }
                          extraDragSrc.current = null;
                        }}>
                        {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="absolute inset-0 img-placeholder" />}
                        <div className="absolute top-1 left-1 z-10 text-white/80 bg-background/40 cursor-grab"><GripVertical size={11} /></div>
                        <ReorderButtons
                          className="absolute top-1 right-1 z-10 bg-background/70"
                          onMoveUp={() => reorderExtraPhotos(managingPhoto.id, moveItem(ids, idx, idx - 1))}
                          onMoveDown={() => reorderExtraPhotos(managingPhoto.id, moveItem(ids, idx, idx + 1))}
                          disableUp={idx === 0}
                          disableDown={idx === ids.length - 1}
                        />
                        <button onClick={() => setPhotoAsCover(managingPhoto.id, subId)} title={u.activitySetCover} className="absolute bottom-1 left-1 bg-background/80 hover:bg-background text-foreground p-1 transition-colors"><Star size={11} /></button>
                        <button onClick={() => deleteExtraPhoto(managingPhoto.id, subId)} className="absolute bottom-1 right-1 bg-background/80 hover:bg-background text-foreground p-1 transition-colors"><Trash2 size={11} /></button>
                      </div>
                    );
                  })}
                  <button onClick={() => triggerMultiUpload(managingPhoto.id)} disabled={uploadingExtraFor === managingPhoto.id} className="aspect-square border border-dashed border-accent/50 hover:border-accent text-accent flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50">
                    {uploadingExtraFor === managingPhoto.id ? <span className="text-xs" style={MONO}>{u.activityUploading}</span> : <><Plus size={16} /><span className="text-[10px] text-center px-1" style={MONO}>{u.activityAddMore}</span></>}
                  </button>
                </div>
              </div>
              {/* captions */}
              <div className="space-y-2 pt-3 border-t border-border">
                <input value={managingPhoto.caption} onChange={(e) => updateActivityPhoto(managingPhoto.id, "caption", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground outline-none" style={MONO} placeholder="KO" />
                <input value={managingPhoto.captionEn} onChange={(e) => updateActivityPhoto(managingPhoto.id, "captionEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-muted-foreground outline-none" style={MONO} placeholder="EN" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MULTI-PHOTO GALLERY VIEWER (view mode) ── */}
      {gallery && galleryPhoto && (
        <div ref={galleryModalRef} tabIndex={-1} className="fixed inset-0 z-[300] bg-black/95 flex flex-col outline-none"
          onTouchStart={handleGalleryTouchStart} onTouchEnd={handleGalleryTouchEnd}
          onKeyDown={(e) => { if (e.key === "ArrowLeft") goGallery(-1); if (e.key === "ArrowRight") goGallery(1); }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
            <span className="text-xs text-white/50" style={MONO}>{gallery.index + 1} / {galleryKeys.length}</span>
            <button onClick={() => setGallery(null)} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white px-3 py-1.5 border border-white/20 hover:border-white/40 transition-colors" style={MONO}>
              <X size={13} />{u.lbClose}
            </button>
          </div>
          <div className="relative flex-1 overflow-hidden flex items-center justify-center">
            {img(galleryKeys[gallery.index]) && (
              <img src={img(galleryKeys[gallery.index])!} alt="" className="object-contain" style={{ maxWidth: "92vw", maxHeight: "calc(100dvh - 100px)" }} />
            )}
            {gallery.index > 0 && (
              <button onClick={() => goGallery(-1)} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 sm:p-2.5 rounded-full transition-colors">
                <ChevronLeft size={20} />
              </button>
            )}
            {gallery.index < galleryKeys.length - 1 && (
              <button onClick={() => goGallery(1)} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 sm:p-2.5 rounded-full transition-colors">
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
