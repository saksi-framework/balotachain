# Rehearsal checklist

Run on the hotspot, with the members' phones, the day before the defense. The phones are
one iPhone 17 (Safari) and two Android phones (Chrome). Android models and versions, to
note at rehearsal: ______________________ and ______________________. Items marked
"expected" were reasoned from the code, not observed; the rehearsal is where they are
observed. Write down what each check showed.

## Bring-up

- [ ] `tools/live-dns.sh` on the hotspot: the check passes on the public resolver and on
      the Mac. (Run before the build: `tools/live-up.sh` stops at the names step on a
      network where the names do not resolve.)
- [ ] `tools/live-up.sh --build` builds the binaries and `dist-web/`, and starts the kit.
      Answer Allow if the macOS firewall asks about `saksi-campaign`.
- [ ] `tools/live-up.sh status`: six processes up, the three Fabric containers running,
      every name resolving to this Mac, the certificate's last day.
- [ ] Phones on the hotspot reach `https://vote.vancornelio.dev:8443/vote/` and show the
      lock (a valid certificate, no warning).
- [ ] The certificate chain on every member phone. Read from the certificate file on
      2026-11-15: it carries the leaf, YE1, Root YE, and ISRG Root X2 cross-signed by ISRG
      Root X1. A phone that trusts ISRG Root X1 should accept it if the server sends the
      whole file. To check at rehearsal on every member phone: the lock shows, no warning.
      - [ ] iPhone 17 (Safari)
      - [ ] Android phone 1 (Chrome)
      - [ ] Android phone 2 (Chrome)

## Live-run checks 1 to 12 (task 5b-2 review)

