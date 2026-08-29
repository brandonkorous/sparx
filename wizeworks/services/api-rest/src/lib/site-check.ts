// The pre-publish check — everything `@wizeworks/site-lint` needs, gathered from one site.
//
// The engine is pure by design: it takes a site and a set of rosters and returns a
// report. This is the half that knows where any of that lives. It sits in api-rest
// rather than in `@wizeworks/builder` for the same reason `lib/seo-audit.ts` does — the
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
import type { PropertyContext } from '@wizeworks/builder';
import { isModuleEnabled } from '@wizeworks/auth';
import type { TxClient } from '@wizeworks/db';
import { withRequestTenant } from '@wizeworks/api-core/db';
import {
  imageSourcesOf,
  lintSite,
  type LinkTargets,
  type LintablePage,
  type SiteCapabilities,
  type SiteLintInput,
  type SiteLintReport,
} from '@wizeworks/site-lint';
import type { Node as SilicaNode, SymbolDef } from '@wizeworks/silicaui-html';
import { effectiveTheme } from './effective-theme.js';
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
    // A page with no draft tree cannot be walked. It is REPORTED rather than
    // dropped — see `skippedPagesOf`.
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
 * The pages the check could not look at, and why.
 *
 * `silicaPagesOf` drops every page with no draft tree, because there is nothing to
 * walk. Dropping them silently is the problem: `pagesChecked` then counts only the
 * survivors, so a site of eleven pages reported "Nothing to fix across 7 pages. It
 * reads well." and the owner had no way to learn that four of their pages were never
 * opened. A clean result has to state its own coverage or it is not a result.
 */
export function skippedPagesOf(
  rows: { id: string; name: string; silicaDraftTree: unknown }[]
): { id: string; name: string }[] {
  return rows
    .filter((row) => row.silicaDraftTree == null)
    .map((row) => ({ id: row.id, name: row.name }));
}

/**
 * What this site's visitors can actually DO.
 *
 * Today one question: does anybody have an ACCOUNT here? The signed-in area — orders,
 * returns, bookings, quotes, saved addresses — is one route on the storefront and is not
 * itself gated, so what decides whether it holds anything is whether the tenant runs a
 * module that puts something in it. Commerce gives a customer orders and returns,
 * Scheduling gives her bookings, B2B gives her quotes and requests. Any one of the
 * three, and a site with no way in strands her.
 *
 * FAILS CLOSED into `undefined`, exactly like `linkTargets` and for the same reason: a
 * flag lookup that blips must never invent a finding. `undefined` reads as "we did not
 * look", and the engine stays silent on it.
 */
