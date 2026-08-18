// Email design tokens. The VALUES live in `@wizeworks/builder-schemas`'s
// `EMAIL_DESIGN` (a pure, client+server-safe module) so the real renderer here and
// the Email Builder canvas preview (apps/dashboard) paint the exact same scale and
// can't drift. This module just re-exports them under the names the @wizeworks/email
// primitives already use — hex strings (no CSS variables) because mail clients
// strip <style> blocks and every value ends up inlined on the rendered element.

import { EMAIL_DESIGN } from '@wizeworks/builder-schemas';

export const colors = EMAIL_DESIGN.colors;

// Typography scale. `lineHeight` is in px so mail clients don't interpret the
// unitless number as a ratio against client-injected font sizes.
export const typography = EMAIL_DESIGN.typography;

export const radius = EMAIL_DESIGN.radius;

// Vertical rhythm. Most spacing in emails reads better as multiples of 8.
export const spacing = EMAIL_DESIGN.spacing;

export const fontFamily = EMAIL_DESIGN.fontFamily;

// ────────────────────────────────────────────────────────────────────────
// "Signal" — the PLATFORM email design system (the redesign).
//
// These tokens drive the coded platform→owner templates via
// `PlatformEmailLayout` and the structural block components (steps / receipt /
// timeline / …). They are DELIBERATELY separate from `EMAIL_DESIGN` above (which
// the tenant Email Builder canvas mirrors) so the platform look can evolve
// without shifting the builder's scale.
//
// ── NO COLOR LIVES HERE ─────────────────────────────────────────────────
//
// This object is STRUCTURE: the type scale, the rhythm, the radii, the font
// stacks. Every one of those is the same decision under any brand, which is what
// makes it platform code.
//
// The colors used to be here too — Ember `#e04631` on a `#0c1433` masthead, with
// the comment "the palette is sparx's own". One email worker drains the queue
// for both brands, so "sparx's own" was being painted onto a Piggles owner's
// password reset. They now resolve per send from `@wizeworks/brand-core`'s
// `resolveEmailPalette` and reach a component through `usePalette()`. If you are
// about to add a hex to this file, the value belongs in a brand's
// `<BRAND>_EMAIL_PALETTE` instead — and if it is genuinely brand-blind, it
// belongs in `PLAIN_EMAIL_PALETTE` beside the rest of the fallback.
// ────────────────────────────────────────────────────────────────────────

export const signal = {
  // Body/heading stack — system fonts, the honest choice for email (clients strip
  // webfonts, so a linked face silently falls back). Set on every text element,
  // because Outlook does NOT inherit font-family and defaults to Times otherwise.
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",

  // Monospace stack for money + codes (tabular alignment).
  mono: "'SFMono-Regular', ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",

  radius: { card: 12, button: 8, box: 12, pill: 999 },

  space: { xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40 },

  // Type scale — a real display open, comfortable body, tabular figures. Line
  // heights are px so clients don't reinterpret a unitless ratio.
  type: {
    display: { fontSize: 30, lineHeight: '36px', fontWeight: 800, letterSpacing: '-0.025em' },
    title: { fontSize: 22, lineHeight: '28px', fontWeight: 800, letterSpacing: '-0.02em' },
    lead: { fontSize: 18, lineHeight: '28px', fontWeight: 400 },
    body: { fontSize: 16, lineHeight: '26px', fontWeight: 400 },
    label: {
      fontSize: 13,
      lineHeight: '18px',
      fontWeight: 700,
      letterSpacing: '0.05em',
    },
    meta: { fontSize: 13, lineHeight: '20px', fontWeight: 400 },
    amount: { fontSize: 44, lineHeight: '46px', fontWeight: 700, letterSpacing: '-0.02em' },
  },
} as const;
