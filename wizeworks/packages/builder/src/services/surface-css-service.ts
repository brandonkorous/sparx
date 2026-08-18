// surfaceCssService — the published per-tenant Surface stylesheet (docs/47 §5).
//
// Tree-shakes the authored `class` literals (docs/47 §3, the `node.class` field)
// across ALL of a tenant's PUBLISHED Builder trees — every published page plus
// the active published layout chrome — and compiles them, through the
// tenant-flavored Tailwind theme, into the `tenant.css` the storefront loads
// after its theme token block.
//
// Compiling a few hundred classes is milliseconds, but it must never sit in the
// hot path (docs/47 §5.3). So the output is cached per (tenant, class-set hash):
// a publish that changes the authored class set triggers exactly one recompile;
// every storefront read after that is a cache hit (a cheap DB read + a hash).
// The Tailwind compiler itself is process-memoized in @wizeworks/surface-compile.
//
// INTERIM (matches the public page/layout reads, which are `no-store` until the
// Pub/Sub→cache-revalidation slice lands): we compile lazily on first read after
// a publish rather than writing a content-hashed file at publish time (docs/47
// §5.2). Swapping to publish-time precompute + a stored sheet is a later, purely
// internal change behind this same function.

import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import {
  collectClasses,
  compileClasses,
  contentHash,
  parseAllowlistConfig,
  validateClasses,
  REDUCED_MOTION_CSS,
  SCROLL_MOTION_CSS,
  HOVER_MOTION_CSS,
  type AllowlistConfig,
} from '@wizeworks/surface-compile';
import type { BuilderNode } from '@wizeworks/builder-schemas';

import type { PropertyContext, ServiceContext } from '../errors';

// Render-surface CSS shipped ONCE with every tenant sheet (docs/61 §9): the
// reduced-motion baseline + the scroll-reveal entrance rules + the hover-effect
// library (`bx-hover--*`). It is identical for every tenant (not compiled from their
// classes) and rides this same stylesheet so the live site receives it through the
// existing HTTP path with no extra dependency, and so does the editor canvas.
// Prepended (not passed through the Tailwind compiler) so its custom
// `bx-reveal`/`bx-hover--*`/`@keyframes` rules are never tree-shaken or mangled.
const RENDER_LAYER_CSS = REDUCED_MOTION_CSS + SCROLL_MOTION_CSS + HOVER_MOTION_CSS;

export interface PublishedStylesheet {
  /** The compiled, minified CSS for every authored class, prefixed with the
   *  render-layer motion baseline (so it is never empty). */
  css: string;
  /** Content hash of `css` (cache-bustable identity). */
  hash: string;
}

// tenantId → last compiled sheet + the class-set hash it was built from. A single
// api-rest process holds one entry per tenant it has served; the value is just
// the compiled string. Replicas each warm independently — correctness is per
// class-set, so they converge.
const cache = new Map<string, { classHash: string; sheet: PublishedStylesheet }>();

// Short-lived "skip the read entirely" layer in FRONT of `cache` (docs/127 §4).
//
// `cache` alone only ever saved the Tailwind COMPILE: the class-set hash it keys on
// can't be computed without first reading every published tree in the property and
// walking all of them, so a cache HIT still cost two interactive transactions and a
// full tree walk on every storefront request. The header below calls that "a cheap
// DB read" — it is every published tree in the property, on the hot path.
//
// So a hit here returns the sheet with ZERO database work. Staleness is bounded two
// ways: the TTL, and `invalidatePublishedStylesheet()` which publish calls to drop the
// entry immediately — without that a newly published class would render unstyled until
// expiry. The TTL is the backstop for anything that mutates trees without going through
// publish (a backfill, a direct write), not the primary freshness mechanism.
const PUBLISHED_TTL_MS = 30_000;
const publishedTtl = new Map<string, { sheet: PublishedStylesheet; expires: number }>();

/** Drop the memoized published sheet for a property so the next read recompiles.
 *  MUST be called by every path that changes a published tree — otherwise that
 *  property serves a stale stylesheet for up to `PUBLISHED_TTL_MS`. */
export function invalidatePublishedStylesheet(ctx: PropertyContext): void {
  const key = `${ctx.tenantId}:${ctx.propertyId}`;
  publishedTtl.delete(key);
  cache.delete(key);
}
// The same cache shape for the DRAFT preview sheet (kept separate so a preview
// never clobbers the published entry, and vice-versa). Drafts change often, but
// caching per class-set still pays off: only a draft edit that adds/removes a
// class recompiles; reloading the same preview is a hit.
const draftCache = new Map<string, { classHash: string; sheet: PublishedStylesheet }>();

