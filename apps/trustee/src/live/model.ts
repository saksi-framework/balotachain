/**
 * What the live trustee screen shows, derived from one `GET
 * /api/trustee/status` (design review D5 and D9). Pure functions only, so each
 * rule is tested without a page.
 *
 * Nothing here invents a state: every word comes from a field of the status,
 * or names the absence of one.
 */
import type { ChipVariant, StepperState, StepperStep } from "@balotachain/ui";
import { idToName } from "@balotachain/ui";
import type {
  StepName,
  StepState,
  StepStatus,
  TrusteeStatus,
} from "../lib/trustee";

export const STEP_ORDER: StepName[] = ["join", "decrypt", "sign"];

/** The tracker's labels (D5). */
export const STEP_LABEL: Record<StepName, string> = {
  join: "Key ceremony",
  decrypt: "Decrypt",
  sign: "Tally signature",
};

/** The short names in the tab title ("T2 Decrypt - BalotaChain"). */
const STEP_SHORT: Record<StepName, string> = {
  join: "Ceremony",
  decrypt: "Decrypt",
  sign: "Signature",
};

/** The primary button of each step. */
export const STEP_BUTTON: Record<StepName, string> = {
  join: "Join the key ceremony",
  decrypt: "Decrypt",
  sign: "Sign tally",
};

/** The button's label while the step's work is in progress (D9). */
export const STEP_BUSY: Record<StepName, string> = {
  join: "Joining the key ceremony…",
  decrypt: "Recording on chain…",
  sign: "Recording the signature…",
};

/** One sentence on what each step does. */
export const STEP_WHAT: Record<StepName, string> = {
  join: "Posts this trustee's key, checks the roster with the other trustees' own hosts, then deals and receives the key shares.",
  decrypt:
    "Reads every ballot record from the chain and records this trustee's partial decryption of the totals. No single ballot is decrypted. This is the last press: the tally signature follows by itself.",
  sign: "No press is needed. Once enough trustees have decrypted, this trustee process combines their partials from the chain into its own count, then signs that count and posts the signature by itself, unless an alarm blocks it.",
};

/**
 * The sign step's lead when the "No press is needed" sentence would not be
 * true: a retry is offered, or the step is blocked, refused or failed.
 */
export const SIGN_LEAD_NEUTRAL =
  "The process signs this trustee's own count by itself after Decrypt.";

/**
 * Review Important 1: the sign step's lead says "No press is needed" only
 * while the process waits, signs, or waits for the console; with a retry,
 * a refusal, a block or an error it is the neutral lead.
 */
export function stepWhat(s: TrusteeStatus, step: StepName): string {
  if (step !== "sign") return STEP_WHAT[step];
  const a = actionFor(s, "sign");
  const st = stepOf(s, "sign").state;
  const signing = s.tally?.signing;
  if (
    a.canPress ||
    a.error ||
    st === "blocked" ||
    st === "refused" ||
    st === "failed" ||
    signing === "blocked" ||
    signing === "refused" ||
    signing === "retry" ||
    signing === "not_decrypted" ||
    blockingAlarms(s, "sign").length > 0
  )
    return SIGN_LEAD_NEUTRAL;
  return STEP_WHAT.sign;
}

/** The console reports the tally published (`election.state`). */
export function consolePublished(s: TrusteeStatus): boolean {
  const st = s.election?.state;
  return st === "tallied" || st === "verified";
}

/**
 * Review minor 1: the console reports the tally published and this trustee's
 * signature was not posted, while its sign step is still signing, waiting or
 * idle: the process does not sign once the console is tallied.
 */
export const SIGN_PUBLISHED_NOT_NEEDED =
  "The console reports the tally published. This trustee's signature is not needed.";

function publishedBeforeSigning(s: TrusteeStatus): boolean {
  if (!consolePublished(s) || s.tally?.signature_posted) return false;
  const signing = s.tally?.signing;
  const st = stepOf(s, "sign").state;
  return (
    (signing === undefined ||
      signing === "signing" ||
      signing === "waiting" ||
      signing === "not_decrypted") &&
    (st === "idle" || st === "waiting" || st === "running")
  );
}

