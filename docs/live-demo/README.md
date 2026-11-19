# Live election demo kit

This kit runs the live election of the thesis defense on one MacBook: Hyperledger
Fabric in Docker, one console process (`saksi-campaign serve --live`) on
`https://vote.vancornelio.dev:8443`, and five trustee processes (`saksi-campaign trustee
--id N`) on `https://t1.vancornelio.dev:9001` to `https://t5.vancornelio.dev:9005`. The
members vote on their phones over a hotspot. The design is in the plan, kept outside the
repository; tags such as D18 name its decisions.

The kit is four scripts in `tools/` (plus `tools/live-lib.sh`, which they share) and three
files in this folder:

- `run-sheet.md`: what the presenter does and says during the demo, including how to
  prepare the voter list.
- `sample-voter-list.csv`: 17 fictional voters, the base of the real voter list.
- `rehearsal-checklist.md`: what to check at the rehearsal before the defense.

Every script takes `--help`, and every script that uses the state folder takes the same
`--state <dir>` flag.

## Once

1. **The certificate is already issued.** It is a Let's Encrypt wildcard for
   `*.vancornelio.dev`, made with lego over DNS-01 through Cloudflare. The chain is
   `~/.secrets/lego-live/certificates/_.vancornelio.dev.crt` and the key is
   `~/.secrets/lego-live/certificates/_.vancornelio.dev.key`, which must be mode 0600
   (`tools/live-up.sh` refuses a key that others can read). With `--domain` the default
   paths follow the domain (`_.<domain>.crt`, `_.<domain>.key`). `tools/live-up.sh status`
   prints its last valid day, and `tools/live-up.sh` refuses to start when less than one
   day is left. The exact lego command line was not recorded; if it must be renewed
   before the defense, renew it with lego the same way and keep the same file names.
2. **The Cloudflare token** is at `~/.secrets/cloudflare.token` (mode 0600). It has DNS
   edit rights on the zone and no expiry. Delete it or roll it in the Cloudflare dashboard
   after the defense (see After).
3. **Accounts.** Run once:

   ```
   tools/live-accounts.sh
   ```

   It makes the admin account `ban` and `trustee1` to `trustee5`, each trustee in its own
   file, plus one bearer token per trustee process. `--trustees` accepts only 5, because
   `tools/live-up.sh` starts exactly five trustee processes. It makes **no voter accounts**: the
   voters are the rows of the precinct's voter list (step 4), and a voter checks in on a
   phone with no account. `--voters` and `--spares` are gone and stop the script with a
   sentence. Voter accounts in an accounts file made by the older script are still accepted
   by the console at start but obtain nothing (saksi `docs/live/voter-list-api.md`,
   Conventions); run the script with `--force` once to drop them. The passwords are in
   `~/.balotachain-live/handout/passwords.txt`; the script prints the path, never the
   passwords. Print that file or keep it open on the presenter's phone; do not put it on
   the projector. To make new accounts later, run it with `--force`: the old ones move
   into `archive/` inside the state folder, and an election in progress stops working
   with them.
4. **The voter list.** One precinct, `0001A` (made up, always shown as "Precinct 0001A
   (demonstration)"). The file is `~/.balotachain-live/voter-list.csv`, mode 0600, in the
   state folder and outside every repository: the 17 fictional voters of
   `sample-voter-list.csv` plus one row per member with a made-up date of birth.
   `run-sheet.md`, "Before the demo: the voter list file", has the steps. No script reads
   or prints the file; `tools/live-up.sh` only checks its mode and warns when it is
   missing. The presenter uploads it in the Setup form's "Voter list" step.

## The day before

1. Build everything:

   ```
   tools/live-up.sh --build
   ```

   This builds `saksi-demo` (release) and `saksi-campaign` through saksi's `tools/up.sh`,
   then the four web apps with `tools/build-web.sh`, then tries to start the kit. Unless
   `tools/live-dns.sh` was run on this network first, it stops at the names step with
   "vote.vancornelio.dev does not resolve on this Mac. Run tools/live-dns.sh on this
   network first". That is expected: the build is done at that point (the script prints
   each binary's and each web app's build time just before), and nothing was started.
   For the rehearsal, run `tools/live-dns.sh` on the hotspot and then `tools/live-up.sh`.
   On macOS, if
   the firewall is on, it asks again whether `saksi-campaign` may accept incoming
   connections after every rebuild of the binary. Answer Allow. This is why the build
   happens the day before and not on the day.
