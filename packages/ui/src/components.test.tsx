import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chip, type ChipVariant } from "./components/Chip.js";
import { CopyButton } from "./components/CopyButton.js";
import { TopBar } from "./components/TopBar.js";
import {
  VerifiableValue,
  withGroupBreaks,
} from "./components/VerifiableValue.js";
import { OptionCard } from "./components/OptionCard.js";
import { SecondaryButton } from "./components/SecondaryButton.js";
import { tokens } from "./tokens.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

async function click(el: Element) {
  await act(async () => {
    (el as HTMLElement).click();
  });
}

describe("Chip", () => {
  const variants: ChipVariant[] = [
    "neutral",
    "active",
    "success",
    "warning",
    "error",
  ];
  it.each(variants)("renders its label for %s", (variant) => {
    render(<Chip variant={variant}>Recorded</Chip>);
    expect(host.textContent).toBe("Recorded");
  });
});

describe("CopyButton", () => {
  it("writes to the clipboard and shows Copied", async () => {
    render(<CopyButton value="abc123" />);
    const btn = host.querySelector("button")!;
    expect(btn.textContent).toBe("Copy");
    await click(btn);
    expect(writeText).toHaveBeenCalledWith("abc123");
    expect(btn.textContent).toBe("Copied");
  });

  it("goes back to Copy after 2 s", async () => {
    vi.useFakeTimers();
    render(<CopyButton value="abc123" />);
    const btn = host.querySelector("button")!;
    await click(btn);
    expect(btn.textContent).toBe("Copied");
    act(() => vi.advanceTimersByTime(2000));
    expect(btn.textContent).toBe("Copy");
  });
});

describe("CopyButton without the Clipboard API (plain-http LAN origin)", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
  });

  it("falls back to execCommand and shows Copied", async () => {
    const exec = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      value: exec,
      configurable: true,
    });
    render(<CopyButton value="abc123" />);
    const btn = host.querySelector("button")!;
    await click(btn);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(btn.textContent).toBe("Copied");
    expect(host.querySelector("textarea")).toBeNull();
  });

  it("shows Copy failed for 2 s when no copy path works", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "execCommand", {
      value: vi.fn(() => false),
      configurable: true,
    });
    render(<CopyButton value="abc123" />);
    const btn = host.querySelector("button")!;
    await click(btn);
    expect(btn.textContent).toBe("Copy failed");
    expect(btn.querySelector("[aria-live=polite]")).not.toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(btn.textContent).toBe("Copy");
  });
});

describe("VerifiableValue", () => {
  const full = "0123456789abcdef0123456789abcdef";

  it("truncates in the middle and copies the full value", async () => {
    render(<VerifiableValue value={full} truncate label="Nullifier" />);
    const text = host.querySelector("code")!.textContent!;
    expect(text).toBe("01234567…89abcdef");
    await click(host.querySelector("button")!);
    expect(writeText).toHaveBeenCalledWith(full);
  });

  it("links the label to the value and keeps acronyms in the copy name", () => {
    render(<VerifiableValue value={full} label="TX id" />);
    const code = host.querySelector("code")!;
    const labelEl = document.getElementById(
      code.getAttribute("aria-labelledby")!,
    );
    expect(labelEl!.textContent).toBe("TX id");
    expect(host.querySelector("button")!.getAttribute("aria-label")).toBe(
      "Copy TX id",
    );
  });

  it("shows the whole value and a Check link when given", () => {
    render(<VerifiableValue value={full} checkHref="/api/verify-code/x" />);
    expect(host.querySelector("code")!.textContent).toBe(full);
    expect(host.querySelector("a")!.getAttribute("href")).toBe(
      "/api/verify-code/x",
    );
  });

  it("m8: a grouped value breaks only between its groups", () => {
    const key = "5F2C-0A1B-D7A5-4E61-0000-1111-2222-3333";
    render(<VerifiableValue value={key} label="Election key" />);
    const code = host.querySelector("code")!;
    // The text is unchanged; a break opportunity follows every hyphen
    // (a hyphen before a digit gives none by itself).
    expect(code.textContent).toBe(key);
    expect(code.querySelectorAll("wbr")).toHaveLength(7);
    for (const w of code.querySelectorAll("wbr")) {
      expect(w.previousSibling?.textContent?.endsWith("-")).toBe(true);
    }
  });
});

describe("withGroupBreaks", () => {
  it("leaves a value without hyphens as it is", () => {
    expect(withGroupBreaks("abcdef")).toBe("abcdef");
  });
});