/** The tenant's ADDITIONAL utility-allowlist tightening (docs/61 §8 Phase 6b), or
 *  `undefined` when none — then the platform base allowlist applies unchanged.
 *  Tenant-level (one BuilderGovernance row per tenant); all sibling sites share it.
 *  Accepts any tenant-scoped context (PropertyContext extends ServiceContext). */
function readAllowlistConfig(ctx: ServiceContext): Promise<AllowlistConfig | undefined> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderGovernance.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { utilityAllowlist: true },
    });
    return parseAllowlistConfig(row?.utilityAllowlist);
  });
}

/** The cache key for a compiled sheet — the authored class set PLUS the tenant
 *  allowlist fingerprint, so an allowlist edit (which changes what compiles even
 *  when the class set is identical) invalidates the cached sheet exactly once. */
function sheetCacheHash(classes: string[], allowlist: AllowlistConfig | undefined): string {
  return contentHash(`${classes.join(' ')}\0${JSON.stringify(allowlist ?? null)}`);
}

/** Collect every tenant PUBLISHED tree (pages + active layout chrome). The
 *  `publishedTree != null` filter is done in JS — the JSON column's NULL check
 *  needs a Prisma runtime value, but Prisma is a type-only import here (cf.
 *  pageService.getPublishedBySlug).
 *
 *  Reads BOTH column families, and that is the point. The storefront renders the
 *  SILICA trees (`siteService.getPublishedFrame` / `getPublishedPageBySlug` read
 *  `silicaPublishedTree`), while this harvest only ever read the legacy sparx
 *  `publishedTree` — so every class authored in the silica editor was missing from
 *  the compiled sheet. That is not merely "a rule absent": this stylesheet is
 *  injected LAST in the storefront's `<head>`, so the classes it DOES carry win
 *  ties against the app bundle. A silica header authored `hidden … sm:flex` got
 *  `.hidden` from this sheet and `.sm\:flex` only from the bundle, so the nav links
 *  resolved to `display:none` on every viewport.
 *
 *  The legacy trees stay in the harvest because the `[...slug]` legacy content path
 *  still renders them (docs/builder-audit/01-roadmap.md); a superset of candidates
 *  only ever costs a few unused rules, while a missing one is an unstyled page. */
function readPublishedTrees(ctx: PropertyContext): Promise<BuilderNode[]> {
  return withTenant(ctx, async (tx) => {
    const trees: BuilderNode[] = [];
    const pages = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      select: { publishedTree: true, silicaPublishedTree: true },
    });
    for (const page of pages) {
      if (page.publishedTree != null) trees.push(page.publishedTree as unknown as BuilderNode);
      if (page.silicaPublishedTree != null) {
        trees.push(page.silicaPublishedTree as unknown as BuilderNode);
      }
    }
    const layout = await tx.builderLayout.findFirst({
      where: { isActive: true, propertyId: ctx.propertyId },
      select: { publishedTree: true, silicaPublishedTree: true },
    });
    if (layout?.publishedTree != null) {
      trees.push(layout.publishedTree as unknown as BuilderNode);
    }
    if (layout?.silicaPublishedTree != null) {
      trees.push(layout.silicaPublishedTree as unknown as BuilderNode);
    }
    return trees;
  });
}

/**
 * The published Surface stylesheet for a tenant — the compiled CSS for every
 * class authored across its published page + layout trees. Empty `css` when no
 * classes are authored yet (the common case until class-first authoring is in
 * wide use). Cached per class-set so repeat reads don't recompile.
 */
export async function getPublishedStylesheet(ctx: PropertyContext): Promise<PublishedStylesheet> {
  // Cache per (tenant, property) — sibling sites author different class sets.
  const key = `${ctx.tenantId}:${ctx.propertyId}`;

  // Checked BEFORE any database work. The class-hash cache below can only be
  // consulted after reading every published tree, so it saves the compile but not
  // the read; this layer is what keeps the read off the hot path entirely.
  const memo = publishedTtl.get(key);
  if (memo && memo.expires > Date.now()) return memo.sheet;

  const [trees, allowlist] = await Promise.all([readPublishedTrees(ctx), readAllowlistConfig(ctx)]);
  const classes = collectClasses(trees);
  const classHash = sheetCacheHash(classes, allowlist);

  const cached = cache.get(key);
  if (cached?.classHash === classHash) {
    // The class set is unchanged, so the compiled sheet still stands — but the TTL
    // entry had lapsed, so re-arm it rather than paying for this read again next request.
    publishedTtl.set(key, { sheet: cached.sheet, expires: Date.now() + PUBLISHED_TTL_MS });
    return cached.sheet;
  }

  const css = RENDER_LAYER_CSS + (await compileClasses(classes, { minify: true, allowlist }));
  const sheet: PublishedStylesheet = { css, hash: contentHash(css) };
  cache.set(key, { classHash, sheet });
  publishedTtl.set(key, { sheet, expires: Date.now() + PUBLISHED_TTL_MS });
  return sheet;
}

