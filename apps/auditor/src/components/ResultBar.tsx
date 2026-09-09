import { tokens } from "@balotachain/ui";

export type ResultBarProps = {
  percent: number;
  /** Leading candidates get the solid teal bar; the rest get the muted one. */
  dimmed?: boolean;
};

export function ResultBar({ percent, dimmed = false }: ResultBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      style={{
        width: "100%",
        height: 8,
        background: tokens.color.neutralFill,
        borderRadius: tokens.radius.pill,
        overflow: "hidden",
      }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: "100%",
          background: dimmed ? tokens.color.neutralBar : tokens.color.teal,
          borderRadius: tokens.radius.pill,
          transition: "width 240ms ease",
        }}
      />
    </div>
  );
}
