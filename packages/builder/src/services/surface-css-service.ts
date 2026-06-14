// surfaceCssService — the published per-tenant Surface stylesheet (docs/47 §5).
//
// Tree-shakes the authored `class` literals (docs/47 §3, the `node.class` field)
// across ALL of a tenant's PUBLISHED Builder trees — every published page plus
// the active published layout chrome — and compiles them, through the
// tenant-flavored Tailwind theme, into the `tenant.css` the storefront loads
// after its `--st-*` token block.
//
// Compiling a few hundred classes is milliseconds, but it must never sit in the
// hot path (docs/47 §5.3). So the output is cached per (tenant, class-set hash):
// a publish that changes the authored class set triggers exactly one recompile;
// every storefront read after that is a cache hit (a cheap DB read + a hash).
// The Tailwind compiler itself is process-memoized in @sparx/surface-compile.
//
// INTERIM (matches the public page/layout reads, which are `no-store` until the
// Pub/Sub→cache-revalidation slice lands): we compile lazily on first read after
// a publish rather than writing a content-hashed file at publish time (docs/47
// §5.2). Swapping to publish-time precompute + a stored sheet is a later, purely
// internal change behind this same function.

import { z } from 'zod';
import { withTenant } from '@sparx/db';
import {
  collectClasses,
  compileClasses,
  contentHash,
  REDUCED_MOTION_CSS,
  SCROLL_MOTION_CSS,
} from '@sparx/surface-compile';
import type { BuilderNode } from '@sparx/builder-schemas';

import type { PropertyContext } from '../errors';

// Render-surface CSS shipped ONCE with every tenant sheet (docs/61 §9): the
// reduced-motion baseline + the scroll-reveal entrance rules. It is identical for
// every tenant (not compiled from their classes) and rides this same stylesheet
// so the live site receives it through the existing HTTP path with no extra
// dependency, and so does the editor canvas. Prepended (not passed through the
// Tailwind compiler) so its custom `st-reveal`/`@keyframes` rules are never
// tree-shaken or mangled.
const RENDER_LAYER_CSS = REDUCED_MOTION_CSS + SCROLL_MOTION_CSS;

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
// The same cache shape for the DRAFT preview sheet (kept separate so a preview
// never clobbers the published entry, and vice-versa). Drafts change often, but
// caching per class-set still pays off: only a draft edit that adds/removes a
// class recompiles; reloading the same preview is a hit.
const draftCache = new Map<string, { classHash: string; sheet: PublishedStylesheet }>();

/** Collect every tenant PUBLISHED tree (pages + active layout chrome). The
 *  `publishedTree != null` filter is done in JS — the JSON column's NULL check
 *  needs a Prisma runtime value, but Prisma is a type-only import here (cf.
 *  pageService.getPublishedBySlug). */
function readPublishedTrees(ctx: PropertyContext): Promise<BuilderNode[]> {
  return withTenant(ctx, async (tx) => {
    const trees: BuilderNode[] = [];
    const pages = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      select: { publishedTree: true },
    });
    for (const page of pages) {
      if (page.publishedTree != null) trees.push(page.publishedTree as unknown as BuilderNode);
    }
    const layout = await tx.builderLayout.findFirst({
      where: { isActive: true, propertyId: ctx.propertyId },
      select: { publishedTree: true },
    });
    if (layout?.publishedTree != null) {
      trees.push(layout.publishedTree as unknown as BuilderNode);
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
  const trees = await readPublishedTrees(ctx);
  const classes = collectClasses(trees);
  const classHash = contentHash(classes.join(' '));

  // Cache per (tenant, property) — sibling sites author different class sets.
  const key = `${ctx.tenantId}:${ctx.propertyId}`;
  const cached = cache.get(key);
  if (cached?.classHash === classHash) return cached.sheet;

  const css = RENDER_LAYER_CSS + (await compileClasses(classes, { minify: true }));
  const sheet: PublishedStylesheet = { css, hash: contentHash(css) };
  cache.set(key, { classHash, sheet });
  return sheet;
}

/** Collect every tenant DRAFT tree (all page drafts + the active layout's draft
 *  chrome) — the preview counterpart of readPublishedTrees. `draftTree` is
 *  non-nullable, but the guard mirrors the published reader for symmetry. */
function readDraftTrees(ctx: PropertyContext): Promise<BuilderNode[]> {
  return withTenant(ctx, async (tx) => {
    const trees: BuilderNode[] = [];
    const pages = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      select: { draftTree: true },
    });
    for (const page of pages) {
      if (page.draftTree != null) trees.push(page.draftTree as unknown as BuilderNode);
    }
    const layout = await tx.builderLayout.findFirst({
      where: { isActive: true, propertyId: ctx.propertyId },
      select: { draftTree: true },
    });
    if (layout?.draftTree != null) {
      trees.push(layout.draftTree as unknown as BuilderNode);
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
  const trees = await readDraftTrees(ctx);
  const classes = collectClasses(trees);
  const classHash = contentHash(classes.join(' '));

  const key = `${ctx.tenantId}:${ctx.propertyId}`;
  const cached = draftCache.get(key);
  if (cached?.classHash === classHash) return cached.sheet;

  const css = RENDER_LAYER_CSS + (await compileClasses(classes, { minify: true }));
  const sheet: PublishedStylesheet = { css, hash: contentHash(css) };
  draftCache.set(key, { classHash, sheet });
  return sheet;
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
 * Compile an editor-supplied class set for canvas preview. Stateless — a pure
 * function of the class list (the `--st-*` tokens resolve in the browser), so it
 * needs no tenant context. Non-minified for speed + readability; the Tailwind
 * compiler is process-memoized, so repeat calls only pay the candidate build.
 */
export async function compilePreview(rawInput: unknown): Promise<{ css: string }> {
  const { classes } = CompilePreviewInput.parse(rawInput);
  // Dedupe + sort for compiler determinism (the editor sends a raw list).
  // Prefix the render-layer motion CSS so the canvas's "Play motion" replay
  // (docs/61 §9.4) has the reveal rules available, identical to the live site.
  const css = RENDER_LAYER_CSS + (await compileClasses([...new Set(classes)].sort()));
  return { css };
}
