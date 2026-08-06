// sparx's own theme shelves — the platform theme catalog the Site Builder offers
// above silica's shipped presets (`BuilderHost.themes`).
//
// WHY A SECOND LIBRARY AT ALL. silica ships twenty presets named for what they
// look like — quartz, obsidian, neon. That is the right vocabulary for a design
// system, and the wrong one for the person these themes are actually for: a
// business owner who does not think of their site as "editorial" or "high
// chroma", and who cannot tell from the word `marble` whether it suits a dental
// practice. So sparx's shelves are named for the BUSINESS, not the palette —
// `clinic`, `workshop`, `kitchen` — and each one is tuned to look like that
// trade already made the decisions. Picking is recognition, not taste.
//
// The two libraries stack rather than compete: silica's answers "what look do I
// want", sparx's answers "what do I do". Nothing here hides a shipped preset,
// and no name collides with one (the builder would shadow it — see
// `themeShelves`), nor with the marketplace data themes or the storefront
// presets in @sparx/site-themes.
//
// Every theme is a COMPLETE look — palette, type pairing, and shape language —
// and states a full light AND dark palette. `themes.test.ts` holds the bar:
// WCAG AA on every role and on body text over every surface, in both modes.
//
// GROUND — the axis that makes these twenty actually different.
//
// The first draft of this file varied only HUE, and it was a failure worth
// recording. Measured, its five "Shops & dining" themes shared a page lightness
// of 97–99% (a two-point spread), a page chroma of .004–.012, and a dark primary
// in every single one. Five recipes that differed by a hue rotation, which is the
// weakest axis available: the page is the largest thing on screen, and giving all
// of them the same near-white one meant nothing else could rescue the difference.
//
// So a theme now commits to a GROUND, and the shelves deliberately spread across
// all four:
//
//   paper  — near-white, chroma ≤ .008. The default assumption, now earned.
//   tinted — visibly colored and still light (95–97%, chroma .025–.04). At the
//            old .006 chroma a "cream" and a "blush" were the same pixel.
//   mid    — genuinely muted (89–93%). Reads as parchment or tan, not as white.
//   dark   — a DARK page in light mode. A wine bar, a body shop and a music venue
//            are low-lit rooms; their sites should be too, in both modes. Their
//            "dark mode" then goes fully black rather than inverting.
//
// And to PRIMARY, which had the same problem — every one was a dark fill carrying
// white ink. `mono` (near-black or near-white), `deep` (32–52%, white ink) and
// `bright` (74–86%, dark ink) are all in play now; a bright primary is a wholly
// different-looking control and the first draft used none.
//
// Each theme's comment names its ground and primary strategy. Keep the spread when
// editing: `themes.test.ts` asserts the shelves stay varied, so collapsing them
// back toward white-page/dark-primary fails as a test, not as a later complaint.

import type { SemanticRole, Theme } from '@wizeworks/silicaui-html';

/** One mode's complete palette. Both modes are required — a partial dark is how
 *  a theme ends up painting a light-mode fill onto a dark surface. */
export interface Palette {
  /** `base-100`, `base-200`, `base-300`, `base-content`, in that order. */
  surfaces: [string, string, string, string];
  roles: Record<SemanticRole, string>;
}

/** The non-color tokens that decide whether a theme reads as sharp and technical
 *  or soft and welcoming. Omitted keys inherit silica's own defaults. */
export interface Shape {
  selector?: string;
  field?: string;
  box?: string;
  border?: string;
  /** Shadow intensity. Binary in silica: "1" lifts surfaces, "0" is fully flat. */
  depth?: '0' | '1';
}

/** A webfont pick in exactly the form silica's theme editor writes — the CSS
 *  stack for the token, and the weights recorded on `Theme.fonts` so publishing
 *  can self-host the real files. */
export interface Face {
  family: string;
  stack: string;
  weights: number[];
}

export const face = (family: string, generic: string): Face => ({
  family,
  stack: `"${family}", ${generic}`,
  weights: [400, 600, 700],
});

const FACE = {
  archivo: face('Archivo', 'sans-serif'),
  bitter: face('Bitter', 'serif'),
  cormorant: face('Cormorant Garamond', 'serif'),
  epilogue: face('Epilogue', 'sans-serif'),
  fraunces: face('Fraunces', 'serif'),
  ibmPlexSans: face('IBM Plex Sans', 'sans-serif'),
  inter: face('Inter', 'sans-serif'),
  karla: face('Karla', 'sans-serif'),
  libreBaskerville: face('Libre Baskerville', 'serif'),
  manrope: face('Manrope', 'sans-serif'),
  nunito: face('Nunito', 'sans-serif'),
  outfit: face('Outfit', 'sans-serif'),
  playfair: face('Playfair Display', 'serif'),
  sora: face('Sora', 'sans-serif'),
  sourceSans3: face('Source Sans 3', 'sans-serif'),
  spaceGrotesk: face('Space Grotesk', 'sans-serif'),
  spectral: face('Spectral', 'serif'),
  syne: face('Syne', 'sans-serif'),
  workSans: face('Work Sans', 'sans-serif'),
} satisfies Record<string, Face>;

