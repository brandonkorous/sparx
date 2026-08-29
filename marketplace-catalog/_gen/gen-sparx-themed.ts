// Generator: the 20 THEMED CLONES of the golden `sparx` blueprint — one per sparx
// silica theme (`SPARX_THEMES`, wizeworks/packages/silica-catalog). Each clone is the SAME
// complete multi-module starter (shop · journal · booking · wholesale, the 6 neutral
// demo goods, the 3 journal posts, the 2-touch welcome series) re-dressed in one theme's
// look. Together with the flagship `sparx` (Ember) bundle that is 21 blueprints.
//
// Run (docs marketplace-catalog/CLAUDE.md — generator is the source of truth):
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-themed.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-*/**" "marketplace-catalog/_gen/gen-sparx-themed.ts"
//   pnpm --filter @wizeworks/api-rest marketplace:self-register
//
// WHY RELATIVE IMPORTS. This file legitimately reads the theme catalog + the color
// util (workspace packages), but it lives under marketplace-catalog/ which has no
// node_modules — so a bare `@sparx/*` specifier can't resolve from here. Importing
// each package's `src` by relative path lets tsx compile it in place; each package's
// OWN deps still resolve from the package's own location. (The EMITTED blueprint.ts
// is the opposite discipline — pure data, sibling JSON only, never `@sparx/*`.)

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SPARX_THEMES } from '../../wizeworks/packages/silica-catalog/src/themes';
import { upgradeFrameChrome } from '../../wizeworks/packages/silica-catalog/src/upgrade-frame';
import { resolveSparxTheme } from '../../wizeworks/packages/silica-catalog/src/resolve-sparx-theme';
import { colorToHex } from '../../wizeworks/packages/site-themes/src/v2/color';
import type { Theme } from '@wizeworks/silicaui-html';

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
const catalog = join(here, '..'); // marketplace-catalog/
const goldenDir = join(catalog, 'blueprints', 'sparx');
const blueprintsDir = join(catalog, 'blueprints');

// ── Per-theme marketing framing ─────────────────────────────────────────────────
// The theme's own `name` is the recognizable label; `audience` mirrors the trade the
// theme was tuned for (see each theme's comment in silica-catalog/themes.ts), and
// `vertical` picks the card's badge (Shop / Publication / Services). Kept honest to
// the theme's stated intent rather than invented.
type Vertical = 'retail' | 'content' | 'services';
interface Desc {
    audience: string;
    vertical: Vertical;
}
const DESC: Record<string, Desc> = {
    boutique: { audience: 'small fashion retail', vertical: 'retail' },
    kitchen: { audience: 'restaurants, cafés, and bakeries', vertical: 'retail' },
    cellar: { audience: 'wine, beer, spirits, and bars', vertical: 'retail' },
    petal: { audience: 'florists, weddings, and events', vertical: 'retail' },
    lodge: { audience: 'hotels, cabins, and short-stay rentals', vertical: 'services' },
    workshop: { audience: 'fabrication, joinery, and general trade', vertical: 'services' },
    garage: { audience: 'vehicle service, repair, and parts', vertical: 'services' },
    field: { audience: 'farming, landscaping, and outdoor contracting', vertical: 'services' },
    harbor: { audience: 'freight, haulage, and plant hire', vertical: 'services' },
    hearth: { audience: 'home services, interiors, and furnishings', vertical: 'services' },
    clinic: { audience: 'medical, dental, and wellness practices', vertical: 'services' },
    salon: { audience: 'hair, beauty, nails, and spa', vertical: 'services' },
    ledger: { audience: 'accountancy, law, and financial advice', vertical: 'services' },
    summit: { audience: 'consulting and B2B agencies', vertical: 'services' },
    academy: { audience: 'schools, tutoring, and training providers', vertical: 'services' },
    studio: { audience: 'design, photography, and creative studios', vertical: 'services' },
    gallery: { audience: 'artists, makers, and portfolios', vertical: 'content' },
    press: { audience: 'publishers, newsletters, and blogs', vertical: 'content' },
    stage: { audience: 'music, theatre, and ticketed events', vertical: 'services' },
    signal: { audience: 'software, apps, and subscriptions', vertical: 'services' },
};

const title = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

/** colorToHex, but fail-fast: a theme role that won't resolve to hex is a generator
 *  bug worth stopping on, not a silent `#000000`. */
