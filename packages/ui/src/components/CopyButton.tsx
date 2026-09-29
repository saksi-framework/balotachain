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
 * The outlined copy control. After a successful copy it turns teal and reads
 * "Copied" for 2 s; if the clipboard refuses, it stays on "Copy" rather than
 * claim a copy that did not happen.
 */
export function CopyButton({
  value,
  label = "Copy",
  size = "md",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // clipboard unavailable (insecure origin, sandboxed webview)
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  const g = geometry[size];
  const Glyph = copied ? CheckIcon : CopyIcon;
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? "Copied" : label}
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
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