export interface ThemeSpec {
  /** The `[data-theme]` value, stored on every site that adopts it — permanent. */
  name: string;
  light: Palette;
  dark: Palette;
  shape?: Shape;
  type?: { body: Face; head?: Face };
}

/** Assemble a spec into a silica `Theme`. `dark` is a whole `Palette`, not a
 *  partial override bag, so an unstated dark role is a type error rather than a
 *  light-mode color quietly surviving into dark mode. */
export function defineTheme(spec: ThemeSpec): Theme {
  const tokens: Record<string, string> = {
    ...surfaceTokens(spec.light.surfaces),
    ...roleTokens(spec.light.roles),
    ...shapeTokens(spec.shape),
  };

  const fonts: NonNullable<Theme['fonts']> = {};
  if (spec.type) {
    tokens['--font-sans'] = spec.type.body.stack;
    fonts.sans = {
      family: spec.type.body.family,
      source: 'google',
      weights: spec.type.body.weights,
    };
    // No heading face → headings inherit `--font-sans`, which is silica's own
    // fallback. Writing a token to say so would just be noise.
    if (spec.type.head) {
      tokens['--font-head'] = spec.type.head.stack;
      fonts.head = {
        family: spec.type.head.family,
        source: 'google',
        weights: spec.type.head.weights,
      };
    }
  }

  return {
    name: spec.name,
    mode: 'light',
    tokens,
    // Shape and type are mode-independent, so they live only in `tokens` —
    // silica's `resolveThemeTokens` merges the bags and carries them into dark.
    dark: { ...surfaceTokens(spec.dark.surfaces), ...roleTokens(spec.dark.roles) },
    ...(Object.keys(fonts).length ? { fonts } : {}),
  };
}

function surfaceTokens([s100, s200, s300, ink]: Palette['surfaces']): Record<string, string> {
  return {
    '--color-base-100': s100,
    '--color-base-200': s200,
    '--color-base-300': s300,
    '--color-base-content': ink,
  };
}

function roleTokens(roles: Record<SemanticRole, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [role, value] of Object.entries(roles)) out[`--color-${role}`] = value;
  return out;
}

function shapeTokens(shape: Shape | undefined): Record<string, string> {
  if (!shape) return {};
  const out: Record<string, string> = {};
  if (shape.selector) out['--radius-selector'] = shape.selector;
  if (shape.field) out['--radius-field'] = shape.field;
  if (shape.box) out['--radius-box'] = shape.box;
  if (shape.border) out['--border'] = shape.border;
  if (shape.depth) out['--depth'] = shape.depth;
  return out;
}

// The house status set, keyed by the SURFACE it sits on rather than by the mode.
//
// That distinction is load-bearing and it is not pedantry. A `dark`-ground theme
// (see GROUND below) has a dark page in LIGHT mode, and the deep set's 52%
// -lightness `info` simply disappears on a 24% surface. Naming these `LIGHT`/`DARK`
// after the mode invites exactly that pairing, and it reads as correct right up
// until someone looks at the page. So: deep statuses on light grounds, bright
// statuses on dark grounds — and `cellar`, `garage` and `stage` take the bright
// set in BOTH modes, because both of their grounds are dark.
//
// A theme overrides an individual slot only when its own brand hue sits close
// enough to be misread — a restaurant whose brand IS tomato red cannot also warn
// in tomato red.
export const STATUS_ON_LIGHT = {
  info: 'oklch(52% 0.13 232)',
  success: 'oklch(48% 0.13 150)',
  warning: 'oklch(76% 0.14 80)',
  error: 'oklch(52% 0.19 25)',
};

export const STATUS_ON_DARK = {
  info: 'oklch(76% 0.11 232)',
  success: 'oklch(76% 0.13 150)',
  warning: 'oklch(84% 0.13 80)',
  error: 'oklch(70% 0.17 25)',
};

/* ── Shops & dining ────────────────────────────────────────────────────────── */

const boutique = defineTheme({
  // Small fashion retail. GROUND paper · PRIMARY mono.
  //
  // Near-white and almost achromatic, with the brand carried by a NEAR-BLACK
  // primary and one bright blush accent. The shop that hangs forty things instead
  // of four hundred; the clothes are the color.
  name: 'boutique',
  type: { body: FACE.inter, head: FACE.playfair },
  shape: { selector: '1rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(99% 0.004 20)',
      'oklch(97% 0.008 20)',
      'oklch(93% 0.014 15)',
      'oklch(18% 0.02 15)',
    ],
    roles: {
      primary: 'oklch(18% 0.02 15)',
      secondary: 'oklch(46% 0.1 350)',
      accent: 'oklch(82% 0.1 30)',
      neutral: 'oklch(22% 0.02 15)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(15% 0.01 15)',
      'oklch(12% 0.01 15)',
      'oklch(9% 0.01 15)',
      'oklch(95% 0.008 20)',
    ],
    roles: {
      // The primary inverts to paper — on near-black the confident control is the
      // one printed in white, not another shade of charcoal.
      primary: 'oklch(95% 0.01 15)',
      secondary: 'oklch(78% 0.1 350)',
      accent: 'oklch(86% 0.09 30)',
      neutral: 'oklch(30% 0.015 15)',
      ...STATUS_ON_DARK,
    },
  },
});

