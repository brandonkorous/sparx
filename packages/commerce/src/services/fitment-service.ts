// fitmentService — generalized "what this product fits" reference data +
// per-product applicability. One model serves every catalog whose
// products are filtered by what they're compatible with: vehicles,
// pets, devices, apparel, industrial gear.
//
// Everything here is tenant-scoped — there is NO platform-global fitment
// domain. The platform ships a LIBRARY of installable dictionaries
// (@sparx/commerce-schemas FITMENT_DICTIONARIES); installFitmentDictionary
// stamps a chosen dictionary as the tenant's own domain → category → item →
// variant tree. The single stamping codepath (planFitmentDictionaryRows) is
// shared with the demo seed, so an installed tree and a seeded tree are
// identical. All four reference tables carry the standard tenant_id NOT NULL +
// FORCE RLS posture (20260923000000_fitment_remove_global_vehicle).

import { randomUUID } from 'node:crypto';

import {
  BulkAssignFitmentInput,
  CreateFitmentCategoryInput,
  CreateFitmentDomainInput,
  CreateFitmentItemInput,
  CreateFitmentVariantInput,
  FitmentLookupQuery,
  getFitmentDictionary,
  InstallFitmentDictionaryParams,
  listFitmentDictionarySummaries,
  planFitmentDictionaryRows,
  ProductFitmentInput,
} from '@sparx/commerce-schemas';
import type { FitmentDictionarySummary } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type {
  FitmentCategory,
  FitmentItem,
  FitmentVariant,
  Prisma,
  ProductFitment,
} from '@sparx/db';

import { writeAuditLog } from '../audit';
import { CommerceConflictError, CommerceNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';

// ─── Public shapes ────────────────────────────────────────────────────

export interface FitmentDomainRow {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  iconKey: string | null;
  labels: {
    l1: string;
    l2?: string;
    l3?: string;
    range?: string;
  };
  rangeUnit: string | null;
  position: number;
  categoryCount: number;
}

export interface FitmentCategoryRow {
  id: string;
  domainId: string;
  name: string;
  slug: string;
  attributes: Record<string, unknown>;
  iconMediaId: string | null;
  position: number;
  itemCount: number;
}

export interface FitmentItemRow {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  attributes: Record<string, unknown>;
  position: number;
  variantCount: number;
}

export interface FitmentVariantRow {
  id: string;
  itemId: string;
  name: string;
  slug: string;
  attributes: Record<string, unknown>;
  position: number;
}

export interface ProductFitmentRow {
  id: string;
  productId: string;
  domainId: string;
  domainSlug: string;
  categoryId: string;
  categoryName: string;
  itemId: string | null;
  itemName: string | null;
  variantId: string | null;
  variantName: string | null;
  rangeMin: number | null;
  rangeMax: number | null;
  notes: string | null;
}

// ─── Domain reads + writes ────────────────────────────────────────────

export async function listDomains(ctx: ServiceContext): Promise<FitmentDomainRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.fitmentDomain.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: 'asc' }, { displayName: 'asc' }],
      include: { _count: { select: { categories: true } } },
    });
    return rows.map((d) => ({
      id: d.id,
      slug: d.slug,
      displayName: d.displayName,
      description: d.description,
      iconKey: d.iconKey,
      labels: (d.labels ?? {}) as FitmentDomainRow['labels'],
      rangeUnit: d.rangeUnit,
      position: d.position,
      categoryCount: d._count.categories,
    }));
  });
}

export async function getDomain(
  ctx: ServiceContext,
  domainId: string
): Promise<FitmentDomainRow | null> {
  return withTenant(ctx, async (tx) => {
    const d = await tx.fitmentDomain.findFirst({
      where: { id: domainId, deletedAt: null },
      include: { _count: { select: { categories: true } } },
    });
    if (!d) return null;
    return {
      id: d.id,
      slug: d.slug,
      displayName: d.displayName,
      description: d.description,
      iconKey: d.iconKey,
      labels: (d.labels ?? {}) as FitmentDomainRow['labels'],
      rangeUnit: d.rangeUnit,
      position: d.position,
      categoryCount: d._count.categories,
    };
  });
}

