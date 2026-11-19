/**
 * Verify keeps a malformed entry as typed; only a well-formed code is tidied.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Verify } from "./Verify";

function setup() {
  const lookup = vi.fn(async (trackingCode: string) => ({
    trackingCode,
    recorded: false,
    counted: false,
  }));
  render(<Verify ownCodes={[]} lookup={lookup} onBack={() => {}} />);
  const input = screen.getByLabelText("Tracking code") as HTMLInputElement;
  return { input, lookup };
}

describe("Verify: the entry", () => {
  it("a malformed entry is not upper-cased and sends nothing", () => {
    const { input, lookup } = setup();
    fireEvent.change(input, { target: { value: "bc-12zz" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(input.value).toBe("bc-12zz");
    screen.getByText(/A tracking code looks like BC-XXXX-XXXX/);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("a well-formed entry is tidied and looked up", async () => {
    const { input, lookup } = setup();
    fireEvent.change(input, { target: { value: "bc 30e1da49" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
    });
    expect(input.value).toBe("BC-30E1-DA49");
    expect(lookup).toHaveBeenCalledWith("BC-30E1-DA49");
  });
});