function hex(value: string | undefined, ctx: string): string {
    const out = colorToHex(value ?? null);
    if (!out) throw new Error(`gen-sparx-themed: ${ctx} did not resolve to hex (got ${value})`);
    return out;
}

/** The `businessName`/`fonts` families a theme states (falling back to silica's own
 *  default face names when a theme declares no type). */
function faces(theme: Theme): { heading: string; body: string } {
    const body = theme.fonts?.sans?.family ?? 'Inter';
    const heading = theme.fonts?.head?.family ?? body;
    return { heading, body };
}

/** The shared parts of the golden bundle, read once and cloned into every theme. */
interface Golden {
    brandBusinessName: string;
    brandTagline: string;
    assets: unknown;
    commerce: unknown;
    content: unknown;
    sequences: unknown;
    emails: { name: string; publish: boolean }[];
    emailDocs: unknown[];
    site: Record<string, unknown>;
}

async function loadGolden(): Promise<Golden> {
    const mod = (await import(pathToFileURL(join(goldenDir, 'blueprint.ts')).href)) as {
        default: Record<string, unknown>;
    };
    const bp = mod.default;
    const emails = bp.emails as { name: string; publish: boolean; doc: unknown }[];
    if (emails.length !== 2) {
        throw new Error(`gen-sparx-themed: expected golden to ship 2 emails, found ${emails.length}`);
    }
    const brand = bp.brand as { businessName?: string; tagline?: string };
    // READ, never hardcoded. This is the demo business the whole family is authored
    // around, and the installer writes it straight into the property's brand_override,
    // where invoice + packing-slip rendering print it as the SELLER NAME. A literal here
    // is how 21 bundles came to seed a tenant's own catalog and invoices with the
    // platform's name (piggles/docs/personas/issues/091, /165). Taking it from the golden
    // means one edit there moves all 21.
    if (!brand.businessName) {
        throw new Error('gen-sparx-themed: golden declares no brand.businessName');
    }
    return {
        brandBusinessName: brand.businessName,
        brandTagline: brand.tagline ?? 'Everything you sell, publish, and book — in one place.',
        assets: bp.assets,
        commerce: bp.commerce,
        content: bp.content,
        sequences: bp.sequences,
        emails: emails.map((e) => ({ name: e.name, publish: e.publish })),
        emailDocs: emails.map((e) => e.doc),
        site: bp.site as Record<string, unknown>,
    };
}

const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';

/** The emitted, pure-data blueprint.ts (sibling-JSON imports only — never `@sparx/*`,
 *  the loader resolves this module with no workspace resolution). Prettier reformats
 *  the inlined literals after generation, so this only has to be valid TS. */
