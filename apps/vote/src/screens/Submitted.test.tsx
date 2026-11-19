/**
 * N1: the receipt's footer by where the unconfirmed rows stand.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { tokens } from "@balotachain/ui";
import type { Position, SubmitReceipt, UnconfirmedPosition } from "../lib/live";
import { Submitted } from "./Submitted";

const POSITIONS: Position[] = ["p1", "p2", "p3"].map((id, i) => ({
  id,
  title: `Position ${i + 1}`,
  candidates: [],
}));
const RECORDED: SubmitReceipt = {
  positionId: "p1",
  trackingCode: "BC-0000-0001",
  fingerprint: "0000-0000-0000-0000-0000-0000-0000-0001",
  txId: "aa".repeat(32),
  block: 7,
};
const u = (id: string, taken: boolean): UnconfirmedPosition => ({
  positionId: id,
  trackingCode: `BC-0000-00${id.slice(1)}0`,
  fingerprint: "0000-0000-0000-0000-0000-0000-0000-0002",
  ...(taken ? { takenUnconfirmed: true } : {}),
});

function footer(unconfirmed: UnconfirmedPosition[], receipts = [RECORDED]) {
  render(
    <Submitted
      positions={POSITIONS}
      receipts={receipts}
      unconfirmed={unconfirmed}
      status="open"
      onVerify={() => {}}
      onFinish={() => {}}
      onSendAgain={() => {}}
    />,
  );
  const buttons = within(
    document.querySelector(".ba-footer") as HTMLElement,
  ).getAllByRole("button");
  return buttons.map((b) => ({
    name: b.textContent,
    // PrimaryButton is the filled teal one.
    primary:
      b.style.background.toLowerCase() === tokens.color.teal.toLowerCase(),
  }));
}

describe("N1: Send again is never primary when it cannot settle anything", () => {
  it("every unconfirmed row taken, a position not sent: Finish primary, Send again second", () => {
    expect(footer([u("p2", true)])).toEqual([
      { name: "Finish my ballot", primary: true },
      { name: "Send again", primary: false },
      { name: "Verify what is recorded", primary: false },
    ]);
  });

  it("every unconfirmed row taken, nothing not sent: no primary, Send again second, Verify stays", () => {
    expect(footer([u("p2", true), u("p3", true)])).toEqual([
      { name: "Send again", primary: false },
      { name: "Verify what is recorded", primary: false },
    ]);
  });

  it("a row not yet sent again: the footer as before, Send again primary", () => {
    expect(footer([u("p2", true), u("p3", false)], [RECORDED])).toEqual([
      { name: "Send again", primary: true },
      { name: "Verify what is recorded", primary: false },
    ]);
    screen.getByText(/never heard back/);
  });
});

describe("I1: a receipt with an alarm is not counted as on the ledger", () => {
  const ok = (id: string): SubmitReceipt => ({
    ...RECORDED,
    positionId: id,
    trackingCode: `BC-0000-000${id.slice(1)}`,
  });
  const alarmed: SubmitReceipt = {
    positionId: "p3",
    trackingCode: "BC-0000-0003",
    fingerprint: "0000-0000-0000-0000-0000-0000-0000-0003",
    txId: "",
    block: 0,
    alarm: {
      recordedTrackingCode: "",
      recordedFingerprint: "",
      recordedBytesMatch: false,
    },
  };

  it("the last position's answer does not match: 2 of 3, no block or transaction id for it", () => {
    render(
      <Submitted
        positions={POSITIONS}
        receipts={[ok("p1"), ok("p2"), alarmed]}
        status="open"
        onVerify={() => {}}
      />,
    );
    screen.getByRole("heading", {
      name: "The election server's answer does not match",
    });
    expect(screen.queryByText("Every position is on the ledger.")).toBeNull();
    screen.getByText("2 of 3 positions are on the ledger.");
    expect(screen.queryByText("#0")).toBeNull();
    // The two matching rows keep theirs; the alarm row has none.
    expect(screen.getAllByText("#7")).toHaveLength(2);
    expect(screen.getAllByText("Transaction id")).toHaveLength(2);
  });

  it("an alarm whose answer carried a transaction id shows it", () => {
    render(
      <Submitted
        positions={POSITIONS}
        receipts={[
          ok("p1"),
          ok("p2"),
          { ...alarmed, txId: "bb".repeat(32), block: 9 },
        ]}
        status="open"
        onVerify={() => {}}
      />,
    );
    screen.getByText("#9");
    expect(screen.getAllByText("Transaction id")).toHaveLength(3);
  });
});
