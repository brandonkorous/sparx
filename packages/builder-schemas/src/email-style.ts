// Email-safe class → inline-style compiler (docs/98 §3.6c, Email v2).
//
// The web surface compiles a node's Tailwind `class` to per-tenant `tenant.css`
// (`@sparx/surface-compile`). Mail clients strip <style> blocks and ignore CSS
// variables, so email can't use that path — every value must be a concrete inline
// style on the element. This module is the email analog: it parses the EMAIL-SAFE
// SUBSET of a node's class string into a plain inline-style object the email
// renderer (and the editor's email canvas preview) spread onto the element.
//
// Email-safe = what mail clients render reliably: typography (size/weight/leading/
// tracking/style/decoration/transform), color (text/bg/border, with opacity), the
// box model (padding/margin/border/radius), and text alignment. Deliberately NOT
// here (no email analogue / unreliable): flex & grid, position, hover/focus states,
// responsive breakpoints, transforms, filters, animation. Those tokens are dropped,
// not errored — an author's web-minded class simply contributes what email supports.
//
// Pure (no React, no DOM), like the rest of this package: it returns a plain
// `Record<string, string | number>` structurally compatible with React.CSSProperties.
// Colors are resolved against an `EmailPalette` the caller passes in (the resolved
// tenant brand) — keeping this module brand-agnostic and free of the @sparx/email
// dependency (which depends on US, not the other way around).

/** The resolved brand colors a class's color tokens map onto (a subset of
 *  @sparx/email's BrandTokens, passed in so this stays pure). */
export interface EmailPalette {
  primary: string;
  primaryForeground: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
}

/** A plain inline-style object (string/number values), spread onto an element's
 *  `style`. A subset of React.CSSProperties — kept React-free here. */
export type EmailStyle = Record<string, string | number>;

// ── Exact-match utility tables ─────────────────────────────────────────────────

const TEXT_SIZE: Record<string, number> = {
  'text-xs': 12,
  'text-sm': 14,
  'text-base': 16,
  'text-lg': 18,
  'text-xl': 20,
  'text-2xl': 24,
  'text-3xl': 30,
  'text-4xl': 36,
  'text-5xl': 48,
};

const FONT_WEIGHT: Record<string, number> = {
  'font-thin': 100,
  'font-extralight': 200,
  'font-light': 300,
  'font-normal': 400,
  'font-medium': 500,
  'font-semibold': 600,
  'font-bold': 700,
  'font-extrabold': 800,
  'font-black': 900,
};

const LEADING: Record<string, number> = {
  'leading-none': 1,
  'leading-tight': 1.25,
  'leading-snug': 1.375,
  'leading-normal': 1.5,
  'leading-relaxed': 1.625,
  'leading-loose': 2,
};

const TRACKING: Record<string, string> = {
  'tracking-tighter': '-0.05em',
  'tracking-tight': '-0.025em',
  'tracking-normal': '0',
  'tracking-wide': '0.025em',
  'tracking-wider': '0.05em',
  'tracking-widest': '0.1em',
};

// rounded-box / -field / -selector are the platform's semantic radii (web maps them
// to the tenant theme; email pins them to the fixed pixel scale).
const RADIUS: Record<string, number> = {
  'rounded-none': 0,
  'rounded-sm': 2,
  rounded: 4,
  'rounded-md': 6,
  'rounded-lg': 8,
  'rounded-xl': 12,
  'rounded-2xl': 16,
  'rounded-3xl': 24,
  'rounded-full': 9999,
  'rounded-box': 8,
  'rounded-field': 6,
  'rounded-selector': 9999,
};

const ALIGN: Record<string, string> = {
  'text-left': 'left',
  'text-center': 'center',
  'text-right': 'right',
  'text-justify': 'justify',
};

const TRANSFORM: Record<string, string> = {
  uppercase: 'uppercase',
  lowercase: 'lowercase',
  capitalize: 'capitalize',
  'normal-case': 'none',
};

const DECORATION: Record<string, string> = {
  underline: 'underline',
  'line-through': 'line-through',
  'no-underline': 'none',
  overline: 'overline',
};

const BORDER_WIDTH: Record<string, number> = {
  border: 1,
  'border-0': 0,
  'border-2': 2,
  'border-4': 4,
  'border-8': 8,
};

// Email-literal semantic colors (the token system has no email vars; these are the
// fixed, mail-safe equivalents of the platform's status palette).
const SEMANTIC: Record<string, string> = {
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
  highlight: '#6366F1',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};
const SEMANTIC_CONTENT = '#FFFFFF';

// ── Color resolution ───────────────────────────────────────────────────────────

/** A color token (the part after `text-`/`bg-`/`border-`, opacity already split
 *  off) → a concrete hex/keyword, or null when it isn't a known color. */
function resolveColor(token: string, palette: EmailPalette): string | null {
  switch (token) {
    case 'base-100':
      return palette.background;
    case 'base-200':
    case 'base-300':
      return palette.muted;
    case 'base-content':
      return palette.foreground;
    case 'primary':
      return palette.primary;
    case 'primary-content':
      return palette.primaryForeground;
    case 'secondary':
    case 'accent':
      return palette.accent;
    case 'secondary-content':
    case 'accent-content':
      return palette.primaryForeground;
    case 'neutral':
      return palette.foreground;
    case 'neutral-content':
      return palette.background;
    case 'border':
      return palette.border;
    default:
      if (token in SEMANTIC) return SEMANTIC[token]!;
      if (token.endsWith('-content')) return SEMANTIC_CONTENT;
      return null;
  }
}

