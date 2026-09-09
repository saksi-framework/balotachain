import type { ReactNode } from "react";
import { tokens } from "@balotachain/ui";

export type ChipVariant = "success" | "warn" | "error" | "neutral" | "teal";

export type ChipProps = {
  variant: ChipVariant;
  children: ReactNode;
  /** Leading status dot, as on the bulletin board's "Election Closed" badge. */
  dot?: boolean;
  /** The compact 11px "ELECTED" tag used inside result rows. */
  size?: "sm" | "md";
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
    case "error":
      return {
        bg: tokens.color.errorLight,
        fg: tokens.color.error,
        border: tokens.color.errorLight,
        dot: tokens.color.error,
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

export function Chip({
  variant,
  children,
  dot = false,
  size = "md",
}: ChipProps) {
  const c = palette(variant);
  const sm = size === "sm";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: sm ? "2px 8px" : "8px 16px",
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: tokens.radius.pill,
        fontSize: sm ? 11 : 14,
        fontWeight: sm ? 700 : 600,
        letterSpacing: sm ? 0.4 : 0,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {dot ? (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: tokens.radius.pill,
            background: c.dot,
          }}
        />
      ) : null}
      {children}
    </span>
  );
}
