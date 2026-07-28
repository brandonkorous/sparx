// The pre-publish check — everything `@sparx/site-lint` needs, gathered from one site.
//
// The engine is pure by design: it takes a site and a set of rosters and returns a
// report. This is the half that knows where any of that lives. It sits in api-rest
// rather than in `@sparx/builder` for the same reason `lib/seo-audit.ts` does — the
// answer is assembled ACROSS modules (the builder's trees, commerce's handles, the
// CMS's page entries, the tenant's brand), and a builder service that reached into all
// of them would be a builder service in name only.
//
// TWO THINGS ARE EASY TO GET WRONG HERE, so both are stated rather than inferred.
//
//   1. THE DRAFT IS WHAT IS CHECKED, not the published site. The whole point is to
//      answer "what happens if I publish this", and the published trees are the answer
//      to the previous one.
//
//   2. AN UNKNOWN ROSTER IS NOT AN EMPTY ONE. `LinkTargets` treats `undefined` as "the
//      caller did not look" and `[]` as "there are none", and only the second is
//      grounds for calling a link broken. So a module that is switched OFF contributes
//      `undefined` — with Commerce disabled there is no catalog to be missing from, and
//      reporting every product link on the site as broken would be worse than useless
//      to a tenant who is mid-migration.

import type { FastifyRequest } from 'fastify';
import type { PropertyContext } from '@sparx/builder';
import { isModuleEnabled } from '@sparx/auth';
import type { TxClient } from '@sparx/db';
import { withRequestTenant } from '@sparx/api-core/db';
import {
  lintSite,
  type LinkTargets,
  type LintablePage,
  type SiteLintReport,
} from '@sparx/site-lint';
import {
  applyBrandOverride,
  EMPTY_BRAND,
  tenantTheme,
  type BrandColumns,
} from '@sparx/site-themes';
import type { Node as SilicaNode, SymbolDef, Theme } from '@wizeworks/silicaui-html';
import {
  categorySiteVisibilityWhere,
  collectionSiteVisibilityWhere,
  contentSiteVisibilityWhere,
  productSiteVisibilityWhere,
} from './property.js';

/** Only pages that live in the current engine carry a draft tree; a page left over
 *  from the retired builder has none and cannot be checked. Exported for its test. */
export function silicaPagesOf(
  rows: {
    id: string;
    name: string;
    slug: string | null;
    kind: string;
    recordType: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    canonical: string | null;
    ogImage: string | null;
    noindex: boolean;
    silicaDraftTree: unknown;
  }[]
): LintablePage[] {
  const pages: LintablePage[] = [];
  for (const row of rows) {
    if (row.silicaDraftTree == null) continue;
    pages.push({
      id: row.id,
      name: row.name,
      slug: row.slug ?? '/',
      root: row.silicaDraftTree as SilicaNode,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      canonical: row.canonical,
      ogImage: row.ogImage,
      noindex: row.noindex,
      kind: row.kind === 'collection' ? 'collection' : 'singleton',
      recordType: row.recordType,
    });
  }
  return pages;
}

/**
 * The theme the site actually renders in.
 *
 * An authored theme wins. Failing that the site renders from the tenant's BRAND,
 * compiled — which is the case for most sites, because the Design inspector is
 * something an author opens on purpose and many never do. `tenantTheme` is the same
 * derivation the builder canvas opens on (it moved into `@sparx/site-themes` so both
 * read one copy), including the per-site brand override that makes a second site under
 * one tenant look like itself.
 *
 * Returns null if every path fails. That is not a failure of the check: the colour
 * rules simply return nothing, and the other twenty-one still run.
 */
async function effectiveTheme(tx: TxClient, ctx: PropertyContext): Promise<Theme | null> {
  const [site, brandRow, property, config] = await Promise.all([
    tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    tx.tenantBrand.findUnique({ where: { tenantId: ctx.tenantId } }),
    tx.property.findUnique({ where: { id: ctx.propertyId }, select: { brandOverride: true } }),
    tx.siteConfig.findUnique({ where: { propertyId: ctx.propertyId } }),
  ]);

  const authored = site?.silicaDraftTheme as Theme | null | undefined;
  if (authored) return authored;

  const base: BrandColumns = brandRow
    ? {
        tagline: brandRow.tagline,
        logoLightMediaId: brandRow.logoLightMediaId,
        logoDarkMediaId: brandRow.logoDarkMediaId,
        faviconMediaId: brandRow.faviconMediaId,
        colorPrimary: brandRow.colorPrimary,
        colorPrimaryForeground: brandRow.colorPrimaryForeground,
        colorSecondary: brandRow.colorSecondary,
        colorSecondaryForeground: brandRow.colorSecondaryForeground,
        colorAccent: brandRow.colorAccent,
        colorAccentForeground: brandRow.colorAccentForeground,
        fontHeading: brandRow.fontHeading,
        fontBody: brandRow.fontBody,
        tokens: brandRow.tokens,
      }
    : EMPTY_BRAND;

  const presentation = (config?.draftSettings as { presentation?: unknown } | null)?.presentation;
  const compiled = tenantTheme(applyBrandOverride(base, property?.brandOverride), {
    themeKey: config?.themeKey ?? 'default',
    ...(presentation === undefined ? {} : { presentation }),
  });
  return compiled ?? null;
}