const kitchen = defineTheme({
  // Restaurants, cafés, bakeries. GROUND tinted · PRIMARY deep.
  //
  // A page that is genuinely BUTTER, not white with a rumour of yellow — chroma an
  // order of magnitude up on the old draft, which is the only way a warm ground
  // reads as a choice. Tomato brand, olive support, and the one theme on this shelf
  // with no serif anywhere. `error` moves to crimson and `warning` to deep amber,
  // because a kitchen whose brand is tomato cannot also alarm in tomato.
  name: 'kitchen',
  type: { body: FACE.nunito },
  shape: { selector: '1rem', field: '0.5rem', box: '0.875rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(96% 0.038 82)',
      'oklch(93% 0.05 80)',
      'oklch(88% 0.06 75)',
      'oklch(24% 0.04 55)',
    ],
    roles: {
      primary: 'oklch(50% 0.17 35)',
      secondary: 'oklch(42% 0.09 135)',
      accent: 'oklch(80% 0.15 88)',
      neutral: 'oklch(28% 0.03 55)',
      ...STATUS_ON_LIGHT,
      warning: 'oklch(74% 0.17 45)',
      error: 'oklch(50% 0.2 12)',
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.028 55)',
      'oklch(17% 0.028 55)',
      'oklch(14% 0.028 55)',
      'oklch(94% 0.03 82)',
    ],
    roles: {
      primary: 'oklch(76% 0.16 35)',
      secondary: 'oklch(74% 0.09 135)',
      accent: 'oklch(88% 0.14 88)',
      neutral: 'oklch(34% 0.028 55)',
      ...STATUS_ON_DARK,
      warning: 'oklch(82% 0.15 45)',
      error: 'oklch(70% 0.18 12)',
    },
  },
});

const cellar = defineTheme({
  // Wine, beer, spirits, bars. GROUND dark · PRIMARY light.
  //
  // The page is DARK in light mode. A wine room is a low-lit room, and a bar whose
  // site opens bright white is describing somewhere else — so this theme is dark in
  // both modes and its "dark mode" simply goes further down. Wine-rose and oak lit
  // by brass. Takes the bright status set in BOTH modes: the deep one would vanish
  // into a 24% ground.
  name: 'cellar',
  type: { body: FACE.karla, head: FACE.spectral },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(24% 0.022 15)',
      'oklch(20% 0.022 15)',
      'oklch(16% 0.022 15)',
      'oklch(92% 0.015 20)',
    ],
    roles: {
      primary: 'oklch(76% 0.13 8)',
      secondary: 'oklch(72% 0.07 60)',
      accent: 'oklch(84% 0.12 80)',
      neutral: 'oklch(34% 0.02 15)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.14 55)',
      error: 'oklch(70% 0.17 32)',
    },
  },
  dark: {
    surfaces: [
      'oklch(14% 0.018 15)',
      'oklch(11% 0.018 15)',
      'oklch(8% 0.018 15)',
      'oklch(93% 0.012 20)',
    ],
    roles: {
      primary: 'oklch(78% 0.13 8)',
      secondary: 'oklch(74% 0.07 60)',
      accent: 'oklch(86% 0.12 80)',
      neutral: 'oklch(30% 0.02 15)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.14 55)',
      error: 'oklch(70% 0.17 32)',
    },
  },
});

const petal = defineTheme({
  // Florists, weddings, events. GROUND tinted · PRIMARY bright.
  //
  // A visibly BLUSH page and — the part no other theme here does — a pale rose
  // primary carrying DARK ink. A bright control reads nothing like the dark fills
  // everywhere else in this library, which is exactly why one theme should use it.
  // A deep leaf secondary keeps the whole thing from floating away.
  name: 'petal',
  type: { body: FACE.nunito, head: FACE.cormorant },
  shape: { selector: '2rem', field: '0.75rem', box: '1.25rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(97% 0.03 350)',
      'oklch(95% 0.04 350)',
      'oklch(90% 0.05 345)',
      'oklch(22% 0.03 345)',
    ],
    roles: {
      primary: 'oklch(82% 0.09 350)',
      secondary: 'oklch(44% 0.1 135)',
      accent: 'oklch(76% 0.12 30)',
      neutral: 'oklch(26% 0.025 345)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(17% 0.018 345)',
      'oklch(14% 0.018 345)',
      'oklch(11% 0.018 345)',
      'oklch(94% 0.012 350)',
    ],
    roles: {
      primary: 'oklch(84% 0.09 350)',
      secondary: 'oklch(74% 0.1 135)',
      accent: 'oklch(86% 0.11 30)',
      neutral: 'oklch(32% 0.02 345)',
      ...STATUS_ON_DARK,
    },
  },
});

