import fixture from "../test/fixture/live-election.json";
import {
  LiveError,
  type Checkin,
  type ElectionStatus,
  type FoundVoter,
  type LookupResult,
} from "./live";
import {
  RealLiveClient,
  storedCredential,
  type RealClientOptions,
} from "./real";
import type { KeyValueStore } from "./storage";
import type { LiveTransport, TransportElection } from "./transport";

/**
 * A local stand-in for the console, so the real WebAssembly crypto can run
 * end to end before task 5b-2 wires the HTTP transport. It serves the
 * committed test election (`test/fixture/live-election.json`: THROWAWAY TEST
 * KEYS, see the README beside it) and records submitted ballots in memory.
 *
 * It has no issuer (the issuer's secret is never in the browser), so its
 * voters start with the fixture's credential already on the phone
 * (`withFixtureCredential`), and enrolment is not offered. Only built in
 * when `VITE_LIVE_LOCAL=1`; the default build leaves it out.
 */

/**
 * The local election's one check-in: a fictional voter whose credential is
 * already on the phone (the fixture's), so the phone opens the ballot.
 */
const LOCAL_CHECKIN: Checkin = {
  state: "credential_issued",
  electionId: fixture.election_id,
  precinctLabel: "Precinct 0001A (demonstration)",
  entry: { seq: 1, lastName: "Halimbawa", firstName: "Uno", middleName: "" },
};

const NO_CHECKIN =
  "The local test election has no voter list; its voter starts checked in, with a credential on the phone.";

const LABELS: NonNullable<TransportElection["labels"]> = {
  positions: { president: "President", "vice-president": "Vice President" },
  candidates: {
    "president/alice": { name: "Alice", detail: "Test candidate" },
    "president/bob": { name: "Bob", detail: "Test candidate" },
    "president/carol": { name: "Carol", detail: "Test candidate" },
    "vice-president/dan": { name: "Dan", detail: "Test candidate" },
    "vice-president/eve": { name: "Eve", detail: "Test candidate" },
    "vice-president/fay": { name: "Fay", detail: "Test candidate" },
  },
};

export interface FixtureTransportOptions {
  status?: ElectionStatus;
  /** Delay per ledger transaction, ms (the real network is about 2 s). */
  submitDelay?: number;
}

export class FixtureTransport implements LiveTransport {
  private readonly submitDelay: number;
  status: ElectionStatus;
  /** What was "recorded": position and tx id per submission, never the vote. */
  readonly recorded: { positionId: string; ballot: string; txId: string }[] =
    [];
  private block = 100;

  constructor(opts: FixtureTransportOptions = {}) {
    this.status = opts.status ?? "open";
    this.submitDelay = opts.submitDelay ?? 0;
  }

  async checkin(): Promise<Checkin | null> {
    return LOCAL_CHECKIN;
  }

  async findVoter(): Promise<FoundVoter> {
    throw new LiveError("refused", NO_CHECKIN);
  }

  async declare(): Promise<Checkin> {
    throw new LiveError("refused", NO_CHECKIN);
  }

  async signList(): Promise<Checkin> {
    throw new LiveError("refused", NO_CHECKIN);
  }

  async election(): Promise<TransportElection> {
    return {
      title: "Local test election",
      status: this.status,
      params: fixture.params,
      dkg: fixture.dkg,
      issuerPublicKey: fixture.issuer_public_key,
      precinctLabel: LOCAL_CHECKIN.precinctLabel,
      labels: LABELS,
    };
  }

  async issuePresign(): Promise<{ r: string }> {
    throw new LiveError(
      "refused",
      "The local test election has no issuer; its voters start with a credential on the phone.",
    );
  }

  async issueSign(): Promise<{ sIss: string }> {
    await this.issuePresign();
    throw new Error("unreachable");
  }

  async submitBallot(
    positionId: string,
    ballot: string,
  ): Promise<{ txId: string; block: number }> {
    if (this.status !== "open") {
      throw new LiveError("closed", "Voting has closed.");
    }
    if (this.submitDelay > 0) {
      await new Promise((r) => setTimeout(r, this.submitDelay));
    }
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    const txId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    this.recorded.push({ positionId, ballot, txId });
    return { txId, block: ++this.block };
  }

  async lookup(trackingCode: string): Promise<LookupResult> {
    void trackingCode;
    throw new LiveError(
      "network",
      "The local test election has no public board to ask.",
    );
  }
}

/**
 * The store, with the fixture's credential standing in when the phone has
 * none of its own (the fixture election has no issuer to enrol with).
 */
export function withFixtureCredential(store: KeyValueStore): KeyValueStore {
  return {
    ...store,
    async get<T>(key: string) {
      const v = await store.get<T>(key);
      if (v !== undefined || !key.startsWith("credential:")) return v;
      return storedCredential(fixture.election_id, fixture.credential) as T;
    },
    async getStrict<T>(key: string) {
      const v = await store.getStrict<T>(key);
      if (v !== undefined || !key.startsWith("credential:")) return v;
      return storedCredential(fixture.election_id, fixture.credential) as T;
    },
  };
}

/** The real client over the local fixture election. */
export function localClient(
  store: KeyValueStore,
  opts: FixtureTransportOptions & Pick<RealClientOptions, "crypto"> = {},
): { client: RealLiveClient; transport: FixtureTransport } {
  const { crypto, ...rest } = opts;
  const transport = new FixtureTransport(rest);
  const client = new RealLiveClient({
    transport,
    store: withFixtureCredential(store),
    crypto,
  });
  return { client, transport };
}
