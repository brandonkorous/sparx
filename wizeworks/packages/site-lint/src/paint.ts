// What a node's classes SAY about how it is painted — names and numbers only, no
// theme, no color math. `palette.ts` turns the names into colors; `contrast.ts` judges.
//
// THE LINE THIS FILE HOLDS. silicaui's plugin is a large body of CSS, and re-deriving
// it here to predict a rendered color would be re-implementing it — a second copy that
// drifts on every release and is wrong in ways nobody notices until it accuses a
// working page of being unreadable. So this reads exactly two things, both of which
// are stable and both of which are the AUTHOR's own decision:
//
//   · the color utilities — `.bg-<c>` / `.text-<c>` / `.border-<c>` are pure var
//     setters, and `soft` mixes 15% of whatever color the element declared into
//     `base-100`. That contract is in silicaui's `color-utilities.js` and is what a
//     person is choosing when they pick a background and a text color.
//   · type size and weight, because WCAG's threshold depends on them.
//
// Everything else — a component's own surface (`.card` paints `base-100`, `.btn`
// paints `base-200`), a variant modifier, `glass`, an opacity suffix — is marked
// UNKNOWN rather than guessed. An unknown background is not judged at all. The colors
// a component variant pairs are checked once against the theme instead, where the
// decision actually lives (see `contrast.ts`).

/** How a node and its descendants are painted, as far as the classes reveal. */
export interface PaintContext {
  /** Token naming the background — `primary`, `base-200`. Null when nothing above
   *  has painted one (the page surface). */
  background: string | null;
  /** True when the background is silica's `soft` tint: 15% of `softAccent` mixed
   *  into `base-100`. */
  backgroundSoft: boolean;
  /** The color the soft tint is made from — the element's own declared color,
   *  defaulting to `base-content` exactly as `--u-accent` does. */
  softAccent: string | null;
  /** Something is painting here that this file does not model, so nothing inside
   *  should be judged until a class sets a background again. */
  backgroundUnknown: boolean;
  /** Token naming the text color, inherited. Null means the theme's default ink. */
  text: string | null;
  /** The text color is unresolvable (an opacity suffix, a gradient clip). */
  textUnknown: boolean;
  /** Computed pixel size and weight, both inherited. */
  fontSize: number;
  fontWeight: number;
}

/** The page surface with the theme's default ink, at browser defaults. */
export const ROOT_PAINT: PaintContext = {
  background: null,
  backgroundSoft: false,
  softAccent: null,
  backgroundUnknown: false,
  text: null,
  textUnknown: false,
  fontSize: 16,
  fontWeight: 400,
};

/** Tailwind's type scale in px — the sizes WCAG's large-text threshold is measured
 *  against. `text-base` is a SIZE, not the `base` color, which is why the color
 *  reader has to consult this list first. */
const TEXT_SIZES: Record<string, number> = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
  '7xl': 72,
  '8xl': 96,
  '9xl': 128,
};

const FONT_WEIGHTS: Record<string, number> = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

/** `text-*` values that are not colors and not sizes — alignment, wrapping, case,
 *  decoration. Listed so an unknown remainder can be treated as a color name, which
 *  is what makes a theme's CUSTOM role (`text-brand`) work with no registry here. */
const TEXT_NON_COLOR = new Set([
  'left',
  'center',
  'right',
  'justify',
  'start',
  'end',
  'wrap',
  'nowrap',
  'balance',
  'pretty',
  'ellipsis',
  'clip',
  'uppercase',
  'lowercase',
  'capitalize',
  'current',
  'inherit',
  'transparent',
]);

/** `bg-*` values that are not colors — position, size, attachment, gradients. */
const BG_NON_COLOR = new Set([
  'current',
  'inherit',
  'transparent',
  'none',
  'cover',
  'contain',
  'auto',
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'fixed',
  'local',
  'scroll',
  'repeat',
  'no',
  'origin',
  'clip',
  'blend',
  'gradient',
  'linear',
  'radial',
  'conic',
]);

/**
 * Class prefixes that mean "a silicaui component is painting this element". Their
 * surfaces come from the plugin's base layer, not from anything authored, so the
 * background here is UNKNOWN rather than inherited — a `.card` sitting on a dark
 * section actually paints itself `base-100`, and inheriting the section's dark
 * background would make every word inside it look like a contrast failure.
 *
 * A component that ALSO carries an explicit `bg-<c>` is not unknown: Tailwind's
 * utilities layer outranks the plugin's base layer, so the author's choice is what
 * paints. That precedence is stated in silicaui's own `color-utilities.js`.
 */