const lodge = defineTheme({
  // Hotels, cabins, short-stay rentals, tourism. GROUND mid · PRIMARY deep.
  //
  // A parchment page at 91% — muted enough to read as paper stock rather than as a
  // screen, which is the whole difference between "warm white" and warm. Deep forest
  // brand over timber, lit by lamplight amber.
  name: 'lodge',
  type: { body: FACE.sourceSans3, head: FACE.bitter },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.5rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(91% 0.028 75)',
      'oklch(88% 0.034 72)',
      'oklch(83% 0.04 68)',
      'oklch(21% 0.03 60)',
    ],
    roles: {
      primary: 'oklch(36% 0.09 160)',
      secondary: 'oklch(44% 0.09 55)',
      accent: 'oklch(74% 0.13 70)',
      neutral: 'oklch(25% 0.022 60)',
      ...STATUS_ON_LIGHT,
      warning: 'oklch(76% 0.16 45)',
    },
  },
  dark: {
    surfaces: [
      'oklch(17% 0.016 60)',
      'oklch(14% 0.016 60)',
      'oklch(11% 0.016 60)',
      'oklch(92% 0.014 78)',
    ],
    roles: {
      primary: 'oklch(74% 0.1 160)',
      secondary: 'oklch(78% 0.09 55)',
      accent: 'oklch(86% 0.12 70)',
      neutral: 'oklch(32% 0.022 60)',
      ...STATUS_ON_DARK,
      warning: 'oklch(82% 0.15 45)',
    },
  },
});

/* ── Trades & on-site work ─────────────────────────────────────────────────── */

const workshop = defineTheme({
  // Fabrication, joinery, welding, general trade. GROUND paper · PRIMARY bright.
  //
  // High-visibility amber as the BRAND, not as a warning — which is what trade
  // branding actually does, and it puts a bright dark-ink control at the centre of
  // the theme. Steel greys around it, double-weight borders, zero depth: structure
  // drawn in line, like the drawing it came from. No display face — one industrial
  // sans throughout.
  name: 'workshop',
  type: { body: FACE.ibmPlexSans },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.125rem', border: '2px', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.003 250)',
      'oklch(94% 0.005 250)',
      'oklch(88% 0.008 250)',
      'oklch(17% 0.01 250)',
    ],
    roles: {
      primary: 'oklch(78% 0.17 60)',
      secondary: 'oklch(42% 0.03 250)',
      accent: 'oklch(50% 0.15 240)',
      neutral: 'oklch(20% 0.012 250)',
      ...STATUS_ON_LIGHT,
      warning: 'oklch(74% 0.15 95)',
    },
  },
  dark: {
    surfaces: [
      'oklch(14% 0.008 250)',
      'oklch(11% 0.008 250)',
      'oklch(8% 0.008 250)',
      'oklch(95% 0.005 250)',
    ],
    roles: {
      primary: 'oklch(82% 0.16 60)',
      secondary: 'oklch(70% 0.03 250)',
      accent: 'oklch(78% 0.13 240)',
      neutral: 'oklch(28% 0.012 250)',
      ...STATUS_ON_DARK,
      warning: 'oklch(86% 0.14 95)',
    },
  },
});

const garage = defineTheme({
  // Vehicle service, mechanical repair, parts. GROUND dark · PRIMARY light.
  //
  // A workshop floor is not white. Dark in both modes, racing orange over graphite,
  // heavy borders. `error` shifts to crimson so two warm signals stay two signals,
  // and the bright status set carries both modes because both grounds are dark.
  name: 'garage',
  type: { body: FACE.inter, head: FACE.archivo },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.25rem', border: '2px', depth: '0' },
  light: {
    surfaces: [
      'oklch(20% 0.006 250)',
      'oklch(17% 0.006 250)',
      'oklch(14% 0.006 250)',
      'oklch(94% 0.004 250)',
    ],
    roles: {
      primary: 'oklch(74% 0.18 40)',
      secondary: 'oklch(66% 0.02 250)',
      accent: 'oklch(86% 0.15 95)',
      neutral: 'oklch(32% 0.008 250)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.14 60)',
      error: 'oklch(70% 0.18 15)',
    },
  },
  dark: {
    surfaces: [
      'oklch(12% 0.004 250)',
      'oklch(9% 0.004 250)',
      'oklch(6% 0.004 250)',
      'oklch(95% 0.003 250)',
    ],
    roles: {
      primary: 'oklch(76% 0.18 40)',
      secondary: 'oklch(64% 0.02 250)',
      accent: 'oklch(88% 0.15 95)',
      neutral: 'oklch(28% 0.008 250)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.14 60)',
      error: 'oklch(70% 0.18 15)',
    },
  },
});

