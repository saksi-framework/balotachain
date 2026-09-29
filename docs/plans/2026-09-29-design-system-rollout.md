# Design system rollout (Step B before the Chapter 4 study)

Decided 2026-09-29 in `/design-consultation`: codify the Claude Design mockups and fill their gaps.
The rules are in `DESIGN.md`, the mockups in `docs/design/mockups/`. The saksi console pages get
UX work only, with no visual change.

## Global Constraints

- **Tokens.** `DESIGN.md` front matter is normative.
  - `packages/ui/src/tokens.ts`, `packages/ui/src/styles.css` (`--bc-*`) and
    `apps/voter/lib/design/tokens.dart` must match it.
  - New token `text-subtle` #677473 replaces muted #9AA6A5 for every text use. #9AA6A5 may stay only
    as a decorative fill (offline dots); rename that token to `neutral-dot`.
  - Warning text uses #835B12, never #C8851A.
- **Fonts.**
  - Source Sans 3 and JetBrains Mono, self-hosted. React: `@fontsource-variable/source-sans-3` and
    `@fontsource-variable/jetbrains-mono` (both OFL, v5.3.0), imported once from `packages/ui`.
  - Flutter: bundle the same files under `apps/voter/assets/fonts/` with `pubspec.yaml` entries.
  - Stacks: `"Source Sans 3 Variable", "Source Sans 3", system-ui, sans-serif` and
    `"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Consolas, monospace`.
  - No CDN.
- **Shared components live in `packages/ui` only**, exported from `index.ts`: `Chip`, `TopBar`,
  `CopyButton` and a new `VerifiableValue`. Apps delete their local copies:
  - `apps/{admin,trustee,auditor}/src/components/Chip.tsx`;
  - admin's `CopyButton` (App.tsx ~356);
  - the trustee and auditor local `TopBar`s (App.tsx ~240, ~324).
- **Chip variants:** `neutral | active | success | warning | error`, and a text label is always
  required. Roster words: `Waiting`, `Recording…`, `Recorded`, `Failed`, `Interrupted`.
- **VerifiableValue props:** `value`, optional `label`, optional `checkHref`, optional `truncate`
  (middle truncation, full value copied).
  - Copy confirms by changing its label to `Copied` for 2 s.
  - The component wraps with `overflow-wrap: anywhere` when not truncated.
- **Accessibility:**
  - text contrast 4.5:1 minimum;
  - `focus-visible` ring 2px `primary`, offset 2px;
  - icon-only buttons carry an `aria-label`;
  - one `aria-live="polite"` region per app for state changes;
  - `prefers-reduced-motion` reduces transitions to opacity.
- **Layout:** desktop content is at most 1200px. Admin step tabs wrap and never truncate. Below
  720px the desktop apps stack to one column with 16px gutters and no horizontal page scroll.
- **Do not change behaviour** that #64 fixed (trustee submit state, admin run state). The existing
  tests stay green.
- **Branch:** `feat/design-system` off balotachain `main` a10c2d5, worktree `C:\wt\balota-design`.
  saksi console work goes on its own saksi branch (Task 5).
- **Commit trailers:**
  - `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_015q5U4NJTtwkhtHs9CyapZG`

| Task | model | where | reviewer |
|---|---|---|---|
| 1 | executor (Opus) | C:\wt\balota-design | reviewer (Sonnet) |
| 2 | executor (Opus) | same, after 1 | reviewer (Sonnet) |
| 3 | executor (Opus) | same, after 2 | reviewer (Sonnet) |
| 4 | executor (Opus) | same, after 1 (Flutter only) | reviewer (Sonnet) |
| 5 | executor (Opus) | saksi worktree, own branch | reviewer (Sonnet) |
| 6 | main session | after 2-4 | none |

## Task 1: packages/ui foundation

1. Update the tokens and CSS variables to DESIGN.md: add `text-subtle` and `neutral-dot`, the font stacks, and the type roles (`label`, `mono`).
2. Add the two `@fontsource-variable` dependencies to `packages/ui`. Import them in one place that every app already loads: the styles entry, or `index.ts` if the apps import the CSS through it. Check how the apps pull `styles.css` in.
3. Components:
   - `Chip`: merge the three app Chips; diff them first and keep every variant any app uses, mapped onto the five.
   - `TopBar`: extend the existing one to cover the trustee and auditor usages (app name, election name, role slot).
   - `CopyButton`: extend it to cover admin's usage.
   - `VerifiableValue`: new.
   - All of them follow the focus, aria and reduced-motion rules.
4. Tests: `packages/ui` has none. Add vitest plus happy-dom, the versions the apps use, with a small test per component:
   - Chip renders its label for every variant;
   - CopyButton writes to the clipboard and shows `Copied`;
   - VerifiableValue truncates in the middle and copies the full value;
   - TopBar renders the role slot.
