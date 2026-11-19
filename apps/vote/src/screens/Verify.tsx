import { useState, type FormEvent } from "react";
import { AlertIcon, CheckIcon, Chip, TextInput, tokens } from "@balotachain/ui";
import {
  ActionButton,
  Field,
  Lead,
  Notice,
  Screen,
} from "../components/Layout";
import {
  isLiveError,
  normaliseTrackingCode,
  TRACKING_CODE,
  type LookupResult,
  type SubmitReceipt,
} from "../lib/live";
import { BOARD_HREF } from "./Submitted";

export function Verify({
  ownCodes,
  ownReceipts = [],
  boardHref = BOARD_HREF,
  lookup,
  onBack,
}: {
  /** This phone's tracking codes, offered as one-tap fills. */
  ownCodes: string[];
  /** This phone's receipts, to compare the board's fingerprint with. */
  ownReceipts?: SubmitReceipt[];
  /** This election on the public board. */
  boardHref?: string;
  lookup: (code: string) => Promise<LookupResult>;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    const wanted = normaliseTrackingCode(code);
    // Tidy only a code that is well formed; a malformed entry stays as the
    // voter typed it, to correct.
    if (TRACKING_CODE.test(wanted)) setCode(wanted);
    setResult(null);
    // Check the shape here: a typo should not cost a round trip and come back
    // as "Not on the board".
    if (!TRACKING_CODE.test(wanted)) {
      setError(
        "A tracking code looks like BC-XXXX-XXXX, using the digits 0-9 and the letters A-F.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await lookup(wanted));
    } catch (err) {
      setError(isLiveError(err) ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Verify"
      back={onBack}
      footer={
        <a className="ba-link ba-footer-link" href={boardHref}>
          Open the public board
        </a>
      }
    >
      <Lead title="Check a tracking code">
        See whether the public board has the ballot with this code, and whether
        it is counted.
      </Lead>

      <form onSubmit={check} className="ba-stack" noValidate>
        {ownCodes.length > 0 ? (
          <div>
            <span
              style={{
                display: "block",
                fontSize: "var(--ba-type-detail)",
                fontWeight: 600,
                color: tokens.color.text2,
                marginBottom: 8,
              }}
            >
              Your codes
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ownCodes.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCode(c);
                    setResult(null);
                    setError(null);
                  }}
                  className="bc-mono"
                  style={{
                    minHeight: 44,
                    padding: "0 14px",
                    borderRadius: tokens.radius.pill,
                    border: `1.5px solid ${
                      code === c ? tokens.color.teal : tokens.color.border
                    }`,
                    background:
                      code === c
                        ? tokens.color.tealLight
                        : tokens.color.surface,
                    color: tokens.color.text1,
                    fontSize: tokens.font.mono,
                    cursor: "pointer",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <Field id="code" label="Tracking code">
          <TextInput
            id="code"
            variant="mono"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="BC-XXXX-XXXX"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setResult(null);
              setError(null);
            }}
          />
        </Field>
        <ActionButton
          type="submit"
          disabled={code.trim() === ""}
          busy={busy}
          busyLabel="Checking…"
        >
          Check
        </ActionButton>
      </form>

      <div aria-live="polite" style={{ marginTop: tokens.space.md }}>
        {result ? (
          <ResultCard
            result={result}
            receipt={ownReceipts.find(
              (r) => r.trackingCode === result.trackingCode,
            )}
          />
        ) : null}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Screen>
  );
}

function ResultCard({
  result,
  receipt,
}: {
  result: LookupResult;
  receipt?: SubmitReceipt;
}) {
  // The board names another ballot under this phone's own code.
  const differs =
    result.recorded &&
    receipt !== undefined &&
    result.fingerprint !== undefined &&
    receipt.fingerprint !== "" &&
    result.fingerprint !== receipt.fingerprint;
  if (differs) {
    return (
      <Notice tone="error">
        <strong>The board has a different ballot under your code</strong>
        <br />
        The board&apos;s fingerprint for{" "}
        <span className="bc-mono">{result.trackingCode}</span> is{" "}
        <span className="bc-mono" style={{ overflowWrap: "anywhere" }}>
          {result.fingerprint}
        </span>
        ; your receipt shows{" "}
        <span className="bc-mono" style={{ overflowWrap: "anywhere" }}>
          {receipt.fingerprint}
        </span>
        . Show this screen to an election officer.
      </Notice>
    );
  }
  if (!result.recorded) {
    return (
      <Notice tone="warning">
        <strong>Not on the board</strong>
        <br />
        No ballot with <span className="bc-mono">{result.trackingCode}</span> is
        recorded. Check the code for typos. A challenged ballot&apos;s code
        never appears.
      </Notice>
    );
  }
  return (
    <div
      style={{
        background: tokens.color.successLight,
        border: `1px solid ${tokens.color.successBorder}`,
        borderRadius: tokens.radius.card,
        padding: 20,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: tokens.radius.pill,
            background: tokens.color.success,
            color: tokens.color.surface,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <CheckIcon size={24} strokeWidth={2.6} />
        </span>
        <span
          style={{
            fontSize: "var(--ba-type-result)",
            fontWeight: 700,
            color: tokens.color.successText,
          }}
        >
          Recorded on the board
        </span>
      </div>
      <div
        className="bc-mono"
        style={{ fontSize: tokens.font.mono, color: tokens.color.successText }}
      >
        {result.trackingCode}
        {result.positionTitle ? ` · ${result.positionTitle}` : ""}
      </div>
      {result.fingerprint ? (
        <div
          className="bc-mono"
          style={{
            fontSize: tokens.font.mono,
            color: tokens.color.successText,
            overflowWrap: "anywhere",
          }}
        >
          Fingerprint {result.fingerprint}
          {receipt && receipt.fingerprint === result.fingerprint
            ? " · matches your receipt"
            : ""}
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Chip variant="success">Recorded</Chip>
        {result.counted ? (
          <Chip variant="success">Counted</Chip>
        ) : (
          <Chip variant="neutral">Not counted yet</Chip>
        )}
      </div>
      {!result.counted ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            fontSize: "var(--ba-type-detail)",
            color: tokens.color.successBody,
          }}
        >
          <AlertIcon size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          Ballots are counted after voting closes and the trustees decrypt the
          tally.
        </div>
      ) : null}
    </div>
  );
}
