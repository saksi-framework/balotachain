# Study-grade wizard: run the thesis campaign from `/wizard`

Date: 2026-09-14. Status: **approved 2026-09-14** — D1: truly pause mid-submission; D2: guarded infrastructure buttons; W0 done (saksi #42 → adba922, balotachain #56 → b27938e). Repo: `saksi`
(`packages/saksi-campaign`, the console and its embedded `web/wizard.html`), with the
operator instructions in `saksi/docs/research-election-console-runbook.md`.
Depends on saksi PR #42 (console auth) merging first: every new route below goes into
its role table.

Goal: every number and verdict that goes into Chapter 4 can be produced by clicking
through `/wizard`, with the same results the command line produces, and with written
instructions an operator can follow without Claude Code.

## 1. What `/wizard` does today (read from `origin/main`)

It already has: the election form (name, trustees, threshold, positions, candidates,
senate seats, voters, distribution, mode, "Ballots in flight", send rate), tier presets
(1 … 3,524,078 voters), seven steps (Set up, Ballots, Check, Encrypt, Trustees, Verify,
Attacks), attack panels per lifecycle stage with a per-stage Skip and a global "Skip
attacks", live progress over `/events`, the audit trail, and per-run exports.

What stops it producing study results:

| # | Gap | Evidence |
|---|---|---|
| G1 | One election at a time. Warm-ups, measured repetitions and `summary.csv` exist only in the CLI (`saksi-campaign --repeat`) | `repeat.go` is an HTTP client run from a terminal |
| G2 | The validation ladder is CLI-only, and `/generate` refuses tiers above 1,000 until it has run | `tools/ladder.sh`, `handleGenerate` gate |
| G3 | "Ballots in flight" defaults to **8**, which is the orderer BatchTimeout trap (3.9 TPS) under the declared `MaxMessageCount 50` | `wizard.html:307-308`; `docs/desktop-runs/2026-09-11-row2.md` §6 |
| G4 | Per-tier network reset and the node-restart test (T3) are shell scripts | `tools/tier.sh`, `tools/t3-restart.sh` |
| G5 | Resume and verify-only exist in the API but have no buttons | `handleRunAction` |
| G6 | Results are per-run file downloads; no campaign summary view or thesis bundle | `/export/<run>/<file>` |
| G7 | No preflight. A game using ~7 of 16 cores silently halved MP-10K throughput during validation | 2026-09-12 validation run |
| G8 | **Attack timing and verdict validity.** The "before any ballot is cast" and "while ballots are being submitted" panels render only after `/ceremony/start` reports done (`wizard.html` `startSaksi`), i.e. after every ballot has been submitted and the election closed. A live ballot attack is then refused by the closed-election gate (`election %q is not open for ballots`, `contract.go:173`) before the proof or nullifier check runs, and `mountLiveAttack` scores **any** submit error as PASS (`scenarios.go`). On-chain ballot and DKG verdicts can therefore be passes for the wrong reason. The recorded `actual` text shows the real reason; the verdict overstates it | code read on `origin/main` |
| G9 | With auth on, `/wizard` is admin-only and has no sign-in, so it returns a JSON 401 | PR #42 role table |

## 2. The attack timeline (before, during and after generation)

Each stage is skippable on its own, and "Skip all attacks" stays.

| When | Lifecycle point | Scenarios | Gate that must reject it |
|---|---|---|---|
| **Before ballots** | Election created, before ballot submission | `tamper-dkg-transcript` | DKG transcript integrity |
| **During ballots** | Election open, submission paused at a chosen fraction (default 50 %) | `tamper-ballot-proof`, `reused-nullifier`, `corrupted-ballot-bytes` | On-chain CDS verification; nullifier already spent; wire decode |
| **After ballots** | Election closed, sealed box | `dropped-ballot`, `reordered-ballots` | Ballot-box completeness; ledger ordering (audit) |
| **During tally** | Ceremony open, before publish | `tamper-partial-decryption` | Partial-decryption integrity |
| **After tally** | Verified result | the full catalogue, re-audited offline | Each scenario's own audit finding |

Rules the build must enforce:

1. **A PASS names the right gate.** Each scenario declares the gate it tests (an error
   fragment for live submissions, a finding id for audits). A rejection by any other
   gate is recorded as `INCONCLUSIVE — rejected by <gate>`, never PASS.
2. **Mount context is recorded** in `negative-tests.csv` and the journal: stage,
   election status, ballots committed and block height at mount time, live or
   simulated.
3. **Measured repetitions never run attacks.** A campaign forces `skip_attacks`. A
   single election with attacks on is labelled a *security run*; its throughput is
   marked "perturbed — not for RQ3" in `perf.csv` and the UI.
4. Earlier on-chain security verdicts produced through the post-close path are
   re-run once this lands; offline (simulated) verdicts are unaffected.

## 3. Decisions

Defaults taken:

- **The campaign runner reuses `Repeat()` and `RunLadder()` unchanged**, driven
  in-process against the console's own API, so a wizard campaign and a CLI campaign
  on the same config produce the same artifacts and statistics.
- **Concurrency defaults to 128** (the probe's choice under the declared orderer
  parameters), and the form warns when it is below `MaxMessageCount`.
- **The wizard stays the research console** and the admin app (PR #56) stays the
  election-operator demo; they share the API, not the page.

Needing the user:

- **D1. How "during ballots" attacks run.** Recommended: truly pause the lifecycle at
  each stage (election open, submission stopped at the chosen fraction, attacks
  submitted to the live chain, submission resumed). Cheaper alternative: keep
  mounting after the lifecycle and only fix the verdicts, so "before" and "during"
  become labels rather than timings.
- **D2. Infrastructure controls in the browser.** Recommended: build "Reset network
  for this tier" (runs `tools/tier.sh`) and "Restart the peer mid-submission" (T3)
  behind admin + loopback + a typed confirmation, refused while anything is running.
  Alternative: keep those two as terminal steps in the instructions.

## 4. Console API (new, all admin-only, all added to the auth role table)

| Route | Purpose |
|---|---|
| `GET /api/preflight` | One report: Fabric reachable, peer and channel; declared orderer batch parameters; ladder status for this build; free disk against the tier's projected ledger bytes; host load average and CPU count; verifier threads; warnings with a severity (`block` or `warn`). Recorded into every campaign |
| `POST /api/ladder`, `GET /api/jobs/<id>` | Run the validation ladder in-process as a job; poll progress |
| `POST /api/campaigns` `{config, warmups, reps, sweep?, window_s?, burst?, force?}` | Start a campaign (reuses `Repeat`). Refuses on a `block` preflight warning unless `force`. Forces `skip_attacks` |
| `GET /api/campaigns`, `GET /api/campaigns/<id>` | List; status with a row per repetition (run id, kind, status, TPS, p99, failed, reason) and the parsed `summary.csv` when done |
| `POST /api/campaigns/<id>/cancel` | Cancel after the current repetition |
| `GET /api/campaigns/<id>/export` | A zip of the thesis artifacts for every run (`run.json`, `perf.csv`, `correctness.csv`, `negative-tests.csv`, `summary.csv`, journal line 1, preflight snapshot). The same file set the desktop-run notes copy |
| `ElectionConfig.attack_plan` `{stages: [...], ballots_at: 0.5}` (D1) | Single election only. The lifecycle pauses at each listed stage, runs that stage's scenarios with gate-matched verdicts, and continues |
| `POST /api/network/reset` `{voters, positions, confirm: "RESET"}` (D2) | Runs `tools/tier.sh`; refused while busy; the console reloads its Fabric identity afterwards instead of needing a restart |
| `POST /api/runs/<id>/fault` `{kind: "peer-restart", at: 0.5, down_s: 30}` (D2) | Security runs only; stamps the fault in the journal; the run then resumes or verifies-only as today |

Existing and reused: `POST /api/runs/<id>/resume`, `POST /api/runs/<id>/verify-only`.

## 5. Wizard changes (`web/wizard.html`)

- A mode switch: **Single election** (explore, attacks, trail) and **Measurement
  campaign** (repetitions, no attacks).
- A preflight panel above the form: green / amber / red rows, red blocks Start.
- "Ballots in flight" defaults to 128, with the orderer rule shown inline.
- Tier presets become the thesis run table (SP-1K … MP-3.5M), each filling voters,
  positions and the table's warm-up and repetition counts.
- Campaign view: live repetition table, summary table when done, Cancel, Export.
- Attack timeline editor for single elections: a checkbox per stage labelled before /
  during / after, the "during ballots" fraction, Skip all.
- Infrastructure panel (D2): Reset network (typed confirmation), Restart peer mid-run,
  Resume, Verify-only.
- A runs list with status, resume and export.
- A sign-in box when `GET /api/me` returns 401.

## 6. Instructions

- Runbook §10 **"Running the study from the wizard"**: bring-up, open `/wizard`,
  preflight, ladder, then per tier: reset network, measurement campaign, security run
  with the attack timeline, export; capstones with resume; what to hand to the cost
  model and the Chapter 4 notes; what not to do during a run (other heavy programs,
  sleep, closing WSL).
- `saksi/docs/study-checklist.md`: one page, a checkbox per tier row.
- The wizard links to both.

## 7. Tasks

| # | Task | Model | Reviewer | Depends |
|---|---|---|---|---|
| W0 | Merge PRs #42 (auth) and #56 (admin app) | — | done | user go |
| W1 | Attack timeline with pause points (D1), gate-matched verdicts, mount context columns; re-run guidance for old on-chain verdicts | executor (Opus) | final-reviewer (Opus) — study validity | W0 |
| W2 | Preflight, ladder job, campaigns (reusing `Repeat`), campaign export; routes in the role table | executor (Opus) | final-reviewer (Opus) — measurement path | W0; parallel with W1 (separate worktree, rebase whichever lands second) |
| W3 | Network reset + identity reload + peer-restart fault (D2) | executor (Opus) | final-reviewer (Opus) — shelling out from HTTP | W2 |
| W4 | Wizard UI (§5) | executor (Opus) | reviewer (Sonnet) | W1, W2, W3 |
| W5 | Runbook §10 + study checklist (§6) | executor (Opus) | reviewer (Sonnet) | W4 |
| W6 | Validation through a real browser on the WSL network: an SP-1K campaign (2 + 3 reps) whose medians match a CLI `--repeat` of the same config within 5 %; one on-chain single election with the full attack timeline where every attack is rejected by its declared gate; the export bundle loads in `cost_model.py` | executor (Opus) | controller | W4, W5 |

The WSL network is shared: W6 waits until no other measurement is running there.

## 8. Limits stated up front

- The console still runs one campaign at a time on one network.
- "Reset network" destroys the ledger for the tier; the export bundle is the record.
- Security runs perturb timing by design; their throughput never enters RQ3.
