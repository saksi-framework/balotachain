import { useCallback, useEffect, useRef, useState } from "react";

/**
 * After the first tap ("Submit anyway…", "Encrypt again anyway"), the
 * confirm button stays disabled this long, so the second tap of a quick
 * double tap cannot reach it. Not an animation, so it applies with reduced
 * motion too.
 */
export const CONFIRM_DELAY_MS = 800;

function prefersReducedMotion(): boolean {
  try {
    return (
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false
    );
  } catch {
    return false;
  }
}

/**
 * The two-step confirm used after a failed check (task 5b-1, D12): a first
 * tap shows an inline block (a sentence and a confirm button) elsewhere on
 * the screen; the confirm button is enabled after `CONFIRM_DELAY_MS`.
 *
 * The block may be scrolled out of view, so when it appears it is brought
 * into view and focused (the region, not the button, which is still
 * disabled), so a screen reader reads its sentence. A later first-button tap
 * (the second of a double tap) reveals the block again; it never confirms.
 */
export function useConfirmStep() {
  const [confirming, setConfirming] = useState(false);
  const [ready, setReady] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setReady(true), CONFIRM_DELAY_MS);
    return () => clearTimeout(t);
  }, [confirming]);
  const reveal = useCallback(() => {
    const el = region.current;
    if (!el) return;
    el.scrollIntoView?.({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    el.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (confirming) reveal();
  }, [confirming, reveal]);
  /** The first button's tap: show the block, or bring it back into view. */
  const ask = useCallback(() => {
    if (confirming) reveal();
    else setConfirming(true);
  }, [confirming, reveal]);
  /** The way back: the block closes, and the next ask waits again. */
  const cancel = useCallback(() => {
    setConfirming(false);
    setReady(false);
  }, []);
  return { confirming, ready, region, ask, cancel };
}
