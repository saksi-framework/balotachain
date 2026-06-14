import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Bulletin, Position } from "./lib/bulletin";

const loadBulletinMock = vi.fn<() => Promise<Bulletin>>();
const createElectionMock =
  vi.fn<
    (args: {
      name: string;
      opens: string;
      closes: string;
      positions: Position[];
    }) => Promise<Bulletin>
  >();
const registerVoterMock =
  vi.fn<
    (args: {
      voterId: string;
      email: string;
      name: string;
    }) => Promise<Bulletin>
  >();
const issueCredentialMock =
  vi.fn<(args: { voterId: string }) => Promise<Bulletin>>();

vi.mock("./lib/bulletin", async () => {
  const actual =
    await vi.importActual<typeof import("./lib/bulletin")>("./lib/bulletin");
  return {
    ...actual,
    loadBulletin: () => loadBulletinMock(),
    createElection: (args: {
      name: string;
      opens: string;
      closes: string;
      positions: Position[];
    }) => createElectionMock(args),
    registerVoter: (args: { voterId: string; email: string; name: string }) =>
      registerVoterMock(args),
    issueCredential: (args: { voterId: string }) => issueCredentialMock(args),
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

describe("Admin App", () => {
  beforeEach(() => {
    loadBulletinMock.mockReset();
    createElectionMock.mockReset();
    registerVoterMock.mockReset();
    issueCredentialMock.mockReset();
  });

  it("renders the wizard header and step 1", async () => {
    loadBulletinMock.mockResolvedValue(emptyBulletin());
    render(<App />);
    expect(screen.getByText(/BalotaChain — Admin/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create election/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(loadBulletinMock).toHaveBeenCalled();
    });
  });

  it("clicking Create election calls createElection with the form values", async () => {
    loadBulletinMock.mockResolvedValue(emptyBulletin());
    const updated: Bulletin = {
      ...emptyBulletin(),
      election: {
        id: "bc-2028-ph",
        name: "Philippine National Elections 2028",
        opens: "2026-06-08 06:00",
        closes: "2026-06-08 18:00",
        joint_public_key: "aa".repeat(32),
        trustees: [],
        threshold: 3,
        positions: [],
      },
    };
    createElectionMock.mockResolvedValue(updated);

    render(<App />);
    await waitFor(() => {
      expect(loadBulletinMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /create election/i }));

    await waitFor(() => {
      expect(createElectionMock).toHaveBeenCalledTimes(1);
    });
    const call = createElectionMock.mock.calls[0]![0];
    expect(call.name).toBe("Philippine National Elections 2028");
    expect(call.opens).toBe("2026-06-08 06:00");
    expect(call.closes).toBe("2026-06-08 18:00");
    expect(Array.isArray(call.positions)).toBe(true);
    expect(call.positions.length).toBeGreaterThan(0);
  });
});
