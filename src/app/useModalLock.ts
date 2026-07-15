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

// Locks background scroll and closes on Escape while `active` — use for every
// full-screen overlay/modal so the page never scrolls behind an open popup.
export function useModalLock(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);
}