export function stepOf(s: TrusteeStatus, name: StepName): StepStatus {
  return s.steps?.[name] ?? { state: "idle" };
}

/** Where the screen stands: no election, one of the steps, or all done. */
export type Phase = "none" | StepName | "finished";

/**
 * A trustee that never pressed Decrypt does not sign (trustee-api.md,
 * "Combine and sign": condition 1), so before publication its Decrypt is
 * still the step to take. Once the tally is published it is not needed: the
 * late trustee combines, shows the totals and signs nothing.
 */
export function decryptNotNeeded(s: TrusteeStatus): boolean {
  if (stepOf(s, "decrypt").state !== "idle") return false;
  return (
    Boolean(s.tally?.published) ||
    s.tally?.signing === "not_needed" ||
    consolePublished(s)
  );
}

/**
 * The tally was published before this trustee's signature was posted
 * (`tally.signing` `not_needed`): the sign step is `done` with "the tally is
 * published; no signature is needed", or with the note that other trustees'
 * signatures were first. Nothing this trustee does adds to the record.
 */
export function signNotNeeded(s: TrusteeStatus): boolean {
  if (s.tally?.signature_posted) return false;
  if (s.tally?.signing === "not_needed") return true;
  if (publishedBeforeSigning(s)) return true;
  const st = stepOf(s, "sign").state;
  // The step ended done with no signature posted: nothing was recorded.
  if (st === "done") return true;
  if (!s.tally?.published) return false;
  return st === "idle" || st === "waiting";
}

export function currentPhase(s: TrusteeStatus): Phase {
  if (!s.election) return "none";
  if (stepOf(s, "join").state !== "done") return "join";
  if (stepOf(s, "decrypt").state !== "done" && !decryptNotNeeded(s))
    return "decrypt";
  if (stepOf(s, "sign").state !== "done" && !signNotNeeded(s)) return "sign";
  return "finished";
}

/**
 * The tracker (D5). Process state to tracker word:
 * - `done` is "done";
 * - the current phase's step, in any other state, is "current";
 * - every step after it is "locked";
 * - a Decrypt this trustee never pressed, once the tally no longer needs it,
 *   is "not needed" (drawn as not done).
 */
export function trackerSteps(s: TrusteeStatus): {
  steps: StepperStep[];
  current: number;
} {
  const phase = currentPhase(s);
  const current =
    phase === "none"
      ? 0
      : phase === "finished"
        ? STEP_ORDER.length + 1
        : STEP_ORDER.indexOf(phase) + 1;
  const steps = STEP_ORDER.map((name, i): StepperStep => {
    const n = i + 1;
    const done = stepOf(s, name).state === "done";
    if (
      (name === "decrypt" && decryptNotNeeded(s) && phase !== "decrypt") ||
      (name === "sign" && signNotNeeded(s))
    )
      return {
        label: STEP_LABEL[name],
        status: "not needed",
        state: "pending",
      };
    // Before the current step but not done (cannot happen with the rule
    // above, kept honest anyway): never draw a tick that was not earned.
    if (n < current && !done)
      return { label: STEP_LABEL[name], state: "pending" as StepperState };
    return { label: STEP_LABEL[name] };
  });
  return { steps, current };
}

/** "T2 Decrypt - BalotaChain" (D5, D13). */
export function tabTitle(trusteeId: number, s: TrusteeStatus | null): string {
  return `T${trusteeId} ${titleWord(s)} - BalotaChain`;
}

function titleWord(s: TrusteeStatus | null): string {
  if (!s) return "Sign in";
  const phase = currentPhase(s);
  if (phase === "none") return "No election";
  if (phase === "finished")
    return s.tally?.published || signNotNeeded(s) ? "Published" : "Signed";
  return STEP_SHORT[phase];
}

/** Alarms that block this step. */
export function blockingAlarms(s: TrusteeStatus, step: StepName) {
  return (s.alarms ?? []).filter((a) => (a.blocks ?? []).includes(step));
}

