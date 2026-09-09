import type { ReactNode } from "react";
import { tokens } from "@balotachain/ui";

export type ChipVariant = "success" | "warn" | "neutral" | "teal";

export type ChipProps = {
  variant: ChipVariant;
  children: ReactNode;
  /** Leading status dot, as on the roster status chips. */
  dot?: boolean;
};

function palette(variant: ChipVariant): {
  bg: string;
  fg: string;
  border: string;
  dot: string;
} {
  switch (variant) {
    case "success":
      return {
        bg: tokens.color.successLight,
        fg: tokens.color.success,
        border: tokens.color.successBorder,
        dot: tokens.color.success,
      };
    case "warn":
      return {
        bg: tokens.color.warnLight,
        fg: tokens.color.warnText,
        border: tokens.color.warnBorder,
        dot: tokens.color.warn,
      };
    case "teal":
      return {
        bg: tokens.color.tealLight,
        fg: tokens.color.tealDark,
        border: tokens.color.tealBorder,
        dot: tokens.color.teal,
      };
    case "neutral":
    default:
      return {
        bg: "#F0F2F1",
        fg: tokens.color.text2,
        border: tokens.color.border,
        dot: tokens.color.muted,
      };
  }
}

export function Chip({ variant, children, dot = false }: ChipProps) {
  const c = palette(variant);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 11px",
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: tokens.radius.pill,
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {dot ? (
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: tokens.radius.pill,
            background: c.dot,
          }}
        />
      ) : null}
      {children}
    </span>
  );
}
