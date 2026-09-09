import type { CSSProperties, ReactNode } from "react";
import { tokens } from "../tokens.js";

export type CardProps = {
  children: ReactNode;
  style?: CSSProperties;
  /** Drop the built-in padding so the card can own its own inner layout. */
  flush?: boolean;
};

/**
 * The surface used by every panel in the auditor and trustee mockups:
 * white, 1px border, 16px radius, soft lift. Identical in both designs, so it
 * lives here rather than being duplicated per app.
 */
export function Card({ children, style, flush = false }: CardProps) {
  return (
    <section
      style={{
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.card,
        boxShadow: tokens.shadow.card,
        padding: flush ? 0 : tokens.space.md,
        ...style,
      }}
    >
      {children}
    </section>
  );
}
