---
# gstack: design-md-format=spec
name: BalotaChain
description: Calm, official civic software where every claim carries a value you can check yourself.
colors:
  primary: "#0F6E6E"
  primary-hover: "#0A5252"
  on-primary: "#FFFFFF"
  primary-tint: "#E3F1F1"
  primary-tint-border: "#C5E0E0"
  background: "#FAFAF8"
  surface: "#FFFFFF"
  text: "#1A2526"
  text-muted: "#5C6B6B"
  text-subtle: "#677473"
  border: "#E0E4E3"
  border-hover: "#C9D0CE"
  neutral-fill: "#EEF1F0"
  neutral-bar: "#9FBFBF"
  success: "#2E7D5B"
  success-tint: "#E6F2EC"
  success-border: "#C2E1D1"
  success-text: "#1E5A40"
  warning: "#C8851A"
  warning-tint: "#FBF3E2"
  warning-border: "#EFD9A9"
  warning-text: "#835B12"
  error: "#C0392B"
  error-tint: "#F7E8E6"
typography:
  display:
    fontFamily: "Source Sans 3"
    fontWeight: 700
    fontSize: 1.75rem
    lineHeight: 1.25
    letterSpacing: -0.01em
  heading:
    fontFamily: "Source Sans 3"
    fontWeight: 600
    fontSize: 1.25rem
    lineHeight: 1.3
  body:
    fontFamily: "Source Sans 3"
    fontWeight: 400
    fontSize: 1rem
    lineHeight: 1.5
  label:
    fontFamily: "Source Sans 3"
    fontWeight: 600
    fontSize: 0.8125rem
    letterSpacing: 0.04em
  button:
    fontFamily: "Source Sans 3"
    fontWeight: 600
    fontSize: 1.125rem
  mono:
    fontFamily: "JetBrains Mono"
    fontWeight: 400
    fontSize: 0.875rem
    fontFeature: tnum
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  full: 9999px
spacing:
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    height: 56px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
  chip-neutral:
    backgroundColor: "{colors.neutral-fill}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.full}"
  chip-active:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary-hover}"
    borderColor: "{colors.primary-tint-border}"
    rounded: "{rounded.full}"
  chip-success:
    backgroundColor: "{colors.success-tint}"
    textColor: "{colors.success-text}"
    borderColor: "{colors.success-border}"
    rounded: "{rounded.full}"
  chip-warning:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.warning-text}"
    borderColor: "{colors.warning-border}"
    rounded: "{rounded.full}"
  chip-error:
    backgroundColor: "{colors.error-tint}"
    textColor: "{colors.error}"
    rounded: "{rounded.full}"
  verifiable-value:
    fontFamily: "{typography.mono}"
    backgroundColor: "{colors.neutral-fill}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
---

# BalotaChain

## Overview

**Creative North Star:** civic utilitarian. Calm, official and readable, the way a well-run polling
place feels. The cryptography is shown as content (hashes, codes, block numbers you can check), never
as decoration.

**Product context:** end-to-end verifiable voting for a WMSU undergraduate thesis, built on the Saksi
framework and Hyperledger Fabric. The audience is the defense panel, the election's trustees
(COMELEC-style institutions) and Filipino voters.

**Mode per surface:**
- Voter app (Flutter, phone, 390px): Operate. One task per screen, large targets.
- Trustee console (browser, desktop): Operate. One decision at a time, state always visible.
- Admin console (browser, desktop): Operate. Election lifecycle as steps.
- Public bulletin board (browser, desktop and projector): Read. Results and proofs anyone can check.
- saksi console pages (`/wizard`, `/trail`): internal and never shown. Out of scope for this file
  except the UX rules under Do's and Don'ts; keep their own look.

**Source of truth for layouts:** the Claude Design mockups (project a6e40356, fetched 2026-09-09):
`docs/design/mockups/` (`bulletin-board.html`, `trustee-console.html`, and the voter screens in `balota-*.jsx`). Recreate them
faithfully. This file adds what they leave open. There is no admin mockup; the admin console follows
the trustee console's pattern.

**Key characteristics:**
- Warm off-white page, white cards, one teal for everything you can press.
- Every verifiable value sits in mono with a copy button and, where one exists, a link to check it.
- Status is always a word in a chip, never only a colour.
- Nothing moves unless the state changed.

## Colors

**Strategy:** Restrained. Teal (`primary`) is the only colour that means "you can act here". Semantic
colours appear only for state: success for recorded and verified, warning for interrupted,
error for refused and failed.

**Light or dark:** light only. The scenes are a projector in a lit room at the defense, trustee
desktops in offices, and phones outdoors in daylight. Dark mode is deferred; add it only if a scene
changes.

**Named rules:**
- `primary` carries interaction: buttons, links, focus rings, the selected option. It does not carry
  emphasis for plain text.