/**
 * The current step's action card.
 * - `canPress`: the primary button is offered and enabled.
 * - `running`: the process is working on it (the button shows `STEP_BUSY`).
 * - `unlock`: one sentence naming what unlocks a button that cannot be
 *   pressed, or what the step waits on.
 * - `error`: the process's own words for a failed or refused step.
 * - `retry`: the button reads "Try again" (the API document allows a retry
 *   of a failed step, and of a refused Join or Decrypt).
 * - `noButton`: no button at all; `unlock` says why the step cannot run.
 */
export type Action = {
  step: StepName;
  state: StepState;
  canPress: boolean;
  running: boolean;
  unlock: string | null;
  error: string | null;
  retry: boolean;
  noButton?: boolean;
};

/**
 * Rehearsal 4, m1: the election is closed with fewer ballot records than
 * decryption needs (`decryption.min_ballot_records`, compared with the
 * console's count as trustee-api.md says). Built only from the two numbers
 * the process sent. Null when the process does not send the minimum (an
 * older process) or the count is enough.
 */
export function tooFewRecords(s: TrusteeStatus): string | null {
  const min = s.decryption?.min_ballot_records;
  const have = s.election?.ballot_records;
  if (s.election?.state !== "closed") return null;
  if (typeof min !== "number" || min <= 0) return null;
  if (typeof have !== "number" || have >= min) return null;
  const records =
    have === 1 ? "1 ballot record is" : `${have} ballot records are`;
  return `${records} on the chain, by the console's count; decryption needs at least ${min}. This election cannot be decrypted, because no ballot can be added once voting is closed. The presenter has to reset the console before the next election.`;
}

const ALARM_BLOCKS =
  "An alarm above blocks this step. It stays blocked for this election.";

/** Said when the list of totals to sign cannot be built from the status. */
export const TOTALS_UNLISTED =
  "The totals to sign cannot be listed from what this trustee process reports, so Sign tally stays off. Check now to read the status again.";

/** The sign step while the process signs by itself (`signing`). */
export const SIGN_SIGNING =
  "This trustee's own count gives the totals below. The process is signing them and posting the signature by itself. No press is needed.";

/** `waiting` with `sign_problem` `console_unreachable`. */
export const SIGN_CONSOLE_UNREACHABLE =
  "The console is not answering, so this trustee's signature is not posted yet. The process posts it again by itself when the console answers. No press is needed.";

/** `retry`: the automatic signature did not go through. */
export const SIGN_RETRY =
  "The automatic signature was not posted. Sign tally tries again, with every check, over the totals below.";

/**
 * The process is retrying a failed signature by itself (trustee-api.md,
 * "Retries by itself"): the numbers it sent, and its own words if any.
 */
export function signRetryingText(s: TrusteeStatus): string | null {
  const n = s.tally?.sign_attempts;
  if (typeof n !== "number" || n <= 0) return null;
  const max = s.tally?.sign_attempts_max;
  const of = typeof max === "number" && max > 0 ? ` of ${max}` : "";
  const st = stepOf(s, "sign");
  const why = st.detail || st.error;
  return `The signature could not be posted (attempt ${n}${of}). The process tries again by itself.${
    why ? ` The process reports: ${why}` : ""
  }`;
}

/** `not_decrypted`: this trustee does not sign. */
export const SIGN_NOT_DECRYPTED =
  "This trustee did not decrypt this election, so it does not sign.";

/**
 * `waiting` (or idle after Decrypt) with no words from the process. The
 * count is the process's own, which can lag a poll behind (rehearsal 7,
 * minor 1), so it is named as the process's last count; at or above the
 * threshold the sentence says the process is combining and signing.
 */
export function signWaitingText(s: TrusteeStatus): string {
  const k = s.decryption?.trustees_decrypted;
  const t = s.decryption?.threshold || s.election?.threshold || 0;
  if (t > 0 && typeof k === "number" && k >= t)
    return `Enough trustees have decrypted (the process last counted ${k} of ${t}). This trustee process is combining their partials and signing by itself.`;
  const count =
    t > 0
      ? typeof k === "number"
        ? `Waiting for ${t} trustees to decrypt (the process last counted ${k}).`
        : `Waiting for ${t} trustees to decrypt.`
      : "Waiting for enough trustees to decrypt.";
  return `${count} This trustee then signs by itself, once its own count is ready.`;
}

