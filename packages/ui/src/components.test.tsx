import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chip, type ChipVariant } from "./components/Chip.js";
import { CopyButton } from "./components/CopyButton.js";
import { TopBar } from "./components/TopBar.js";
import { VerifiableValue } from "./components/VerifiableValue.js";

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

describe("VerifiableValue", () => {
  const full = "0123456789abcdef0123456789abcdef";

  it("truncates in the middle and copies the full value", async () => {
    render(<VerifiableValue value={full} truncate label="Nullifier" />);
    const text = host.querySelector("code")!.textContent!;
    expect(text).toBe("01234567…89abcdef");
    await click(host.querySelector("button")!);
    expect(writeText).toHaveBeenCalledWith(full);
  });

  it("shows the whole value and a Check link when given", () => {
    render(<VerifiableValue value={full} checkHref="/api/verify-code/x" />);
    expect(host.querySelector("code")!.textContent).toBe(full);
    expect(host.querySelector("a")!.getAttribute("href")).toBe(
      "/api/verify-code/x",
    );
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
    expect(host.textContent).toContain("Trustee Console");
    expect(host.textContent).toContain("SSC 2026");
    expect(host.querySelector("[data-testid=role]")!.textContent).toBe(
      "Trustee 2 of 5",
    );
  });

  it("keeps the compact title bar", () => {
    render(<TopBar title="Review" />);
    expect(host.querySelector("h1")!.textContent).toBe("Review");
  });
});
