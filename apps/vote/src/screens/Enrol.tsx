import { CheckIcon, Chip, ShieldCheckIcon, tokens } from "@balotachain/ui";
import {
  ActionButton,
  Emblem,
  Lead,
  Notice,
  Screen,
  SlowNote,
} from "../components/Layout";
import { ENROL_STEPS, type EnrolStep } from "../lib/live";
import { SLOW_MS, useSlow } from "../lib/usePoll";

export type EnrolProgress = {
  steps: EnrolStep[];
  running: boolean;
  done: boolean;
  /** From `enrol`: the credential survives a reload. Null until done. */
  persistent: boolean | null;
  error: string | null;
  /** The error is final (the voter already has its credential): no retry. */
  final: boolean;
};

/** Where one step of the credential stands, for its chip (D12). */
export function stepState(
  progress: Pick<EnrolProgress, "steps" | "error">,
  index: number,
): "done" | "working" | "failed" | "not-started" {
  const s = progress.steps.find((x) => x.index === index);
  if (s?.state === "done") return "done";
  if (!s) return "not-started";
  // Only the step that was running when the error came says Failed; the
  // steps after it never started.
  return progress.error ? "failed" : "working";
}

export function Enrol({
  progress,
  onStart,
  onContinue,
  slowMs = SLOW_MS,
}: {
  progress: EnrolProgress;
  onStart: () => void;
  onContinue: () => void;
  slowMs?: number;
}) {
  const { steps, running, done, persistent, error, final } = progress;
  const started = steps.length > 0;
  const total = steps[0]?.total ?? ENROL_STEPS.length;
  const slow = useSlow(running, slowMs);
  const current = steps.find((s) => s.state === "running");

  return (
    <Screen
      title="Voting credential"
      footer={
        done ? (
          <ActionButton onClick={onContinue}>Continue</ActionButton>
        ) : final ? null : (
          <>
            <ActionButton
              onClick={onStart}
              busy={running}
              busyLabel="Getting your credential…"
            >
              {error ? "Try again" : "Get my voting credential"}
            </ActionButton>
            <SlowNote show={slow} />
          </>
        )
      }
    >
      <Emblem
        tone={done ? (persistent ? "success" : "warning") : "teal"}
        pop={done}
      >
        {done ? (
          <CheckIcon size={36} strokeWidth={2.4} />
        ) : (
          <ShieldCheckIcon size={36} />
        )}
      </Emblem>
      <Lead
        title={
          running ? "Getting your credential" : "Get your voting credential"
        }
      >
        This happens once on this phone. The election authority signs your
        credential without seeing it, so your ballot cannot be traced back to
        your name on the list.
      </Lead>

      {started ? (
        <ol
          className="ba-list"
          aria-label="Credential steps"
          style={{
            background: tokens.color.surface,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.card,
            boxShadow: tokens.shadow.card,
            marginBottom: tokens.space.md,
          }}
        >
          {Array.from({ length: total }, (_, index) => {
            const label =
              steps.find((s) => s.index === index)?.label ??
              ENROL_STEPS[index] ??
              "";
            const state = stepState(progress, index);
            return (
              <li
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 16px",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span
                    className="bc-mono"
                    style={{ color: tokens.color.textSubtle, marginRight: 8 }}
                  >
                    {index + 1}/{total}
                  </span>
                  {label}
                </span>
                {state === "done" ? (
                  <Chip variant="success">Done</Chip>
                ) : state === "failed" ? (
                  <Chip variant="error">Failed</Chip>
                ) : state === "working" ? (
                  <Chip variant="active">Working…</Chip>
                ) : (
                  <Chip variant="neutral">Not started</Chip>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
      <p aria-live="polite" className="bc-sr-only">
        {running && current
          ? `Step ${current.index + 1} of ${total}: ${current.label}`
          : ""}
      </p>

      <div aria-live="polite">
        {done && persistent ? (
          <Notice tone="success" icon={<CheckIcon size={22} />}>
            <strong>Credential stored on this phone</strong>
            <br />
            Use this phone to vote. Clearing the browser data removes it.
          </Notice>
        ) : null}
        {done && !persistent ? (
          <Notice tone="warning">
            <strong>Credential kept only until you close this page</strong>
            <br />
            This browser would not let the page save it (a private window, or
            storage turned off). Vote now, before closing or reloading this
            page.
          </Notice>
        ) : null}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Screen>
  );
}