export function actionFor(s: TrusteeStatus, step: StepName): Action {
  const a = step === "sign" ? actionForSign(s) : actionForStep(s, step);
  // What is listed on screen is what the Sign body sends; no list, no Sign.
  if (step === "sign" && a.canPress && totalsByPosition(s) === null)
    return { ...a, canPress: false, retry: false, unlock: TOTALS_UNLISTED };
  return a;
}

/**
 * The sign step (trustee-api.md, "Combine and sign"): never pressed in the
 * normal flow. Only `tally.ready_to_sign` (`signing` `retry`) offers the
 * Sign tally button, with the process's reason; every other state has no
 * button and one line on what happens next, in the process's words where it
 * gives them. Alarms and refusals keep their own sentences.
 */
function actionForSign(s: TrusteeStatus): Action {
  const st = stepOf(s, "sign");
  const signing = s.tally?.signing;
  const base: Action = {
    step: "sign",
    state: st.state,
    canPress: false,
    running: false,
    unlock: null,
    error: null,
    retry: false,
    noButton: true,
  };
  if (s.identity?.checked && !s.identity.ok) {
    return {
      ...base,
      unlock: `Nothing runs until the console confirms this trustee's token: ${
        s.identity.error || "not confirmed"
      }`,
    };
  }
  if (
    blockingAlarms(s, "sign").length > 0 ||
    st.state === "blocked" ||
    signing === "blocked"
  ) {
    return { ...base, unlock: ALARM_BLOCKS, error: st.error || null };
  }
  if (s.election?.state === "abandoned" && st.state !== "done") {
    return {
      ...base,
      error: st.error || null,
      unlock:
        "This election was abandoned. A new election starts a new key ceremony.",
    };
  }
  if (publishedBeforeSigning(s)) {
    return { ...base, unlock: SIGN_PUBLISHED_NOT_NEEDED };
  }
  if (signing === "refused" || st.state === "refused") {
    return {
      ...base,
      error: st.error || "The process refused to sign.",
    };
  }
  if (s.tally?.ready_to_sign) {
    // The one case with a button: a retry the process offers.
    return {
      ...base,
      canPress: true,
      noButton: false,
      error: st.error || null,
      unlock: SIGN_RETRY,
    };
  }
  if (signing === "retry" || st.state === "failed") {
    // A failed attempt the process does not offer to retry yet: its words.
    return { ...base, error: st.error || "The automatic signature failed." };
  }
  if (signing === "not_decrypted") {
    return { ...base, unlock: SIGN_NOT_DECRYPTED };
  }
  // Retrying by itself (a failed step returned above): never a button.
  const retrying = signRetryingText(s);
  if (retrying) {
    return { ...base, unlock: retrying };
  }
  if (s.tally?.sign_problem === "console_unreachable") {
    return { ...base, unlock: SIGN_CONSOLE_UNREACHABLE };
  }
  if (signing === "signing" || st.state === "running") {
    return { ...base, running: true, unlock: SIGN_SIGNING };
  }
  // waiting, or idle after Decrypt: the process's words, else what it waits on.
  return {
    ...base,
    unlock: st.detail || st.error || signWaitingText(s),
  };
}

