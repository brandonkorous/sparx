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
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-piggles-showcase.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/piggles-starter/**"
//   pnpm --filter @wizeworks/api-rest marketplace:self-register
//
// ── THE DEMO BUSINESS IS NEUTRAL, AND THAT IS THE POINT ─────────────────────
//
// The golden's showcase USED to call its demo business "sparx" and prefix all six
// of its demo goods with it, and its own payload conceded the cost: "a missed spot
// ships 'sparx'". Several spots did — a home-page sentence, the site name, and six
// products that installed straight into a tenant's own catalog and published shop.
// That is fixed at the source: the golden's demo business is now an invented
// 'Alder & Ash' and its goods carry no company name at all.
//
// This bundle keeps its own invented demo business anyway, and that is deliberate.
// Copying the platform's name with a different word would reproduce the original
// bug, not fix it: a Piggles business finding a stray "Piggles" where its own name
// belongs is the same defect. So the demo business here is INVENTED, the way all
// ~169 vertical templates do it, and a missed spot ships a plausible shop name
// rather than somebody else's brand.
//
// ── WHY THE THEME IS A TOKEN SUBSTITUTION, NOT A NEW SILICA THEME ───────────
//
// The golden's `site.theme` is a resolved, flat token bag that has been through
// the real pipeline. Authoring a fresh silica theme would mean inventing a
// four-step oklch surface ramp in light AND dark, and the Piggles palette is not
// this file's to invent. So this takes the proven structure and substitutes ONLY
// the color roles, with the values from `@piggles/brand`. Nothing here is a new
// color.

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';
import { upgradeFrameChrome } from '../../wizeworks/packages/silica-catalog/src/upgrade-frame';

/** The golden bundle's frame, run through the platform's own upgrade-on-read before it is
 *  cloned.
 *
 *  The site half of `sparx` is CAPTURED from the live Template property, so its header and
 *  footer are as old as the last capture — and the capture predates both the live account
 *  core and the live legal-links core. Every clone inherited that, which is how twenty one
 *  designs came to ship a stamped "Sign in" that tells a signed-in customer they are a
 *  stranger and offers them no route to the account holding their orders (issues 291, 313).
 *
 *  `upgradeFrameChrome` is exactly the repair the platform already applies to a stale stored
 *  frame the first time its owner opens the studio. Applying it HERE means an installing
 *  tenant gets the current chrome on day one instead of on their first visit to the builder,
 *  which many never make. It is a no-op on a frame that is already current, so re-running
 *  this generator after a fresh capture changes nothing.
 *
 *  The golden `sparx` bundle ITSELF is not written by any generator — it is the capture — so
 *  it stays behind until the Template property is opened in the studio (which heals its
 *  draft) and re-captured. That is the one bundle the chrome guard excepts, by name. */
function healedSite(site: Record<string, unknown>): Record<string, unknown> {
    const frame = site.frame as { root: unknown } | null | undefined;
    if (!frame?.root) return site;
    const healed = upgradeFrameChrome(frame.root as Parameters<typeof upgradeFrameChrome>[0]);
    return healed.changed ? { ...site, frame: { ...frame, root: healed.root } } : site;
}

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

// The golden's neutral demo identity, and what it becomes here.
//
// WHAT CHANGED, AND WHY THIS LIST IS SHORTER THAN IT WAS. The golden used to name
// the platform in its page copy, its `brand.businessName`, and all six of its demo
// goods ("sparx Field Notebook", handle `sparx-field-notebook`) — so this file's
// job was to STRIP a brand, and its guard looked for the word "sparx". The golden
// no longer names the platform anywhere: its demo business is an invented
// 'Alder & Ash', its goods are unprefixed, and its vendor is the same 'House Goods'
// the platform's own generic sample pack uses. Nothing to strip.
//
// So the job is now the opposite one — REBRANDING neutral content into this
// bundle's own invented demo business, which is what makes `piggles-starter`
// recognisably its own shop rather than a second copy of the golden. The guard
// below moved with it: it looks for the GOLDEN's demo identity leaking through,
// because that is the string that would now be wrong here.
//
// ORDER MATTERS: the whole-sentence rewrite runs first so the sentence is replaced
// as a sentence, and handles run before display names so `field-notebook` is not
// half-rewritten by the title rule.

/** The six demo goods the golden ships, unprefixed. Each gets this bundle's own
 *  short name, because "Enamel Mug" with no shop behind it is nobody's product and
 *  "Rowan & Rye Enamel Mug" is nobody's product name either. */
const DEMO_GOODS: [handle: string, title: string][] = [
    ['field-notebook', 'Field Notebook'],
    ['everyday-tee', 'Everyday Tee'],
    ['enamel-mug', 'Enamel Mug'],
    ['canvas-tote', 'Canvas Tote'],
    ['ripstop-cap', 'Ripstop Cap'],
    ['insulated-bottle', 'Insulated Bottle'],
];

/** The golden's own demo identity. Named here so the guard can assert it never
 *  reaches this bundle — the failure this whole file exists to prevent, restated
 *  for content that is neutral rather than branded. */
const GOLDEN_BUSINESS = 'Alder & Ash';
const GOLDEN_VENDOR = 'House Goods';

const REWRITES: [string, string][] = [
    [
        'Your site, your store, your content, and your customers, all together, so you can run the whole business from one place. This is a starter you can make entirely your own.',
        'Your site, your shop, your writing, and your customers — together, so you can run the whole business from one place. This is a starter you can make entirely your own.',
    ],
    // Handles before display names, and both before the identity rules.
    ...DEMO_GOODS.map(([handle]): [string, string] => [handle, `${DEMO_SLUG}-${handle}`]),
    ...DEMO_GOODS.map(([, title]): [string, string] => [title, `${DEMO_SHORT} ${title}`]),
    [GOLDEN_VENDOR, DEMO_BUSINESS],
    [GOLDEN_BUSINESS, DEMO_BUSINESS],
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
    const raw = JSON.stringify(part);
    // "sparx" stays in the list even though the golden no longer writes it: this
    // guard's whole value is catching a REGRESSION upstream, and the day somebody
    // reintroduces the platform's name to the golden is the day it has to fire.
    // The other two are the live risk — the golden's own invented demo identity,
    // which is correct there and wrong in every byte of this bundle.
    for (const needle of ['sparx', GOLDEN_BUSINESS, GOLDEN_VENDOR]) {
        const hits = raw.match(new RegExp(needle.replace(/[&]/g, '\&'), 'gi'));
        if (hits) {
            throw new Error(
                `gen-piggles-showcase: ${hits.length} unhandled "${needle}" string(s) remain in ` +
                `${label} — add a rule to REWRITES rather than shipping a bundle that names ` +
                'another business.'
            );
        }
    }
}

const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';

/** Substitute a color bag over a resolved token bag, leaving every structural
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
        theme: { tokens: Record<string, string>; dark: Record<string, string>;[k: string]: unknown };
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

    await fs.writeFile(join(outDir, 'site.json'), json(healedSite(site)));
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
  version: '1.3.0',
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
            version: '1.3.0',
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
