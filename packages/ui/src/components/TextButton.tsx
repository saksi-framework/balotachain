import { forwardRef, useState, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { tokens } from '../tokens.js';

export type TextButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(function TextButton(
  { style, disabled, onMouseEnter, onMouseLeave, ...rest },
  ref,
) {
  const [hover, setHover] = useState(false);

  const merged: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
    border: 'none',
    background: 'transparent',
    color: hover && !disabled ? tokens.color.tealDark : tokens.color.teal,
    fontSize: tokens.type.body,
    fontWeight: 600,
    fontFamily: tokens.type.fontFamily,
    lineHeight: tokens.type.lineHeight,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    textDecoration: hover && !disabled ? 'underline' : 'none',
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
});
