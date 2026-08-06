// Bespoke themes for the ten reference-driven site templates.
//
// Each of the ten `docs/templates/*` blueprints carries a DESIGN.md whose §6
// ("The sparx translation") pins an authoritative colour / type / mood direction,
// tuned to look like a specific reference brand's own store — Gymshark, Kith,
// Allbirds, and so on. `SPARX_THEMES` (see `themes.ts`) is the general trade-shelf
// library a business PICKS from; these ten are the paired, hand-authored looks the
// templates SHIP with, one per blueprint slug.
//
// Same contract as the shelves: a COMPLETE light AND dark palette, WCAG AA on every
// role and on body text over every surface, in both modes. `template-themes.test.ts`
// holds that bar; it is the same set of per-theme assertions `themes.test.ts` runs,
// pointed at `TEMPLATE_THEMES`. Names are URL-safe, unique, and never collide with
// silica's shipped presets or the twenty `SPARX_THEMES`.
//
// GROUND + PRIMARY are the two axes that keep the set from collapsing to
// white-page/dark-button (the failure recorded at length in `themes.ts`). The
// spread here: four paper grounds (velodrome, atelier, maison, voltage), two
// tinted (romp, gloss), two mid-warm (sage-oat, roastery — bone-warm), one bone
// paper (bare), and one genuinely DARK page in both modes (flux). Primaries run
// mono (velodrome, atelier, maison, voltage, bare), deep (sage-oat, roastery,
// flux) and bright-fill (romp, gloss).

import { defineTheme, face, STATUS_ON_DARK, STATUS_ON_LIGHT, type Face } from './themes';
import type { Theme } from '@wizeworks/silicaui-html';

// The faces these templates pair. All are Google families; `face()` records the
// 400/600/700 weights publishing self-hosts. Oswald is the one family the shelves
// don't already use — a heavy condensed display for the athletic / catalog / luxe
// all-caps headers three of these templates lean on.
const T_FACE = {
  archivo: face('Archivo', 'sans-serif'),
  cormorant: face('Cormorant Garamond', 'serif'),
  fraunces: face('Fraunces', 'serif'),
  inter: face('Inter', 'sans-serif'),
  karla: face('Karla', 'sans-serif'),
  libreBaskerville: face('Libre Baskerville', 'serif'),
  nunito: face('Nunito', 'sans-serif'),
  oswald: face('Oswald', 'sans-serif'),
  outfit: face('Outfit', 'sans-serif'),
  spaceGrotesk: face('Space Grotesk', 'sans-serif'),
  spectral: face('Spectral', 'serif'),
  syne: face('Syne', 'sans-serif'),
  workSans: face('Work Sans', 'sans-serif'),
} satisfies Record<string, Face>;

const velodrome = defineTheme({
  // bold-athletic · reference Gymshark. GROUND paper · PRIMARY mono.
  //
  // Near-white warm-beige page carried by a NEAR-BLACK primary that inverts to
  // white in dark — the monochrome endurance-kit chrome — and ONE hi-vis
  // chartreuse accent (race-visibility culture), held to signals. Condensed
  // grotesque headers over a neutral sans, low radius, flat.
  name: 'velodrome',
  type: { body: T_FACE.inter, head: T_FACE.oswald },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(99% 0.002 85)',
      'oklch(95% 0.006 90)',
      'oklch(91% 0.006 90)',
      'oklch(16% 0.004 270)',
    ],
    roles: {
      primary: 'oklch(18% 0.006 270)',
      secondary: 'oklch(42% 0.01 270)',
      accent: 'oklch(91% 0.19 122)',
      neutral: 'oklch(22% 0.006 270)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(15% 0.004 270)',
      'oklch(12% 0.004 270)',
      'oklch(9% 0.004 270)',
      'oklch(95% 0.004 90)',
    ],
    roles: {
      // Primary inverts to paper — the confident control on near-black is printed
      // in white, not another charcoal.
      primary: 'oklch(96% 0.004 90)',
      secondary: 'oklch(72% 0.01 270)',
      accent: 'oklch(92% 0.19 122)',
      neutral: 'oklch(30% 0.006 270)',
      ...STATUS_ON_DARK,
    },
  },
});

