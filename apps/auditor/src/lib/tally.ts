/**
 * Tally + fingerprint logic for the BalotaChain Auditor app.
 *
 * The canonical JSON output **must match the Rust** `bulletin_store::
 * canonical_results_json` byte-for-byte so that the SHA-256 fingerprint is
 * identical across languages.
 *
 * Rust conventions we mirror:
 *  - `BTreeMap<String, RaceResult>` sorts race keys alphabetically.
 *  - serde_json emits struct fields in declaration order
 *    (`CandidateResult` → `id, name, party, votes, elected`).
 *  - No whitespace, no trailing commas.
 *
 * See `crates/bulletin-store/src/lib.rs::results_fingerprint` and the matching
 * Rust test `cross_language_fingerprint_fixture`.
 */

export type CandidateResult = {
  id: string;
  name: string;
  party: string;
  votes: number;
  elected: boolean;
};

export type RaceResult = {
  candidates: CandidateResult[];
};

/**
 * Serialise `results` to the canonical JSON form used by Rust's
 * `serde_json::to_string(&BTreeMap<String, RaceResult>)`.
 *
 * Races are sorted alphabetically by id. Each candidate's fields are emitted
 * in the Rust struct declaration order.
 */
export function canonicalResultsJson(
  results: Record<string, RaceResult>,
): string {
  const sortedKeys = Object.keys(results).sort();
  const parts: string[] = [];
  for (const key of sortedKeys) {
    const race = results[key];
    parts.push(
      JSON.stringify(key) + ":" + canonicalRaceJson(race),
    );
  }
  return "{" + parts.join(",") + "}";
}

function canonicalRaceJson(race: RaceResult): string {
  const candidates = race.candidates.map(canonicalCandidateJson).join(",");
  return '{"candidates":[' + candidates + "]}";
}

function canonicalCandidateJson(c: CandidateResult): string {
  // Field order MUST match the Rust struct declaration in
  // `crates/bulletin-store::CandidateResult`: id, name, party, votes, elected.
  return (
    "{" +
    '"id":' + JSON.stringify(c.id) + "," +
    '"name":' + JSON.stringify(c.name) + "," +
    '"party":' + JSON.stringify(c.party) + "," +
    '"votes":' + String(c.votes) + "," +
    '"elected":' + String(c.elected) +
    "}"
  );
}

/**
 * SHA-256 of the canonical results JSON, prefixed with `sha256:` to match the
 * Rust `bulletin_store::results_fingerprint` output exactly.
 */
export async function resultsFingerprint(
  results: Record<string, RaceResult>,
): Promise<string> {
  const json = canonicalResultsJson(results);
  const bytes = new TextEncoder().encode(json);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = bytesToHex(new Uint8Array(digest));
  return "sha256:" + hex;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