function blueprintTs(opts: {
    key: string;
    name: string;
    summary: string;
    vertical: Vertical;
    requiresModules: string[];
    brand: unknown;
    theme: unknown;
    emails: { name: string; publish: boolean }[];
    sequences: unknown;
}): string {
    const emailVars = ['welcomeEmail', 'welcomeEmail2'];
    const emailsLiteral = opts.emails
        .map(
            (e, i) =>
                `{ name: ${JSON.stringify(e.name)}, doc: ${emailVars[i]}, publish: ${String(e.publish)} }`
        )
        .join(',\n    ');
    return `// ${title(opts.key.replace(/^sparx-/, ''))}: a THEMED CLONE of the golden \`sparx\`
// blueprint, re-dressed in the '${opts.key.replace(/^sparx-/, '')}' silica theme. Same
// complete multi-module starter (shop · journal · booking · wholesale), captured once
// and re-themed — content, commerce, and emails are identical to the flagship; only the
// look (site.theme + brand + theme) differs.
//
// GENERATED by marketplace-catalog/_gen/gen-sparx-themed.ts — do NOT hand-edit; edit the
// generator and regenerate. A blueprint is PURE DATA: the loader \`import()\`s this module
// with no workspace resolution, so it imports ONLY sibling JSON, never \`@sparx/*\`.
import site from './site.json' with { type: 'json' };
import content from './content.json' with { type: 'json' };
import commerce from './commerce.json' with { type: 'json' };
import assets from './assets.json' with { type: 'json' };
import welcomeEmail from './welcome-email.json' with { type: 'json' };
import welcomeEmail2 from './welcome-email-2.json' with { type: 'json' };

const blueprint = {
  key: ${JSON.stringify(opts.key)},
  version: '1.5.0',
  name: ${JSON.stringify(opts.name)},
  summary: ${JSON.stringify(opts.summary)},
  vertical: ${JSON.stringify(opts.vertical)},
  preview: 'media/preview.png',
  requiresModules: ${JSON.stringify(opts.requiresModules)},

  // Identity only (business name + fonts + the theme's hex colors). The look itself
  // rides site.theme (below) + this theme; the installing tenant rebrands the name.
  brand: ${JSON.stringify(opts.brand, null, 2)},

  // The provisioned SiteTheme the installer creates + applies — the '${opts.key.replace(/^sparx-/, '')}'
  // look as a tenant-editable saved theme (base preset apex + this theme's brand look).
  theme: ${JSON.stringify(opts.theme, null, 2)},

  assets,
  contentTypes: [],
  content,
  commerce,

  emails: [
    ${emailsLiteral},
  ],

  sequences: ${JSON.stringify(opts.sequences, null, 2)},

  // The captured site (frame + 7 pages + symbols) verbatim from the golden template,
  // with site.theme swapped to this theme's resolved token bag (light + dark).
  site,
};

export default blueprint;
`;
}

function manifestJson(opts: {
    key: string;
    name: string;
    summary: string;
    tagline: string;
    vertical: Vertical;
    industry: string;
    accent: string;
    sortWeight: number;
}): unknown {
    return {
        schemaVersion: 1,
        category: 'blueprint',
        slug: opts.key,
        name: opts.name,
        version: '1.5.0',
        tagline: opts.tagline,
        description: opts.summary,
        payload: 'blueprint.ts',
        facets: {
            vertical: opts.vertical,
            industry: opts.industry,
        },
        pricing: { model: 'free', priceCents: 0 },
        // requires.modules mirrors the payload's requiresModules (a validation-consistency
        // list, not an install gate). Deliberately NOT mirrored into facets.requiredModules:
        // the template's content is independent of a tenant's active modules, so the card
        // advertises no module requirement to gate on.
        requires: { modules: ['builder', 'commerce', 'cms', 'crm', 'email'] },
        media: [
            { file: 'media/icon.png', kind: 'icon', alt: `${opts.name} icon` },
            { file: 'media/preview.png', kind: 'preview', alt: `${opts.name} — home page preview` },
        ],
        author: { displayName: 'WizeWorks' },
        // Restricted to sparx as a DELIBERATE SCOPING CHOICE, and no longer because of
        // anything in the content. This family used to name the platform in its page copy
        // and its `brand.businessName`, which is what the restriction originally described
        // and protected against; that naming is gone — the bundles now carry the same
        // invented demo business as the other 169, so nothing here would leak a brand if
        // it crossed. What remains is a product decision about which marketplace shows the
        // 21 theme looks, and it stays as-is until somebody decides otherwise.
        //
        // The other ~169 bundles carry no `brands` and are shared by every brand, which is
        // the default and should stay the default: a template that must name its brands to
        // be seen forks the catalog the first time someone forgets.
        brands: ['sparx'],
        accent: opts.accent,
        sortWeight: opts.sortWeight,
    };
}

/** Copy a media file from golden into a clone ONLY if the clone doesn't already have
 *  one — media is hand-maintained + survives regen (CLAUDE.md), so a themed preview.png
 *  added later (Phase 6) is never clobbered by a re-run. */
async function copyMediaIfAbsent(dstMediaDir: string, file: string): Promise<void> {
    const dst = join(dstMediaDir, file);
    try {
        await fs.access(dst);
        return; // already present — leave it
    } catch {
        /* absent — copy the golden placeholder */
    }
    await fs.copyFile(join(goldenDir, 'media', file), dst);
}