/**
 * Everything a link on this site is allowed to point at.
 *
 * Each roster is gathered ONLY when its module is on, and the failure direction of
 * each flag lookup is chosen deliberately: a blip must never invent a broken link. So
 * every one of them fails CLOSED into `undefined` — "we did not look" — which the
 * engine treats as grounds for silence.
 */
export async function linkTargets(tx: TxClient, ctx: PropertyContext): Promise<LinkTargets> {
  const [commerce, cms, scheduling] = await Promise.all([
    isModuleEnabled(ctx.tenantId, 'commerce').catch(() => false),
    isModuleEnabled(ctx.tenantId, 'cms').catch(() => false),
    isModuleEnabled(ctx.tenantId, 'scheduling').catch(() => false),
  ]);

  const targets: LinkTargets = {};

  // CMS `page` entries share the catch-all route with builder pages, so they are part
  // of the PATH roster rather than a roster of their own. Supplying `paths` at all is
  // what switches bare-path checking on (see `LinkTargets`), and it is only honest to
  // do that once every other thing the catch-all resolves has been collected. With the
  // CMS off there are no entries, so an empty list is the complete truth.
  const pageEntries = cms
    ? await tx.contentEntry.findMany({
        where: {
          typeKey: 'page',
          status: 'published',
          deletedAt: null,
          slug: { not: null },
          ...contentSiteVisibilityWhere(ctx.propertyId),
        },
        select: { slug: true },
      })
    : [];
  targets.paths = pageEntries.map((e) => e.slug ?? '').filter(Boolean);

  if (commerce) {
    const [products, collections, categories] = await Promise.all([
      tx.product.findMany({
        where: {
          status: 'active',
          deletedAt: null,
          ...productSiteVisibilityWhere(ctx.propertyId),
        },
        select: { handle: true },
      }),
      tx.productCollection.findMany({
        where: { deletedAt: null, ...collectionSiteVisibilityWhere(ctx.propertyId) },
        select: { handle: true },
      }),
      tx.productCategory.findMany({
        where: { deletedAt: null, ...categorySiteVisibilityWhere(ctx.propertyId) },
        select: { handle: true },
      }),
    ]);
    targets.productHandles = products.map((p) => p.handle);
    targets.collectionHandles = collections.map((c) => c.handle);
    targets.categoryHandles = categories.map((c) => c.handle);
  }

  if (cms) {
    const posts = await tx.contentEntry.findMany({
      where: {
        typeKey: 'blog_post',
        status: 'published',
        deletedAt: null,
        slug: { not: null },
        ...contentSiteVisibilityWhere(ctx.propertyId),
      },
      select: { slug: true },
    });
    targets.postSlugs = posts.map((p) => p.slug ?? '').filter(Boolean);
  }

  if (scheduling) {
    const services = await tx.schedulingService.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    targets.serviceIds = services.map((s) => s.id);
  }

  return targets;
}

/**
 * Run the pre-publish check over the property's DRAFT site.
 *
 * Advisory. The report's `status` summarises severity and nothing more — no caller
 * should read it as permission, and the publish route does not consult it.
 */
export async function runSiteCheck(
  request: FastifyRequest,
  ctx: PropertyContext
): Promise<SiteLintReport> {
  return withRequestTenant(request, async (tx) => {
    const [rows, layout, site, theme, targets] = await Promise.all([
      tx.builderPage.findMany({
        where: { propertyId: ctx.propertyId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          kind: true,
          recordType: true,
          seoTitle: true,
          seoDescription: true,
          canonical: true,
          ogImage: true,
          noindex: true,
          silicaDraftTree: true,
        },
      }),
      tx.builderLayout.findFirst({ where: { propertyId: ctx.propertyId, isActive: true } }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
      effectiveTheme(tx, ctx),
      linkTargets(tx, ctx),
    ]);

    const symbols = (site?.silicaDraftSymbols ?? null) as Record<string, SymbolDef> | null;

    return lintSite({
      pages: silicaPagesOf(rows),
      frame:
        layout?.silicaDraftTree != null
          ? { root: layout.silicaDraftTree as unknown as SilicaNode }
          : null,
      symbols,
      theme,
      targets,
    });
  });
}
