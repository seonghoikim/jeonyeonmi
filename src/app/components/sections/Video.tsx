import { Plus, GripVertical, Maximize2, Play, Trash2, Edit3, Check } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";
import { moveItem, hSize, getYoutubeId, type VideoEntry } from "../../data";
import { ReorderButtons } from "../ReorderButtons";

type VideoProps = {
  videoList: VideoEntry[];
  setVideoList: React.Dispatch<React.SetStateAction<VideoEntry[]>>;
  editingVideoId: number | null;
  setEditingVideoId: (id: number | null) => void;
  playingVideoId: number | null;
  setPlayingVideoId: (id: number | null) => void;
  setFullscreenVideoYtId: (id: string | null) => void;
  addVideo: () => void;
  updateVideoField: (id: number, f: keyof VideoEntry, v: string) => void;
  deleteVideo: (id: number) => void;
};

export function Video({
  videoList, setVideoList, editingVideoId, setEditingVideoId, playingVideoId, setPlayingVideoId,
  setFullscreenVideoYtId, addVideo, updateVideoField, deleteVideo,
}: VideoProps) {
  const { lang, u, MONO, SERIF, editMode, dragSrc, dragOverKey, setDragOverKey, C } = usePortfolioContext();

  return (
    <section id="videos" className="py-16 sm:py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex items-end justify-between mb-10 sm:mb-12">
          <div>
            <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s06label" /></div>
            <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s06heading" /></h2>
          </div>
          {editMode && <button onClick={addVideo} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.videoAdd}</span></button>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-background">
          {videoList.map((vid, idx) => {
            const youtubeId = getYoutubeId(vid.youtubeUrl);
            const isEditing = editMode && editingVideoId === vid.id;
            return (
              <div key={vid.id}
                draggable={editMode}
                onDragStart={() => { dragSrc.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("vid-" + idx); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSrc.current !== null && dragSrc.current !== idx) {
                    setVideoList(prev => moveItem(prev, dragSrc.current!, idx));
                  }
                  dragSrc.current = null; setDragOverKey(null);
                }}
                onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                className="group bg-background flex flex-col"
                style={{ outline: dragOverKey === "vid-" + idx ? "2px solid var(--accent)" : "none" }}>
                <div className="relative aspect-video overflow-hidden bg-background">
                  {editMode && <div className="absolute top-1.5 left-1.5 z-10 text-accent/60 cursor-grab"><GripVertical size={14} /></div>}
                  {editMode && (
                    <ReorderButtons
                      className="absolute top-1.5 right-1.5 z-10 bg-background/70"
                      onMoveUp={() => setVideoList((prev) => moveItem(prev, idx, idx - 1))}
                      onMoveDown={() => setVideoList((prev) => moveItem(prev, idx, idx + 1))}
                      disableUp={idx === 0}
                      disableDown={idx === videoList.length - 1}
                    />
                  )}
                  {playingVideoId === vid.id && youtubeId ? (
                    <>
                      <iframe
                        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full border-0"
                      />
                      <button
                        onClick={() => setFullscreenVideoYtId(youtubeId)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/90 text-white/70 hover:text-white transition-all z-10"
                        title="전체화면">
                        <Maximize2 size={13} />
                      </button>
                    </>
                  ) : youtubeId ? (
                    <>
                      <img src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`} alt={vid.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100" loading="lazy" decoding="async" />
                      <div className="absolute inset-0 bg-background/20 group-hover:bg-background/10 transition-colors" />
                      {!isEditing && <button onClick={() => setPlayingVideoId(vid.id)} className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-full bg-background/80 border border-foreground/20 flex items-center justify-center transition-all duration-300 group-hover:bg-background/95 group-hover:scale-110"><Play size={18} className="text-foreground ml-1" fill="currentColor" /></div>
                      </button>}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-background"><span className="text-xs text-muted-foreground" style={MONO}>{u.videoUrlPh}</span></div>
                  )}
                  {editMode && <button onClick={() => deleteVideo(vid.id)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-background/80 hover:bg-background text-foreground p-1.5 transition-all z-10"><Trash2 size={13} /></button>}
                </div>
                <div className="p-4 sm:p-5 flex flex-col gap-2 flex-1">
                  {isEditing ? (
                    <div className="space-y-2 flex-1">
                      <input value={vid.youtubeUrl} onChange={(e) => updateVideoField(vid.id, "youtubeUrl", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder={u.videoUrlPh} />
                      <input value={vid.title} onChange={(e) => updateVideoField(vid.id, "title", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" style={SERIF} placeholder="제목" />
                      <input value={vid.titleEn} onChange={(e) => updateVideoField(vid.id, "titleEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none" style={MONO} placeholder="English title" />
                      <input value={vid.description} onChange={(e) => updateVideoField(vid.id, "description", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="설명 KO" />
                      <input value={vid.descriptionEn} onChange={(e) => updateVideoField(vid.id, "descriptionEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground/70 outline-none" placeholder="Description EN" />
                      <button onClick={() => setEditingVideoId(null)} className="flex items-center gap-1.5 text-xs text-accent mt-2" style={MONO}><Check size={11} />완료</button>
                    </div>
                  ) : (
                    <><h3 className={`font-light text-foreground leading-snug ${hSize("text-sm", "text-base", lang)}`} style={SERIF}>{lang === "ko" ? vid.title : vid.titleEn}</h3><p className="text-xs text-muted-foreground" style={MONO}>{lang === "ko" ? vid.description : vid.descriptionEn}</p>{editMode && <button onClick={() => setEditingVideoId(vid.id)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-auto pt-2" style={MONO}><Edit3 size={11} />편집</button>}</>
                  )}
                </div>
              </div>
            );
          })}
          {editMode && <button onClick={addVideo} className="group aspect-video bg-background border border-dashed border-border hover:border-accent transition-colors flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-accent"><Plus size={24} /><span className="text-xs tracking-widest" style={MONO}>{u.videoAdd}</span></button>}
        </div>
      </div>
    </section>
  );
}
