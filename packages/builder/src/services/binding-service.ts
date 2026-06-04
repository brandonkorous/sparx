// bindingService — the Builder binding schema (docs/43, the keystone).
//
// Composes what a surface can bind to: the tenant's REAL CMS content types
// (read-only cross-module introspection — the builder must know what types
// exist to offer them as sources) plus the code-defined domain sources. The
// CMS→source mapping is the pure `mapCmsContentType` in @sparx/builder-schemas;
// this service only supplies the tenant's content types.
//
// Two surfaces, two catalogs (docs/52 §7): a PAGE binds to CMS + Commerce/CRM;
// an EMAIL binds to the per-recipient/per-send EMAIL_SOURCES plus the CMS
// COLLECTION sources (latest posts) — an email iterates lists and has no in-scope
// single record, so the record (object) CMS sources are dropped for email.

import {
  COMMERCE_SOURCES,
  CRM_SOURCES,
  EMAIL_SOURCES,
  mapCmsContentType,
  type BindingCatalog,
  type CmsFieldLike,
  type DataSource,
} from '@sparx/builder-schemas';
import { withTenant } from '@sparx/db';
import type { Prisma } from '@sparx/db';

import type { ServiceContext } from '../errors';

/** The tenant's CMS content types → Builder sources (collection + record), deduped
 *  by key (a tenant fork shadows the platform built-in of the same key). */
async function loadCmsSources(tx: Prisma.TransactionClient): Promise<DataSource[]> {
  // Tenant-owned types first (isBuiltIn ASC), then platform built-ins — stable
  // order so the dedupe keeps the tenant's fork over the platform row.
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
  return types.flatMap((t) => {
    const fields = (t.schemaJson as { fields?: CmsFieldLike[] } | null)?.fields ?? [];
    return mapCmsContentType({
      key: t.key,
      name: t.name,
      pluralName: t.pluralName,
      isSingleton: t.isSingleton,
      fields,
    });
  });
}

/** The PAGE binding catalog — CMS content types + Commerce/CRM domain sources. */
export function getSchema(ctx: ServiceContext): Promise<BindingCatalog> {
  return withTenant(ctx, async (tx) => {
    const cmsSources = await loadCmsSources(tx);
    return { sources: [...cmsSources, ...COMMERCE_SOURCES, ...CRM_SOURCES] };
  });
}

/** The EMAIL binding catalog (docs/52 §7) — the code-defined EMAIL_SOURCES
 *  (recipient / order / cart / loyalty / products / promotion) plus the tenant's
 *  CMS COLLECTION sources (e.g. latest posts), so an email can iterate a list.
 *  Record (object) CMS sources are dropped: an email has no in-scope record. */
export function getEmailSchema(ctx: ServiceContext): Promise<BindingCatalog> {
  return withTenant(ctx, async (tx) => {
    const cmsCollections = (await loadCmsSources(tx)).filter((s) => s.cardinality === 'array');
    return { sources: [...EMAIL_SOURCES, ...cmsCollections] };
  });
}
