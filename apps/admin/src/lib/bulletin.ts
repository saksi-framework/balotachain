/**
 * Typed client for the saksi-campaign console HTTP API — the admin side.
 *
 * The admin app is served BY the console at `/admin/` (`--web-dir`), so in
 * production every path here is same-origin: the session cookie rides along
 * and the console's cross-origin POST guard keeps protecting the write routes.
 * In dev Vite proxies these prefixes and strips the browser's `Origin` header.
 *
 * Field names mirror the Go structs in `saksi/packages/saksi-campaign`; each
 * type names the struct it maps. Keep them in lock-step.
 */

const BASE: string = (import.meta.env.VITE_CONSOLE_URL ?? "").replace(
  /\/$/,
  "",
);

/**
 * A non-2xx answer. `message` is the console's own text: `http.Error` writes
 * plain prose (Validate, the ladder gate, the disk guard, the threshold 409),
 * and the auth routes write `{"error": "..."}`. Either way it is user-facing
 * already, so the UI shows it verbatim.
 */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** `GET /api/me` (plan §4.1). `trustee_id` is set for trustees only. */
export type Session = {
  username: string;
  role: "admin" | "trustee";
  trustee_id?: string;
};

/** Go `Trustee` (config.go). */
export type TrusteeConfig = { name: string };

export type Distribution = "uniform" | "skewed" | "realistic";
export type Mode = "offline" | "onchain" | "groundtruth";

/**
 * Go `ElectionConfig` (config.go), the fields this app sends. The console
 * defaults `concurrency` itself (`applyDefaults`) and ignores what is absent.
 */
export type ElectionConfig = {
  name: string;
  trustees: TrusteeConfig[];
  threshold: number;
  positions: number;
  candidates: number;
  senate_seats: number;
  voters: number;
  distribution: Distribution;
  mode: Mode;
};

/** Go `runView` = `RunRecord{run_id, config, created_at}` + `artifacts` (server.go). */
export type RunView = {
  run_id: string;
  created_at: string;
  config: ElectionConfig;
  /** Existing exportable files, in `exportOrder`. Go nil slice → null. */
  artifacts: string[] | null;
};

/** `GET /api/capabilities` (`handleCapabilities`, server.go). */
export type Capabilities = { fabric: boolean; peer?: string; channel?: string };

/** Go `Check` (check.go). */
export type Check = { name: string; pass: boolean; detail: string };

/** Go `CheckReport` (check.go) — the data-validation gate. */
export type CheckReport = {
  pass: boolean;
  checks: Check[];
  rows: number;
  ground_truth_ballots_sha256: string;
  ground_truth_summary_sha256: string;
  voters: number;
  positions: number;
  candidates: number;
  distribution: string;
  election_id: string;
};

/**
 * The one data row of `election.csv` (`writeElectionCSV`, csvexport.go) —
 * the subset the Population step shows.
 */
export type ElectionSummary = {
  election_name: string;
  voters: number;
  /** Ballot records: one per voter per position. */
  num_ballots: number;
  num_partial_decryptions: number;
  candidates: number;
  issuer_public_key: string;
  ballots_sha256: string;
};

/** `GET /api/runs/<id>/status` (`handleRunStatus`, server.go). */
export type RunStatus = { run_id: string; busy: boolean };

/** Go `CeremonyTrustee` (ceremony.go). Ids are "1".."n". */
export type CeremonyTrustee = {
  id: string;
  name: string;
  submitted: boolean;
  contests: number;
  submitted_at?: string;
};

/** Go `CeremonyEvent` (ceremonyview.go). */
export type CeremonyEvent = {
  at?: string;
  kind: "setup" | "trustee" | "published" | "chain";
  who?: string;
  text: string;
  tx_id?: string;
  block?: number;
};

/** `GET /api/ceremony/<run>` — Go `CeremonyView` embedding `CeremonyState`. */
export type Ceremony = {
  threshold: number;
  trustees: CeremonyTrustee[];
  submitted: number;
  unlocked: boolean;
  published: boolean;
  on_chain: boolean;
  ready: boolean;
  started_at?: string;
  closed_at?: string;
  published_at?: string;
  election_id: string;
  name: string;
  mode: string;
  positions: number;
  position_ids?: string[];
  contests: number;
  ballot_records: number;
  events: CeremonyEvent[];
};

/**
 * One row of `correctness.csv` (`writeCorrectnessCSV`, executor.go). An
 * on-chain run whose ledger audit ran carries a second block of
 * `source=ledger` rows; `ledger_matches_local` is "true" | "false" | "".
 */
export type ContestResult = {
  contest: string;
  ground_truth: number;
  decoded: number;
  E: number;
  pass: boolean;
  published_tally: number;
  tally_sha256: string;
  source: string;
  ledger_matches_local: string;
};

/** Go `Event` (sse.go). */
export type ConsoleEvent = {
  phase: string;
  level: "info" | "error" | "done";
  msg: string;
};

