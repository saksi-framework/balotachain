# Appendix A — replacement draft

Drafted 2026-08-24. Replaces the existing `Appendix A: Data Collection` in
`BalotaChain_Main_Paper`. Paste into the manuscript and re-apply the document's
own table styling.

**What changed and why**

1. The single sample-records table becomes **two** tables, mirroring the
   two-stage split the methodology already defines in Figure 3.1 (Stage 4
   Synthetic Data Generation → validation gate → Stage 5 Demonstration).
   Table A.1 is the pre-encryption ground-truth input that a reader can
   inspect before any cryptography runs; Table A.2 is the record as it exists
   after simulated registration, retaining the credential and nullifier
   fields.
2. Table A.1 is **wide** — one row per voter, one column per position —
   because every voter casts a selection in every position, so the wide form
   carries the same information in a shape a reader can scan a whole ballot
   from. Table A.2 stays long, since credentials and nullifiers are
   per-position artifacts.
3. Candidate labels use the readable `CAND_PRES_01` / `CAND_VICE_01` /
   `CAND_SEN_01` form rather than the terser `CAND_P_01`.
4. Field names standardise on the names Table 3.2 already uses (`selection`,
   `credential`) rather than the longer variants the previous appendix headers
   used (`candidate_selection`, `anonymous_credential`).
5. Tier list updated from "conditional" to "capstone", matching the revised
   Scope, Data Collection, Table 3.1, Table 3.2, and Table 3.5.

---

## Appendix A: Data Collection

### A.1 Synthetic ground-truth input (generated before encryption)

The generator produces the plaintext ground truth first, independently of the
cryptographic pipeline, so that the input to the election can be inspected and
validated before any ballot is encrypted. One row represents one voter and
carries that voter's selection in every position on the ballot.

| voter_id | scale_group | ballot_complexity | PRESIDENT | VICE_PRESIDENT | SENATOR |
| --- | --- | --- | --- | --- | --- |
| V-000001 | 3524078 | multi | CAND_PRES_01 | CAND_VICE_01 | CAND_SEN_01 |
| V-000002 | 3524078 | multi | CAND_PRES_02 | CAND_VICE_03 | CAND_SEN_04 |
| V-000003 | 3524078 | multi | CAND_PRES_01 | CAND_VICE_01 | CAND_SEN_01 |
| V-000004 | 3524078 | multi | CAND_PRES_03 | CAND_VICE_04 | CAND_SEN_02 |
| V-000005 | 3524078 | multi | CAND_PRES_01 | CAND_VICE_02 | CAND_SEN_03 |

*Rows shown are illustrative of the full-ZAMBASULTA multi-position
configuration. In the single-position configuration the table carries one
selection column, `PRESIDENT`. Every voter casts a selection in every position;
abstention is not modelled in the present generator.*

### A.2 Synthetic voter record after simulated registration

Once registration is simulated, each voter-position pair carries its own
blind-signed credential and single-use nullifier. The three records belonging to
one voter in a multi-position ballot share a single `voter_id` but carry
independent nullifiers, one per position, so that double voting is prevented per
voter per position.

| voter_id | ballot_complexity | position | credential | nullifier | selection |
| --- | --- | --- | --- | --- | --- |
| V-000001 | multi | PRESIDENT | 0x8f3a…9b21 | 0x4c1e…a7d0 | CAND_PRES_01 |
| V-000001 | multi | VICE PRESIDENT | 0x8f3a…9b21 | 0x91b7…e3f5 | CAND_VICE_01 |
| V-000001 | multi | SENATOR | 0x8f3a…9b21 | 0x2d60…c84a | CAND_SEN_01 |
| V-000002 | multi | PRESIDENT | 0xa017…5e44 | 0x7fa2…10bd | CAND_PRES_02 |
| V-000002 | multi | VICE PRESIDENT | 0xa017…5e44 | 0xbe39…6c22 | CAND_VICE_03 |
| V-000002 | multi | SENATOR | 0xa017…5e44 | 0x05cd…9af1 | CAND_SEN_04 |
| V-000003 | single | PRESIDENT | 0x33dd…8b07 | 0xc7e8…41a9 | CAND_PRES_04 |
| V-000004 | single | PRESIDENT | 0x6b92…f2ce | 0x1a44…d3b6 | CAND_PRES_02 |

*Credential and nullifier values are truncated for display. The `selection`
column carries the same value as the corresponding cell of Table A.1 for that
voter and position; the credential and nullifier are added at registration and
are not present in the pre-encryption ground-truth input.*

### Generation parameters

| Parameter | Value / Description |
| --- | --- |
| Election scales (voters) | 1,000; 10,000; 50,000; 483,000; 1,000,000; 1,921,917 and 3,524,078 (capstone) |
| Ballot complexity | Single-position; multi-position (three positions: President, Vice President, Senator, single-winner each) |
| Records per voter | One selection per position (single-position: one; multi-position: three) |
| Cryptographic group | ristretto255 (prime-order elliptic curve group) |
| Candidate set per position | Fixed set of K candidates; selection drawn from a defined categorical distribution |
| Selection distribution | Configurable per position (uniform and skewed profiles), fixed for reproducibility |
| Credential | Blind-signed credential issued at simulated registration; unlinkable to voter_id |
| Nullifier | Single-use value derived per voter per position; prevents double voting per position |
| Ground truth | Per-position vote-to-candidate counts known at generation; basis for tally error E = sum of \|T − G\| |
| Reproducibility | Deterministic, index-derived selection: a population is reproduced exactly by restating its voter count, position count, candidate count, and distribution profile |
| Data nature | Fully synthetic; no human subjects, no personally identifiable information |

### Sample seeded ground truth (single-position, 500-voter sample)

| Position | Candidate | Seeded ground-truth count |
| --- | --- | --- |
| PRESIDENT | CAND_PRES_01 | 142 |
| PRESIDENT | CAND_PRES_02 | 119 |
| PRESIDENT | CAND_PRES_03 | 131 |
| PRESIDENT | CAND_PRES_04 | 108 |
| | **Total** | **500** |

*The seeded counts above define the ground truth for one single-position
configuration at the 500-voter scale. After homomorphic aggregation and
threshold decryption, the system's decrypted counts are compared against these
values; an exact match yields a tally error of zero.*

---

## Note on the reproducibility row

The previous wording read *"Deterministic pseudorandom generation with a
recorded seed for reproducible populations."* The generator does not draw
selections from a seeded PRNG — each selection is derived arithmetically from
the voter index, position index, and distribution profile. This is a stronger
reproducibility guarantee than a stored seed: reproducing a population requires
only the four generation parameters, which are already recorded, and there is no
seed value that could be lost or mistranscribed. The row is reworded
accordingly. If the manuscript prefers to keep the seed language, the claim
should at minimum drop "recorded seed", since no seed is stored.
