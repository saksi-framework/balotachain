import {
  forwardRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
} from "react";
import { tokens } from "../tokens.js";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "mono";
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    { variant = "default", style, onFocus, onBlur, ...rest },
    ref,
  ) {
    const [focused, setFocused] = useState(false);

    const merged: CSSProperties = {
      display: "block",
      width: "100%",
      minHeight: 54,
      padding: `0 ${tokens.space.sm}px`,
      background: tokens.color.surface,
      border: focused
        ? `2px solid ${tokens.color.teal}`
        : `1.5px solid ${tokens.color.border}`,
      borderRadius: tokens.radius.button,
      color: tokens.color.text1,
      fontSize: tokens.type.body,
      fontWeight: variant === "mono" ? 600 : 400,
      letterSpacing: variant === "mono" ? 1 : 0,
      fontFamily:
        variant === "mono" ? tokens.type.mono : tokens.type.fontFamily,
      lineHeight: tokens.type.lineHeight,
      outline: "none",
      transition: "border-color 150ms ease",
      ...style,
    };

    return (
      <input
        ref={ref}
        style={merged}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    );
  },
);