5. Run `pnpm --filter @balotachain/ui build test`, then `pnpm -r typecheck`. The apps must still build: `pnpm -r build`.

## Task 2: Trustee and admin adopt the system

1. Replace the local Chip, TopBar and CopyButton with the `@balotachain/ui` versions, and delete the local files.
2. Trustee roster chips use the roster words. `submitting` gives `Recording…` (active), not Pending/Waiting.
3. Admin:
   - step tabs wrap below 1280px, with no truncation or ellipsis;
   - the ceremony roster uses the same chips;
   - run-list chips map to the five variants;
   - there is no admin mockup, so follow the trustee console's page pattern (TopBar, 1200px column, cards, one primary action per step).
4. Show every hash, nullifier, tx id and bundle sha256 through `VerifiableValue`. `checkHref` points to the trail for tx ids when the console serves `/trail`.
5. Replace text uses of muted #9AA6A5 with `text-subtle`, and warning-coloured text with `warning-text`.
6. States: each data view has a loading skeleton, one empty sentence, an error with the console's text plus Retry, and long-content wrapping. Add the aria-live region announcing "Share recorded", "Tally published" and run state changes.
7. Responsive: below 720px, one column and no horizontal scroll.
8. Tests: update the existing tests for the new markup without weakening their assertions, and add tests for:
   - `Recording…` on the roster;
   - tabs present, untruncated, when many steps exist.
9. Run `pnpm --filter trustee test typecheck lint` and `pnpm --filter admin test typecheck lint`.

## Task 3: Public board adopts the system, and the files links

1. Switch the board to the shared Chip and TopBar; delete the local copies.
2. Download links: `apps/auditor/src/lib/bulletin.ts:186-188` and the App.tsx callers (~1044, ~1057) move from admin-only `/export/<run>/<name>` to `/api/board/<run>/files/<name>`. That route is saksi `board.go:330-358`, public once the board is unsealed.
   - Hide the links while the board is sealed, with the empty sentence explaining when they appear.
   - Update `bulletin.test.ts:92`.
3. Tracking codes, nullifiers, tx ids and hashes go through `VerifiableValue`. A tracking code's `checkHref` is the existing verify-code flow.
4. The "Open verifier" link returns 502 when offline. Show it only when the console reports an on-chain run; otherwise the empty sentence says the chain trail needs the network.
5. Result bars: leading candidate in `primary`, the rest in `neutral-bar`, track in `neutral-fill`. Contests use compact table rows.
6. Apply the Task 2 rules for contrast, states, aria-live and responsive.
7. Run `pnpm --filter auditor test typecheck lint`, then `sh tools/build-web.sh`.

## Task 4: Voter app (Flutter)

1. `tokens.dart`: add `textSubtle`, rename muted to `neutralDot` for fills, and move text uses to `textSubtle`.
2. Bundle Source Sans 3 and JetBrains Mono, set the theme's `fontFamily`, and render tracking codes and hashes in mono.
3. Keep the motion classes as in the mockups, and honour `MediaQuery.disableAnimations`.
4. This box cannot build the voter app: Dart 3.9.2 < 3.11.4. CI's Flutter job is the verification path. Keep changes small and run `dart format`, if it works at this version, on the files touched.

## Task 5: saksi console UX pass (no visual change)

Branch `feat/console-ux` off saksi `main`, worktree `C:\wt\saksi-console-ux`. It must merge **before** Step C, because the study build is the last saksi merge before C.

1. Audit `packages/saksi-campaign/web/wizard.html`, `trail.html` and `index.html` against the console rules in DESIGN.md "Do's and Don'ts":
   - every action shows its in-flight state;
   - errors appear inline with a retry;
   - destructive actions (network reset, cancel run) confirm;
   - disabled controls say why.
   Cover the flows: runs list, preflight, campaigns, attack timeline, network reset, T3 fault, resume and export.
2. Write the audit to the task report as a list: item, file:line, and fix.
3. Fix the items that change no API and no measurement path. Park anything touching the timing or the Go handlers as a finding.
4. Keep `web_test.go` passing and add checks in its style for the new confirm and disabled-reason behaviour. Run `go test ./...` with `SAKSI_DEMO_BIN` set.

## Task 6: Screenshots and paper hand-off (main session)

1. Serve the built apps from a local console (offline run), then capture at 1280px and at 390px:
   - admin: every step;
   - trustee: waiting, recording, recorded, error;
   - board: sealed, verified, verify-code result;
   - voter: all 8 screens, from CI artifacts or a desktop with Flutter 3.44.
2. Run an axe/contrast pass on the React pages and record the result.
3. Put the shots in `docs/design/appendix-b/` and list them in the amendments hand-off for Appendix B.
