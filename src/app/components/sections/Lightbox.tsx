import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";

type LightboxProps = {
  src: string;
  scale: number;
  offset: { x: number; y: number };
  dragging: boolean;
  showZoom: boolean;
  onClose: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onDoubleClick: () => void;
};

export function Lightbox({
  src, scale, offset, dragging, showZoom, onClose, onZoomIn, onZoomOut, onReset,
  onWheel, onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd, onDoubleClick,
}: LightboxProps) {
  const { u, MONO } = usePortfolioContext();
  return (
    <div className="fixed inset-0 z-[300] bg-black/97 flex flex-col">
      {/* toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1">
          {showZoom && (<>
            <button onClick={onZoomOut} disabled={scale <= 0.25}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-white/50 w-12 text-center" style={MONO}>{Math.round(scale * 100)}%</span>
            <button onClick={onZoomIn} disabled={scale >= 8}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ZoomIn size={16} />
            </button>
            <button onClick={onReset} className="p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors ml-1" title={u.lbReset}>
              <RotateCcw size={14} />
            </button>
            <span className="text-xs text-white/30 ml-3 hidden sm:block" style={MONO}>{u.lbHint}</span>
          </>)}
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white px-3 py-1.5 border border-white/20 hover:border-white/40 transition-colors" style={MONO}>
          <X size={13} />{u.lbClose}
        </button>
      </div>
      {/* canvas */}
      <div className="flex-1 overflow-hidden flex items-center justify-center"
        style={{ cursor: dragging ? "grabbing" : scale > 1 ? "grab" : "default", touchAction: "none" }}
        onWheel={showZoom ? onWheel : (e) => e.preventDefault()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={onDoubleClick}>
        <img src={src} alt=""
          draggable={false}
          className={`pointer-events-none lb-img ${dragging ? "dragging" : ""}`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            maxWidth: scale <= 1 ? "min(92vw, 1200px)" : "none",
            maxHeight: scale <= 1 ? "calc(100dvh - 60px)" : "none",
          }} />
      </div>
      {/* hint overlay on first open */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="text-xs text-white/20" style={MONO}>{Math.round(scale * 100)}% · double-tap to zoom</span>
      </div>
    </div>
  );
}
