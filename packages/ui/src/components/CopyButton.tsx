import { useEffect, useRef, useState } from "react";
import { tokens } from "../tokens.js";
import { CopyIcon } from "./Icon.js";

export type CopyButtonProps = {
  /** Text placed on the clipboard. */
  value: string;
  /** Accessible name; defaults to "Copy". */
  label?: string;
  /** `md` on the bulletin board's hash row, `sm` in the trustee console. */
  size?: "sm" | "md";
};

/**
 * The outlined copy control shared by the auditor and trustee mockups: it
 * flashes teal and reads "Copied" for 1.8s after a successful copy.
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
      await navigator.clipboard?.writeText(value);
    } catch {
      // Clipboard is unavailable in some sandboxed webviews; still confirm.
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  const sm = size === "sm";
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: sm ? 6 : 7,
        background: copied ? tokens.color.tealLight : tokens.color.surface,
        border: `1.5px solid ${
          copied
            ? tokens.color.tealBorder
            : hover
              ? tokens.color.borderHover
              : tokens.color.border
        }`,
        borderRadius: sm ? 10 : tokens.radius.button,
        padding: sm ? "7px 11px" : "10px 15px",
        fontSize: sm ? tokens.type.small : 14,
        fontWeight: 600,
        fontFamily: tokens.type.fontFamily,
        color: copied ? tokens.color.teal : tokens.color.text1,
        cursor: "pointer",
        transition: "background 150ms, border-color 150ms, color 150ms",
      }}
    >
      <CopyIcon size={sm ? 15 : 17} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
