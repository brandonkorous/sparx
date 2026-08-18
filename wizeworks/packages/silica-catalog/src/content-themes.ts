// Bespoke themes for the ten reference-driven CONTENT site templates (the WordPress
// set — docs/templates/content/*).
//
// The companion to `template-themes.ts` (the ten Shopify/commerce looks). Each of the
// ten `docs/templates/content/*` blueprints carries a DESIGN.md whose §6 ("The sparx
// translation") pins an authoritative color / type / mood direction tuned to look
// like a specific reference publisher's own site — TechCrunch, The New Yorker, Vogue,
// National Geographic, and so on. `SPARX_THEMES` is the general trade-shelf library a
// business PICKS from; these ten are the paired, hand-authored looks the content
// templates SHIP with, one per blueprint slug.
//
// Same contract as the shelves and the commerce ten: a COMPLETE light AND dark
// palette, WCAG AA on every role and on body text over every surface, in both modes.
// `content-themes.test.ts` holds that bar — the same per-theme assertions
// `themes.test.ts` runs, pointed at `CONTENT_THEMES`. Names are URL-safe, unique, and
// never collide with silica's presets, the twenty `SPARX_THEMES`, or the ten
// `TEMPLATE_THEMES`.
//
// GROUND + PRIMARY keep the set from collapsing to white-page/dark-button. The spread
// here is deliberately DIFFERENT from the commerce ten, because publishing pushes on
// axes retail did not: FOUR genuinely dark PAGES in both modes (amplitude, expanse,
// console, amp — a magazine, a photo journal, a game newsroom, an artist), a
// two-brand-color institutional chassis (quad — navy primary + crimson accent), an
// accent-free pure-B/W editorial (runway — chroma from photography only), a
// serif-across reading theme (broadsheet), and an accessibility-first civic palette
// (agency — federal blue at AAA). Primaries run mono (runway), deep (broadsheet,
// quad, agency), bright-fill (dispatch, podium) and neon-on-dark (amplitude, expanse,
// console, amp).

import { defineTheme, face, STATUS_ON_DARK, STATUS_ON_LIGHT, type Face } from './themes';
import type { Theme } from '@wizeworks/silicaui-html';

// The faces the content templates pair. All Google families; `face()` records the
// 400/600/700 weights publishing self-hosts.
const C_FACE = {
  archivo: face('Archivo', 'sans-serif'),
  cormorant: face('Cormorant Garamond', 'serif'),
  fraunces: face('Fraunces', 'serif'),
  inter: face('Inter', 'sans-serif'),
  outfit: face('Outfit', 'sans-serif'),
  oswald: face('Oswald', 'sans-serif'),
  playfair: face('Playfair Display', 'serif'),
  spaceGrotesk: face('Space Grotesk', 'sans-serif'),
  spectral: face('Spectral', 'serif'),
  syne: face('Syne', 'sans-serif'),
  workSans: face('Work Sans', 'sans-serif'),
} satisfies Record<string, Face>;

const dispatch = defineTheme({
  // news-feed · reference TechCrunch. GROUND paper (cool white) · PRIMARY bright.
  //
  // A pure, cool-white newsroom carried by ONE saturated emerald — category tags,
  // links, "See more", the subscribe CTA — with everything else monochrome. Grotesk
  // display over a neutral sans, small radius, hairline structure, flat: information
  // density done cleanly, the opposite discipline to the reading themes below.
  name: 'dispatch',
  type: { body: C_FACE.inter, head: C_FACE.spaceGrotesk },
  shape: { selector: '0.375rem', field: '0.375rem', box: '0.5rem', border: '1px', depth: '0' },
  light: {
    surfaces: [
      'oklch(99% 0.002 250)',
      'oklch(96% 0.004 250)',
      'oklch(92% 0.006 250)',
      'oklch(20% 0.008 250)',
    ],
    roles: {
      primary: 'oklch(52% 0.13 158)',
      secondary: 'oklch(44% 0.02 250)',
      accent: 'oklch(52% 0.13 158)',
      neutral: 'oklch(24% 0.008 250)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(17% 0.006 250)',
      'oklch(14% 0.006 250)',
      'oklch(11% 0.006 250)',
      'oklch(96% 0.004 250)',
    ],
    roles: {
      primary: 'oklch(60% 0.14 158)',
      secondary: 'oklch(72% 0.02 250)',
      accent: 'oklch(60% 0.14 158)',
      neutral: 'oklch(30% 0.008 250)',
      ...STATUS_ON_DARK,
    },
  },
});

