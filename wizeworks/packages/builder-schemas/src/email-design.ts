// Email visual design tokens — the FIXED pixel scale a Builder email renders at,
// independent of the tenant brand (which only swaps font-family + colors, never
// the size scale). This is the single source of truth shared by BOTH ends of the
// email pipeline:
//   · the real renderer — `@wizeworks/email`'s primitives (`components/tokens.ts`
//     re-exports these as `typography` / `spacing` / `colors` / `radius` /
//     `fontFamily`), inlined onto table-based React Email markup at send;
//   · the Email Builder CANVAS preview — `apps/dashboard`'s email leaf renderer,
//     which paints the SAME scale as real DOM so the editor reads like the email
//     instead of the storefront's hero typography.
// Keeping the numbers here (a pure, client+server-safe module, like the rest of
// this package) is what stops the canvas and the actual send from drifting.
//
// Values mirror the email design system (docs/52): a fixed monochrome chrome with
// a single sparx Indigo accent. Hex strings (mail clients strip <style> blocks and
// ignore CSS variables, so every value ends up inlined); typography line-heights
// are px (a unitless ratio would be reinterpreted against client-injected sizes).

export const EMAIL_DESIGN = {
  /** Default family — the tenant brand overrides this per-send, but the canvas
   *  falls back to it when no brand font is compiled. */
  fontFamily: 'Helvetica, Arial, sans-serif',
  colors: {
    brand: '#e04631', // sparx spark — accent only, never large fills.
    textPrimary: '#0F172A',
    textMuted: '#64748B',
    textInverse: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    border: '#E2E8F0',
    calloutInfoBg: '#EEF2FF',
    calloutWarnBg: '#FEF3C7',
    calloutSuccessBg: '#ECFDF5',
  },
  // Typography scale. `lineHeight` in px so mail clients don't read the unitless
  // number as a ratio against a client-injected font size.
  typography: {
    heading: {
      fontSize: 20,
      fontWeight: 500,
      lineHeight: '28px',
      letterSpacing: '-0.01em',
    },
    subheading: {
      fontSize: 16,
      fontWeight: 500,
      lineHeight: '24px',
    },
    body: {
      fontSize: 16,
      fontWeight: 400,
      lineHeight: '24px',
    },
    muted: {
      fontSize: 12,
      fontWeight: 400,
      lineHeight: '18px',
    },
  },
  radius: {
    button: 6,
    callout: 8,
  },
  // Vertical rhythm — multiples of 8 read best in email.
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
} as const;