const field = defineTheme({
  // Farming, landscaping, groundwork, outdoor contracting. GROUND mid · PRIMARY deep.
  //
  // A muted green page at 92% — the colour of work done outdoors, rather than a white
  // page with a green button on it. Turned soil as support, open sky as the accent.
  name: 'field',
  type: { body: FACE.workSans, head: FACE.epilogue },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(92% 0.032 128)',
      'oklch(89% 0.04 126)',
      'oklch(84% 0.048 124)',
      'oklch(20% 0.03 140)',
    ],
    roles: {
      primary: 'oklch(42% 0.13 128)',
      secondary: 'oklch(42% 0.07 65)',
      accent: 'oklch(48% 0.14 235)',
      neutral: 'oklch(24% 0.022 140)',
      ...STATUS_ON_LIGHT,
      success: 'oklch(46% 0.13 162)',
    },
  },
  dark: {
    surfaces: [
      'oklch(18% 0.016 140)',
      'oklch(15% 0.016 140)',
      'oklch(12% 0.016 140)',
      'oklch(93% 0.014 130)',
    ],
    roles: {
      primary: 'oklch(78% 0.13 128)',
      secondary: 'oklch(76% 0.07 65)',
      accent: 'oklch(80% 0.12 235)',
      neutral: 'oklch(32% 0.022 140)',
      ...STATUS_ON_DARK,
      success: 'oklch(76% 0.13 162)',
    },
  },
});

const harbor = defineTheme({
  // Freight, haulage, marine, plant hire. GROUND paper · PRIMARY deep.
  //
  // Deep navy and signal orange — the two colours every working port already uses,
  // because they are the two that read at distance. Cool near-white keeps it a
  // documents-and-schedules theme rather than a scenic one.
  name: 'harbor',
  type: { body: FACE.ibmPlexSans, head: FACE.manrope },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.005 240)',
      'oklch(95% 0.01 240)',
      'oklch(90% 0.018 240)',
      'oklch(20% 0.025 245)',
    ],
    roles: {
      primary: 'oklch(34% 0.1 245)',
      secondary: 'oklch(46% 0.07 220)',
      accent: 'oklch(54% 0.18 45)',
      neutral: 'oklch(24% 0.02 245)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(16% 0.015 245)',
      'oklch(13% 0.015 245)',
      'oklch(10% 0.015 245)',
      'oklch(93% 0.01 240)',
    ],
    roles: {
      primary: 'oklch(78% 0.11 245)',
      secondary: 'oklch(76% 0.07 220)',
      accent: 'oklch(80% 0.16 45)',
      neutral: 'oklch(31% 0.02 245)',
      ...STATUS_ON_DARK,
    },
  },
});

const hearth = defineTheme({
  // Home services, interiors, furnishings, cleaning. GROUND tinted · PRIMARY deep.
  //
  // A page that is plainly warm plaster, terracotta brand, slate to keep it honest.
  // Softly lifted — domestic without tipping into twee.
  name: 'hearth',
  type: { body: FACE.karla, head: FACE.fraunces },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.625rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(95% 0.032 62)',
      'oklch(92% 0.042 60)',
      'oklch(87% 0.05 56)',
      'oklch(22% 0.028 50)',
    ],
    roles: {
      primary: 'oklch(46% 0.11 40)',
      secondary: 'oklch(42% 0.05 240)',
      accent: 'oklch(78% 0.1 100)',
      neutral: 'oklch(26% 0.022 50)',
      ...STATUS_ON_LIGHT,
      warning: 'oklch(74% 0.15 70)',
    },
  },
  dark: {
    surfaces: [
      'oklch(18% 0.016 50)',
      'oklch(15% 0.016 50)',
      'oklch(12% 0.016 50)',
      'oklch(93% 0.014 62)',
    ],
    roles: {
      primary: 'oklch(80% 0.1 40)',
      secondary: 'oklch(74% 0.05 240)',
      accent: 'oklch(86% 0.1 100)',
      neutral: 'oklch(33% 0.022 50)',
      ...STATUS_ON_DARK,
      warning: 'oklch(82% 0.14 70)',
    },
  },
});

/* ── Care & professional ───────────────────────────────────────────────────── */

