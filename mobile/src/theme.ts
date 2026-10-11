/**
 * Wasel design tokens.
 *
 * Brand rule: ONE hero color (cyan) for actions + ONE support color (green)
 * for success/route/"go" meaning. Every other hue is semantic only
 * (warning / error / info) and must not be used for decoration.
 * Legacy aliases are kept so existing screens keep compiling.
 */
export const colors = {
  // Brand
  primary: '#00E5FF',
  secondary: '#72C70D',
  onPrimary: '#04152B', // text/icon color on bright brand fills (AAA contrast on cyan)

  // Surfaces
  bg: '#081D39',
  surface: '#0e2240',
  surfaceElevated: '#132b4d',
  surfaceAlt: '#132b4d',
  surfaceMuted: '#0e2240',
  // Brand borders are cyan-based on web (utils/wasel-ds.ts C.border). The legacy
  // rgba(20,127,228) blue was deprecated there and had drifted here.
  line: 'rgba(0,229,255,0.16)',
  lineStrong: 'rgba(0,229,255,0.28)',
  // Form-control boundary: ~3.65:1 on surface (WCAG 1.4.11), matches web C.borderInput.
  lineInput: 'rgba(0,229,255,0.5)',

  // Text
  textPrimary: '#F8FBFF',
  textSecondary: 'rgba(248,251,255,0.86)',
  textMuted: 'rgba(196,220,238,0.68)',
  ink: '#F8FBFF',
  text: '#F8FBFF',
  muted: 'rgba(196,220,238,0.68)',
  navy: '#081D39',
  charcoal: '#E2E8F0',

  // Legacy hue aliases (prefer semantic tokens below in new code)
  cyan: '#00E5FF',
  teal: '#00E5FF', // was #58DDFF — unified with primary so there is one action color
  green: '#72C70D',
  amber: '#FF8A0B',
  blue: '#00E5FF',
  gold: '#FFBE5C',
  lilac: '#8FA6FF',
  rose: '#FF7C8B',
  red: '#FF7C8B',

  // Semantic
  success: '#72C70D',
  warning: '#FF8A0B',
  error: '#FF7C8B',
  info: '#00E5FF',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const typography = {
  display: { fontSize: 44, fontWeight: '800' as const, letterSpacing: -1 },
  heading: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.5 },
  lead: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.25 },
  subtitle: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  micro: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.3 },
  button: { fontSize: 16, fontWeight: '700' as const },
  // Arabic has no letter-case, and tracking breaks letter joining — so no
  // uppercase / letterSpacing on labels (the old values corrupted Arabic shaping).
  label: { fontSize: 13, fontWeight: '700' as const },
} as const;

// Brand rule (BRAND_GUIDELINES.md): soft navy shadows, never heavy black. Same
// navy as the web shadow tokens (rgba(8,29,57,…)); opacity is raised slightly
// because navy on a navy background reads lighter than the old near-black.
export const shadows = {
  card: {
    shadowColor: '#081D39',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 3,
  },
  lift: {
    shadowColor: '#081D39',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 6,
  },
};

// Matches BRAND_GUIDELINES.md motion spec: 150ms fast, 200ms normal, 280ms slow
export const motion = {
  fast: 150,
  standard: 200,
  slow: 280,
};

export const hitSlop = {
  top: 10,
  right: 10,
  bottom: 10,
  left: 10,
};

/** Minimum comfortable touch target (WCAG 2.5.5 / Material 48dp). */
export const MIN_TOUCH = 48;

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Picks the more legible of dark ink / white for text drawn on `background`.
 * Only understands 6-digit hex; anything else (rgba, named) falls back to ink
 * on brand, which is the safe choice for translucent brand fills.
 */
export function readableTextOn(background: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(background);
  if (!match) return colors.onPrimary;
  const n = parseInt(match[1] as string, 16);
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  const contrastWithInk = (luminance + 0.05) / (0.0074 + 0.05);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithInk >= contrastWithWhite ? colors.onPrimary : '#FFFFFF';
}
