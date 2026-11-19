import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stepper } from "./Stepper.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

/** The span that holds exactly this text. */
function textSpan(text: string): HTMLElement {
  const hit = [...host.querySelectorAll("span")].find(
    (s) => s.textContent === text && s.children.length === 0,
  );
  if (!hit) throw new Error(`no span reading ${text}`);
  return hit as HTMLElement;
}

describe("Stepper", () => {
  // Moved from apps/admin with its assertions; @testing-library is not a
  // dependency of this package, so it queries the DOM directly.
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

    const list = host.querySelector('ol[aria-label="Election steps"]');
    expect(list).not.toBeNull();
    expect((list as HTMLElement).style.flexWrap).toBe("wrap");
    const tabs = [...host.querySelectorAll("li")];
    expect(tabs).toHaveLength(steps.length);
    for (const { label } of steps) {
      const text = textSpan(label);
      expect(text.style.textOverflow).not.toBe("ellipsis");
      expect(text.style.overflow).not.toBe("hidden");
    }
    for (const tab of tabs) {
      expect(tab.style.overflow).not.toBe("hidden");
      expect(tab.style.minWidth).not.toBe("0");
    }
    expect(tabs[2]?.getAttribute("aria-current")).toBe("step");
  });

  it("draws no status words unless asked", () => {
    render(
      <Stepper
        steps={[{ label: "One" }, { label: "Two" }, { label: "Three" }]}
        current={2}
      />,
    );
    expect(host.querySelectorAll("[data-status-word]")).toHaveLength(0);
    // Step 1 is done and draws a tick, not its number.
    expect(host.textContent).toBe("One2Two3Three");
  });

  it("shows done, current and locked under the steps when asked", () => {
    render(
      <Stepper
        steps={[
          { label: "Key ceremony" },
          { label: "Decrypt" },
          { label: "Sign tally" },
        ]}
        current={2}
        statusWords
        label="Trustee steps"
      />,
    );
    expect(host.querySelector('ol[aria-label="Trustee steps"]')).not.toBeNull();
    const words = [...host.querySelectorAll("[data-status-word]")].map(
      (w) => w.textContent,
    );
    expect(words).toEqual(["done", "current", "locked"]);
    const tabs = [...host.querySelectorAll("li")];
    expect(tabs[1]?.getAttribute("aria-current")).toBe("step");
    expect(tabs[1]?.textContent).toBe("2Decryptcurrent");
  });

  it("takes a step's own word when it gives one", () => {
    render(
      <Stepper
        steps={[
          { label: "Key ceremony" },
          { label: "Decrypt", status: "not needed", state: "pending" },
          { label: "Sign tally" },
        ]}
        current={3}
        statusWords
      />,
    );
    const words = [...host.querySelectorAll("[data-status-word]")].map(
      (w) => w.textContent,
    );
    expect(words).toEqual(["done", "not needed", "current"]);
    // A skipped step keeps its number; only a done step is ticked.
    expect(host.querySelectorAll("li")[1]?.textContent).toBe(
      "2Decryptnot needed",
    );
  });
});
