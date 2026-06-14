import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const loadBulletinMock = vi.fn();
const verifyTrackingCodeMock = vi.fn();

vi.mock("./lib/bulletin", async () => {
  const actual =
    await vi.importActual<typeof import("./lib/bulletin")>("./lib/bulletin");
  return {
    ...actual,
    loadBulletin: () => loadBulletinMock(),
    verifyTrackingCode: (code: string) => verifyTrackingCodeMock(code),
  };
});

const emptyBulletin = {
  version: 1,
  election: null,
  voters: [],
  credentials: [],
  ballots: [],
  partial_decryptions: [],
  tally: null,
};

beforeEach(() => {
  loadBulletinMock.mockReset();
  verifyTrackingCodeMock.mockReset();
});

describe("App", () => {
  it("renders the bulletin board header on mount", async () => {
    loadBulletinMock.mockResolvedValue(emptyBulletin);
    const { default: App } = await import("./App");
    render(<App />);
    expect(
      await screen.findByText(/BalotaChain — Bulletin Board/),
    ).toBeInTheDocument();
  });

  it("calls loadBulletin on mount", async () => {
    loadBulletinMock.mockResolvedValue(emptyBulletin);
    const { default: App } = await import("./App");
    render(<App />);
    await waitFor(() => {
      expect(loadBulletinMock).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the real submitted_at when verifyTrackingCode returns a hit", async () => {
    loadBulletinMock.mockResolvedValue(emptyBulletin);
    verifyTrackingCodeMock.mockResolvedValue({
      tracking_code: "BC-CAFE-0001",
      submitted_at: "2026-06-08T21:14:00Z",
      ballot_index: 0,
    });

    const { default: App } = await import("./App");
    render(<App />);

    const input = await screen.findByLabelText("Tracking code");
    fireEvent.change(input, { target: { value: "BC-CAFE-0001" } });
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(verifyTrackingCodeMock).toHaveBeenCalledWith("BC-CAFE-0001");
    });
    expect(await screen.findByText(/Vote verified/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-08T21:14:00Z/)).toBeInTheDocument();
  });

  it("shows the not-found error when verifyTrackingCode returns null", async () => {
    loadBulletinMock.mockResolvedValue(emptyBulletin);
    verifyTrackingCodeMock.mockResolvedValue(null);

    const { default: App } = await import("./App");
    render(<App />);

    const input = await screen.findByLabelText("Tracking code");
    fireEvent.change(input, { target: { value: "BC-9999-9999" } });
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(verifyTrackingCodeMock).toHaveBeenCalledWith("BC-9999-9999");
    });
    expect(
      await screen.findByText(/Tracking code not found/i),
    ).toBeInTheDocument();
  });

  it("renders the real tally fingerprint when the bulletin has a tally", async () => {
    loadBulletinMock.mockResolvedValue({
      ...emptyBulletin,
      ballots: [
        {
          tracking_code: "BC-CAFE-0001",
          nullifier: "n",
          ciphertext: { pad: "p", data: "d" },
          submitted_at: "2026-06-08T21:14:00Z",
        },
      ],
      tally: {
        results: {
          president: {
            candidates: [
              {
                id: "a",
                name: "Alice",
                party: "Lakas",
                votes: 10,
                elected: true,
              },
            ],
          },
        },
        fingerprint:
          "sha256:0000000000000000000000000000000000000000000000000000000000000001",
        trustees_signed: 3,
        trustees_total: 5,
        closed_at: "2026-06-08T23:59:00Z",
      },
    });
    const { default: App } = await import("./App");
    render(<App />);

    expect(
      await screen.findByText(
        /sha256:0000000000000000000000000000000000000000000000000000000000000001/,
      ),
    ).toBeInTheDocument();
  });

  it("shows 'Tally pending' when ballots exist but tally is null", async () => {
    loadBulletinMock.mockResolvedValue({
      ...emptyBulletin,
      ballots: [
        {
          tracking_code: "BC-CAFE-0001",
          nullifier: "n",
          ciphertext: { pad: "p", data: "d" },
          submitted_at: "2026-06-08T21:14:00Z",
        },
      ],
      tally: null,
    });
    const { default: App } = await import("./App");
    render(<App />);

    expect(await screen.findByText(/Tally pending/i)).toBeInTheDocument();
  });
});
