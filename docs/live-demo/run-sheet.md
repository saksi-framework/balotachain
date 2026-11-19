# Run sheet: the live election

About 5 minutes of talking. One browser window, seven pinned tabs: Cmd+1 Presenter,
Cmd+2 to Cmd+6 trustees T1 to T5, Cmd+7 Board. The phones use
`https://vote.vancornelio.dev:8443/vote/`, always with the port.

Voters have no accounts. They are the rows of one precinct's voter list, which the
presenter uploads at setup, and each one checks in on a phone the way a voter checks in at
a precinct. The contract for the list and the check-in is saksi
`docs/live/voter-list-api.md`. The sentences quoted below in double quotes are the pages'
own words, read from the code (`apps/vote` as of commit `1e72d06`, checked again on
2026-11-17 against the working tree of a later fix round; `apps/admin` as of `dc9393f`;
the sentences changed by the fixes after rehearsal 3 (Task 13b), by the final review
fixes and by the fixes after rehearsal 4 are read from those commits). A later fix may change a sentence, so check them at
the rehearsal. Tags such as D13 name decisions in the plan, kept outside the repository.

## Before the demo: the voter list file

The repository carries `docs/live-demo/sample-voter-list.csv`: 17 fictional voters. Every
row is invented, as its first line says. The real file adds the three members and is kept
only on the Mac, in the kit's state folder, never in a repository.

1. Copy the sample into the state folder:

   ```
   cp docs/live-demo/sample-voter-list.csv ~/.balotachain-live/voter-list.csv
   ```

2. Open `~/.balotachain-live/voter-list.csv` in a plain-text editor: TextEdit in
   plain-text mode (Format, Make Plain Text), or any code editor. Not Numbers or Excel:
   they turn `1990-01-01` into a date cell and save it in the locale's own form, and every
   row is then refused as a bad date. Add one row for each member at the end, in the same
   form as the other rows:
   `last_name,first_name,middle_name,date_of_birth`. The middle name may be left empty
   (two commas in a row). The date is `YYYY-MM-DD`.
3. Each member chooses a **made-up date of birth** that they will remember, not their real
   one, and that date goes in their row. The reason: here a typed date of birth is only a
   lookup key, not a secret, and the console answers a right guess differently from a wrong
   one, so a real date could be confirmed by guessing through the lookup.