2. Rehearse with `rehearsal-checklist.md`, on the hotspot, with the members' phones.
3. Record the backup video during the rehearsal (the checklist has the steps).
4. Stop with `tools/live-up.sh down`.

## On the day

1. Keep the Mac on power with the lid open, and run `caffeinate -dis` in a terminal for
   the whole demo (`caffeinate` does not stop sleep when the lid closes).
2. Start Docker Desktop. Fabric must already be running under the compose project
   `saksilive`. `tools/live-up.sh` never starts it; if it is stopped, the script prints
   the `docker start` line to run.
3. Join the Mac to the hotspot, and the members' phones to the same hotspot. The
   members' phones are one iPhone 17 (Safari) and two Android phones (Chrome); the
   Android models and versions are to note at rehearsal.
4. Point the six names at the Mac's address on the hotspot:

   ```
   tools/live-dns.sh
   ```

   It takes the address of the default-route interface and says which one it chose
   (use `--iface` or `--ip` to choose another). It then checks for up to two minutes that
   the names resolve, both on a public resolver and on this Mac. If the public resolver
   has the address and this Mac does not, there are two known causes. Either this Mac
   cached a "no such name" answer from a lookup made before the records existed (it
   clears by itself in about 5 minutes; to clear it at once, run
   `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` yourself, the script
   never runs sudo), or the network's DNS drops private addresses (DNS rebinding
   protection): then use the hotspot. `tools/live-dns.sh --check` repeats only the check.

   First real bring-up: it passed on 2026-11-15, on home Wi-Fi. After `tools/live-dns.sh`
   created the records, the names did not resolve at first; the cause was this Mac's own
   cached "no such name" answer, and the home router answered correctly all along. On this
   Mac the wrong answer cleared by itself after about 5 minutes; the flush command above
   clears it at once.
5. Start the kit:

   ```
   tools/live-up.sh
   ```

   It prints the seven addresses in tab order, the address for the phones, and the
   election's state.
6. Open one browser window with seven pinned tabs, in this order: Presenter, T1, T2, T3,
   T4, T5, Board (Cmd+1 to Cmd+7). Sign in on the Presenter tab as `ban` and on each
   trustee tab with its trustee account.
7. Zoom (D18): stand at the back row and press Cmd and + on the Board tab until the band
   can be read. The board and the presenter page are meant to work at 125% and 150%
   (check both at rehearsal). Zoom is kept per site, so the Presenter tab on the same
   address zooms with it, and a zoomed window narrower than 1024px shows the board in
   one column.
8. Members open `https://vote.vancornelio.dev:8443/vote/` before the panel arrives
   (D10). Always give the address with `:8443`. Nobody signs in: when voting opens, the
   phone shows the check-in by itself (`run-sheet.md`, Voting).
9. Follow `run-sheet.md`. The presenter types this election into the Setup form (plain
   letters only, D19). The id is what the form shows and what is recorded on chain. The
   candidates below are plainly fictional examples; the real candidate names for the
   defense are typed at setup from the presenter's own private note and are not kept in
   the repository.

   | Field | Typed | Id |
   |---|---|---|
   | Title | `BalotaChain Demo Election` | (the title has no id) |
   | Position | `President` | `President` |
   | Candidate | `Juan dela Cruz` | `Juan-dela-Cruz` |
   | Candidate | `Maria Clara` | `Maria-Clara` |
   | Candidate | `Andres Malaya` | `Andres-Malaya` |
   | Position | `Vice President` | `Vice-President` |
   | Candidate | `Crisostomo Ibarra` | `Crisostomo-Ibarra` |
   | Candidate | `Pedro Penduko` | `Pedro-Penduko` |
   | Candidate | `Gabriela Silang` | `Gabriela-Silang` |

