import type { KeyboardEvent } from "react";

// Props that make a click-only <div> reachable and operable from the keyboard
// (Tab to focus, Enter/Space to activate). Only applied when `active` — e.g. not
// in edit mode, where the same element is a drag handle / upload target.
// Ignores key presses that bubble up from nested controls (delete, reorder…).
export function pressableProps(active: boolean, onActivate: () => void, label?: string) {
  if (!active) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