function actionForStep(s: TrusteeStatus, step: StepName): Action {
  const st = stepOf(s, step);
  const base: Action = {
    step,
    state: st.state,
    canPress: false,
    running: st.state === "running",
    unlock: null,
    error: null,
    retry: false,
  };
  const election = s.election;

  if (s.identity?.checked && !s.identity.ok) {
    return {
      ...base,
      unlock: `Nothing runs until the console confirms this trustee's token: ${
        s.identity.error || "not confirmed"
      }`,
    };
  }
  if (blockingAlarms(s, step).length > 0 || st.state === "blocked") {
    return {
      ...base,
      running: false,
      unlock: ALARM_BLOCKS,
      error: st.error || null,
    };
  }
  if (election?.state === "abandoned" && st.state !== "done") {
    return {
      ...base,
      running: false,
      error: st.error || null,
      unlock:
        "This election was abandoned. A new election starts a new key ceremony.",
    };
  }

  if (
    step === "decrypt" &&
    (st.state === "idle" || st.state === "failed" || st.state === "refused")
  ) {
    const few = tooFewRecords(s);
    if (few) return { ...base, running: false, unlock: few, noButton: true };
  }

  switch (st.state) {
    case "running":
      return { ...base, unlock: st.detail || null };
    case "waiting": {
      return {
        ...base,
        unlock:
          st.detail ||
          st.error ||
          "Waiting on the other trustees. This carries on by itself.",
      };
    }
    case "failed":
      return {
        ...base,
        canPress: true,
        retry: true,
        error: st.error || "This step failed.",
      };
    case "refused":
      // trustee-api.md: "A step that failed or was refused starts again" on
      // join and decrypt.
      return {
        ...base,
        canPress: true,
        retry: true,
        error: st.error || "The process refused this step.",
      };
    case "done":
      return base;
    default:
      break;
  }

  // idle: what unlocks it.
  const state = election?.state ?? "";
  if (step === "join") {
    if (state === "setup")
      return {
        ...base,
        unlock:
          st.detail || "Opens when the election is recorded on the chain.",
      };
    if (state === "ceremony") return { ...base, canPress: true };
    return {
      ...base,
      unlock:
        st.detail ||
        "The key ceremony is over. It ended before this trustee joined.",
    };
  }
  {
    if (state === "setup" || state === "ceremony")
      return {
        ...base,
        unlock:
          st.detail || "Opens when the key ceremony ends and voting closes.",
      };
    if (state === "open")
      return {
        ...base,
        unlock: st.detail || "Opens when the presenter closes voting.",
      };
    if (s.ceremony?.transcript_check !== "ok")
      return {
        ...base,
        unlock:
          st.detail ||
          "Opens when this trustee has checked the election key on the chain.",
      };
    return { ...base, canPress: true };
  }
}

/** A totals row: the position and candidate as shown, with its number. */
export type TotalRow = {
  contest_id: string;
  position: string;
  candidate: string;
  total: number;
  published: number | null;
};

/**
 * The totals per position and candidate (D19: names through `idToName`),
 * built from exactly what the Sign body sends: `tally.totals`, which the API
 * gives "in `contest_ids` order", paired with `election.contest_ids`. The
 * published number sits beside each once there is one.
 *
 * Returns null when that list cannot be built from the status: no totals, a
 * count that differs from the contest ids, or `tally.contests` naming other
 * numbers than the totals. Sign is then not offered (`actionFor`).
 */
export function totalsByPosition(
  s: TrusteeStatus,
): { position: string; rows: TotalRow[] }[] | null {
  const totals = s.tally?.totals ?? [];
  const order = s.election?.contest_ids ?? [];
  const contests = s.tally?.contests ?? [];
  const published = s.tally?.published_totals ?? [];
  if (totals.length === 0 || totals.length !== order.length) return null;
  if (
    contests.length > 0 &&
    (contests.length !== order.length ||
      contests.some(
        (c, i) => c.contest_id !== order[i] || c.total !== totals[i],
      ))
  )
    return null;
  const groups: { position: string; rows: TotalRow[] }[] = [];
  for (const [i, id] of order.entries()) {
    const slash = id.indexOf("/");
    const pos = slash >= 0 ? id.slice(0, slash) : id;
    const cand = slash >= 0 ? id.slice(slash + 1) : "";
    const row: TotalRow = {
      contest_id: id,
      position: idToName(pos),
      candidate: idToName(cand),
      total: totals[i]!,
      published: i < published.length ? published[i]! : null,
    };
    const g = groups.find((x) => x.position === row.position);
    if (g) g.rows.push(row);
    else groups.push({ position: row.position, rows: [row] });
  }
  return groups;
}

function chip(word: string, variant: ChipVariant) {
  return { word, variant };
}

