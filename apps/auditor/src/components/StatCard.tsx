import type { ReactNode } from 'react';
import { tokens } from '@balotachain/ui';

export type StatCardProps = {
  label: string;
  value: ReactNode;
  caption: string;
  emphasize?: boolean;
};

export function StatCard({ label, value, caption, emphasize = false }: StatCardProps) {
  return (
    <div
      style={{
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.card,
        padding: tokens.space.md,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space.xs,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: tokens.color.text2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: emphasize ? tokens.type.h1 : tokens.type.body + 2,
          fontWeight: emphasize ? 700 : 600,
          color: tokens.color.text1,
          lineHeight: 1.2,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 13, color: tokens.color.text2 }}>{caption}</div>
    </div>
  );
}
