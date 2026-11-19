/**
 * D9 and D12 on single screens, with fake timers: the waits name their work,
 * say "Still recording" after 10 s, keep the screen on a failed read, and the
 * loading screen offers a way out after 15 s.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { STILL_RECORDING } from "../components/Layout";
import {
  ENROL_STEPS,
  LiveError,
  type EncryptedBallot,
  type Position,
} from "../lib/live";
import { POLL_FAILURES_SHOWN, POLL_MS } from "../lib/usePoll";
import { Enrol } from "./Enrol";
import { Loading, NotOpen, STILL_TRYING, TAKING_LONGER } from "./Status";
import { Submitting } from "./Submitting";
import { Waiting } from "./CheckIn";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const POSITIONS: Position[] = [
  { id: "president", title: "President", candidates: [] },
  { id: "vice-president", title: "Vice President", candidates: [] },
];
const BALLOT: EncryptedBallot = {
  ballotId: "b",
  positions: [
    { positionId: "president", trackingCode: "BC-0000-0001", fingerprint: "" },
    {
      positionId: "vice-president",
      trackingCode: "BC-0000-0002",
      fingerprint: "",
    },
  ],
};

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe("a write in progress (D9)", () => {
  it("sending: the disabled button names the work; after 10 s one line appears under it", async () => {
    const view = render(
      <Submitting
        positions={POSITIONS}
        ballot={BALLOT}
        receipts={[]}
        error={null}
        onRetry={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: /Recording on chain/ });
    expect(button).toBeDisabled();
    expect(screen.queryByText(STILL_RECORDING)).not.toBeInTheDocument();
    await advance(9_999);
    expect(screen.queryByText(STILL_RECORDING)).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByText(STILL_RECORDING)).toBeInTheDocument();
    // The line is in a polite live region.
    expect(screen.getByText(STILL_RECORDING)).toHaveAttribute(
      "aria-live",
      "polite",
    );
    // The changing count is announced politely too.
    expect(screen.getByText("0 of 2 positions recorded")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    // A failed write: the console's words, then "Try again".
    view.rerender(
      <Submitting
        positions={POSITIONS}
        ballot={BALLOT}
        receipts={[]}
        error="Can't reach the election server."
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Can't reach the election server.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.queryByText(STILL_RECORDING)).not.toBeInTheDocument();
  });

  it("issuance: the busy button says what it is getting, then the 10 s line", async () => {
    render(
      <Enrol
        progress={{
          steps: [
            {
              index: 0,
              total: ENROL_STEPS.length,
              label: ENROL_STEPS[0],
              state: "running",
            },
          ],
          running: true,
          done: false,
          persistent: null,
          error: null,
          final: false,
        }}
        onStart={() => {}}
        onContinue={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Getting your credential/ }),
    ).toBeDisabled();
    await advance(10_000);
    expect(screen.getByText(STILL_RECORDING)).toBeInTheDocument();
  });
});

describe("waiting before voting opens (D9, D10)", () => {
  it("reads by itself, keeps the screen on failed reads, and says so after a few", async () => {
    const onCheck = vi.fn(async () => {
      throw new Error("offline");
    });
    render(<NotOpen title="Election" credential={false} onCheck={onCheck} />);
    for (let i = 1; i < POLL_FAILURES_SHOWN; i++) {
      await advance(POLL_MS);
      expect(onCheck).toHaveBeenCalledTimes(i);
      expect(screen.queryByText(STILL_TRYING)).not.toBeInTheDocument();
    }
    await advance(POLL_MS);
    expect(onCheck).toHaveBeenCalledTimes(POLL_FAILURES_SHOWN);
    expect(screen.getByText(STILL_TRYING)).toBeInTheDocument();
    // Nothing alarming: no alert, the waiting text stays.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Voting has not opened yet" }),
    ).toBeInTheDocument();
  });

  it("m6: a failed read the console answered shows the console's words, not 'can't reach'", async () => {
    const words =
      "The election server reports a state this app does not know: paused.";
    const onCheck = vi.fn(async () => {
      throw new LiveError("refused", words);
    });
    render(<NotOpen title="Election" credential={false} onCheck={onCheck} />);
    for (let i = 0; i < POLL_FAILURES_SHOWN; i++) await advance(POLL_MS);
    expect(screen.getByText(words)).toBeInTheDocument();
    expect(screen.queryByText(STILL_TRYING)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("'Check now' reads at once and shows a busy state while it runs", async () => {
    let finish!: () => void;
    const onCheck = vi.fn(() => new Promise<void>((r) => (finish = r)));
    render(<NotOpen title="Election" onCheck={onCheck} />);
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Checking/ })).toBeDisabled();
    // The timer's tick finds the read in flight and skips.
    await advance(POLL_MS * 3);
    expect(onCheck).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(screen.getByRole("button", { name: "Check now" })).toBeEnabled();
  });
});

describe("waiting for the Electoral Board (m12)", () => {
  it("'Check now' is the secondary button; the instruction is the main thing", () => {
    render(
      <Waiting
        title="Election"
        entry={{
          seq: 7,
          lastName: "Sampol",
          firstName: "Tres",
          middleName: "",
        }}
        onCheck={async () => {}}
      />,
    );
    const b = screen.getByRole("button", { name: "Check now" });
    // The secondary look: no teal fill, an outline.
    expect(b.style.background).toBe("transparent");
    expect(b.style.border).not.toBe("");
    expect(
      screen.getByRole("heading", { name: "Waiting for the Electoral Board" }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(1);
  });
});

describe("loading gets a way out (D12)", () => {
  it("after 15 s: 'This is taking longer than usual' with Retry", async () => {
    const onRetry = vi.fn();
    render(<Loading label="Loading the election…" onRetry={onRetry} />);
    await advance(14_999);
    expect(screen.queryByText(/taking longer/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    await advance(1);
    expect(screen.getByText(`${TAKING_LONGER}.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
