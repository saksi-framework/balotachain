---
name: random-dkg-dealers
description: "The generator's DKG dealer polynomials were fixed (keys derivable from source) until saksi #50 (merge 1812139, 2026-09-15); runs before it cannot back any ballot-secrecy claim."
metadata: 
  node_type: memory
  type: project
  originSessionId: eddf28aa-046c-419f-96ab-1f6c6ce58884
  modified: 2026-09-14T19:25:47.769Z
---

Found 2026-09-15 while refreshing the execution-trace page: `gen_prologue` and `happy_path_fixture` in `saksi/packages/saksi-auditor/src/fixtures.rs` built every trustee's DKG polynomial from `dealer_id × 13 + k + 1`, so every generated election's secret key could be derived from the open-source code. Fixed in saksi #50 (merge `1812139`): `Dealer::random` in `saksi-crypto/src/dkg.rs` draws each coefficient from `OsRng`; tests `every_generated_election_gets_a_fresh_dkg`, `random_dealers_are_fresh_and_their_key_decrypts_at_threshold`. The golden-vector DKG (`tally-sig-v1.hex`) and saksi-crypto unit-test dealers stay fixed on purpose. Docs: saksi #51 (wizard docs), balotachain #59 (`CLAIMS.md` row, `manuscript-amendments.md` §10, Defense Reviewer Part 5, trace page re-pinned).

**Why:** the user's words: "lets not make it something that can be read from source because this would be open-source and defeats the full purpose of saksi at all".

**How to apply:** a secrecy or unlinkability claim must cite a run whose `run.json` `git_head_saksi` is `1812139` or later; older runs support correctness, verifiability, integrity and performance only. The ceremony is still simulated (the generator process holds every share), so harness secrecy is against everyone except that process. See [[study-grade-wizard-done]].