/** Collect every tenant DRAFT tree (all page drafts + the active layout's draft
 *  chrome) — the preview counterpart of readPublishedTrees. `draftTree` is
 *  non-nullable, but the guard mirrors the published reader for symmetry.
 *
 *  Reads the silica draft columns alongside the legacy ones for the same reason
 *  the published reader does — see its comment. Preview serves the silica DRAFT
 *  tree, so without these the preview sheet was missing exactly the classes the
 *  author had just typed, which is the one case preview exists for. */
function readDraftTrees(ctx: PropertyContext): Promise<BuilderNode[]> {
  return withTenant(ctx, async (tx) => {
    const trees: BuilderNode[] = [];
    const pages = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      select: { draftTree: true, silicaDraftTree: true },
    });
    for (const page of pages) {
      if (page.draftTree != null) trees.push(page.draftTree as unknown as BuilderNode);
      if (page.silicaDraftTree != null) {
        trees.push(page.silicaDraftTree as unknown as BuilderNode);
      }
    }
    const layout = await tx.builderLayout.findFirst({
      where: { isActive: true, propertyId: ctx.propertyId },
      select: { draftTree: true, silicaDraftTree: true },
    });
    if (layout?.draftTree != null) {
      trees.push(layout.draftTree as unknown as BuilderNode);
    }
    if (layout?.silicaDraftTree != null) {
      trees.push(layout.silicaDraftTree as unknown as BuilderNode);
    }
    return trees;
  });
}

/**
 * The DRAFT Surface stylesheet for a tenant — the compiled CSS for every class
 * authored across its DRAFT page + layout trees (a superset of the published
 * sheet). The site injects this, instead of the published sheet, when serving a
 * draft preview, so classes added since the last publish still resolve. Cached
 * per draft class-set in `draftCache`.
 */
export async function getDraftStylesheet(ctx: PropertyContext): Promise<PublishedStylesheet> {
  const [trees, allowlist] = await Promise.all([readDraftTrees(ctx), readAllowlistConfig(ctx)]);
  const classes = collectClasses(trees);
  const classHash = sheetCacheHash(classes, allowlist);

  const key = `${ctx.tenantId}:${ctx.propertyId}`;
  const cached = draftCache.get(key);
  if (cached?.classHash === classHash) return cached.sheet;

  const css = RENDER_LAYER_CSS + (await compileClasses(classes, { minify: true, allowlist }));
  const sheet: PublishedStylesheet = { css, hash: contentHash(css) };
  draftCache.set(key, { classHash, sheet });
  return sheet;
}

/**
 * The author classes currently DROPPED by the allowlist across the tenant's draft
 * trees (docs/61 §8 Phase 6b) — both the platform base rules and the tenant's own
 * additions. A read-time advisory: a blocked class is harmlessly dropped at
 * compile, but the author has no other signal it didn't render, so the governance
 * surface surfaces this list. Deduped + sorted.
 */
export async function getDraftBlocked(ctx: PropertyContext): Promise<string[]> {
  const [trees, allowlist] = await Promise.all([readDraftTrees(ctx), readAllowlistConfig(ctx)]);
  const { blocked } = validateClasses(collectClasses(trees), allowlist);
  return [...new Set(blocked)].sort();
}

// ── Editor live preview (the `temp.css` path, docs/47 §5.2) ───────────────────

/** The editor sends the class tokens it collected from the WORKING (unsaved)
 *  tree; we compile and hand the CSS back to inject into the canvas, so authored
 *  classes render live — identical to what publish will serve. Bounded to keep
 *  the compile cheap and reject pathological payloads. */
export const CompilePreviewInput = z.object({
  classes: z.array(z.string().max(200)).max(2000),
});

/**
 * Compile an editor-supplied class set for canvas preview. Tenant-scoped so the
 * tenant's utility allowlist (docs/61 §8 Phase 6b) applies in the canvas exactly
 * as it will at publish — a class the tenant has blocked silently no-ops live,
 * matching production. The silica theme tokens still resolve in the browser. Non-
 * minified for speed + readability; the Tailwind compiler is process-memoized, so
 * repeat calls only pay the candidate build.
 */
export async function compilePreview(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ css: string }> {
  const { classes } = CompilePreviewInput.parse(rawInput);
  const allowlist = await readAllowlistConfig(ctx);
  // Dedupe + sort for compiler determinism (the editor sends a raw list).
  // Prefix the render-layer motion CSS so the canvas's "Play motion" replay
  // (docs/61 §9.4) has the reveal rules available, identical to the live site.
  const css =
    RENDER_LAYER_CSS + (await compileClasses([...new Set(classes)].sort(), { allowlist }));
  return { css };
}
