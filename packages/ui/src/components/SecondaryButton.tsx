import { forwardRef, useState, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { tokens } from '../tokens.js';

export type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const SecondaryButton = forwardRef<HTMLButtonElement, SecondaryButtonProps>(
  function SecondaryButton({ style, disabled, onMouseEnter, onMouseLeave, ...rest }, ref) {
    const [hover, setHover] = useState(false);

    const merged: CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: tokens.minButtonHeight,
      padding: `${tokens.space.sm}px ${tokens.space.md}px`,
      borderRadius: tokens.radius.pill,
      border: `1px solid ${tokens.color.teal}`,
      background: hover && !disabled ? tokens.color.tealLight : 'transparent',
      color: tokens.color.teal,
      fontSize: tokens.type.button,
      fontWeight: 600,
      fontFamily: tokens.type.fontFamily,
      lineHeight: 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background 120ms ease',
      ...style,
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        style={merged}
        onMouseEnter={(e) => {
          setHover(true);
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          setHover(false);
          onMouseLeave?.(e);
        }}
        {...rest}
      />
    );
  },
);
