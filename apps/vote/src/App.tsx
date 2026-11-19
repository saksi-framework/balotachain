import { useCallback, useEffect, useRef, useState } from "react";
import { idToName } from "@balotachain/ui";
import {
  AboutContext,
  AutoAdvanceContext,
  PracticeContext,
  type Direction,
} from "./components/Layout";
import { useKeyboardOpen } from "./components/useKeyboardOpen";
import { checkPassed } from "./lib/benaloh";
import { CHECKIN_RESET } from "./lib/checkin";
import { usePollWhileVisible } from "./lib/usePoll";
import { selectClient } from "./lib/client";
import {
  isLiveError,
  LiveError,
  type ChallengeResult,
  type Checkin,
  type FoundVoter,
  type ListEntry,
  type ListSignature,
  type VoterDetails,
  type ElectionInfo,
  type EncryptedBallot,
  type LiveClient,
  type UnconfirmedPosition,
  STORAGE_READ_TITLE,
  type LiveErrorDetail,
  type SoftwareInfo,
  type SubmitReceipt,
} from "./lib/live";
import { Alarm } from "./screens/Alarm";
import { Ballot } from "./screens/Ballot";
import { Challenge } from "./screens/Challenge";
import { Encrypted } from "./screens/Encrypted";
import {
  CheckInForm,
  Found,
  NoVoterList,
  Refused,
  Waiting,
  type FormError,
} from "./screens/CheckIn";
import { Enrol, type EnrolProgress } from "./screens/Enrol";
import { Review } from "./screens/Review";
import { Sign } from "./screens/Sign";
import { Closed, ErrorScreen, Loading, NotOpen } from "./screens/Status";
import { boardHref, Submitted } from "./screens/Submitted";
import { Submitting } from "./screens/Submitting";
import { Verify } from "./screens/Verify";

type Route =
  | { name: "boot" }
  | { name: "loading"; label: string }
  /**
   * The precinct check-in (plan 2026-11-15, phone screens 1 to 5). Each
   * route names the election it is for, so a new election is a new form
   * with nothing typed in it.
   */
  | { name: "checkin"; electionId: string; notice: string | null }
  | { name: "found"; electionId: string; found: FoundVoter }
  | { name: "waiting"; entry?: ListEntry }
  | { name: "refused"; electionId: string }
  /** Named by election and entry: the screen keyed on both starts fresh. */
  | { name: "sign"; electionId: string; entry?: ListEntry }
  /** 409 `no-voter-list`: this election cannot check anyone in. */
  | { name: "no-list" }
  | { name: "error"; error: LiveError; retry: () => void; title?: string }
  | { name: "enrol" }
  | { name: "not-open"; credential: boolean }
  | { name: "closed" }
  | { name: "ballot"; index: number; editing: boolean }
  | { name: "review" }
  | { name: "encrypted"; afterChallenge: "passed" | "failed" | null }
  | {
      name: "challenge";
      results: ChallengeResult[];
      /** The ballot as shown before the challenge (its fingerprints). */
      shown: EncryptedBallot;
      /** A fresh ballot is already built. */
      fresh: boolean;
    }
  | { name: "submitting" }
  | { name: "submitted" }
  /** The console's answer to a ballot did not match what the phone showed. */
  | {
      name: "alarm";
      mismatch: Extract<LiveErrorDetail, { type: "record-mismatch" }>;
    }
  | { name: "verify"; back: Route };

/**
 * A quiet refresh leaves these alone: the same screen for the same
 * election. The found name counts as the check-in form (the console has no
 * check-in yet while the voter reads the declaration).
 */
function sameScreen(now: Route, next: Route): boolean {
  if (next.name === "checkin") {
    return (
      (now.name === "checkin" || now.name === "found") &&
      now.electionId === next.electionId
    );
  }
  if (next.name === "refused") {
    return now.name === "refused" && now.electionId === next.electionId;
  }
  if (next.name === "sign") {
    return (
      now.name === "sign" &&
      now.electionId === next.electionId &&
      now.entry?.seq === next.entry?.seq
    );
  }
  if (next.name === "not-open") {
    return now.name === "not-open" && now.credential === next.credential;
  }
  return now.name === next.name;
}

/** D12: an election with no positions. */
export const NO_POSITIONS = "This election has no positions to vote on";
const NO_POSITIONS_BODY = "Tell an election officer.";

const NO_ENROL: EnrolProgress = {
  steps: [],
  running: false,
  done: false,
  persistent: null,
  error: null,
  final: false,
};

function toLiveError(e: unknown): LiveError {
  if (isLiveError(e)) return e;
  return new LiveError("network", e instanceof Error ? e.message : String(e));
}