export async function createDomain(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateFitmentDomainInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const collision = await tx.fitmentDomain.findFirst({
      where: { tenantId: ctx.tenantId, slug: input.slug, deletedAt: null },
      select: { id: true },
    });
    if (collision) {
      throw new CommerceConflictError(
        `Fitment domain "${input.slug}" already exists for this tenant`,
        'slug'
      );
    }

    const created = await tx.fitmentDomain.create({
      data: {
        tenantId: ctx.tenantId,
        slug: input.slug,
        displayName: input.displayName,
        description: input.description ?? null,
        iconKey: input.iconKey ?? null,
        labels: input.labels,
        rangeUnit: input.rangeUnit ?? null,
        position: input.position,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.domain_created',
      entityType: 'FitmentDomain',
      entityId: created.id,
      diff: { after: { slug: created.slug, displayName: created.displayName } },
    });

    return created;
  });

  return { id: result.id };
}

// ─── Dictionary library (install a platform fitment dictionary) ───────

/**
 * The platform's installable fitment dictionaries (Vehicle, Apparel, Pet, …) —
 * picker metadata only, no DB. A tenant installs one as their own tenant-scoped
 * tree via installFitmentDictionary.
 */
export function listFitmentDictionaries(): FitmentDictionarySummary[] {
  return listFitmentDictionarySummaries();
}

/**
 * Stamp a platform dictionary as a tenant-scoped domain → category → item →
 * variant tree. Conflict is by slug: installing a dictionary whose slug the
 * tenant already uses is a 409, so the merchant chooses whether to extend the
 * existing domain or pick a different dictionary. The stamping codepath
 * (planFitmentDictionaryRows) is shared with the demo seed.
 */
export async function installFitmentDictionary(
  ctx: ServiceContext,
  rawSlug: unknown
): Promise<{ id: string }> {
  const { slug } = InstallFitmentDictionaryParams.parse({ slug: rawSlug });
  const dict = getFitmentDictionary(slug);
  if (!dict) throw new CommerceNotFoundError('FitmentDictionary', slug);

  return withTenant(ctx, async (tx) => {
    const collision = await tx.fitmentDomain.findFirst({
      where: { tenantId: ctx.tenantId, slug: dict.slug, deletedAt: null },
      select: { id: true },
    });
    if (collision) {
      throw new CommerceConflictError(
        `Fitment domain "${dict.slug}" already exists for this tenant`,
        'slug'
      );
    }

    const planned = planFitmentDictionaryRows(dict, ctx.tenantId, () => randomUUID());

    await tx.fitmentDomain.create({
      data: {
        id: planned.domain.id,
        tenantId: planned.domain.tenantId,
        slug: planned.domain.slug,
        displayName: planned.domain.displayName,
        description: planned.domain.description,
        iconKey: planned.domain.iconKey,
        labels: planned.domain.labels as Prisma.InputJsonValue,
        rangeUnit: planned.domain.rangeUnit,
        position: planned.domain.position,
      },
    });
    if (planned.categories.length > 0) {
      await tx.fitmentCategory.createMany({
        data: planned.categories.map((c) => ({
          id: c.id,
          tenantId: c.tenantId,
          domainId: c.domainId,
          name: c.name,
          slug: c.slug,
          attributes: c.attributes as Prisma.InputJsonValue,
          position: c.position,
        })),
      });
    }
    if (planned.items.length > 0) {
      await tx.fitmentItem.createMany({
        data: planned.items.map((i) => ({
          id: i.id,
          tenantId: i.tenantId,
          categoryId: i.categoryId,
          name: i.name,
          slug: i.slug,
          attributes: i.attributes as Prisma.InputJsonValue,
          position: i.position,
        })),
      });
    }
    if (planned.variants.length > 0) {
      await tx.fitmentVariant.createMany({
        data: planned.variants.map((v) => ({
          id: v.id,
          tenantId: v.tenantId,
          itemId: v.itemId,
          name: v.name,
          slug: v.slug,
          attributes: v.attributes as Prisma.InputJsonValue,
          position: v.position,
        })),
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.dictionary_installed',
      entityType: 'FitmentDomain',
      entityId: planned.domain.id,
      diff: {
        after: {
          dictionary: dict.slug,
          displayName: dict.name,
          categories: planned.categories.length,
          items: planned.items.length,
          variants: planned.variants.length,
        },
      },
    });

    return { id: planned.domain.id };
  });
}

// ─── Category (L1) ────────────────────────────────────────────────────

export async function listCategories(
  ctx: ServiceContext,
  domainId: string
): Promise<FitmentCategoryRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.fitmentCategory.findMany({
      where: { domainId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
    return rows.map(toCategoryRow);
  });
}

export async function createCategory(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateFitmentCategoryInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const domain = await tx.fitmentDomain.findFirst({
      where: { id: input.domainId, deletedAt: null },
      select: { id: true },
    });
    if (!domain) throw new CommerceNotFoundError('FitmentDomain', input.domainId);

    const collision = await tx.fitmentCategory.findFirst({
      where: { domainId: input.domainId, slug: input.slug, deletedAt: null },
      select: { id: true },
    });
    if (collision) {
      throw new CommerceConflictError(
        `Category "${input.slug}" already exists under this domain`,
        'slug'
      );
    }

    const created = await tx.fitmentCategory.create({
      data: {
        tenantId: ctx.tenantId,
        domainId: input.domainId,
        name: input.name,
        slug: input.slug,
        attributes: input.attributes as Prisma.InputJsonValue,
        iconMediaId: input.iconMediaId ?? null,
        position: input.position,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.category_created',
      entityType: 'FitmentCategory',
      entityId: created.id,
      diff: { after: { name: created.name, domainId: created.domainId } },
    });

    return created;
  });

  return { id: result.id };
}

