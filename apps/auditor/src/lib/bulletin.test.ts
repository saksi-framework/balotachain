import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

beforeEach(() => {
  invokeMock.mockReset();
});

describe("loadBulletin", () => {
  it("invokes the load_bulletin Tauri command with no arguments", async () => {
    invokeMock.mockResolvedValue({
      version: 1,
      election: null,
      voters: [],
      credentials: [],
      ballots: [],
      partial_decryptions: [],
      tally: null,
    });
    const { loadBulletin } = await import("./bulletin");
    const result = await loadBulletin();
    expect(invokeMock).toHaveBeenCalledWith("load_bulletin");
    expect(result.version).toBe(1);
    expect(result.ballots).toEqual([]);
  });
});

describe("verifyTrackingCode", () => {
  it("invokes verify_tracking_code with the code arg and returns the verification on hit", async () => {
    invokeMock.mockResolvedValue({
      tracking_code: "BC-CAFE-0001",
      submitted_at: "2026-06-08T21:14:00Z",
      ballot_index: 0,
    });
    const { verifyTrackingCode } = await import("./bulletin");
    const out = await verifyTrackingCode("BC-CAFE-0001");
    expect(invokeMock).toHaveBeenCalledWith("verify_tracking_code", {
      code: "BC-CAFE-0001",
    });
    expect(out).not.toBeNull();
    expect(out?.tracking_code).toBe("BC-CAFE-0001");
    expect(out?.ballot_index).toBe(0);
  });

  it("returns null on miss", async () => {
    invokeMock.mockResolvedValue(null);
    const { verifyTrackingCode } = await import("./bulletin");
    const out = await verifyTrackingCode("BC-9999-9999");
    expect(out).toBeNull();
  });
});
