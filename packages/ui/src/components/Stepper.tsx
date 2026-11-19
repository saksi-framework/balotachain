import { tokens } from "../tokens.js";
import { CheckIcon } from "./Icon.js";

/** Where a step stands against `current`. */
export type StepperState = "done" | "active" | "pending";

export type StepperStep = {
  label: string;
  /**
   * With `statusWords`, the word under this step instead of the default
   * ("done", "current", "locked"). For a state the default words do not
   * cover, such as a step that is no longer needed.
   */
  status?: string;
  /**
   * Draw this step in a state other than its place against `current`, for a
   * step that was skipped rather than done (drawn `pending`, not ticked).
   */
  state?: StepperState;
};

export type StepperProps = {
  steps: StepperStep[];
  /** 1-based index of the current step; 0 or less when none is current. */
  current: number;
  /**
   * Show a status word under each step, so the state is never colour alone
   * (design review D5). Off by default: the tracker then draws as before.
   */
  statusWords?: boolean;
  /** The list's accessible name. */
  label?: string;
};

/** The default status words (D5). */
export const STEPPER_WORDS: Record<StepperState, string> = {
  done: "done",
  active: "current",
  pending: "locked",
};

/**
 * The step tracker. Steps wrap onto another line when the row runs out of
 * room (below ~1280px with long labels) and never truncate a label.
 */
export function Stepper({
  steps,
  current,
  statusWords = false,
  label = "Election steps",
}: StepperProps) {
  return (
    <ol
      aria-label={label}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.space.xs,
        listStyle: "none",
        margin: 0,
        padding: 0,
        width: "100%",
      }}
    >
      {steps.map((step, i) => {
        const n = i + 1;
        const state: StepperState =
          step.state ??
          (n < current ? "done" : n === current ? "active" : "pending");

        const borderColor =
          state === "done"
            ? tokens.color.success
            : state === "active"
              ? tokens.color.teal
              : tokens.color.border;
        const badgeBg =
          state === "done"
            ? tokens.color.success
            : state === "active"
              ? tokens.color.teal
              : tokens.color.bg;

        const labelText = (
          <span
            style={{
              color:
                state === "pending" ? tokens.color.text2 : tokens.color.text1,
              fontSize: tokens.type.body,
              fontWeight: state === "active" ? 600 : 500,
              whiteSpace: "nowrap",
            }}
          >
            {step.label}
          </span>
        );

        return (
          <li
            key={step.label}
            aria-current={state === "active" ? "step" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: tokens.space.xs,
              flex: "1 1 auto",
              background:
                state === "active"
                  ? tokens.color.tealLight
                  : tokens.color.surface,
              border: `1px solid ${borderColor}`,
              borderRadius: tokens.radius.button,
              padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: tokens.radius.pill,
                background: badgeBg,
                border: `1px solid ${
                  state === "pending" ? tokens.color.border : "transparent"
                }`,
                color:
                  state === "pending"
                    ? tokens.color.text2
                    : tokens.color.surface,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {state === "done" ? <CheckIcon size={16} /> : n}
            </span>
            {statusWords ? (
              <span style={{ display: "flex", flexDirection: "column" }}>
                {labelText}
                <span
                  data-status-word
                  style={{
                    fontSize: tokens.font.small,
                    lineHeight: 1.3,
                    color:
                      state === "done"
                        ? tokens.color.successText
                        : state === "active"
                          ? tokens.color.tealDark
                          : tokens.color.text2,
                    fontWeight: 600,
                  }}
                >
                  {step.status ?? STEPPER_WORDS[state]}
                </span>
              </span>
            ) : (
              labelText
            )}
          </li>
        );
      })}
    </ol>
  );
}
