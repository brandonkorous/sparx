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
import { HOST_COMPONENTS } from '@sparx/silica-catalog';
import {
  createSilicaClassValidator,
  createSilicaResolver,
  defaultSilicaFormat,
  type DataSources,
  type NodeBinding,
} from '@sparx/builder-schemas';
import { COMMERCE_CATALOG, SITE_CATALOG } from '@sparx/silica-catalog';

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
  /** Host panels contributed to silica's Inspector — today the form-settings panel
   *  (where a submission goes, docs/115), which silica has no opinion about by design. */
  inspectorPanels?: BuilderHost['inspectorPanels'];
  /** The live canvas preview for a pinned functional core (docs/122). Kept OUT of this
   *  framework-free module — the client studio passes the React skeleton renderer in, so
   *  this file never pulls a component bundle. Absent → the engine shows its own labeled
   *  placeholder for a host node (still fine, just less branded). */
  renderHostNode?: BuilderHost['renderHostNode'];
}

/** The host cores the Insert palette offers (docs/122) — `HOST_COMPONENTS` (the
 *  React-free registry in @sparx/silica-catalog) mapped onto the builder's
 *  `HostComponentDef`. A core is `pinned` by default, so it inserts `locked: "host"`:
 *  the engine refuses to remove/move it and the author UI offers no unlock. The registry
 *  may opt a core OUT (`pinned: false`) when it is live-rendered for improvability
 *  rather than to protect a transaction — the brand mark. Read the flag rather than
 *  forcing it here: whether a core is protected is the registry's call, not this
 *  mapper's. */
function hostComponentDefs(): ReturnType<NonNullable<BuilderHost['hostComponents']>> {
  return HOST_COMPONENTS.map((c) => ({
    name: c.key,
    label: c.label,
    category: c.category,
    icon: c.icon,
    hint: c.hint,
    pinned: c.pinned ?? true,
    defaultClass: c.defaultClass,
    ...(c.props ? { props: c.props } : {}),
  }));
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
    catalog: () => ({
      extend: [...COMMERCE_CATALOG, ...SITE_CATALOG] as unknown as PaletteGroup[],
    }),
    hostComponents: hostComponentDefs,
    ...(validateClass ? { validateClass } : {}),
    ...(opts.pickAsset ? { pickAsset: opts.pickAsset } : {}),
    ...(opts.inspectorPanels ? { inspectorPanels: opts.inspectorPanels } : {}),
    ...(opts.renderHostNode ? { renderHostNode: opts.renderHostNode } : {}),
  };
}
