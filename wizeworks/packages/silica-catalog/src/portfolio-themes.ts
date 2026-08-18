// Bespoke themes for the six PERSONAL-PORTFOLIO site templates
// (marketplace-catalog/blueprints/sparx-portfolio-*).
//
// The third bespoke shelf, after `template-themes.ts` (ten commerce looks) and
// `content-themes.ts` (ten publisher looks). A personal portfolio is neither a shop
// nor a publication — it is one PERSON'S identity, so each of the six commits hard to
// its own world: a designer's typographic restraint, a photographer's disappearing
// gallery chrome, a developer's terminal, an illustrator's saturated riso, a writer's
// warm-serif page, a studio's sober concrete. The look IS the portfolio, so the spread
// here is the widest of the three shelves.
//
// Same contract as every other shelf: a COMPLETE light AND dark palette, WCAG AA on
// every role and on body text over every surface, in both modes. `portfolio-themes.test.ts`
// holds that bar — the same per-theme assertions the other shelves run, pointed at
// `PORTFOLIO_THEMES`. Names are URL-safe, unique, and never collide with silica's presets,
// the twenty `SPARX_THEMES`, the ten `TEMPLATE_THEMES`, or the ten `CONTENT_THEMES`.
//
// SECONDARY IS DARK ON A LIGHT GROUND (and light on a dark one). The portfolio section kit
// uses `text-secondary` for readable micro-labels — a project's role/year, a duration, a
// facts-column key — so `secondary` is never a faint tint; it is a legible ink a shade off
// the body. On the dark-ground themes (void) the same rule means a LIGHT secondary.
//
// GROUND + PRIMARY, the axes that keep six from collapsing into one recolored layout:
// ledger (cool paper · electric-blue primary), silver (gallery paper · MONO near-black,
// accent-free like runway — the photographs are the only color), void (terminal black in
// BOTH modes · acid-green primary + cyan accent, monospace body), riso (warm cream · coral
// primary + cobalt accent, expressive), manuscript (warm paper · oxblood primary, serif
// across), atlas (concrete/bone · burnt-amber primary + slate accent, architectural grotesk).

import { defineTheme, face, STATUS_ON_DARK, STATUS_ON_LIGHT, type Face } from './themes';
import type { Theme } from '@wizeworks/silicaui-html';

// The faces the portfolio templates pair. All Google families; `face()` records the
// 400/600/700 weights the storefront self-hosts.
const P_FACE = {
  archivo: face('Archivo', 'sans-serif'),
  fraunces: face('Fraunces', 'serif'),
  inter: face('Inter', 'sans-serif'),
  jetbrainsMono: face('JetBrains Mono', 'monospace'),
  playfair: face('Playfair Display', 'serif'),
  spaceGrotesk: face('Space Grotesk', 'sans-serif'),
  spectral: face('Spectral', 'serif'),
  syne: face('Syne', 'sans-serif'),
  workSans: face('Work Sans', 'sans-serif'),
} satisfies Record<string, Face>;

const casework = defineTheme({
  // portfolio-designer · the case-study designer (codename Ledger). GROUND cool paper ·
  // PRIMARY electric blue. (Theme token is `casework` — `ledger` is a SPARX trade shelf.)
  //
  // Judgment over decoration: a near-white, almost achromatic page carried by ONE electric
  // signal-blue — the primary action, the outcome metric, the active filter — with a tight
  // grotesk display over a humanist sans. Small radius, hairline structure, flat.
  name: 'casework',
  type: { body: P_FACE.inter, head: P_FACE.spaceGrotesk },
  shape: { selector: '0.375rem', field: '0.375rem', box: '0.5rem', border: '1px', depth: '0' },
  light: {
    surfaces: [
      'oklch(99% 0.002 250)',
      'oklch(96% 0.004 255)',
      'oklch(92% 0.006 258)',
      'oklch(19% 0.01 260)',
    ],
    roles: {
      primary: 'oklch(50% 0.2 258)',
      secondary: 'oklch(42% 0.03 260)',
      accent: 'oklch(50% 0.2 258)',
      neutral: 'oklch(24% 0.01 260)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(16% 0.008 260)',
      'oklch(13% 0.008 260)',
      'oklch(10% 0.008 260)',
      'oklch(96% 0.004 255)',
    ],
    roles: {
      primary: 'oklch(64% 0.18 258)',
      secondary: 'oklch(74% 0.03 260)',
      accent: 'oklch(64% 0.18 258)',
      neutral: 'oklch(30% 0.008 260)',
      ...STATUS_ON_DARK,
    },
  },
});

