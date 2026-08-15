// Shared PREVIEW machinery for the reference-driven site templates — the review aid
// (NOT the shipped payload). Every `gen-template-<slug>.ts` calls `writeTemplatePreview`
// to drop a self-contained home-page HTML into the scratch dir so the template can be
// eyeballed in a plain browser exactly as the storefront renders it. Extracted from the
// first template's generator so the other nine don't each duplicate ~250 lines of
// Tailwind-compile + host-stub plumbing (and so their preview temp paths are keyed by
// slug and can't collide when several generators run at once).
//
// WHY RELATIVE IMPORTS — see harness.ts (marketplace-catalog has no node_modules). The
// silica node primitives come through silica-catalog's own copy so the nodes this file
// touches are the SAME module instance as the ones the harness/catalog mint.

import { execFileSync } from 'node:child_process';
import { promises as fs, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  el,
  type Node,
  type Theme,
} from '../../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

import { renderSilicaBody } from '../../../packages/silica-catalog/src/render';
import {
  createSilicaResolver,
  defaultSilicaFormat,
} from '../../../packages/builder-schemas/src/silica-resolve';
import { buildSilicaThemeCssFromTheme } from '../../../packages/site-themes/src/v2/silica-css';
// Typed attributes (docs/143): derive the SAME `attributeSections` the live PDP renders,
// so the preview + screenshot show a product's real detail blocks — not the DB, but the
// exact projection. Both imports are runtime-safe (their only internal imports are
// type-only), so the no-node_modules preview harness resolves them from source.
import { BUILT_IN_PRODUCT_TYPES } from '../../../packages/commerce-schemas/src/product-types/builtins/index';
import { projectProductAttributes } from '../../../packages/commerce/src/services/attribute-projection';

import { composeTemplateSite, faces, type TemplateSiteSpec } from './harness';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

/** The STANDARD preview output dir — a stable, repo-relative location (gitignored) every
 *  template's preview HTML + screenshot lands in, so the flow is identical for template #1 and
 *  template #100. Not a per-session scratchpad path (that was baked into each generator and
 *  did not travel). `screenshot-template.mjs` reads `preview-<slug>.html` from here. */
export const PREVIEW_DIR = join(here, '..', '.preview');

// ── The minimal shapes the sample host reads off a spec ──────────────────────────
// A spec's `commerce`/`content`/`assets` are typed `unknown` on the harness contract (the
// loader validates the emitted JSON, not these), so the preview narrows them to just the
// fields it needs to fabricate a resolver host. A field the shape below doesn't name is
// simply ignored — the preview never has to match the full CommerceDecl.

interface PvVariant {
  sku: string;
  priceCents: number;
  isDefault?: boolean;
}
interface PvImage {
  assetId: string;
  isPrimary?: boolean;
}
interface PvProduct {
  handle: string;
  title: string;
  description: string;
  categoryHandles?: string[];
  productTypeKey?: string;
  attributes?: Record<string, unknown>;
  variants: PvVariant[];
  images: PvImage[];
}

// Resolve a product type's attribute schema from the built-in set (the templates use
// built-in keys). A custom key the preview doesn't know simply projects to no sections.
const SCHEMA_BY_KEY = new Map(BUILT_IN_PRODUCT_TYPES.map((t) => [t.key, t.attributeSchema]));
interface PvCollection {
  handle: string;
  featured?: boolean;
  productHandles: string[];
}
interface PvCommerce {
  categories?: { handle: string; featured?: boolean }[];
  collections?: PvCollection[];
  products: PvProduct[];
}
interface PvAsset {
  id: string;
  url: string;
  alt: string;
}
interface PvContentEntry {
  typeKey: string;
  slug: string;
  body: { title: string; excerpt?: string; featuredImage?: { $asset?: string } };
}

/**
 * Build the fixed sample-data host so the home page's bound product carousels + journal
 * strips resolve to the bundle's OWN example records (mirrors apps/web's component-preview
 * host). Everything is derived generically from the spec's commerce/content/assets:
 *  · `commerce.product`            — every product
 *  · `commerce.featured` / `.new`  — the products of the featured collection (or the first)
 *  · `commerce.collection.<h>`     — each collection's products, by handle
 *  · `commerce.category.<h>`       — a collection with that handle if one exists, else the
 *                                    products whose `categoryHandles` include it
 *  · `cms.<typeKey>`               — the content entries of each type
 */