- `warning` (#C8851A) is 3.1:1 on white, so it is for fills, icons and bars only. Warning text uses
  `warning-text`.
- `text-subtle` replaces the old muted grey #9AA6A5 (2.5:1) for placeholders and secondary metadata;
  it is 4.9:1 on white. Offline dots and decorative fills may use `neutral-bar`.
- Text on tints uses the matching `*-text` token (success 7.0:1, warning 5.5:1, active 7.7:1).
- Result bars: the leading candidate in `primary`, the rest in `neutral-bar`, the track in
  `neutral-fill`.

## Typography

Source Sans 3 comes from the world of public forms and signage: a humanist sans built for reading at
small sizes, with full Latin coverage for Filipino and Spanish names (ñ, accented vowels). It replaces
the system stack, so the panel's Windows laptop and a voter's phone render the same letters.
JetBrains Mono sets every value a person might compare character by character: nullifiers, tracking
codes, transaction ids, hashes and block numbers. Tabular figures keep columns of numbers aligned.

**Loading:** self-hosted, never a CDN, so the demo works offline. React apps import
`@fontsource-variable/source-sans-3` and `@fontsource-variable/jetbrains-mono` once in
`packages/ui`; Flutter bundles the same OFL files as assets. Fallback stack:
`"Source Sans 3", system-ui, sans-serif` and `"JetBrains Mono", ui-monospace, Consolas, monospace`.

**Scale:** 13 / 16 / 20 / 24 / 28. Levels differ by size and weight, never by weight alone. Labels
(13px, 600, tracked, uppercase) name a section; they never sit above a heading as a kicker.

## Layout

- Desktop apps: content max 1200px, centred, 24px gutters; 32px between sections, 16px inside cards.
- Step tabs (admin) wrap onto a second line below 1280px. They never truncate.
- Tables on the board use a compact row (8px vertical padding); everything else is comfortable.
- Voter app: single column at 390px, 24px side padding, the primary action pinned at the bottom.
- Below 720px the desktop apps stack to one column with 16px gutters and no horizontal page scroll.
  Long hashes wrap (`overflow-wrap: anywhere`) or truncate in the middle with the full value in the
  copy button.

## Elevation & Depth

Borders do most of the work. Cards get `border` plus a soft offset shadow
(`0 2px 10px -4px rgba(26,37,38,0.10)`); inset blocks get `0 1px 2px rgba(26,37,38,0.04)`; the filled
primary button gets `0 6px 16px -6px rgba(15,110,110,0.5)`. No zero-offset glows. Never a card inside
a card: a card's sections are separated by a border line.

## Shapes

- `lg` 16px: cards and panels.
- `md` 12px: buttons and option rows.
- `sm` 8px: inputs and the verifiable-value block.
- `full`: chips and avatars.

A nested element's radius is the outer radius minus the gap between them.

## Components

All shared React components live in `packages/ui`; apps do not keep their own copies.

- **Button** (primary, secondary, ghost). Height 56px in the voter app, 44px on desktop. States:
  hover darkens to `primary-hover`; `focus-visible` shows a 2px `primary` ring offset 2px; disabled
  is 50% opacity with `cursor: not-allowed`; busy keeps the width and swaps the label for a spinner
  plus the in-flight word ("Recording…", "Publishing…"). A button never comes back while the server
  still says the action is running.
- **Chip** (neutral, active, success, warning, error). One component, a text label always present.
  Roster states: Waiting (neutral), Recording… (active), Recorded (success), Failed (error),
  Interrupted (warning).
- **TopBar.** App name, election name, the signed-in role on the right. One component for admin,
  trustee and board.
- **VerifiableValue.** Mono text on `neutral-fill`, a CopyButton, and a "Check" link when the value
  has a public check (tx id to the trail; a tracking code is checked in the board's Verify card). Copy confirms with a
  label change for 2s, not a toast.
- **Card.** White, `border`, `lg` radius, 24px padding. Title in `heading`.
- **States.** Every data view designs four states: loading (skeleton lines, not a spinner alone),
  empty (one sentence saying what will appear and when), error (what failed, in the console's own
  words, plus a Retry button), and long content (wrapping, never overflow).
- **Accessibility.** Text contrast 4.5:1 minimum; interactive elements reachable by keyboard in
  reading order; icons that act have an `aria-label`; live state changes (a share recorded, a tally
  published) announce through an `aria-live="polite"` region.

## Do's and Don'ts

- Do show the value behind every claim: "Your ballot is recorded" sits next to its tracking code.
- Do name the next thing that unlocks when an action is blocked ("Another trustee's share is being
  recorded; this unlocks when it finishes.").
- Do use the console's own error text; it is already user-facing.
- Do keep teal for actions only, so a panel member can find what to press at a glance.
- Don't use colour alone for status, gradients, glows, emoji, or decorative illustrations.
- Don't nest cards, put a label above a heading, or truncate step tabs.
- Don't show optimistic success: "Recorded" appears only when the server says so.
- Don't set warning text in `warning`; use `warning-text`.
- saksi console (internal): good UX, no visual work. Every action shows its in-flight state, errors
  show inline with a retry, destructive actions (reset, cancel) confirm, and disabled controls say
  why.

## Motion

- **Approach:** minimal-functional.
- **Easing:** enter ease-out, exit ease-in, move ease-in-out.
- **Duration:** micro 100ms (hover, press), short 200ms (chip and panel state changes), medium 300ms
  (voter screen transitions `ba-screen-fwd` / `ba-screen-back`).
- **The one authored moment:** the voter's "ballot recorded" tick (`ba-pop`).
- Respect `prefers-reduced-motion`: transitions drop to opacity only.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-29 | Initial design system created | /design-consultation: codify the Claude Design mockups and fill their gaps, goal "trust you can check" |
| 2026-09-29 | Source Sans 3 + JetBrains Mono, self-hosted | Same rendering on every device; offline demo; hashes readable |
| 2026-09-29 | `text-subtle` #677473 replaces #9AA6A5; warning text only in `warning-text` | Old values failed WCAG AA (2.5:1 and 3.1:1) |
| 2026-09-29 | Light only; dark mode deferred | Use scenes are lit rooms, a projector and daylight |
| 2026-09-29 | Console pages keep their look, UX only | Internal, never shown (user decision) |
