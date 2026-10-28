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

// SVG viewBox is 1673×940 → width = height × 1673/940.
const LOGO_W_RATIO = 1673 / 940;

// Theme-aware asset paths. 'dark' variant = dark-coloured mark for light
// backgrounds. 'light' variant = light-coloured mark for dark backgrounds.
const LOGO_ASSETS: Record<'dark' | 'light', { svg: string; png: string }> = {
  dark:  { svg: '/brand/assets/logos/primary/logo-dark.svg',  png: '/brand/assets/logos/primary/logo-dark.png'  },
  light: { svg: '/brand/assets/logos/primary/logo-light.svg', png: '/brand/assets/logos/primary/logo-light.png' },
};

function BrandLockup({ size, theme = 'light', framed = false }: { size: number; theme?: 'dark' | 'light'; framed?: boolean }) {
  const h = Math.round(size);
  const w = Math.round(size * LOGO_W_RATIO);
  const { svg, png } = LOGO_ASSETS[theme];

  return (
    <picture>
      {/* The light (dark-surface) lockup is PNG-only until a true vector with a white
          wordmark exists: the legacy logo-light.svg embeds the ink wordmark and would
          be invisible on #081D39. */}
      {theme === 'dark' && <source srcSet={svg} type="image/svg+xml" />}
      <img
        src={png}
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
          // Soft, low-alpha halo (brand guide: no heavy glow).
          filter: framed
            ? `drop-shadow(0 6px 18px ${C.brandBlue}33) drop-shadow(0 2px 8px ${C.brandBlue}1A)`
            : undefined,
        }}
      />
    </picture>
  );
}

export function WaselLogo(props: WaselLogoProps) {
  const {
    size = 36,
    showWordmark = true,
    style,
    variant = 'full',
    framed,
    alt,
  } = props;
  const language =
    typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const compact = variant === 'compact' || !showWordmark || size < 22;
  const lockupH = Math.max(compact ? 18 : 28, size);
  // Default to 'light' (white mark) so it renders correctly on the dark app
  // shell. Pass theme="dark" explicitly when placing on a light background.
  const resolvedTheme = (props as WaselLogoProps).theme ?? 'light';

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
      <BrandLockup size={lockupH} theme={resolvedTheme} framed={framed} />
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