10. Closing the election (`run-sheet.md`, Decrypt and the result): Close voting on the
    Presenter tab, then the threshold demonstration ("Publish with 0 of 3 signatures"
    under Demonstrations) before any trustee decrypts, then Decrypt on T1, T2 and T3.
    That is the last press. Each of those trustee processes signs the tally by itself
    once three trustees have decrypted, the console publishes the result at the third
    signature, and then verifies it by itself. Nobody presses Sign tally or Verify in
    the normal flow: those buttons appear only as retries, Sign tally on a trustee tab
    whose automatic signature failed and Verify again on the Presenter tab after a check
    that failed or gave no verdict.

## After

1. `tools/live-dns.sh --remove` (lists the six A records, asks for the word REMOVE).
2. Delete or roll the Cloudflare token in the Cloudflare dashboard, then delete
   `~/.secrets/cloudflare.token`.
3. `tools/live-reset.sh --yes`: it stops the kit (`tools/live-up.sh down`) and moves
   `runs/` and `trustees/` into `archive/<UTC time>/`. The runs hold the members' names,
   their made-up dates of birth and their drawn signatures.
4. Delete the archive and the real list:

   ```
   rm -rf ~/.balotachain-live/archive ~/.balotachain-live/voter-list.csv
   ```

5. The handout's passwords stay valid after the steps above. Before the kit is used
   again, run `tools/live-accounts.sh --force` to make new ones (it moves the old
   accounts, tokens and handout into `archive/`), then delete that archive.

## A second run

After an election is `verified` or `abandoned`, the presenter page can create the next
election on the same console, with a new election id: "Set up the next election" on a
verified result, the Next election form on an abandoned one. Nothing has to be reset for
that. `tools/live-reset.sh` is needed when an election is left in a state it cannot be
finished or abandoned from (open with the voters gone, or closed and stuck, for example
closed with no ballots), or to start with no election; the script's own note says the
same. It stops the kit, moves `runs/` and `trustees/` into `archive/<UTC time>/` inside the state
folder, keeps accounts and tokens, and never touches Fabric (the chain keeps the old
elections; the next one gets a new id).

`tools/live-reset.sh` moves `runs/` whole, so each run's `private/` folder goes into the
archive with it: the locked voter list (with the dates of birth), the check-in state and
the signatures. The archive then holds them; delete it after the defense with
`rm -rf ~/.balotachain-live/archive/<UTC time>`. The voter list file
`~/.balotachain-live/voter-list.csv` is kept; it is the same file for the next election.
An election made before the voter list build has no list and no check-in; never reuse
it (`run-sheet.md`, Operating rules).

Before a second run, every phone that voted, checked in, or showed a failed check, clears
the site's data for `vote.vancornelio.dev`: the credential, the receipts and the
failed-check warning live in the site's storage, and the check-in in its cookie. A phone
left open does move to the next election by itself: at rehearsals 3 and 4, phones on the
receipt or on "Voting has closed" moved to "Voting has not opened yet" within about 2
seconds of Create and to an empty check-in when voting opened, with no reload; a phone on
Verify follows too since the fixes after rehearsal 4 (`run-sheet.md`, Notes on the other
beats). Clearing the data is still the safe advice: it also clears the failed-check
warning, which nothing else clears. The menu names below
are **to check at rehearsal**; they were not confirmed on a phone:

- **iOS Safari:** Settings, Apps, Safari, Advanced, Website Data. Search for
  `vancornelio.dev`, swipe left on it and tap Delete. (On older iOS versions Safari is
  directly under Settings.)
- **Android Chrome:** open `https://vote.vancornelio.dev:8443/vote/`, tap the icon left of
  the address, then Site settings, then Delete data (or Clear and reset).

## Remote test session

For a test session with the members at home, on their own Wi-Fi. The defense itself uses
the hotspot and none of this. It is off unless `tools/live-up.sh` gets `--public`.

A second public name, `ballot.vancornelio.dev`, reaches the console through a Cloudflare
Tunnel: `cloudflared` on this Mac holds an outbound connection to Cloudflare and forwards
requests for that name to `https://127.0.0.1:8443`. Only the console is tunnelled, and of the
console only the phone page, the board and the routes they use (the Path rule below). The
five trustee processes are not tunnelled. `vote.vancornelio.dev` and everything that uses it
stay exactly as they are, so the Mac still needs `tools/live-dns.sh` on whatever network it
is on.

