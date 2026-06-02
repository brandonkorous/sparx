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
    // Built-ins first, then the tenant's custom types — stable order.
    const types = await tx.contentType.findMany({
      orderBy: [{ isBuiltIn: 'asc' }, { key: 'asc' }],
      select: { key: true, name: true, pluralName: true, isSingleton: true, schemaJson: true },
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
