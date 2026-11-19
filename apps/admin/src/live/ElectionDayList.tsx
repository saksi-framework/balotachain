/**
 * The election-day list (voter-list-api.md, `GET /api/live/voter-list`): the
 * Electoral Board's desk on top, then every entry with its status and
 * signature. Every status, count and sentence here is read from the
 * console's answers; a press changes nothing on the page until the console
 * has answered it. A signature is drawn by this page from its numbers; no
 * markup from a phone is ever inserted.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  tokens,
  Card,
  Chip,
  PrimaryButton,
  SecondaryButton,
  Skeleton,
  TextButton,
  pollSignal,
} from "@balotachain/ui";
import { LiveError, deskWrite, readVoterList, type DeskAction } from "./api";
import {
  arrivedAtDesk,
  entryName,
  leftDesk,
  mayReset,
  signaturePolylines,
  statusChip,
  statusWord,
  SIGNATURE_H,
  SIGNATURE_W,
} from "./voterList";
import { Fingerprint } from "./VoterListStep";
import type { ListEntry, Signature, VoterListView } from "./types";
import {
  body,
  ErrorBox,
  h2,
  InlineConfirm,
  InlineNotice,
  muted,
  secondarySmall,
  small,
} from "./parts";

/** The election states in which the panel is shown: from `open` on. */
export const DESK_STATES = new Set(["open", "closed", "tallied", "verified"]);

/** The contract asks for a poll every 1 to 2 seconds while the panel is open. */
export const DESK_POLL_MS = 1500;

/** How many "left the desk" notes stay on screen, newest first. */
const KEEP_NOTES = 3;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** The console's words without a closing full stop, to end a sentence of ours. */
const words = (e: unknown) => message(e).replace(/[.\s]+$/, "");

/**
 * What this page says after the console accepted a press: the action taken,
 * in the past tense, never the entry's status (the list below has that).
 */
const TAKEN: Record<DeskAction, (name: string) => string> = {
  approve: (name) => `Approved ${name}.`,
  refuse: (name) => `Refused ${name}.`,
  reset: (name) => `The check-in of ${name} was reset.`,
};

/**
 * A desk-action notice. `seq` is the entry it is about and `status` the
 * status it stands with: the one the console's answer gave, or, when the
 * answer gave none, the one the next poll shows (null until then). The
 * notice goes as soon as a poll shows that entry in any other status.
 */
type Outcome = {
  text: string;
  failed: boolean;
  seq: number;
  status: string | null;
};

/**
 * The polite announcement and what it stands on: entries announced as at
 * the desk, and entries announced with a status. It is emptied as soon as
 * one of them is no longer so.
 */
type Announcement = {
  text: string;
  n: number;
  atDesk: number[];
  withStatus: { seq: number; status: string }[];
};

/** m5: how long a desk press's own notice stays up. */
export const OUTCOME_MS = 20_000;

const DONE: Record<DeskAction, string> = {
  approve: "approved",
  refuse: "refused",
  reset: "reset",
};
const BUSY: Record<DeskAction, string> = {
  approve: "Approving…",
  refuse: "Refusing…",
  reset: "Resetting…",
};

/**
 * Refuse: the secondary look (outline, neutral border), at Approve's height
 * so the two read as a pair and neither is a small target.
 */
const refuseStyle = {
  ...secondarySmall,
  minHeight: tokens.minButtonHeight,
  fontSize: tokens.font.button,
} as const;

/** The desk's name: readable from the back of the room (display size, 28px, the top of the scale). */
const deskName = {
  fontSize: tokens.font.h1,
  fontWeight: 700,
  lineHeight: 1.25,
  letterSpacing: "-0.01em",
  margin: 0,
  overflowWrap: "anywhere",
} as const;

const h4 = { ...body, fontWeight: 600 } as const;

