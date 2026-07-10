// The sparx `BuilderHost` — the whole domain seam silica's `<Builder>` reads
// (silicaui-builder/react). It composes the four host pieces built in
// @sparx/builder-schemas + @sparx/silica-catalog into the one adapter the engine
// consumes (docs/118 §4):
//   · resolveBinding / resolveCollection → `createSilicaResolver` over the tenant's
//     pre-loaded data root (the editor's `buildPreviewData`).
//   · dataSources() → `toSilicaDataSources` of the tenant binding catalog, so the
//     built-in binding picker + `scopeAt` narrow to real product/CMS/site fields.
//   · catalog() → the commerce composites silica doesn't ship, ADDED via `extend`
//     (the engine calls `mergeCatalog` itself — the host only contributes additions).
//   · validateClass → the tenant's OPTIONAL tighten rules over silica's built-in
//     denylist floor (omitted entirely when the tenant has no custom rules).
//
// Pure + framework-free (type-only imports from silicaui-builder/react, so this
// module never pulls the editor bundle server-side); the client studio wraps the
// live `<Builder>` around the host this returns.

import type { BuilderHost, PaletteGroup } from '@wizeworks/silicaui-builder/react';
import type { DataSource as SilicaDataSource } from '@wizeworks/silicaui-html';
import {
  createSilicaClassValidator,
  createSilicaResolver,
  defaultSilicaFormat,
  type DataSources,
  type NodeBinding,
} from '@sparx/builder-schemas';
import { COMMERCE_CATALOG } from '@sparx/silica-catalog';

// `defaultSilicaFormat` moved to @sparx/builder-schemas (silica-resolve) so the
// storefront render host and this editor host format identically; re-export it
// here so the studio mount keeps importing it from the host module.
export { defaultSilicaFormat };

export interface SilicaHostOptions {
  /** The pre-loaded data root the resolver reads from (`buildPreviewData` in the
   *  editor; `loadBuilderData` on the storefront). Fetched ONCE, up front — the
   *  resolver is synchronous by silica's contract. */
  root: DataSources;
  /** The tenant binding catalog projected to silica `DataSource[]` — computed once
   *  (`toSilicaDataSources(catalog.sources)`) and handed straight to the engine. */
  dataSources: SilicaDataSource[];
  /** The tenant's stored `builder_governance.utility_allowlist` (or null). */
  tenantAllowlist?: unknown;
  /** Host value formatter — price → "$49.00", ISO date → "May 27". Formatting is
   *  host territory; the engine only fills the returned value. */
  formatValue?: (value: unknown, binding: NodeBinding) => unknown;
  /** The media picker `<Builder>` invokes when an image/video field asks for a
   *  source. Omitted → the engine falls back to a raw URL input. */
  pickAsset?: BuilderHost['pickAsset'];
}

/** Assemble the sparx `BuilderHost`. The commerce catalog is structurally silica's
 *  `PaletteGroup[]` (its `icon` is a silica `IconName`, typed `string` in the
 *  React-free catalog package) — the cast narrows that one nominal gap. */
export function buildSilicaHost(opts: SilicaHostOptions): BuilderHost {
  const resolver = createSilicaResolver({ root: opts.root, format: opts.formatValue });
  const validateClass = createSilicaClassValidator(opts.tenantAllowlist);
  return {
    resolveBinding: resolver.resolveBinding,
    resolveCollection: resolver.resolveCollection,
    dataSources: () => opts.dataSources,
    catalog: () => ({ extend: COMMERCE_CATALOG as unknown as PaletteGroup[] }),
    ...(validateClass ? { validateClass } : {}),
    ...(opts.pickAsset ? { pickAsset: opts.pickAsset } : {}),
    // inspectorPanels — sparx's SEO / product-pin / per-module panels are additive
    // and land next; the engine's built-in panels cover the base case until then.
  };
}
