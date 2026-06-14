import { tokens } from '@balotachain/ui';

export type ResultBarProps = {
  percent: number;
  dimmed?: boolean;
};

export function ResultBar({ percent, dimmed = false }: ResultBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      style={{
        width: '100%',
        height: 8,
        background: tokens.color.tealLight,
        borderRadius: tokens.radius.pill,
        overflow: 'hidden',
        opacity: dimmed ? 0.5 : 1,
      }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          background: tokens.color.teal,
          borderRadius: tokens.radius.pill,
          transition: 'width 240ms ease',
        }}
      />
    </div>
  );
}
