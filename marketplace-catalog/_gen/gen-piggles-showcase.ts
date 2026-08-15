// Generator: the Piggles SHOWCASE blueprint — the reference site a Piggles
// business is offered by default at signup.
//
// It is a clone of the golden `sparx` bundle in exactly the sense the 20 themed
// clones are (same captured site, same content, commerce and emails; only the
// look and the naming differ), and it exists for the same reason they do: the
// showcase is the platform demonstrating itself, so it is brand identity, and
// there is no single artifact that can be two brands at once. Strip the brand
// and you have a bare template — which the ~169 vertical bundles already are,
// and which both brands rightly share.
//
// Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-piggles-showcase.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/piggles-starter/**"
//   pnpm --filter @sparx/api-rest marketplace:self-register
//
// ── THE DEMO BUSINESS IS NEUTRAL, AND THAT IS THE POINT ─────────────────────
//
// sparx's showcase calls its demo business "sparx", and its own payload concedes
// the cost: "the installing tenant rebrands this to their own business; a missed
// spot ships 'sparx'". Two spots do — a home-page sentence and the site name —
// and they are why a Piggles customer could not be handed that bundle.
//
// Copying that trade-off with a different word would reproduce the bug, not fix
// it: a Piggles business finding a stray "Piggles" where its own name belongs is
// the same defect. So this bundle's demo business is an INVENTED one, the way
// all ~169 vertical templates do it, and the two known spots are rewritten to
// name no product at all. A missed spot then ships a plausible shop name rather
// than somebody else's brand.
//
// ── WHY THE THEME IS A TOKEN SUBSTITUTION, NOT A NEW SILICA THEME ───────────
//
// The golden's `site.theme` is a resolved, flat token bag that has been through
// the real pipeline. Authoring a fresh silica theme would mean inventing a
// four-step oklch surface ramp in light AND dark — and piggles' theme.css says
// in writing that its palette "was CHOSEN BY MEASUREMENT (WCAG contrast + a ΔE76
// separation screen). Re-measure before changing any of it; do not eyeball."
// So this takes the proven structure and substitutes ONLY the colour roles, with
// the values that file already measured. Nothing here is a new colour.

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = join(here, '..');
const goldenDir = join(catalog, 'blueprints', 'sparx');
const KEY = 'piggles-starter';
const outDir = join(catalog, 'blueprints', KEY);

// ── The invented demo business ──────────────────────────────────────────────
// One constant, deliberately: changing the demo business is a one-line edit and
// a regen. It names no real company and carries no product's brand.
const DEMO_BUSINESS = 'Rowan & Rye';
const DEMO_TAGLINE = 'Made well, sold simply, booked easily.';
/** The short form, for the six demo goods ("Rowan Enamel Mug") and their
 *  handles. "Rowan & Rye Enamel Mug" is nobody's product name. */
const DEMO_SHORT = 'Rowan';
const DEMO_SLUG = 'rowan';

// ── Piggles' measured palette (piggles/packages/brand/src/theme.css) ────────
// Copied as VALUES, not imported: this file is run by tsx from a directory with
// no node_modules, and a blueprint bundle must stay pure data besides. The
// source of truth is that stylesheet — re-copy from it, never re-pick by eye.
const LIGHT: Record<string, string> = {
  '--color-primary': '#ff6f86',
  '--color-secondary': '#2d3443',
  '--color-accent': '#ffb3c0',
  '--color-neutral': '#52454f',
  '--color-base-100': '#ffffff',
  '--color-base-200': '#fbf7f8',
  '--color-base-300': '#f0e8ea',
  '--color-base-content': '#202631',
  '--color-success': '#14804a',
  '--color-info': '#2563eb',
  '--color-warning': '#f3b61f',
  '--color-error': '#c93838',
  '--color-danger': '#c93838',
  // Piggles declares neither. `border` takes the warm 300-step it already uses
  // as its edge tone, and `highlight` takes the brand pink — the golden's
  // `#ec4899` is a different pink and would read as a second brand.
  '--color-border': '#f0e8ea',
  '--color-highlight': '#ff6f86',
};

const DARK: Record<string, string> = {
  '--color-primary': '#ff7c91',
  '--color-secondary': '#d7dbe3',
  '--color-accent': '#8f4656',
  '--color-neutral': '#c2b1bc',
  '--color-base-100': '#272d39',
  '--color-base-200': '#1c212c',
  '--color-base-300': '#151922',
  '--color-base-content': '#f4f5f7',
  '--color-error': '#ef4444',
  '--color-danger': '#ef4444',
  '--color-border': '#151922',
  '--color-highlight': '#ff7c91',
};

