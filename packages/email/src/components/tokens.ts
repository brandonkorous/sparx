// Email design tokens. The VALUES live in `@sparx/builder-schemas`'s
// `EMAIL_DESIGN` (a pure, client+server-safe module) so the real renderer here and
// the Email Builder canvas preview (apps/dashboard) paint the exact same scale and
// can't drift. This module just re-exports them under the names the @sparx/email
// primitives already use — hex strings (no CSS variables) because mail clients
// strip <style> blocks and every value ends up inlined on the rendered element.

import { EMAIL_DESIGN } from '@sparx/builder-schemas';

export const colors = EMAIL_DESIGN.colors;

// Typography scale. `lineHeight` is in px so mail clients don't interpret the
// unitless number as a ratio against client-injected font sizes.
export const typography = EMAIL_DESIGN.typography;

export const radius = EMAIL_DESIGN.radius;

// Vertical rhythm. Most spacing in emails reads better as multiples of 8.
export const spacing = EMAIL_DESIGN.spacing;

export const fontFamily = EMAIL_DESIGN.fontFamily;

// ────────────────────────────────────────────────────────────────────────
// "Signal" — the sparx PLATFORM email design system (the redesign).
//
// These tokens drive the coded sparx→owner templates via `PlatformEmailLayout`
// and the structural block components (steps / receipt / timeline / …). They are
// DELIBERATELY separate from `EMAIL_DESIGN` above (which the tenant Email Builder
// canvas mirrors) so the platform look can evolve without shifting the builder's
// scale. Every value is a concrete hex/px — mail clients strip <style> and ignore
// CSS variables, so everything ends up inlined on the element.
//
// The palette is sparx's own: Ember (#e04631, the spark + the one action that
// matters) on a sparx-ink (#0c1433) masthead, structural ink for text, and
// semantic hues used ONLY when state actually changes. Body copy always gets a
// real ink (`body`), never a faded grey — muted (`meta`) is reserved for genuine
// metadata (a receipt number, a footer legal line).
// ────────────────────────────────────────────────────────────────────────

export const signal = {
  // Brand
  ember: '#e04631',
  emberContent: '#ffffff',
  emberDeep: '#c13a28', // button base edge / pressed depth
  ink: '#0c1433', // masthead band + headings
  inkContent: '#ffffff',
  inkMeta: '#97a0bd', // meta text ON the ink masthead

  // Surfaces
  paper: '#ffffff', // the card
  canvas: '#eceef2', // page behind the card
  footBg: '#fafafc', // footer well
  line: '#e8eaf0', // hairlines / borders

  // Text — body is a REAL ink (readable); meta is the only muted role, and only
  // for true metadata. Labels get a legible mid-ink, never a faded grey.
  heading: '#0c1433',
  body: '#2b3242',
  lead: '#3a4152',
  label: '#4b5563',
  meta: '#5b6472',

  // Semantic — earned, never decoration.
  success: '#0f8a5f',
  successBg: '#e7f6ef',
  warn: '#b45309',
  warnBg: '#fbeed9',
  warnInk: '#7c3a06',
  danger: '#c13a28',
  dangerBg: '#fdece9',
  info: '#3b5bdb',
  infoBg: '#eef2ff',

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