/** A roster row (D5): only what the status carries about each trustee. */
export type RosterRow = {
  id: number;
  you: boolean;
  word: string;
  variant: ChipVariant;
  detail: string | null;
};

/** This trustee's own chip, from its current step's state. */
export function ownWord(
  step: StepName | null,
  state: StepState,
): { word: string; variant: ChipVariant } {
  switch (state) {
    case "running":
      return {
        word: step === "sign" ? "Signing…" : "Recording…",
        variant: "active",
      };
    case "waiting":
      return { word: "Waiting", variant: "neutral" };
    case "done":
      return {
        word:
          step === "join" ? "Joined" : step === "sign" ? "Signed" : "Recorded",
        variant: "success",
      };
    case "failed":
      return { word: "Failed", variant: "error" };
    case "refused":
      return { word: "Refused", variant: "error" };
    case "blocked":
      return { word: "Blocked", variant: "error" };
    default:
      return { word: "Not started", variant: "neutral" };
  }
}

/**
 * This trustee's own chip during the sign step, from `tally.signing` first:
 * a blocked, refused or failed signature is an error chip, never progress,
 * and "Signed" only once the process reports the signature posted.
 */
function ownSignWord(s: TrusteeStatus): { word: string; variant: ChipVariant } {
  const st = stepOf(s, "sign").state;
  switch (s.tally?.signing) {
    case "signed":
      // "Signed" only with the posted signature the status reports.
      return s.tally.signature_posted
        ? chip("Signed", "success")
        : chip("Waiting", "neutral");
    case "blocked":
      return chip("Blocked", "error");
    case "refused":
      return chip("Refused", "error");
    case "retry":
      return chip("Not signed", "error");
    case "not_decrypted":
      return chip("Does not sign", "neutral");
    case "signing":
      return chip("Signing…", "active");
    case "waiting":
      return chip("Waiting", "neutral");
    default:
      return ownWord("sign", st);
  }
}

/**
 * Per-trustee status only where the status carries it: the roster check with
 * each peer's own host during the ceremony (`ceremony.roster[].peer_check`),
 * and the ballot-set comparison after (`decryption.peer_checks[]`, which the
 * trustee process reads again from each peer on every poll from the close
 * on). The
 * status does not say which other trustees have recorded a partial, only how
 * many (`decryption.trustees_decrypted`); a trustee with nothing reported
 * reads "No report".
 */
export function rosterRows(s: TrusteeStatus): RosterRow[] {
  const n = s.election?.trustees ?? 0;
  const phase = currentPhase(s);
  const own =
    phase === "none"
      ? ownWord(null, "idle")
      : phase === "finished"
        ? signNotNeeded(s)
          ? // The same condition draws the tracker's "not needed" (m2).
            chip("Not needed", "neutral")
          : ownWord("sign", "done")
        : phase === "sign"
          ? ownSignWord(s)
          : ownWord(phase, stepOf(s, phase).state);
  const rows: RosterRow[] = [];
  for (let id = 1; id <= n; id++) {
    if (id === s.trustee_id) {
      rows.push({ id, you: true, ...own, detail: null });
      continue;
    }
    let word = "No report";
    let variant: ChipVariant = "neutral";
    let detail: string | null = null;
    if (phase === "join" || phase === "none") {
      const e = (s.ceremony?.roster ?? []).find((r) => r.trustee_id === id);
      if (e) {
        detail = e.detail || null;
        if (e.peer_check === "ok")
          ({ word, variant } = chip("Roster checked", "success"));
        else if (e.peer_check === "waiting")
          ({ word, variant } = chip("Waiting", "neutral"));
        else if (e.peer_check === "mismatch")
          ({ word, variant } = chip("Roster differs", "error"));
        else ({ word, variant } = chip("Not checked yet", "neutral"));
      }
    } else {
      const c = (s.decryption?.peer_checks ?? []).find(
        (r) => r.trustee_id === id,
      );
      if (c) {
        detail = c.detail || null;
        if (c.state === "ok")
          ({ word, variant } = chip("Same ballots", "success"));
        else if (c.state === "mismatch")
          ({ word, variant } = chip("Other ballots", "error"));
        else if (c.state === "reported")
          ({ word, variant } = chip("Ballot set read", "neutral"));
        else if (c.state === "unreachable")
          // No statement from that peer; the detail says why ("not
          // reachable: ..." or "answered 503"), so the chip claims neither.
          ({ word, variant } = chip("No report", "neutral"));
        else ({ word, variant } = chip("No ballot set yet", "neutral"));
      }
    }
    rows.push({ id, you: false, word, variant, detail });
  }
  return rows;
}