// Every place the golden names the platform, and what it becomes here.
//
// ORDER MATTERS: the whole-sentence rewrite runs before the bare-word one, so
// the sentence is replaced as a sentence rather than being left as itself with
// one word swapped. The last two are substring rules and must come last.
//
// This list covers MORE than the captured site, because the leak did. The golden
// ships six demo goods called "sparx Field Notebook" (handle
// `sparx-field-notebook`) in commerce.json — those install straight into the
// tenant's catalog, so a Piggles business would open its shop and find another
// company's products in it. The first pass here rewrote only the site and the
// guard only checked the site, which is exactly how it was nearly missed.
const REWRITES: [string, string][] = [
  [
    'sparx brings your site, your store, your content, and your customers together — so you can run the whole business from one place. This is a starter you can make entirely your own.',
    'Your site, your shop, your writing, and your customers — together, so you can run the whole business from one place. This is a starter you can make entirely your own.',
  ],
  // Handles + ids before display names: `sparx-everyday-tee` would otherwise be
  // half-rewritten by the bare-word rule into `Harlow-everyday-tee`.
  ['sparx-', `${DEMO_SLUG}-`],
  ['sparx ', `${DEMO_SHORT} `],
  ['sparx', DEMO_BUSINESS],
];

/** Rewrite every branded string in one authored part. Runs over the SERIALIZED
 *  tree: the parts are deep and heterogeneous, and a walk would have to know
 *  every node shape to find the strings a replace finds by construction. */
function debrand<T>(part: T): T {
  let raw = JSON.stringify(part);
  for (const [from, to] of REWRITES) raw = raw.split(from).join(to);
  return JSON.parse(raw) as T;
}

/** Throw if anything shipped still names the platform. The guard is the point of
 *  the whole file — a bundle that quietly carries the other brand's name looks
 *  completely normal until a customer reads it. */
function assertUnbranded(label: string, part: unknown): void {
  const hits = JSON.stringify(part).match(/sparx/gi);
  if (hits) {
    throw new Error(
      `gen-piggles-showcase: ${hits.length} unhandled "sparx" string(s) remain in ${label} — ` +
        'add a rule to REWRITES rather than shipping a bundle that names another brand.'
    );
  }
}

const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';

/** Substitute a colour bag over a resolved token bag, leaving every structural
 *  token (radius, spacing, type scale) exactly as the golden proved it. */
function reskin(bag: Record<string, string>, overrides: Record<string, string>) {
  const out: Record<string, string> = { ...bag };
  for (const [token, value] of Object.entries(overrides)) {
    // Only tokens the bag already HAS — a substitution that invents a key would
    // silently add a token the renderer never asked for, and nothing downstream
    // would report it.
    if (token in out) out[token] = value;
  }
  return out;
}

