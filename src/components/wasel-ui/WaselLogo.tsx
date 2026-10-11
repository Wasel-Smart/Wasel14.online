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

// Primary brand lockup (logo-default): the interlocking blue/orange/green
// route mark with the bilingual wordmark.
// SVG viewBox is 1929×341 → width = height × 1929/341.
const LOGO_SVG = '/brand/assets/logos/primary/logo-default.svg';
const LOGO_PNG = '/brand/assets/logos/primary/logo-default.png';
const LOGO_W_RATIO = 1929 / 341;

function BrandLockup({ size, framed = false }: { size: number; framed?: boolean }) {
  const h = Math.round(size);
  const w = Math.round(size * LOGO_W_RATIO);

  return (
    <picture>
      <source srcSet={LOGO_SVG} type="image/svg+xml" />
      <img
        src={LOGO_PNG}
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
          // Soft, low-alpha halo (brand guide: no heavy glow). Was 33% / 19% cyan.
          filter: framed
            ? `drop-shadow(0 6px 18px ${C.brandBlue}33) drop-shadow(0 2px 8px ${C.brandBlue}1A)`
            : undefined,
        }}
      />
    </picture>
  );
}

export function WaselLogo({
  size = 36,
  showWordmark = true,
  style,
  variant = 'full',
  framed,
  alt,
}: WaselLogoProps) {
  const language =
    typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const compact = variant === 'compact' || !showWordmark || size < 22;
  // The lockup already carries the wordmark, so every variant renders it;
  // compact spots simply scale the same artwork down.
  const lockupH = Math.max(compact ? 18 : 28, size);

  return (
    <div
      aria-label={alt ?? (language === 'ar' ? 'واصل' : 'Wasel')}
      role="img"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: lockupH,
        ...style,
      }}
    >
      <BrandLockup size={lockupH} framed={framed} />
    </div>
  );
}

/** Symbol-only mark, no wordmark */
export function WaselMark({ size = 36, style }: { size?: number; style?: CSSProperties }) {
  return <WaselLogo size={size} showWordmark={false} style={style} />;
}

/** Large hero mark for auth brand panel and splash screens */
export function WaselHeroMark({ size = 120 }: { size?: number }) {
  return <WaselLogo size={Math.max(72, Math.round(size * 0.7))} theme="light" framed />;
}

/** Tiny inline icon, symbol only */
export function WaselIcon({ size = 20 }: { size?: number }) {
  return <WaselLogo size={size} showWordmark={false} />;
}