4. Save it as plain text in UTF-8 (TextEdit's default for a plain-text file; a code
   editor's too). The presenter page refuses any other encoding with
   "The file is not UTF-8. Save it as CSV UTF-8 and choose it again."
5. Make it readable by you only:

   ```
   chmod 600 ~/.balotachain-live/voter-list.csv
   ```

   `tools/live-up.sh` checks this mode and stops if others can read the file. No script
   reads the file or prints it.
6. The file stays in the state folder. Do not copy it into a repository, a report, a
   chat or a screenshot. The upload at setup is the only time it leaves the folder.

Rules the console applies to the file: at most 200 rows (a precinct's cap, RA 8189
Sec. 6), at most 64 KiB, the exact header, letters, spaces, hyphens, periods and
apostrophes in names, a real date from 1900 and not in the future, no two rows with the
same last name, first name and date of birth. Lines that start with `#` are comments.

## Before the panel arrives

- [ ] The night before, with Docker Desktop running: run `tools/live-up.sh status`. If the
      election line shows a state other than verified or abandoned, or you want a clean
      console, run `tools/live-reset.sh`. The rule, the same as the script's own note:
      reset is needed when an election is left in a state it cannot be finished or
      abandoned from (open with the voters gone, or closed and stuck), or to start with no
      election; after a verified or abandoned election, "Set up the next election" (on an
      abandoned one, the Next election form already open on the presenter page) is enough.
      Abandon is offered only before voting opens, so an election left open cannot be
      ended from the presenter page.
- [ ] On the day: start Docker Desktop and confirm Fabric is running (`tools/live-up.sh
      status` lists the three Fabric containers as running).
- [ ] Join the Mac to the hotspot, then the members' phones.
- [ ] Keep the Mac on power with the lid open for the whole demo, and run `caffeinate -dis`
      in a terminal and leave it running: it keeps the display and the Mac awake while on
      power. `caffeinate` does not stop sleep when the lid closes (the Mac slept during
      rehearsal 2, and again with the lid closed on 2026-11-17).
- [ ] Clear the site's data on every phone used at the rehearsal (README, A second run).
- [ ] `tools/live-dns.sh` on the hotspot, then `tools/live-up.sh`: it prints the seven tabs
      and the precinct, and warns if `~/.balotachain-live/voter-list.csv` is missing.
- [ ] Answer Allow if the macOS firewall asks about `saksi-campaign`.
- [ ] Open the seven tabs in one browser window, in this order: Presenter, T1 to T5, Board
      (Cmd+1 to Cmd+7).
- [ ] Sign in on the Presenter tab as `ban`, and on T1 to T5 with `trustee1` to `trustee5`.
      A console or trustee restart ends these sessions; sign in again after one.
- [ ] Members open `https://vote.vancornelio.dev:8443/vote/` on their phones. Nobody signs
      in. Before voting opens the phone reads "Voting has not opened yet" with "Keep this
      page open. The check-in opens by itself when the election officer opens voting."
- [ ] One tab per phone. A second tab on the same phone is refused.
- [ ] Zoom (D18): from the back row, Cmd and + on the Board tab until the band can be read.
      Zoom is kept per site, so the Presenter tab on the same address zooms with it.
- [ ] The Board tab shows "No election is running".
- [ ] The election must be new (see the operating rules): the console has no election
      yet, or its last election is verified or abandoned (see the night-before check
      above). "Set up the next election" makes a new one only after a verified or abandoned
      result, and Abandon is offered only before voting opens; an election left open, or
      closed and stuck, is cleared with `tools/live-reset.sh`.

## The election to type at Setup

Plain letters only (D19). The form shows the id next to each name. The candidates below
are plainly fictional examples; the real candidate names for the defense are typed at
setup from the presenter's own private note and are not kept in the repository.

- Title: `BalotaChain Demo Election`
- `President` (id `President`): `Juan dela Cruz` (`Juan-dela-Cruz`), `Maria Clara`
  (`Maria-Clara`), `Andres Malaya` (`Andres-Malaya`)
- `Vice President` (id `Vice-President`): `Crisostomo Ibarra` (`Crisostomo-Ibarra`),
  `Pedro Penduko` (`Pedro-Penduko`), `Gabriela Silang` (`Gabriela-Silang`)

## Setup: the voter list step

The Setup form has a "Voter list" step after the positions, before Create election.

1. Before a file is chosen the step reads "The precinct's list as a CSV file. The console
   reads it and shows it here; nothing is kept until the election is created." and "No
   file chosen." It does not name the precinct yet: the console sends the precinct with
   the preview of a file, and no earlier answer carries it.
2. Press "Choose the CSV file" and choose `~/.balotachain-live/voter-list.csv` (in the
   file dialog, Cmd+Shift+. shows the hidden folder, or Cmd+Shift+G and type the path;
   both keys to check at rehearsal). The step now names the precinct: "Precinct 0001A
   (demonstration)". The word "demonstration" is always attached; the precinct number is
   made up.
3. The console reads the list and the page shows the preview: number, last name, first
   name, middle name, and the date of birth only as "Valid" or "Not valid", never the date.
   It says how many voters are on the list. The table shows every row and grows with the
   page (no scrolling inside it). Each error is shown with the console's sentence and the
   file's line, and names the table row on that line when there is one, for example "Line
   13 (No. 11 in the table): ..."; that row's number is marked with the alert icon. A list
   with any error cannot be confirmed: the page reads "The list has 1 error, so it cannot
   be confirmed. Change the file and choose it again." (or "N errors").
4. The page shows "List fingerprint:" with the first 16 hex digits and "Show the full
   fingerprint". Say: "This is a SHA-256 of the precinct and every row. Anyone with the
   file can compute it again; one changed character gives another fingerprint."
5. Press "Confirm the list". The page reads "Confirmed: N voters, fingerprint
   ...". The console locks the list when the election is created; after that no row can be
   added or changed.
6. Press Create election. The election is not created unless the list is valid and has the
   fingerprint the presenter confirmed. Pressed before the list is confirmed, the step
   reads, once, "Confirm the voter list before the election can be created." and the
   sentence goes once the list is confirmed.

The board then shows the precinct, "Voters on the list: N", "Checked in: 0", "Credentials
issued: 0", the list fingerprint, and "The list is kept by the election console. It is not
written to the ledger." The board never shows a name.

## The beats (D13)

| Beat | Presenter does | Tab on the projector | Phones | What the panel should take from it |
|---|---|---|---|---|
| Before the panel | starts the stack | Board (Cmd+7): "No election is running" | the page open, "Voting has not opened yet" | nothing yet |
| Setup | positions, Voter list, Create election | Presenter (Cmd+1) | waiting | the election and its voter list start from nothing; the list is sealed |
| Key ceremony | Join on T1 to T5 | T1 > T2 > T3 > T4 > T5 (Cmd+2 to Cmd+6), then Board ("5 of 5", the key appears) | waiting | no one holds the key alone |
| Voting | the desk on the Election-day list | Presenter (Cmd+1) during check-in, then Board (Cmd+7): the counts climb | check in, sign, then credential, ballot, tracking code | a voter is found on the list, confirmed in person, signs, and only then gets one ballot |
| Impersonation | Refuse (attempt 1) | Presenter (Cmd+1) | the two attempts below | a name cannot be used twice, and the Board confirms the person |
| Close | Close voting, with the confirm | Presenter (Cmd+1) | a phone that voted keeps its receipt; one that sent nothing shows "Voting has closed" | the count is final |
| Threshold | Demonstrations, "Publish with 0 of 3 signatures", before any Decrypt | Presenter (Cmd+1) | idle | no operator, the console included, can publish a result without the trustees |
| Decrypt | Decrypt on three tabs, nothing else: each process then signs by itself | T1 > T2 > T3 (Cmd+2 to Cmd+4) | idle | the threshold is real |
| Result | nothing to press: the console publishes and verifies by itself | Presenter (Cmd+1), then Board ("Result verified", and only then the totals) | idle (a phone's Verify shows "Counted") | the result was checked before it was announced |
| Check codes | hands over | Board (Cmd+7) | members type their tracking codes | anyone can check their own ballot |

## Voting: the check-in, one member at a time

When voting opens, each phone moves by itself to "Check in at Precinct 0001A
(demonstration)". For each member:

1. **Find.** The member types last name, first name and the made-up date of birth (month,
   day and year in three boxes) and presses "Find my name".
2. **Declaration.** The phone reads "Your name is on the list" with the name and the
   sequence number, and the declaration: "I declare that I am NAME, the voter named on
   this precinct's list, and that I have not yet voted in this election." followed by the
   Omnibus Election Code sentence and "This is a demonstration election modelled on that
   rule." The member ticks "I make this declaration." and presses "Send to the Electoral
   Board".
3. **The desk.** The phone reads "Waiting for the Electoral Board" and "Go to the
   Electoral Board's desk. They see your name on their list and confirm who you are." On
   the Presenter tab, the Election-day list shows the name under "At the desk" in large
   type (28 px, the top of the type scale). The presenter, acting as the Electoral Board,
   looks at the person and presses Approve. The page reads "Approved NAME." and the row
   reads "Approved, waiting for the signature". The counts above the list read "Checked
   in (signed the list): k of N" and "Approved, not signed: a", both the console's own
   counts: a voter counts as checked in once they sign.
4. **Signature.** The phone reads "Sign the election-day list". The member draws a
   signature and presses "Sign the list". A member who cannot sign presses "I cannot
   sign": the phone asks once, on the same screen, "The Electoral Board will record on the
   list that you could not sign. You then get your ballot." with "Yes, record that I
   cannot sign" (usable after a moment) and "Back to the signature". Only the "Yes" sends
   it; the list then reads "Cannot sign (recorded)" in the signature's box, as a precinct
   records a thumbmark. The signature appears next to the name on the presenter's list. "Signed" is
   on the list for about a second at most: the phone starts the credential at once, so the
   row usually goes from "Approved, waiting for the signature" straight to "Credential
   issued".
5. **Credential and ballot.** The phone shows "Get your voting credential" with its five
   steps for about a second, then opens the ballot as before. On the presenter's list the
   status becomes "Credential issued"; on the board "Checked in" and "Credentials issued"
   go up. "Approved NAME." goes from the presenter page as soon as the list shows the
   entry in another status, and after 20 seconds at the latest.

## The impersonation attempts

Run both during Voting. They use the hotspot as usual; each phone is its own address for
the rate limit.

**Attempt 1: a name that is not yours, refused at the desk.** Before member B checks in,
B's phone types the details of a fictional voter from the list (for example `Halimbawa`,
`Uno`, 1 1 1990), ticks the declaration and sends it.

- The presenter page shows "Halimbawa, Uno Pagsubok" under "At the desk". The presenter
  says "This is not the person on the list" and presses Refuse. The page then reads
  "Refused Halimbawa, Uno Pagsubok. The phone's check-in has ended; the voter can check in
  again." and the row reads "Not checked in". That line names the press, not a state: it
  goes as soon as the list shows the entry in another status (for example the phone sends
  the check-in again), at the next Approve, Refuse or Reset, when voting closes, and
  after 20 seconds at the latest. It never stays into Close, the result or the next
  election.
- B's phone reads "The Electoral Board did not confirm your identity." with "If you think
  this is a mistake, see the Electoral Board." B presses "Check in again" and checks in as
  themselves.
- The point: the typed details are not the security. The Board's approval is. The real
  Uno Halimbawa can still check in.

**Attempt 2: a name that has already voted, refused by the list.** After member A has
voted, member C, before checking in, types A's last name, first name and A's made-up date
of birth (A says it aloud; it is not a secret) and presses "Find my name".

- C's phone reads "This voter has already checked in. See the Electoral Board." Nothing
  changes on the presenter's list or the board.
- C then checks in as themselves.
- The point: the list is the ink. Once an entry has checked in, no phone can check in as
  it again, and once its credential is issued there is no reset and no second credential.
  On the ledger, a second ballot with the same credential is refused at the nullifier
  gate (the Demonstrations row "Send a recorded ballot again").

A phone that already holds this election's credential or a receipt does not show the
check-in form (the phone goes to its receipt, or to the ballot, before it looks at the
check-in), so attempt 2 needs a phone that has not checked in yet (or a private browser
window on the laptop). Read from the code; the rehearsal checklist has an item to see it on
a phone.

## Operating rules

- **One presenter tab for the desk.** Approve and Refuse only on Cmd+1, never from a second
  presenter tab or device. The console checks only that the entry is at the desk: if one
  tab refuses a request and the same name is sent again before the other tab reads the
  list again, an Approve pressed on the other tab's older view approves the new request.
- **No reset after a credential is issued.** The presenter's list offers Reset only before
  that ("No reset: a credential was issued."). Reset asks for a confirmation; use it only
  for a phone that lost its check-in before its credential (another browser, cleared
  data). After a reset the presenter page reads "The check-in of NAME was reset. The
  phone's check-in has ended; the voter can check in again.", the phone reads "The
  Electoral Board cleared this check-in. Check in again." and the voter checks in again.
- **A lost credential is not replaced** (as with ink). If a phone fails after "Credential
  issued", that member does not vote; the board then honestly shows one more checked in
  than the ballot records account for (the board counts ballot records, one per position,
  not voters).
- **The rate limit.** Find and declare together allow 12 tries per address, then one every
  10 seconds. A check-in costs two. Over it, the phone reads "Too many check-in tries from
  this connection. Try again in N seconds." At rehearsal 3, three check-ins, one reset and
  check-in again, both attempts and the extra checks used 17 tries in 11 minutes from one
  address without reaching the limit, because the steps are spaced out.
- **Reloading a phone** lands on the screen its state calls for, with one exception: a
  phone reloaded on "Your name is on the list" returns to the empty check-in form, and
  finding the name again costs a rate-limit try.
- **The handout file may still list voter accounts** from before this build
  (`voter1` to `voter5`). Voters have no accounts now; those names open nothing. Hand out
  only the trustee and presenter sign-ins.
- **An election made before this build has no list.** Its phones read "Check-in is not
  possible" and the presenter page "This election was set up without a voter list, so it
  has no check-in desk and no election-day list." Never reuse it: make a new election with
  "Set up the next election" (after a verified or abandoned result) or start from no
  election with `tools/live-reset.sh`. `tools/live-up.sh status` says "no voter list" for
  such an election.
- **The Mac on power, lid open and awake** (`caffeinate -dis`), the whole time.
- **Close only after every phone has finished.** Every member's phone must show its
  tracking code before Close voting. A phone still getting its credential when voting
  closes cannot vote.

## Notes on the other beats

- **Setup.** Create election records on chain. The button reads "Recording on chain…" and
  may take a block wait; do not reload while it does. (Read from the code: at rehearsal 4
  Create took about 3 seconds and the label was not caught on screen.) If it fails with a chain error, the
  card reads "Election made, not yet on chain" with Record on chain: press it once. The
  presenter's stepper moves to Key ceremony as soon as the election is on chain.
- **A second election on the same console** (for example the demo after a rehearsal):
  on the verified result, "Set up the next election" on the Result card opens an **empty**
  Setup form: type the title, the positions and the candidates again, choose the list
  file again and confirm it again. Create makes a new election with a new id and a new
  list. Check-ins do not carry over: a check-in belongs to one election. Seen at
  rehearsal 3: a phone left on its receipt or on "Voting has closed" moves to "Voting has
  not opened yet" within about 2 seconds of Create, and to an empty check-in form when
  voting opens, with no reload; rehearsal 4 saw the same. A phone left on its Verify
  screen ("Check a tracking code") follows too, and its Back reads the console first, so
  it never shows the old election's receipt once the new one exists; the presenter's
  Demonstrations rows, its last Verify again answer and its error lines are cleared when the
  election id changes. Both are fixes after rehearsal 4, read from the code and its tests,
  not yet seen at a rehearsal: if a Demonstrations row still shows an older election id,
  reload the Presenter tab. Clearing every rehearsal phone's site data before the demo
  (README, A second run) is still the safe advice.
- **Close.** Do not close before two voters have each sent every position: decryption
  needs two ballot records per position. An election closed with fewer cannot be
  decrypted or abandoned, and the only way out is `tools/live-reset.sh`. Below that
  count the Close confirm says so first, from the console's own numbers, for example
  "The chain holds 2 ballot records; decryption needs at least 4. An election closed now
  cannot be decrypted or abandoned: the only way on is to reset the console with
  tools/live-reset.sh.", and its button reads "Close anyway" instead of "Close voting
  now". If such an election is closed anyway, the presenter page reads "Cannot be
  decrypted" with "This election was closed with 2 ballot records on the chain;
  decryption needs at least 4. It cannot be decrypted, and once voting has opened it
  cannot be abandoned. Reset the console to start the next election:
  tools/live-reset.sh", and its stepper shows Decrypt as "cannot run" and Result as "not
  run", with no step current. The board's band and Results read "This election was
  closed with 2 ballot records, and decryption needs at least 4, so it cannot be
  decrypted. No result will be published for it." `tools/live-up.sh status` adds
  "closed with 2 ballot records, decryption needs at least 4: it cannot be finished, run
  tools/live-reset.sh" to the election line. (The fixes after rehearsal 5, read from the
  code and its tests, not yet seen at a rehearsal; the numbers are the console's.)
  A phone that has voted keeps showing its receipt; nothing on a complete
  receipt changes at Close (rehearsal 4 compared its text before and after). A phone that sent part of
  its ballot shows its receipt with "Voting has closed. The missing positions cannot be
  sent." Only a phone that has sent nothing shows the "Voting has closed" screen.
- **Decrypt.** Each trustee process refuses to decrypt a position with fewer than 2 ballot
  records, so at least two members must have voted. Peers that decrypted read "Same
  ballots". With fewer ballot records on the chain than decryption needs, the trustee
  page offers no Decrypt and says so in one sentence from the process's two numbers (the
  console's count and the minimum), adding that the election cannot be decrypted and the
  presenter has to reset the console; a Decrypt pressed anyway is refused in the
  process's own sentence ("N ballot records are on the chain; decryption needs at least
  M. …"). Such an election stays `closed`; only `tools/live-reset.sh` clears it. (The
  fixes after rehearsal 4, read from the code and its tests, not yet seen at a
  rehearsal.)
