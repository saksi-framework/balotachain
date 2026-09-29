import { tokens } from "../tokens.js";

export type SkeletonProps = {
  /** What is loading, read to screen readers ("Loading the ceremony…"). */
  label: string;
  /** Placeholder line widths in percent. */
  lines?: number[];
};

/** Grey placeholder lines while a data view loads, never a spinner alone. */
export function Skeleton({ label, lines = [70, 100, 85] }: SkeletonProps) {
  return (
    <div role="status" aria-label={label} style={{ display: "grid", gap: 12 }}>
      {lines.map((w, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            display: "block",
            height: 14,
            width: `${w}%`,
            borderRadius: 8,
            background: tokens.color.neutralFill,
          }}
        />
      ))}
    </div>
  );
}
