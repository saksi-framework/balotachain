import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stepper } from "./Stepper";

describe("Stepper", () => {
  it("shows every tab in full and wraps instead of truncating", () => {
    const steps = [
      "Election",
      "Population",
      "Run",
      "Ceremony",
      "Results",
      "Independent verification",
      "Ledger reconciliation",
      "Publication to the bulletin board",
    ].map((label) => ({ label }));
    render(<Stepper steps={steps} current={3} />);

    const list = screen.getByRole("list", { name: "Election steps" });
    expect(list.style.flexWrap).toBe("wrap");
    const tabs = screen.getAllByRole("listitem");
    expect(tabs).toHaveLength(steps.length);
    for (const { label } of steps) {
      const text = screen.getByText(label);
      expect(text.style.textOverflow).not.toBe("ellipsis");
      expect(text.style.overflow).not.toBe("hidden");
    }
    for (const tab of tabs) {
      expect(tab.style.overflow).not.toBe("hidden");
      expect(tab.style.minWidth).not.toBe("0");
    }
    expect(tabs[2]).toHaveAttribute("aria-current", "step");
  });
});
