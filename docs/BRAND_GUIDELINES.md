# Wasel | واصل brand guidelines

> **Canonical document.** This is the single source of truth for the Wasel brand.
> `brand/BRAND_BOOK.md` and `brand/BRAND_GUIDELINES.md` are historical and defer to this file.
> Code tokens live in `src/utils/wasel-ds.ts`; if code and this document disagree, fix the code.

## Core identity

Wasel connects people, places, and movement. Use the three-colour symbol as the primary visual anchor and the bilingual name **واصل | wasel** as the default product lockup.

## Master palette

### Primary brand colours

| Role | Token | Value |
| --- | --- | --- |
| Brand ink | `--wasel-brand-ink` | `#081D39` |
| Connection blue | `--wasel-brand-blue` | `#00E5FF` |
| Movement green | `--wasel-brand-green` | `#72C70D` |
| Journey orange | `--wasel-brand-orange` | `#FF8A0B` |

Use brand ink for text and dark surfaces. Use blue as the principal interactive colour; reserve green and orange for positive movement, package progress, and supporting emphasis.

### Supporting accents

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Gold | `--wasel-gold` | `#FFBE5C` | Premium badges, rewards, Wasel Plus |
| Bronze | `--wasel-bronze` | `#FFBE5C` | Subscription tier indicators |
| Purple | `--wasel-purple` | `#8FA6FF` | Special status, VIP, trust signals |
| Teal / Cyan | `--wasel-teal` | `#66e0ff` | Information, maps, data viz |
| Lime | `--wasel-lime` | `#9AF1CF` | Secondary success, eco/movement themes |

Supporting accents must never overpower the primary brand colours. Use them sparingly for badges, secondary CTAs, and status indicators only.

## Logo rules

- Use `WaselLogo` everywhere in product UI. It centralizes the approved mark, bilingual lockup, sizing, contrast, and accessible name.
- Use the full lockup in headers, auth, page heroes, and offline states. Use the symbol-only variant only below 24px or where space is genuinely constrained.
- Maintain clear space equal to at least 20% of the symbol height. Do not stretch, recolour, outline, rotate, add text inside, or place the mark over busy imagery.
- Keep the mark at least 32px high in navigation, 48px in prominent page headers, and 72px in hero/auth contexts. PWA icons use the approved dark-background exports.
- The logo drop-shadow (when framed) uses brand cyan at low alpha (`#00E5FF` at 20% / 10%), matching `WaselLogo`. Never gold.
- Logo variants must be genuinely different files: `logo-light` (white wordmark, for dark surfaces) and `logo-dark` (ink wordmark, for light surfaces). Never ship an ink wordmark on an ink background — verify every new export on both `#081D39` and `#FFFFFF`.
- Social/OG images are 1200×630 and must show the full wordmark legibly (`public/brand/assets/og/og-default.png`).

## Typography and direction

Use the Arabic name `واصل` with Cairo/Tajawal where available; use the same visual weight as `wasel`. Keep bilingual product names together as `واصل | wasel`, with Arabic rendered RTL. Arabic body copy uses a more generous line-height than English.

## Token naming

Code and docs use one vocabulary: `brandBlue` (#00E5FF, interactive), `brandGreen` (#72C70D, success/movement), `brandOrange` (#FF8A0B, parcels/urgency), `brandInk` (#081D39). Names such as `brandCyan`, `brandLime` and `brandEmber` are retired. `lime` (#9AF1CF) is a *supporting* tint only, never the success colour. `cyan` / `blue` / `bronze` are deprecated aliases; use `brandBlue` / `gold`.

## Accessibility (measured WCAG 2.1 contrast)

| Foreground | Background | Ratio | Result |
| --- | --- | --- | --- |
| `#F8FBFF` text | `#081D39` ink | 16.3:1 | AAA |
| `#00E5FF` cyan | `#081D39` ink | 11.0:1 | AAA |
| `#72C70D` green | `#081D39` ink | 7.9:1 | AAA |
| `#FF8A0B` orange | `#081D39` ink | 7.1:1 | AAA |
| `#FFBE5C` gold | `#081D39` ink | 10.3:1 | AAA |
| `#FF7C8B` rose (errors) | `#081D39` ink | 6.8:1 | AA |
| `#95B2C9` muted text | `#081D39` ink | 7.6:1 | AAA |
| `#081D39` ink text | `#FF8A0B` orange fill | 7.1:1 | AAA |
| `#FFFFFF` text | `#FF8A0B` orange fill | 2.4:1 | **Fails — never use** |
| `#FFFFFF` text | `#FF7C8B` rose fill | 2.5:1 | **Fails — never use** |

Rule: text on orange, gold, rose, green or cyan fills is always ink (`#081D39`), never white.

## Touch targets and sizing

Buttons: `sm` 44px, `md` 48px, `lg` 56px high. Inputs 50px. Nothing interactive is smaller than 44×44px.

## Surfaces and motion

Prefer a calm ink/navy surface with high-contrast text. Shadows should be soft blue/navy, never heavy black. Motion is brief and purposeful (150–250ms); do not animate the logo continuously or introduce distracting glow effects.

### Shadow rules

All shadows must use soft blue/navy tones:

```
--wasel-shadow-sm: 0 1px 4px rgba(8,29,57,0.35)
--wasel-shadow-md: 0 4px 20px rgba(8,29,57,0.4)
--wasel-shadow-lg: 0 8px 40px rgba(8,29,57,0.45)
--wasel-shadow-blue: 0 4px 28px rgba(20,127,228,0.18)
--wasel-shadow-green: 0 4px 28px rgba(114,199,13,0.18)
--wasel-shadow-orange: 0 4px 28px rgba(255,138,11,0.2)
```

Never use `rgba(0, 0, 0, ...)` for shadows.

### Motion rules

- Durations: 150ms (fast), 200ms (normal), 280ms (slow)
- Easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` for spring, `cubic-bezier(0.4, 0, 0.2, 1)` for standard
- Pulse animations are opacity-only — no glow, no box-shadow animation
- Border emphasis uses colour shifts only, not glow spreads

## RTL Arabic support

All interactive components must support RTL:

- Layout direction follows `dir` attribute on root
- Sidebar border flips from `border-right` to `border-left`
- Margin/padding directional utilities use logical properties or `[dir='rtl']` overrides
- Select chevrons position on the correct side
- Icon arrows mirror in RTL contexts
- Text alignment respects direction — never force `textAlign: 'left'` in shared components
