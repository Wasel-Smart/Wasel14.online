import { StyleSheet } from 'react-native';

/**
 * Brand typeface: Cairo (Arabic + Latin, one coherent family).
 *
 * React Native ignores `fontWeight` for custom fonts on Android and picks
 * faces inconsistently on iOS, so each weight must map to its own family name.
 * Rather than edit every `fontWeight` in ~30 screens, we wrap
 * `StyleSheet.create` once: any *text* style that has no explicit
 * `fontFamily` is given the Cairo face matching its `fontWeight`.
 *
 * This must run before any screen module calls `StyleSheet.create`
 * (it is imported first in index.js).
 */
export function fontFamilyForWeight(weight?: string | number): string {
  const raw = String(weight ?? '400');
  if (raw === 'bold') return 'Cairo_700Bold';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 400) return 'Cairo_400Regular';
  if (n <= 500) return 'Cairo_500Medium';
  if (n <= 600) return 'Cairo_600SemiBold';
  if (n <= 700) return 'Cairo_700Bold';
  return 'Cairo_800ExtraBold';
}

// Keys that only exist on text styles — Views never use these.
const TEXT_ONLY_KEYS = [
  'fontSize',
  'fontWeight',
  'color',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  'includeFontPadding',
];

function withBrandFont(style: unknown): unknown {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return style;
  const record = style as Record<string, unknown>;
  if ('fontFamily' in record) return style;
  if (!TEXT_ONLY_KEYS.some((key) => key in record)) return style;
  const { fontWeight, ...rest } = record;
  return { ...rest, fontFamily: fontFamilyForWeight(fontWeight as string | number | undefined) };
}

let installed = false;

export function installBrandFont(): void {
  if (installed) return;
  installed = true;
  const originalCreate = StyleSheet.create.bind(StyleSheet);
  StyleSheet.create = (styles: Record<string, unknown>) => {
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(styles)) {
      next[key] = withBrandFont(styles[key]);
    }
    return originalCreate(next);
  };
}

installBrandFont();