const silver = defineTheme({
  // portfolio-photographer · image-first. GROUND gallery paper · PRIMARY mono.
  //
  // The work is the design: a cool near-white gallery wall, near-black ink and primary, an
  // elegant serif display over a clean sans. DELIBERATELY no chromatic accent — the accent
  // role is a muted graphite for whisper-labels only; every ounce of color comes from the
  // photographs. Zero radius, flat.
  name: 'silver',
  type: { body: P_FACE.inter, head: P_FACE.fraunces },
  shape: { selector: '0rem', field: '0rem', box: '0rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.001 250)',
      'oklch(95% 0.002 250)',
      'oklch(90% 0.003 250)',
      'oklch(15% 0.002 260)',
    ],
    roles: {
      primary: 'oklch(18% 0.002 260)',
      secondary: 'oklch(40% 0.004 260)',
      accent: 'oklch(50% 0.006 260)',
      neutral: 'oklch(16% 0.002 260)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(14% 0.002 260)',
      'oklch(11% 0.002 260)',
      'oklch(8% 0.002 260)',
      'oklch(96% 0.002 250)',
    ],
    roles: {
      primary: 'oklch(95% 0.002 250)',
      secondary: 'oklch(66% 0.004 260)',
      accent: 'oklch(60% 0.006 260)',
      neutral: 'oklch(28% 0.002 260)',
      ...STATUS_ON_DARK,
    },
  },
});

const voidTheme = defineTheme({
  // portfolio-developer · the terminal. GROUND black (both modes) · PRIMARY neon.
  //
  // The medium is the message: a near-black void in BOTH modes, faintly green-cast, with a
  // monospace body and ONE acid-green primary + electric-cyan accent — the console prompt.
  // Text is off-white; surfaces separate by a base-shift + border, never a glow. Medium
  // radius. Bright statuses in both modes (dark page).
  name: 'void',
  type: { body: P_FACE.jetbrainsMono, head: P_FACE.spaceGrotesk },
  shape: { selector: '0.375rem', field: '0.375rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(16% 0.012 160)',
      'oklch(13% 0.012 160)',
      'oklch(10% 0.012 160)',
      'oklch(94% 0.02 150)',
    ],
    roles: {
      primary: 'oklch(80% 0.19 150)',
      secondary: 'oklch(82% 0.03 160)',
      accent: 'oklch(78% 0.14 195)',
      neutral: 'oklch(30% 0.012 160)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(13% 0.012 160)',
      'oklch(10% 0.012 160)',
      'oklch(7% 0.012 160)',
      'oklch(95% 0.02 150)',
    ],
    roles: {
      primary: 'oklch(82% 0.19 150)',
      secondary: 'oklch(84% 0.03 160)',
      accent: 'oklch(80% 0.14 195)',
      neutral: 'oklch(28% 0.012 160)',
      ...STATUS_ON_DARK,
    },
  },
});

const riso = defineTheme({
  // portfolio-illustrator · personality-first. GROUND warm cream · PRIMARY coral, ACCENT cobalt.
  //
  // The palette IS the brand: a warm riso-cream page with a DUOTONE — an electric coral
  // primary and a cobalt accent — over a deep indigo-ink. Expressive display over a rounded
  // humanist sans, generous radius, flat (the texture is the tenant's illustration, not a
  // shadow). A loud, unmistakably-one-maker look.
  name: 'riso',
  type: { body: P_FACE.workSans, head: P_FACE.syne },
  shape: { selector: '1rem', field: '0.5rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.028 85)',
      'oklch(94% 0.038 80)',
      'oklch(89% 0.05 76)',
      'oklch(22% 0.06 285)',
    ],
    roles: {
      primary: 'oklch(55% 0.2 28)',
      secondary: 'oklch(40% 0.08 285)',
      accent: 'oklch(47% 0.18 262)',
      neutral: 'oklch(24% 0.05 285)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(19% 0.04 285)',
      'oklch(16% 0.04 285)',
      'oklch(13% 0.04 285)',
      'oklch(95% 0.03 85)',
    ],
    roles: {
      primary: 'oklch(66% 0.2 28)',
      secondary: 'oklch(78% 0.06 285)',
      accent: 'oklch(72% 0.15 258)',
      neutral: 'oklch(30% 0.04 285)',
      ...STATUS_ON_DARK,
    },
  },
});

