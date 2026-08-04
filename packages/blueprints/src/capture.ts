// The blueprint CAPTURE projector — the inverse of the installer's site seam
// (docs/118 Phase 3, the "blueprint capture path" `getPublishedSite` was pre-wired
// for). It turns a live authored silica site into a `SiteDecl` — the `site` half of
// a Blueprint manifest — so a template author builds a real site in the studio
// editor (or via the MCP silica writers) and CAPTURES it, instead of hand-writing
// node trees.
//
// This is the function `manifest.ts` promised ("`SiteDecl` mirrors `StoredSilicaSite`
// … so capturing a live site into a bundle is a projection, not a translation") but
// that was never shipped. Because `SiteDecl` is a 1:1 mirror of `installSite`'s
// `InstallSiteInput`, the projection is a field map, not a conversion:
//
//   · DROP runtime ids — the handle-not-id rule (manifest.ts:6-9): a manifest cannot
//     carry a tenant's row UUIDs; `installSite` mints fresh ones per page on install.
//   · NORMALIZE the home slug — `getPublishedSite` stores home as `'/'`, but
//     `PageSlug` is `min(1)` and home is expressed by OMITTING the slug, so `'/'`
//     (or `''`/null) projects to `undefined`.
//   · CARRY the per-page domain columns through — `kind`/`recordType`/`isDefault`/SEO.
//     silica's flat `Page` doesn't model them (site-sync.ts), so they must be supplied
//     alongside the trees; a capture that drops `recordType` makes a collection
//     template silently stop binding to its record type on reinstall (the exact
//     footgun `installSite` applies them after the reconcile to avoid).
//   · theme is OPTIONAL and can be OMITTED (`omitTheme`) so one captured blueprint
//     RE-SKINS per installing tenant — the batch-of-one-base-across-many-themes model
//     (manifest.ts SiteDecl.theme: "omitting it lets the installing tenant's own
//     brand-derived theme stand").
//
// Pure + Zod-only (no DB, no silica-html): the read that assembles `CapturedSiteInput`
// from `BuilderPage` rows lives in the api-rest capture orchestration, symmetric with
// `blueprint-installer.ts`. The projection is validated against `SiteDecl` before it
// is returned, so a captured site that would not reinstall is caught here — at capture
// time — rather than at ingest.

import type { BuilderPageKind, SilicaNode, SilicaTheme } from '@sparx/builder-schemas';
import { isRecordAddress, recordAddressFor } from '@sparx/silica-catalog';

import { SiteDecl } from './manifest';

/** One page to capture: the silica body `root` PLUS the sparx domain columns silica's
 *  flat `Page` doesn't carry (read from the `BuilderPage` row). `id` is accepted and
 *  DROPPED (handle-not-id). `slug` is the stored slug — `'/'`, `''`, or null all mean
 *  the home page and project to an omitted slug. */
export interface CapturedPageInput {
  id?: string;
  name: string;
  slug: string | null;
  root: SilicaNode;
  /** `singleton` (default) or `collection`. A collection page templates every record
   *  of `recordType`. */
  kind?: BuilderPageKind;
  recordType?: string | null;
  /** The default template for its `recordType` (collection pages only). */
  isDefault?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonical?: string | null;
  ogImage?: string | null;
  noindex?: boolean;
}

/** A live site to capture — the silica trees (`root`s, `frame`, `theme`, `symbols`)
 *  enriched with each page's domain columns. Mirrors what `siteService.installSite`
 *  consumes, which is why capture is a straight projection. */
export interface CapturedSiteInput {
  pages: CapturedPageInput[];
  frame?: { root: SilicaNode } | null;
  theme?: SilicaTheme | null;
  symbols?: Record<string, unknown> | null;
}

export interface CaptureOptions {
  /** Omit the authored theme so the blueprint re-skins per installing tenant (the
   *  one-base-across-many-themes model). Default false — capture the theme verbatim. */
  omitTheme?: boolean;
}

/** `'/'`, `''`, and null are all the home page, which `SiteDecl` expresses by omitting
 *  the slug (`PageSlug` forbids the empty string). Any other slug is passed through
 *  with a single leading `'/'` stripped (`PageSlug` disallows a leading slash). */
function normalizeSlug(slug: string | null | undefined): string | undefined {
  if (slug == null) return undefined;
  const trimmed = slug.startsWith('/') ? slug.slice(1) : slug;
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Project a live authored silica site into a `SiteDecl` (the `site` half of a
 * Blueprint manifest). Drops runtime ids, normalizes the home slug, carries the
 * per-page domain columns, and validates the result against `SiteDecl` — throwing a
 * `ZodError` if the captured site would not reinstall.
 */
export function captureSite(input: CapturedSiteInput, opts: CaptureOptions = {}): SiteDecl {
  const pages = input.pages
    // RECORD PAGES ARE NEVER CAPTURED. A blueprint carrying `/products/:handle` would
    // install one tenant's product design as a permanent, frozen copy on every tenant
    // who used that blueprint — and because it arrives as a row, `ensureRecordPagesTx`
    // would consider the address taken and never seed the platform template. The whole
    // point of these pages living in `RECORD_TEMPLATES` is that improvements reach
    // tenants; a captured fork opts every one of them out silently.
    //
    // `PageSlug` would reject the `:` anyway (blueprint slugs are validated on the way
    // in), so without this filter `captureSite` throws a ZodError on any site that has
    // a record page — which is now every site.
    .filter((p) => !isRecordAddress(p.slug) && !recordAddressFor(p.recordType ?? ''))
    .map((p) => {
      const kind: BuilderPageKind = p.kind ?? 'singleton';
      const slug = normalizeSlug(p.slug);
      return {
        name: p.name,
        kind,
        ...(p.recordType ? { recordType: p.recordType } : {}),
        ...(slug !== undefined ? { slug } : {}),
        root: p.root,
        // `isDefault` is meaningful only for a collection template.
        ...(kind === 'collection' && p.isDefault ? { isDefault: true } : {}),
        ...(p.seoTitle ? { seoTitle: p.seoTitle } : {}),
        ...(p.seoDescription ? { seoDescription: p.seoDescription } : {}),
        ...(p.canonical ? { canonical: p.canonical } : {}),
        ...(p.ogImage ? { ogImage: p.ogImage } : {}),
        ...(p.noindex ? { noindex: true } : {}),
      };
    });

  const decl = {
    ...(input.frame?.root ? { frame: { root: input.frame.root } } : {}),
    pages,
    ...(!opts.omitTheme && input.theme ? { theme: input.theme } : {}),
    ...(input.symbols && Object.keys(input.symbols).length > 0 ? { symbols: input.symbols } : {}),
  };

  return SiteDecl.parse(decl);
}
