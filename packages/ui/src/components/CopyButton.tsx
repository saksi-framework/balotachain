import { useEffect, useRef, useState } from "react";
import { tokens } from "../tokens.js";
import { CheckIcon, CopyIcon } from "./Icon.js";

export type CopyButtonProps = {
  /** Text placed on the clipboard. */
  value: string;
  /** Accessible name; defaults to "Copy". */
  label?: string;
  /**
   * `md` on the bulletin board's hash row, `sm` in the trustee console and
   * inside VerifiableValue, `xs` in admin's dense tables.
   */
  size?: "xs" | "sm" | "md";
};

const geometry = {
  xs: { gap: 4, radius: 8, padding: "4px 8px", font: 12, icon: 14 },
  sm: {
    gap: 6,
    radius: 10,
    padding: "7px 11px",
    font: tokens.type.small,
    icon: 15,
  },
  md: {
    gap: 7,
    radius: tokens.radius.button,
    padding: "10px 15px",
    font: 14,
    icon: 17,
  },
} as const;

/**
 * Put `value` on the clipboard. The async Clipboard API is missing on a
 * plain-http LAN origin, so fall back to a hidden textarea + execCommand.
 * Resolves true only when a copy actually happened.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * The outlined copy control. After a successful copy it turns teal and reads
 * "Copied" for 2 s; if no copy path works it reads "Copy failed" for 2 s
 * rather than claim a copy that did not happen.
 */
export function CopyButton({
  value,
  label = "Copy",
  size = "md",
}: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copied = state === "copied";
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function onCopy() {
    setState((await copyText(value)) ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  const g = geometry[size];
  const Glyph = copied ? CheckIcon : CopyIcon;
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={state === "idle" ? label : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: g.gap,
        background: copied ? tokens.color.tealLight : tokens.color.surface,
        border: `1.5px solid ${
          copied
            ? tokens.color.tealBorder
            : hover
              ? tokens.color.borderHover
              : tokens.color.border
        }`,
        borderRadius: g.radius,
        padding: g.padding,
        fontSize: g.font,
        fontWeight: 600,
        fontFamily: tokens.type.fontFamily,
        lineHeight: 1.2,
        color: copied ? tokens.color.tealDark : tokens.color.text1,
        cursor: "pointer",
        transition: "background 100ms, border-color 100ms, color 100ms",
      }}
    >
      <Glyph size={g.icon} />
      <span aria-live="polite">
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Copy failed"
            : "Copy"}
      </span>
    </button>
  );
}
