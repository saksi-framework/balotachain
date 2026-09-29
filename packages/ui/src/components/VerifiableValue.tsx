import { useId } from "react";
import { tokens } from "../tokens.js";
import { CopyButton } from "./CopyButton.js";

export type VerifiableValueProps = {
  /** The full value; this is what Copy puts on the clipboard. */
  value: string;
  /** Names the value, e.g. "Tracking code". Also names the copy button. */
  label?: string;
  /** Where anyone can check the value (verify-code API, trail). */
  checkHref?: string;
  /** Show `first8…last8` instead of wrapping the whole value. */
  truncate?: boolean;
};

const KEEP = 8;

export function middleTruncate(value: string, keep = KEEP): string {
  return value.length <= keep * 2 + 1
    ? value
    : `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

/** "Tracking code" -> "tracking code", but "TX id" and "SHA-256" stay as-is. */
function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s;
}

/** A value you can check yourself: mono text, a Copy button, a Check link. */
export function VerifiableValue({
  value,
  label,
  checkHref,
  truncate = false,
}: VerifiableValueProps) {
  const shown = truncate ? middleTruncate(value) : value;
  const labelId = useId();
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}
    >
      {label ? (
        <span
          id={labelId}
          style={{ ...tokens.typeRole.label, color: tokens.color.text2 }}
        >
          {label}
        </span>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: tokens.space.xs,
          background: tokens.color.neutralFill,
          borderRadius: 8,
          padding: "6px 6px 6px 12px",
          minWidth: 0,
        }}
      >
        <code
          aria-labelledby={label ? labelId : undefined}
          title={shown === value ? undefined : value}
          style={{
            ...tokens.typeRole.mono,
            color: tokens.color.text1,
            flex: 1,
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          {shown}
        </code>
        {checkHref ? (
          <a
            href={checkHref}
            style={{
              color: tokens.color.teal,
              fontWeight: 600,
              fontSize: tokens.type.small,
              flexShrink: 0,
            }}
          >
            Check
          </a>
        ) : null}
        <CopyButton
          value={value}
          size="sm"
          label={label ? `Copy ${lowerFirst(label)}` : "Copy"}
        />
      </div>
    </div>
  );
}
