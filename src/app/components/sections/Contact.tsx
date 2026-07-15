import { Mail, Phone, Instagram, Globe, GripVertical, Check, Eye, EyeOff, Edit3, ArrowUpRight } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";
import { moveItem, hSize, type ContactItem } from "../../data";
import { ReorderButtons } from "../ReorderButtons";

type ContactProps = {
  contactItems: ContactItem[];
  setContactItems: React.Dispatch<React.SetStateAction<ContactItem[]>>;
  editingContactId: string | null;
  setEditingContactId: (id: string | null) => void;
  updateContact: (id: string, patch: Partial<ContactItem>) => void;
  toggleContactVisibility: (id: string) => void;
};

export function contactIcon(type: ContactItem["type"]) {
  if (type === "email") return <Mail size={16} />;
  if (type === "phone") return <Phone size={16} />;
  if (type === "instagram") return <Instagram size={16} />;
  return <Globe size={16} />;
}

export function Contact({ contactItems, setContactItems, editingContactId, setEditingContactId, updateContact, toggleContactVisibility }: ContactProps) {
  const { lang, u, MONO, SERIF, SANS, editMode, content, updateContent, c, dragSrc, dragOverKey, setDragOverKey, C } = usePortfolioContext();

  return (
    <section id="contact" className="py-16 sm:py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 items-start">
        <div>
          <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s07label" /></div>
          <h2 className={`font-light text-foreground leading-snug mb-6 sm:mb-8 whitespace-pre-line ${hSize("text-3xl sm:text-4xl lg:text-5xl", "text-4xl sm:text-5xl lg:text-6xl", lang)}`} style={SERIF}><C field="s07heading" /></h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed font-light" style={SANS}>
            {editMode ? <textarea value={lang === "ko" ? content.s07desc : content.s07descEn} onChange={(e) => updateContent(lang === "ko" ? "s07desc" : "s07descEn", e.target.value)} rows={4} className="bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full text-base text-muted-foreground leading-relaxed" style={SANS} /> : c("s07desc")}
          </p>
        </div>
        <div className="space-y-2">
          {contactItems.map((item, idx) => {
            const isEditingThis = editMode && editingContactId === item.id;
            if (!item.visible && !editMode) return null;
            return (
              <div key={item.id}
                draggable={editMode}
                onDragStart={() => { dragSrc.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("con-" + idx); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSrc.current !== null && dragSrc.current !== idx) {
                    setContactItems(prev => moveItem(prev, dragSrc.current!, idx));
                  }
                  dragSrc.current = null; setDragOverKey(null);
                }}
                onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                className={`border transition-all ${item.visible ? "border-border hover:border-accent/50" : "border-dashed border-border/30 opacity-40"}`}
                style={{ outline: dragOverKey === "con-" + idx ? "2px solid var(--accent)" : "none" }}>
                {isEditingThis ? (
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-2"><span className="text-accent">{contactIcon(item.type)}</span><span className="text-xs text-muted-foreground" style={MONO}>{lang === "ko" ? item.labelKo : item.labelEn}</span></div>
                    <div><p className="text-xs text-muted-foreground/50 mb-1" style={MONO}>{u.contactEditDisplay}</p><input value={item.display} onChange={(e) => updateContact(item.id, { display: e.target.value })} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground outline-none" /></div>
                    <div><p className="text-xs text-muted-foreground/50 mb-1" style={MONO}>{u.contactEditHref}</p><input value={item.href} onChange={(e) => updateContact(item.id, { href: e.target.value })} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} /></div>
                    <button onClick={() => setEditingContactId(null)} className="flex items-center gap-1.5 text-xs text-accent pt-1" style={MONO}><Check size={11} />완료</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group/ci">
                    {editMode && (
                      <div className="pl-3 sm:pl-4 flex items-center gap-0.5 text-accent/40 cursor-grab shrink-0">
                        <GripVertical size={13} />
                        <ReorderButtons
                          onMoveUp={() => setContactItems((prev) => moveItem(prev, idx, idx - 1))}
                          onMoveDown={() => setContactItems((prev) => moveItem(prev, idx, idx + 1))}
                          disableUp={idx === 0}
                          disableDown={idx === contactItems.length - 1}
                        />
                      </div>
                    )}
                    <a href={item.visible ? item.href : "#"} target={item.type === "email" || item.type === "phone" ? "_self" : "_blank"} rel="noopener noreferrer" className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 flex-1 transition-all ${!item.visible || editMode ? "pointer-events-none" : ""}`}>
                      <span className="text-muted-foreground group-hover/ci:text-accent transition-colors w-4 flex items-center justify-center shrink-0">{contactIcon(item.type)}</span>
                      <div><p className="text-xs text-muted-foreground mb-0.5" style={MONO}>{lang === "ko" ? item.labelKo : item.labelEn}</p><p className={`font-light text-foreground ${hSize("text-sm", "text-base", lang)}`}>{item.display}</p></div>
                      {item.visible && !editMode && <ArrowUpRight size={14} className="text-muted-foreground group-hover/ci:text-accent transition-colors ml-auto" />}
                    </a>
                    {editMode && <div className="flex items-center gap-1 pr-3 sm:pr-4 shrink-0"><button onClick={() => toggleContactVisibility(item.id)} className={`p-1.5 transition-colors ${item.visible ? "text-muted-foreground hover:text-foreground" : "text-accent"}`} title={item.visible ? u.contactHide : u.contactShow}>{item.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button><button onClick={() => setEditingContactId(item.id)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"><Edit3 size={13} /></button></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