export async function siteCapabilities(ctx: PropertyContext): Promise<SiteCapabilities> {
  const flags = await Promise.all(
    (['commerce', 'scheduling', 'b2b'] as const).map((slug) =>
      isModuleEnabled(ctx.tenantId, slug).catch(() => null)
    )
  );
  // A single failed lookup is not grounds for saying "no accounts here" — that would be
  // the check going quiet on the site it was written for because of a blip. Only a clean
  // "all three are off" answers the question.
  if (flags.some((flag) => flag === null)) return {};
  return { customerAccounts: flags.some(Boolean) };
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
 * Every storage key a picture URL could have been built from.
 *
 * The platform emits a media URL through four different builders — api-rest's public
 * variant route, its local-mode file route, the CDN base, and the raw GCS bucket base
 * (`wizeworks/packages/media/src/storage.ts` and `wizeworks/packages/commerce/src/media-url.ts`) — and a
 * tree stores whichever one was current when the picture was chosen. Rather than
 * guessing which builder produced a given `src`, every plausible key is offered and
 * the database decides: a key that no row has simply matches nothing.
 *
 * The raw `src` is a candidate in its own right because a HOT-LINKED asset stores an
 * absolute URL AS its key (a blueprint install — see `mediaPublicUrl`), so for those
 * the URL and the key are the same string.
 *
 * Exported for its test: this is prefix-matching against four independently-evolving
 * URL shapes, which is exactly the kind of thing that rots silently and shows up as
 * "every picture on my site says unknown size".
 */
export function storageKeysOf(src: string): string[] {
  const keys = new Set<string>([src]);

  let path: string;
  try {
    // A base is supplied so a root-relative `src` parses; the host is then ignored.
    path = new URL(src, 'https://sparx.invalid').pathname;
  } catch {
    return [...keys];
  }
  // Keys are stored decoded (`${tenantId}/variants/…`); a URL carries them encoded.
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // A stray `%` — the encoded form is still worth trying.
  }

  for (const candidate of new Set([path, decoded])) {
    const trimmed = candidate.replace(/^\//, '');
    // The CDN and bucket forms put the key straight after the host.
    keys.add(trimmed);
    // `https://storage.googleapis.com/<bucket>/<key>` — drop the bucket segment.
    const slash = trimmed.indexOf('/');
    if (slash > 0) keys.add(trimmed.slice(slash + 1));
    for (const route of ['/v1/public/media/variants/', '/v1/public/media/file/']) {
      const at = candidate.indexOf(route);
      if (at >= 0) keys.add(candidate.slice(at + route.length));
    }
  }

  keys.delete('');
  return [...keys];
}

/**
 * What each picture on the site weighs.
 *
 * The engine names the files (`imageSourcesOf`) and this looks them up, because the
 * engine is pure and has no media library to ask. A source that matches nothing is
 * left OUT of the map rather than entered as zero — the check reports it as unsized,
 * which is the truth, instead of quietly making a hot-linked 4 MB hero photo look
 * free.
 *
 * Variants are consulted first and win: a variant is what the page actually
 * downloads, and the original it was derived from is usually several times larger.
 */
async function imageWeights(tx: TxClient, sources: string[]): Promise<Record<string, number>> {
  if (sources.length === 0) return {};

  const candidates = new Map<string, string[]>();
  const allKeys = new Set<string>();
  for (const src of sources) {
    const keys = storageKeysOf(src);
    candidates.set(src, keys);
    for (const key of keys) allKeys.add(key);
  }

  const keyList = [...allKeys];
  const [variants, assets] = await Promise.all([
    tx.mediaVariant.findMany({
      where: { key: { in: keyList } },
      select: { key: true, byteSize: true },
    }),
    tx.mediaAsset.findMany({
      where: { key: { in: keyList }, deletedAt: null },
      select: { key: true, byteSize: true },
    }),
  ]);

  const byKey = new Map<string, number>();
  for (const row of assets) byKey.set(row.key, Number(row.byteSize));
  for (const row of variants) byKey.set(row.key, Number(row.byteSize));

  const weights: Record<string, number> = {};
  for (const [src, keys] of candidates) {
    for (const key of keys) {
      const bytes = byKey.get(key);
      if (bytes != null) {
        weights[src] = bytes;
        break;
      }
    }
  }
  return weights;
}

/** The engine's report plus what this service could not hand it. */
export interface SiteCheckReport extends SiteLintReport {
  /** Pages with no draft tree — never walked, and named so the surface can say so. */
  notChecked: { id: string; name: string }[];
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
): Promise<SiteCheckReport> {
  return withRequestTenant(request, async (tx) => {
    const [rows, layout, site, theme, targets, capabilities] = await Promise.all([
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
      siteCapabilities(ctx),
    ]);

    const symbols = (site?.silicaDraftSymbols ?? null) as Record<string, SymbolDef> | null;

    const input: SiteLintInput = {
      pages: silicaPagesOf(rows),
      // EVERY page, not just the walkable ones. A page nobody has opened still
      // occupies its address, and the clash it causes is invisible from the site.
      addressing: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        kind: row.kind === 'collection' ? ('collection' as const) : ('singleton' as const),
        recordType: row.recordType,
      })),
      frame:
        layout?.silicaDraftTree != null
          ? { root: layout.silicaDraftTree as unknown as SilicaNode }
          : null,
      symbols,
      theme,
      targets,
      capabilities,
    };

    const notChecked = skippedPagesOf(rows);

    // TWO STEPS, and they have to be in this order: the engine names the pictures the
    // site references, this service sizes them, and the sized map goes back in. The
    // weights cannot be gathered up front because nothing outside the trees knows
    // which of the tenant's library a given site actually uses — and loading every
    // asset the tenant owns to weigh six of them is the query this avoids.
    const report = lintSite({
      ...input,
      imageBytes: await imageWeights(tx, imageSourcesOf(input)),
    });
    return { ...report, notChecked };
  });
}
