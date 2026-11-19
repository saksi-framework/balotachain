import { useEffect, useState } from "react";
import {
  AlertIcon,
  ClockIcon,
  LockIcon,
  Skeleton,
  tokens,
} from "@balotachain/ui";
import {
  ActionButton,
  Emblem,
  Lead,
  Notice,
  Screen,
} from "../components/Layout";
import { isLiveError, type LiveErrorKind } from "../lib/live";
import {
  LOADING_EXIT_MS,
  POLL_FAILURES_SHOWN,
  POLL_MS,
  usePollWhileVisible,
} from "../lib/usePoll";

/** D12: the loading screen's way out. */
export const TAKING_LONGER = "This is taking longer than usual";

export function Loading({
  label,
  onRetry,
  exitAfterMs = LOADING_EXIT_MS,
}: {
  label: string;
  /** Offered once loading has taken `exitAfterMs` (D12). */
  onRetry?: () => void;
  exitAfterMs?: number;
}) {
  const [long, setLong] = useState(false);
  // Each label is its own wait: the clock starts again when it changes.
  useEffect(() => {
    setLong(false);
    const t = setTimeout(() => setLong(true), exitAfterMs);
    return () => clearTimeout(t);
  }, [label, exitAfterMs]);
  const exit = long && onRetry;
  return (
    <Screen
      title="BalotaChain"
      footer={
        exit && onRetry ? (
          <ActionButton onClick={onRetry}>Retry</ActionButton>
        ) : undefined
      }
    >
      <Skeleton label={label} lines={[55, 100, 90, 70]} />
      <div aria-live="polite" style={{ marginTop: tokens.space.md }}>
        {exit ? <Notice tone="neutral">{TAKING_LONGER}.</Notice> : null}
      </div>
    </Screen>
  );
}

const ERROR_TITLES: Record<LiveErrorKind, string> = {
  network: "Can't reach the election server",
  auth: "Check in again",
  "not-open": "Voting has not opened yet",
  closed: "Voting has closed",
  "already-voted": "Your ballot is already recorded",
  refused: "The election server refused this",
  unsupported: "This browser can't run the voting software",
};

export function ErrorScreen({
  title,
  kind,
  message,
  onRetry,
}: {
  /** Overrides the title the kind gives. */
  title?: string;
  kind: LiveErrorKind;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Screen
      title="BalotaChain"
      footer={<ActionButton onClick={onRetry}>Retry</ActionButton>}
    >
      <Emblem tone="error">
        <AlertIcon size={34} />
      </Emblem>
      <div role="alert">
        <Lead title={title ?? ERROR_TITLES[kind]}>{message}</Lead>
      </div>
    </Screen>
  );
}

/** D9: shown under the waiting text after `POLL_FAILURES_SHOWN` failed reads. */
export const STILL_TRYING =
  "This phone can't reach the election server right now. It keeps trying.";

export function NotOpen({
  title,
  credential = true,
  onCheck,
  pollMs = POLL_MS,
}: {
  title: string;
  /** The voting credential is already on this phone. */
  credential?: boolean;
  /**
   * One quiet read of the console: moves on by itself when voting opens,
   * and throws, leaving this screen as it is, when the read fails.
   */
  onCheck: () => Promise<void>;
  pollMs?: number;
}) {
  // D9: waiting on the election officer, so read again every few seconds
  // while the page is visible; "Check now" is the fallback.
  const { checkNow, checking, failures, lastError } = usePollWhileVisible(
    onCheck,
    {
      intervalMs: pollMs,
    },
  );
  // m6: a read the console answered (refused, an unknown state) is said in
  // its own words; only a network failure is "can't reach".
  const said =
    isLiveError(lastError) &&
    (lastError.kind !== "network" || lastError.detail?.type === "storage-read")
      ? lastError.message
      : STILL_TRYING;
  return (
    <Screen
      title={title}
      footer={
        <ActionButton
          onClick={() => void checkNow()}
          busy={checking}
          busyLabel="Checking…"
        >
          Check now
        </ActionButton>
      }
    >
      <Emblem tone="warning">
        <ClockIcon size={34} />
      </Emblem>
      <Lead title="Voting has not opened yet">
        {credential
          ? "Your credential is ready on this phone. Keep this page open; the ballot appears once the election officer opens voting."
          : "Keep this page open. The check-in opens by itself when the election officer opens voting."}
      </Lead>
      <div aria-live="polite">
        {failures >= POLL_FAILURES_SHOWN ? (
          <Notice tone="neutral">{said}</Notice>
        ) : null}
      </div>
    </Screen>
  );
}

export function Closed({
  title,
  boardHref,
  onVerify,
}: {
  title: string;
  boardHref: string;
  onVerify: () => void;
}) {
  return (
    <Screen
      title={title}
      footer={
        <>
          <ActionButton onClick={onVerify}>Check a tracking code</ActionButton>
          <a className="ba-link ba-footer-link" href={boardHref}>
            Open the public board
          </a>
        </>
      }
    >
      <Emblem>
        <LockIcon size={34} />
      </Emblem>
      <Lead title="Voting has closed">
        This election no longer accepts ballots. The results and every recorded
        ballot are on the public board.
      </Lead>
    </Screen>
  );
}