The members' link keeps the port: **`https://ballot.vancornelio.dev:8443/vote/`**.
Cloudflare serves HTTPS on 8443 as well as 443. Port 443 does not work with the current
console: its Host guard adds the console's port to an `--allow-host` given without one, and
it compares the browser's `Origin` (which carries no port on 443) with the Host header, so
no single Host value passes both. Using 443 needs a console change.

### Once: the dashboard (Ban)

1. Cloudflare dashboard, Zero Trust, Networks, Tunnels, **Create a tunnel**, type
   **Cloudflared**, name `balotachain-live`. Choose macOS on the install page, but **do not
   run** the `cloudflared service install ...` command it shows (that installs a service
   that runs at every boot). Copy the command to the clipboard; it ends with the token.
2. Save the token to the secrets file without printing it, then clear the clipboard:

   ```
   mkdir -p ~/.secrets && chmod 700 ~/.secrets
   (umask 077; pbpaste | awk '{ print $NF }' | tr -d '[:space:]' > ~/.secrets/cloudflare-tunnel.token)
   chmod 600 ~/.secrets/cloudflare-tunnel.token; pbcopy </dev/null
   wc -c < ~/.secrets/cloudflare-tunnel.token    # a length (well over 100), not the token
   ```

   `pbcopy </dev/null` empties the clipboard only. A clipboard manager (Raycast, Alfred,
   Paste, Maccy and the like) keeps its own history, and the copied text holds the token:
   delete that entry there too.
3. Next, **Public Hostname** (Route traffic), with exactly these values:

   | Field | Value |
   |---|---|
   | Subdomain | `ballot` |
   | Domain | `vancornelio.dev` |
   | Path | the regular expression below |
   | Service, Type | `HTTPS` |
   | Service, URL | `127.0.0.1:8443` |
   | Additional application settings, TLS, Origin Server Name | `vote.vancornelio.dev` |
   | Additional application settings, TLS, No TLS Verify | off |
   | Additional application settings, HTTP Settings, HTTP Host Header | `ballot.vancornelio.dev:8443` |

   Path, on one line:

   ```
   ^/(vote|board)(/.*)?$|^/api/live/(election|ballot|checkin(/(find|declare|sign))?|issue/(presign|sign))$|^/api/(board|verify-code)/.+$|^/(runs|favicon\.ico|api/capabilities|api/logout)$
   ```

   cloudflared matches Path as an unanchored regular expression against the URL's path
   (no query), hence each `^` and `$`. Anything else gets the tunnel's own 404 and never
   reaches the console. It lets through: the phone page (`/vote`, `/vote/` and its assets,
   including the WebAssembly file), its eight `/api/live/` routes (`election`, `ballot`,
   `checkin`, `checkin/find`, `checkin/declare`, `checkin/sign`, `issue/presign`,
   `issue/sign`), the board (`/board`, `/board/` and its assets, `/runs`,
   `/api/capabilities`, `/api/board/<run>` and its `files/`, `/api/verify-code/<run>/<code>`),
   `/favicon.ico`, and `/api/logout`, which only `tools/live-up.sh`'s readiness check uses
   (without it the check gets 404 and the whole kit stops). The board's verifier (trail) link
   is left out on purpose: `/trail/` and `/api/trail/` have no rate limit and query the chain
   on every request, so on `ballot` that link answers 404. It works on the LAN name.

   If the dashboard refuses `|` in Path, add one public-hostname row per alternative (the
   four pieces between the top-level `|`s, each keeping its `^` and `$`), every row with
   the same Service, TLS and HTTP Host Header values as above.

   Origin Server Name makes the origin's wildcard certificate verify for `127.0.0.1`. The
   HTTP Host Header must be exactly `ballot.vancornelio.dev:8443`: the console accepts that
   value (`--allow-host` from `--public`), and it equals the host and port of the page's own
   `Origin`, which the console's cross-origin check compares on every POST. Saving the
   hostname creates the proxied DNS record `ballot` (a CNAME to the tunnel) by itself.

   No Cloudflare Access application is used: it would add a login step for members, and its
   redirect on port 8443 is unproven.

### On the day of the test session

```
tools/live-dns.sh              # the LAN names, on the Mac's network of the day, as always
tools/live-up.sh up --public   # (--tunnel-token-file F for another token file)
```

