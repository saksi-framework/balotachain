/**
 * The Setup form's "Voter list" step (voter-list-api.md): the presenter picks
 * the precinct's CSV, the console previews it, and only a list with no error
 * can be confirmed. The page shows what the preview sends (numbers, names, a
 * date of birth as valid or not, the errors, the fingerprint) and never the
 * dates themselves. The file's text is held only to be sent with the
 * election; it is never written to storage or to the console log.
 */
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import {
  tokens,
  AlertIcon,
  PrimaryButton,
  SecondaryButton,
  Skeleton,
  TextButton,
  VerifiableValue,
} from "@balotachain/ui";
import { LiveError, previewVoterList } from "./api";
import { errorLine, fileRefusal, seqByLine } from "./voterList";
import type { VoterListPreview } from "./types";
import { body, ErrorBox, muted, secondarySmall, small } from "./parts";

/** A list the presenter confirmed: what the setup request sends. */
export type ConfirmedList = {
  csv: string;
  fingerprint: string;
  fingerprintShort: string;
  count: number;
};

type Read =
  | { kind: "none" }
  | { kind: "not-sent"; name: string; message: string }
  | { kind: "previewing"; name: string }
  | { kind: "preview"; name: string; answer: VoterListPreview }
  | { kind: "failed"; name: string; message: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** The console's words without a closing full stop, to end a sentence of ours. */
const words = (e: unknown) => message(e).replace(/[.\s]+$/, "");

const cell = {
  padding: "8px 12px 8px 0",
  textAlign: "left",
  verticalAlign: "top",
  borderBottom: `1px solid ${tokens.color.border}`,
  overflowWrap: "anywhere",
} as const;

/** The short fingerprint, and the full value on demand. */
export function Fingerprint({
  short,
  full,
  label = "List fingerprint",
}: {
  short: string;
  full: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <VerifiableValue value={full} label={`${label} (SHA-256)`} />
        <div>
          <TextButton onClick={() => setOpen(false)} style={{ minHeight: 44 }}>
            Show the short form
          </TextButton>
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: tokens.space.xs,
      }}
    >
      <span style={body}>{label}:</span>
      <span className="bc-mono" style={{ fontSize: tokens.font.body }}>
        {short}
      </span>
      <TextButton onClick={() => setOpen(true)} style={{ minHeight: 44 }}>
        Show the full fingerprint
      </TextButton>
    </div>
  );
}

/**
 * The preview, at its full length: it grows with the page rather than
 * scrolling inside a box, so a projected page shows every row. A row on a
 * line the console named in an error is marked in its number cell.
 */
