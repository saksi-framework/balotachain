# Voter app design — tokens and motion (recovered)

The voter mockup's host HTML (`BalotaChain (standalone).html`) exceeded the
fetch size limit, so its `<style>` block could not be captured verbatim. The
JSX sources (`balota-app.jsx`, `balota-screens.jsx`, `balota-components.jsx`,
`ios-frame.jsx`) are complete and reference the CSS variables below. Values are
taken from the sibling Bulletin Board and Trustee Console mockups, which share
the palette, and from `balota-app.jsx` `TWEAK_DEFAULTS`.

## CSS variables used by the JSX

| Variable | Value | Source |
|---|---|---|
| `--teal` | `#0F6E6E` | TWEAK_DEFAULTS accent[0] |
| `--teal-dark` | `#0A5252` | accent[1] |
| `--teal-light` | `#E3F1F1` | accent[2] |
| `--bg` | `#FAFAF8` | TWEAK_DEFAULTS bg |
| `--surface` | `#FFFFFF` | sibling mockups |
| `--text-1` | `#1A2526` | sibling mockups |
| `--text-2` | `#5C6B6B` | sibling mockups |
| `--success` | `#2E7D5B` | sibling mockups |
| `--success-light` | `#E6F2EC` | sibling mockups |
| `--success-border` | `#C2E1D1` | sibling mockups |
| `--success-text` | `#1E5A40` | sibling mockups use this literal for success headings |
| `--warning` | `#C8851A` | sibling mockups |
| `--warn-light` | `#FBF3E2` | sibling mockups |
| `--warn-border` | `#EFD9A9` | trustee mockup |
| `--warn-text` | `#835B12` | trustee mockup |
| `--border` | `#E0E4E3` | sibling mockups |
| `--disabled` | `#EEF1F0` (assumed: the neutral fill used for unselected avatars and bars) | inferred, not captured |
| `--r-card` | `16px` | TWEAK_DEFAULTS cardRadius |

Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
mono: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`.

## Motion classes referenced by the JSX (definitions not captured; reproduce)

- `.ba-pop` — icon/ring pop-in on Splash and Submitted (scale 0.8→1 with slight overshoot, ~360 ms).
- `.ba-rise` — content rise-in on ballot step change and verify result (translateY 8px→0 + fade, ~300 ms).
- `.ba-dot` — three loading dots on Splash, staggered by `animationDelay` 0.16 s each (opacity pulse).
- `.ba-screen-fwd` / `.ba-screen-back` — screen transition: slide in from right (fwd) or left (back) with fade, ~320 ms, `cubic-bezier(.4,0,.2,1)`.

## Frame

`IOSDevice` at 390×844 with dynamic island, status bar, and home indicator
(`ios-frame.jsx`). Splash uses `dark` (teal-dark background, white text).
Flutter target: these are the mobile safe-area insets to respect (58 px top bar
padding, 30 px bottom footer padding in the JSX).

## Screens (8, in `balota-screens.jsx`)

Splash → Onboarding (3 slides, swipe) → Login (email, no password) → Home
(active election card) → Ballot (3 positions: President pick 1, Vice President
pick 1, Senators pick up to 12; progress bar; option cards) → Review (blocks per
position, irreversibility warning) → Submitted (tracking code `BC-7F3A-92K1`,
copy) → Verify (tracking code input, success card).