const clinic = defineTheme({
  // Medical, dental, veterinary, therapy, wellness. GROUND paper · PRIMARY deep.
  //
  // The cleanest surfaces in the library, and the one place that is the right answer
  // rather than the lazy one: a waiting room should be calm and legible. Teal-blue,
  // flat, unhurried.
  name: 'clinic',
  type: { body: FACE.inter, head: FACE.manrope },
  shape: { selector: '1rem', field: '0.375rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(99.5% 0.003 200)',
      'oklch(98% 0.006 200)',
      'oklch(93% 0.012 200)',
      'oklch(24% 0.02 215)',
    ],
    roles: {
      primary: 'oklch(46% 0.11 200)',
      secondary: 'oklch(46% 0.09 165)',
      accent: 'oklch(74% 0.1 190)',
      neutral: 'oklch(28% 0.015 215)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(19% 0.012 215)',
      'oklch(16% 0.012 215)',
      'oklch(13% 0.012 215)',
      'oklch(94% 0.008 200)',
    ],
    roles: {
      primary: 'oklch(80% 0.1 200)',
      secondary: 'oklch(76% 0.09 165)',
      accent: 'oklch(86% 0.1 190)',
      neutral: 'oklch(34% 0.015 215)',
      ...STATUS_ON_DARK,
    },
  },
});

const salon = defineTheme({
  // Hair, beauty, nails, spa. GROUND tinted · PRIMARY bright.
  //
  // A visibly mauve page and a pale mauve primary carrying dark ink — soft luxury,
  // which is a different thing from expensive. The roundest controls here alongside
  // `petal`, and gold rather than a second pink.
  name: 'salon',
  type: { body: FACE.outfit, head: FACE.cormorant },
  shape: { selector: '2rem', field: '0.5rem', box: '1rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(96% 0.03 320)',
      'oklch(94% 0.038 320)',
      'oklch(89% 0.046 318)',
      'oklch(22% 0.025 320)',
    ],
    roles: {
      primary: 'oklch(84% 0.08 325)',
      secondary: 'oklch(44% 0.12 325)',
      accent: 'oklch(52% 0.1 80)',
      neutral: 'oklch(26% 0.02 320)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(17% 0.014 320)',
      'oklch(14% 0.014 320)',
      'oklch(11% 0.014 320)',
      'oklch(93% 0.01 320)',
    ],
    roles: {
      primary: 'oklch(86% 0.08 325)',
      secondary: 'oklch(78% 0.12 325)',
      accent: 'oklch(86% 0.1 80)',
      neutral: 'oklch(32% 0.02 320)',
      ...STATUS_ON_DARK,
    },
  },
});

const ledger = defineTheme({
  // Accountancy, law, insurance, financial advice. GROUND paper · PRIMARY mono.
  //
  // Near-black ink navy as the brand, square corners, no depth, a bookish serif for
  // headings. The theme that looks like a printed document, because that is what the
  // client is being asked to trust.
  name: 'ledger',
  type: { body: FACE.inter, head: FACE.libreBaskerville },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.125rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.003 250)',
      'oklch(96% 0.005 250)',
      'oklch(91% 0.01 250)',
      'oklch(18% 0.015 250)',
    ],
    roles: {
      primary: 'oklch(20% 0.04 255)',
      secondary: 'oklch(44% 0.05 250)',
      accent: 'oklch(44% 0.1 175)',
      neutral: 'oklch(22% 0.012 250)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(16% 0.01 250)',
      'oklch(13% 0.01 250)',
      'oklch(10% 0.01 250)',
      'oklch(93% 0.006 250)',
    ],
    roles: {
      primary: 'oklch(94% 0.01 255)',
      secondary: 'oklch(76% 0.05 250)',
      accent: 'oklch(78% 0.11 175)',
      neutral: 'oklch(30% 0.012 250)',
      ...STATUS_ON_DARK,
    },
  },
});

const summit = defineTheme({
  // Consulting, agencies, B2B services. GROUND dark · PRIMARY light.
  //
  // Dark in both modes. A consultancy site that opens dark reads as considered rather
  // than as a brochure, and it is the one shape a white page cannot make: indigo
  // lifting off graphite, nothing decorative anywhere.
  name: 'summit',
  type: { body: FACE.inter, head: FACE.sora },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(18% 0.02 258)',
      'oklch(15% 0.02 258)',
      'oklch(12% 0.02 258)',
      'oklch(94% 0.01 258)',
    ],
    roles: {
      primary: 'oklch(78% 0.14 265)',
      secondary: 'oklch(70% 0.06 250)',
      accent: 'oklch(84% 0.11 200)',
      neutral: 'oklch(31% 0.015 258)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(13% 0.016 258)',
      'oklch(10% 0.016 258)',
      'oklch(7% 0.016 258)',
      'oklch(95% 0.008 258)',
    ],
    roles: {
      primary: 'oklch(80% 0.14 265)',
      secondary: 'oklch(72% 0.06 250)',
      accent: 'oklch(86% 0.11 200)',
      neutral: 'oklch(29% 0.015 258)',
      ...STATUS_ON_DARK,
    },
  },
});