const manuscript = defineTheme({
  // portfolio-writer · type-as-hero. GROUND warm paper · PRIMARY oxblood, serif ACROSS.
  //
  // The words are the work: a warm-paper reading page set in SERIF ACROSS — a high-contrast
  // display serif over a readable text serif — with ONE oxblood on the byline rubric, links
  // and the primary action. Zero radius, hairline rules, flat. `error` moves to a distinct
  // crimson so the brand red and the warning red stay two different reds.
  name: 'manuscript',
  type: { body: P_FACE.spectral, head: P_FACE.fraunces },
  shape: { selector: '0rem', field: '0.125rem', box: '0rem', border: '1px', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.006 85)',
      'oklch(95% 0.008 82)',
      'oklch(90% 0.01 80)',
      'oklch(20% 0.01 60)',
    ],
    roles: {
      primary: 'oklch(45% 0.13 32)',
      secondary: 'oklch(42% 0.03 60)',
      accent: 'oklch(45% 0.13 32)',
      neutral: 'oklch(23% 0.008 60)',
      ...STATUS_ON_LIGHT,
      error: 'oklch(50% 0.19 12)',
    },
  },
  dark: {
    surfaces: [
      'oklch(17% 0.008 60)',
      'oklch(14% 0.008 60)',
      'oklch(11% 0.008 60)',
      'oklch(95% 0.006 85)',
    ],
    roles: {
      primary: 'oklch(64% 0.13 32)',
      secondary: 'oklch(70% 0.03 60)',
      accent: 'oklch(64% 0.13 32)',
      neutral: 'oklch(30% 0.008 60)',
      ...STATUS_ON_DARK,
      error: 'oklch(66% 0.18 12)',
    },
  },
});

const atlas = defineTheme({
  // portfolio-studio · range with precision. GROUND concrete/bone · PRIMARY burnt amber, ACCENT slate.
  //
  // A studio/architect index: a sober bone-and-concrete chassis with a burnt-amber primary
  // (the CTA, the active category, the project year) and a cool slate accent (a second sober
  // hue for the facts column), under a wide architectural grotesk. Modest radius, hairline
  // structure, flat — the large-format work is the color, the chassis stays quiet.
  name: 'atlas',
  type: { body: P_FACE.inter, head: P_FACE.archivo },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', border: '1px', depth: '0' },
  light: {
    surfaces: [
      'oklch(96% 0.004 90)',
      'oklch(93% 0.005 90)',
      'oklch(88% 0.007 88)',
      'oklch(18% 0.005 90)',
    ],
    roles: {
      primary: 'oklch(52% 0.13 55)',
      secondary: 'oklch(41% 0.02 90)',
      accent: 'oklch(48% 0.06 240)',
      neutral: 'oklch(22% 0.006 90)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(18% 0.005 90)',
      'oklch(15% 0.005 90)',
      'oklch(12% 0.005 90)',
      'oklch(95% 0.004 90)',
    ],
    roles: {
      primary: 'oklch(72% 0.14 60)',
      secondary: 'oklch(72% 0.02 90)',
      accent: 'oklch(74% 0.07 235)',
      neutral: 'oklch(30% 0.006 90)',
      ...STATUS_ON_DARK,
    },
  },
});

/** The six bespoke portfolio-template themes, flat — one per personal-portfolio blueprint. */
export const PORTFOLIO_THEMES: Theme[] = [casework, silver, voidTheme, riso, manuscript, atlas];

/**
 * Blueprint slug → its bespoke theme. The slug is the `sparx-portfolio-<persona>` bundle's
 * own slug; a portfolio template installs its paired theme by this key. Disjoint from the
 * commerce + content slug namespaces, so the shared harness lookup resolves each uniquely.
 */
export const PORTFOLIO_THEME_BY_SLUG: Record<string, Theme> = {
  'portfolio-designer': casework,
  'portfolio-photographer': silver,
  'portfolio-developer': voidTheme,
  'portfolio-illustrator': riso,
  'portfolio-writer': manuscript,
  'portfolio-studio': atlas,
};
