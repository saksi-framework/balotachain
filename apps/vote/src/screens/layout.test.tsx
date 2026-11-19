/**
 * Task 5c-2 (layout): hit areas (D17) and the screen layout rules that a
 * unit test can see (a class or a style). The drawn sizes and the measured
 * hit areas are checked in a browser; see the task report.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import {
  AboutContext,
  FOOTER_MAX_SHARE,
  footerJoinsFlow,
  PracticeContext,
} from "../components/Layout";
import { useKeyboardOpen } from "../components/useKeyboardOpen";
import type { Position, SubmitReceipt } from "../lib/live";
import { CheckInForm, Found } from "./CheckIn";
import { Closed } from "./Status";
import { Review } from "./Review";
import { Submitted } from "./Submitted";
import { Verify } from "./Verify";

const POSITIONS: Position[] = [
  {
    id: "president",
    title: "President",
    candidates: [{ id: "a", name: "Candidate A" }],
  },
];
const RECEIPT: SubmitReceipt = {
  positionId: "president",
  trackingCode: "BC-0000-0001",
  fingerprint: "0000-0000-0000-0000-0000-0000-0000-0001",
  txId: "aa".repeat(32),
  block: 7,
};
const noop = () => {};

describe("D17: every footer text link has a 44px hit area", () => {
  it.each([
    [
      "the receipt",
      () => (
        <Submitted positions={POSITIONS} receipts={[RECEIPT]} onVerify={noop} />
      ),
    ],
    [
      "Verify",
      () => (
        <Verify ownCodes={[]} lookup={() => Promise.reject()} onBack={noop} />
      ),
    ],
    [
      "Closed",
      () => <Closed title="Election" boardHref="/board/" onVerify={noop} />,
    ],
  ])("on %s", (_, screenOf) => {
    render(screenOf());
    const link = screen.getByRole("link", { name: "Open the public board" });
    expect(link).toHaveClass("ba-link", "ba-footer-link");
  });

  it("the receipt's tracking-code Check link and small Copy buttons carry the hit area", () => {
    render(
      <Submitted positions={POSITIONS} receipts={[RECEIPT]} onVerify={noop} />,
    );
    const list = screen.getByRole("list", { name: "Receipts" });
    expect(within(list).getByRole("link", { name: "Check" })).toHaveClass(
      "bc-hit",
    );
    for (const copy of within(list).getAllByRole("button", { name: /Copy/ })) {
      expect(copy).toHaveClass("bc-hit");
    }
  });

  it("Back and Review's Edit are at least 44 by 44", () => {
    render(
      <Review
        positions={POSITIONS}
        choices={{ president: "a" }}
        busy={false}
        error={null}
        direction="fwd"
        onEdit={noop}
        onBack={noop}
        onEncrypt={noop}
      />,
    );
    const back = screen.getByRole("button", { name: "Back" });
    expect(back.style.width).toBe("44px");
    expect(back.style.height).toBe("44px");
    const edit = screen.getByRole("button", { name: "Edit President" });
    expect(edit.style.minHeight).toBe("44px");
    expect(edit.style.minWidth).toBe("44px");
  });
});

const TWO: Position[] = [
  ...POSITIONS,
  {
    id: "vice-president",
    title: "Vice President",
    candidates: [{ id: "b", name: "Candidate B" }],
  },
];

describe("D16 and the receipt's layout", () => {
  it("a partly recorded ballot shows the warning mark, not the recorded tick", () => {
    const { container } = render(
      <Submitted
        positions={TWO}
        receipts={[RECEIPT]}
        status="open"
        onVerify={noop}
        onFinish={noop}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Ballot partly recorded" }),
    ).toBeInTheDocument();
    // The tick is the one authored moment (`ba-pop`); not here.
    expect(container.querySelector(".ba-pop")).toBeNull();
  });

  it("a whole ballot keeps the recorded tick", () => {
    const { container } = render(
      <Submitted positions={POSITIONS} receipts={[RECEIPT]} onVerify={noop} />,
    );
    expect(container.querySelector(".ba-pop")).not.toBeNull();
  });

  it("the footer that acts on a partly recorded ballot is the dense one; the others are not", () => {
    const { container, unmount } = render(
      <Submitted
        positions={TWO}
        receipts={[RECEIPT]}
        status="open"
        onVerify={noop}
        onFinish={noop}
      />,
    );
    expect(container.querySelector(".ba-footer")).toHaveClass(
      "ba-footer-dense",
    );
    unmount();
    const whole = render(
      <Submitted positions={POSITIONS} receipts={[RECEIPT]} onVerify={noop} />,
    );
    expect(whole.container.querySelector(".ba-footer")).not.toHaveClass(
      "ba-footer-dense",
    );
  });

  it("the top bar sits in the safe-area wrapper and its title may wrap", () => {
    const { container } = render(
      <Closed
        title="A long election title"
        boardHref="/board/"
        onVerify={noop}
      />,
    );
    const h1 = container.querySelector(".ba-topbar h1") as HTMLElement;
    expect(h1).toHaveTextContent("A long election title");
    expect(h1.style.whiteSpace).toBe("");
    expect(h1.style.overflowWrap).toBe("anywhere");
  });
});

describe("D16: the keyboard lets the footer join the page flow", () => {
  const root = document.documentElement;
  let height = 844;
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    get: () => height,
  });
  afterEach(() => {
    height = 844;
    document.body.innerHTML = "";
  });

  function Probe() {
    useKeyboardOpen();
    return <input aria-label="Account name" />;
  }

  function resize(h: number) {
    height = h;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
  }

  it("marks the root while a field is focused and the visible area is much shorter", () => {
    const { unmount } = render(<Probe />);
    const field = screen.getByLabelText("Account name");
    act(() => field.focus());
    expect(root.dataset.keyboard).toBeUndefined();
    // A collapsing toolbar (56px) is not a keyboard.
    resize(788);
    expect(root.dataset.keyboard).toBeUndefined();
    resize(500);
    expect(root.dataset.keyboard).toBe("open");
    resize(844);
    expect(root.dataset.keyboard).toBeUndefined();
    resize(500);
    unmount();
    expect(root.dataset.keyboard).toBeUndefined();
  });

  it("does not mark it when no field is focused", () => {
    render(<Probe />);
    resize(400);
    expect(root.dataset.keyboard).toBeUndefined();
  });
});

describe("5c-2 follow-up: viewport rules (M1, M2, M5)", () => {
  const root = document.documentElement;
  let width = 390;
  let height = 844;
  /** A stand-in visual viewport (Safari's keyboard shrinks only this). */
  class FakeViewport extends EventTarget {
    height = 844;
    scale = 1;
  }
  let vv: FakeViewport | undefined;
  const restore: (() => void)[] = [];
  function stub<T extends object>(
    obj: T,
    key: string,
    get: (this: never) => unknown,
  ) {
    const before = Object.getOwnPropertyDescriptor(obj, key);
    Object.defineProperty(obj, key, { configurable: true, get });
    restore.push(() => {
      if (before) Object.defineProperty(obj, key, before);
      else delete (obj as Record<string, unknown>)[key];
    });
  }
  function setup() {
    width = 390;
    height = 844;
    vv = new FakeViewport();
    stub(window, "innerWidth", () => width);
    stub(window, "innerHeight", () => height);
    stub(window, "visualViewport", () => vv);
    stub(window.screen, "width", () => 390);
    stub(window.screen, "height", () => 844);
  }
  afterEach(() => {
    while (restore.length) restore.pop()!();
    document.body.innerHTML = "";
  });

  function Probe() {
    useKeyboardOpen();
    return <input aria-label="Account name" />;
  }

  it("M2: sees Safari's keyboard, which shrinks only the visual viewport", () => {
    setup();
    render(<Probe />);
    act(() => screen.getByLabelText("Account name").focus());
    act(() => {
      vv!.height = 500;
      vv!.dispatchEvent(new Event("resize"));
    });
    expect(root.dataset.keyboard).toBe("open");
    // Pinch zoom is not a keyboard: the visible height times the scale.
    act(() => {
      vv!.height = 422;
      vv!.scale = 2;
      vv!.dispatchEvent(new Event("resize"));
    });
    expect(root.dataset.keyboard).toBeUndefined();
  });

  it("M2: a rotation with the field focused and the keyboard up still reads as the keyboard", () => {
    setup();
    render(<Probe />);
    act(() => screen.getByLabelText("Account name").focus());
    // Android: the keyboard shrinks the layout viewport.
    height = 500;
    vv!.height = 500;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(root.dataset.keyboard).toBe("open");
    // Rotate to landscape with the keyboard still up: 844 wide, 200 tall.
    width = 844;
    height = 200;
    vv!.height = 200;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(root.dataset.keyboard).toBe("open");
    // Back to portrait, keyboard up: the portrait height seen before is kept.
    width = 390;
    height = 500;
    vv!.height = 500;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(root.dataset.keyboard).toBe("open");
    // The keyboard closes.
    height = 844;
    vv!.height = 844;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(root.dataset.keyboard).toBeUndefined();
  });

  it("M1: the rule is more than 40% of the visible height", () => {
    expect(FOOTER_MAX_SHARE).toBe(0.4);
    expect(footerJoinsFlow(197, 844)).toBe(false);
    expect(footerJoinsFlow(197, 568)).toBe(false);
    expect(footerJoinsFlow(228, 568)).toBe(true);
    expect(footerJoinsFlow(93, 0)).toBe(false);
  });

  it("M1: a footer taller than 40% of the visible height joins the flow, and pins again when it fits", () => {
    setup();
    let footerPx = 197;
    // The footer's measured height (happy-dom lays nothing out).
    stub(HTMLElement.prototype, "offsetHeight", function (this: HTMLElement) {
      return this.classList.contains("ba-footer") ? footerPx : 0;
    });
    const { container } = render(
      <Closed title="Election" boardHref="/board/" onVerify={noop} />,
    );
    const foot = container.querySelector(".ba-footer") as HTMLElement;
    expect(foot.dataset.flow).toBeUndefined();
    expect(root.style.getPropertyValue("--ba-footer-h")).toBe("197px");
    // Large text on a short phone: the footer grows past 40% of 568.
    footerPx = 329;
    height = 568;
    vv!.height = 568;
    act(() => vv!.dispatchEvent(new Event("resize")));
    expect(foot.dataset.flow).toBe("tall");
    expect(root.style.getPropertyValue("--ba-footer-h")).toBe("0px");
    // Deciding again with nothing changed keeps the answer (no loop).
    act(() => window.dispatchEvent(new Event("resize")));
    expect(foot.dataset.flow).toBe("tall");
    // Back to a tall screen: it pins again.
    height = 844;
    vv!.height = 844;
    act(() => vv!.dispatchEvent(new Event("resize")));
    expect(foot.dataset.flow).toBeUndefined();
    expect(root.style.getPropertyValue("--ba-footer-h")).toBe("329px");
  });

  it("M5: the practice strip's height is the top scroll padding, 0 without a strip", () => {
    stub(HTMLElement.prototype, "offsetHeight", function (this: HTMLElement) {
      return this.classList.contains("ba-practice") ? 37 : 0;
    });
    const closed = (
      <Closed title="Election" boardHref="/board/" onVerify={noop} />
    );
    const { unmount } = render(
      <PracticeContext.Provider value={true}>
        {closed}
      </PracticeContext.Provider>,
    );
    expect(root.style.getPropertyValue("--ba-banner-h")).toBe("37px");
    unmount();
    render(closed);
    expect(root.style.getPropertyValue("--ba-banner-h")).toBe("0px");
  });
});

