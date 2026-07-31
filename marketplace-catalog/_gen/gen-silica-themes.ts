// Generator: the marketplace THEME shelf — one bundle per sparx silica theme
// (`SPARX_THEMES`, packages/silica-catalog). A marketplace theme is a DISCOVERY
// listing for a look that already lives in the Site Builder: the payload is the
// ship-ready silica `Theme` (`resolveSparxTheme`, the exact `site.theme` a site
// adopts), and "Use this theme" hands the slug to onboarding so the Builder applies
// it via the existing silica path (docs/118). This replaces the retired v1/v2
// `DataThemePreset` marketplace themes — one theme system, surfaced publicly.
//
// Previews are LIVE (docs/118): the marketplace renders each theme in-browser from its
// payload (apps/web `ThemePreview`), so a bundle ships NO baked image — just sparx.json +
// theme.ts. That's why there's no render step below and no media/ dir.
//
// Run (docs marketplace-catalog/CLAUDE.md — the generator is the source of truth):
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-silica-themes.ts"
//   pnpm exec prettier --write "marketplace-catalog/themes/**" "marketplace-catalog/_gen/gen-silica-themes.ts"
//   pnpm --filter @sparx/api-rest marketplace:ingest
//
// WHY RELATIVE IMPORTS. This file reads the theme catalog + color util (workspace
// packages) but lives under marketplace-catalog/ which has no node_modules, so a bare
// `@sparx/*` specifier can't resolve here. Importing each package's `src` by relative
// path lets tsx compile it in place; each package's OWN deps resolve from its location.
// The EMITTED theme.ts is the opposite discipline — pure data, no imports.

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPARX_THEMES } from '../../packages/silica-catalog/src/themes';
import { resolveSparxTheme } from '../../packages/silica-catalog/src/resolve-sparx-theme';
import { colorToHex } from '../../packages/site-themes/src/v2/color';
import type { Theme } from '@wizeworks/silicaui-html';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = join(here, '..'); // marketplace-catalog/
const themesDir = join(catalog, 'themes');

// ── Per-theme marketing metadata ────────────────────────────────────────────────
// Written for a non-technical business owner: the label is the theme's own name, and
// each facet + line stays honest to the trade the theme was tuned for (see the theme's
// comment in silica-catalog/themes.ts). `industry`/`mood`/`colorFamily` drive the
// public browse rail; the browse rail auto-populates from whatever values exist.
interface Meta {
  industry: string;
  mood: string; // the "Style" facet
  colorFamily: string; // the "Color" facet — honest to the theme's identity hue
  density: string;
  tagline: string;
  description: string;
  // Which role the card accent (hex chip + wash) is pulled from. Default 'primary';
  // overridden only when the light-mode primary is too pale to read as a chip (a
  // dark-ground theme whose primary inverts to near-white).
  accentRole?: 'primary' | 'secondary' | 'accent';
}