- **Decrypt and the result: one press per trustee.** The closing sequence is Close
  voting, the threshold demonstration (Demonstrations, below), then Decrypt on T1, T2 and
  T3. Decrypt is the last press. Nobody presses Sign tally and nobody presses Verify:
  1. After its Decrypt, each trustee tab's step "Tally signature" reads "No press is
     needed." and, until three trustees have decrypted, the page's own sentence from the
     process's count, for example "Waiting for 3 trustees to decrypt (the process last
     counted 2). This trustee then signs by itself, once its own count is ready." (seen at
     rehearsal 7 with "(2 so far)", the wording before this fix). The count is the
     process's and can lag its own share by one poll. Once that count reaches 3 the tab
     reads "Enough trustees have decrypted (the process last counted 3 of 3). This trustee
     process is combining their partials and signing by itself." The trustee's own row
     reads "Waiting". There is no button.
  2. Once three trustees have decrypted, each of those three processes combines the
     partials into its own count and signs it by itself: the tab lists the totals, reads
     "This trustee's own count gives the totals below. The process is signing them and
     posting the signature by itself. No press is needed.", and the own row reads
     "Signing…". A tab says "Signed" only once its process reports the signature posted:
     then "Tally signed" with "This trustee's signature is recorded. The console
     publishes the result by itself when 3 signatures are held.", which becomes "...
     The console reports the tally published." or "... The console reports the result
     verified." as soon as the process reads that state (one poll later than the board).
  3. The console publishes at the third signature. The Presenter's Decrypt card reads
     "Waiting for the trustee processes to sign the totals by themselves." while the
     signatures arrive, then moves to Result. Never wait for a 4th or 5th trustee; their
     tabs then read "Tally published" with "Tally signature" "not needed" and "This
     trustee did not decrypt this election, so no signature from it is needed." A trustee
     that did not press Decrypt never signs.
  4. The console then verifies by itself, usually within the same poll: `tallied` passes
     too fast to see. At rehearsal 7 the presenter went from "The console is publishing
     the result on chain." straight to "Result verified" in one election, and showed
     "Verifying the result on the chain…" (no button, tracker "checking") for one poll in
     the other. Each trustee tab reads "Tally published", whether the published tally
     equals its own count, and "The console checked the published result on the chain:
     verified." once the console reports it.
  Timings, to measure at rehearsal: from the third Decrypt to the tally on the chain
  (expected seconds: one 2 s poll plus the trustee's ops and one `PublishTally` block),
  and from publication to "Result verified" (expected a few seconds; the console gives
  up after 2 minutes).
- **If the automatic signature fails.** A passing cause (the console not answering or
  answering 5xx, the chain not readable) is retried by the process itself, at most 3
  attempts, each with every check: the tab reads "The signature could not be posted
  (attempt 1 of 3). The process tries again by itself." with the process's own words, and
  no button: wait. While the console does not answer at all and no attempt has failed
  yet, it reads "The console is not answering, so this trustee's signature is not posted
  yet. ..." instead. Only after the third failed attempt, or at once for a cause a retry
  cannot cure (another refusal of the post, `sign-tally` failing), the tab shows the
  process's reason in red and, under it, "The automatic signature was not posted. Sign
  tally tries again, with every check, over the totals below." with a Sign tally button:
  press it once on that tab (a press starts up to 3 attempts again). The button appears
  only while the election is `closed`. An alarm (for example the console's totals differ
  from the trustee's own count) blocks the step with the alarm's own sentence and no
  button: stop and investigate; never press around it.
- **If the verification fails or gives no verdict.** The Presenter's Result card reads
  "Result NOT verified" (with the failed checks after a press) or "Not verified yet" with
  "The automatic check gave no verdict: <the console's reason>", and offers **Verify
  again**: press it once. A console restart at `tallied` with no verdict starts the
  check again by itself.
- **Result.** The Result card reads "Result verified" and offers "Set up the next
  election". Do not press it during the talk. The board shows no totals and no
  "ELECTED" before the result is verified: at `tallied` its band reads "Result published,
  checking" and the Results card, marked "published, checking", reads "The result is
  published on the chain and is being checked. The totals appear here once the check
  passes." with the positions and candidates by name only. At `verified` the totals and
  "ELECTED" appear (the fix after rehearsal 4, read from the code and its tests). The
  presenter's Result card shows the totals already at `tallied`, above "Verifying the
  result on the chain…". Keep the projector on the Board: since `tallied` usually passes
  too fast to see (rehearsal 7 never showed "Result published, checking" on the board),
  the board changes once, from "Voting is closed" to "Result verified" with the totals.
  A tie is reported as a tie and no winner is marked: with a tied race the board says
  the cut is not decided and that the race awards nothing, and shows no "ELECTED" for it
  (rehearsal 7, election B, two voters, tied on both positions).

## Demonstrations (D14)

On the presenter page, the collapsed section "Demonstrations: requests the chain should
refuse".

- **The two ballot rows** ("Send a recorded ballot again", "Send a ballot with one byte
  changed"): during Voting, after at least one member has voted. Expected: refused at the
  nullifier gate, and refused at a proof gate. Observed at rehearsal 1: refused at
  `cds`, "CDS well-formedness proof failed: CDS challenge sum does not match Fiat-Shamir
  total". The row shows the chain's reason and that the ballot record count did not change.
- **The publish row:** press it right after Close, before any trustee presses Decrypt,
  when it reads "Publish with 0 of 3 signatures". Under the button it says what it sends:
  "Sends a tally that no trustee signed, with zero for every contest: no totals exist
  before the trustees decrypt. The chain's threshold check should refuse it: nobody, the
  console included, can publish a result without the trustees." Expected: refused at
  `threshold`, "tally for election "<id>" carries no trustee signatures" (the console's
  route was changed for this; to see at rehearsal). The old moment, with 2 of 3
  signatures, no longer exists on screen: the trustee processes sign by themselves
  within seconds of the third Decrypt, and the console publishes at the third
  signature. The row is on from the close until 3 signatures are held; if the count
  changed between the last read and the press, it sends nothing and says so, and the
  button names the new count.
- **"The chain accepted this. Stop the demo."** means stop the demo. So does "The chain
  accepted a tally that no trustee signed. Stop the demo." on the publish row.

## If something goes wrong

- **A failed check** (D8): the board's band reads "Result NOT verified" with the number
  of failed checks, for example "1 check failed" or "2 checks failed". Say: "The board says the result is not verified and lists which check
  failed. A result that does not check out is never shown as verified."
- **A silent chain** (D8): the band reads "N ballot records in the console's record" and
  "The chain did not answer. This count is not from the chain. Trying again every few
  seconds." Wait for the board to recover by itself.
- **A member's details are not found** ("No voter with these details is on this
  precinct's list. Check the spelling or see the Electoral Board."): check the spelling
  and the made-up date. The sentence never says which field was wrong, on purpose: a
  wrong date for a real name and a name not on the list get the same sentence, word for
  word (seen at rehearsal 3).
- **A phone lost its check-in before its credential** (another browser, cleared data):
  Reset that entry on the presenter's list, and the member checks in again.
- **A voter whose position stays "Not confirmed"** goes to an officer. There is no spare
  account and no second credential.
- **Do not open an older run with `?run=`** to show a verified result. Only the current
  election is the demo.
- **Abandon** is only possible before voting opens.
- **The phones cannot reach the Mac:** run the voter step on the laptop, in the vote app at
  the same address, one browser profile or private window per member (the credential, the
  receipt and the check-in live in that browser's storage and cookie). All of them reach
  the console from the Mac's one address, so they share one rate-limit bucket: 12 tries,
  then one every 10 seconds. Three check-ins and the two attempts use about 10 (rehearsal 3
  bears this out: 17 tries spread over 11 minutes stayed inside it); type carefully, and
  after a refusal wait the seconds the phone names.
- **Nothing works:** play the backup recording made at the rehearsal.

## Answers to likely panel questions

- **What is not modelled?** No photo and no biometrics: the Board confirms the person by
  looking at them. No indelible ink: the list's check-in state and, on the ledger, the
  nullifier do its work. No registration: the list arrives ready, and registration is not
  modelled.
  One precinct only. The Electoral Board is one presenter, not three members.
- **Where does the list fingerprint live, and why is it not on the ledger?** The console
  keeps the list and its fingerprint in the election's private folder, and the board shows
  the fingerprint. It is not written to the ledger because the chaincode is the artifact
  Chapter IV measured, and it was not changed for this demo. Anyone holding the CSV and the
  precinct value can compute the fingerprint again and compare it with the board.
- **Is a typed date of birth the security?** No. It only finds the row. The security is
  the Board's approval at the desk: the presenter looks at the person and approves or
  refuses, as the Poll Clerk does. That is why the members' dates are made up.
- **Can the console link a voter to a ballot?** The credential is blind: the console
  learns which list entry received a credential, never which ballot it signs, and the
  ballot relay never sees the check-in cookie. One limit, said openly: the presenter can
  see when an entry got its credential, and the board shows when a ballot arrived, so with
  very few voters the timing can link them. A real precinct has the same property at the
  ballot box: the Board sees who walks to the box and when.
- **What is the declaration based on?** The Omnibus Election Code, Sec. 261(z)(2) (voting
  more than once, or voting while not registered) and Sec. 261(z)(3) (voting in
  substitution for another), with the penalty in Sec. 264: one to six years of
  imprisonment without probation, disqualification from public office and loss of the
  right to vote. The Code governs elections of public officers (Sec. 2), so the
  declaration states the law for public elections and does not claim it applies to this
  demonstration; the phone says "This is a demonstration election modelled on that rule."
- **Why a list of 200 at most and a number like 0001A?** RA 8189 Sec. 6 caps a precinct at
  200 voters, and Sec. 26 gives the shape of a precinct number. The number here is made up
  and always shown with "(demonstration)".

## Honesty lines (say them)

- This is a later build, not the study build.
- Five processes on one laptop, not five independent trustees: the trustees run as
  separate processes on one laptop, so custody is simulated, as Chapter III states.
- The phones do the voter-side cryptography for real.
- Shares between trustees are relayed by the console but masked under each recipient's key.
- The voter list has 17 fictional voters and the three members; the members' dates of
  birth are made up.

## After

1. `tools/live-dns.sh --remove` (it asks for the word REMOVE), then delete or roll the
   Cloudflare token in the Cloudflare dashboard and delete `~/.secrets/cloudflare.token`
   (README, After).
2. The run folders hold each election's list (with the dates of birth), check-in state and
   the members' drawn signatures in their `private/` folder. Stop the kit and set them
   aside with:

   ```
   tools/live-reset.sh --yes
   ```

   It runs `tools/live-up.sh down` and moves `runs/` and `trustees/` into
   `~/.balotachain-live/archive/<UTC time>/`.
3. Delete the archive and the real list:

   ```
   rm -rf ~/.balotachain-live/archive ~/.balotachain-live/voter-list.csv
   ```

4. The passwords in `~/.balotachain-live/handout/passwords.txt` were given out at the
   defense. Nothing above changes them. Before the kit is used again, run
   `tools/live-accounts.sh --force`: it moves the old accounts and handout into
   `archive/` and makes new passwords; delete that archive as in step 3.