`--public` checks that `cloudflared` is installed, that the token file exists, is not
empty and is mode 0600 (it never opens it), and that no other `cloudflared` runs. The
console gets one more `--allow-host ballot.vancornelio.dev:8443`. After the trustees,
`cloudflared tunnel run --token-file ...` starts under the kit's pid and log handling
(`pids/tunnel.pid`, `logs/tunnel.log`), with any `TUNNEL_TOKEN` removed from its environment
so the token file is the one used; `cloudflared` reads the token itself, so it is on no
command line. up then waits until `https://ballot.vancornelio.dev:8443/api/capabilities`
answers through Cloudflare as this console, and until a same-origin POST to `/api/logout`
passes the console's guard, and prints the one link to send. Both paths pass the Path rule.
If the check fails, it says which HTTP codes it saw and **stops the whole kit**, the LAN
part included: for the LAN-only demo, run `tools/live-up.sh` again without `--public`.
`tools/live-up.sh status` shows the tunnel and whether the public name answers;
`tools/live-up.sh down` stops it with the rest.

### What members do

Open the one link, `https://ballot.vancornelio.dev:8443/vote/`, check in from the voter
list, and vote. The receipt's board link and the board are relative, so they stay on
`ballot`. `vote.vancornelio.dev` and `ballot.vancornelio.dev` are the same site but
different origins, and the check-in cookie is host-only: a check-in started on one is not
seen on the other, so members use only the `ballot` link.

**The Electoral Board approves a remote check-in only after confirming on a call (phone or
video) with that member that they are the one checking in right now.** On the LAN the Board
sees the person at the desk; remotely, anyone who knows a member's name and date of birth
can declare, and the desk shows only the list entry. If the call does not confirm it,
refuse.

### What is reachable from the internet, and for how long

With the Path rule, an anonymous internet client reaches only:

- the static pages `/vote/` and `/board/` (and the bare `/vote` and `/board` redirects),
  with their assets, and `/favicon.ico`;
- the board's reads: `/runs`, `/api/capabilities`, `/api/live/election`, `/api/board/<run>`
  (and its `files/`), `/api/verify-code/<run>/<code>`;
- the phone's check-in and credential routes (`/api/live/checkin`, `.../checkin/find`,
  `.../checkin/declare`, `.../checkin/sign`, `/api/live/issue/presign`,
  `/api/live/issue/sign`), each bound to the phone's check-in cookie, with find and declare
  limited per address;
- the anonymous ballot relay `/api/live/ballot`, authorized by the credential signature
  inside the ballot;
- `/api/logout`, which with no session changes nothing.

Not reachable on `ballot`: `/admin/`, `/wizard`, `/trustee/`, `/`, `/api/login`,
`/api/me`, `/events`, `/trail/`, `/api/trail`, `/api/live/ledger`, the ceremony routes, every
admin and trustee route. The presenter and the trustees use the LAN names only.

Through the tunnel every request comes from `cloudflared` on this Mac, so the console sees
every remote member as one local (loopback) address:

- **One anonymous client can block remote check-in.** The check-in limit (12 tries, then
  one every 10 s; a check-in costs two) is one bucket shared by everyone who comes through
  the tunnel. Anyone who finds the link can keep it empty with one request every 10 s, and
  every remote member is then told to wait. The Path rule cannot stop this, because those
  routes are the ones members need, and the console does not read Cloudflare's
  `CF-Connecting-IP` (that needs a console change). If it happens, stop the tunnel
  (`tools/live-up.sh down`) and use the LAN.
- The console allows the network reset, the peer fault and the trail's operator view only
  from loopback, and would see a tunnel request as loopback. None of their paths passes the
  Path rule, and each also needs the admin session.

**Cloudflare terminates TLS for `ballot`.** Cloudflare's edge decrypts every request and
re-encrypts it to the tunnel, so it can see what the phones send: each member's name, date
of birth and signature at check-in, the check-in cookie, and the ballot POST, from the same
client address within seconds. It can therefore link a member to their ballot record
(tracking code and nullifier). The choices stay encrypted, but the relay's unlinkability
does not hold against Cloudflare. **No privacy claim is made for a remote session**; it is
for testing only.

Cloudflare cuts a request after 100 s (HTTP 524); a ballot normally takes seconds.

