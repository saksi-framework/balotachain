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
    /** Placeholder text and offline dots. */
    muted: "#9AA6A5",
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
    lineHeight: 1.5,
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`,
    mono: `ui-monospace, 'SF Mono', Menlo, Consolas, monospace`,
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
