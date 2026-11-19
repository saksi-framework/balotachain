import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { PEER, SESSION, fixture } from "./test/fixtures";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Answers for /api/trustee/peer in turn; the rest as a live trustee would. */
function peerAnswers(answers: (() => Promise<Response>)[]) {
  let n = 0;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/trustee/peer") {
        const next = answers[Math.min(n, answers.length - 1)]!;
        n += 1;
        // A hung request ends only when the page aborts it.
        return Promise.race([
          next(),
          new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            ),
          ),
        ]);
      }
      if (url === "/api/me") return json(SESSION);
      if (url === "/api/trustee/status") return json(fixture("decryptReady"));
      return new Response("404 page not found", { status: 404 });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return { probes: () => n, fetchMock };
}

const ok = () => Promise.resolve(json(PEER));
const status = (code: number) => () =>
  Promise.resolve(new Response("x", { status: code }));
const down = () => Promise.reject(new TypeError("Failed to fetch"));
const hang = () => new Promise<Response>(() => {});

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/trustee/");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the live probe (I1)", () => {
  it("decides live on a 200 with a trustee id", async () => {
    const p = peerAnswers([ok]);
    render(<App />);
    await tick(10);
    expect(
      screen.getByRole("heading", { name: "Trustee 2 of 5" }),
    ).toBeTruthy();
    expect(p.probes()).toBe(1);
  });

  it.each([
    ["404", status(404)],
    ["401", status(401)],
    ["403", status(403)],
    ["200 without an id", () => Promise.resolve(json({ ok: true }))],
  ])("decides study on %s, asking once", async (_, answer) => {
    const p = peerAnswers([answer]);
    render(<App />);
    await tick(10);
    expect(p.probes()).toBe(1);
    expect(p.fetchMock.mock.calls.some(([u]) => String(u) === "/runs")).toBe(
      true,
    );
  });

  it.each([
    ["a network error", down],
    ["a 503", status(503)],
    ["a 408", status(408)],
    ["a 429", status(429)],
  ])(
    "retries %s, then decides on the next definitive answer",
    async (_, first) => {
      const p = peerAnswers([first, ok]);
      render(<App />);
      await tick(10);
      expect(p.probes()).toBe(1);
      expect(
        screen.queryByRole("heading", { name: "Trustee 2 of 5" }),
      ).toBeNull();
      await tick(500);
      expect(p.probes()).toBe(2);
      expect(
        screen.getByRole("heading", { name: "Trustee 2 of 5" }),
      ).toBeTruthy();
    },
  );

  it("never reads an answer that says nothing as the study view", async () => {
    const p = peerAnswers([down]);
    render(<App />);
    await tick(10 + 500 + 1000 + 2000);
    expect(p.probes()).toBe(4);
    expect(p.fetchMock.mock.calls.some(([u]) => String(u) === "/runs")).toBe(
      false,
    );
    expect(
      screen.getByText(/This page could not tell whether a trustee process/),
    ).toHaveTextContent("the server could not be reached. It asked 4 times.");
  });

  it("gives up on a hung probe after 5 seconds a try, then says so", async () => {
    const p = peerAnswers([hang]);
    render(<App />);
    await tick(5000);
    expect(p.probes()).toBe(1);
    await tick(500 + 5000 + 1000 + 5000 + 2000 + 5000);
    expect(p.probes()).toBe(4);
    expect(
      screen.getByText(/This page could not tell whether a trustee process/),
    ).toHaveTextContent("no answer within 5 seconds");
  });

  it("probes again from the notice", async () => {
    const p = peerAnswers([down, down, down, down, ok]);
    render(<App />);
    await tick(10 + 500 + 1000 + 2000);
    expect(p.probes()).toBe(4);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await tick(10);
    expect(p.probes()).toBe(5);
    expect(
      screen.getByRole("heading", { name: "Trustee 2 of 5" }),
    ).toBeTruthy();
  });

  it("stops on unmount: no request after the page goes away (N1)", async () => {
    const p = peerAnswers([down]);
    const { unmount } = render(<App />);
    await tick(10);
    expect(p.probes()).toBe(1);
    unmount();
    await tick(10_000);
    expect(p.probes()).toBe(1);
  });

  it("aborts a probe in flight on unmount (N1)", async () => {
    const p = peerAnswers([hang]);
    const { unmount } = render(<App />);
    await tick(10);
    const init = p.fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.signal?.aborted).toBe(false);
    unmount();
    expect(init.signal?.aborted).toBe(true);
    await tick(30_000);
    expect(p.probes()).toBe(1);
  });
});