function PreviewTable({ answer }: { answer: VoterListPreview }) {
  const rows = answer.rows ?? [];
  if (rows.length === 0) return null;
  const errorLines = new Set((answer.errors ?? []).map((e) => e.line));
  return (
    <div>
      <table
        aria-label="Preview of the voter list"
        style={{
          ...body,
          width: "100%",
          borderCollapse: "collapse",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <thead>
          <tr style={{ ...small, fontWeight: 600 }}>
            <th style={cell}>No.</th>
            <th style={cell}>Last name</th>
            <th style={cell}>First name</th>
            <th style={cell}>Middle name</th>
            <th style={cell}>Date of birth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.seq}-${r.line}`}>
              {errorLines.has(r.line) ? (
                <td
                  style={{
                    ...cell,
                    color: tokens.color.error,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <AlertIcon size={16} strokeWidth={1.8} />
                    {r.seq}
                    <span className="bc-sr-only">
                      {`, error on line ${r.line}`}
                    </span>
                  </span>
                </td>
              ) : (
                <td style={cell}>{r.seq}</td>
              )}
              <td style={cell}>{r.last_name}</td>
              <td style={cell}>{r.first_name}</td>
              <td style={cell}>{r.middle_name}</td>
              <td
                style={{
                  ...cell,
                  color: r.date_of_birth_valid
                    ? tokens.color.text1
                    : tokens.color.error,
                  fontWeight: r.date_of_birth_valid ? 400 : 600,
                }}
              >
                {r.date_of_birth_valid ? "Valid" : "Not valid"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VoterListStep({
  confirmed,
  onConfirm,
  createError,
  missing,
  chooseRef,
  onAuthFail,
}: {
  confirmed: ConfirmedList | null;
  /** A confirmed list, or null when a new file replaces it. */
  onConfirm: (list: ConfirmedList | null) => void;
  /** The console's sentence when it refused the list at creation. */
  createError: string | null;
  /** A submit was attempted without a confirmed list. */
  missing: boolean;
  chooseRef?: RefObject<HTMLButtonElement>;
  onAuthFail?: (e: unknown) => void;
}) {
  const [read, setRead] = useState<Read>({ kind: "none" });
  /** The chosen file's text, held only until the election is created. */
  const csv = useRef<string | null>(null);
  /** Bumped per file: an older preview's answer is not shown. */
  const ticket = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const statusId = useId();

  // Nothing of the file stays once the step is gone.
  useEffect(
    () => () => {
      csv.current = null;
    },
    [],
  );

  async function preview(name: string) {
    const text = csv.current;
    if (text === null) return;
    const mine = ++ticket.current;
    setRead({ kind: "previewing", name });
    try {
      const answer = await previewVoterList(text);
      if (mine === ticket.current) setRead({ kind: "preview", name, answer });
    } catch (e) {
      if (mine !== ticket.current) return;
      const status = (e as { status?: number })?.status;
      if (status === 401 || status === 403) onAuthFail?.(e);
      setRead({
        kind: "failed",
        name,
        message:
          e instanceof LiveError
            ? `The console refused the file: ${words(e)}.`
            : `The console did not answer, so the file was not read: ${words(e)}.`,
      });
    }
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    ticket.current += 1;
    csv.current = null;
    onConfirm(null);
    const refusal = fileRefusal(file.size);
    if (refusal) {
      setRead({ kind: "not-sent", name: file.name, message: refusal });
      return;
    }
    try {
      // Fatal: a file that is not UTF-8 is refused here rather than read
      // with replacement characters the console would call invalid names.
      csv.current = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
    } catch (e) {
      if (e instanceof TypeError) {
        setRead({
          kind: "not-sent",
          name: file.name,
          message:
            "The file is not UTF-8. Save it as CSV UTF-8 and choose it again.",
        });
        return;
      }
      setRead({
        kind: "not-sent",
        name: file.name,
        message: `This page could not read the file: ${words(e)}.`,
      });
      return;
    }
    await preview(file.name);
  }

  const answer = read.kind === "preview" ? read.answer : null;
  const errors = answer?.errors ?? [];
  const rowAt = seqByLine(answer?.rows);
  const canConfirm = !!answer && answer.valid && answer.fingerprint !== "";

  return (
    <section
      aria-labelledby={headingId}
      className="lp-row"
      style={{ gap: tokens.space.sm }}
    >
      <h4 id={headingId} style={{ ...body, fontWeight: 600 }}>
        Voter list
      </h4>
      {answer ? <p style={body}>{answer.precinct_label}</p> : null}
      <p style={muted}>
        The precinct&apos;s list as a CSV file. The console reads it and shows
        it here; nothing is kept until the election is created.
      </p>

      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        aria-label="Voter list file"
        className="bc-sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          void choose(f);
        }}
      />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: tokens.space.sm,
        }}
      >
        <SecondaryButton
          ref={chooseRef}
          type="button"
          onClick={() => input.current?.click()}
          disabled={read.kind === "previewing"}
          aria-describedby={statusId}
          style={secondarySmall}
        >
          {read.kind === "none" ? "Choose the CSV file" : "Choose another file"}
        </SecondaryButton>
        <span id={statusId} style={small}>
          {read.kind === "none" ? "No file chosen." : `File: ${read.name}`}
        </span>
      </div>

      {read.kind === "previewing" ? (
        <Skeleton label="The console is reading the list…" />
      ) : null}
      {read.kind === "not-sent" ? <ErrorBox>{read.message}</ErrorBox> : null}
      {read.kind === "failed" ? (
        <>
          <ErrorBox>{read.message}</ErrorBox>
          <div>
            <SecondaryButton
              type="button"
              onClick={() => void preview(read.name)}
              style={secondarySmall}
            >
              Try again
            </SecondaryButton>
          </div>
        </>
      ) : null}

      {answer ? (
        <>
          <p style={{ ...body, fontWeight: 600 }} data-testid="list-count">
            {answer.count === 1
              ? "1 voter on the list"
              : `${answer.count} voters on the list`}
            {` (a precinct holds at most ${answer.max_rows}).`}
          </p>
          {errors.length > 0 ? (
            <div style={{ display: "grid", gap: tokens.space.xs }}>
              <ErrorBox>
                {errors.length === 1
                  ? "The list has 1 error, so it cannot be confirmed. Change the file and choose it again."
                  : `The list has ${errors.length} errors, so it cannot be confirmed. Change the file and choose it again.`}
              </ErrorBox>
              <ul
                aria-label="Errors in the list"
                style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}
              >
                {errors.map((e, i) => (
                  <li key={`${e.line}-${e.code}-${i}`} style={body}>
                    {errorLine(e, rowAt.get(e.line))}
                  </li>
                ))}
              </ul>
              {(answer.rows ?? []).length > 0 ? (
                <p style={small}>
                  The numbers below are provisional until the list has no
                  errors.
                </p>
              ) : null}
            </div>
          ) : null}
          <PreviewTable answer={answer} />
          {answer.valid && answer.fingerprint ? (
            <Fingerprint
              short={answer.fingerprint_short}
              full={answer.fingerprint}
            />
          ) : null}
        </>
      ) : null}

      {createError ? (
        <>
          <ErrorBox>{createError}</ErrorBox>
          {read.kind === "preview" && !confirmed ? (
            <div>
              <SecondaryButton
                type="button"
                onClick={() => {
                  onConfirm(null);
                  void preview(read.name);
                }}
                style={secondarySmall}
              >
                Read the list again
              </SecondaryButton>
            </div>
          ) : null}
        </>
      ) : null}

      {confirmed ? (
        <p role="status" style={{ ...body, fontWeight: 600 }}>
          Confirmed: {confirmed.count}{" "}
          {confirmed.count === 1 ? "voter" : "voters"}, fingerprint{" "}
          <span className="bc-mono">{confirmed.fingerprintShort}</span>. The
          console locks this list when the election is created; after that no
          row can be added or changed.
        </p>
      ) : answer ? (
        <div style={{ display: "grid", gap: tokens.space.xs }}>
          <div>
            <PrimaryButton
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                if (!canConfirm || csv.current === null) return;
                onConfirm({
                  csv: csv.current,
                  fingerprint: answer.fingerprint,
                  fingerprintShort: answer.fingerprint_short,
                  count: answer.count,
                });
              }}
              style={{ whiteSpace: "normal", lineHeight: 1.2 }}
            >
              Confirm the list
            </PrimaryButton>
          </div>
          {!canConfirm ? (
            <p style={small}>
              The list can be confirmed once the console finds no error in it.
            </p>
          ) : null}
        </div>
      ) : null}

      {missing && !confirmed ? (
        <p
          role="alert"
          style={{
            ...small,
            color: tokens.color.error,
            fontWeight: 600,
          }}
        >
          Confirm the voter list before the election can be created.
        </p>
      ) : null}
    </section>
  );
}