// ─── Item (L2) ────────────────────────────────────────────────────────

export async function listItems(
  ctx: ServiceContext,
  categoryId: string
): Promise<FitmentItemRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.fitmentItem.findMany({
      where: { categoryId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { variants: true } } },
    });
    return rows.map(toItemRow);
  });
}

export async function createItem(ctx: ServiceContext, rawInput: unknown): Promise<{ id: string }> {
  const input = CreateFitmentItemInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const category = await tx.fitmentCategory.findFirst({
      where: { id: input.categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new CommerceNotFoundError('FitmentCategory', input.categoryId);

    const collision = await tx.fitmentItem.findFirst({
      where: { categoryId: input.categoryId, slug: input.slug, deletedAt: null },
      select: { id: true },
    });
    if (collision) {
      throw new CommerceConflictError(
        `Item "${input.slug}" already exists under this category`,
        'slug'
      );
    }

    const created = await tx.fitmentItem.create({
      data: {
        tenantId: ctx.tenantId,
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        attributes: input.attributes as Prisma.InputJsonValue,
        position: input.position,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.item_created',
      entityType: 'FitmentItem',
      entityId: created.id,
      diff: { after: { name: created.name, categoryId: created.categoryId } },
    });

    return created;
  });

  return { id: result.id };
}

// ─── Variant (L3) ─────────────────────────────────────────────────────

export async function listVariants(
  ctx: ServiceContext,
  itemId: string
): Promise<FitmentVariantRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.fitmentVariant.findMany({
      where: { itemId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toVariantRow);
  });
}

export async function createVariant(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateFitmentVariantInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const item = await tx.fitmentItem.findFirst({
      where: { id: input.itemId, deletedAt: null },
      select: { id: true },
    });
    if (!item) throw new CommerceNotFoundError('FitmentItem', input.itemId);

    const collision = await tx.fitmentVariant.findFirst({
      where: { itemId: input.itemId, slug: input.slug, deletedAt: null },
      select: { id: true },
    });
    if (collision) {
      throw new CommerceConflictError(
        `Variant "${input.slug}" already exists under this item`,
        'slug'
      );
    }

    const created = await tx.fitmentVariant.create({
      data: {
        tenantId: ctx.tenantId,
        itemId: input.itemId,
        name: input.name,
        slug: input.slug,
        attributes: input.attributes as Prisma.InputJsonValue,
        position: input.position,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.variant_created',
      entityType: 'FitmentVariant',
      entityId: created.id,
      diff: { after: { name: created.name, itemId: created.itemId } },
    });

    return created;
  });

  return { id: result.id };
}

