import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";
import { tokens } from "../tokens.js";
import { CheckIcon } from "./Icon.js";

export type OptionCardProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSelect"
> & {
  selected: boolean;
  multi?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
};

export const OptionCard = forwardRef<HTMLDivElement, OptionCardProps>(
  function OptionCard(
    {
      selected,
      multi = false,
      disabled = false,
      onSelect,
      label,
      description,
      style,
      ...rest
    },
    ref,
  ) {
    const borderColor = selected ? tokens.color.teal : tokens.color.border;
    const borderWidth = selected ? 2 : 1;

    const merged: CSSProperties = {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: tokens.space.sm,
      padding: tokens.space.md,
      background: selected ? tokens.color.tealLight : tokens.color.surface,
      border: `${borderWidth}px solid ${borderColor}`,
      borderRadius: tokens.radius.card,
      boxShadow: tokens.shadow.card,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      userSelect: "none",
      transition: "background 120ms ease, border-color 120ms ease",
      ...style,
    };

    const handleClick = () => {
      if (!disabled) onSelect();
    };

    const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    };

    return (
      <div
        ref={ref}
        role={multi ? "checkbox" : "radio"}
        aria-checked={selected}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKey}
        style={merged}
        {...rest}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: tokens.type.body,
              fontWeight: 600,
              color: tokens.color.text1,
              lineHeight: tokens.type.lineHeight,
            }}
          >
            {label}
          </span>
          {description ? (
            <span
              style={{
                fontSize: tokens.type.body - 2,
                color: tokens.color.text2,
                lineHeight: tokens.type.lineHeight,
              }}
            >
              {description}
            </span>
          ) : null}
        </div>
        {selected ? (
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: tokens.radius.pill,
              background: tokens.color.teal,
              color: tokens.color.surface,
              flexShrink: 0,
            }}
          >
            <CheckIcon size={16} />
          </span>
        ) : null}
      </div>
    );
  },
);
