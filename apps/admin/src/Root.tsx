/**
 * Which page `/admin/` is. The console's live route decides (see
 * `live/probe.ts`): a live election, or live mode with nothing set up yet, is
 * the presenter page; any other answer is the study wizard, unchanged. An
 * answer that says nothing is tried again and then said, never guessed.
 */
import { useEffect, useState } from "react";
import {
  tokens,
  Card,
  SecondaryButton,
  Skeleton,
  TopBar,
} from "@balotachain/ui";
import App, { Login } from "./App";
import { Presenter } from "./live/Presenter";
import { probeEntry, PROBE_TRIES, type Entry } from "./live/probe";

export default function Root() {
  const [entry, setEntry] = useState<Entry | { kind: "probing" }>({
    kind: "probing",
  });
  /** Bumped by "Try again" on the no-answer notice. */
  const [probe, setProbe] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setEntry({ kind: "probing" });
    void probeEntry(ctrl.signal).then((e) => {
      if (!ctrl.signal.aborted) setEntry(e);
    });
    return () => ctrl.abort();
  }, [probe]);

  if (entry.kind === "study") return <App />;
  if (entry.kind === "live")
    return <Presenter initialView={entry.view} Login={Login} />;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: tokens.color.bg,
        color: tokens.color.text1,
        fontFamily: tokens.type.fontFamily,
      }}
    >
      <TopBar appName="" />
      <main className="bc-wrap" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <Card>
          {entry.kind === "unanswered" ? (
            <>
              <p
                role="status"
                style={{
                  margin: 0,
                  fontSize: tokens.font.body,
                  color: tokens.color.text1,
                }}
              >
                This page could not reach the election console. It asked{" "}
                {PROBE_TRIES} times and got no answer it could use.
              </p>
              <div style={{ marginTop: tokens.space.sm }}>
                <SecondaryButton onClick={() => setProbe((n) => n + 1)}>
                  Try again
                </SecondaryButton>
              </div>
            </>
          ) : (
            <Skeleton label="Connecting to the election console…" />
          )}
        </Card>
      </main>
    </div>
  );
}
