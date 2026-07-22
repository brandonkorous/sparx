// The sparx `BuilderHost` — the domain seam silica's `<Builder>` reads.
//
// silica ships the whole editor (canvas, Insert palette, Navigator, inspector,
// undo). The HOST is sparx's contribution to it: what a binding MEANS (the
// resolver over the tenant's data), the commerce/site composites silica doesn't
// ship (added to the palette via `extend`), the pinned functional cores (cart,
// checkout, search…) offered as `hostComponents`, and the tenant's class policy.
//
// Built fresh for the workbench, but off the SAME shared converters the storefront
// render and the dashboard studio use (`createSilicaResolver` /
// `createSilicaClassValidator` from @sparx/builder-schemas, the composites +
// cores from @sparx/silica-catalog) — one catalog, one resolver, no drift.

import type { BuilderHost, PaletteGroup } from '@wizeworks/silicaui-builder/react';
import type { DataSource as SilicaDataSource } from '@wizeworks/silicaui-html';
import {
  createSilicaClassValidator,
  createSilicaResolver,
  defaultSilicaFormat,
  type DataSources,
} from '@sparx/builder-schemas';
import { COMMERCE_CATALOG, HOST_COMPONENTS, SITE_CATALOG } from '@sparx/silica-catalog';

export interface StudioHostOptions {
  /** The pre-loaded placeholder data root the resolver reads bindings from
   *  (`buildPreviewRoot`). */
  root: DataSources;
  /** The tenant binding catalog projected to silica `DataSource[]` — drives the
   *  built-in binding picker. */
  dataSources: SilicaDataSource[];
  /** The tenant's stored class allowlist (tighten-only over silica's floor), or
   *  undefined for no custom rules. */
  tenantAllowlist?: unknown;
  /** Draws a `kind:"host"` node on the canvas (the brand mark, cart, checkout…).
   *  Omitted → silica renders its own grey labelled placeholder. Kept OUT of this
   *  framework-free module — the client studio passes the React renderer in, so
   *  host.ts never pulls a component bundle. */
  renderHostNode?: BuilderHost['renderHostNode'];
}

/** The host cores the Insert palette offers (docs/122) — `HOST_COMPONENTS` mapped
 *  onto the builder's `HostComponentDef`. A core is `pinned` (inserts locked) unless
 *  the registry opts it out (the brand mark, which is live-improvable). */
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

/** Assemble the sparx `BuilderHost`. The commerce/site catalog is structurally
 *  silica's `PaletteGroup[]` (its `icon` is a silica `IconName`, typed `string` in
 *  the React-free catalog package) — the cast narrows that one nominal gap. */
export function buildStudioHost(opts: StudioHostOptions): BuilderHost {
  const resolver = createSilicaResolver({ root: opts.root, format: defaultSilicaFormat });
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
    ...(opts.renderHostNode ? { renderHostNode: opts.renderHostNode } : {}),
  };
}
