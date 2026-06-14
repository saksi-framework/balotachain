import { type CSSProperties } from "react";
import { tokens } from "../tokens.js";

export type PageDotsProps = {
  count: number;
  current: number;
};

export function PageDots({ count, current }: PageDotsProps) {
  const wrap: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: tokens.space.xs,
  };

  return (
    <div role="tablist" aria-label="Pages" style={wrap}>
      {Array.from({ length: count }, (_, i) => {
        const active = i === current;
        const dot: CSSProperties = {
          width: 8,
          height: 8,
          borderRadius: tokens.radius.pill,
          background: active ? tokens.color.teal : "transparent",
          border: active
            ? `1px solid ${tokens.color.teal}`
            : `1px solid ${tokens.color.border}`,
          transition: "background 120ms ease, border-color 120ms ease",
        };
        return (
          <span
            key={i}
            role="tab"
            aria-selected={active}
            aria-label={`Page ${i + 1} of ${count}`}
            style={dot}
          />
        );
      })}
    </div>
  );
}