const atelier = defineTheme({
  // editorial-grid · reference Kith. GROUND paper · PRIMARY mono.
  //
  // A paper-ground mono theme carrying a high-contrast serif display; warm light-
  // grey product tiles, pure-black primary, and effectively NO chrome accent — the
  // muted stone role is meta/links only. Colour lives in the imagery.
  name: 'atelier',
  type: { body: T_FACE.inter, head: T_FACE.fraunces },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.125rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(99% 0.001 90)',
      'oklch(95% 0.003 90)',
      'oklch(91% 0.004 85)',
      'oklch(19% 0.002 270)',
    ],
    roles: {
      primary: 'oklch(12% 0.002 270)',
      secondary: 'oklch(45% 0.008 80)',
      accent: 'oklch(57% 0.012 85)',
      neutral: 'oklch(20% 0.004 270)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(13% 0.002 270)',
      'oklch(10% 0.002 270)',
      'oklch(7% 0.002 270)',
      'oklch(95% 0.002 90)',
    ],
    roles: {
      primary: 'oklch(95% 0.002 90)',
      secondary: 'oklch(70% 0.008 80)',
      accent: 'oklch(60% 0.012 85)',
      neutral: 'oklch(28% 0.004 270)',
      ...STATUS_ON_DARK,
    },
  },
});

const sageOat = defineTheme({
  // natural-clean · reference Allbirds. GROUND tinted-paper (oat) · PRIMARY mono-deep.
  //
  // A warm oat page — visibly tinted, not white with a rumour of cream — with a
  // near-black primary that flips to oat inside dark bands, and earth support:
  // olive secondary, sage accent. Soft transitional serif over a geometric sans.
  name: 'sage-oat',
  type: { body: T_FACE.workSans, head: T_FACE.spectral },
  shape: { selector: '1rem', field: '0.5rem', box: '0.75rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(97% 0.01 85)',
      'oklch(94% 0.014 85)',
      'oklch(89% 0.02 82)',
      'oklch(20% 0.02 110)',
    ],
    roles: {
      primary: 'oklch(24% 0.008 110)',
      secondary: 'oklch(45% 0.05 122)',
      accent: 'oklch(74% 0.04 130)',
      neutral: 'oklch(26% 0.012 100)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(17% 0.012 110)',
      'oklch(14% 0.012 110)',
      'oklch(11% 0.012 110)',
      'oklch(93% 0.012 85)',
    ],
    roles: {
      primary: 'oklch(94% 0.012 85)',
      secondary: 'oklch(76% 0.06 122)',
      accent: 'oklch(84% 0.04 130)',
      neutral: 'oklch(32% 0.012 100)',
      ...STATUS_ON_DARK,
    },
  },
});

const romp = defineTheme({
  // playful-mission · reference Bombas. GROUND tinted (warm cream) · PRIMARY bright.
  //
  // A warm-cream page whose energy comes from bands, with a BRIGHT marigold primary
  // carrying dark ink (the joyful giveback action), a deep-navy secondary for the
  // dark chrome islands, and a sage accent. Heavy playful display over a rounded
  // friendly sans; generously round, softly lifted.
  name: 'romp',
  type: { body: T_FACE.nunito, head: T_FACE.syne },
  shape: { selector: '2rem', field: '0.75rem', box: '1rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(97% 0.02 85)',
      'oklch(94% 0.02 85)',
      'oklch(88% 0.03 82)',
      'oklch(24% 0.02 85)',
    ],
    roles: {
      primary: 'oklch(80% 0.15 85)',
      secondary: 'oklch(38% 0.06 258)',
      accent: 'oklch(80% 0.07 140)',
      neutral: 'oklch(24% 0.02 85)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(19% 0.02 258)',
      'oklch(16% 0.02 258)',
      'oklch(13% 0.02 258)',
      'oklch(94% 0.014 85)',
    ],
    roles: {
      primary: 'oklch(82% 0.14 85)',
      secondary: 'oklch(74% 0.08 258)',
      accent: 'oklch(84% 0.06 140)',
      neutral: 'oklch(32% 0.02 85)',
      ...STATUS_ON_DARK,
    },
  },
});

