// surfaceCssService — the published per-tenant Surface stylesheet (docs/47 §5).
//
// Tree-shakes the authored `class` literals (docs/47 §3, the `node.class` field)
// across ALL of a tenant's PUBLISHED Builder trees — every published page plus
// the active published layout chrome — and compiles them, through the
// tenant-flavored Tailwind theme, into the `tenant.css` the storefront loads
// after its `--sf-*` token block.
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

import { withTenant } from '@sparx/db';
import { collectClasses, compileClasses, contentHash } from '@sparx/surface-compile';
import type { BuilderNode } from '@sparx/builder-schemas';

import type { ServiceContext } from '../errors';

export interface PublishedStylesheet {
  /** The compiled, minified CSS for every authored class — '' when none. */
  css: string;
  /** Content hash of `css` (cache-bustable identity). */
  hash: string;
}

// tenantId → last compiled sheet + the class-set hash it was built from. A single
// api-rest process holds one entry per tenant it has served; the value is just
// the compiled string. Replicas each warm independently — correctness is per
// class-set, so they converge.
const cache = new Map<string, { classHash: string; sheet: PublishedStylesheet }>();

/** Collect every tenant PUBLISHED tree (pages + active layout chrome). The
 *  `publishedTree != null` filter is done in JS — the JSON column's NULL check
 *  needs a Prisma runtime value, but Prisma is a type-only import here (cf.
 *  pageService.getPublishedBySlug). */
function readPublishedTrees(ctx: ServiceContext): Promise<BuilderNode[]> {
  return withTenant(ctx, async (tx) => {
    const trees: BuilderNode[] = [];
    const pages = await tx.builderPage.findMany({ select: { publishedTree: true } });
    for (const page of pages) {
      if (page.publishedTree != null) trees.push(page.publishedTree as unknown as BuilderNode);
    }
    const layout = await tx.builderLayout.findFirst({
      where: { isActive: true },
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
export async function getPublishedStylesheet(ctx: ServiceContext): Promise<PublishedStylesheet> {
  const trees = await readPublishedTrees(ctx);
  const classes = collectClasses(trees);
  const classHash = contentHash(classes.join(' '));

  const cached = cache.get(ctx.tenantId);
  if (cached?.classHash === classHash) return cached.sheet;

  const css = await compileClasses(classes, { minify: true });
  const sheet: PublishedStylesheet = { css, hash: contentHash(css) };
  cache.set(ctx.tenantId, { classHash, sheet });
  return sheet;
}
