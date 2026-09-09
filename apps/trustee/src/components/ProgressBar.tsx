import { tokens } from "@balotachain/ui";

export type ProgressBarProps = {
  value: number;
  max: number;
};

/** The quorum meter: 10px neutral track with a teal fill. */
export function ProgressBar({ value, max }: ProgressBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      style={{
        width: "100%",
        height: 10,
        background: tokens.color.neutralFill,
        borderRadius: tokens.radius.pill,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          background: tokens.color.teal,
          borderRadius: tokens.radius.pill,
          transition: "width 500ms cubic-bezier(.33,0,.2,1)",
        }}
      />
    </div>
  );
}