/** Apply an alpha (0–100) to a hex color → `#rrggbbaa`. Keywords/`transparent` and
 *  already-aliased colors pass through unchanged (alpha only applies to 6-hex). */
function withAlpha(color: string, opacity: number | null): string {
  if (opacity === null || opacity >= 100) return color;
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const a = Math.round((Math.max(0, opacity) / 100) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${a}`;
}

/** Split a color utility value into its token + optional `/opacity` (e.g.
 *  `base-content/60` → `['base-content', 60]`). */
function splitOpacity(value: string): [string, number | null] {
  const slash = value.lastIndexOf('/');
  if (slash === -1) return [value, null];
  const op = Number(value.slice(slash + 1));
  return Number.isFinite(op) ? [value.slice(0, slash), op] : [value, null];
}

// ── The compiler ───────────────────────────────────────────────────────────────

const SPACING_RE = /^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml)-(\d+(?:\.\d+)?)$/;
const SPACING_PROP: Record<string, string[]> = {
  p: ['padding'],
  px: ['paddingLeft', 'paddingRight'],
  py: ['paddingTop', 'paddingBottom'],
  pt: ['paddingTop'],
  pr: ['paddingRight'],
  pb: ['paddingBottom'],
  pl: ['paddingLeft'],
  m: ['margin'],
  mx: ['marginLeft', 'marginRight'],
  my: ['marginTop', 'marginBottom'],
  mt: ['marginTop'],
  mr: ['marginRight'],
  mb: ['marginBottom'],
  ml: ['marginLeft'],
};
const MARGIN_AXES: Record<string, string[]> = {
  'mx-auto': ['marginLeft', 'marginRight'],
  'm-auto': ['margin'],
};

/** Apply one email-safe token to the accumulating style. Unknown / web-only tokens
 *  are no-ops. */
function applyToken(token: string, style: EmailStyle, palette: EmailPalette): void {
  if (token in TEXT_SIZE) {
    style.fontSize = TEXT_SIZE[token]!;
    return;
  }
  if (token in FONT_WEIGHT) {
    style.fontWeight = FONT_WEIGHT[token]!;
    return;
  }
  if (token in LEADING) {
    style.lineHeight = LEADING[token]!;
    return;
  }
  if (token in TRACKING) {
    style.letterSpacing = TRACKING[token]!;
    return;
  }
  if (token in RADIUS) {
    style.borderRadius = RADIUS[token]!;
    return;
  }
  if (token in ALIGN) {
    style.textAlign = ALIGN[token]!;
    return;
  }
  if (token in TRANSFORM) {
    style.textTransform = TRANSFORM[token]!;
    return;
  }
  if (token in DECORATION) {
    style.textDecoration = DECORATION[token]!;
    return;
  }
  if (token === 'italic') {
    style.fontStyle = 'italic';
    return;
  }
  if (token === 'not-italic') {
    style.fontStyle = 'normal';
    return;
  }
  if (token === 'w-full') {
    style.width = '100%';
    return;
  }
  if (token === 'h-full') {
    style.height = '100%';
    return;
  }
  if (token in MARGIN_AXES) {
    for (const prop of MARGIN_AXES[token]!) style[prop] = 'auto';
    return;
  }
  if (token in BORDER_WIDTH) {
    style.borderWidth = BORDER_WIDTH[token]!;
    style.borderStyle = 'solid';
    style.borderColor ??= palette.border;
    return;
  }
  const spacing = SPACING_RE.exec(token);
  if (spacing) {
    const px = Number(spacing[2]) * 4; // Tailwind's 0.25rem step at 16px root.
    for (const prop of SPACING_PROP[spacing[1]!]!) style[prop] = px;
    return;
  }
  // Color utilities last, so `text-center`/`text-sm` (exact-matched above) never
  // fall through to color parsing.
  const dash = token.indexOf('-');
  if (dash !== -1) {
    const kind = token.slice(0, dash);
    if (kind === 'text' || kind === 'bg' || kind === 'border') {
      const [name, opacity] = splitOpacity(token.slice(dash + 1));
      const color = resolveColor(name, palette);
      if (color === null) return;
      const value = withAlpha(color, opacity);
      if (kind === 'text') style.color = value;
      else if (kind === 'bg') style.backgroundColor = value;
      else {
        style.borderColor = value;
        if (style.borderStyle === undefined) {
          style.borderStyle = 'solid';
          style.borderWidth = 1;
        }
      }
    }
  }
}

/** Compile a node's `class` string into an email-safe inline-style object. Variant-
 *  prefixed tokens (`hover:`, `md:`, `dark:`, `@lg:`, …) are dropped — email has no
 *  states or breakpoints, only the base look. Returns {} for an empty/undefined class. */
export function emailStyleFor(cls: string | undefined, palette: EmailPalette): EmailStyle {
  const style: EmailStyle = {};
  if (!cls) return style;
  for (const raw of cls.split(/\s+/)) {
    if (!raw) continue;
    // Drop any variant-prefixed token (state / breakpoint / theme) — the colon is a
    // variant separator unless it's inside an arbitrary `[…]` value, which email
    // doesn't support anyway, so a bracketed token is also dropped.
    if (raw.includes(':') || raw.includes('[')) continue;
    applyToken(raw, style, palette);
  }
  return style;
}