// ─── Per-product fitment ──────────────────────────────────────────────

export async function listForProduct(
  ctx: ServiceContext,
  productId: string
): Promise<ProductFitmentRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.productFitment.findMany({
      where: { productId },
      orderBy: [{ rangeMin: 'asc' }, { id: 'asc' }],
      include: {
        domain: { select: { slug: true } },
        category: { select: { name: true } },
        item: { select: { name: true } },
        variant: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      domainId: r.domainId,
      domainSlug: r.domain.slug,
      categoryId: r.categoryId,
      categoryName: r.category.name,
      itemId: r.itemId,
      itemName: r.item?.name ?? null,
      variantId: r.variantId,
      variantName: r.variant?.name ?? null,
      rangeMin: r.rangeMin === null ? null : Number(r.rangeMin),
      rangeMax: r.rangeMax === null ? null : Number(r.rangeMax),
      notes: r.notes,
    }));
  });
}

/**
 * Replace all fitment rows for a product. Atomic: existing rows wiped
 * inside the same transaction the new rows insert in, so the catalog
 * never observes a half-written state.
 */
export async function setForProduct(
  ctx: ServiceContext,
  productId: string,
  fitments: Omit<ProductFitmentInput, 'productId'>[]
): Promise<void> {
  const validated = fitments.map((f) => ProductFitmentInput.omit({ productId: true }).parse(f));

  await withTenant(ctx, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new CommerceNotFoundError('Product', productId);

    await tx.productFitment.deleteMany({ where: { productId } });
    if (validated.length > 0) {
      await tx.productFitment.createMany({
        data: validated.map((f) => ({
          tenantId: ctx.tenantId,
          productId,
          domainId: f.domainId,
          categoryId: f.categoryId,
          itemId: f.itemId ?? null,
          variantId: f.variantId ?? null,
          rangeMin: f.rangeMin ?? null,
          rangeMax: f.rangeMax ?? null,
          notes: f.notes ?? null,
        })),
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.product_set',
      entityType: 'Product',
      entityId: productId,
      diff: { after: { fitmentCount: validated.length } },
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'product.updated',
    data: { productId, change: 'fitment' },
  });
}

/**
 * Bulk-apply the same fitment set to a batch of products. Used by
 * catalog importers (AAIA, supplier feed, merchant CSV) that slice the
 * feed into "this set of products fits these things" buckets and fan
 * out one call per bucket.
 */
export async function bulkAssign(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ rowsAffected: number }> {
  const input = BulkAssignFitmentInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const existingProductCount = await tx.product.count({
      where: { id: { in: input.productIds }, deletedAt: null },
    });
    if (existingProductCount !== input.productIds.length) {
      throw new CommerceNotFoundError(
        'Product',
        `${input.productIds.length - existingProductCount} of ${input.productIds.length}`
      );
    }

    let rowsAffected = 0;
    for (const productId of input.productIds) {
      await tx.productFitment.deleteMany({ where: { productId } });
      if (input.fitments.length > 0) {
        const inserted = await tx.productFitment.createMany({
          data: input.fitments.map((f) => ({
            tenantId: ctx.tenantId,
            productId,
            domainId: f.domainId,
            categoryId: f.categoryId,
            itemId: f.itemId ?? null,
            variantId: f.variantId ?? null,
            rangeMin: f.rangeMin ?? null,
            rangeMax: f.rangeMax ?? null,
            notes: f.notes ?? null,
          })),
        });
        rowsAffected += inserted.count;
      }
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action: 'commerce.fitment.bulk_assigned',
        entityType: 'Product',
        entityId: productId,
        diff: { after: { fitmentCount: input.fitments.length } },
      });
    }

    return { rowsAffected };
  });

  await Promise.all(
    input.productIds.map((productId) =>
      publishCommerceEvent({
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        topic: 'product.updated',
        data: { productId, change: 'fitment' },
      })
    )
  );

  return result;
}

