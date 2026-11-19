import { useId, useRef, useState, type FormEvent } from "react";
import { AlertIcon, ClockIcon, TextInput, tokens } from "@balotachain/ui";
import {
  ActionButton,
  Emblem,
  Field,
  Label,
  Lead,
  Notice,
  Screen,
  SecondaryAction,
} from "../components/Layout";
import {
  BAD_DATE,
  dateOfBirth,
  declaredName,
  listName,
  NO_VOTER_LIST,
  REFUSED_AT_DESK,
} from "../lib/checkin";
import { isLiveError, type ListEntry, type VoterDetails } from "../lib/live";
import { STILL_TRYING } from "./Status";
import { POLL_FAILURES_SHOWN, usePollWhileVisible } from "../lib/usePoll";

/**
 * The precinct check-in on the phone (plan 2026-11-15, "What each screen
 * shows", phone 1 to 4; saksi docs/live/voter-list-api.md for the calls).
 */

/** The waiting and signing screens read the check-in this often (1 to 2 s). */
export const CHECKIN_POLL_MS = 1500;

/** A check-in failure shown on the form: which part it belongs to. */
export interface FormError {
  message: string;
  /** "date": the date of birth; null: the details as a whole. */
  field: "date" | null;
}

function splitDate(iso: string | undefined): [string, string, string] {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? [String(Number(m[2])), String(Number(m[3])), m[1]!] : ["", "", ""];
}