async function failure(res: Response): Promise<ApiError> {
  const text = (await res.text()).trim();
  let message = text;
  try {
    const body = JSON.parse(text) as { error?: unknown };
    if (typeof body?.error === "string") message = body.error;
  } catch {
    // Plain-text http.Error body — already the message.
  }
  return new ApiError(res.status, message || `request failed (${res.status})`);
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) throw await failure(res);
  return res;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await send(path, {
    signal,
    headers: { Accept: "application/json" },
  });
  return (await res.json()) as T;
}

/**
 * A phase POST answers 202 "accepted", not "done": the console dispatches it
 * under the run's busy lock. Callers re-poll for the outcome.
 */
async function post(path: string, body?: unknown): Promise<Response> {
  return send(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const run = (id: string) => encodeURIComponent(id);

/**
 * The signed-in user, or `null` when the console has no auth routes at all —
 * a console without `--auth-file` support answers `/api/me` from its 404
 * catch-all, and the app then runs without a login. No session is a 401.
 */
export async function getMe(signal?: AbortSignal): Promise<Session | null> {
  try {
    return await get<Session>("/api/me", signal);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function login(username: string, password: string) {
  await post("/api/login", { username, password });
}

export async function logout() {
  await post("/api/logout");
}

export function listRuns(signal?: AbortSignal): Promise<RunView[]> {
  return get<RunView[]>("/runs", signal);
}

export function getCapabilities(signal?: AbortSignal): Promise<Capabilities> {
  return get<Capabilities>("/api/capabilities", signal);
}

export async function generateElection(config: ElectionConfig) {
  const res = await post("/generate", config);
  return ((await res.json()) as { run_id: string }).run_id;
}

export function checkPopulation(runId: string): Promise<CheckReport> {
  return get<CheckReport>(`/api/check/${run(runId)}`);
}

export function runStatus(runId: string): Promise<RunStatus> {
  return get<RunStatus>(`/api/runs/${run(runId)}/status`);
}

/** Minimal RFC 4180 reader: Go's csv.Writer quotes a field with `,` `"` or a newline. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Header-keyed records from a CSV export. */
async function exportRecords(
  runId: string,
  artifact: string,
): Promise<Record<string, string>[]> {
  const res = await send(`/export/${run(runId)}/${artifact}`);
  const [header = [], ...rows] = parseCsv(await res.text());
  return rows.map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])),
  );
}

export async function loadElectionSummary(
  runId: string,
): Promise<ElectionSummary> {
  const [r] = await exportRecords(runId, "election.csv");
  if (!r) throw new ApiError(0, "election.csv has no data row");
  return {
    election_name: r.election_name,
    voters: Number(r.voters),
    num_ballots: Number(r.num_ballots),
    num_partial_decryptions: Number(r.num_partial_decryptions),
    candidates: Number(r.candidates),
    issuer_public_key: r.issuer_public_key,
    ballots_sha256: r.ballots_sha256,
  };
}

export async function startCeremony(runId: string) {
  await post("/ceremony/start", { run_id: runId });
}

export function loadCeremony(
  runId: string,
  signal?: AbortSignal,
): Promise<Ceremony> {
  return get<Ceremony>(`/api/ceremony/${run(runId)}`, signal);
}

/** 409 below the threshold, with the console's own "needs N of M" message. */
export async function publishTally(runId: string) {
  await post("/ceremony/publish", { run_id: runId });
}

export async function verifyRun(runId: string) {
  await post("/verify", { run_id: runId });
}

export async function loadCorrectness(runId: string): Promise<ContestResult[]> {
  const records = await exportRecords(runId, "correctness.csv");
  return records.map((r) => ({
    contest: r.contest,
    ground_truth: Number(r.ground_truth),
    decoded: Number(r.decoded),
    E: Number(r.E),
    pass: r.pass === "true",
    published_tally: Number(r.published_tally),
    tally_sha256: r.tally_sha256,
    source: r.source,
    ledger_matches_local: r.ledger_matches_local,
  }));
}

/**
 * Live progress lines. The console's hub drops events for a slow subscriber and
 * has no replay, so this is a progress cue only — a poll is the state of record.
 */
export function subscribeEvents(
  runId: string,
  onEvent: (e: ConsoleEvent) => void,
): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const source = new EventSource(`${BASE}/events?run=${run(runId)}`);
  source.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data) as ConsoleEvent);
    } catch {
      // A malformed frame is not worth breaking the stream over.
    }
  };
  return () => source.close();
}

export const boardUrl = (runId: string) => `${BASE}/board/?run=${run(runId)}`;
export const trailUrl = (runId: string) => `${BASE}/trail/${run(runId)}`;
export const trusteeUrl = (runId: string, trusteeId: string) =>
  `${BASE}/trustee/?run=${run(runId)}&trustee=${encodeURIComponent(trusteeId)}`;
