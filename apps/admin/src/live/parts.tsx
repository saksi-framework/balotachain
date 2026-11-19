/**
 * Small pieces the presenter page shares: the heading style, the error and
 * notice boxes (the same shapes as the live trustee page), the "still
 * recording" timer, and the inline confirm.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import {
  tokens,
  AlertIcon,
  PrimaryButton,
  SecondaryButton,
} from "@balotachain/ui";

/** D9: after this long in progress, one line asks to keep the page open. */
export const STILL_MS = 10_000;

export const h2: CSSProperties = {
  fontSize: tokens.font.h3,
  fontWeight: 600,
  lineHeight: 1.3,
  margin: 0,
};

export const body: CSSProperties = {
  fontSize: tokens.font.body,
  lineHeight: 1.5,
  margin: 0,
};

export const muted: CSSProperties = {
  ...body,
  color: tokens.color.text2,
};

export const small: CSSProperties = {
  fontSize: tokens.font.small,
  color: tokens.color.text2,
  lineHeight: 1.5,
  margin: 0,
};

/** The secondary button at the desktop size (44px). */
export const secondarySmall: CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  fontSize: tokens.font.small,
  borderRadius: tokens.radius.button,
  border: `1px solid ${tokens.color.border}`,
};

/** A failure, in words, in the error style. */
export function ErrorBox({
  children,
  live = true,
}: {
  children: ReactNode;
  /** false when it sits inside a region that already announces. */
  live?: boolean;
}) {
  return (
    <div
      role={live ? "alert" : undefined}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "12px 16px",
        borderRadius: tokens.radius.button,
        background: tokens.color.errorLight,
        color: tokens.color.error,
        fontSize: tokens.font.body,
        fontWeight: 600,
        lineHeight: 1.45,
        overflowWrap: "anywhere",
      }}
    >
      <span style={{ flexShrink: 0, display: "flex", marginTop: 2 }}>
        <AlertIcon size={18} strokeWidth={1.8} />
      </span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

/** A neutral notice inside the page. */
export function InlineNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      style={{
        padding: "12px 16px",
        borderRadius: tokens.radius.button,
        background: tokens.color.neutralFill,
        border: `1px solid ${tokens.color.border}`,
        color: tokens.color.text1,
        fontSize: tokens.font.body,
        lineHeight: 1.5,
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </div>
  );
}

/** True once `busy` has lasted `STILL_MS`; false again when it ends. */
export function useStill(busy: boolean): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(false);
    if (!busy) return;
    const t = window.setTimeout(() => setStill(true), STILL_MS);
    return () => window.clearTimeout(t);
  }, [busy]);
  return still;
}

/** The line under a write that has taken more than ten seconds. */
export function StillLine({
  show,
  text = "Still recording. Keep this page open.",
}: {
  show: boolean;
  text?: string;
}) {
  return show ? <p style={{ ...body, fontWeight: 600 }}>{text}</p> : null;
}

/**
 * A primary button that names its work while busy, with the "still" line
 * under it. It never times the request out.
 */
export function WriteButton({
  label,
  busyLabel,
  busy,
  disabled,
  onClick,
  stillText,
  buttonRef,
  type = "button",
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
  onClick?: () => void;
  stillText?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  /** "submit" inside a form, which then handles the press. */
  type?: "button" | "submit";
}) {
  const still = useStill(busy);
  return (
    <div
      style={{ display: "grid", gap: tokens.space.xs, justifyItems: "start" }}
    >
      <PrimaryButton
        ref={buttonRef}
        type={type}
        onClick={onClick}
        disabled={busy || disabled}
        aria-busy={busy || undefined}
        style={{ whiteSpace: "normal", lineHeight: 1.2, textAlign: "center" }}
      >
        {busy ? busyLabel : label}
      </PrimaryButton>
      <StillLine show={still} text={stillText} />
    </div>
  );
}

/**
 * The inline confirm (D6): the consequence in words, a plain Cancel that has
 * the focus when it opens, and the confirming button. Inline in its card
 * rather than a dialog: nothing else on the page needs to be blocked, the
 * numbers above it keep refreshing in place, and there is no focus trap to
 * get wrong. Cancel hands the focus back through `onCancel`. It has no box
 * or background of its own, so it is never a card inside a card: a 1px rule
 * above it separates it as a card's sections are separated (DESIGN.md,
 * Elevation & Depth). Its heading takes the level that follows where it sits.
 */
export function InlineConfirm({
  title,
  headingLevel,
  lines,
  confirmLabel,
  busyLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  /** 4 inside a card (under its h3), 3 directly under the page's h2, 5 under a card's h4. */
  headingLevel: 3 | 4 | 5;
  lines: string[];
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
  }, []);
  const still = useStill(busy);
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      role="group"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-lines`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onCancel();
      }}
      style={{
        display: "grid",
        gap: tokens.space.sm,
        // M4: a 1px rule in the card border colour sets the confirm apart
        // from the card text above it. The space above the rule is the
        // parent's `sm` gap; `sm` again below it.
        borderTop: `1px solid ${tokens.color.border}`,
        paddingTop: tokens.space.sm,
      }}
    >
      <Heading id={`${id}-title`} style={{ ...body, fontWeight: 600 }}>
        {title}
      </Heading>
      {/* Described by the group when it opens; later changes are polite. */}
      <div
        id={`${id}-lines`}
        aria-live="polite"
        style={{ display: "grid", gap: 4 }}
      >
        {lines.map((l) => (
          <p key={l} style={body}>
            {l}
          </p>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: tokens.space.sm,
          alignItems: "center",
        }}
      >
        <SecondaryButton
          ref={cancel}
          onClick={onCancel}
          disabled={busy}
          style={secondarySmall}
        >
          Cancel
        </SecondaryButton>
        <PrimaryButton
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy || undefined}
          style={{ whiteSpace: "normal", lineHeight: 1.2 }}
        >
          {busy ? busyLabel : confirmLabel}
        </PrimaryButton>
      </div>
      <StillLine show={still} />
    </div>
  );
}
