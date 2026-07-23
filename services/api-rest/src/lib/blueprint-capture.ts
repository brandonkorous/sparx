// Blueprint capture (docs/118 Phase 3) — the inverse of blueprint-installer. The
// installer replays a manifest INTO a site; this reads a live authored site BACK OUT
// into the `site` half of a manifest (`SiteDecl`). It is the seam that makes a
// blueprint "a projection of a real silica site": an author builds the canonical site
// in the studio editor (or via the MCP silica writers), then captures it instead of
// hand-writing node trees.
//
// Two layers, kept apart on purpose:
//   · siteService.getCapturableSite reads the pages/frame/theme/symbols enriched with
//     the per-page domain columns silica's flat `Page` doesn't model (@sparx/builder).
//   · captureSite projects that into a validated `SiteDecl` (@sparx/blueprints, pure).
// This file just wires them, symmetric with how the installer wires captureBaselines
// + the service layer.

import { captureSite, type SiteDecl } from '@sparx/blueprints';
import { siteService } from '@sparx/builder';

export interface CaptureContext {
  tenantId: string;
  userId: string | null;
  /** The property to capture from — the tenant's authoring property. */
  propertyId: string;
}

export interface CaptureSiteOptions {
  /** Which trees to capture: the author's working `draft` (default) or the last
   *  `published` snapshot. */
  source?: 'draft' | 'published';
  /** Omit the authored theme so the captured blueprint re-skins per installing tenant
   *  (the one-base-across-many-themes model — manifest.ts `SiteDecl.theme`). Default
   *  false — capture the theme verbatim. */
  omitTheme?: boolean;
}

/**
 * Capture a property's authored silica site as a blueprint `SiteDecl`, or null when
 * the property has materialized no site for the requested source. Throws (via
 * `captureSite`) if the captured site would not reinstall — a capture bug caught here
 * rather than at ingest.
 */
export async function captureBlueprintSite(
  ctx: CaptureContext,
  opts: CaptureSiteOptions = {}
): Promise<SiteDecl | null> {
  const site = await siteService.getCapturableSite(
    { tenantId: ctx.tenantId, userId: ctx.userId ?? undefined, propertyId: ctx.propertyId },
    { source: opts.source }
  );
  if (!site) return null;
  return captureSite(site, { omitTheme: opts.omitTheme });
}