/** Timings the screens use; tests shorten them. */
export interface Timing {
  /** How often a waiting screen reads the console (D9). */
  pollMs?: number;
  /** How often the Electoral Board's waiting and signing screens read it. */
  checkinPollMs?: number;
  /** How long "Credential stored" shows before the ballot opens by itself. */
  enrolDoneMs?: number;
  /** When the loading screen offers Retry (D12). */
  loadingExitMs?: number;
  /** When a running write adds "Still recording. Keep this page open." */
  slowMs?: number;
}

/** After a stored credential, the ballot opens by itself after this long. */
export const ENROL_DONE_MS = 1200;

export default function App({
  client: given,
  mock: givenMock,
  timing = {},
}: {
  /** Injected in tests; otherwise chosen by `selectClient` (lib/client.ts). */
  client?: LiveClient;
  /** `"local"`: the real crypto over the local test election. */
  mock?: boolean | "local";
  timing?: Timing;
}) {
  const [{ client, mock }] = useState(() =>
    given
      ? { client: given, mock: givenMock ?? given.practice === true }
      : selectClient(),
  );

  const [route, setRoute] = useState<Route>({ name: "boot" });
  /** The route on screen now, for the quiet refreshes (no re-render). */
  const routeRef = useRef<Route>(route);
  routeRef.current = route;
  /**
   * Bumped by every route change. A quiet refresh that started before a
   * change (a tap that moved on, a declaration that went through) never
   * puts its older answer on screen.
   */
  const routeGen = useRef(0);
  /**
   * An issuance runs from this page. Every start (the automatic one and the
   * voter's tap) checks it first, so a refresh tick, a second effect run or a
   * double tap never starts a second one. Other tabs are kept out by the
   * transport's Web Lock (`withIssuanceLock`).
   */
  const issuing = useRef(false);
  /**
   * The automatic issuance failed in this page session: from then on only
   * the voter's tap starts one (D10). Cleared by a new election.
   */
  const autoFailed = useRef(false);
  /** The pending "open the ballot by itself" after a stored credential. */
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dir, setDir] = useState<Direction>("fwd");
  /** The screen on show came by itself, not from a tap (m7). */
  const [autoShown, setAutoShown] = useState(false);
  useKeyboardOpen();
  const [election, setElection] = useState<ElectionInfo | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [ballot, setBallot] = useState<EncryptedBallot | null>(null);
  const ballotNow = ballot;
  const [receipts, setReceipts] = useState<SubmitReceipt[]>([]);
  /** Positions sent without a known outcome (D11), kept by the client. */
  const [unconfirmed, setUnconfirmed] = useState<UnconfirmedPosition[]>([]);
  const [enrol, setEnrol] = useState<EnrolProgress>(NO_ENROL);
  /**
   * What the voter typed to find their name, in memory only, until the
   * declaration is sent (then dropped). Never stored, never logged.
   */
  const [details, setDetails] = useState<VoterDetails | null>(null);
  /**
   * Drop what was typed (the date of birth among it). Every place that ends
   * a check-in, or finds there is none to make, calls this.
   */
  const dropDetails = useCallback(() => setDetails(null), []);
  const [checkinError, setCheckinError] = useState<FormError | null>(null);
  /**
   * The election whose refusal at the desk the voter has seen and left with
   * "Check in again": the poll still answers `refused` for that phone until
   * it checks in again, and the form stays up meanwhile.
   */
  const refusalSeen = useRef<string | null>(null);
  /** A find, declare or sign call is out: a second press sends nothing. */
  const sendingCheckin = useRef(false);
  /** A ballot send (Submit or Send again) is out: a second tap sends nothing. */
  const sendingBallot = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set when a send was refused outright: retrying cannot help. */
  const [refused, setRefused] = useState(false);
  /** The chaincode's own gate and reason for the last refused send. */
  const [refusal, setRefusal] = useState<{
    gate: string;
    reason: string;
  } | null>(null);
  const [software, setSoftware] = useState<SoftwareInfo | null>(null);
  /**
   * Elections for which a check failed on this phone. Kept for the whole
   * page session and also stored by the client, so a reload reads it back.
   * Nothing here clears it.
   */
  const [failedHere, setFailedHere] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  /** How the most recent check in this page session ended. */
  const [lastCheck, setLastCheck] = useState<"passed" | "failed" | null>(null);
  const booted = useRef(false);

  const markFailed = useCallback((electionId: string) => {
    setFailedHere((prev) =>
      prev.has(electionId) ? prev : new Set(prev).add(electionId),
    );
  }, []);

  const go = useCallback((next: Route, d: Direction = "fwd", auto = false) => {
    routeGen.current++;
    setDir(d);
    setActionError(null);
    setAutoShown(auto);
    setRoute(next);
  }, []);

  /** The error screen, with Retry. */
  const showError = useCallback(
    (e: unknown, retry: () => void) => {
      const err = toLiveError(e);
      go({
        name: "error",
        error: err,
        retry,
        // N2: not the "can't reach" title of other network errors.
        title:
          err.detail?.type === "storage-read" ? STORAGE_READ_TITLE : undefined,
      });
    },
    [go],
  );

  /** The election on screen now, for the follow poll and new elections. */
  const electionRef = useRef<ElectionInfo | null>(null);

  /**
   * A new election on the console: nothing typed, declared, drawn or chosen
   * for the old one carries over. Records kept by the client are per
   * election already.
   */
  const forgetElection = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    autoFailed.current = false;
    refusalSeen.current = null;
    dropDetails();
    setCheckinError(null);
    setChoices({});
    setBallot(null);
    setReceipts([]);
    setUnconfirmed([]);
    setEnrol(NO_ENROL);
  }, [dropDetails]);

  /**
   * Work out where this phone is in the flow from what the console and the
   * client say: the check-in first (voter-list-api.md, "Where the phone goes
   * on load or reload"), then this phone's own records.
   *
   * `quiet`: a refresh over a screen that is already shown (the waiting
   * screen's poll, "Check now", the step after a stored credential). It shows
   * no loading screen, stays on the same screen when nothing changed, and
   * throws its failure to the caller instead of taking the error screen.
   */
  const resume = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}): Promise<void> => {
      const gen = routeGen.current;
      /** A quiet refresh overtaken by a route change: it shows nothing. */
      const stale = () => quiet && gen !== routeGen.current;
      /** Go there, unless a quiet refresh finds the same screen up. */
      const show = (next: Route) => {
        if (stale()) return;
        const now = routeRef.current;
        if (quiet && sameScreen(now, next)) return;
        // m7: a quiet refresh that moves on did so by itself.
        go(next, "fwd", quiet);
      };
      try {
        let checkin: Checkin | null;
        let e: ElectionInfo;
        try {
          // The check-in first: it needs no voting software, and says
          // whether there is an election and a list at all.
          checkin = await client.checkin();
          // The voting software (WebAssembly) loads once.
          if (!software) {
            if (!quiet && !stale()) {
              go({ name: "loading", label: "Loading the voting software…" });
            }
            const sw = await client.software();
            if (stale()) return;
            setSoftware(sw);
          }
          if (!quiet && !stale()) {
            go({ name: "loading", label: "Loading the election…" });
          }
          e = await client.election();
        } catch (err) {
          const le = toLiveError(err);
          // No election set up on the console yet (404): the phone waits,
          // as before voting opens (D10).
          if (le.kind === "not-open" && !le.detail) {
            if (stale()) return;
            setElection(null);
            dropDetails();
            show({ name: "not-open", credential: false });
            return;
          }
          if (le.detail?.type === "no-voter-list") {
            if (stale()) return;
            setElection(null);
            dropDetails();
            show({ name: "no-list" });
            return;
          }
          throw err;
        }
        if (stale()) return;
        if (electionRef.current && electionRef.current.id !== e.id) {
          forgetElection();
        }
        electionRef.current = e;
        setElection(e);
        try {
          if (await client.failedCheckRecorded(e.id)) markFailed(e.id);
        } catch {
          // Unreadable storage: the in-memory flag still covers this session.
        }
        // D11: a ballot sent in whole or in part, or sent without an
        // answer, lands on the receipt, which says per position where it
        // stands (see `standing` in Submitted.tsx).
        const stored = (await client.receipts()) ?? [];
        const pending = await client.unconfirmed();
        if (stale()) return;
        setReceipts(stored);
        setUnconfirmed(pending);
        if (stored.length > 0 || pending.length > 0) {
          show({ name: "submitted" });
          return;
        }
        if (e.status === "closed" || e.status === "tallied") {
          dropDetails();
          show({ name: "closed" });
          return;
        }
        if (!(await client.hasCredential())) {
          // D10: the console checks in and issues credentials only while
          // voting is open. Before that the phone waits.
          if (e.status !== "open") {
            dropDetails();
            show({ name: "not-open", credential: false });
            return;
          }
          const state = checkin?.state ?? "not_checked_in";
          switch (state) {
            case "not_checked_in":
              show({ name: "checkin", electionId: e.id, notice: null });
              return;
            case "reset":
              show({
                name: "checkin",
                electionId: e.id,
                notice: CHECKIN_RESET,
              });
              return;
            case "refused":
              // After "Check in again" the old cookie still answers
              // `refused`; the voter's new details stay until the new
              // declaration. Otherwise the refusal ends what was typed.
              if (refusalSeen.current === e.id) {
                show({ name: "checkin", electionId: e.id, notice: null });
              } else {
                if (!stale()) dropDetails();
                show({ name: "refused", electionId: e.id });
              }
              return;
            case "at_desk":
              show({ name: "waiting", entry: checkin?.entry });
              return;
            case "approved":
              show({ name: "sign", electionId: e.id, entry: checkin?.entry });
              return;
          }
          // Signed (or issued, to a phone that lost it): issuance starts by
          // itself, once. After a failed automatic start only the voter's
          // tap tries again.
          if (stale()) return;
          if (!issuing.current) {
            setEnrol(NO_ENROL);
            go({ name: "enrol" }, "fwd", quiet);
            if (!autoFailed.current) void startEnrol(true);
          } else {
            show({ name: "enrol" });
          }
          return;
        }
        if (e.status === "setup") {
          show({ name: "not-open", credential: true });
          return;
        }
        if (e.positions.length === 0) {
          if (stale()) return;
          // D12: nothing to put on a ballot; say so instead of crashing.
          go(
            {
              name: "error",
              error: new LiveError("refused", NO_POSITIONS_BODY),
              title: NO_POSITIONS,
              retry: () => void resume(),
            },
            "fwd",
            quiet,
          );
          return;
        }
        show({ name: "ballot", index: 0, editing: false });
      } catch (err) {
        if (quiet) throw err;
        showError(err, () => void resume());
      }
    },
    // `startEnrol` is a plain function over refs and stable setters.
    [client, dropDetails, forgetElection, go, markFailed, showError, software],
  );

  /**
   * Any failure outside a screen's own inline error. A check-in that ended
   * or is missing (`auth`) is read again: the console's answer decides the
   * screen (the check-in form, the Board's refusal, the ballot).
   */
  const fail = useCallback(
    (e: unknown, retry: () => void) => {
      if (toLiveError(e).kind === "auth") {
        void resume();
        return;
      }
      showError(e, retry);
    },
    [resume, showError],
  );

  /**
   * m1 (rehearsal 2): the closed screen and the receipt are the ends of one
   * election, and nothing on them read the console again, so a phone left
   * on them never saw the next election. While either is up, read the
   * console's election; when it names another election than the one on
   * screen, work out the screen again (`resume`), which shows the new
   * election's waiting screen, credential or ballot. Receipts and
   * credentials are kept per election by the client; the choices and the
   * ballot on this page are cleared here, so the new ballot opens with
   * nothing selected even when it reuses the old ids.
   */
  const followConsole = useCallback(async () => {
    const e = await client.election();
    const same = e.id === electionRef.current?.id;
    // M2: the same election in another status (voting closed) is worked out
    // again too, so the receipt offers only what the console's status
    // allows, and the closed screen never outlives the console's "closed".
    if (same && e.status === electionRef.current?.status) return;
    if (!same) forgetElection();
    // A failure after the new election was taken in (a storage read that
    // throws) must not leave the old receipt under the new election, which
    // the next poll would no longer see as a change: it takes the same error
    // screen as a non-quiet `resume`.
    try {
      await resume({ quiet: true });
    } catch (err) {
      fail(err, () => void resume());
    }
  }, [client, fail, forgetElection, resume]);
  usePollWhileVisible(followConsole, {
    intervalMs: timing.pollMs,
    enabled: route.name === "closed" || route.name === "submitted",
  });

  /**
   * m2 (rehearsal 4): the Verify screen is an end of one election too. A
   * phone left on it follows a new election as the receipt does. The same
   * election in another status leaves it alone: the voter is checking a
   * code, and Back takes the receipt's own poll up again.
   */
  const followFromVerify = useCallback(async () => {
    const e = await client.election();
    if (e.id === electionRef.current?.id) return;
    forgetElection();
    try {
      await resume({ quiet: true });
    } catch (err) {
      fail(err, () => void resume());
    }
  }, [client, fail, forgetElection, resume]);
  usePollWhileVisible(followFromVerify, {
    intervalMs: timing.pollMs,
    enabled: route.name === "verify",
  });

  /**
   * Back from Verify reads the console first, so it never puts the old
   * election's receipt up once a new election exists. Unreachable: back to
   * where the voter was, whose own poll follows the console from there.
   */
  const leavingVerify = useRef(false);
  const backFromVerify = useCallback(
    async (back: Route) => {
      if (leavingVerify.current) return;
      leavingVerify.current = true;
      try {
        let e: ElectionInfo | null = null;
        try {
          e = await client.election();
        } catch {
          e = null;
        }
        if (routeRef.current.name !== "verify") return;
        if (e && e.id !== electionRef.current?.id) {
          forgetElection();
          try {
            await resume({ quiet: true });
          } catch (err) {
            fail(err, () => void resume());
          }
          return;
        }
        go(back, "back");
      } finally {
        leavingVerify.current = false;
      }
    },
    [client, fail, forgetElection, go, resume],
  );

  /**
   * The check-in screens that do not read the console themselves (the
   * form, the found name, the refusal, an election with no list) follow it
   * too: a new election, voting closing, the Board's answer. A failed read
   * leaves the screen as it is.
   */
  const followCheckin = useCallback(() => resume({ quiet: true }), [resume]);
  usePollWhileVisible(followCheckin, {
    intervalMs: timing.pollMs,
    enabled:
      route.name === "checkin" ||
      route.name === "found" ||
      route.name === "refused" ||
      route.name === "no-list",
  });

  /** A quiet `resume` whose failure takes the error screen. */
  const advance = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    resume({ quiet: true }).catch((err) => fail(err, () => void resume()));
  }, [fail, resume]);

  const boot = useCallback(async (): Promise<void> => {
    await resume();
  }, [resume]);

  useEffect(() => {
    // Boot once per mount, even under StrictMode's double effect in dev, so
    // the real client does not ask the console twice.
    if (booted.current) return;
    booted.current = true;
    void boot();
  }, [boot]);

  /** True when a check-in call's failure is for another screen to say. */
  function elsewhere(e: LiveError): boolean {
    return (
      e.kind === "auth" ||
      e.kind === "not-open" ||
      e.kind === "closed" ||
      e.detail?.type === "no-voter-list" ||
      (e.detail?.type === "checkin" && e.detail.code === "checkin-in-progress")
    );
  }

  /** Screen 1: look for the name. Nothing is kept but what was typed. */
  async function findName(d: VoterDetails) {
    // One check-in call at a time: a second press before the first answer
    // (before `busy` reaches the screen) sends nothing.
    if (sendingCheckin.current) return;
    sendingCheckin.current = true;
    const electionId = election?.id ?? "";
    const gen = routeGen.current;
    setBusy(true);
    setCheckinError(null);
    try {
      const found = await client.findVoter(d);
      // A poll moved the page meanwhile (closed, a new election): its
      // screen stands; the answer is for a form no longer shown.
      if (gen !== routeGen.current) return;
      setDetails(d);
      go({ name: "found", electionId, found });
    } catch (err) {
      const e = toLiveError(err);
      if (elsewhere(e)) return void resume();
      setCheckinError({
        message: e.message,
        field:
          e.detail?.type === "checkin" && e.detail.code === "bad-date"
            ? "date"
            : null,
      });
    } finally {
      sendingCheckin.current = false;
      setBusy(false);
    }
  }

  /** Screen 3: the declaration goes to the Electoral Board's desk. */
  async function sendDeclaration() {
    if (!details || sendingCheckin.current) return;
    sendingCheckin.current = true;
    const gen = routeGen.current;
    setBusy(true);
    setActionError(null);
    try {
      const c = await client.declare(details);
      // The date of birth is not needed any more: drop it now.
      dropDetails();
      refusalSeen.current = null;
      // As in `findName`: a poll's newer screen stands.
      if (gen !== routeGen.current) return;
      go({ name: "waiting", entry: c.entry });
    } catch (err) {
      const e = toLiveError(err);
      if (elsewhere(e)) return void resume();
      setActionError(e.message);
    } finally {
      sendingCheckin.current = false;
      setBusy(false);
    }
  }

  /**
   * Screen 5: sign the list; the credential step follows by itself. The
   * screen stays busy until the next screen is worked out, so the signature
   * cannot be sent twice.
   */
  async function signList(signature: ListSignature) {
    if (sendingCheckin.current) return;
    sendingCheckin.current = true;
    setBusy(true);
    setActionError(null);
    try {
      try {
        await client.signList(signature);
      } catch (err) {
        const e = toLiveError(err);
        if (elsewhere(e)) return void (await resume());
        setActionError(e.message);
        return;
      }
      await resume({ quiet: true }).catch((err) =>
        fail(err, () => void resume()),
      );
    } finally {
      sendingCheckin.current = false;
      setBusy(false);
    }
  }

  /** After a refusal at the desk: the form, empty. */
  function checkInAgain() {
    const electionId = election?.id ?? "";
    refusalSeen.current = electionId;
    dropDetails();
    setCheckinError(null);
    go({ name: "checkin", electionId, notice: null });
  }

  /**
   * One issuance (presign, then sign once, as `RealLiveClient.enrol` does).
   * `auto`: started by the app when voting is seen open (D10), not by a tap.
   */
  async function startEnrol(auto = false) {
    if (issuing.current) return;
    issuing.current = true;
    setEnrol({ ...NO_ENROL, running: true });
    try {
      const { persistent } = await client.enrol((step) =>
        setEnrol((prev) => {
          const steps = prev.steps.filter((s) => s.index !== step.index);
          steps.push(step);
          steps.sort((a, b) => a.index - b.index);
          return { ...prev, steps };
        }),
      );
      setEnrol((prev) => ({ ...prev, running: false, done: true, persistent }));
      // D10: the ballot opens by itself. A credential kept only in memory
      // waits for "Continue", so its warning is read first.
      if (persistent) {
        advanceTimer.current = setTimeout(
          advance,
          timing.enrolDoneMs ?? ENROL_DONE_MS,
        );
      }
    } catch (err) {
      const e = toLiveError(err);
      if (e.kind === "auth") {
        // M3: the check-in read again may say "signed" once more; only the
        // voter's tap starts the next issuance, never a loop.
        if (auto) autoFailed.current = true;
        return fail(e, () => {});
      }
      // The console issues credentials only while voting is open.
      if (e.kind === "not-open") {
        setEnrol(NO_ENROL);
        return go({ name: "not-open", credential: false });
      }
      if (e.kind === "closed") return void resume();
      // m3: "already issued" while this phone holds a usable credential
      // (another tab of this phone got it): move on to the ballot.
      if (e.detail?.type === "already-issued") {
        let held = false;
        try {
          held = await client.hasCredential();
        } catch {
          // Unknown: show the console's answer below.
        }
        if (held) {
          setEnrol(NO_ENROL);
          return advance();
        }
      }
      if (auto) autoFailed.current = true;
      setEnrol((prev) => ({
        ...prev,
        running: false,
        error: e.message,
        // Already issued to this voter: trying again cannot help.
        final: e.detail?.type === "already-issued",
      }));
    } finally {
      issuing.current = false;
    }
  }

  function choiceList() {
    return votePositions.map((p) => ({
      positionId: p.id,
      candidateId: choices[p.id]!,
    }));
  }

  async function encrypt(afterChallenge: "passed" | "failed" | null = null) {
    if (!election) return;
    setBusy(true);
    setActionError(null);
    try {
      const b = await client.encrypt(choiceList());
      setBallot(b);
      go({ name: "encrypted", afterChallenge });
    } catch (err) {
      const e = toLiveError(err);
      if (
        e.kind === "closed" ||
        e.kind === "not-open" ||
        e.kind === "auth" ||
        e.kind === "already-voted" ||
        // M4: the credential is for an election the console no longer runs.
        e.detail?.type === "stale-credential"
      ) {
        await resume();
      } else {
        setActionError(e.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function challenge() {
    if (!ballot) return;
    const shown = ballot;
    setBusy(true);
    setActionError(null);
    let results: ChallengeResult[];
    try {
      results = await client.challenge(shown);
    } catch (err) {
      setActionError(toLiveError(err).message);
      setBusy(false);
      return;
    }
    const passed = checkPassed(results, shown, choices);
    setLastCheck(passed ? "passed" : "failed");
    if (!passed && election) {
      // A fact about this phone for this election, not about this screen.
      markFailed(election.id);
      try {
        await client.recordFailedCheck(election.id);
      } catch {
        // Kept in memory for this session (`failedHere`).
      }
    }
    // The opened ballot is spent; only a fresh one can be sent.
    setBallot(null);
    // After a passed check, build the fresh ballot straight away: new
    // fingerprints, same tracking codes. After a failed one, the voter must
    // choose to go on ("Encrypt again anyway").
    let fresh = false;
    let freshError: string | null = null;
    if (passed) {
      try {
        setBallot(await client.encrypt(choiceList()));
        fresh = true;
      } catch (err) {
        freshError = toLiveError(err).message;
      }
    }
    setBusy(false);
    go({ name: "challenge", results, shown, fresh });
    if (freshError) setActionError(freshError);
  }

  /** D11: open the ballot for the positions not sent yet. */
  function finish() {
    setChoices({});
    setBallot(null);
    go({ name: "ballot", index: 0, editing: false });
  }

  /** D11: send the unconfirmed positions again, the same bytes. */
  async function sendAgain() {
    // M1: a double tap before the route changes sends once.
    if (sendingBallot.current) return;
    sendingBallot.current = true;
    try {
      let b: EncryptedBallot | null;
      try {
        b = await client.resendUnconfirmed();
      } catch (err) {
        return fail(err, () => void resume());
      }
      if (!b) return void resume();
      setBallot(b);
      await send(b);
    } finally {
      sendingBallot.current = false;
    }
  }

  /** Submit, once at a time (M1). */
  async function submit(given?: EncryptedBallot) {
    if (sendingBallot.current) return;
    sendingBallot.current = true;
    try {
      await send(given);
    } finally {
      sendingBallot.current = false;
    }
  }

  /**
   * Send `given`, or the ballot on screen. A retry sends the same ballot;
   * the client skips what is already recorded. Receipts already on screen
   * stay: the client's `onPosition` calls and its final list reconcile.
   */
  async function send(given?: EncryptedBallot) {
    const ballot = given ?? ballotNow;
    if (!ballot) return;
    go({ name: "submitting" });
    setRefused(false);
    setRefusal(null);
    try {
      const out = await client.submit(ballot, (r) =>
        setReceipts((prev) => [
          ...prev.filter((x) => x.positionId !== r.positionId),
          r,
        ]),
      );
      setReceipts(out);
      setBallot(null);
      try {
        setUnconfirmed(await client.unconfirmed());
      } catch {
        setUnconfirmed([]);
      }
      go({ name: "submitted" });
    } catch (err) {
      const e = toLiveError(err);
      if (e.detail?.type === "record-mismatch") {
        // Never a silent retry: the alarm stays on screen and on the receipt.
        setBallot(null);
        try {
          setReceipts((await client.receipts()) ?? []);
        } catch {
          // The alarm screen still shows what the console answered.
        }
        go({ name: "alarm", mismatch: e.detail });
      } else if (e.detail?.type === "stale-election") {
        // Built for an election the console no longer runs: load the
        // current one; the old choices mean nothing there.
        setBallot(null);
        setChoices({});
        await resume();
      } else if (e.kind === "already-voted") {
        setBallot(null);
        await resume();
      } else if (
        e.kind === "closed" ||
        e.kind === "not-open" ||
        e.kind === "auth"
      ) {
        await resume();
      } else {
        setRefused(e.kind === "refused");
        if (e.detail?.type === "chain-refusal") {
          setRefusal({ gate: e.detail.gate, reason: e.detail.reason });
        }
        setActionError(e.message);
      }
    }
  }

  const positions = election?.positions ?? [];
  /**
   * The positions this ballot is for: every position, less those recorded
   * or sent without an answer (D11). The whole election on a first ballot.
   */
  const settled = new Set(
    [...receipts, ...unconfirmed].map((r) => r.positionId),
  );
  const votePositions = positions.filter((p) => !settled.has(p.id));
  const recordedHere = receipts.filter((r) =>
    positions.some((p) => p.id === r.positionId),
  );
  const checkFailedHere = election ? failedHere.has(election.id) : false;
  const title = election?.title ?? "BalotaChain";
  const board = boardHref(election?.runId);

  return (
    <AboutContext.Provider
      value={{
        software: software?.label ?? null,
        keyFingerprint: election?.keyFingerprint ?? null,
      }}
    >
      <PracticeContext.Provider value={mock}>
        <AutoAdvanceContext.Provider value={autoShown}>
          {screen()}
        </AutoAdvanceContext.Provider>
      </PracticeContext.Provider>
    </AboutContext.Provider>
  );

  function screen() {
    switch (route.name) {
      case "boot":
        return (
          <Loading
            label="Starting…"
            exitAfterMs={timing.loadingExitMs}
            onRetry={() => void boot()}
          />
        );
      case "loading":
        return (
          <Loading
            label={route.label}
            exitAfterMs={timing.loadingExitMs}
            onRetry={() => void resume()}
          />
        );
      case "checkin":
        return (
          <CheckInForm
            key={route.electionId}
            title={title}
            precinctLabel={election?.precinctLabel}
            initial={details}
            notice={route.notice}
            error={checkinError}
            busy={busy}
            practiceNote={client.practiceNote}
            onFind={(d) => void findName(d)}
          />
        );
      case "found":
        return (
          <Found
            title={title}
            entry={route.found.entry}
            busy={busy}
            error={actionError}
            onBack={() =>
              go(
                { name: "checkin", electionId: route.electionId, notice: null },
                "back",
              )
            }
            onSend={() => void sendDeclaration()}
          />
        );
      case "waiting":
        return (
          <Waiting
            title={title}
            entry={route.entry}
            pollMs={timing.checkinPollMs}
            onCheck={() => resume({ quiet: true })}
          />
        );
      case "refused":
        return <Refused title={title} onAgain={checkInAgain} />;
      case "sign":
        return (
          <Sign
            // A new election or another entry is a new signature step: an
            // open "I cannot sign" question and a drawing never carry over.
            key={`${route.electionId}:${route.entry?.seq ?? ""}`}
            title={title}
            entry={route.entry}
            busy={busy}
            error={actionError}
            pollMs={timing.checkinPollMs}
            onSign={(sig) => void signList(sig)}
            onCheck={() => resume({ quiet: true })}
          />
        );
      case "no-list":
        return <NoVoterList title={title} onRetry={() => void resume()} />;
      case "error":
        return (
          <ErrorScreen
            title={route.title}
            kind={route.error.kind}
            message={route.error.message}
            onRetry={route.retry}
          />
        );
      case "enrol":
        return (
          <Enrol
            progress={enrol}
            slowMs={timing.slowMs}
            onStart={() => void startEnrol()}
            onContinue={advance}
          />
        );
      case "not-open":
        return (
          <NotOpen
            title={title}
            credential={route.credential}
            pollMs={timing.pollMs}
            onCheck={() => resume({ quiet: true })}
          />
        );
      case "closed":
        return (
          <Closed
            title={title}
            boardHref={board}
            onVerify={() => go({ name: "verify", back: route })}
          />
        );
      case "ballot": {
        const { index, editing } = route;
        // Nothing left to vote on here (a forced or stale route): the
        // receipt says where each position stands.
        if (!votePositions[index]) {
          return (
            <Loading
              label="Loading the election…"
              onRetry={() => void resume()}
            />
          );
        }
        const last = index === votePositions.length - 1;
        return (
          <Ballot
            positions={votePositions}
            index={index}
            selected={choices[votePositions[index]!.id]}
            editing={editing}
            direction={dir}
            onPick={(id) =>
              setChoices((c) => ({ ...c, [votePositions[index]!.id]: id }))
            }
            onBack={
              index > 0
                ? () =>
                    go({ name: "ballot", index: index - 1, editing }, "back")
                : undefined
            }
            onNext={() =>
              editing || last
                ? go({ name: "review" })
                : go({ name: "ballot", index: index + 1, editing: false })
            }
          />
        );
      }
      case "review":
        return (
          <Review
            positions={votePositions}
            positionTitle={(id) =>
              positions.find((p) => p.id === id)?.title ?? idToName(id)
            }
            recorded={recordedHere}
            choices={choices}
            busy={busy}
            error={actionError}
            direction={dir}
            onEdit={(i) =>
              go({ name: "ballot", index: i, editing: true }, "back")
            }
            onBack={() =>
              go(
                {
                  name: "ballot",
                  index: votePositions.length - 1,
                  editing: false,
                },
                "back",
              )
            }
            onEncrypt={() => void encrypt()}
          />
        );
      case "encrypted":
        return ballot ? (
          <Encrypted
            positions={positions}
            ballot={ballot}
            challenging={busy}
            error={actionError}
            direction={dir}
            afterChallenge={route.afterChallenge}
            checkFailedHere={checkFailedHere}
            lastCheckFailed={lastCheck === "failed"}
            onSubmit={() => void submit()}
            onChallenge={() => void challenge()}
            onBack={() => {
              setBallot(null);
              go({ name: "review" }, "back");
            }}
          />
        ) : (
          <Loading label="Encrypting…" onRetry={() => void resume()} />
        );
      case "challenge":
        return (
          <Challenge
            positions={positions}
            results={route.results}
            shown={route.shown}
            choices={choices}
            fresh={route.fresh && ballot !== null}
            checkFailedHere={checkFailedHere}
            busy={busy}
            error={actionError}
            onContinue={() =>
              route.fresh && ballot
                ? go({ name: "encrypted", afterChallenge: "passed" })
                : void encrypt(
                    checkPassed(route.results, route.shown, choices)
                      ? "passed"
                      : "failed",
                  )
            }
          />
        );
      case "submitting":
        return ballot ? (
          <Submitting
            positions={positions}
            ballot={ballot}
            receipts={receipts}
            error={actionError}
            refusal={refusal}
            slowMs={timing.slowMs}
            onRetry={() => void submit()}
            onBack={
              refused
                ? () => {
                    setBallot(null);
                    go({ name: "review" }, "back");
                  }
                : undefined
            }
          />
        ) : (
          <Loading label="Sending…" onRetry={() => void resume()} />
        );
      case "submitted":
        return (
          <Submitted
            positions={positions}
            receipts={receipts}
            unconfirmed={unconfirmed}
            status={election?.status ?? null}
            onFinish={finish}
            onSendAgain={() => void sendAgain()}
            direction={dir}
            boardHref={board}
            onVerify={() => go({ name: "verify", back: route })}
          />
        );
      case "alarm":
        return (
          <Alarm
            positions={positions}
            mismatch={route.mismatch}
            onReceipt={() => go({ name: "submitted" })}
          />
        );
      case "verify":
        return (
          <Verify
            ownCodes={receipts.map((r) => r.trackingCode)}
            ownReceipts={receipts}
            boardHref={board}
            lookup={(code) => client.lookup(code)}
            onBack={() => void backFromVerify(route.back)}
          />
        );
    }
  }
}