describe("TopBar", () => {
  it("renders the app name, election name and role slot", () => {
    render(
      <TopBar
        appName="Trustee Console"
        electionName="SSC 2026"
        role={<span data-testid="role">Trustee 2 of 5</span>}
      />,
    );
    expect(host.querySelector("h1")!.textContent).toContain("Trustee Console");
    expect(host.textContent).toContain("SSC 2026");
    expect(host.querySelector("[data-testid=role]")!.textContent).toBe(
      "Trustee 2 of 5",
    );
  });

  it("shows the mark alone, with no separator, for an empty app name", () => {
    render(<TopBar appName="" electionName="SSC 2026" />);
    expect(host.querySelector("h1")!.textContent).toBe("BalotaChain");
    expect(host.textContent).not.toContain("—");
  });

  it("keeps the compact title bar", () => {
    render(<TopBar title="Review" />);
    expect(host.querySelector("h1")!.textContent).toBe("Review");
  });

  it("cuts a long compact title to one line unless wrapping is asked for (D20)", () => {
    const title =
      "Chairperson of the Student Council Committee on Rules and Ethics";
    render(<TopBar title={title} />);
    let h1 = host.querySelector("h1")!;
    expect(h1.style.whiteSpace).toBe("nowrap");
    expect(h1.style.textOverflow).toBe("ellipsis");
    expect(h1.parentElement!.style.height).toBe("56px");

    render(<TopBar title={title} wrapTitle />);
    h1 = host.querySelector("h1")!;
    expect(h1.textContent).toBe(title);
    expect(h1.style.whiteSpace).toBe("");
    expect(h1.style.textOverflow).toBe("");
    expect(h1.style.overflowWrap).toBe("anywhere");
    // The bar grows with the title, from the drawn 56px.
    expect(h1.parentElement!.style.height).toBe("");
    expect(h1.parentElement!.style.minHeight).toBe("56px");
  });
});

describe("OptionCard (D20)", () => {
  it("wraps a long name, breaking a word as the last resort, and keeps the mark on the first line", () => {
    const name =
      "BartolomeDeLasCasasYSantiagoDeLaCruzMercadoRealondaDelRosarioIII";
    render(<OptionCard label={name} selected onSelect={() => {}} />);
    const label = [...host.querySelectorAll("span")].find(
      (s) => s.textContent === name,
    )!;
    expect(label.style.overflowWrap).toBe("anywhere");
    expect(label.style.whiteSpace).toBe("");
    // The mark's box is one label line tall (1.5em at the label's size).
    const mark = host.querySelector("[aria-hidden=true]") as HTMLElement;
    expect(mark.style.height).toBe("1.5em");
    expect(mark.style.fontSize).toBe(label.style.fontSize);
  });
});

describe("SecondaryButton (D15)", () => {
  it("is drawn with the 12px button radius, not a pill", () => {
    expect(tokens.radius.button).toBe(12);
    render(<SecondaryButton>Finish my ballot</SecondaryButton>);
    expect(host.querySelector("button")!.style.borderRadius).toBe("12px");
  });
});

describe("type scale (D18)", () => {
  it("carries the board band's figure size, 48px (3rem)", () => {
    expect(tokens.type.figure).toBe(48);
  });
});

describe("44px hit areas (D17)", () => {
  it("gives the compact bar's Back a 44 by 44 box that keeps the drawn 40px footprint", () => {
    render(<TopBar title="Review" back={() => {}} />);
    const back = host.querySelector("button[aria-label=Back]") as HTMLElement;
    expect(back.style.width).toBe("44px");
    expect(back.style.height).toBe("44px");
    expect(back.style.margin).toBe("-2px");
  });

  it("gives the small Copy button the invisible 44px hit area, and only the small one", () => {
    render(<CopyButton value="abc" size="sm" />);
    expect(host.querySelector("button")!.className).toBe("bc-hit");
    render(<CopyButton value="abc" size="md" />);
    expect(host.querySelector("button")!.className).toBe("");
    render(<CopyButton value="abc" size="xs" />);
    expect(host.querySelector("button")!.className).toBe("");
  });

  it("gives a value's Check link the invisible 44px hit area", () => {
    render(
      <VerifiableValue
        label="Tracking code"
        value="BC-7F3A-19C2"
        checkHref="/board/"
      />,
    );
    expect(host.querySelector("a")!.className).toBe("bc-hit");
    expect(host.querySelector("button")!.className).toBe("bc-hit");
  });
});
