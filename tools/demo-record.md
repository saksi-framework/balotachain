# Screen recording checklist: the 12-minute defense demo

Source of truth for the flow: `docs/paper/review/DEFENSE-DEMO-SCOPE.md` section 2. The recording is the fallback if Fabric misbehaves on the day. Fallback order: **the recording first, the Appendix B stills (B-01 to B-26) second.**

## Before you press record

1. In WSL on the desktop: `tools/demo-up.sh --saksi <saksi checkout> --reset --build-web --seed`. It prints the run id and every URL below.
2. Note the run id (`mp-1k-demo-...`). Replace `<id>` below with it. Base URL is `http://127.0.0.1:8090` unless you passed `--port`.
3. Two browser windows (or two laptops) for trustees 1 and 2. A third sign-in for trustee 3 is done in one of them later.
4. Trustee and admin logins: the accounts in the users file the console was started with (`SAKSI_AUTH_FILE`; format in `docs/updates/2026-09-14-admin-auth-smoke.md`): `trustee1`, `trustee2`, `trustee3` (each bound to its own trustee id) and `admin`. If the console runs without an auth file there is no sign-in screen; skip the sign-in clicks.
5. Resolution matches the projector. Hide bookmarks and notifications. Start the recorder.

## Steps

1. **Admin, 2 min.** Open `/admin/`. Sign in as `admin`. Click Elections, then the MP-1K demo election (seeded: 1,000 voters, 3 positions, 4 candidates, realistic). Click the population check; it passes. Click Start ceremony. (To show creation live instead, click New election, enter the same numbers, Create; generation takes a short wait.)
2. **Board, 1 min.** Open `/board/?run=<id>`. Tally reads "pending", record count shown, nothing decrypted. Say: the chain holds ciphertexts only.
3. **Trustees, 3 min.** Window A: open `/trustee/?run=<id>&trustee=1`, sign in as `trustee1`, click Submit share. Window B: `/trustee/?run=<id>&trustee=2`, sign in as `trustee2`, click Submit share. Back in `/admin/`, click Publish: refused, 2 of 5 is below the threshold. Open `/trustee/?run=<id>&trustee=3`, sign in as `trustee3`, click Submit share. Click Publish in the admin: succeeds.
4. **Board again, 2 min.** Reload `/board/?run=<id>`. Results flip to verified; show the integrity summary (records, verified, rejected, turnout, fingerprints) and the verifier check list, every row green. In the tracking-code box paste a real code: the first 8 hex characters of a ballot's nullifier, taken from the run's `receipts.csv` (below). Click Verify: found. Then type a wrong code (for example `00000000`): not found.
5. **Wizard, 3 min.** Open `/wizard`. Select the attack-timeline campaign, mount a replay or tamper at the ballots stage, click Run. Watch the gate refuse it and the verdict land in the negative-tests table. Optional: trigger the T3 fault, then Resume.
6. **Voter app, 1 min, labelled a prototype.** Phone or emulator: onboarding, sign-in, ballot steps, review, submit, tracking code. Say plainly that this client is the design prototype and the live election's ballots came from the study generator (Chapter III says the same).

## Where the tracking codes are

`~/.saksi/campaign/runs/<id>/receipts.csv` (one row per SubmitBallot; `demo-up.sh` prints the path). Use the first 8 hex characters of a ballot's nullifier as the code; check the exact column against the header row of that file, and test one code on the board before recording.

## After

Save the recording and a copy of the run folder's `export` to the USB stick together with the Appendix B stills. Write down the saksi and balotachain commit ids shown in the console banner/git log.