const academy = defineTheme({
  // Schools, tutoring, courses, training providers. GROUND mid · PRIMARY deep.
  //
  // Parchment at 92%, maroon and brass, a text serif sized for reading at length —
  // the one theme here whose job is mostly paragraphs.
  name: 'academy',
  type: { body: FACE.sourceSans3, head: FACE.spectral },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(92% 0.035 85)',
      'oklch(89% 0.044 82)',
      'oklch(84% 0.052 78)',
      'oklch(20% 0.025 50)',
    ],
    roles: {
      primary: 'oklch(38% 0.12 20)',
      secondary: 'oklch(42% 0.07 250)',
      accent: 'oklch(48% 0.1 90)',
      neutral: 'oklch(24% 0.02 50)',
      ...STATUS_ON_LIGHT,
      warning: 'oklch(72% 0.15 55)',
      error: 'oklch(50% 0.19 32)',
    },
  },
  dark: {
    surfaces: [
      'oklch(17% 0.014 50)',
      'oklch(14% 0.014 50)',
      'oklch(11% 0.014 50)',
      'oklch(93% 0.012 85)',
    ],
    roles: {
      primary: 'oklch(76% 0.13 20)',
      secondary: 'oklch(76% 0.07 250)',
      accent: 'oklch(84% 0.1 90)',
      neutral: 'oklch(31% 0.02 50)',
      ...STATUS_ON_DARK,
      warning: 'oklch(82% 0.14 55)',
      error: 'oklch(70% 0.17 32)',
    },
  },
});

/* ── Studios & publishing ──────────────────────────────────────────────────── */

const studio = defineTheme({
  // Design, photography, film, creative agencies. GROUND paper · PRIMARY mono.
  //
  // The only genuinely ACHROMATIC theme in the library — chroma zero on every
  // surface, one hot magenta reserved for interaction. The work supplies the colour;
  // the site's job is to not compete with it.
  name: 'studio',
  type: { body: FACE.inter, head: FACE.archivo },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.125rem', depth: '0' },
  light: {
    surfaces: ['oklch(98% 0 0)', 'oklch(95% 0 0)', 'oklch(89% 0 0)', 'oklch(15% 0 0)'],
    roles: {
      primary: 'oklch(18% 0 0)',
      secondary: 'oklch(44% 0 0)',
      accent: 'oklch(52% 0.24 335)',
      neutral: 'oklch(15% 0 0)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(12% 0 0)', 'oklch(9% 0 0)', 'oklch(6% 0 0)', 'oklch(96% 0 0)'],
    roles: {
      primary: 'oklch(94% 0 0)',
      secondary: 'oklch(62% 0 0)',
      accent: 'oklch(74% 0.22 335)',
      neutral: 'oklch(27% 0 0)',
      ...STATUS_ON_DARK,
    },
  },
});

const gallery = defineTheme({
  // Artists, makers, portfolios, exhibitions. GROUND dark · PRIMARY light.
  //
  // A dark hanging wall in both modes, warm rather than neutral, and NO corner radius
  // anywhere — the only zero-radius theme here. Work shown against dark reads the way
  // a gallery intends; a white page competes with every image on it.
  name: 'gallery',
  type: { body: FACE.inter, head: FACE.cormorant },
  shape: { selector: '0rem', field: '0rem', box: '0rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(16% 0.006 85)',
      'oklch(13% 0.006 85)',
      'oklch(10% 0.006 85)',
      'oklch(94% 0.005 90)',
    ],
    roles: {
      primary: 'oklch(92% 0.006 80)',
      secondary: 'oklch(66% 0.01 80)',
      accent: 'oklch(80% 0.11 265)',
      neutral: 'oklch(30% 0.008 80)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(11% 0.004 85)',
      'oklch(8% 0.004 85)',
      'oklch(5% 0.004 85)',
      'oklch(95% 0.004 90)',
    ],
    roles: {
      primary: 'oklch(94% 0.006 80)',
      secondary: 'oklch(64% 0.01 80)',
      accent: 'oklch(82% 0.11 265)',
      neutral: 'oklch(28% 0.008 80)',
      ...STATUS_ON_DARK,
    },
  },
});

const press = defineTheme({
  // Publishers, news, newsletters, blogs. GROUND paper · PRIMARY deep.
  //
  // Newsprint warm-grey with a masthead red as the BRAND — the red is the identity
  // here, not an accent, which is why `error` moves off it to crimson. Display serif
  // over a workhorse text face, hairline rules, no depth.
  name: 'press',
  type: { body: FACE.sourceSans3, head: FACE.playfair },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.125rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 90)',
      'oklch(96% 0.006 90)',
      'oklch(91% 0.01 85)',
      'oklch(16% 0.01 80)',
    ],
    roles: {
      primary: 'oklch(48% 0.2 32)',
      secondary: 'oklch(24% 0.012 80)',
      accent: 'oklch(44% 0.04 250)',
      neutral: 'oklch(18% 0.01 80)',
      ...STATUS_ON_LIGHT,
      error: 'oklch(50% 0.2 8)',
    },
  },
  dark: {
    surfaces: [
      'oklch(14% 0.006 80)',
      'oklch(11% 0.006 80)',
      'oklch(8% 0.006 80)',
      'oklch(94% 0.006 90)',
    ],
    roles: {
      primary: 'oklch(74% 0.18 32)',
      secondary: 'oklch(90% 0.008 80)',
      accent: 'oklch(76% 0.04 250)',
      neutral: 'oklch(28% 0.01 80)',
      ...STATUS_ON_DARK,
      error: 'oklch(70% 0.18 8)',
    },
  },
});