const META: Record<string, Meta> = {
  // Shops & dining
  boutique: {
    industry: 'Apparel & Lifestyle',
    mood: 'Editorial',
    colorFamily: 'Mono',
    density: 'Spacious',
    tagline: 'Quiet, considered retail where the product is the color.',
    description:
      'Near-white and almost colorless, with a near-black primary and one soft blush accent. Built for the shop that hangs forty things, not four hundred — small fashion, jewelry, and considered goods.',
  },
  kitchen: {
    industry: 'Food & Beverage',
    mood: 'Vibrant',
    colorFamily: 'Red',
    density: 'Standard',
    tagline: 'Warm and appetizing for restaurants, cafés, and bakeries.',
    description:
      'A genuinely warm, buttery page with a tomato-red brand and olive support — tuned for appetite and momentum. For restaurants, cafés, bakeries, and anywhere the food should look as good on screen as on the plate.',
  },
  cellar: {
    industry: 'Food & Beverage',
    mood: 'Luxe',
    colorFamily: 'Wine',
    density: 'Spacious',
    tagline: 'Low-lit and grown-up for wine, beer, spirits, and bars.',
    description:
      'A dark page even in light mode — the low-lit room a wine bar or bottle shop already is. Deep burgundy and restrained gold for merchants who sell an evening, not just a bottle.',
  },
  petal: {
    industry: 'Weddings & Events',
    mood: 'Playful',
    colorFamily: 'Pink',
    density: 'Standard',
    tagline: 'Soft and celebratory for florists, weddings, and events.',
    description:
      'A gentle blush ground with a confident rose primary — warm without tipping into sugary. For florists, wedding planners, and event stylists whose work is already the prettiest thing on the page.',
  },
  lodge: {
    industry: 'Travel & Hospitality',
    mood: 'Earthy',
    colorFamily: 'Green',
    density: 'Standard',
    tagline: 'Grounded and welcoming for stays and hospitality.',
    description:
      'An earthy, outdoorsy palette of forest and clay that feels like arriving somewhere. For hotels, cabins, lodges, and short-stay rentals that trade on place and calm.',
  },
  // Trades & on-site work
  workshop: {
    industry: 'Trades & Construction',
    mood: 'Utilitarian',
    colorFamily: 'Amber',
    density: 'Standard',
    tagline: 'Sturdy and no-nonsense for fabrication and trade.',
    description:
      'A plain, hard-wearing look with a safety-amber accent and generous hit areas. For fabrication, joinery, general contracting, and anyone whose website should read like their work: solid and squared-up.',
  },
  garage: {
    industry: 'Automotive',
    mood: 'Bold',
    colorFamily: 'Orange',
    density: 'Standard',
    tagline: 'Bold and mechanical for vehicle service and parts.',
    description:
      'A dark, high-contrast shop floor with an ignition-orange primary. For vehicle service, repair, tuning, and parts sellers who want the site to look as capable as the bay.',
  },
  field: {
    industry: 'Agriculture & Outdoor',
    mood: 'Earthy',
    colorFamily: 'Green',
    density: 'Standard',
    tagline: 'Rugged and outdoorsy for land and outdoor work.',
    description:
      'A grounded green-and-soil palette built for daylight and mud. For farming, landscaping, tree work, and outdoor contracting — honest, weatherproof, and easy to read on a phone in the sun.',
  },
  harbor: {
    industry: 'Logistics & Freight',
    mood: 'Professional',
    colorFamily: 'Blue',
    density: 'Wide',
    tagline: 'Wide and dependable for freight and heavy work.',
    description:
      'A calm navy on a wide, data-friendly layout that holds schedules and specs without clutter. For freight, haulage, plant hire, and industrial suppliers who move serious things on time.',
  },
  hearth: {
    industry: 'Home Services',
    mood: 'Calm',
    colorFamily: 'Terracotta',
    density: 'Standard',
    tagline: 'Warm and homey for interiors and home services.',
    description:
      'A soft terracotta warmth that reads as lived-in rather than corporate. For home services, interiors, furnishings, and the trades people invite indoors.',
  },
  // Care & professional
  clinic: {
    industry: 'Health & Wellness',
    mood: 'Calm',
    colorFamily: 'Teal',
    density: 'Standard',
    tagline: 'Clean and reassuring for care and wellness.',
    description:
      'A cool, uncluttered teal-and-white that signals hygiene and calm. For medical, dental, physio, and wellness practices where a patient should feel looked after before they even call.',
  },
  salon: {
    industry: 'Wellness & Beauty',
    mood: 'Luxe',
    colorFamily: 'Mauve',
    density: 'Spacious',
    tagline: 'Polished and inviting for beauty and spa.',
    description:
      'A softly luxe mauve with generous whitespace that feels like a treatment room. For hair, beauty, nails, lashes, and spa businesses selling a little indulgence.',
  },
  ledger: {
    industry: 'Professional Services',
    mood: 'Professional',
    colorFamily: 'Navy',
    density: 'Wide',
    tagline: 'Precise and trustworthy for finance and law.',
    description:
      'A restrained navy on a wide, orderly layout that reads as competence and discretion. For accountants, lawyers, and financial advisers whose clients are buying judgment.',
  },
  summit: {
    industry: 'Professional Services',
    mood: 'Bold',
    colorFamily: 'Indigo',
    density: 'Wide',
    tagline: 'Confident and modern for consulting and B2B.',
    description:
      'A crisp indigo with a confident, contemporary rhythm. For consultancies, agencies, and B2B firms that want to look like the sharpest room in the deal.',
  },
  academy: {
    industry: 'Education',
    mood: 'Professional',
    colorFamily: 'Crimson',
    density: 'Standard',
    tagline: 'Collegiate and credible for teaching and training.',
    description:
      'A warm collegiate crimson that reads as established rather than childish. For schools, tutors, course creators, and training providers who need to look both trustworthy and serious.',
  },
  // Studios & publishing
  studio: {
    industry: 'Agency & Portfolio',
    mood: 'Minimal',
    colorFamily: 'Graphite',
    density: 'Spacious',
    tagline: 'Spare and gallery-like for creative studios.',
    description:
      'A near-silent graphite-on-white with acres of space, so the work is the only loud thing. For design, photography, and creative studios whose portfolio should carry the whole page.',
  },
  gallery: {
    industry: 'Arts & Culture',
    mood: 'Editorial',
    colorFamily: 'Stone',
    density: 'Spacious',
    // A dark-ground theme: the light-mode primary inverts to near-white, so the
    // card accent reads from the mid-stone secondary instead.
    accentRole: 'secondary',
    tagline: 'Museum-quiet for artists and makers.',
    description:
      'A warm stone neutral and a serif voice that treats every piece like it is hung, not posted. For artists, makers, and portfolio sites where the images earn the silence around them.',
  },
  press: {
    industry: 'Media & Publishing',
    mood: 'Editorial',
    colorFamily: 'Red',
    density: 'Wide',
    tagline: 'Column-driven and literary for publishing.',
    description:
      'A paper-white editorial look built around type and columns, with a single decisive red for mastheads and links. For publishers, newsletters, magazines, and blogs where the writing is the product.',
  },
  stage: {
    industry: 'Arts & Events',
    mood: 'Bold',
    colorFamily: 'Violet',
    density: 'Standard',
    tagline: 'Dramatic and low-lit for shows and events.',
    description:
      'A dark house with a spotlight-violet primary — the room going quiet before the lights come up. For music, theatre, comedy, and ticketed events that sell a night out.',
  },
  signal: {
    industry: 'Tech & Electronics',
    mood: 'Bold',
    colorFamily: 'Indigo',
    density: 'Standard',
    tagline: 'Sharp and product-forward for software and apps.',
    description:
      'A confident indigo with a clean, product-forward rhythm. For software, apps, devices, and subscriptions that want the site to feel as considered as the thing it sells.',
  },
};

