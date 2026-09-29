import { tokens, CheckIcon } from "@balotachain/ui";

export type StepperStep = { label: string };

export type StepperProps = {
  steps: StepperStep[];
  current: number;
};

/**
 * The admin step tabs. They wrap onto another line when the row runs out of
 * room (below ~1280px with long labels) and never truncate a label.
 */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol
      aria-label="Election steps"
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
        const state: "pending" | "active" | "done" =
          n < current ? "done" : n === current ? "active" : "pending";

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
          </li>
        );
      })}
    </ol>
  );
}
