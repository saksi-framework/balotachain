/**
 * The signature box (voter-list-api.md, "The signature"): drawn with touch
 * or a mouse through pointer events, sent as integer points in a 1000 x 400
 * box within the console's caps, never an image.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { SIGNATURE_TOO_LONG } from "../lib/checkin";
import type { ListSignature } from "../lib/live";
import { Sign } from "./Sign";

const ENTRY = { seq: 7, lastName: "Sampol", firstName: "Tres", middleName: "" };

function mount(onSign = vi.fn<(s: ListSignature) => void>()) {
  render(
    <Sign
      title="Election"
      entry={ENTRY}
      busy={false}
      error={null}
      onSign={onSign}
      onCheck={async () => {}}
    />,
  );
  const box = screen.getByRole("img", { name: /Signature box/ });
  // The box drawn 250 x 100 CSS px at (10, 20): a 5:2 box, a quarter of the
  // console's 1000 x 400.
  box.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 20,
      width: 250,
      height: 100,
      right: 260,
      bottom: 120,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect;
  return { box, onSign };
}

/** One stroke through these CSS-pixel points, by mouse or by finger. */
function stroke(
  box: HTMLElement,
  points: [number, number][],
  pointerType: "mouse" | "touch" = "mouse",
) {
  const at = ([x, y]: [number, number]) => ({
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType,
    isPrimary: true,
    button: 0,
  });
  const [first, ...rest] = points;
  const down = fireEvent.pointerDown(box, at(first!));
  for (const p of rest) fireEvent.pointerMove(box, at(p));
  fireEvent.pointerUp(box, at(points[points.length - 1]!));
  return down;
}

describe("the signature box", () => {
  it("cannot send an empty box; a mouse stroke is sent as integer points scaled to 1000 x 400", () => {
    const { box, onSign } = mount();
    const send = screen.getByRole("button", { name: "Sign the list" });
    expect(send).toBeDisabled();
    stroke(box, [
      [10, 20],
      [60, 45],
      [135.3, 70.1],
      [260, 120],
    ]);
    expect(send).toBeEnabled();
    fireEvent.click(send);
    expect(onSign).toHaveBeenCalledWith({
      strokes: [
        [
          [0, 0],
          [200, 100],
          [501, 200],
          [1000, 400],
        ],
      ],
    });
  });

  it("draws with a finger too, and keeps the page from scrolling while it does", () => {
    const { box, onSign } = mount();
    // fireEvent answers false when the handler prevented the default.
    expect(
      stroke(
        box,
        [
          [20, 30],
          [40, 50],
        ],
        "touch",
      ),
    ).toBe(false);
    const css = readFileSync(join(process.cwd(), "src", "vote.css"), "utf8");
    expect(css).toMatch(/\.ba-sign-box \{[^}]*touch-action: none;/);
    fireEvent.click(screen.getByRole("button", { name: "Sign the list" }));
    expect(onSign.mock.calls[0]![0]).toEqual({
      strokes: [
        [
          [40, 40],
          [120, 120],
        ],
      ],
    });
  });

  it("keeps every point inside the box, even when the pointer leaves it", () => {
    const { box, onSign } = mount();
    stroke(box, [
      [100, 60],
      [400, 300],
      [-50, -50],
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Sign the list" }));
    const sent = onSign.mock.calls[0]![0] as { strokes: number[][][] };
    expect(sent.strokes[0]).toEqual([
      [360, 160],
      [1000, 400],
      [0, 0],
    ]);
    for (const [x, y] of sent.strokes.flat()) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
    }
  });

  it("Clear empties the box", () => {
    const { box } = mount();
    stroke(box, [
      [20, 30],
      [40, 50],
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      screen.getByRole("button", { name: "Sign the list" }),
    ).toBeDisabled();
    expect(box).toHaveAccessibleName(/empty/);
  });

  it("past 64 strokes it says the signature is too long, in one sentence, and will not send it", () => {
    const { box, onSign } = mount();
    for (let i = 0; i < 64; i++) stroke(box, [[20 + i, 30]]);
    expect(screen.queryByText(SIGNATURE_TOO_LONG)).not.toBeInTheDocument();
    stroke(box, [[100, 100]]);
    expect(screen.getByText(SIGNATURE_TOO_LONG)).toBeInTheDocument();
    const send = screen.getByRole("button", { name: "Sign the list" });
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(onSign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText(SIGNATURE_TOO_LONG)).not.toBeInTheDocument();
  });

  it("past 1000 points in a stroke, or 4000 in all, the same", () => {
    const { box } = mount();
    // Each point at least a few box units from the last, so none is dropped.
    const long = Array.from(
      { length: 1001 },
      (_, i) => [10 + (i % 2) * 200, 20 + (i % 100)] as [number, number],
    );
    stroke(box, long);
    expect(screen.getByText(SIGNATURE_TOO_LONG)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    const zig = Array.from(
      { length: 900 },
      (_, i) => [10 + (i % 2) * 200, 20 + (i % 100)] as [number, number],
    );
    for (let i = 0; i < 4; i++) stroke(box, zig);
    expect(screen.queryByText(SIGNATURE_TOO_LONG)).not.toBeInTheDocument();
    stroke(box, zig.slice(0, 401));
    expect(screen.getByText(SIGNATURE_TOO_LONG)).toBeInTheDocument();
  });

  it("still offers the text alternative, after one inline question", async () => {
    const { onSign } = mount();
    fireEvent.click(screen.getByRole("button", { name: "I cannot sign" }));
    // One stray tap sends nothing: it asks, inline, not in a dialog.
    expect(onSign).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    // Only one "I cannot sign" control can be pressed while it is open.
    expect(
      screen.getByRole("button", { name: "I cannot sign" }),
    ).toBeDisabled();
    const group = screen.getByRole("group", {
      name: "The Electoral Board will record on the list that you could not sign. You then get your ballot.",
    });
    const yes = within(group).getByRole("button", {
      name: "Yes, record that I cannot sign",
    });
    await waitFor(() => expect(yes).toBeEnabled(), { timeout: 2000 });
    fireEvent.click(yes);
    expect(onSign).toHaveBeenCalledTimes(1);
    expect(onSign).toHaveBeenCalledWith({ cannotSign: true });
  });

  it("the question has a way back to the signature, which sends nothing", () => {
    const { onSign } = mount();
    fireEvent.click(screen.getByRole("button", { name: "I cannot sign" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Back to the signature" }),
    );
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: "I cannot sign" })).toHaveFocus();
    expect(onSign).not.toHaveBeenCalled();
  });
});
