import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from "react";
import { tokens } from "../tokens.js";

export type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  function PrimaryButton(
    { style, disabled, onMouseEnter, onMouseLeave, ...rest },
    ref,
  ) {
    const [hover, setHover] = useState(false);

    const bg = disabled
      ? tokens.color.neutralFill
      : hover
        ? tokens.color.tealDark
        : tokens.color.teal;

    const merged: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      minHeight: tokens.minButtonHeight,
      padding: `0 34px`,
      borderRadius: tokens.radius.pill,
      border: "none",
      background: bg,
      color: disabled ? tokens.color.text2 : tokens.color.surface,
      fontSize: tokens.type.button,
      fontWeight: 600,
      fontFamily: tokens.type.fontFamily,
      letterSpacing: 0.1,
      lineHeight: 1,
      cursor: disabled ? "default" : "pointer",
      boxShadow: disabled ? "none" : tokens.shadow.button,
      transition: "background 160ms ease, transform 120ms ease",
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