const broadsheet = defineTheme({
  // longform-literary · reference The New Yorker. GROUND paper (warm) · PRIMARY deep.
  //
  // A warm-paper reading theme set in SERIF ACROSS — a high-contrast display serif
  // over a readable text serif — with ONE editorial red on rubrics and the Subscribe
  // CTA. Zero radius, hairline rules, flat. `error` moves to a distinct crimson so the
  // brand red and the warning red stay two different reds.
  name: 'broadsheet',
  type: { body: C_FACE.spectral, head: C_FACE.playfair },
  shape: { selector: '0rem', field: '0.125rem', box: '0rem', border: '1px', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 85)',
      'oklch(95% 0.006 82)',
      'oklch(90% 0.008 80)',
      'oklch(16% 0.004 60)',
    ],
    roles: {
      primary: 'oklch(50% 0.2 27)',
      secondary: 'oklch(42% 0.02 60)',
      accent: 'oklch(50% 0.2 27)',
      neutral: 'oklch(22% 0.006 60)',
      ...STATUS_ON_LIGHT,
      error: 'oklch(50% 0.19 12)',
    },
  },
  dark: {
    surfaces: [
      'oklch(16% 0.004 60)',
      'oklch(13% 0.004 60)',
      'oklch(10% 0.004 60)',
      'oklch(95% 0.004 85)',
    ],
    roles: {
      primary: 'oklch(64% 0.19 27)',
      secondary: 'oklch(70% 0.02 60)',
      accent: 'oklch(64% 0.19 27)',
      neutral: 'oklch(30% 0.006 60)',
      ...STATUS_ON_DARK,
      error: 'oklch(66% 0.18 12)',
    },
  },
});

const runway = defineTheme({
  // glossy-fashion · reference Vogue. GROUND paper (pure white) · PRIMARY mono.
  //
  // Pure black-and-white editorial luxury: white page, near-black ink and primary, a
  // high-contrast Didone display over a clean sans. DELIBERATELY no chromatic accent —
  // the accent role is a muted graphite for whisper-labels only; all color comes from
  // full-bleed photography. Zero radius, flat.
  name: 'runway',
  type: { body: C_FACE.inter, head: C_FACE.playfair },
  shape: { selector: '0rem', field: '0rem', box: '0rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(99% 0.001 90)',
      'oklch(96% 0.001 90)',
      'oklch(91% 0.002 90)',
      'oklch(10% 0 0)',
    ],
    roles: {
      primary: 'oklch(10% 0 0)',
      secondary: 'oklch(42% 0.004 270)',
      accent: 'oklch(50% 0.006 270)',
      neutral: 'oklch(14% 0 0)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(13% 0 0)', 'oklch(10% 0 0)', 'oklch(7% 0 0)', 'oklch(97% 0.001 90)'],
    roles: {
      primary: 'oklch(96% 0.001 90)',
      secondary: 'oklch(68% 0.004 270)',
      accent: 'oklch(62% 0.006 270)',
      neutral: 'oklch(28% 0 0)',
      ...STATUS_ON_DARK,
    },
  },
});

