import { ChevronUp, ChevronDown } from "lucide-react";

// Touch/mouse-agnostic reordering — native HTML5 drag-and-drop (still wired
// alongside this) only works with a mouse, so these buttons are what makes
// reordering possible on mobile. "Up" = earlier in the list, "down" = later,
// regardless of whether the item's own layout is a vertical list or a grid.
type ReorderButtonsProps = {
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
  className?: string;
};

export function ReorderButtons({ onMoveUp, onMoveDown, disableUp, disableDown, className = "" }: ReorderButtonsProps) {
  return (
    <div className={`flex flex-col ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={disableUp}
        title="앞으로 이동"
        aria-label="앞으로 이동"
        className="text-accent/70 hover:text-accent disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
      >
        <ChevronUp size={13} />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={disableDown}
        title="뒤로 이동"
        aria-label="뒤로 이동"
        className="text-accent/70 hover:text-accent disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
      >
        <ChevronDown size={13} />
      </button>
    </div>
  );
}
