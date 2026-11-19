import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";
import { TextButton, tokens } from "@balotachain/ui";
import {
  ActionButton,
  Label,
  Lead,
  Notice,
  Screen,
  SecondaryAction,
} from "../components/Layout";
import {
  SIGNATURE_BOX,
  SIGNATURE_CAPS,
  SIGNATURE_MIN_STEP,
  SIGNATURE_TOO_LONG,
} from "../lib/checkin";
import type { ListEntry, ListSignature } from "../lib/live";
import { usePollWhileVisible } from "../lib/usePoll";
import { useConfirmStep } from "../components/useConfirmStep";
import { CHECKIN_POLL_MS, EntryCard, PollTrouble } from "./CheckIn";

type Point = [number, number];

/**
 * Screen 5: the voter signs the election-day list, or records "I cannot
 * sign" (voter-list-api.md, "The signature"), as a precinct records a
 * thumbmark. Reads the check-in meanwhile, so a reset by the presenter
 * takes the phone back to the check-in.
 *
 * The drawing is numbers only: each stroke a list of integer points in the
 * console's 1000 x 400 box, within its caps, checked here before sending.
 * The strokes live in this screen's state and go when it does (after a
 * successful send the app moves on to the credential).
 */
export function Sign({
  title,
  entry,
  busy,
  error,
  onSign,
  onCheck,
  pollMs = CHECKIN_POLL_MS,
}: {
  title: string;
  entry: ListEntry | undefined;
  busy: boolean;
  error: string | null;
  onSign: (signature: ListSignature) => void;
  onCheck: () => Promise<void>;
  pollMs?: number;
}) {
  const { failures, lastError } = usePollWhileVisible(onCheck, {
    intervalMs: pollMs,
    enabled: !busy,
  });
  const [sending, setSending] = useState<"strokes" | "cannot" | null>(null);
  // m7: "I cannot sign" asks once, inline, as "Encrypt again anyway" does:
  // one stray tap must not end the signature step.
  const { confirming, ready, region, ask, cancel } = useConfirmStep();
  const [strokes, setStrokesState] = useState<Point[][]>([]);
  /** The same strokes, read by the pointer handlers between renders. */
  const current = useRef<Point[][]>([]);
  const setStrokes = useCallback((next: Point[][]) => {
    current.current = next;
    setStrokesState(next);
  }, []);
  const [tooLong, setTooLong] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  /** The stroke being drawn, by the pointer that draws it. */
  const drawing = useRef<{ pointerId: number } | null>(null);

  const empty = strokes.length === 0;

  /** A pointer position as a point of the 1000 x 400 box, inside it. */
  const toBox = useCallback((clientX: number, clientY: number): Point => {
    const r = canvas.current!.getBoundingClientRect();
    const fit = (v: number, max: number) =>
      Math.min(max, Math.max(0, Math.round(v)));
    return [
      fit(((clientX - r.left) / (r.width || 1)) * SIGNATURE_BOX.width, 1000),
      fit(((clientY - r.top) / (r.height || 1)) * SIGNATURE_BOX.height, 400),
    ];
  }, []);

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (busy || !e.isPrimary) return;
    // No scroll, no text selection, no synthetic mouse events while drawing.
    e.preventDefault();
    const s = current.current;
    if (
      tooLong ||
      s.length >= SIGNATURE_CAPS.strokes ||
      s.reduce((n, x) => n + x.length, 0) >= SIGNATURE_CAPS.points
    ) {
      setTooLong(true);
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawing.current = { pointerId: e.pointerId };
    const p = toBox(e.clientX, e.clientY);
    setStrokes([...current.current, [p]]);
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (drawing.current?.pointerId !== e.pointerId) return;
    e.preventDefault();
    const p = toBox(e.clientX, e.clientY);
    const s = current.current;
    const last = s[s.length - 1]!;
    const [lx, ly] = last[last.length - 1]!;
    if (Math.hypot(p[0] - lx, p[1] - ly) < SIGNATURE_MIN_STEP) return;
    const total = s.reduce((n, x) => n + x.length, 0);
    if (
      last.length >= SIGNATURE_CAPS.pointsPerStroke ||
      total >= SIGNATURE_CAPS.points
    ) {
      // Past a cap: the stroke ends here and the page will not send it.
      drawing.current = null;
      setTooLong(true);
      return;
    }
    setStrokes([...s.slice(0, -1), [...last, p]]);
  }

  function up(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (drawing.current?.pointerId !== e.pointerId) return;
    drawing.current = null;
  }

  function clear() {
    drawing.current = null;
    setStrokes([]);
    setTooLong(false);
  }

  // Draw the strokes from the numbers, scaled to the box's pixels.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext?.("2d");
    if (!c || !ctx) return;
    const dpr = globalThis.devicePixelRatio || 1;
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = tokens.color.text1;
    ctx.fillStyle = tokens.color.text1;
    ctx.lineWidth = 2.5 * dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const sx = c.width / SIGNATURE_BOX.width;
    const sy = c.height / SIGNATURE_BOX.height;
    for (const s of strokes) {
      const [x0, y0] = s[0]!;
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(x0 * sx, y0 * sy, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(x0 * sx, y0 * sy);
      for (const [x, y] of s.slice(1)) ctx.lineTo(x * sx, y * sy);
      ctx.stroke();
    }
  }, [strokes]);

  // Redraw at the new size when the box is resized (a rotation).
  useEffect(() => {
    const c = canvas.current;
    if (!c || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setStrokesState((s) => [...s]));
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const name = `Signature box: draw your signature with a finger or a mouse. ${
    empty
      ? "It is empty."
      : `${strokes.length} ${strokes.length === 1 ? "stroke" : "strokes"} drawn.`
  }`;

  return (
    <Screen
      title={title}
      footer={
        <>
          <ActionButton
            onClick={() => {
              if (empty || tooLong) return;
              setSending("strokes");
              onSign({ strokes });
            }}
            disabled={empty || tooLong || busy}
            busy={busy && sending === "strokes"}
            busyLabel="Signing…"
          >
            Sign the list
          </ActionButton>
          {/* Stays in place, but off while the question is open, so only one
              "I cannot sign" control can be pressed at a time. */}
          <SecondaryAction
            id="cannot-sign"
            onClick={ask}
            disabled={busy || confirming}
            aria-expanded={confirming}
            aria-controls="confirm-cannot-sign"
          >
            I cannot sign
          </SecondaryAction>
        </>
      }
    >
      <Lead title="Sign the election-day list">
        The Electoral Board confirmed who you are. Sign the list to get your
        ballot.
      </Lead>
      {entry ? <EntryCard entry={entry} /> : null}
      <Label>Your signature</Label>
      <canvas
        ref={canvas}
        className="ba-sign-box"
        role="img"
        aria-label={name}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
      />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <TextButton
          onClick={clear}
          disabled={empty || busy}
          style={{ minHeight: 44, minWidth: 44, padding: "8px 4px" }}
        >
          Clear
        </TextButton>
      </div>
      {tooLong ? <Notice tone="error">{SIGNATURE_TOO_LONG}</Notice> : null}
      <p
        style={{
          margin: `${tokens.space.sm}px 0`,
          fontSize: "var(--ba-type-note)",
          color: tokens.color.text2,
        }}
      >
        If you cannot sign, tap “I cannot sign”. The list then records that you
        could not sign, as a precinct records a thumbmark.
      </p>
      <div id="confirm-cannot-sign">
        {confirming ? (
          <div
            ref={region}
            role="group"
            tabIndex={-1}
            aria-labelledby="confirm-cannot-sign-text"
            className="ba-stack"
            style={{ gap: tokens.space.sm, outline: "none" }}
          >
            <p
              id="confirm-cannot-sign-text"
              style={{
                margin: 0,
                color: tokens.color.text1,
                fontSize: "var(--ba-type-note)",
              }}
            >
              The Electoral Board will record on the list that you could not
              sign. You then get your ballot.
            </p>
            <ActionButton
              onClick={() => {
                if (!ready || busy) return;
                setSending("cannot");
                onSign({ cannotSign: true });
              }}
              disabled={!ready}
              busy={busy && sending === "cannot"}
              busyLabel="Sending…"
            >
              Yes, record that I cannot sign
            </ActionButton>
            <TextButton
              onClick={() => {
                // Enabled again before it takes the focus.
                flushSync(cancel);
                document.getElementById("cannot-sign")?.focus();
              }}
              disabled={busy}
              style={{ minHeight: 44, alignSelf: "center" }}
            >
              Back to the signature
            </TextButton>
          </div>
        ) : null}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <PollTrouble failures={failures} lastError={lastError} />
    </Screen>
  );
}
