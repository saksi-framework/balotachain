import type { ElectionStatus, LiveClient } from "./live";
import { localClient } from "./local";
import { MockLiveClient, mockOptionsFromQuery } from "./mock";
import { RealLiveClient } from "./real";
import { indexedDbStore } from "./storage";

const STATUSES: ElectionStatus[] = ["setup", "open", "closed", "tallied"];

/**
 * Pick the client for this page.
 *
 * The mock (a practice election in memory, with `tamper=…` to fake a failed
 * check) runs only when the build can run it:
 * - `VITE_LIVE_MOCK=1` at build time makes it the only client;
 * - the Vite dev server, or a build made with `VITE_LIVE_MOCK_SWITCH=1`,
 *   honours `?mock=1`.
 * Vite replaces these conditions at build time, so the default build (the
 * one `tools/build-web.sh` ships) folds them to false and drops the mock and
 * its tamper code from the bundle; there `?mock=1` does nothing.
 */
export function selectClient(
  search: string = globalThis.location?.search ?? "",
): { client: LiveClient; mock: boolean | "local" } {
  const query = new URLSearchParams(search);
  if (
    import.meta.env.VITE_LIVE_MOCK === "1" ||
    ((import.meta.env.DEV || import.meta.env.VITE_LIVE_MOCK_SWITCH === "1") &&
      query.get("mock") === "1")
  ) {
    return {
      client: new MockLiveClient({
        store: indexedDbStore("balotachain-vote-mock"),
        ...mockOptionsFromQuery(search),
      }),
      mock: true,
    };
  }
  // The real WebAssembly over the committed test election, with no console.
  // Only in a build made with VITE_LIVE_LOCAL=1: Vite
  // replaces the condition at build time, so the default build drops this
  // branch, the fixture and its throwaway credential.
  if (import.meta.env.VITE_LIVE_LOCAL === "1" && query.get("local") === "1") {
    const status = query.get("status");
    const { client } = localClient(indexedDbStore("balotachain-vote-local"), {
      status: (STATUSES as string[]).includes(status ?? "")
        ? (status as ElectionStatus)
        : "open",
      submitDelay: 600,
    });
    return { client, mock: "local" };
  }
  // The default: the real WebAssembly and the console's HTTP API.
  return { client: new RealLiveClient(), mock: false };
}
