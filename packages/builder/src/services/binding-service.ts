// bindingService — the Builder binding schema (docs/43, the keystone).
//
// Composes what a page can bind to: the tenant's REAL CMS content types
// (read-only cross-module introspection — the builder must know what types
// exist to offer them as sources) plus the code-defined Commerce/CRM domain
// sources. The CMS→source mapping is the pure `mapCmsContentType` in
// @sparx/builder-schemas; this service only supplies the tenant's content types.

import {
  COMMERCE_SOURCES,
  CRM_SOURCES,
  mapCmsContentType,
  type BindingCatalog,
  type CmsFieldLike,
} from '@sparx/builder-schemas';
import { withTenant } from '@sparx/db';

import type { ServiceContext } from '../errors';

export function getSchema(ctx: ServiceContext): Promise<BindingCatalog> {
  return withTenant(ctx, async (tx) => {
    // Tenant-owned types first (isBuiltIn ASC), then platform built-ins —
    // stable order. A tenant fork (is_built_in=false) of a built-in shadows
    // the platform row of the same key, so dedupe keeping the first per key.
    const rows = await tx.contentType.findMany({
      orderBy: [{ isBuiltIn: 'asc' }, { key: 'asc' }],
      select: { key: true, name: true, pluralName: true, isSingleton: true, schemaJson: true },
    });
    const seen = new Set<string>();
    const types = rows.filter((t) => {
      if (seen.has(t.key)) return false;
      seen.add(t.key);
      return true;
    });

    const cmsSources = types.flatMap((t) => {
      const fields = (t.schemaJson as { fields?: CmsFieldLike[] } | null)?.fields ?? [];
      return mapCmsContentType({
        key: t.key,
        name: t.name,
        pluralName: t.pluralName,
        isSingleton: t.isSingleton,
        fields,
      });
    });

    return { sources: [...cmsSources, ...COMMERCE_SOURCES, ...CRM_SOURCES] };
  });
}
