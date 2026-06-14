import { tokens, CheckIcon } from "@balotachain/ui";

export type StepperStep = { label: string };

export type StepperProps = {
  steps: StepperStep[];
  current: number;
};

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        width: "100%",
      }}
    >
      {steps.map((step, i) => {
        const n = i + 1;
        const state: "pending" | "active" | "done" =
          n < current ? "done" : n === current ? "active" : "pending";
        const isLast = i === steps.length - 1;

        const borderColor =
          state === "done"
            ? tokens.color.success
            : state === "active"
              ? tokens.color.teal
              : tokens.color.border;

        const bg =
          state === "active" ? tokens.color.tealLight : tokens.color.surface;
        const labelColor =
          state === "pending" ? tokens.color.text2 : tokens.color.text1;

        const badgeBg =
          state === "done"
            ? tokens.color.success
            : state === "active"
              ? tokens.color.teal
              : tokens.color.bg;
        const badgeFg =
          state === "pending" ? tokens.color.text2 : tokens.color.surface;
        const badgeBorder =
          state === "pending" ? tokens.color.border : "transparent";

        return (
          <div
            key={step.label}
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: tokens.space.xs,
                background: bg,
                border: `1px solid ${borderColor}`,
                borderRadius: tokens.radius.button,
                padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: tokens.radius.pill,
                  background: badgeBg,
                  border: `1px solid ${badgeBorder}`,
                  color: badgeFg,
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
                  color: labelColor,
                  fontSize: tokens.type.body,
                  fontWeight: state === "active" ? 600 : 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                style={{
                  flex: "0 0 24px",
                  height: 1,
                  background: tokens.color.border,
                  margin: `0 ${tokens.space.xs}px`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