const title = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

/** colorToHex, fail-fast: a theme primary that won't resolve to hex is a generator
 *  bug worth stopping on, not a silent `#000000`. */
function hex(value: string | undefined, ctx: string): string {
  const out = colorToHex(value ?? null);
  if (!out) throw new Error(`gen-silica-themes: ${ctx} did not resolve to hex (got ${value})`);
  return out;
}

const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';

/** The emitted, pure-data theme.ts payload — the ship-ready silica `Theme`
 *  (`resolveSparxTheme`). The ingest `import()`s this module with no workspace
 *  resolution, so it carries ZERO imports: just `export default { … }`. */
function themeTs(name: string, resolved: Theme): string {
  return (
    `// sparx marketplace theme — '${name}'. The ship-ready silica \`Theme\` this listing\n` +
    `// surfaces: the exact \`site.theme\` a site adopts when it uses this theme (light in\n` +
    `// \`tokens\`, the dark color delta in \`dark\`). GENERATED by\n` +
    `// marketplace-catalog/_gen/gen-silica-themes.ts from SPARX_THEMES — do NOT hand-edit.\n` +
    `// Pure data (no imports): the ingest resolves this module with no workspace resolution.\n` +
    `export default ${JSON.stringify(resolved, null, 2)} as const;\n`
  );
}

function sparxJson(opts: {
  slug: string;
  name: string;
  meta: Meta;
  accent: string;
  sortWeight: number;
}): string {
  return json({
    schemaVersion: 1,
    category: 'theme',
    slug: opts.slug,
    name: title(opts.name),
    version: '1.0.0',
    tagline: opts.meta.tagline,
    description: opts.meta.description,
    payload: 'theme.ts',
    facets: {
      mood: opts.meta.mood,
      colorFamily: opts.meta.colorFamily,
      density: opts.meta.density,
      industry: opts.meta.industry,
    },
    pricing: { model: 'free', priceCents: 0 },
    // No media: themes render a LIVE preview in-browser (docs/118), so a bundle ships
    // no baked image — the marketplace draws it from theme.ts.
    media: [],
    author: { displayName: 'sparx' },
    accent: opts.accent,
    sortWeight: opts.sortWeight,
  });
}

async function main(): Promise<void> {
  await fs.mkdir(themesDir, { recursive: true });
  let written = 0;
  for (const [i, theme] of SPARX_THEMES.entries()) {
    const name = theme.name;
    const meta = META[name];
    if (!meta) throw new Error(`gen-silica-themes: no marketing metadata for theme '${name}'`);

    const resolved = resolveSparxTheme(theme);
    const t = resolved.tokens;
    const accentRole = meta.accentRole ?? 'primary';
    const accent = hex(t[`--color-${accentRole}`], `${name} --color-${accentRole}`);

    const bundleDir = join(themesDir, name);
    await fs.mkdir(bundleDir, { recursive: true });
    await fs.writeFile(
      join(bundleDir, 'sparx.json'),
      sparxJson({ slug: name, name, meta, accent, sortWeight: 100 - i })
    );
    await fs.writeFile(join(bundleDir, 'theme.ts'), themeTs(name, resolved));

    written += 1;
    console.log(`  wrote themes/${name} (accent ${accent}, ${meta.industry})`);
  }
  console.log(`\ngen-silica-themes: ${written} theme bundles written to ${themesDir} (live preview, no media).`);
}

main().catch((err: unknown) => {
  console.error('gen-silica-themes failed:', err);
  process.exit(1);
});