/**
 * The sign step's state in the log: it runs without a press, so `running`
 * reads as signing by itself, and `failed` names the retry. `done` stays
 * plain: it is also the end of a trustee that signed nothing.
 */
const SIGN_LOG_WORD: Record<StepState, string> = {
  idle: "idle",
  running: "signing by itself",
  waiting: "waiting",
  done: "done",
  failed: "failed, Sign tally can retry",
  refused: "refused",
  blocked: "blocked",
};

/** One ceremony-log line: a fact the status carried with a time. */
export type LogEntry = {
  key: string;
  at: string;
  lead: string;
  detail: string | null;
  kind: "step" | "alarm";
};

/** Go's zero `time.Time` marks a step never touched; it is not a time. */
function realTime(at: string | undefined): number | null {
  if (!at) return null;
  const t = Date.parse(at);
  if (Number.isNaN(t) || new Date(t).getUTCFullYear() <= 1) return null;
  return t;
}

/**
 * The ceremony log, newest first. The status has no log field, so the list
 * is built only from facts it carries with a time: each step's state and
 * `detail` (or `error`) at its `updated_at`, and each alarm at its `at`. The
 * entries seen on earlier polls of the same election are kept (the status
 * only carries each step's latest state); a new election starts a new log.
 */
export function mergeLog(
  prev: LogEntry[],
  prevElection: string | null,
  s: TrusteeStatus,
): LogEntry[] {
  const election = s.election?.election_id ?? null;
  const keep = election !== null && election === prevElection ? prev : [];
  const byKey = new Map(keep.map((e) => [e.key, e]));
  for (const name of STEP_ORDER) {
    const st = s.steps?.[name];
    if (!st || realTime(st.updated_at) === null) continue;
    const text = st.error || st.detail || "";
    // One entry per step and time: a later poll's detail replaces it.
    const key = `step|${name}|${st.updated_at}`;
    byKey.set(key, {
      key,
      at: st.updated_at!,
      lead: `${STEP_LABEL[name]}: ${
        name === "sign" ? SIGN_LOG_WORD[st.state] : st.state
      }`,
      detail: text || null,
      kind: "step",
    });
  }
  for (const a of s.alarms ?? []) {
    if (realTime(a.at) === null) continue;
    const key = `alarm|${a.code}|${a.at}`;
    byKey.set(key, {
      key,
      at: a.at,
      lead: "Alarm",
      detail: a.message,
      kind: "alarm",
    });
  }
  return [...byKey.values()]
    .sort((x, y) => realTime(y.at)! - realTime(x.at)!)
    .slice(0, 100);
}

/** "Key ceremony, Decrypt and Sign tally" for an alarm's `blocks`. */
export function blocksText(blocks: StepName[] | null): string {
  const names = (blocks ?? [])
    .filter((b) => b in STEP_LABEL)
    .map((b) => STEP_LABEL[b]);
  if (names.length === 0) return "Blocks no step.";
  if (names.length === 1) return `Blocks ${names[0]}.`;
  return `Blocks ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`;
}

/**
 * After publication: whether the console reports the result checked. The
 * console verifies by itself; the trustee process carries only its state, so
 * nothing is said beyond `verified` or not yet.
 */
export function checkedText(s: TrusteeStatus): string | null {
  if (!s.tally?.published) return null;
  return s.election?.state === "verified"
    ? "The console checked the published result on the chain: verified."
    : "The console has not reported the result as verified. This page does not see the console's check; the presenter's page shows it.";
}