const stage = defineTheme({
  // Music, theatre, venues, ticketed events. GROUND dark · PRIMARY light.
  //
  // The darkest theme in the library, and the only dark ground that is LIFTED
  // (`depth: 1`) — a violet room with the house lights down and a spotlight amber
  // picking things out. Rounded where `gallery` is square, so the two dark grounds
  // never read as the same theme.
  name: 'stage',
  type: { body: FACE.spaceGrotesk, head: FACE.syne },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.625rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(15% 0.015 300)',
      'oklch(12% 0.015 300)',
      'oklch(9% 0.015 300)',
      'oklch(95% 0.01 300)',
    ],
    roles: {
      primary: 'oklch(76% 0.2 305)',
      secondary: 'oklch(74% 0.14 270)',
      accent: 'oklch(88% 0.14 75)',
      neutral: 'oklch(29% 0.018 300)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.15 45)',
    },
  },
  dark: {
    surfaces: [
      'oklch(11% 0.012 300)',
      'oklch(8% 0.012 300)',
      'oklch(5% 0.012 300)',
      'oklch(96% 0.008 300)',
    ],
    roles: {
      primary: 'oklch(78% 0.2 305)',
      secondary: 'oklch(76% 0.14 270)',
      accent: 'oklch(90% 0.14 75)',
      neutral: 'oklch(27% 0.018 300)',
      ...STATUS_ON_DARK,
      warning: 'oklch(86% 0.15 45)',
    },
  },
});

const signal = defineTheme({
  // Software, apps, IT, anything sold as a subscription. GROUND mid · PRIMARY deep.
  //
  // A cool graphite-tinted page rather than another white SaaS site, electric indigo
  // brand, cyan accent, a technical grotesk for headings. Modern, and honest about
  // being so.
  name: 'signal',
  type: { body: FACE.inter, head: FACE.spaceGrotesk },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(93% 0.015 265)',
      'oklch(90% 0.02 265)',
      'oklch(85% 0.026 263)',
      'oklch(19% 0.02 265)',
    ],
    roles: {
      primary: 'oklch(46% 0.2 275)',
      secondary: 'oklch(46% 0.12 240)',
      accent: 'oklch(52% 0.13 195)',
      neutral: 'oklch(24% 0.015 265)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(15% 0.012 265)',
      'oklch(12% 0.012 265)',
      'oklch(9% 0.012 265)',
      'oklch(95% 0.008 265)',
    ],
    roles: {
      primary: 'oklch(76% 0.19 275)',
      secondary: 'oklch(80% 0.12 240)',
      accent: 'oklch(86% 0.13 195)',
      neutral: 'oklch(30% 0.015 265)',
      ...STATUS_ON_DARK,
    },
  },
});

/* ── the shelves ───────────────────────────────────────────────────────────── */

/** A named shelf in the builder's Themes panel. Structurally silica's
 *  `ThemeGroup`, declared here because that type lives in the REACT builder
 *  package and this one is deliberately React-free — the host narrows the gap,
 *  exactly as it already does for `PaletteGroup`. */
export interface SparxThemeGroup {
  key: string;
  label: string;
  themes: readonly Theme[];
}

/**
 * sparx's theme shelves, grouped by the kind of business rather than by the look.
 *
 * Grouped rather than served as one wall of twenty because the panel is a
 * recognition task: an owner scans for the heading that describes them and reads
 * five, not twenty. The headings deliberately use plain trade words — "Shops &
 * dining", not "Retail vertical".
 */
export const SPARX_THEME_GROUPS: SparxThemeGroup[] = [
  {
    key: 'sparx-shops',
    label: 'Shops & dining',
    themes: [boutique, kitchen, cellar, petal, lodge],
  },
  {
    key: 'sparx-trades',
    label: 'Trades & on-site work',
    themes: [workshop, garage, field, harbor, hearth],
  },
  {
    key: 'sparx-care',
    label: 'Care & professional',
    themes: [clinic, salon, ledger, summit, academy],
  },
  {
    key: 'sparx-studios',
    label: 'Studios & publishing',
    themes: [studio, gallery, press, stage, signal],
  },
];

/** Every sparx theme, flat — for tests, previews, and anything that needs the
 *  catalog without its shelving. */
export const SPARX_THEMES: Theme[] = SPARX_THEME_GROUPS.flatMap((g) => [...g.themes]);
