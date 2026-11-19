import { useEffect } from "react";

/**
 * How much shorter than the tallest seen the visible area must get, with a
 * text field focused, to count as the on-screen keyboard. Above the 56px a
 * collapsing browser toolbar takes, below any phone keyboard.
 */
export const KEYBOARD_MIN_PX = 120;

function isTextField(el: Element | null): el is HTMLElement {
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "submit", "reset", "hidden"].includes(
    el.type,
  );
}

/**
 * The height a reader can see now: `visualViewport.height * scale` (so pinch
 * zoom does not count), or `innerHeight` where there is no visual viewport.
 * The keyboard hook and the footer's height rule (Screen) both use it.
 */
export function visibleHeight(): number {
  const vv = window.visualViewport;
  return vv ? vv.height * vv.scale : window.innerHeight;
}

/**
 * The full height of the layout viewport at width `w` when nothing is known
 * about it yet (the phone was rotated while a field was focused): the
 * screen's side that matches the orientation. It includes the browser's own
 * bars, so it errs toward "keyboard open", and only while a field is focused.
 */
function guessFullHeight(w: number): number {
  const long = Math.max(window.screen.width, window.screen.height);
  const short = Math.min(window.screen.width, window.screen.height);
  return w > short + 1 ? short : long;
}

/**
 * D16: while the on-screen keyboard is open, `data-keyboard="open"` sits on
 * the root element, and vote.css lets the pinned footer join the page flow
 * so it never covers the field. A focused field is scrolled into view when
 * the keyboard opens.
 *
 * Two ways a keyboard shows:
 * - The layout viewport shrinks (`interactive-widget=resizes-content`,
 *   Chrome on Android): `innerHeight` drops below the full height.
 * - It does not (Safari on iOS lays the keyboard over the page): only the
 *   visual viewport shrinks.
 * Both read as the visible height (`visibleHeight`) against the full height
 * at the current width. The full height is the tallest `innerHeight` seen at
 * that width with no field focused, kept per width so a rotation and back
 * keeps it (m2 of the 5c-2 review). After a rotation with a field focused
 * (the keyboard may already be up) it is guessed from the screen's size
 * until the field is left. Screens shorter than 500px are handled by
 * vote.css alone.
 */
export function useKeyboardOpen(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    /** Width -> tallest `innerHeight` seen there with no field focused. */
    const full = new Map<number, number>();
    let open = false;

    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const field = document.activeElement;
      const typing = isTextField(field);
      if (!typing) full.set(w, Math.max(full.get(w) ?? 0, h));
      const tallest = Math.max(full.get(w) ?? guessFullHeight(w), h);
      const now = typing && tallest - visibleHeight() > KEYBOARD_MIN_PX;
      if (now === open) return;
      open = now;
      if (open) {
        root.dataset.keyboard = "open";
        // The footer has just left the bottom; bring the field into view.
        field?.scrollIntoView({ block: "center" });
      } else {
        delete root.dataset.keyboard;
      }
    };

    // The full height before any field is focused.
    update();
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    // No focusout: moving from one field to the next would close and open
    // it again; a keyboard that closes shows as a resize instead.
    document.addEventListener("focusin", update);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      delete root.dataset.keyboard;
    };
  }, []);
}