const COMPONENT_CLASS =
  /^(btn|badge|alert|card|navbar|menu|dropdown|modal|drawer|dialog|tooltip|popover|table|tabs|tab|input|select|textarea|checkbox|radio|toggle|range|progress|steps|step|breadcrumbs|hero|footer|stat|stats|chat|avatar|kbd|divider|collapse|accordion|carousel|indicator|join|mask|timeline|skeleton|swap|glass|loading|pagination|rating|filter|dock|fieldset|label|field)(-|$)/;

/** Classes whose effect on color this file cannot compute at all. */
function isUnresolvable(token: string): boolean {
  // `bg-primary/50` — an alpha over an unknown backdrop.
  return token.includes('/');
}

/** Split a class string into tokens, dropping variant prefixes (`hover:`, `@2xl:`).
 *  A responsive or state variant paints only sometimes; the base state is what a
 *  page is judged on, so a token that only exists behind a variant is ignored. */
function baseTokens(classString: string): string[] {
  const out: string[] = [];
  for (const raw of classString.split(/\s+/)) {
    if (!raw || raw.includes(':')) continue;
    out.push(raw);
  }
  return out;
}

/**
 * Read one node's classes and produce the context its children inherit.
 *
 * Order matters and follows the cascade: an explicit color utility wins over a
 * component surface, and `soft` reads the color the element just declared.
 */
export function paintOf(parent: PaintContext, classString: string | undefined): PaintContext {
  const tokens = baseTokens(classString ?? '');
  if (tokens.length === 0) return parent;

  let background = parent.background;
  let backgroundSoft = parent.backgroundSoft;
  let softAccent = parent.softAccent;
  let backgroundUnknown = parent.backgroundUnknown;
  let text = parent.text;
  let textUnknown = parent.textUnknown;
  let fontSize = parent.fontSize;
  let fontWeight = parent.fontWeight;

  // The element's own declared color — silica's `--u-accent`, which any of the three
  // axes writes and which `soft` reads back.
  let declared: string | null = null;
  let softBackground = false;
  let softText = false;
  let component = false;
  let unresolvable = false;

  for (const token of tokens) {
    if (isUnresolvable(token)) {
      unresolvable = true;
      continue;
    }

    if (token === 'soft') {
      softBackground = true;
      softText = true;
      continue;
    }
    if (token === 'bg-soft') {
      softBackground = true;
      continue;
    }
    if (token === 'text-soft') {
      softText = true;
      continue;
    }
    if (token === 'border-soft') continue;

    if (token.startsWith('text-')) {
      const value = token.slice(5);
      const size = TEXT_SIZES[value];
      if (size !== undefined) {
        fontSize = size;
        continue;
      }
      if (TEXT_NON_COLOR.has(value)) continue;
      text = value;
      textUnknown = false;
      declared ??= value;
      continue;
    }

    if (token.startsWith('bg-')) {
      const value = token.slice(3);
      // `bg-no-repeat`, `bg-gradient-to-r`, `bg-clip-text` — matched on the FIRST
      // segment, because a color name can also be hyphenated (`base-100`).
      if (BG_NON_COLOR.has(value) || BG_NON_COLOR.has(value.split('-')[0] ?? '')) continue;
      background = value;
      backgroundSoft = false;
      backgroundUnknown = false;
      declared ??= value;
      continue;
    }

    if (token.startsWith('border-')) {
      const value = token.slice(7);
      // `border-2`, `border-t` are widths and sides, not colors.
      if (/^\d/.test(value) || ['t', 'r', 'b', 'l', 'x', 'y', 's', 'e'].includes(value)) continue;
      declared ??= value;
      continue;
    }

    if (token.startsWith('font-')) {
      const weight = FONT_WEIGHTS[token.slice(5)];
      if (weight !== undefined) fontWeight = weight;
      continue;
    }

    if (COMPONENT_CLASS.test(token)) component = true;
  }

  const accent = declared ?? 'base-content';

  if (softBackground) {
    background = null;
    backgroundSoft = true;
    softAccent = accent;
    backgroundUnknown = false;
  } else if (component && background === parent.background) {
    // A component surface with no authored background of its own.
    backgroundUnknown = true;
    backgroundSoft = false;
  }

  if (softText) {
    text = accent;
    textUnknown = false;
  }
  if (unresolvable) {
    backgroundUnknown = true;
    textUnknown = true;
  }

  return {
    background,
    backgroundSoft,
    softAccent,
    backgroundUnknown,
    text,
    textUnknown,
    fontSize,
    fontWeight,
  };
}

/** WCAG's "large text": 24px and up, or 18.66px and up when bold. Large text gets a
 *  3:1 threshold rather than 4.5:1 — bigger letterforms stay legible at lower
 *  contrast, and holding display type to the body-copy bar would flag every hero on
 *  the platform. */
export function isLargeText(paint: PaintContext): boolean {
  return paint.fontSize >= 24 || (paint.fontSize >= 18.66 && paint.fontWeight >= 700);
}
