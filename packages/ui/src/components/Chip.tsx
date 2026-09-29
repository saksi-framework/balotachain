import type { CSSProperties, ReactNode } from "react";
import { tokens } from "../tokens.js";

export type ChipVariant =
  | "neutral"
  | "active"
  | "success"
  | "warning"
  | "error";

export type ChipProps = {
  variant: ChipVariant;
  /** The status word. Required: status is never colour alone. */
  children: ReactNode;
  /** Leading status dot, as on the roster and the board's closed badge. */
  dot?: boolean;
  /**
   * `sm` the uppercase tag inside result rows, `md` the roster chip,
   * `lg` the bulletin board's election badge.
   */
  size?: "sm" | "md" | "lg";
};

const c = tokens.color;
const palette: Record<
  ChipVariant,
  { bg: string; fg: string; border: string; dot: string }
> = {
  neutral: {
    bg: c.neutralFill,
    fg: c.text2,
    border: c.border,
    dot: c.neutralDot,
  },
  active: {
    bg: c.tealLight,
    fg: c.tealDark,
    border: c.tealBorder,
    dot: c.teal,
  },
  success: {
    bg: c.successLight,
    fg: c.successText,
    border: c.successBorder,
    dot: c.success,
  },
  warning: {
    bg: c.warnLight,
    fg: c.warnText,
    border: c.warnBorder,
    dot: c.warn,
  },
  error: { bg: c.errorLight, fg: c.error, border: c.errorLight, dot: c.error },
};

const sizes: Record<NonNullable<ChipProps["size"]>, CSSProperties> = {
  sm: {
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    gap: 6,
  },
  md: { padding: "4px 11px", fontSize: 12.5, fontWeight: 600, gap: 6 },
  lg: { padding: "8px 16px", fontSize: 14, fontWeight: 600, gap: 8 },
};

export function Chip({
  variant,
  children,
  dot = false,
  size = "md",
}: ChipProps) {
  const p = palette[variant];
  const dotSize = size === "lg" ? 8 : 7;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        borderRadius: tokens.radius.pill,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "background 200ms, color 200ms, border-color 200ms",
        ...sizes[size],
      }}
    >
      {dot ? (
        <span
          aria-hidden
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: tokens.radius.pill,
            background: p.dot,
          }}
        />
      ) : null}
      {children}
    </span>
  );
}