/**
 * What the sample host actually needs — a structural subset, so the SHOWCASE
 * bundles (a captured site, not a spec) can use the same host. `TemplateSiteSpec`
 * satisfies this by construction; nothing about the host was ever spec-specific.
 */
export interface PreviewSource {
  slug: string;
  commerce: unknown;
  assets: unknown;
  content: unknown;
  /** The demo business the bound `site.identity.name` resolves to. */
  brand: { businessName: string };
}

export function buildSampleHost(spec: PreviewSource) {
  const commerce = spec.commerce as PvCommerce;
  const assets = spec.assets as PvAsset[];
  const content = spec.content as PvContentEntry[];

  const assetUrl = (id: string): string => {
    const a = assets.find((x) => x.id === id);
    if (!a) throw new Error(`preview(${spec.slug}): unknown asset "${id}"`);
    return a.url;
  };

  const productOf = (p: PvProduct) => {
    const def = p.variants.find((v) => v.isDefault) ?? p.variants[0]!;
    const primary = p.images.find((i) => i.isPrimary) ?? p.images[0]!;
    // Project the product's typed attribute bag into the two shapes the PDP binds —
    // exactly as api-rest's mapFullProduct does live — so the preview shows real
    // fabric/care/spec sections instead of an empty attribute block.
    const schema = p.productTypeKey ? SCHEMA_BY_KEY.get(p.productTypeKey) : undefined;
    const projection = schema
      ? projectProductAttributes(schema, (p.attributes ?? {}) as Record<string, unknown>)
      : { attributes: {}, attributeSections: [] };
    return {
      id: p.handle,
      handle: p.handle,
      title: p.title,
      price: def.priceCents / 100,
      compareAtPrice: null,
      description: p.description,
      image: { url: assetUrl(primary.assetId), alt: primary.title ?? p.title },
      variantId: def.sku,
      url: `/products/${p.handle}`,
      attributes: projection.attributes,
      attributeSections: projection.attributeSections,
      // Show the low-stock badge on the first sample product so the preview exercises it.
      inStock: true,
      lowStock: p.handle === commerce.products[0]?.handle,
    };
  };

  const products = commerce.products.map(productOf);
  const byHandle = (h: string) => products.find((p) => p.handle === h);
  const collections = commerce.collections ?? [];
  const productsOfCollection = (handle: string) =>
    (collections.find((c) => c.handle === handle)?.productHandles ?? [])
      .map(byHandle)
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const productsOfCategory = (handle: string) =>
    commerce.products
      .filter((p) => (p.categoryHandles ?? []).includes(handle))
      .map((p) => byHandle(p.handle))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

  // `commerce.category.<h>` and `commerce.collection.<h>` maps covering every handle the
  // home beats might bind to — a collection by that handle wins, else the raw category set.
  const categoryMap: Record<string, unknown[]> = {};
  const collectionMap: Record<string, unknown[]> = {};
  for (const c of collections) collectionMap[c.handle] = productsOfCollection(c.handle);
  const handles = new Set<string>([
    ...(commerce.categories ?? []).map((c) => c.handle),
    ...collections.map((c) => c.handle),
  ]);
  for (const h of handles) {
    const coll = collections.find((c) => c.handle === h);
    categoryMap[h] = coll ? productsOfCollection(h) : productsOfCategory(h);
  }

  const featured = collections.find((c) => c.featured) ?? collections[0];
  const featuredProducts = featured ? productsOfCollection(featured.handle) : products.slice(0, 6);

  // Group content entries by typeKey → `cms.<typeKey>` list.
  const cms: Record<string, unknown[]> = {};
  for (const e of content) {
    (cms[e.typeKey] ??= []).push({
      title: e.body.title,
      excerpt: e.body.excerpt ?? '',
      date: 'March 2026',
      featuredImage: e.body.featuredImage?.$asset
        ? { url: assetUrl(e.body.featuredImage.$asset), alt: e.body.title }
        : null,
      slug: e.slug,
      url: `/journal/${e.slug}`,
    });
  }

  const root: Record<string, unknown> = {
    site: { identity: { name: spec.brand.businessName } },
    commerce: {
      product: products,
      featured: featuredProducts,
      new: featuredProducts,
      related: products.slice(0, 5),
      category: categoryMap,
      collection: collectionMap,
    },
    cms,
    product: products[0],
    image: products[0] ? { url: products[0].image.url, alt: products[0].title } : null,
    featuredImage: products[0] ? { url: products[0].image.url, alt: products[0].title } : null,
  };
  return createSilicaResolver({ root, format: defaultSilicaFormat });
}

