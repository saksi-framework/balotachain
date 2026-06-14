import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Bulletin } from "./lib/bulletin";

const loadBulletinMock = vi.fn<() => Promise<Bulletin>>();
const submitAllPartialDecryptionsMock =
  vi.fn<(trusteeId: string, secretShare: number) => Promise<Bulletin>>();

vi.mock("./lib/bulletin", async () => {
  const actual =
    await vi.importActual<typeof import("./lib/bulletin")>("./lib/bulletin");
  return {
    ...actual,
    loadBulletin: () => loadBulletinMock(),
    submitAllPartialDecryptions: (id: string, share: number) =>
      submitAllPartialDecryptionsMock(id, share),
  };
});

import App from "./App";

function emptyBulletin(): Bulletin {
  return {
    version: 1,
    election: null,
    voters: [],
    credentials: [],
    ballots: [],
    partial_decryptions: [],
    tally: null,
  };
}

function bulletinWithBallots(n: number): Bulletin {
  const b = emptyBulletin();
  for (let i = 0; i < n; i++) {
    b.ballots.push({
      tracking_code: `b${i}`,
      nullifier: `null-${i}`,
      ciphertext: { pad: "aa", data: "bb" },
      submitted_at: "2026-06-14T18:00:00Z",
    });
  }
  return b;
}

describe("App", () => {
  beforeEach(() => {
    loadBulletinMock.mockReset();
    submitAllPartialDecryptionsMock.mockReset();
  });

  it("renders the console header without crashing", async () => {
    loadBulletinMock.mockResolvedValue(emptyBulletin());
    render(<App />);
    expect(
      screen.getByText(/BalotaChain — Trustee Console/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(loadBulletinMock).toHaveBeenCalled();
    });
  });

  it("clicking Submit shows the confirm panel", async () => {
    loadBulletinMock.mockResolvedValue(emptyBulletin());
    render(<App />);
    await waitFor(() => {
      expect(loadBulletinMock).toHaveBeenCalled();
    });
    fireEvent.click(
      screen.getByRole("button", { name: /submit my partial decryption/i }),
    );
    expect(
      screen.getByRole("button", { name: /confirm submission/i }),
    ).toBeInTheDocument();
  });

  it("confirming calls submitAllPartialDecryptions with trustee t03 and updates roster", async () => {
    loadBulletinMock.mockResolvedValue(bulletinWithBallots(2));
    const updated: Bulletin = {
      ...bulletinWithBallots(2),
      partial_decryptions: [
        {
          trustee_id: "t03",
          ballot_index: 0,
          share: "aa".repeat(32),
          submitted_at: "2026-06-14T18:10:00Z",
        },
        {
          trustee_id: "t03",
          ballot_index: 1,
          share: "bb".repeat(32),
          submitted_at: "2026-06-14T18:10:00Z",
        },
      ],
    };
    submitAllPartialDecryptionsMock.mockResolvedValue(updated);

    render(<App />);
    await waitFor(() => {
      expect(loadBulletinMock).toHaveBeenCalled();
    });
    fireEvent.click(
      screen.getByRole("button", { name: /submit my partial decryption/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /confirm submission/i }),
    );

    await waitFor(() => {
      expect(submitAllPartialDecryptionsMock).toHaveBeenCalledWith("t03", 17);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Partial decryption submitted\./i),
      ).toBeInTheDocument();
    });
  });
});
