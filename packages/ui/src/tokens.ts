export const tokens = {
  color: {
    teal: '#0F6E6E',
    tealDark: '#0A5252',
    tealLight: '#E3F1F1',
    bg: '#FAFAF8',
    surface: '#FFFFFF',
    text1: '#1A2526',
    text2: '#5C6B6B',
    success: '#2E7D5B',
    warn: '#C8851A',
    error: '#C0392B',
    border: '#E0E4E3',
  },
  radius: { card: 16, button: 12, pill: 9999 },
  space: { xs: 8, sm: 16, md: 24, lg: 32 },
  type: {
    body: 16,
    h1: 28,
    h2: 24,
    button: 18,
    lineHeight: 1.5,
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    mono: `ui-monospace, SFMono-Regular, Menlo, monospace`,
  },
  shadow: { card: '0 1px 2px rgba(26,37,38,0.06), 0 1px 8px rgba(26,37,38,0.04)' },
  minButtonHeight: 56,
} as const;

export type Tokens = typeof tokens;