// ── Tailwind compile (the exact utility/component CSS the markup needs) ───────────

function runTailwind(
  cli: string,
  inputPath: string,
  inputCss: string,
  bodyPath: string,
  bodyHtml: string,
  outPath: string
): string {
  writeFileSync(bodyPath, bodyHtml, 'utf8');
  writeFileSync(inputPath, inputCss, 'utf8');
  try {
    execFileSync('node', [cli, '-i', inputPath, '-o', outPath], { cwd: repoRoot, stdio: 'pipe' });
    return readFileSync(outPath, 'utf8');
  } finally {
    rmSync(inputPath, { force: true });
  }
}

/** Compile the Tailwind + silicaui CSS the rendered home markup needs, self-contained.
 *  Runs the workspace's own Tailwind v4 compiler over a temp input that scans the rendered
 *  HTML + the catalog sources. All temp paths are keyed by `slug` so parallel generators
 *  can't collide.
 *
 *  The compile runs in `tailwind-compile.mjs` (a child process, so this stays synchronous)
 *  rather than `@tailwindcss/cli` — that package left the workspace with `packages/site-ui`
 *  and took every template's preview step with it. See that file's header. */
function compilePreviewCss(slug: string, bodyHtml: string, scratchDir: string): string {
  const bodyPath = join(scratchDir, `preview-${slug}.body.html`);
  const inputPath = join(repoRoot, 'apps', 'site', `_preview-${slug}.css`);
  const outPath = join(scratchDir, `preview-${slug}.util.css`);
  const cli = join(here, 'tailwind-compile.mjs');
  const input = `@import 'tailwindcss';
@plugin '@wizeworks/silicaui' {
  colors: primary, secondary, accent, neutral, info, success, warning, error, danger, highlight;
}
@import '../../packages/silica-catalog/src/builder-vocabulary.css';
@source '${bodyPath.replace(/\\/g, '/')}';
@source '../../packages/silica-catalog/src/**/*.{ts,tsx}';
`;
  return runTailwind(cli, inputPath, input, bodyPath, bodyHtml, outPath);
}

function fontsHref(heading: string, body: string): string {
  const fam = (f: string) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`;
  const uniq = [heading, body].filter((v, i, a) => a.indexOf(v) === i);
  return `https://fonts.googleapis.com/css2?${uniq.map(fam).join('&')}&display=swap`;
}

/** Swap the frame's LIVE host cores (a static `toHtml` renders them as their key text,
 *  e.g. "site.brand") for static stand-ins, so the preview chrome reads like the real
 *  storefront. Preview-only — the shipped frame keeps its host cores. */
function staticizeHostNodes(node: unknown, brandName: string): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
  const n = node as { kind?: string; component?: string; children?: unknown[] };
  if (n.kind === 'host') {
    if (n.component === 'site.brand') {
      return el('a', 'flex items-center text-lg font-semibold tracking-tight text-base-content', {
        attrs: { href: '/' },
        text: brandName,
      });
    }
    return null; // theme toggle + legal links have nothing to render without the live host
  }
  if (Array.isArray(n.children)) {
    n.children = n.children
      .map((c) => staticizeHostNodes(c, brandName))
      .filter((c) => c !== null);
  }
  return node;
}

/** Replace a page body's LIVE functional cores (the faceted PLP, cart, search, collections
 *  grid — server-computed host nodes that a static `toHtml` renders as an empty mount) with a
 *  labeled dashed placeholder, so the review preview reads "the shoppable grid renders here on
 *  the storefront" instead of a blank gap. The bespoke masthead/framing a template authors
 *  ABOVE the core renders normally — that is the part under review. Preview-only. */
function placeholderizeCores(node: unknown): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
  const n = node as { kind?: string; component?: string; children?: unknown[] };
  if (n.kind === 'host') {
    const key = n.component ?? 'core';
    return el(
      'div',
      'mx-auto my-8 w-full max-w-5xl rounded-box border border-dashed border-base-300 bg-base-200 px-6 py-16 text-center text-base-content',
      { text: `▦ live "${key}" renders here on the storefront (faceted, shoppable)` }
    );
  }
  if (Array.isArray(n.children)) {
    n.children = n.children.map((c) => placeholderizeCores(c));
  }
  return node;
}