const amplitude = defineTheme({
  // culture-bold · reference Rolling Stone / Variety. GROUND dark (both modes) · PRIMARY neon.
  //
  // The set's loud dark magazine: near-black grounds, bright near-white ink, ONE
  // voltage crimson-magenta for the masthead accent, ranked-list numbers and the
  // primary action — deliberately distinct from sparx Ember and from console's violet.
  // Heavy condensed display over a neutral sans, low radius, flat. Bright statuses in
  // both modes (dark page).
  name: 'amplitude',
  type: { body: C_FACE.inter, head: C_FACE.oswald },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(17% 0.006 12)',
      'oklch(14% 0.006 12)',
      'oklch(11% 0.006 12)',
      'oklch(96% 0.004 12)',
    ],
    roles: {
      // 62%, not 58%: amplitude is a DARK page, so primary is read as TEXT on the
      // near-black ground too (a rubric, a ranked-list number). At 58% that pairing
      // measured 4.4:1 in the catalog sweep — a hair under AA — even though the fill's
      // derived -content was fine. 62% clears it while staying vivid.
      primary: 'oklch(62% 0.22 12)',
      secondary: 'oklch(74% 0.02 12)',
      accent: 'oklch(66% 0.2 12)',
      neutral: 'oklch(30% 0.006 12)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(14% 0.006 12)',
      'oklch(11% 0.006 12)',
      'oklch(8% 0.006 12)',
      'oklch(97% 0.004 12)',
    ],
    roles: {
      primary: 'oklch(62% 0.22 12)',
      secondary: 'oklch(76% 0.02 12)',
      accent: 'oklch(66% 0.2 12)',
      neutral: 'oklch(28% 0.006 12)',
      ...STATUS_ON_DARK,
    },
  },
});

const expanse = defineTheme({
  // immersive-photo · reference National Geographic. GROUND dark (both modes) · PRIMARY bright.
  //
  // A near-black photographic ground that makes imagery pop, with ONE solar-amber
  // accent used as a thin rule / underline / tag / CTA — never a filled rectangle, so
  // it never recreates a trademarked yellow mark. Serif display over a neutral sans,
  // low radius. Bright statuses in both modes (dark page).
  name: 'expanse',
  type: { body: C_FACE.inter, head: C_FACE.fraunces },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(18% 0.008 220)',
      'oklch(15% 0.008 220)',
      'oklch(12% 0.008 220)',
      'oklch(96% 0.004 90)',
    ],
    roles: {
      primary: 'oklch(80% 0.14 85)',
      secondary: 'oklch(74% 0.02 220)',
      accent: 'oklch(80% 0.14 85)',
      neutral: 'oklch(31% 0.008 220)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(15% 0.008 220)',
      'oklch(12% 0.008 220)',
      'oklch(9% 0.008 220)',
      'oklch(97% 0.004 90)',
    ],
    roles: {
      primary: 'oklch(82% 0.14 85)',
      secondary: 'oklch(76% 0.02 220)',
      accent: 'oklch(82% 0.14 85)',
      neutral: 'oklch(29% 0.008 220)',
      ...STATUS_ON_DARK,
    },
  },
});

const podium = defineTheme({
  // ideas-talks · reference TED. GROUND paper (warm white) · PRIMARY bright.
  //
  // A clean, optimistic ideas hub: warm-white page carried by ONE bright coral —
  // deliberately more orange than broadsheet's red so the set stays distinct — on the
  // play button, talk-duration badges, the donate CTA. Friendly geometric display over
  // a humanist sans, soft radius, gently lifted.
  name: 'podium',
  type: { body: C_FACE.workSans, head: C_FACE.outfit },
  shape: { selector: '1rem', field: '0.5rem', box: '0.875rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(99% 0.004 40)',
      'oklch(96% 0.008 40)',
      'oklch(91% 0.012 38)',
      'oklch(19% 0.01 40)',
    ],
    roles: {
      primary: 'oklch(56% 0.18 32)',
      secondary: 'oklch(44% 0.03 40)',
      accent: 'oklch(56% 0.18 32)',
      neutral: 'oklch(24% 0.01 40)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(18% 0.012 40)',
      'oklch(15% 0.012 40)',
      'oklch(12% 0.012 40)',
      'oklch(95% 0.006 40)',
    ],
    roles: {
      primary: 'oklch(64% 0.18 32)',
      secondary: 'oklch(74% 0.03 40)',
      accent: 'oklch(64% 0.18 32)',
      neutral: 'oklch(32% 0.01 40)',
      ...STATUS_ON_DARK,
    },
  },
});

