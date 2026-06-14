import { tokens } from '@balotachain/ui';

export type ProgressBarProps = {
  value: number;
  max: number;
};

export function ProgressBar({ value, max }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      style={{
        width: '100%',
        height: 12,
        background: tokens.color.tealLight,
        borderRadius: tokens.radius.pill,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          background: tokens.color.teal,
          borderRadius: tokens.radius.pill,
          transition: 'width 240ms ease-out',
        }}
      />
    </div>
  );
}
