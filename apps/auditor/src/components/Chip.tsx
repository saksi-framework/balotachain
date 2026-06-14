import type { ReactNode } from 'react';
import { tokens } from '@balotachain/ui';

export type ChipVariant = 'success' | 'warn' | 'error' | 'neutral';

export type ChipProps = {
  variant: ChipVariant;
  children: ReactNode;
};

function palette(variant: ChipVariant): { bg: string; fg: string; border: string } {
  switch (variant) {
    case 'success':
      return {
        bg: 'rgba(46, 125, 91, 0.12)',
        fg: tokens.color.success,
        border: 'rgba(46, 125, 91, 0.24)',
      };
    case 'warn':
      return {
        bg: 'rgba(200, 133, 26, 0.12)',
        fg: tokens.color.warn,
        border: 'rgba(200, 133, 26, 0.28)',
      };
    case 'error':
      return {
        bg: 'rgba(192, 57, 43, 0.10)',
        fg: tokens.color.error,
        border: 'rgba(192, 57, 43, 0.24)',
      };
    case 'neutral':
    default:
      return {
        bg: tokens.color.bg,
        fg: tokens.color.text2,
        border: tokens.color.border,
      };
  }
}

export function Chip({ variant, children }: ChipProps) {
  const { bg, fg, border } = palette(variant);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        borderRadius: tokens.radius.pill,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}