const console_ = defineTheme({
  // brand-newsroom · reference PlayStation.Blog. GROUND dark (both modes) · PRIMARY neon.
  //
  // A first-party brand newsroom on a true-dark ground where big cover art carries the
  // color, with ONE electric-violet accent held SCARCE — active nav, the primary
  // action, category chips — deliberately violet, never a console-brand blue. Technical
  // grotesk over a neutral sans, medium radius. Bright statuses in both modes.
  name: 'console',
  type: { body: C_FACE.inter, head: C_FACE.spaceGrotesk },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.5rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(17% 0.014 292)',
      'oklch(14% 0.014 292)',
      'oklch(11% 0.014 292)',
      'oklch(96% 0.006 292)',
    ],
    roles: {
      // 64%, not 60%: console is a DARK page, so primary is read as TEXT on the near-black
      // ground (an active-nav label, a category chip, the article rubric). At 60% that
      // pairing measured ~4.5:1 in the blueprint sweep — right on the AA line; 64% clears it
      // with margin while staying electric violet. (Dark mode is already 64%.)
      primary: 'oklch(64% 0.2 292)',
      secondary: 'oklch(74% 0.03 292)',
      accent: 'oklch(66% 0.18 292)',
      neutral: 'oklch(30% 0.014 292)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(14% 0.014 292)',
      'oklch(11% 0.014 292)',
      'oklch(8% 0.014 292)',
      'oklch(97% 0.006 292)',
    ],
    roles: {
      primary: 'oklch(64% 0.2 292)',
      secondary: 'oklch(76% 0.03 292)',
      accent: 'oklch(70% 0.18 292)',
      neutral: 'oklch(28% 0.014 292)',
      ...STATUS_ON_DARK,
    },
  },
});

const quad = defineTheme({
  // institution-news · reference Harvard Gazette. GROUND paper · PRIMARY deep, ACCENT crimson.
  //
  // The set's two-brand-color institutional chassis: a paper page with a DEEP NAVY
  // primary and a distinct academic CRIMSON accent, set serif-head over a sans body —
  // authoritative and trustworthy. Modest radius, hairline structure, flat. A generic
  // academic direction, never one school's trademarked crimson.
  name: 'quad',
  type: { body: C_FACE.workSans, head: C_FACE.spectral },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', border: '1px', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 250)',
      'oklch(95% 0.006 250)',
      'oklch(90% 0.008 250)',
      'oklch(18% 0.02 258)',
    ],
    roles: {
      primary: 'oklch(34% 0.1 258)',
      secondary: 'oklch(46% 0.04 258)',
      accent: 'oklch(48% 0.18 25)',
      neutral: 'oklch(24% 0.02 258)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(17% 0.016 258)',
      'oklch(14% 0.016 258)',
      'oklch(11% 0.016 258)',
      'oklch(95% 0.006 250)',
    ],
    roles: {
      primary: 'oklch(72% 0.11 258)',
      secondary: 'oklch(76% 0.05 258)',
      accent: 'oklch(68% 0.17 25)',
      neutral: 'oklch(32% 0.016 258)',
      ...STATUS_ON_DARK,
    },
  },
});

