/**
 * The Setup form (D19): the presenter types names, the form builds the ids
 * the chain records, and shows both before anything is sent.
 */
import { useEffect, useId, useRef, useState } from "react";
import {
  tokens,
  SecondaryButton,
  TextButton,
  TextInput,
  idToName,
} from "@balotachain/ui";
import {
  DEMO_THRESHOLD,
  DEMO_TRUSTEES,
  EMPTY_FORM,
  formErrors,
  nameToId,
  requestOf,
  type ElectionForm,
} from "./model";
import { VoterListStep, type ConfirmedList } from "./VoterListStep";
import type { LiveElectionRequest } from "./types";
import {
  body,
  ErrorBox,
  muted,
  secondarySmall,
  small,
  WriteButton,
} from "./parts";

const fieldLabel = {
  fontSize: tokens.font.small,
  fontWeight: 600,
  color: tokens.color.text1,
} as const;

const errorText = {
  ...small,
  color: tokens.color.error,
  fontWeight: 600,
} as const;

/** One typed name with its id on chain, its shown text and its refusal. */
function NameField({
  label,
  value,
  error,
  showError,
  onChange,
  onRemove,
  removeLabel,
}: {
  label: string;
  value: string;
  error: string | undefined;
  showError: boolean;
  onChange: (v: string) => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const id = useId();
  const hint = `${id}-hint`;
  const err = `${id}-err`;
  const builtId = nameToId(value);
  const shown = showError && error;
  // The id and display lines only once the name is one the chain takes.
  const idLine = builtId && !(error && /Letters, digits/.test(error));
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <label htmlFor={id} style={fieldLabel}>
        {label}
      </label>
      <div className="lp-name-row">
        <TextInput
          id={id}
          value={value}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={shown ? true : undefined}
          aria-describedby={`${hint}${shown ? ` ${err}` : ""}`}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
        {onRemove ? (
          <SecondaryButton
            onClick={onRemove}
            aria-label={removeLabel}
            style={secondarySmall}
          >
            Remove
          </SecondaryButton>
        ) : null}
      </div>
      <p id={hint} className="lp-idline" style={small}>
        {idLine ? (
          <>
            <span>
              id on chain:{" "}
              <span className="bc-mono" style={{ color: tokens.color.text1 }}>
                {builtId}
              </span>
            </span>
            <span>Shown as: {idToName(builtId)}</span>
          </>
        ) : null}
      </p>
      {shown ? (
        <p id={err} style={errorText}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The console's codes for a list it refused at creation (voter-list-api.md). */
const LIST_CODES = new Set([
  "voter-list-missing",
  "voter-list-invalid",
  "voter-list-unconfirmed",
  "voter-list-changed",
]);

export function SetupForm({
  onSubmit,
  busy,
  error,
  errorCode,
  onAuthFail,
  initial = EMPTY_FORM,
}: {
  /** Sends the body; resolves when the console answered. */
  onSubmit: (body: LiveElectionRequest) => void;
  busy: boolean;
  /** The console's own words after a refusal; the form keeps what was typed. */
  error: string | null;
  /** The refusal's `code`, when the console sent one. */
  errorCode?: string;
  onAuthFail?: (e: unknown) => void;
  initial?: ElectionForm;
}) {
  const [form, setForm] = useState<ElectionForm>(initial);
  const [list, setList] = useState<ConfirmedList | null>(null);
  /** The console's sentence for a list it refused at creation. */
  const [listError, setListError] = useState<string | null>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const listRefused = !!error && !!errorCode && LIST_CODES.has(errorCode);
  // A list the console refused must be read and confirmed again.
  useEffect(() => {
    if (!listRefused) return;
    setList(null);
    setListError(error);
  }, [listRefused, error]);
  const [attempted, setAttempted] = useState(false);
  /** Bumped by a refused submit: the first refused field takes the focus. */
  const [refusedAt, setRefusedAt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = formErrors(form);
  const titleId = useId();
  useEffect(() => {
    if (refusedAt === 0) return;
    const field = formRef.current?.querySelector<HTMLInputElement>(
      'input[aria-invalid="true"]',
    );
    if (field) field.focus();
    else chooseRef.current?.focus();
  }, [refusedAt]);
  /** A field's refusal shows once it has text, or after a submit attempt. */
  const show = (v: string) => attempted || v.trim() !== "";

  const setPosition = (i: number, name: string) =>
    setForm((f) => ({
      ...f,
      positions: f.positions.map((p, k) => (k === i ? { ...p, name } : p)),
    }));
  const setCandidate = (i: number, j: number, name: string) =>
    setForm((f) => ({
      ...f,
      positions: f.positions.map((p, k) =>
        k === i
          ? {
              ...p,
              candidates: p.candidates.map((c, m) => (m === j ? name : c)),
            }
          : p,
      ),
    }));

  function submit() {
    setAttempted(true);
    if (Object.keys(errors).length > 0 || !list) {
      setRefusedAt((n) => n + 1);
      return;
    }
    setListError(null);
    onSubmit({
      ...requestOf(form),
      voter_list: list.csv,
      voter_list_fingerprint: list.fingerprint,
    });
  }

  const count = Object.keys(errors).length;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) submit();
      }}
      style={{ display: "grid", gap: tokens.space.sm }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <label htmlFor={titleId} style={fieldLabel}>
          Title
        </label>
        <TextInput
          id={titleId}
          value={form.title}
          autoComplete="off"
          aria-invalid={show(form.title) && errors.title ? true : undefined}
          aria-describedby={
            show(form.title) && errors.title ? `${titleId}-err` : undefined
          }
          onChange={(e) => {
            const title = e.currentTarget.value;
            setForm((f) => ({ ...f, title }));
          }}
        />
        {show(form.title) && errors.title ? (
          <p id={`${titleId}-err`} style={errorText}>
            {errors.title}
          </p>
        ) : null}
      </div>

      {form.positions.map((p, i) => (
        <fieldset
          key={i}
          className="lp-row"
          style={{
            margin: 0,
            padding: `${tokens.space.sm}px 0 0`,
            border: 0,
            borderTop: `1px solid ${tokens.color.border}`,
          }}
        >
          <legend className="bc-sr-only">Position {i + 1}</legend>
          <NameField
            label={`Position ${i + 1}`}
            value={p.name}
            error={errors[`p${i}`]}
            showError={show(p.name)}
            onChange={(v) => setPosition(i, v)}
            onRemove={
              form.positions.length > 1
                ? () =>
                    setForm((f) => ({
                      ...f,
                      positions: f.positions.filter((_, k) => k !== i),
                    }))
                : undefined
            }
            removeLabel={`Remove position ${i + 1}`}
          />
          <div
            className="lp-form-names"
            style={{ paddingLeft: tokens.space.sm }}
          >
            {p.candidates.map((c, j) => (
              <NameField
                key={j}
                label={`Candidate ${j + 1}`}
                value={c}
                error={errors[`p${i}c${j}`]}
                showError={show(c)}
                onChange={(v) => setCandidate(i, j, v)}
                onRemove={
                  p.candidates.length > 1
                    ? () =>
                        setForm((f) => ({
                          ...f,
                          positions: f.positions.map((q, k) =>
                            k === i
                              ? {
                                  ...q,
                                  candidates: q.candidates.filter(
                                    (_, m) => m !== j,
                                  ),
                                }
                              : q,
                          ),
                        }))
                    : undefined
                }
                removeLabel={`Remove candidate ${j + 1} of position ${i + 1}`}
              />
            ))}
            <div className="lp-span">
              <TextButton
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    positions: f.positions.map((q, k) =>
                      k === i ? { ...q, candidates: [...q.candidates, ""] } : q,
                    ),
                  }))
                }
                style={{ minHeight: 44 }}
              >
                Add a candidate
              </TextButton>
            </div>
          </div>
        </fieldset>
      ))}

      <div>
        <SecondaryButton
          type="button"
          onClick={() =>
            setForm((f) => ({
              ...f,
              positions: [...f.positions, { name: "", candidates: ["", ""] }],
            }))
          }
          style={secondarySmall}
        >
          Add a position
        </SecondaryButton>
      </div>

      <p style={muted}>
        {DEMO_TRUSTEES} trustees, {DEMO_THRESHOLD} needed to decrypt. Names use
        letters, digits, dot and space; each space becomes a hyphen on chain and
        is shown as a space again.
      </p>

      <VoterListStep
        confirmed={list}
        onConfirm={(l) => {
          setList(l);
          setListError(null);
        }}
        createError={listError}
        missing={attempted}
        chooseRef={chooseRef}
        onAuthFail={onAuthFail}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: tokens.space.sm,
          alignItems: "flex-start",
        }}
      >
        <WriteButton
          label="Create election"
          busyLabel="Recording on chain…"
          busy={busy}
          type="submit"
        />
        {/* The list's own sentence sits in its step, once (m3). */}
        {attempted && count > 0 ? (
          <p
            role="alert"
            style={{
              ...body,
              color: tokens.color.error,
              fontWeight: 600,
              alignSelf: "center",
            }}
          >
            {count === 1
              ? "One field needs a change before the election can be created."
              : `${count} fields need a change before the election can be created.`}
          </p>
        ) : null}
      </div>
      {error && !listRefused ? <ErrorBox>{error}</ErrorBox> : null}
    </form>
  );
}
