import { useEffect, useRef } from "react";

// Reference-counted so multiple modals opening/closing in any order never
// leave body scroll stuck (a naive single save/restore breaks if a second
// modal opens before the first closes).
let lockCount = 0;
let originalOverflow = "";

function lockBodyScroll() {
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount++;
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = originalOverflow;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => el.offsetParent !== null); // skip hidden elements
}

// Locks background scroll, traps Tab focus inside the modal, restores focus to
// whatever was focused before on close, and closes on Escape — attach the
// returned ref to the modal's outermost element. Use for every full-screen
// overlay so the page never scrolls behind it and keyboard users can't tab
// into the page underneath.
export function useModalLock<T extends HTMLElement>(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const containerRef = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Defer one frame so the modal's contents are in the DOM before we query them.
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const first = focusableElements(container)[0];
      (first ?? container).focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCloseRef.current(); return; }
      if (e.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const focusables = focusableElements(container);
      if (focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      unlockBodyScroll();
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [active]);

  return containerRef;
}
