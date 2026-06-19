// Server-side assembly of everything an embedded record preview needs (docs/51 §6)
// — the binding catalog, the chosen collection template's tree, the brand-compiled
// canvas theme, and the real site chrome. The CMS entry editor calls this ONE
// function so all the builder/brand coupling stays here, on the builder side, not
// spread through the CMS module. Fully fail-soft: any read failing returns null, so
// the entry editor simply falls back to the form-only layout.

import 'server-only';
import type { BindingCatalog, BuilderNode, FieldSchema } from '@sparx/builder-schemas';

import type { SitePreviewData } from '../_builder/binding-catalog';
import { getBindingCatalog, listPages } from './api';
import { canvasThemeCss } from './canvas-theme';
import { getBrand, getConfig, getSitePreviewData, getTenant } from '../_brand/lib/api';
import { applyBrandOverride } from '../_brand/lib/site-brand';
import { propertyOrigin } from '../_brand/lib/property';
import { getActiveProperty } from '@/lib/sites';

export interface RecordPreviewBundle {
  /** The collection template tree the record renders through. */
  tree: BuilderNode;
  catalog: BindingCatalog;
  /** The record source's fields (kinds), for shaping the live body + the bridge. */
  fields: FieldSchema[];
  /** The tenant theme compiled to a `.bx-canvas`-scoped `<style>` (or '' on failure). */
  themeCss: string;
  /** Real brand identity + social links for the canvas header/footer. */
  sitePreview: SitePreviewData;
  /** The active site origin, for the browser frame's address bar. */
  siteOrigin: string;
  tenantSlug: string;
}

/** Assemble the preview bundle for a content type rendered through `templateId`.
 *  `sourceKey` is the type key (the catalog OBJECT source the template binds).
 *  Returns null when the template can't be resolved or any core read fails. */
export async function loadRecordPreviewBundle(opts: {
  sourceKey: string;
  templateId: string;
}): Promise<RecordPreviewBundle | null> {
  try {
    const [catalog, pages, baseBrand, config, activeProperty, tenant] = await Promise.all([
      getBindingCatalog(),
      listPages(),
      getBrand(),
      getConfig(),
      getActiveProperty().catch(() => null),
      getTenant(),
    ]);

    const page = pages.find((p) => p.id === opts.templateId);
    if (!page?.tree) return null;

    const source = catalog.sources.find(
      (s) => s.key === opts.sourceKey && s.cardinality === 'object'
    );

    // A non-primary site previews in ITS brand (base + per-site override), exactly
    // like /builder/studio, so the canvas matches that site's published look.
    const isPrimary = activeProperty?.isPrimary ?? true;
    const effectiveBrand = isPrimary
      ? baseBrand
      : applyBrandOverride(baseBrand, activeProperty?.brandOverride);

    const [sitePreview] = await Promise.all([getSitePreviewData(activeProperty?.slug)]);

    return {
      tree: page.tree,
      catalog,
      fields: source?.fields ?? [],
      themeCss: canvasThemeCss(effectiveBrand, config),
      sitePreview,
      siteOrigin: propertyOrigin(tenant.slug, activeProperty),
      tenantSlug: tenant.slug,
    };
  } catch {
    return null;
  }
}
