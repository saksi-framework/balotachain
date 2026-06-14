import type { CSSProperties, ReactNode } from "react";
import { tokens } from "@balotachain/ui";

export type CardProps = {
  children: ReactNode;
  style?: CSSProperties;
};

export function Card({ children, style }: CardProps) {
  return (
    <section
      style={{
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.card,
        boxShadow: tokens.shadow.card,
        padding: tokens.space.md,
        ...style,
      }}
    >
      {children}
    </section>
  );
}