export interface WriteTemplatePreviewResult {
  path: string;
}

/**
 * Render ALL of ONE template's pages to a single self-contained HTML file in `scratchDir`,
 * in the exact bespoke theme the bundle ships — the branded chrome once at the top, then
 * every page body (Home, Shop, Collections, Cart, Search, Journal, About, Contact, Product)
 * stacked under a label banner, so the whole site's authored design can be eyeballed in one
 * pass. Bound content (product carousels, the PDP's product, journal cards) resolves to the
 * bundle's own example records via the sample host; the shared functional cores show a
 * labeled placeholder (they render server-side on the live storefront). The third generator
 * oracle (after emit + safeParseBlueprint): a visual proof for review.
 */
export async function writeTemplatePreview(
  spec: TemplateSiteSpec,
  theme: Theme,
  scratchDir: string = PREVIEW_DIR
): Promise<WriteTemplatePreviewResult> {
  const site = composeTemplateSite(spec);
  return writeSitePreview(
    {
      slug: spec.slug,
      title: `${spec.brand.businessName} — ${spec.name} preview`,
      businessName: spec.brand.businessName,
      frameRoot: (site.frame as { root: Node }).root,
      pages: site.pages as { name: string; root: Node }[],
      source: spec,
      theme,
    },
    scratchDir
  );
}

export interface SitePreviewInput {
  /** Names the emitted file + the Tailwind scratch dir; must be unique per run. */
  slug: string;
  title: string;
  businessName: string;
  frameRoot: Node;
  pages: { name: string; root: Node }[];
  /** Where bound content resolves from — the bundle's own example records. */
  source: PreviewSource;
  theme: Theme;
}

/**
 * The renderer proper, over pages that ALREADY EXIST.
 *
 * Split out of `writeTemplatePreview` so the showcase bundles can reach it. Those
 * are a CAPTURED site — frame and pages pulled verbatim from a live tenant — so
 * there is no spec to compose them from, and before this they had no preview path
 * at all (which is why their media were hand-made). Everything below the compose
 * step was already generic; only the input shape was not.
 */
export async function writeSitePreview(
  input: SitePreviewInput,
  scratchDir: string = PREVIEW_DIR
): Promise<WriteTemplatePreviewResult> {
  await fs.mkdir(scratchDir, { recursive: true });
  const { theme } = input;
  const pages = input.pages;
  const host = buildSampleHost(input.source);
  const frameRoot = staticizeHostNodes(input.frameRoot, input.businessName) as Node;

  // The branded chrome once (Home in its real frame), then each remaining page body under a
  // label. Deep-clone each root before placeholderizing so the mutation can't leak.
  const clone = (n: Node): Node => JSON.parse(JSON.stringify(n)) as Node;
  const label = (name: string): string =>
    `<div class="__pv-label">${name}</div>`;
  const renderPage = (root: Node, framed: boolean): string =>
    renderSilicaBody(placeholderizeCores(clone(root)) as Node, {
      host,
      ...(framed ? { frame: frameRoot } : {}),
      html: { ids: false },
    });

  const parts: string[] = [];
  parts.push(label('Home (with site chrome)'));
  parts.push(renderPage(pages[0]!.root, true));
  for (const pg of pages.slice(1)) {
    parts.push(label(pg.name));
    parts.push(renderPage(pg.root, false));
  }
  const bodyHtml = parts.join('\n');

  const utilCss = compilePreviewCss(input.slug, bodyHtml, scratchDir);
  const themeCss = buildSilicaThemeCssFromTheme(
    theme as Parameters<typeof buildSilicaThemeCssFromTheme>[0]
  );
  const { heading, body } = faces(theme);

  const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${input.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${fontsHref(heading, body)}" />
<style>${utilCss}</style>
<style>${themeCss}</style>
<style>
  html { scroll-behavior: smooth; }
  body { background: var(--color-base-100); color: var(--color-base-content); font-family: var(--font-sans, system-ui, sans-serif); }
  .__pv-label { position: sticky; top: 0; z-index: 50; background: #111; color: #fff; font: 600 12px/1 ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; padding: 8px 16px; border-top: 2px solid #fff; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
  const out = join(scratchDir, `preview-${input.slug}.html`);
  await fs.writeFile(out, html, 'utf8');
  return { path: out };
}