async function main(): Promise<void> {
    const golden = await loadGolden();

    let index = 0;
    for (const theme of SPARX_THEMES) {
        const desc = DESC[theme.name];
        if (!desc) throw new Error(`gen-sparx-themed: no descriptor for theme '${theme.name}'`);

        const key = `sparx-${theme.name}`;
        const t = title(theme.name);
        const dir = join(blueprintsDir, key);
        const mediaDir = join(dir, 'media');
        await fs.mkdir(mediaDir, { recursive: true });

        // The ship-ready flat token bag for this theme (light in tokens, color delta in
        // dark), matching the golden site.theme shape — this is the single source of the
        // look for both storefront and email.
        const resolved = resolveSparxTheme(theme);
        const light = resolved.tokens;
        const { heading, body } = faces(theme);

        const primary = hex(light['--color-primary'], `${key} primary`);
        const primaryForeground = hex(light['--color-primary-content'], `${key} primary-content`);
        const accent = hex(light['--color-accent'], `${key} accent`);
        const secondary = hex(light['--color-secondary'], `${key} secondary`);

        // The theme's own name, with NO brand prefix. Every row in this family carried
        // one, and a word that appears on all 190 cards cannot be the thing that tells
        // them apart — it is noise in the one place the name has to do work. It is also
        // the product's name on another brand's marketplace, which is the leak
        // `brands` (below) exists to stop; dropping it here means the label is right
        // even where the gate is not the thing being tested.
        const name = t;
        const summary =
            `The complete starter — a faceted shop, a journal, a booking page, and a ` +
            `wholesale page — in the ${t} look, tuned for ${desc.audience}. Install it, make it ` +
            `yours, and launch a polished working site in minutes.`;
        const tagline = `A complete multi-module starter in the ${t} look — for ${desc.audience}.`;

        const brand = {
            businessName: golden.brandBusinessName,
            tagline: golden.brandTagline,
            colors: { primary, primaryForeground, accent, secondary },
            fonts: { heading, body },
        };

        const themeDecl = {
            name: theme.name,
            // The base is the theme ITSELF — a saved theme carries a presentation overlay
            // and a brand snapshot, never a palette, so the base is where the colors come
            // from. This said `'apex'`, one of six legacy presets: every one of these
            // blueprints installed a saved theme whose base was the same generic indigo,
            // with only the brand identity slots distinguishing them.
            basePresetKey: theme.name,
            presentation: { v: 2, containerWidth: '1152px' },
            brand: {
                colorPrimary: primary,
                colorAccent: accent,
                colorSecondary: secondary,
                fontHeading: heading,
                fontBody: body,
                tokens: {},
            },
            apply: true,
        };

        // site.json = golden site with this theme's resolved token bag, and the chrome
        // brought up to date — see `healedSite`.
        const site = healedSite({ ...golden.site, theme: resolved });

        await fs.writeFile(join(dir, 'site.json'), json(site));
        await fs.writeFile(join(dir, 'content.json'), json(golden.content));
        await fs.writeFile(join(dir, 'commerce.json'), json(golden.commerce));
        await fs.writeFile(join(dir, 'assets.json'), json(golden.assets));
        await fs.writeFile(join(dir, 'welcome-email.json'), json(golden.emailDocs[0]));
        await fs.writeFile(join(dir, 'welcome-email-2.json'), json(golden.emailDocs[1]));

        await fs.writeFile(
            join(dir, 'blueprint.ts'),
            blueprintTs({
                key,
                name,
                summary,
                vertical: desc.vertical,
                requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
                brand,
                theme: themeDecl,
                emails: golden.emails,
                sequences: golden.sequences,
            })
        );

        await fs.writeFile(
            join(dir, 'sparx.json'),
            json(
                manifestJson({
                    key,
                    name,
                    summary,
                    tagline,
                    vertical: desc.vertical,
                    industry: t,
                    accent: primary,
                    sortWeight: 90 - index,
                })
            )
        );

        await copyMediaIfAbsent(mediaDir, 'icon.png');
        await copyMediaIfAbsent(mediaDir, 'preview.png');

        index += 1;
        console.log(`  · ${key.padEnd(18)} ${name}`);
    }

    console.log(`gen-sparx-themed: wrote ${index} themed clone bundles under blueprints/`);
}

main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