// Vitest runs in the package directory (apps/vote).
const SRC = join(process.cwd(), "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("D16: type sizes in rem, the viewport meta", () => {
  it("has no fixed px font size anywhere in the voting page's source", () => {
    const fixed =
      /fontSize:\s*[0-9]|fontSize:\s*["'`][0-9.]+px|fontSize:\s*tokens\.type\.|font-size:\s*[0-9.]+px|font:\s*[0-9.]+px/;
    const offenders = files(SRC)
      .filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .map((line, i) => `${f}:${i + 1}: ${line.trim()}`)
          .filter((line) => fixed.test(line)),
      );
    expect(offenders).toEqual([]);
  });

  it("lets the keyboard resize the page, covers the notch, and never blocks zoom", () => {
    const html = readFileSync(join(SRC, "..", "index.html"), "utf8");
    const meta = /<meta\s+name="viewport"\s+content="([^"]+)"/.exec(html)![1]!;
    expect(meta).toContain("viewport-fit=cover");
    expect(meta).toContain("interactive-widget=resizes-content");
    expect(meta).not.toMatch(/user-scalable|maximum-scale/);
  });
});

describe("the check-in screens: labels, targets, fields (task 11)", () => {
  const ENTRY = {
    seq: 7,
    lastName: "Sampol",
    firstName: "Tres",
    middleName: "",
  };
  const css = () => readFileSync(join(SRC, "vote.css"), "utf8");
  /** The declarations of one CSS rule, by its exact selector. */
  const rule = (selector: string) =>
    new RegExp(
      `(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`,
    ).exec(css())?.[2] ?? "";

  it("labels every field, and the date's three fields are numeric, grouped under one legend", () => {
    render(
      <CheckInForm
        title="Election"
        precinctLabel="Precinct 0001A (demonstration)"
        initial={null}
        notice={null}
        error={null}
        busy={false}
        onFind={noop}
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: "Check in at Precinct 0001A (demonstration)",
      }),
    ).toBeInTheDocument();
    for (const label of ["Last name", "First name"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("maxlength", "100");
    }
    const group = screen.getByRole("group", { name: "Date of birth" });
    for (const label of ["Month", "Day", "Year"]) {
      const input = within(group).getByLabelText(label);
      expect(input).toHaveAttribute("inputmode", "numeric");
      expect(input).toHaveAttribute("pattern", "[0-9]*");
    }
    // The hint describes the group.
    expect(
      document.getElementById(group.getAttribute("aria-describedby")!),
    ).toHaveTextContent("Month, day and year in numbers");
    expect(screen.getByRole("button", { name: "Find my name" })).toBeDisabled();
  });

  it("the declaration's tick box is inside its label, and the label is a 44px target with a visible focus", () => {
    render(
      <Found
        title="Election"
        entry={ENTRY}
        busy={false}
        error={null}
        onBack={noop}
        onSend={noop}
      />,
    );
    const box = screen.getByRole("checkbox", {
      name: "I make this declaration.",
    });
    expect(box.closest("label")).toHaveClass("ba-check");
    expect(rule(".ba-check")).toMatch(/min-height: 44px/);
    expect(rule(".ba-check input:focus-visible")).toMatch(/outline: 2px solid/);
    expect(
      screen.getByRole("button", { name: "Send to the Electoral Board" }),
    ).toBeDisabled();
  });
});

describe("visual m8: the footer's election key breaks between groups only", () => {
  it("puts a break opportunity after every hyphen of the key", () => {
    const key = "5F2C-0A1B-D7A5-4E61";
    render(
      <AboutContext.Provider value={{ software: null, keyFingerprint: key }}>
        <Closed title="Voting has closed" boardHref="/board/" onVerify={noop} />
      </AboutContext.Provider>,
    );
    const about = screen.getByRole("contentinfo", {
      name: "About this phone's voting software",
    });
    const mono = about.querySelector(".bc-mono")!;
    expect(mono.textContent).toBe(key);
    expect(mono.querySelectorAll("wbr")).toHaveLength(3);
  });
});