async function main(): Promise<void> {
  const mod = (await import(pathToFileURL(join(goldenDir, 'blueprint.ts')).href)) as {
    default: Record<string, unknown>;
  };
  const golden = mod.default;
  const emails = golden.emails as { name: string; publish: boolean; doc: unknown }[];

  await fs.mkdir(join(outDir, 'media'), { recursive: true });

  // The captured site, re-skinned and de-branded. String replacement over the
  // serialized tree rather than a walk: the tree is deep, heterogeneous, and the
  // two targets are exact full-string matches, so a targeted replace cannot hit
  // a node it was not meant to.
  type GoldenSite = {
    theme: { tokens: Record<string, string>; dark: Record<string, string>; [k: string]: unknown };
    [k: string]: unknown;
  };
  const site = debrand(golden.site as GoldenSite);
  site.theme = {
    ...site.theme,
    name: 'piggles',
    tokens: reskin(site.theme.tokens, LIGHT),
    dark: reskin(site.theme.dark, DARK),
  };

  const content = debrand(golden.content);
  const commerce = debrand(golden.commerce);
  const assetsPart = debrand(golden.assets);
  const sequences = debrand(golden.sequences);
  const emailDocs = emails.map((e) => debrand(e.doc));

  assertUnbranded('site', site);
  assertUnbranded('content', content);
  assertUnbranded('commerce', commerce);
  assertUnbranded('assets', assetsPart);
  assertUnbranded('sequences', sequences);
  emailDocs.forEach((doc, i) => assertUnbranded(`email ${i + 1}`, doc));

  const brand = {
    businessName: DEMO_BUSINESS,
    tagline: DEMO_TAGLINE,
    colors: {
      primary: LIGHT['--color-primary'],
      // WHITE, DELIBERATELY — matching `--color-primary-content` in
      // piggles/packages/brand/src/theme.css. That file's own comment argues for
      // the charcoal ink on a contrast measurement; the white was chosen ON
      // PURPOSE afterwards, by Brandon, because it reads better in practice, and
      // a ratio that wins on paper is worth nothing if the label is harder to
      // read on the screen.
      //
      // DO NOT "FIX" THIS, here or in theme.css. It is a settled decision, not an
      // oversight, and it is not a change this bundle is permitted to make — the
      // blueprint follows the brand, it does not correct it. It has already been
      // raised and answered; raising it again is the failure mode this note
      // exists to stop.
      primaryForeground: '#ffffff',
      accent: LIGHT['--color-accent'],
      secondary: LIGHT['--color-secondary'],
    },
    fonts: { heading: 'Nunito', body: 'Nunito' },
  };

  const theme = {
    name: 'piggles',
    basePresetKey: 'piggles',
    presentation: { v: 2, containerWidth: '1152px' },
    brand: {
      colorPrimary: brand.colors.primary,
      colorAccent: brand.colors.accent,
      colorSecondary: brand.colors.secondary,
      fontHeading: brand.fonts.heading,
      fontBody: brand.fonts.body,
      tokens: {},
    },
    apply: true,
  };

  const name = 'Universal Starter';
  const summary =
    'The complete starter — a faceted shop, a journal, a booking page, and a wholesale ' +
    'page. Install it, make it yours, and launch a polished working site in minutes.';

  await fs.writeFile(join(outDir, 'site.json'), json(site));
  await fs.writeFile(join(outDir, 'content.json'), json(content));
  await fs.writeFile(join(outDir, 'commerce.json'), json(commerce));
  await fs.writeFile(join(outDir, 'assets.json'), json(assetsPart));
  await fs.writeFile(join(outDir, 'welcome-email.json'), json(emailDocs[0]));
  await fs.writeFile(join(outDir, 'welcome-email-2.json'), json(emailDocs[1]));

  await fs.writeFile(
    join(outDir, 'blueprint.ts'),
    `// The Piggles showcase — a clone of the golden \`sparx\` bundle in the Piggles
// look, with an INVENTED demo business rather than the product's own name.
//
// GENERATED by marketplace-catalog/_gen/gen-piggles-showcase.ts — do NOT hand-edit;
// edit the generator and regenerate. A blueprint is PURE DATA: the loader \`import()\`s
// this module with no workspace resolution, so it imports ONLY sibling JSON.
import site from './site.json' with { type: 'json' };
import content from './content.json' with { type: 'json' };
import commerce from './commerce.json' with { type: 'json' };
import assets from './assets.json' with { type: 'json' };
import welcomeEmail from './welcome-email.json' with { type: 'json' };
import welcomeEmail2 from './welcome-email-2.json' with { type: 'json' };

const blueprint = {
  key: ${JSON.stringify(KEY)},
  version: '1.0.0',
  name: ${JSON.stringify(name)},
  summary: ${JSON.stringify(summary)},
  vertical: 'retail',
  preview: 'media/preview.png',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],

  brand: ${JSON.stringify(brand, null, 2)},

  theme: ${JSON.stringify(theme, null, 2)},

  assets,
  contentTypes: [],
  content,
  commerce,

  emails: [
    { name: ${JSON.stringify(emails[0]?.name)}, doc: welcomeEmail, publish: ${String(emails[0]?.publish)} },
    { name: ${JSON.stringify(emails[1]?.name)}, doc: welcomeEmail2, publish: ${String(emails[1]?.publish)} },
  ],

  sequences: ${JSON.stringify(sequences, null, 2)},

  site,
};

export default blueprint;
`
  );

  await fs.writeFile(
    join(outDir, 'sparx.json'),
    json({
      schemaVersion: 1,
      category: 'blueprint',
      slug: KEY,
      name,
      version: '1.0.0',
      tagline: 'A complete multi-module starter — shop, journal, bookings, and wholesale.',
      description: summary,
      payload: 'blueprint.ts',
      // The counterpart of the sparx showcase family's own restriction. Each
      // brand's reference site is its own; the ~169 vertical templates declare no
      // `brands` and stay shared, which is the default and must remain so.
      brands: ['piggles'],
      facets: { vertical: 'retail', industry: 'Universal' },
      pricing: { model: 'free', priceCents: 0 },
      requires: { modules: ['builder', 'commerce', 'cms', 'crm', 'email'] },
      media: [
        { file: 'media/icon.png', kind: 'icon', alt: `${name} icon` },
        { file: 'media/preview.png', kind: 'preview', alt: `${name} — home page preview` },
      ],
      author: { displayName: 'WizeWorks' },
      accent: LIGHT['--color-primary'],
      sortWeight: 100,
    })
  );

  for (const file of ['icon.png', 'preview.png']) {
    const dst = join(outDir, 'media', file);
    try {
      await fs.access(dst);
    } catch {
      await fs.copyFile(join(goldenDir, 'media', file), dst);
      console.log(`  ! ${file} copied from the sparx bundle — PLACEHOLDER, needs a Piggles shot`);
    }
  }

  // Oracle: the emitted payload has to satisfy the same schema the installer
  // parses it with. Re-imported from DISK rather than validated in memory, so
  // what is checked is the file that actually ships — a generator that writes
  // one thing and validates another is worse than no check at all.
  const emitted = (await import(
    `${pathToFileURL(join(outDir, 'blueprint.ts')).href}?t=${String(Date.now())}`
  )) as { default: unknown };
  const parsed = safeParseBlueprint(emitted.default);
  console.log(`safeParseBlueprint → ${parsed.success ? 'VALID' : 'INVALID'}`);
  if (!parsed.success) {
    console.error(JSON.stringify(parsed.error.issues.slice(0, 8), null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(`gen-piggles-showcase: wrote ${KEY}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