const roastery = defineTheme({
  // warm-subscription · reference Bokksu. GROUND mid-warm (cream) · PRIMARY deep.
  //
  // A mid-warm cream page with an espresso dark-chrome island for the footer /
  // newsletter beats. Deep TERRACOTTA primary (also the price + save figures) with
  // white ink on cream, a disciplined forest-green secondary for headings, espresso-
  // brown neutral. `error` moves off terracotta to crimson so two warm signals
  // stay two. High-contrast serif display over a humanist sans.
  name: 'roastery',
  type: { body: T_FACE.karla, head: T_FACE.cormorant },
  shape: { selector: '2rem', field: '0.5rem', box: '0.875rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(92% 0.035 80)',
      'oklch(89% 0.04 78)',
      'oklch(84% 0.05 75)',
      'oklch(25% 0.03 45)',
    ],
    roles: {
      primary: 'oklch(50% 0.16 38)',
      secondary: 'oklch(40% 0.04 145)',
      accent: 'oklch(70% 0.12 55)',
      neutral: 'oklch(28% 0.03 45)',
      ...STATUS_ON_LIGHT,
      error: 'oklch(50% 0.2 14)',
    },
  },
  dark: {
    surfaces: [
      'oklch(19% 0.02 45)',
      'oklch(16% 0.02 45)',
      'oklch(13% 0.02 45)',
      'oklch(93% 0.02 80)',
    ],
    roles: {
      primary: 'oklch(72% 0.14 40)',
      secondary: 'oklch(74% 0.07 145)',
      accent: 'oklch(80% 0.11 55)',
      neutral: 'oklch(34% 0.03 45)',
      ...STATUS_ON_DARK,
      error: 'oklch(70% 0.18 14)',
    },
  },
});

const maison = defineTheme({
  // couture-serif · reference Victoria Beckham. GROUND paper · PRIMARY mono.
  //
  // Colder and starker than atelier: pure white, PURE-BLACK ink, warm stone tiles,
  // and a classical serif set across EVERYTHING (no separate head — headings inherit
  // the serif body). Accent is a muted graphite for whisper-labels only; restraint
  // is the point. Zero radius, flat.
  name: 'maison',
  type: { body: T_FACE.libreBaskerville },
  shape: { selector: '0rem', field: '0rem', box: '0rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(99% 0.001 90)',
      'oklch(95% 0.002 85)',
      'oklch(91% 0.004 85)',
      'oklch(0% 0 0)',
    ],
    roles: {
      primary: 'oklch(8% 0 0)',
      secondary: 'oklch(40% 0.004 270)',
      accent: 'oklch(48% 0.008 85)',
      neutral: 'oklch(10% 0 0)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(12% 0 0)', 'oklch(9% 0 0)', 'oklch(6% 0 0)', 'oklch(97% 0.001 90)'],
    roles: {
      primary: 'oklch(96% 0.001 90)',
      secondary: 'oklch(66% 0.004 270)',
      accent: 'oklch(60% 0.008 85)',
      neutral: 'oklch(26% 0 0)',
      ...STATUS_ON_DARK,
    },
  },
});