function SignatureCell({ sig, name }: { sig?: Signature; name: string }) {
  if (!sig) return null;
  if (sig.cannot_sign === true)
    // m2: one line, the note's size, centred in the drawing's box.
    return (
      <p style={{ ...small, margin: 0, width: "100%", textAlign: "center" }}>
        Cannot sign (recorded)
      </p>
    );
  const lines = signaturePolylines(sig);
  if (!lines || lines.length === 0)
    return <p style={small}>The console sent no drawing for this signature.</p>;
  return (
    <svg
      viewBox={`0 0 ${SIGNATURE_W} ${SIGNATURE_H}`}
      role="img"
      aria-label={`Signature of ${name}`}
      className="lp-signature"
    >
      {lines.map((points, i) => (
        <polyline
          key={i}
          points={points}
          fill="none"
          stroke={tokens.color.text1}
          // m3: about 2.5 px on screen whatever the box's scale.
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export function ElectionDayList({
  onAuthFail,
  onCounts,
}: {
  onAuthFail: (e: unknown) => void;
  /** The list's counts from each answer; null when there are none. */
  onCounts?: (counts: NonNullable<VoterListView["counts"]> | null) => void;
}) {
  const [data, setData] = useState<VoterListView | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  /** The election has no list (409 `no-voter-list`): nothing here can work. */
  const [noList, setNoList] = useState(false);
  /** Entries that left the desk between two polls, newest first. */
  const [leftNotes, setLeftNotes] = useState<string[]>([]);
  /** What the console answered to this page's last press. */
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [acting, setActing] = useState<{
    seq: number;
    action: DeskAction;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState<number | null>(null);
  /**
   * The polite announcement. `n` changes with every one, so the same words
   * (the same voter at the desk again) replace the node and are heard again.
   */
  const [announcement, setAnnouncement] = useState<Announcement>({
    text: "",
    n: 0,
    atDesk: [],
    withStatus: [],
  });
  const silence = useCallback(
    () =>
      setAnnouncement((a) =>
        a.text ? { text: "", n: a.n + 1, atDesk: [], withStatus: [] } : a,
      ),
    [],
  );

  const latest = useRef<VoterListView | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const writing = useRef(false);
  /** Bumped at each press: a poll sent before it must not undo its answer. */
  const epoch = useRef(0);
  /** Entries whose leaving the desk this page already explained. */
  const explained = useRef(new Set<number>());

  const take = useCallback(
    (next: VoterListView) => {
      const prev = latest.current;
      latest.current = next;
      setData(next);
      // A reset confirm closes when its entry can no longer be reset.
      setConfirmReset((seq) => {
        if (seq === null) return null;
        const e = (next.entries ?? []).find((x) => x.seq === seq);
        return e && mayReset(e.status) ? seq : null;
      });
      onCounts?.(next.counts ?? null);
      const desk = next.desk ?? [];
      const atDeskNow = new Set(desk.map((e) => e.seq));
      const statusNow = (seq: number) =>
        (next.entries ?? []).find((e) => e.seq === seq)?.status ?? "";
      // Voting ended: nothing said about the desk during it still holds.
      const leftOpen =
        prev?.election_state === "open" && next.election_state !== "open";
      setOutcome((o) => {
        if (!o) return o;
        if (leftOpen) return null;
        const now = statusNow(o.seq);
        if (o.status === null) return { ...o, status: now };
        return now === o.status ? o : null;
      });
      if (leftOpen) setLeftNotes((old) => (old.length ? [] : old));
      let announced = false;
      if (prev && !leftOpen) {
        const before = (prev.desk ?? []).map((e) => e.seq).join(",");
        const unchanged = before === desk.map((e) => e.seq).join(",");
        const left = leftDesk(prev.desk ?? [], next).filter(
          (e) => !explained.current.has(e.seq),
        );
        const arrived = arrivedAtDesk(prev.desk ?? [], next);
        const notes = left.map(
          (e) =>
            `${entryName(e)} (No. ${e.seq}) is no longer at the desk. ${
              e.status
                ? `The console now lists: ${statusWord(e.status)}.`
                : "The console's list no longer holds this entry."
            }`,
        );
        if (notes.length > 0)
          setLeftNotes((old) =>
            [...[...notes].reverse(), ...old].slice(0, KEEP_NOTES),
          );
        // A note goes once a later poll shows the desk as it was.
        else if (unchanged) setLeftNotes((old) => (old.length ? [] : old));
        const words = [
          ...arrived.map((e) => `At the desk: ${entryName(e)}, No. ${e.seq}.`),
          ...notes,
        ];
        if (words.length > 0) {
          announced = true;
          setAnnouncement((a) => ({
            text: words.join(" "),
            n: a.n + 1,
            atDesk: arrived.map((e) => e.seq),
            withStatus: left.map((e) => ({ seq: e.seq, status: e.status })),
          }));
        }
      }
      if (!announced)
        setAnnouncement((a) => {
          if (!a.text) return a;
          const holds =
            !leftOpen &&
            a.atDesk.every((seq) => atDeskNow.has(seq)) &&
            a.withStatus.every((x) => statusNow(x.seq) === x.status);
          return holds
            ? a
            : { text: "", n: a.n + 1, atDesk: [], withStatus: [] };
        });
      // Forget an explained entry once it has left the desk.
      for (const seq of [...explained.current])
        if (!atDeskNow.has(seq)) explained.current.delete(seq);
    },
    [onCounts],
  );

  // m5: a notice of a desk press that went through leaves after a while,
  // so a refusal is not still on the projector when the next voter comes.
  useEffect(() => {
    if (!outcome || outcome.failed) return;
    const t = window.setTimeout(
      () => setOutcome((o) => (o === outcome ? null : o)),
      OUTCOME_MS,
    );
    return () => window.clearTimeout(t);
  }, [outcome]);

  // The counts leave with the panel.
  useEffect(() => () => onCounts?.(null), [onCounts]);

  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    if (writing.current) return Promise.resolve();
    const sentAt = epoch.current;
    const p = (async () => {
      // A hung read is given up after POLL_TIMEOUT_MS, shown as a failed
      // poll, and the next tick asks again.
      const limit = pollSignal();
      try {
        const next = await readVoterList(limit.signal);
        // An answer to a poll sent before a press is dropped whole.
        if (sentAt !== epoch.current) return;
        take(next);
        setPollError(null);
      } catch (e) {
        if (e instanceof LiveError && e.code === "no-voter-list") {
          setNoList(true);
          onCounts?.(null);
          return;
        }
        if (e instanceof LiveError && (e.status === 401 || e.status === 403))
          onAuthFail(e);
        setPollError(words(e));
      } finally {
        limit.done();
      }
    })();
    inFlight.current = p;
    void p.finally(() => {
      if (inFlight.current === p) inFlight.current = null;
    });
    return p;
  }, [take, onAuthFail, onCounts]);

  // Poll while visible; stop when hidden or when the election has no list.
  useEffect(() => {
    if (noList) return;
    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      if (document.visibilityState === "hidden") return;
      timer = window.setInterval(() => void refresh(), DESK_POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else {
        void refresh();
        start();
      }
    };
    if (document.visibilityState !== "hidden") void refresh();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [noList, refresh]);

  async function press(action: DeskAction, seen: ListEntry) {
    if (writing.current) return;
    // The notes and the announcement about earlier moves go with the next press.
    setLeftNotes([]);
    silence();
    const name = entryName(seen);
    // A press on what the latest answer no longer shows is not sent.
    const now = latest.current;
    const current = (now?.entries ?? []).find((e) => e.seq === seen.seq);
    const stillThere =
      action === "reset"
        ? !!current && mayReset(current.status)
        : (now?.desk ?? []).some((e) => e.seq === seen.seq);
    if (!stillThere) {
      setOutcome({
        failed: true,
        seq: seen.seq,
        status: current ? current.status : "",
        text: `Nothing was sent: ${name} is no longer ${
          action === "reset" ? "in a state that can be reset" : "at the desk"
        }. The console now lists: ${current ? statusWord(current.status) : "no such entry"}.`,
      });
      setConfirmReset(null);
      return;
    }
    writing.current = true;
    epoch.current += 1;
    setActing({ seq: seen.seq, action });
    setOutcome(null);
    try {
      const answer = await deskWrite(action, seen.seq);
      explained.current.add(seen.seq);
      const ended =
        action !== "approve" && answer.status === "not_checked_in"
          ? " The phone's check-in has ended; the voter can check in again."
          : "";
      setOutcome({
        failed: false,
        seq: answer.seq,
        status: answer.status,
        text: `${TAKEN[action](entryName(answer))}${ended}`,
      });
      setConfirmReset(null);
    } catch (e) {
      if (e instanceof LiveError && (e.status === 401 || e.status === 403))
        onAuthFail(e);
      if (e instanceof LiveError) {
        explained.current.add(seen.seq);
        setOutcome({
          failed: true,
          seq: seen.seq,
          status: null,
          text: `${name} was not ${DONE[action]}. The console answered: ${words(e)}. The list below shows the console's current status.`,
        });
      } else {
        setOutcome({
          failed: true,
          seq: seen.seq,
          status: null,
          text: `The console did not answer, so it is not known whether ${name} was ${DONE[action]}: ${words(e)}. The list below shows the console's next answer.`,
        });
      }
    } finally {
      epoch.current += 1;
      writing.current = false;
    }
    // Wait out a poll sent before the press, then read the new state.
    if (inFlight.current) await inFlight.current;
    await refresh();
    setActing(null);
  }

  const busy = acting !== null;
  const buttonLabel = (action: DeskAction, seq: number, label: string) =>
    acting?.seq === seq && acting.action === action ? BUSY[action] : label;

  let content;
  if (noList) {
    content = (
      <p style={body}>
        This election was set up without a voter list, so it has no check-in
        desk and no election-day list.
      </p>
    );
  } else if (!data) {
    content = pollError ? (
      <ErrorBox>
        The election-day list could not be read: {pollError}. This page tries
        again every few seconds.
      </ErrorBox>
    ) : (
      <Skeleton label="Reading the election-day list…" />
    );
  } else {
    const desk = data.desk ?? [];
    const entries = data.entries ?? [];
    const open = data.election_state === "open";
    const c = data.counts;
    content = (
      <>
        {pollError ? (
          <InlineNotice>
            This page cannot reach the console: {pollError}. It tries again
            every few seconds; what is shown is the last answer.
          </InlineNotice>
        ) : null}
        <p style={body}>{data.precinct_label}</p>
        {c &&
        typeof c.checked_in === "number" &&
        typeof c.credential_issued === "number" ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: `${tokens.space.xs}px ${tokens.space.md}px`,
            }}
          >
            {/* m4: the console's checked_in is signed + issued; its own
                approved count stands beside it. Nothing is added up here. */}
            <p style={{ ...body, fontWeight: 600 }} data-testid="checked-in">
              Checked in (signed the list): {c.checked_in} of {data.count}
            </p>
            {typeof c.approved === "number" ? (
              <p style={{ ...body, fontWeight: 600 }} data-testid="approved">
                Approved, not signed: {c.approved}
              </p>
            ) : null}
            <p style={{ ...body, fontWeight: 600 }} data-testid="issued">
              Credentials issued: {c.credential_issued}
            </p>
          </div>
        ) : (
          <p style={muted}>The console sent no counts.</p>
        )}
        {data.fingerprint ? (
          <Fingerprint short={data.fingerprint_short} full={data.fingerprint} />
        ) : null}

        {outcome ? (
          outcome.failed ? (
            <ErrorBox>{outcome.text}</ErrorBox>
          ) : (
            <InlineNotice>{outcome.text}</InlineNotice>
          )
        ) : null}
        {leftNotes.length > 0 ? (
          <ul
            aria-label="Left the desk"
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 4,
            }}
          >
            {leftNotes.map((n, i) => (
              <li key={`${i}-${n}`} style={body}>
                {n}
              </li>
            ))}
          </ul>
        ) : null}

        <section aria-label="At the desk" className="lp-row">
          <h4 style={h4}>At the desk</h4>
          {desk.length === 0 ? (
            <p style={muted}>
              Nobody is at the desk. A voter appears here when their phone sends
              the check-in.
            </p>
          ) : (
            <ol className="lp-desk">
              {desk.map((e) => {
                const name = entryName(e);
                return (
                  <li key={e.seq} className="lp-desk-entry">
                    <p style={deskName}>{name}</p>
                    <p style={body}>No. {e.seq}</p>
                    <div className="lp-actions">
                      {open ? (
                        <PrimaryButton
                          onClick={() => void press("approve", e)}
                          disabled={busy}
                          aria-busy={
                            acting?.seq === e.seq && acting.action === "approve"
                              ? true
                              : undefined
                          }
                          aria-label={`Approve ${name}`}
                        >
                          {buttonLabel("approve", e.seq, "Approve")}
                        </PrimaryButton>
                      ) : null}
                      <SecondaryButton
                        onClick={() => void press("refuse", e)}
                        disabled={busy}
                        aria-busy={
                          acting?.seq === e.seq && acting.action === "refuse"
                            ? true
                            : undefined
                        }
                        aria-label={`Refuse ${name}`}
                        style={refuseStyle}
                      >
                        {buttonLabel("refuse", e.seq, "Refuse")}
                      </SecondaryButton>
                    </div>
                    {!open ? (
                      <p style={small}>
                        Approval is open only while voting is open; the election
                        is {data.election_state}.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section aria-label="The list" className="lp-row">
          <h4 style={h4}>The list</h4>
          {entries.length === 0 ? (
            <p style={muted}>The console sent no entries.</p>
          ) : (
            <ol className="lp-entries">
              {entries.map((e) => {
                const name = entryName(e);
                return (
                  <li key={e.seq} className="lp-entry">
                    <span className="lp-entry-no">{e.seq}</span>
                    <span style={{ ...body, overflowWrap: "anywhere" }}>
                      {name}
                    </span>
                    <span>
                      <Chip variant={statusChip(e.status)}>
                        {statusWord(e.status)}
                      </Chip>
                    </span>
                    <span className="lp-entry-sig">
                      <SignatureCell sig={e.signature} name={name} />
                    </span>
                    <span className="lp-entry-reset">
                      {mayReset(e.status) && confirmReset !== e.seq ? (
                        <TextButton
                          onClick={() => setConfirmReset(e.seq)}
                          disabled={busy}
                          aria-label={`Reset the check-in of ${name}`}
                          style={{ minHeight: 44 }}
                        >
                          Reset
                        </TextButton>
                      ) : e.status === "credential_issued" ? (
                        <span style={small}>
                          No reset: a credential was issued.
                        </span>
                      ) : null}
                    </span>
                    {confirmReset === e.seq && mayReset(e.status) ? (
                      <div className="lp-entry-confirm">
                        <InlineConfirm
                          title={`Reset the check-in of ${name}?`}
                          headingLevel={5}
                          lines={[
                            "The entry goes back to Not checked in, its signature is dropped, and the phone's check-in ends.",
                            "The voter can then check in again. Once a credential is issued there is no reset.",
                          ]}
                          confirmLabel="Reset the check-in"
                          busyLabel={BUSY.reset}
                          busy={acting?.seq === e.seq}
                          onCancel={() => setConfirmReset(null)}
                          onConfirm={() => void press("reset", e)}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </>
    );
  }

  return (
    <section aria-label="Election-day list">
      <Card>
        <div style={{ display: "grid", gap: tokens.space.sm }}>
          <h3 style={h2}>Election-day list</h3>
          <div aria-live="polite" role="status" className="bc-sr-only">
            <span key={announcement.n}>{announcement.text}</span>
          </div>
          {content}
        </div>
      </Card>
    </section>
  );
}