**Stop the tunnel right after the session:** `tools/live-up.sh down` (it stops the tunnel
first). Delete the public hostname or the tunnel in the dashboard when remote tests are over.

## What each script does and never does

| Script | Does | Never does |
|---|---|---|
| `tools/live-accounts.sh` | Makes the admin and the five trustee accounts files (no voter accounts; `--trustees` other than 5 is refused), the trustee tokens and their hashes, and the handout, all mode 0600, with passwords from `/dev/urandom` hashed by `saksi-campaign hash-password` on stdin. Refuses when accounts exist; with `--force` moves the old ones into `archive/`. | Print a password or token, pass one as a command-line argument, delete or copy old accounts. |
| `tools/live-dns.sh` | Creates or updates six A records (`vote`, `t1` to `t5`; proxied off, TTL 60, comment "balotachain live demo") through the Cloudflare API, then checks that they resolve. `--dry-run` shows the change, `--check` only checks, `--remove` deletes the six. | Change or delete any other record, publish a public address without `--allow-public`, put the token on a command line or in an exported variable, send any request in `--dry-run`. |
| `tools/live-up.sh` | Checks Docker, the certificate (and that its key is private to its owner), Fabric, the binaries and web apps, the accounts (and the voter list file's mode), the names and the ports, then starts the console (with `--live-precinct 0001A`, from `LV_PRECINCT` in `tools/live-lib.sh`) and the five trustees in the background and waits for each. If one fails, or Ctrl-C interrupts the start-up, it shows the console's last 20 log lines and stops what it started. With `--public` it also checks the tunnel token file's mode, gives the console `--allow-host ballot.<domain>:8443`, runs `cloudflared` and waits until the public name answers (Remote test session). `down` stops them by pid file (SIGTERM, up to 20 s), the tunnel first; `status` reports, with the election's precinct and list counts, or "no voter list". | Read or print the voter list file or the tunnel token; start, stop, reset or redeploy Fabric; restart a process by itself; print or copy the certificate key or the Fabric key; kill harder than SIGTERM. |
| `tools/live-reset.sh` | Runs `live-up.sh down`, then moves `runs/` and `trustees/` into `archive/`, after the word RESET; the archive then holds each run's voter list, check-ins and signatures. | Delete anything, copy a run's `private/` folder, touch Fabric, the accounts or `voter-list.csv`. |

`tools/live-up.sh --build` is the only part that writes outside the state folder: it builds
into the saksi checkout's `target/` and into this repo's `dist-web/`.

## The state folder

One folder outside every repo, `~/.balotachain-live` by default, mode 0700. Nothing in it
is copied into a repo, a log, a report or a screenshot.

```
voter-list.csv                       0600  the real voter list (fictional rows plus the members); never read by a script
accounts/console.json                0600  the admin account (the console's --auth-file)
accounts/trustee-<N>.json            0600  one trustee account, trustee_id N (that process's --auth-file)
tokens/trustee-<N>.token             0600  raw bearer token (that process's --token-file)
tokens/console-trustee-tokens.json   0600  the tokens' SHA-256 (the console's --trustee-tokens)
handout/passwords.txt                0600  username, password, role: what the presenter gives out
runs/                                      the console's --runs (each run's private/ holds the issuer key,
                                           the locked voter list, the check-in state and the signatures)
trustees/<N>/                              trustee N's --state-dir (the process makes it 0700)
logs/console.log, logs/trustee-<N>.log     the processes' output (the previous one is kept as .prev)
logs/tunnel.log                            cloudflared's output (--public only)
pids/console.pid, pids/trustee-<N>.pid
pids/tunnel.pid, pids/tunnel.cloudflared.pid  the tunnel (--public only)
archive/<UTC time>/                        where --force and live-reset.sh move old folders
```

## The voter list and check-in routes

The console's routes for the list, the desk and the phone's check-in (`/api/live/voter-list`,
`/api/live/voter-list/preview`, `/api/live/desk/*`, `/api/live/checkin*`), the CSV rules,
the fingerprint, the check-in states, the cookie and the rate limit are specified in one
place: saksi `docs/live/voter-list-api.md`. The board reads only the precinct, the counts,
the fingerprint and the sentence `voter_list_note` from `GET /api/board/<run>` and
`GET /api/live/election`; it never shows a name or a date.