const agency = defineTheme({
  // civic-portal · reference NASA / whitehouse.gov. GROUND paper · PRIMARY deep (federal blue).
  //
  // An accessibility-first public-service palette: a white page with a DEEP FEDERAL-BLUE
  // primary (AAA on white), a single flag-red accent reserved for the alert banner, and
  // an info-blue status for routine notices. High-legibility sans throughout, low
  // radius, hairline structure, flat — clarity is the whole brief.
  name: 'agency',
  type: { body: C_FACE.workSans, head: C_FACE.archivo },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', border: '1px', depth: '0' },
  light: {
    surfaces: [
      'oklch(99% 0.003 250)',
      'oklch(95% 0.008 250)',
      'oklch(89% 0.014 250)',
      'oklch(16% 0.02 258)',
    ],
    roles: {
      primary: 'oklch(32% 0.1 258)',
      secondary: 'oklch(44% 0.05 250)',
      accent: 'oklch(50% 0.2 25)',
      neutral: 'oklch(22% 0.02 258)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(17% 0.016 258)',
      'oklch(14% 0.016 258)',
      'oklch(11% 0.016 258)',
      'oklch(96% 0.006 250)',
    ],
    roles: {
      primary: 'oklch(72% 0.11 258)',
      secondary: 'oklch(76% 0.06 250)',
      accent: 'oklch(70% 0.18 25)',
      neutral: 'oklch(32% 0.016 258)',
      ...STATUS_ON_DARK,
    },
  },
});

const amp = defineTheme({
  // artist-media · reference Sony Music / artist sites. GROUND dark (both modes) · PRIMARY neon.
  //
  // The set's stage: a near-black concert ground with a DUOTONE — electric magenta
  // primary + electric cyan accent, the two-light gel look — carrying the artist's key
  // art, tour dates and release players. Expressive poster display over a neutral sans,
  // medium radius, lifted (glow is a tenant-only affordance this template leans into).
  // Bright statuses in both modes.
  name: 'amp',
  type: { body: C_FACE.inter, head: C_FACE.syne },
  shape: { selector: '0.75rem', field: '0.5rem', box: '0.75rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(17% 0.014 320)',
      'oklch(14% 0.014 320)',
      'oklch(11% 0.014 320)',
      'oklch(96% 0.006 320)',
    ],
    roles: {
      // 66%, not 60%: amp is a DARK page, so primary is read as TEXT on the near-black
      // ground (the masthead rubric, tour "Tickets →", release labels). High-chroma magenta
      // is perceptually dark, so at 60% that pairing measured ~4.3:1 in the blueprint sweep —
      // under AA; 66% clears it while keeping the electric-magenta voltage.
      primary: 'oklch(66% 0.24 350)',
      secondary: 'oklch(78% 0.14 200)',
      accent: 'oklch(80% 0.13 200)',
      neutral: 'oklch(30% 0.014 320)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(14% 0.014 320)',
      'oklch(11% 0.014 320)',
      'oklch(8% 0.014 320)',
      'oklch(97% 0.006 320)',
    ],
    roles: {
      primary: 'oklch(62% 0.24 350)',
      secondary: 'oklch(80% 0.14 200)',
      accent: 'oklch(82% 0.13 200)',
      neutral: 'oklch(28% 0.014 320)',
      ...STATUS_ON_DARK,
    },
  },
});

/** The ten bespoke content-template themes, flat — one per reference-driven blueprint. */
export const CONTENT_THEMES: Theme[] = [
  dispatch,
  broadsheet,
  runway,
  amplitude,
  expanse,
  podium,
  console_,
  quad,
  agency,
  amp,
];

/**
 * Blueprint slug → its bespoke theme. The slug is the `docs/templates/content/*` sparx
 * slug each DESIGN.md declares; a content template installs its paired theme by this key.
 */
export const CONTENT_THEME_BY_SLUG: Record<string, Theme> = {
  'news-feed': dispatch,
  'longform-literary': broadsheet,
  'glossy-fashion': runway,
  'culture-bold': amplitude,
  'immersive-photo': expanse,
  'ideas-talks': podium,
  'brand-newsroom': console_,
  'institution-news': quad,
  'civic-portal': agency,
  'artist-media': amp,
};
