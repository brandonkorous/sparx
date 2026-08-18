// bindingService — the Builder binding schema (docs/43, the keystone).
//
// Composes what a surface can bind to: the tenant's REAL CMS content types
// (read-only cross-module introspection — the builder must know what types
// exist to offer them as sources) plus the code-defined domain sources. The
// CMS→source mapping is the pure `mapCmsContentType` in @wizeworks/builder-schemas;
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
  SCHEDULING_SOURCES,
  commerceCategorySource,
  mapCmsContentType,
  mapProductType,
  type BindingCatalog,
  type CmsFieldLike,
  type DataSource,
} from '@wizeworks/builder-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';

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

/** The tenant's product collections → parameterized `commerce.category.<handle>`
 *  sources (docs/122), so the configurable Products block can bind a repeat to a
 *  specific category from the studio picker. Same cross-module introspection pattern
 *  as `loadCmsSources` — the builder reads what the tenant has to offer it as a
 *  source. Soft-deleted collections are excluded; ordered by name for a stable picker. */
async function loadCommerceCategorySources(tx: Prisma.TransactionClient): Promise<DataSource[]> {
  const rows = await tx.productCollection.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: { handle: true, name: true },
  });
  return rows.map((r) => commerceCategorySource(r.handle, r.name));
}

/** A product type → its type-scoped product sources (docs/143 §6.10), or null when the
 *  key resolves to nothing. Mirrors `loadCmsSources` — the builder reads the tenant's
 *  real product type so a page scoped to it can bind that type's attributes. Tenant fork
 *  wins over built-in (isBuiltIn ASC). */
async function loadProductTypeSources(
  tx: Prisma.TransactionClient,
  productTypeKey: string
): Promise<DataSource[] | null> {
  const row = await tx.productType.findFirst({
    where: { key: productTypeKey },
    orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
    select: { key: true, name: true, pluralName: true, attributeSchema: true },
  });
  if (!row) return null;
  const fields = (row.attributeSchema as { fields?: CmsFieldLike[] } | null)?.fields ?? [];
  return mapProductType({
    key: row.key,
    name: row.name,
    pluralName: row.pluralName,
    attributeSchema: { fields },
  });
}

/** The PAGE binding catalog — CMS content types + Commerce/CRM domain sources, plus
 *  one `commerce.category.<handle>` source per tenant product collection.
 *
 *  `productTypeKey` (docs/143 Option B) scopes the catalog to a product page's target
 *  TYPE: the generic `commerce.product` / `product` sources are swapped for the type's,
 *  so the picker offers `commerce.product.attributes.<key>` for that type's fields —
 *  exactly like a CMS `cms.<type>` template's picker shows its content type's fields. */
export function getSchema(
  ctx: ServiceContext,
  opts: { productTypeKey?: string } = {}
): Promise<BindingCatalog> {
  return withTenant(ctx, async (tx) => {
    // Sequential (not Promise.all): the reads share one interactive tx, which
    // serializes queries — concurrent use on the same client is unsupported.
    const cmsSources = await loadCmsSources(tx);
    const categorySources = await loadCommerceCategorySources(tx);
    let commerce: DataSource[] = COMMERCE_SOURCES;
    if (opts.productTypeKey) {
      const typeSources = await loadProductTypeSources(tx, opts.productTypeKey);
      if (typeSources) {
        // Replace the generic product/commerce.product sources with the type-scoped ones
        // (same keys), keeping the rest of COMMERCE_SOURCES (collections, categories, rails).
        const swapped = new Set(typeSources.map((s) => s.key));
        commerce = [...typeSources, ...COMMERCE_SOURCES.filter((s) => !swapped.has(s.key))];
      }
    }
    return {
      sources: [
        ...cmsSources,
        ...commerce,
        ...categorySources,
        ...CRM_SOURCES,
        ...SCHEDULING_SOURCES,
      ],
    };
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
