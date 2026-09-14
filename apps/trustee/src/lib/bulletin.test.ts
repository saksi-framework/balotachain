import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  listRuns,
  loadCeremony,
  submitPartialDecryption,
  publishTally,
  boardUrl,
} from "./bulletin";

function ok(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("console client", () => {
  it("lists runs from /runs, not the chain-dialling trail index", async () => {
    fetchMock.mockResolvedValue(ok([]));
    await listRuns();
    expect(fetchMock.mock.calls[0][0]).toBe("/runs");
  });

  it("loads the ceremony for a run", async () => {
    fetchMock.mockResolvedValue(ok({ election_id: "e1" }));
    const c = await loadCeremony("demo-1");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/ceremony/demo-1");
    expect(c.election_id).toBe("e1");
  });

  // The console holds every trustee's shares server-side, so the client sends
  // only who is acting — never key material and never a secret scalar.
  it("submits only the run and the trustee id", async () => {
    fetchMock.mockResolvedValue(ok({ run_id: "demo-1" }, 202));
    await submitPartialDecryption("demo-1", "2");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/ceremony/submit");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      run_id: "demo-1",
      trustee_id: "2",
    });
  });

  // The console's below-threshold message is already user-facing prose, so it
  // must reach the UI unchanged rather than being replaced by a generic error.
  it("surfaces the console's threshold refusal verbatim", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () =>
        "the tally needs 3 of 5 trustees; 2 have contributed so far",
    } as Response);
    await expect(publishTally("demo-1")).rejects.toThrow(
      "the tally needs 3 of 5 trustees; 2 have contributed so far",
    );
  });

  it("publishes to the ceremony endpoint", async () => {
    fetchMock.mockResolvedValue(ok({ run_id: "demo-1" }, 202));
    await publishTally("demo-1");
    expect(fetchMock.mock.calls[0][0]).toBe("/ceremony/publish");
  });

  it("links to the board served by the same console", () => {
    expect(boardUrl("demo-1")).toBe("/board/?run=demo-1");
  });
});
