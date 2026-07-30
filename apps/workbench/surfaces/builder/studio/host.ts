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

import type { BuilderHost, PaletteGroup, ThemeGroup } from '@wizeworks/silicaui-builder/react';
import type { ClassValidator, DataSource as SilicaDataSource } from '@wizeworks/silicaui-html';
import {
  createSilicaClassValidator,
  createSilicaResolver,
  defaultSilicaFormat,
  type DataSources,
} from '@sparx/builder-schemas';
import {
  HOST_COMPONENTS,
  SITE_CATALOG,
  SPARX_CATALOG,
  SPARX_THEME_GROUPS,
  validateResponsiveVocabulary,
} from '@sparx/silica-catalog';

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
  /** Opens the tenant's media library for an image field.
   *
   *  Without it silica hides its "Browse…" affordance and the image field is a bare
   *  URL textbox — which asks a non-technical business owner to know what a URL is in
   *  order to put their own photograph on their own site. Every other surface (CMS,
   *  commerce, email) already hands them the shared browser; this is the site editor
   *  reaching the same bar. Passed in like `renderHostNode` so this module stays
   *  framework-free. */
  pickAsset?: BuilderHost['pickAsset'];
  /** Extra sections for the Inspector's Settings tab, for the node types sparx knows
   *  something about that silica cannot.
   *
   *  Today that is a PAGE's root node: `seoTitle` / `seoDescription` / `ogImage` /
   *  `canonical` / `noindex` are columns on `builder_pages`, invisible to an engine
   *  whose `Page` is `{id,name,slug,root}`. They belong on the page element, in the
   *  same panel every other element's properties live in — which is what this seam is
   *  for ("SEO, product-pin, a per-module editor", per the engine's own docs).
   *
   *  Passed in like `renderHostNode` for the same reason: it returns React. */
  inspectorPanels?: BuilderHost['inspectorPanels'];
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

/** Run every rule and report the FIRST refusal. silica's own `composeValidators`
 *  takes a single host validator, and the host has two independent ones: the
 *  platform's responsive vocabulary and this tenant's optional tighten rules. Both
 *  can only ADD rejections, so order is cosmetic — the vocabulary goes first because
 *  its reason names a specific replacement class, which is the more useful thing to
 *  read when a string trips both. */
function allOf(rules: readonly ClassValidator[]): ClassValidator | undefined {
  if (!rules.length) return undefined;
  return (cls) => {
    for (const rule of rules) {
      const verdict = rule(cls);
      if (!verdict.ok) return verdict;
    }
    return { ok: true };
  };
}

/** Assemble the sparx `BuilderHost`. The commerce/site catalog is structurally
 *  silica's `PaletteGroup[]` (its `icon` is a silica `IconName`, typed `string` in
 *  the React-free catalog package) — the cast narrows that one nominal gap. */
export function buildStudioHost(opts: StudioHostOptions): BuilderHost {
  const resolver = createSilicaResolver({ root: opts.root, format: defaultSilicaFormat });
  // The responsive vocabulary is PLATFORM policy, not a tenant setting: a viewport
  // variant makes the device toggle lie about the page, and no tenant benefits from
  // opting into that. The tenant allowlist composes on top when they have one.
  const tenantRules = createSilicaClassValidator(opts.tenantAllowlist);
  const validateClass = allOf(
    tenantRules ? [validateResponsiveVocabulary, tenantRules] : [validateResponsiveVocabulary]
  );
  return {
    resolveBinding: resolver.resolveBinding,
    resolveCollection: resolver.resolveCollection,
    dataSources: () => opts.dataSources,
    // `SPARX_CATALOG` is the commerce composites AND the section library in one list
    // (slice 19). Merging it whole rather than naming its halves here is deliberate:
    // a host that reaches for `COMMERCE_CATALOG` alone ships a builder with no
    // galleries, no price list, no opening hours and no menu, and nothing about that
    // omission is visible until an author goes looking for a block that is not there.
    catalog: () => ({
      extend: [...SPARX_CATALOG, ...SITE_CATALOG] as unknown as PaletteGroup[],
    }),
    // sparx's platform theme library, shelved by kind of business. `extend` only —
    // no `hide`, so silica's twenty presets stay on offer BELOW these. The two
    // libraries answer different questions ("what do I do" vs "what look do I
    // want") and an author benefits from both; hiding the shipped shelf would be a
    // white-label decision, which this isn't.
    //
    // No cast, unlike `catalog()` below: `SparxThemeGroup` is declared in the
    // React-free catalog package but every field is structurally silica's own
    // (`Theme` comes from silicaui-html, which both packages share), so the types
    // meet without help. The palette needs its cast only because `PaletteGroup.icon`
    // is a silica `IconName` that the React-free side has to type as `string`.
    themes: () => ({ extend: SPARX_THEME_GROUPS satisfies ThemeGroup[] }),
    hostComponents: hostComponentDefs,
    ...(validateClass ? { validateClass } : {}),
    ...(opts.renderHostNode ? { renderHostNode: opts.renderHostNode } : {}),
    ...(opts.pickAsset ? { pickAsset: opts.pickAsset } : {}),
    ...(opts.inspectorPanels ? { inspectorPanels: opts.inspectorPanels } : {}),
  };
}
