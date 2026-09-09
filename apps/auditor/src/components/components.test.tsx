import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Card, CopyButton, tokens } from "@balotachain/ui";
import { Chip } from "./Chip";
import { ResultBar } from "./ResultBar";
import { StatCard } from "./StatCard";

describe("Card", () => {
  it("renders its children on the surface colour", () => {
    render(<Card>panel body</Card>);
    const section = screen.getByText("panel body");
    expect(section).toHaveStyle({ background: tokens.color.surface });
  });

  it("drops its padding when flush", () => {
    render(<Card flush>flush body</Card>);
    expect(screen.getByText("flush body")).toHaveStyle({ padding: "0px" });
  });
});

describe("CopyButton", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies the value and confirms", async () => {
    render(<CopyButton value="sha256:abc" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("sha256:abc");
    });
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});

describe("Chip", () => {
  it("uses the success palette from the mockup", () => {
    render(<Chip variant="success">ELECTED</Chip>);
    expect(screen.getByText("ELECTED")).toHaveStyle({
      background: tokens.color.successLight,
      color: tokens.color.success,
    });
  });
});

describe("ResultBar", () => {
  it("clamps out-of-range percentages", () => {
    render(<ResultBar percent={140} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });

  it("mutes the bar for candidates who were not elected", () => {
    render(<ResultBar percent={40} dimmed />);
    const fill = screen.getByRole("progressbar").firstElementChild;
    expect(fill).toHaveStyle({ background: tokens.color.neutralBar });
  });
});

describe("StatCard", () => {
  it("renders the value in success green when ok", () => {
    render(
      <StatCard label="Verified" value="12,611,219" caption="99.98%" ok />,
    );
    expect(screen.getByText("12,611,219")).toHaveStyle({
      color: tokens.color.success,
    });
  });
});