- [ ] 1. Issuance timing (check-in build): check-in opens only while the election is `open`, and a phone gets its credential only after its list entry is `signed` (found, declared, approved at the desk, signed). Confirm that no phone starts issuance before its signature.
- [ ] 2. Issuance without a check-in: presign and sign answer 403 `no-checkin` (no cookie, an unknown one, or one the Board ended). Check that the phone then reads its check-in again and lands on the screen the check-in calls for, not an account sign-in.
- [ ] 3. Issuance conflicts by code: 409 `not-signed` (the check-in is at the desk or approved) and 409 `already-issued` (the entry has its credential; the phone's sentence starts "This voter's credential was already issued for this election"). Is the classification right on a real run?
- [ ] 4. The ballot answer: the wasm's `tracking_code` and `ballot_fingerprint` must match the console's byte for byte (case, dashes), or every ballot raises the alarm.
- [ ] 5. The verify-code `ballot_fingerprint` must equal the ballot answer's fingerprint for the same record. Otherwise the Verify screen shows a mismatch notice and lost-answer recovery never succeeds.
- [ ] 6. A ballot 429 carries `Retry-After: 1`, and the resend goes through.
- [ ] 7. Real ballot latency on Fabric under 3 phones against the 150 s timeout. The sign op against the 60 s timeout.
- [ ] 8. On Safari and Chrome: the `credentials: "omit"` requests (the election view, the ballot) pass `guard` (an `Origin` equal to the `Host` with `:8443`), and the check-in cookie `saksi_checkin` (`Path=/api/live/`, `HttpOnly`, `Secure`, `SameSite=Strict`) is sent on the `credentials: "same-origin"` routes: the check-in poll, find, declare, sign the list, presign and sign. The ballot never carries it.
- [ ] 9. Two tabs on one phone, on the actual phone browsers: Web Locks present, and the second tab refused with nothing sent.
- [ ] 10. The election view's `params` and `dkg` against `GET /api/live/ledger`: the view is the console's copy, not a read-back from the chain.
- [ ] 11. Lost answer: kill the connection mid-ballot, resend, and see the board-based recovery. Also the 500-after-commit case (shows `already-voted` with no receipt).
- [ ] 12. `abandoned` shown as Not open, and a new election id afterwards. The phone keeps its records under one phone scope (`credential:checkin`, `receipts:<election>:checkin`, `sending:<election>:checkin`); a stored credential that is not the new election's is not used, so the phone should show the new election's check-in when voting opens. Check this on a phone that voted in the old election, with and without clearing the site's data.

## Live-run checks 13 to 21 (task 5c-1)

- [ ] 13. With the members' phones open on the page during `setup` and `ceremony` ("Voting has not opened yet"), when voting opens each phone shows "Check in at Precinct 0001A (demonstration)" by itself. After the member signs the list, the phone starts issuance by itself and opens the ballot. On the presenter's Election-day list each entry reaches "Credential issued" once, and "Credentials issued" on the board equals the number of members who signed.
- [ ] 14. Polling load: 3 phones × one `GET /api/live/election` per 2.5 s while waiting. Check the console's rate limit (5/s, burst 30) is not hit, and that each poll pays for the client's wasm `electionInfo` parse without lag on the slowest phone.
- [ ] 15. A phone locked or the browser backgrounded while waiting: no polling while hidden on iOS Safari and Android Chrome, and one read and a move on when unlocked.
- [ ] 16. Two tabs on a real phone while voting opens: the second shows the "another tab" Enrol error and does not retry by itself.
- [ ] 17. A member who opens the page before any election exists (404): "Voting has not opened yet", then the check-in form by itself once the presenter sets up, the ceremony ends and voting opens.
- [ ] 18. A real interrupted send (drop the hotspot during position 2), then a reload: the receipt shows "Not confirmed", and "Send again" either records it or, if it was committed, is confirmed from the board as Recorded. Include the 500-after-commit case: expect "Not confirmed" to stay, with no false "Recorded".
- [ ] 19. Finish over the real chain: the only new transactions are the missing positions' nullifiers; the board shows both positions with the receipt's fingerprints.
- [ ] 20. The 15 s loading exit ("This is taking longer than usual") on a slow chain read, and that Retry works there. (Voters have no Sign out any more.)
- [ ] 21. The receipt and the `sending:` marker are keyed by election and the one phone scope (`receipts:<election>:checkin`, `sending:<election>:checkin`). After an abandoned run and a new election, check a phone that sent in the old run (with live check 12): it should not show the old receipt for the new election.

## Live-run checks 22 to 29 (task 5c-2)

- [ ] 22. On a real iPhone (Safari), the check-in form with the keyboard open (last name, first name, and the month, day
    and year boxes with the number pad): "Find my name" sits under the fields, not over them, and the focused field is
    not hidden by the keyboard. Repeat on the tracking-code field.
- [ ] 23. The same on a real Android phone (Chrome): the page resizes above the keyboard, and the footer moves into the
    flow. Check whether a toolbar collapse alone ever moves the footer. It should not: the threshold is 120px with a
    field focused.
- [ ] 24. On a phone with a notch or a home indicator, in portrait and landscape: the top bar and footer clear the insets,
    and in landscape the column is centred with nothing under the notch.
- [ ] 25. A member's phone at its largest text setting (iOS Larger Text; Android font size and display size): every screen
    scrolls vertically only, and the ballot's mark stays level with the first line of a name. iOS Safari does not apply
    Dynamic Type to web pages by default, so record the zoom a member actually needs (Safari's "Aa" text zoom scales
    the rem sizes).
- [ ] 26. On the smallest phone among the members (320 or 360px wide): the partly recorded receipt with three actions leaves
    the receipt rows reachable by scrolling, and Send again, Finish my ballot and Verify what is recorded are all
    tappable.
- [ ] 27. Hit areas on a real touch screen: Back, the small Copy, the tracking code's Check, "Open the public board", the
    declaration's tick box, "Clear" and "I cannot sign" each respond to a thumb tap at the edge of their 44px box, and Check never triggers Copy or the other way
    round.
- [ ] 28. VoiceOver (iOS) and TalkBack (Android): when the ballot opens 1.2 s after the credential, and when the waiting
    screen gives way, the reader announces the new screen's heading ("President: choose one", "Getting your
    credential").
- [ ] 29. A real long name from Ban's election content on the members' phones: the top bar shows it whole, wrapped, and the
    names on the ballot, the review and the receipt are never cut.

## Check-in (voter list build)

- [ ] The members' rows are in `~/.balotachain-live/voter-list.csv` with made-up dates of
      birth, the file is mode 0600, and the Setup form's preview shows it with no error.
- [ ] Each member checks in on their own phone: found, declaration, approved at the desk,
      signature drawn (on the iPhone and on an Android phone), then credential and ballot.
- [ ] Impersonation attempt 1 (a fictional name, refused at the desk) and attempt 2 (a name
      that has already checked in, refused by the list), as in `run-sheet.md`. Write down
      what the phone and the presenter page showed.
- [ ] A phone that has voted, reloaded: it lands on its receipt, not on the check-in form
      (`run-sheet.md` relies on this for attempt 2).
- [ ] "I cannot sign" on a phone: one tap only asks ("The Electoral Board will record on
      the list that you could not sign. You then get your ballot."); "Back to the
      signature" returns to the box; "Yes, record that I cannot sign" sends it.
- [ ] The presenter's line after a desk press ("Approved NAME.", "Refused NAME. ...") goes
      once the list shows that entry in another status, at the next press, at Close, and
      after 20 seconds at the latest; it is never on screen with a row that says
      otherwise.
- [ ] The board shows the precinct, "Voters on the list", "Checked in", "Credentials
      issued", the fingerprint (short, then full with Copy) and the console's sentence, at
      projector zoom and on a phone, with no name on it.

## The kit

- [ ] The board opened while the console is stopped (`tools/live-up.sh down`, or stop only
      the console's pid), then the console started again: the board shows its retry
      notice and recovers by itself.
- [ ] Close, then Decrypt on T1, T2 and T3 only, and no other press: the three tabs move
      by themselves from "Waiting" to "Signing…" to "Tally signed", the presenter page
      from Decrypt to "Verifying the result on the chain…" to "Result verified", and the
      board to "Result verified" with the totals. No tab ever shows a Sign tally button
      and the presenter page never shows Verify. Write down what each tab shows.
- [ ] Timings (to measure): from the third Decrypt to the tally on the chain: ______ s.
      From publication to "Result verified": ______ s.
- [ ] A late Decrypt on T4: once after the result is published (the tab reads "Tally
      published", "Tally signature" not needed), and once at the moment of publication
      (T4 decrypting just as the third signature publishes). Write down what the tab
      shows.
- [ ] The Sign tally retry, if a way to cause it is safe at rehearsal (for example the
      console stopped for longer than a poll while a trustee signs): the tab first reads
      "The console is not answering..." with no button, then signs by itself when the
      console is back. Write down whether a Sign tally button ever appeared, and its
      reason.
- [ ] A long press on a trustee button (Join, Decrypt, and Sign tally when offered as a
      retry): one action, not two.
- [ ] One press of "Send a ballot with one byte changed" during Voting. Expected: refused
      at `cds` (observed at rehearsal 1: "CDS well-formedness proof failed: CDS challenge
      sum does not match Fiat-Shamir total"). Write down the gate the console returns;
      the presenter page shows whatever it returns.
- [ ] "Send a recorded ballot again": refused at the nullifier gate.
- [ ] The publish row right after Close, before any Decrypt: it reads "Publish with 0 of
      3 signatures" and says it sends a tally no trustee signed. Expected: refused at
      `threshold`, "tally for election "<id>" carries no trustee signatures", ballot
      records unchanged. Write down the gate and reason the console returns.
- [ ] Board and presenter page at 125% and 150% zoom on the projector.
- [ ] A full run, then `tools/live-reset.sh`, clear the site's data on every phone that
      voted (README, A second run), then a second full run. Also try the shorter path:
      after a verified result, create the next election from the presenter page without
      a reset (the form opens empty: type the title, positions and candidates again, and
      choose and confirm the list file again).
- [ ] Wall time from the first vote to "Result verified": ______ minutes.

## The backup recording

Record the full rehearsal run as the backup video. On macOS (menu names to check at
rehearsal):

1. Press Shift, Cmd and 5. In the bar that opens, choose Record Entire Screen (or Record
   Selected Portion for the browser window).
2. Under Options, choose where to save it, and a microphone if the talk is to be on it.
3. Click Record. Run the demo.
4. Stop with the stop button in the menu bar (or Cmd, Control and Esc). The file is saved
   where Options says (the Desktop by default).
5. Play it back once to check that it has sound and shows the board and a phone's steps.
   A phone's screen can be recorded on the phone itself and kept beside it.