export async function deleteFitment(ctx: ServiceContext, fitmentId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.productFitment.findFirst({ where: { id: fitmentId } });
    if (!before) throw new CommerceNotFoundError('ProductFitment', fitmentId);

    await tx.productFitment.delete({ where: { id: fitmentId } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.row_deleted',
      entityType: 'ProductFitment',
      entityId: fitmentId,
      diff: { before: serializeFitment(before) },
    });

    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'product.updated',
      data: { productId: before.productId, change: 'fitment' },
    });
  });
}

// ─── Catalog filter ───────────────────────────────────────────────────

export interface FitmentLookupResult {
  productIds: string[];
  total: number;
}

/**
 * Resolve "what fits this thing?" — returns the set of product IDs that
 * have at least one fitment row matching the query. Optional narrowing
 * cascades: category → item → variant → range. `rangeValue` matches
 * when the fitment's [rangeMin, rangeMax] window (or open ends) contains
 * the queried value. Units are domain-defined (year, lb, kg, ...).
 *
 * Runs as a single SQL JOIN for the dashboard "show me everything"
 * case. Storefront search filtering goes through Typesense once the
 * indexer lands.
 */
export async function lookup(ctx: ServiceContext, rawQuery: unknown): Promise<FitmentLookupResult> {
  const query = FitmentLookupQuery.parse(rawQuery);

  return withTenant(ctx, async (tx) => {
    const where: Prisma.ProductFitmentWhereInput = {
      ...(query.domainId ? { domainId: query.domainId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.itemId ? { OR: [{ itemId: query.itemId }, { itemId: null }] } : {}),
      ...(query.variantId ? { OR: [{ variantId: query.variantId }, { variantId: null }] } : {}),
      ...(query.rangeValue !== undefined
        ? {
            AND: [
              { OR: [{ rangeMin: { lte: query.rangeValue } }, { rangeMin: null }] },
              { OR: [{ rangeMax: { gte: query.rangeValue } }, { rangeMax: null }] },
            ],
          }
        : {}),
      product: { deletedAt: null, status: 'active' },
    };

    const rows = await tx.productFitment.findMany({
      where,
      select: { productId: true },
      distinct: ['productId'],
      take: 5000,
    });

    return { productIds: rows.map((r) => r.productId), total: rows.length };
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────

function toCategoryRow(c: FitmentCategory & { _count: { items: number } }): FitmentCategoryRow {
  return {
    id: c.id,
    domainId: c.domainId,
    name: c.name,
    slug: c.slug,
    attributes: (c.attributes ?? {}) as Record<string, unknown>,
    iconMediaId: c.iconMediaId,
    position: c.position,
    itemCount: c._count.items,
  };
}

function toItemRow(i: FitmentItem & { _count: { variants: number } }): FitmentItemRow {
  return {
    id: i.id,
    categoryId: i.categoryId,
    name: i.name,
    slug: i.slug,
    attributes: (i.attributes ?? {}) as Record<string, unknown>,
    position: i.position,
    variantCount: i._count.variants,
  };
}

function toVariantRow(v: FitmentVariant): FitmentVariantRow {
  return {
    id: v.id,
    itemId: v.itemId,
    name: v.name,
    slug: v.slug,
    attributes: (v.attributes ?? {}) as Record<string, unknown>,
    position: v.position,
  };
}

function serializeFitment(f: ProductFitment): Record<string, unknown> {
  return {
    id: f.id,
    productId: f.productId,
    domainId: f.domainId,
    categoryId: f.categoryId,
    itemId: f.itemId,
    variantId: f.variantId,
    rangeMin: f.rangeMin === null ? null : Number(f.rangeMin),
    rangeMax: f.rangeMax === null ? null : Number(f.rangeMax),
  };
}
