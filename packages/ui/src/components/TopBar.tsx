import { type CSSProperties, type ReactNode } from 'react';
import { tokens } from '../tokens.js';
import { BackIcon } from './Icon.js';

export type TopBarProps = {
  title: string;
  back?: () => void;
  right?: ReactNode;
};

export function TopBar({ title, back, right }: TopBarProps) {
  const bar: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
    height: 56,
    padding: `0 ${tokens.space.sm}px`,
    background: tokens.color.surface,
    borderBottom: `1px solid ${tokens.color.border}`,
  };

  const slot: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    minWidth: 40,
  };

  const backBtn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    border: 'none',
    background: 'transparent',
    color: tokens.color.text1,
    borderRadius: tokens.radius.button,
    cursor: 'pointer',
  };

  const titleStyle: CSSProperties = {
    flex: 1,
    textAlign: 'center',
    fontSize: tokens.type.body,
    fontWeight: 600,
    color: tokens.color.text1,
    lineHeight: tokens.type.lineHeight,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  return (
    <header style={bar}>
      <div style={slot}>
        {back ? (
          <button type="button" aria-label="Back" onClick={back} style={backBtn}>
            <BackIcon />
          </button>
        ) : null}
      </div>
      <h1 style={titleStyle}>{title}</h1>
      <div style={{ ...slot, justifyContent: 'flex-end' }}>{right}</div>
    </header>
  );
}
