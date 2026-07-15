import { usePortfolioContext } from "../../PortfolioContext";

export function Footer() {
  const { content, updateContent, c, editMode, MONO } = usePortfolioContext();
  return (
    <footer className="border-t border-border py-8 sm:py-12 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-12">
      {editMode ? (
        <>
          <div className="flex flex-col gap-1">
            <input value={content.footerCopyright} onChange={(e) => updateContent("footerCopyright", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="KO copyright" />
            <input value={content.footerCopyrightEn} onChange={(e) => updateContent("footerCopyrightEn", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground/60 outline-none" style={MONO} placeholder="EN copyright" />
          </div>
          <div className="flex flex-col gap-1">
            <input value={content.footerLocation} onChange={(e) => updateContent("footerLocation", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="KO location" />
            <input value={content.footerLocationEn} onChange={(e) => updateContent("footerLocationEn", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground/60 outline-none" style={MONO} placeholder="EN location" />
          </div>
        </>
      ) : (
        <><span className="text-xs text-muted-foreground" style={MONO}>{c("footerCopyright")}</span><span className="text-xs text-muted-foreground" style={MONO}>{c("footerLocation")}</span></>
      )}
    </footer>
  );
}