const flux = defineTheme({
  // tech-cinematic · reference DJI. GROUND dark (both modes) · PRIMARY deep.
  //
  // A genuinely dark PAGE in both modes — a cinematic showroom where product renders
  // pop against near-black, and "dark mode" simply drops further. Deep electric-blue
  // primary is the only chromatic element (Store/Buy, active nav), cyan secondary +
  // signal-blue accent for spec highlights and live chips. Takes the bright status
  // set in both modes. Technical grotesk headers, low radius, hairline structure, flat.
  name: 'flux',
  type: { body: T_FACE.inter, head: T_FACE.spaceGrotesk },
  shape: { selector: '0.5rem', field: '0.25rem', box: '0.375rem', border: '1px', depth: '0' },
  light: {
    surfaces: [
      'oklch(18% 0.012 260)',
      'oklch(15% 0.012 260)',
      'oklch(12% 0.012 260)',
      'oklch(96% 0.006 260)',
    ],
    roles: {
      primary: 'oklch(62% 0.19 250)',
      secondary: 'oklch(74% 0.13 210)',
      accent: 'oklch(80% 0.14 220)',
      neutral: 'oklch(31% 0.012 260)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(13% 0.01 260)',
      'oklch(10% 0.01 260)',
      'oklch(7% 0.01 260)',
      'oklch(97% 0.005 260)',
    ],
    roles: {
      primary: 'oklch(66% 0.18 250)',
      secondary: 'oklch(76% 0.13 210)',
      accent: 'oklch(82% 0.14 220)',
      neutral: 'oklch(29% 0.012 260)',
      ...STATUS_ON_DARK,
    },
  },
});

const gloss = defineTheme({
  // beauty-counter · reference Sephora / Huda. GROUND tinted (blush) · PRIMARY bright.
  //
  // Blush-tinted grounds like salon/petal, but where those carry a PALE primary this
  // fills with a bold, saturated HOT MAGENTA carrying WHITE ink — the header band,
  // buttons, price, stars. Wine/plum secondary for editorial grounds, warm-nude accent
  // for the loyalty roundels. Rounded, lifted.
  //
  // PRIMARY LIGHTNESS IS AA-PINNED at 55% in both modes. silica derives the button ink
  // from the primary's lightness, and the crossover where it flips from black to white
  // sits at ~56.5%: at 58/59% the derivation picked BLACK and still only reached
  // 4.3/4.5 (both below the 4.5 body bar the catalog sweep holds a button label to),
  // which also contradicted this theme's whole white-inked identity. 55% derives WHITE
  // at 5.3:1 — comfortably AA, and the look the rest of this comment describes. The
  // catalog sweep over TEMPLATE_THEMES (site-lint) is what pins it.
  name: 'gloss',
  type: { body: T_FACE.inter, head: T_FACE.outfit },
  shape: { selector: '2rem', field: '0.5rem', box: '1rem', depth: '1' },
  light: {
    surfaces: [
      'oklch(98% 0.012 350)',
      'oklch(95% 0.03 350)',
      'oklch(90% 0.05 345)',
      'oklch(24% 0.03 345)',
    ],
    roles: {
      primary: 'oklch(55% 0.24 355)',
      secondary: 'oklch(40% 0.14 345)',
      accent: 'oklch(80% 0.09 45)',
      neutral: 'oklch(26% 0.02 345)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(18% 0.02 345)',
      'oklch(15% 0.02 345)',
      'oklch(12% 0.02 345)',
      'oklch(94% 0.014 350)',
    ],
    roles: {
      // Held at 55% (see the light note) so silica derives WHITE ink and white-on-
      // magenta clears AA in dark too — the brand primary stays white-inked in both
      // modes rather than flipping to dark.
      primary: 'oklch(55% 0.24 355)',
      secondary: 'oklch(74% 0.12 345)',
      accent: 'oklch(84% 0.08 45)',
      neutral: 'oklch(32% 0.02 345)',
      ...STATUS_ON_DARK,
    },
  },
});

