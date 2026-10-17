# Screen recording checklist: the 12-minute defense demo

Source of truth for the flow: section 2 of the defense demo scope note (kept with the manuscript, outside this repo). The recording is the fallback if Fabric misbehaves on the day. Fallback order: **the recording first, the Appendix B stills (B-01 to B-26) second.**

## Before you press record

1. In WSL on the desktop: `tools/demo-up.sh --saksi <saksi checkout> --reset --build-web --seed`. It prints the run id and every URL below.
2. Note the run id (`mp-1k-demo-...`). Replace `<id>` below with it. Base URL is `http://127.0.0.1:8090` unless you passed `--port`.
3. Two browser windows (or two laptops) for trustees 1 and 2. A third sign-in for trustee 3 is done in one of them later.
4. Trustee and admin logins: the accounts in the users file the console was started with (`SAKSI_AUTH_FILE`; format in `docs/updates/2026-09-14-admin-auth-smoke.md`): `trustee1`, `trustee2`, `trustee3` (each bound to its own trustee id) and `admin`. If the console runs without an auth file there is no sign-in screen; skip the sign-in clicks.
5. Resolution matches the projector. Hide bookmarks and notifications. Start the recorder.

## Steps

1. **Admin, 2 min.** Open `/admin/`. Sign in as `admin`. The Elections list is the landing page: click Open on the MP-1K demo row (seeded: 1,000 voters, 3 positions, 4 candidates, realistic). The population check runs on its own and passes. Click "Next: run the election", then "Encrypt and record" (the button shows "Recording on-chain..."; wait for the progress bar to finish), then "Next: trustee ceremony". (To show creation live instead: "New election", enter the same numbers, "Create election".)
2. **Board, 1 min.** Open `/board/?run=<id>`. Tally reads "pending", record count shown, nothing decrypted. Say: the chain holds ciphertexts only.
3. **Trustees, 3 min.** Window A: open `/trustee/?run=<id>&trustee=1`, sign in as `trustee1`, click "Submit Partial Decryption", then "Confirm submission". Window B: `/trustee/?run=<id>&trustee=2`, sign in as `trustee2`, same two clicks. Back in `/admin/`: "Publish the tally" is greyed out and the chip reads "Awaiting shares" (2 of 5 is below the threshold of 3; nothing is refused on screen). Open `/trustee/?run=<id>&trustee=3`, sign in as `trustee3`, same two clicks. In the admin the chip reads "Threshold reached" and "Publish the tally" enables; click it.
4. **Board again, 2 min.** Reload `/board/?run=<id>`. Results flip to verified; show the integrity summary (records, verified, rejected, turnout, fingerprints) and the verifier check list, every row green. In the tracking-code box paste a real code in the form `BC-XXXX-XXXX` (from `ballots.csv`, below) and look it up: found. Then enter `BC-0000-0000`: not found (confirm once that it is absent from the run before recording). Anything not in `BC-XXXX-XXXX` form is rejected as "Not a tracking code" before the lookup.
5. **Wizard, 3 min.** Open `/wizard`. In the attack timeline stop at the `ballots` stage, click "Run all attacks at this stage" (rehearse once and note which attack rows you want to show), and watch the gate refuse them and the verdicts land in the negative-tests table. Optional: trigger the T3 fault, then Resume.
6. **Voter app, 1 min, labelled a prototype.** Phone or emulator: onboarding, sign-in, ballot steps, review, submit, tracking code. Say plainly that this client is the design prototype and the live election's ballots came from the study generator (Chapter III says the same). Then tap 'Verify on the public board', enter the run id and a BC-XXXX-XXXX code from ballots.csv: found. Run the app with `flutter run` (debug; the release manifest has no INTERNET permission) and `--dart-define=BALOTA_BULLETIN_URL=http://10.0.2.2:<port> --dart-define=BALOTA_RUN_ID=<id>` on an Android emulator on the desktop (10.0.2.2 is the host loopback, which reaches the console in WSL through localhost forwarding). A physical phone needs the console bound to a LAN address and a Windows port proxy; untested.

## Where the tracking codes are (ballots.csv)

`~/.saksi/campaign/runs/<id>/ballots.csv`, column `nullifier` (`demo-up.sh` prints the path). The tracking code is `BC-` plus the first 8 hex characters of the nullifier, upper-cased and split 4-4 (for example `BC-1A2B-3C4D`). `receipts.csv` holds transaction receipts, not codes. Test one code on the board before recording.

## After

Save the recording and a copy of the run folder's `export` to the USB stick together with the Appendix B stills. Write down the saksi and balotachain commit ids shown in the console banner/git log.
