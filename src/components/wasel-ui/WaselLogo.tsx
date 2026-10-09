import type { CSSProperties } from 'react';
import { C } from '@/utils/wasel-ds';

interface WaselLogoProps {
  size?: number;
  showWordmark?: boolean;
  theme?: 'dark' | 'light';
  style?: CSSProperties;
  variant?: 'full' | 'compact';
  framed?: boolean;
  alt?: string;
}

// Symbol is 240×150 viewBox → 8:5 ratio (width = size * 1.6)
const SYMBOL_W_RATIO = 240 / 150; // 1.6

const SYMBOL_SVG  = '/brand/assets/logos/symbols/symbol-default.svg';
const SYMBOL_WEBP = '/brand/assets/logos/symbols/symbol-default.webp';
const SYMBOL_PNG  = '/brand/assets/logos/symbols/symbol-default.png';

function BrandSymbol({ size, framed = false }: { size: number; framed?: boolean }) {
  const w = Math.round(size * SYMBOL_W_RATIO);
  const h = Math.round(size);

  return (
    <picture>
      <source srcSet={SYMBOL_SVG} type="image/svg+xml" />
      <source srcSet={SYMBOL_WEBP} type="image/webp" />
      <img
        src={SYMBOL_PNG}
        alt=""
        aria-hidden="true"
        width={w}
        height={h}
        decoding="async"
        loading="eager"
        draggable={false}
        style={{
          display: 'block',
          width: w,
          height: h,
          objectFit: 'contain',
          flexShrink: 0,
          imageRendering: 'auto',
          filter: framed
            ? `drop-shadow(0 6px 16px ${C.brandBlue}50) drop-shadow(0 2px 6px ${C.brandBlue}30)`
            : undefined,
        }}
      />
    </picture>
  );
}

function BrandName({
  theme,
  size,
  language,
}: {
  theme: 'dark' | 'light';
  size: number;
  language: 'ar' | 'en';
}) {
  const foreground = theme === 'light' ? C.text : C.brandInk;
  // Font scales cleanly: 36px symbol → 18px text, 56px → 26px, 80px → 34px
  const fontSize = Math.round(Math.max(14, Math.min(34, size * 0.46)));
  const gap = Math.round(Math.max(6, fontSize * 0.3));

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        color: foreground,
        fontWeight: 800,
        fontSize,
        lineHeight: 1,
        letterSpacing: '-0.03em',
        whiteSpace: 'nowrap',
        fontFamily: language === 'ar'
          ? "'Cairo', 'Tajawal', Tahoma, Arial, sans-serif"
          : "'Plus Jakarta Sans', 'Inter', sans-serif",
      }}
    >
      {language === 'ar' ? (
        <span lang="ar" dir="rtl" style={{ letterSpacing: 0 }}>واصل</span>
      ) : (
        <span>Wasel</span>
      )}
    </span>
  );
}

export function WaselLogo({
  size = 36,
  showWordmark = true,
  theme = 'dark',
  style,
  variant = 'full',
  framed,
  alt,
}: WaselLogoProps) {
  const language =
    typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const compact = variant === 'compact' || !showWordmark || size < 22;
  // Symbol height: compact uses the raw size, full uses it directly too
  const symbolH = Math.max(compact ? 18 : 28, size);
  const gap = compact ? 0 : Math.round(Math.max(6, size * 0.2));

  return (
    <div
      aria-label={alt ?? (language === 'ar' ? 'واصل' : 'Wasel')}
      role="img"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        minHeight: symbolH,
        ...style,
      }}
    >
      <BrandSymbol size={symbolH} framed={framed} />
      {!compact && <BrandName theme={theme} size={size} language={language} />}
    </div>
  );
}

// ── Convenience exports ────────────────────────────────────────────────────────

/** Symbol-only mark, no wordmark */
export function WaselMark({ size = 36, style }: { size?: number; style?: CSSProperties }) {
  return <WaselLogo size={size} showWordmark={false} style={style} />;
}

/** Large hero mark used on auth brand panel and splash screens */
export function WaselHeroMark({ size = 120 }: { size?: number }) {
  // Clamp: never smaller than 72, scale symbol to 70% of requested size
  return <WaselLogo size={Math.max(72, Math.round(size * 0.7))} theme="light" framed />;
}

/** Tiny inline icon, symbol only */
export function WaselIcon({ size = 20 }: { size?: number }) {
  return <WaselLogo size={size} showWordmark={false} />;
}
