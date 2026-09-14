import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  listRuns,
  loadBoard,
  verifyTrackingCode,
  exportUrl,
  verifierUrl,
  getCapabilities,
} from "./bulletin";

function jsonResponse(body: unknown, status = 200): Response {
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
    fetchMock.mockResolvedValue(jsonResponse([]));
    await listRuns();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/runs");
  });

  it("loads the board for a run", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ election_id: "e1" }));
    const board = await loadBoard("demo-run-1");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/board/demo-run-1");
    expect(board.election_id).toBe("e1");
  });

  it("throws with the console's own message on a failed request", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "unknown run",
    } as Response);
    await expect(loadBoard("nope")).rejects.toThrow(/404.*unknown run/);
  });

  it("reports a hit", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        found: true,
        tracking_code: "BC-CAFE-0001",
        ballot_index: 0,
      }),
    );
    const outcome = await verifyTrackingCode("run-1", "BC-CAFE-0001");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/verify-code/run-1/BC-CAFE-0001",
    );
    expect(outcome).toMatchObject({ kind: "found" });
  });

  it("reports a miss as a normal answer, not an error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ found: false }));
    await expect(verifyTrackingCode("run-1", "BC-9999-9999")).resolves.toEqual({
      kind: "missing",
    });
  });

  // An 8-hex prefix is 32 bits, so two ballots can share one. The console
  // refuses that case and the client must keep the distinction from "missing".
  it("distinguishes an ambiguous prefix from a miss", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => "",
    } as Response);
    await expect(verifyTrackingCode("run-1", "BC-CAFE-0001")).resolves.toEqual({
      kind: "ambiguous",
    });
  });

  it("builds same-origin artifact and verifier URLs", () => {
    expect(exportUrl("run-1", "correctness.csv")).toBe(
      "/export/run-1/correctness.csv",
    );
    expect(verifierUrl("run-1")).toBe("/trail/run-1");
  });

  it("reads capabilities", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fabric: true, peer: "p:7051" }));
    await expect(getCapabilities()).resolves.toEqual({
      fabric: true,
      peer: "p:7051",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/capabilities");
  });
});
