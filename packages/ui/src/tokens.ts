export const tokens = {
  color: {
    teal: "#0F6E6E",
    tealDark: "#0A5252",
    tealLight: "#E3F1F1",
    /** Border of teal-light pills/badges. */
    tealBorder: "#C5E0E0",
    bg: "#FAFAF8",
    surface: "#FFFFFF",
    text1: "#1A2526",
    text2: "#5C6B6B",
    success: "#2E7D5B",
    successLight: "#E6F2EC",
    successBorder: "#C2E1D1",
    /** Heading colour inside success surfaces. */
    successText: "#1E5A40",
    /** Body copy inside success surfaces. */
    successBody: "#2E5C49",
    warn: "#C8851A",
    warnLight: "#FBF3E2",
    warnBorder: "#EFD9A9",
    warnText: "#835B12",
    error: "#C0392B",
    errorLight: "#F7E8E6",
    border: "#E0E4E3",
    /** Border on hover for outlined controls. */
    borderHover: "#C9D0CE",
    /** Neutral track/avatar fill (bars, unselected avatars). */
    neutralFill: "#EEF1F0",
    /** Muted teal for non-leading result bars. */
    neutralBar: "#9FBFBF",
    /** Placeholders and secondary metadata (DESIGN.md `text-subtle`, 4.9:1 on white). */
    textSubtle: "#677473",
    /** Decorative fill only (offline dots); never text. Was `muted`. */
    neutralDot: "#9AA6A5",
  },
  radius: { card: 16, button: 12, pill: 9999 },
  space: { xs: 8, sm: 16, md: 24, lg: 32 },
  type: {
    body: 16,
    h1: 28,
    h2: 24,
    h3: 20,
    /** Uppercase section eyebrow / card label. */
    eyebrow: 13,
    small: 13,
    button: 18,
    /** Board band only: its one main figure, weight 700, tabular (D18). */
    figure: 48,
    lineHeight: 1.5,
    fontFamily: `"Source Sans 3 Variable", "Source Sans 3", system-ui, sans-serif`,
    mono: `"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Consolas, monospace`,
  },
  /**
   * The same sizes in rem (16px = 1rem), for inline styles. A number in a
   * React style is px and ignores the reader's text-size setting; these
   * follow it, and draw the same at the default size.
   */
  font: {
    small: "0.8125rem",
    mono: "0.875rem",
    body: "1rem",
    button: "1.125rem",
    h3: "1.25rem",
    h2: "1.5rem",
    h1: "1.75rem",
    figure: "3rem",
  },
  /** DESIGN.md type roles, ready to spread into a style object. */
  typeRole: {
    /** Names a section: 13px, 600, tracked, uppercase. Never a kicker above a heading. */
    label: {
      fontSize: "0.8125rem",
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
    /** Every value a person compares character by character. */
    mono: {
      fontFamily: `"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Consolas, monospace`,
      fontSize: "0.875rem",
      fontWeight: 400,
      fontVariantNumeric: "tabular-nums",
    },
  },
  shadow: {
    card: "0 2px 10px -4px rgba(26,37,38,0.10)",
    /** Flat inset surfaces (option cards, review blocks). */
    subtle: "0 1px 2px rgba(26,37,38,0.04)",
    /** Filled primary button lift. */
    button: "0 6px 16px -6px rgba(15,110,110,0.5)",
  },
  minButtonHeight: 56,
} as const;

export type Tokens = typeof tokens;