const voltage = defineTheme({
  // catalog-dense · reference Fashion Nova. GROUND paper · PRIMARY mono.
  //
  // White/grey content alternating with near-black chrome, primary a near-black
  // mono fill inverting to white on the dark island. ONE loud sale-red accent for
  // badges / prices / urgency — and because the brand red sits on `error`'s hue,
  // `error` moves to a distinct deep crimson (as `kitchen` does). Bold grotesque
  // caps headers over a neutral sans, low radius, flat.
  name: 'voltage',
  type: { body: T_FACE.inter, head: T_FACE.archivo },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: ['oklch(99% 0 0)', 'oklch(96% 0 0)', 'oklch(91% 0 0)', 'oklch(16% 0.004 270)'],
    roles: {
      primary: 'oklch(16% 0.004 270)',
      secondary: 'oklch(44% 0.006 270)',
      accent: 'oklch(55% 0.22 25)',
      neutral: 'oklch(20% 0.004 270)',
      ...STATUS_ON_LIGHT,
      error: 'oklch(50% 0.2 12)',
    },
  },
  dark: {
    surfaces: [
      'oklch(15% 0.004 270)',
      'oklch(12% 0.004 270)',
      'oklch(9% 0.004 270)',
      'oklch(96% 0 0)',
    ],
    roles: {
      primary: 'oklch(96% 0 0)',
      secondary: 'oklch(70% 0.006 270)',
      accent: 'oklch(62% 0.2 25)',
      neutral: 'oklch(28% 0.004 270)',
      ...STATUS_ON_DARK,
      error: 'oklch(66% 0.2 12)',
    },
  },
});

const bare = defineTheme({
  // luxe-minimal · reference SKIMS. GROUND paper (warm bone) · PRIMARY mono.
  //
  // A warm bone off-white with a greige ramp and near-black ink, primary a near-black
  // mono fill (ink AND button). DELIBERATELY no real accent — the accent role is a
  // muted warm greige used as a signal only; chroma is delivered by product imagery,
  // never the theme. Heavy condensed all-caps display over a neutral sans, low radius.
  name: 'bare',
  type: { body: T_FACE.inter, head: T_FACE.oswald },
  shape: { selector: '0.25rem', field: '0.125rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(96% 0.006 85)',
      'oklch(93% 0.01 82)',
      'oklch(88% 0.014 80)',
      'oklch(18% 0.008 70)',
    ],
    roles: {
      primary: 'oklch(18% 0.006 70)',
      secondary: 'oklch(45% 0.012 75)',
      accent: 'oklch(60% 0.02 75)',
      neutral: 'oklch(22% 0.008 70)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(16% 0.008 70)',
      'oklch(13% 0.008 70)',
      'oklch(10% 0.008 70)',
      'oklch(94% 0.008 85)',
    ],
    roles: {
      primary: 'oklch(95% 0.006 85)',
      secondary: 'oklch(70% 0.012 75)',
      accent: 'oklch(66% 0.02 75)',
      neutral: 'oklch(30% 0.008 70)',
      ...STATUS_ON_DARK,
    },
  },
});

/** The ten bespoke template themes, flat — one per reference-driven blueprint. */
export const TEMPLATE_THEMES: Theme[] = [
  velodrome,
  atelier,
  sageOat,
  romp,
  roastery,
  maison,
  flux,
  gloss,
  voltage,
  bare,
];

/**
 * Blueprint slug → its bespoke theme. The slug is the `docs/templates/*` sparx slug
 * each DESIGN.md declares; a template installs its paired theme by this key.
 */
export const TEMPLATE_THEME_BY_SLUG: Record<string, Theme> = {
  'bold-athletic': velodrome,
  'editorial-grid': atelier,
  'natural-clean': sageOat,
  'playful-mission': romp,
  'warm-subscription': roastery,
  'couture-serif': maison,
  'tech-cinematic': flux,
  'beauty-counter': gloss,
  'catalog-dense': voltage,
  'luxe-minimal': bare,
};
