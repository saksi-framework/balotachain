import type {
  Checkin,
  ElectionStatus,
  FoundVoter,
  ListSignature,
  LookupResult,
  VoterDetails,
} from "./live";

/**
 * The transport half of `RealLiveClient`: everything that crosses the
 * network to the live console. The crypto half (`voterCrypto.ts`) never
 * sees it, and this side never sees a secret: no credential, no issuance
 * state, no opening, and never a challenged ballot.
 *
 * `HttpTransport` (`http.ts`) implements it over the console's HTTP API
 * (saksi `docs/live/http-api.md`); tests and the local build use
 * `FixtureTransport` (`local.ts`). The shapes here are what the crypto half
 * needs, not the console's routes.
 */
export interface LiveTransport {
  /**
   * The precinct check-in (saksi docs/live/voter-list-api.md). The phone's
   * check-in cookie is HttpOnly: the browser sends it, nothing here reads it.
   * `checkin` answers null when the phone has none (404 `no-checkin`).
   */
  checkin(): Promise<Checkin | null>;
  findVoter(details: VoterDetails): Promise<FoundVoter>;
  declare(details: VoterDetails): Promise<Checkin>;
  signList(signature: ListSignature): Promise<Checkin>;

  /**
   * The election as recorded. `params` and `dkg` must be the on-chain
   * `ElectionParameters` and `DKGTranscript` hex (`GetElection`,
   * `GetDKGTranscript`), because the phone encrypts under them and checks a
   * challenged ballot against them. `dkg` is null while the trustees have
   * not published the transcript yet (the election is then in `setup`).
   */
  election(): Promise<TransportElection>;

  /**
   * Run one whole issuance (presign, then sign) with no other issuance for
   * this phone running at the same time, in this tab or another. A
   * transport without its own lock may leave this out; the client then runs
   * `run` directly.
   */
  exclusiveIssuance?<T>(run: () => Promise<T>): Promise<T>;
  /** Issuer step 1: send `blinded_commitment`, get the issuer's `r`. */
  issuePresign(blindedCommitment: string): Promise<{ r: string }>;
  /** Issuer step 2: send `e_prime`, get `s_iss`. One per presign session. */
  issueSign(ePrime: string): Promise<{ sIss: string }>;

  /**
   * Submit one position's cast ballot, exactly the hex `build_ballot` made
   * (never re-encoded), and wait for the ledger. Resolves once recorded.
   *
   * `shown` is what the phone showed for this ballot before the cast (both
   * public). It is never sent: the transport compares the console's answer
   * with it, and a different answer is a `record-mismatch` error, never a
   * success and never a silent retry.
   */
  submitBallot(
    positionId: string,
    ballot: string,
    shown?: ShownBallot,
    opts?: SubmitOptions,
  ): Promise<{ txId: string; block: number }>;

  /** Ask the public board about a tracking code (`BC-XXXX-XXXX`). */
  lookup(trackingCode: string): Promise<LookupResult>;
}

export interface SubmitOptions {
  /**
   * These exact bytes were sent before and the outcome is unknown (the
   * phone reloaded since). A refusal because the position is taken is then
   * checked against the board, as after a dropped answer in this session.
   */
  resend?: boolean;
}

/** The public values the phone showed for one ballot before the cast. */
export interface ShownBallot {
  trackingCode: string;
  fingerprint: string;
}

export interface TransportElection {
  title: string;
  status: ElectionStatus;
  /** On-chain ElectionParameters, hex. */
  params: string;
  /** On-chain DKGTranscript, hex; null before it is published. */
  dkg: string | null;
  /**
   * The issuer's public key, for blind issuance before the DKG transcript
   * exists. Not trusted on its own: the phone checks every new credential
   * against the issuer key bound in `params` before storing it.
   */
  issuerPublicKey: string;
  /**
   * The election id the server names. When set, the client refuses an
   * election whose parameters name another one.
   */
  electionId?: string;
  /** The run id the public board knows this election by. */
  runId?: string;
  /** "Precinct 0001A (demonstration)", for an election with a voter list. */
  precinctLabel?: string;
  /**
   * The joint key fingerprint the server shows. When set, the client
   * refuses a transcript whose joint key has another fingerprint.
   */
  jointKeyFingerprint?: string;
  /**
   * Display names only. The phone takes positions, candidates and their
   * order from `params`; these just label them. `positions` is keyed by
   * position id, `candidates` by contest id (`<position>/<candidate>`).
   */
  labels?: {
    positions?: Record<string, string>;
    candidates?: Record<string, { name: string; detail?: string }>;
  };
}