/** Screen 1: last name, first name, date of birth, "Find my name". */
export function CheckInForm({
  title,
  precinctLabel,
  initial,
  notice,
  error,
  busy,
  practiceNote,
  onFind,
}: {
  /** The election's title, for the top bar. */
  title: string;
  /** "Precinct 0001A (demonstration)", as the console names it. */
  precinctLabel: string | undefined;
  /** What the voter typed before going Back from the found screen. */
  initial: VoterDetails | null;
  /** A neutral line above the fields (the Board cleared the check-in). */
  notice: string | null;
  error: FormError | null;
  busy: boolean;
  practiceNote?: string;
  onFind: (details: VoterDetails) => void;
}) {
  const [last, setLast] = useState(initial?.lastName ?? "");
  const [first, setFirst] = useState(initial?.firstName ?? "");
  const [m0, d0, y0] = splitDate(initial?.dateOfBirth);
  const [month, setMonth] = useState(m0);
  const [day, setDay] = useState(d0);
  const [year, setYear] = useState(y0);
  /** The page's own date check, before anything is sent. */
  const [dateSlip, setDateSlip] = useState(false);
  const monthRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const dateHint = `${ids}-date-hint`;
  const dateErrorId = `${ids}-date-error`;
  const formErrorId = `${ids}-form-error`;

  const ready =
    last.trim() !== "" &&
    first.trim() !== "" &&
    month.trim() !== "" &&
    day.trim() !== "" &&
    year.trim() !== "";
  const dateError = dateSlip
    ? BAD_DATE
    : error?.field === "date"
      ? error.message
      : null;
  const formError = error && error.field === null ? error.message : null;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!ready || busy) return;
    const dob = dateOfBirth(month, day, year);
    if (dob === null) {
      setDateSlip(true);
      monthRef.current?.focus();
      return;
    }
    setDateSlip(false);
    onFind({ lastName: last, firstName: first, dateOfBirth: dob });
  }

  /** Every field is described by the form's error, which names no field. */
  const described = (own?: string) =>
    [own, formError ? formErrorId : null].filter(Boolean).join(" ") ||
    undefined;
  const digits = (v: string) => v.replace(/\D/g, "");

  return (
    <Screen
      title={title}
      footer={
        <ActionButton
          type="button"
          onClick={() => submit()}
          disabled={!ready}
          busy={busy}
          busyLabel="Looking for your name…"
        >
          Find my name
        </ActionButton>
      }
    >
      <Lead title={`Check in at ${precinctLabel ?? "this precinct"}`}>
        Type your name and date of birth as they are on the precinct's list.
      </Lead>
      <form onSubmit={submit} className="ba-stack" noValidate>
        {notice ? <Notice tone="neutral">{notice}</Notice> : null}
        <Field id="last-name" label="Last name">
          <TextInput
            id="last-name"
            autoComplete="family-name"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            maxLength={100}
            value={last}
            aria-describedby={described()}
            onChange={(e) => setLast(e.target.value)}
          />
        </Field>
        <Field id="first-name" label="First name">
          <TextInput
            id="first-name"
            autoComplete="given-name"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            maxLength={100}
            value={first}
            aria-describedby={described()}
            onChange={(e) => setFirst(e.target.value)}
          />
        </Field>
        <fieldset
          aria-describedby={
            [dateHint, dateError ? dateErrorId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
        >
          <legend
            style={{
              padding: 0,
              fontSize: "var(--ba-type-detail)",
              fontWeight: 600,
              color: tokens.color.text2,
              marginBottom: 4,
            }}
          >
            Date of birth
          </legend>
          <p
            id={dateHint}
            style={{
              margin: "0 0 8px",
              fontSize: "var(--ba-type-small)",
              color: tokens.color.textSubtle,
            }}
          >
            Month, day and year in numbers, for example 3 27 1990.
          </p>
          <div className="ba-date">
            {(
              [
                ["dob-month", "Month", month, setMonth, 2, "bday-month"],
                ["dob-day", "Day", day, setDay, 2, "bday-day"],
                ["dob-year", "Year", year, setYear, 4, "bday-year"],
              ] as const
            ).map(([id, label, value, set, max, auto]) => (
              <Field key={id} id={id} label={label}>
                <TextInput
                  id={id}
                  ref={id === "dob-month" ? monthRef : undefined}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={auto}
                  maxLength={max}
                  value={value}
                  aria-invalid={dateError ? true : undefined}
                  aria-describedby={described(
                    dateError ? dateErrorId : undefined,
                  )}
                  onChange={(e) => {
                    setDateSlip(false);
                    set(digits(e.target.value));
                  }}
                />
              </Field>
            ))}
          </div>
          {dateError ? (
            <p
              id={dateErrorId}
              role="alert"
              style={{
                margin: "8px 0 0",
                fontSize: "var(--ba-type-note)",
                color: tokens.color.error,
              }}
            >
              {dateError}
            </p>
          ) : null}
        </fieldset>
        {formError ? (
          <div id={formErrorId}>
            <Notice tone="error">{formError}</Notice>
          </div>
        ) : null}
        {practiceNote ? (
          <p
            style={{
              margin: 0,
              fontSize: "var(--ba-type-small)",
              color: tokens.color.textSubtle,
            }}
          >
            {practiceNote}
          </p>
        ) : null}
        {/* Lets Enter on the keyboard submit; the visible button is pinned below. */}
        <button
          type="submit"
          className="bc-sr-only"
          tabIndex={-1}
          aria-hidden
        />
      </form>
    </Screen>
  );
}

/** The list entry as a card: the name and the sequence number. */
export function EntryCard({ entry }: { entry: ListEntry }) {
  return (
    <dl
      style={{
        margin: `0 0 ${tokens.space.md}px`,
        padding: "14px 16px",
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.card,
        boxShadow: tokens.shadow.card,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <dt>
          <Label>Name on the list</Label>
        </dt>
        <dd
          style={{
            margin: "4px 0 0",
            fontSize: "var(--ba-type-name)",
            fontWeight: 600,
          }}
        >
          {listName(entry)}
        </dd>
      </div>
      <div>
        <dt>
          <Label>Sequence number</Label>
        </dt>
        <dd
          className="bc-mono"
          style={{ margin: "4px 0 0", fontSize: "var(--ba-type-name)" }}
        >
          {entry.seq}
        </dd>
      </div>
    </dl>
  );
}

/**
 * Screen 3: the name found, the declaration (the plan's text, unchanged)
 * and its tick box. "Send to the Electoral Board" only once it is ticked.
 */
export function Found({
  title,
  entry,
  busy,
  error,
  onBack,
  onSend,
}: {
  title: string;
  entry: ListEntry;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSend: () => void;
}) {
  const [ticked, setTicked] = useState(false);
  const errorId = useId();
  return (
    <Screen
      title={title}
      back={busy ? undefined : onBack}
      footer={
        <ActionButton
          onClick={onSend}
          disabled={!ticked}
          busy={busy}
          busyLabel="Sending…"
        >
          Send to the Electoral Board
        </ActionButton>
      }
    >
      <Lead title="Your name is on the list" />
      <EntryCard entry={entry} />
      <section aria-labelledby="declaration-label">
        <span id="declaration-label">
          <Label>Declaration</Label>
        </span>
        <div className="ba-declaration">
          <p>
            I declare that I am {declaredName(entry)}, the voter named on this
            precinct's list, and that I have not yet voted in this election.
          </p>
          <p>
            In a public election, voting in another person's name or voting more
            than once is an election offense under the Omnibus Election Code,
            Sec. 261(z). The penalty is one to six years of imprisonment without
            probation, disqualification from public office and loss of the right
            to vote (Sec. 264).
          </p>
          <p>This is a demonstration election modelled on that rule.</p>
        </div>
        <label className="ba-check">
          <input
            type="checkbox"
            checked={ticked}
            disabled={busy}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => setTicked(e.target.checked)}
          />
          <span>I make this declaration.</span>
        </label>
      </section>
      {error ? (
        <div id={errorId} style={{ marginTop: tokens.space.sm }}>
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
    </Screen>
  );
}

/**
 * Screen 4: waiting for the Electoral Board. Reads the check-in every
 * `pollMs` while visible and moves on by itself (`onCheck` throws, leaving
 * the screen as it is, when a read fails).
 */
export function Waiting({
  title,
  entry,
  onCheck,
  pollMs = CHECKIN_POLL_MS,
}: {
  title: string;
  entry: ListEntry | undefined;
  onCheck: () => Promise<void>;
  pollMs?: number;
}) {
  const { checkNow, checking, failures, lastError } = usePollWhileVisible(
    onCheck,
    { intervalMs: pollMs },
  );
  return (
    <Screen
      title={title}
      footer={
        // m12: the voter's task is to walk to the desk, so the page's own
        // read is the quiet secondary button, not the main action.
        <SecondaryAction
          onClick={() => void checkNow()}
          busy={checking}
          busyLabel="Checking…"
        >
          Check now
        </SecondaryAction>
      }
    >
      <Emblem tone="warning">
        <ClockIcon size={34} />
      </Emblem>
      <div role="status">
        <Lead title="Waiting for the Electoral Board">
          Go to the Electoral Board's desk. They see your name on their list and
          confirm who you are.
        </Lead>
      </div>
      {entry ? <EntryCard entry={entry} /> : null}
      <PollTrouble failures={failures} lastError={lastError} />
    </Screen>
  );
}

/** D9: one quiet line after a few failed reads, in the console's words when it answered. */
export function PollTrouble({
  failures,
  lastError,
}: {
  failures: number;
  lastError: unknown;
}) {
  const said =
    isLiveError(lastError) && lastError.kind !== "network"
      ? lastError.message
      : STILL_TRYING;
  return (
    <div aria-live="polite">
      {failures >= POLL_FAILURES_SHOWN ? (
        <Notice tone="neutral">{said}</Notice>
      ) : null}
    </div>
  );
}

/** The Board refused at the desk: say so, and offer the check-in again. */
export function Refused({
  title,
  onAgain,
}: {
  title: string;
  onAgain: () => void;
}) {
  return (
    <Screen
      title={title}
      footer={<ActionButton onClick={onAgain}>Check in again</ActionButton>}
    >
      <Emblem tone="error">
        <AlertIcon size={34} />
      </Emblem>
      <div role="alert">
        <Lead title={REFUSED_AT_DESK}>
          If you think this is a mistake, see the Electoral Board.
        </Lead>
      </div>
    </Screen>
  );
}

/** 409 `no-voter-list`: an election with no list cannot check anyone in. */
export function NoVoterList({
  title,
  onRetry,
}: {
  title: string;
  onRetry: () => void;
}) {
  return (
    <Screen
      title={title}
      footer={<ActionButton onClick={onRetry}>Check now</ActionButton>}
    >
      <Emblem tone="warning">
        <AlertIcon size={34} />
      </Emblem>
      <Lead title="Check-in is not possible">{NO_VOTER_LIST}</Lead>
    </Screen>
  );
}
