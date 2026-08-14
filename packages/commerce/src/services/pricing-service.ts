// pricingService — the single deterministic price-resolution engine.
//
// Resolution order is locked:
//   1. Contract price (B2B) — highest priority
//   1.5. B2B pricing tier (account overrides > tier overrides > tier
//        discount > account flat discount, via resolve_b2b_price() SQL)
//   2. Price list entry (channel + segment + B2B-targeted)
//   3. Bulk price tier (quantity ramp)
//   4. Variant base price (fallback)
// Discounts, gift cards, and account credit stack on top via the discount
// + gift card services — never inline here.
//
// Every resolution produces a `trace` array so the storefront can answer
// "why is this the price?" without recomputing.
//
// All writes follow the locked pattern:
//   1. Validate input via @sparx/commerce-schemas
//   2. withTenant() transaction with RLS context
//   3. writeAuditLog inside the same transaction

import {
  BulkSetPriceListEntriesInput,
  CreateBulkPriceTierInput,
  CreateContractPriceInput,
  CreatePriceListInput,
  PriceListEntryInput,
  PriceResolutionRequest,
  type PricedLine,
  type PriceTraceStep,
  UpdatePriceListInput,
} from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { Prisma, PriceList, TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { CommerceConflictError, CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';

// ─── Price lists ──────────────────────────────────────────────────────

export interface PriceListRow {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  channel: string | null;
  customerSegmentId: string | null;
  companyId: string | null;
  collectionId: string | null;
  priority: number;
  validFrom: string | null;
  validTo: string | null;
  status: string;
  entryCount: number;
  /** Model B: the sites this list prices on. EMPTY = every site. */
  propertyIds: string[];
  updatedAt: string;
}

export async function listPriceLists(
  ctx: ServiceContext,
  filter: {
    status?: string;
    channel?: string;
    companyId?: string;
    q?: string;
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: PriceListRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.PriceListWhereInput = {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.channel ? { channel: filter.channel } : {}),
      ...(filter.companyId ? { companyId: filter.companyId } : {}),
      // Free-text search over the operator-facing fields (name + description),
      // case-insensitive — mirrors the discount list's `q` handling.
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: 'insensitive' } },
              { description: { contains: filter.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      tx.priceList.findMany({
        where,
        include: {
          _count: { select: { entries: true } },
          propertyLinks: { select: { propertyId: true } },
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.priceList.count({ where }),
    ]);
    return { items: rows.map(serializePriceList), total };
  });
}

export async function getPriceList(ctx: ServiceContext, id: string): Promise<PriceListRow> {
  const row = await withTenant(ctx, (tx) =>
    tx.priceList.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { entries: true } },
        propertyLinks: { select: { propertyId: true } },
      },
    })
  );
  if (!row) throw new CommerceNotFoundError('PriceList', id);
  return serializePriceList(row);
}

export async function createPriceList(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreatePriceListInput.parse(rawInput);
  if (input.customerSegmentId && input.companyId) {
    throw new CommerceValidationError(
      'Set at most one of customerSegmentId or companyId; not both'
    );
  }
  const result = await withTenant(ctx, async (tx) => {
    const created = await tx.priceList.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        description: input.description ?? null,
        currency: input.currency,
        channel: input.channel ?? null,
        customerSegmentId: input.customerSegmentId ?? null,
        companyId: input.companyId ?? null,
        priority: input.priority,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
        status: input.status,
      },
    });

    // Model B per-site scoping (docs/131 §4): no rows = prices on every site.
    if (input.propertyIds.length > 0) {
      await tx.priceListProperty.createMany({
        data: input.propertyIds.map((propertyId) => ({ propertyId, priceListId: created.id })),
        skipDuplicates: true,
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.price_list.created',
      entityType: 'PriceList',
      entityId: created.id,
      diff: { after: { name: created.name, currency: created.currency, status: created.status } },
    });
    return created;
  });
  return { id: result.id };
}

export async function updatePriceList(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<void> {
  const input = UpdatePriceListInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const before = await tx.priceList.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new CommerceNotFoundError('PriceList', id);

    const nextCustomerSegmentId =
      input.customerSegmentId !== undefined ? input.customerSegmentId : before.customerSegmentId;
    const nextB2bAccountId = input.companyId !== undefined ? input.companyId : before.companyId;
    if (nextCustomerSegmentId && nextB2bAccountId) {
      throw new CommerceValidationError(
        'Set at most one of customerSegmentId or companyId; not both'
      );
    }

    await tx.priceList.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.channel !== undefined ? { channel: input.channel } : {}),
        ...(input.customerSegmentId !== undefined
          ? { customerSegmentId: nextCustomerSegmentId }
          : {}),
        ...(input.companyId !== undefined ? { companyId: nextB2bAccountId } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.validFrom !== undefined
          ? { validFrom: input.validFrom ? new Date(input.validFrom) : null }
          : {}),
        ...(input.validTo !== undefined
          ? { validTo: input.validTo ? new Date(input.validTo) : null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });

    // Model B: the update sends the FULL replacement set — replace when present,
    // leave untouched when omitted.
    if (input.propertyIds !== undefined) {
      await tx.priceListProperty.deleteMany({ where: { priceListId: id } });
      if (input.propertyIds.length > 0) {
        await tx.priceListProperty.createMany({
          data: input.propertyIds.map((propertyId) => ({ propertyId, priceListId: id })),
        });
      }
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.price_list.updated',
      entityType: 'PriceList',
      entityId: id,
      diff: { before: { status: before.status }, after: { status: input.status ?? before.status } },
    });
  });
}

export async function archivePriceList(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.priceList.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new CommerceNotFoundError('PriceList', id);
    await tx.priceList.update({
      where: { id },
      data: { status: 'archived', deletedAt: new Date() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.price_list.archived',
      entityType: 'PriceList',
      entityId: id,
      diff: { before: { status: before.status } },
    });
  });
}

// ─── Price list entries ──────────────────────────────────────────────

export interface PriceListEntryRow {
  id: string;
  variantId: string;
  variantSku: string;
  productTitle: string;
  fixedPriceCents: number | null;
  percentOffList: number | null;
  minQuantity: number;
  maxQuantity: number | null;
}

export async function listEntries(
  ctx: ServiceContext,
  priceListId: string
): Promise<PriceListEntryRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.priceListEntry.findMany({
      where: { priceListId },
      include: {
        variant: {
          select: { sku: true, product: { select: { title: true } } },
        },
      },
      orderBy: [{ variant: { sku: 'asc' } }, { minQuantity: 'asc' }],
      take: 1000,
    });
    return rows.map((r) => ({
      id: r.id,
      variantId: r.variantId,
      variantSku: r.variant.sku,
      productTitle: r.variant.product.title,
      fixedPriceCents: r.fixedPriceCents,
      percentOffList: r.percentOffList,
      minQuantity: r.minQuantity,
      maxQuantity: r.maxQuantity,
    }));
  });
}

/**
 * Every price-list entry that touches ONE product, across ALL its lists —
 * the inverse of `listEntries` (which is scoped to one list).
 *
 * This is the Product → Pricing tab view: "which trade price lists is this
 * product on, and at what price per variant?". Reading it by looping
 * `listEntries` over every price list is the N+1 the workbench data layer
 * forbids, so it is answered in one indexed query (`@@index([tenantId,
 * variantId])` on the entry, joined up to its product) instead.
 *
 * Each row carries enough context to NAME its list without a second read:
 * the list's id, name, currency and status travel with the entry. Soft-deleted
 * (archived) lists are excluded, matching `listPriceLists` / `listEntries`.
 */
export interface ProductPriceListEntryRow {
  id: string;
  priceListId: string;
  priceListName: string;
  priceListStatus: string;
  currency: string;
  variantId: string;
  variantSku: string;
  fixedPriceCents: number | null;
  percentOffList: number | null;
  minQuantity: number;
  maxQuantity: number | null;
}

export async function listEntriesForProduct(
  ctx: ServiceContext,
  productId: string
): Promise<ProductPriceListEntryRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.priceListEntry.findMany({
      where: {
        variant: { productId },
        priceList: { deletedAt: null },
      },
      include: {
        priceList: { select: { name: true, currency: true, status: true, priority: true } },
        variant: { select: { sku: true } },
      },
      orderBy: [
        { priceList: { priority: 'desc' } },
        { variant: { sku: 'asc' } },
        { minQuantity: 'asc' },
      ],
      take: 1000,
    });
    return rows.map((r) => ({
      id: r.id,
      priceListId: r.priceListId,
      priceListName: r.priceList.name,
      priceListStatus: r.priceList.status,
      currency: r.priceList.currency,
      variantId: r.variantId,
      variantSku: r.variant.sku,
      fixedPriceCents: r.fixedPriceCents,
      percentOffList: r.percentOffList,
      minQuantity: r.minQuantity,
      maxQuantity: r.maxQuantity,
    }));
  });
}

export async function setPriceListEntry(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = PriceListEntryInput.parse(rawInput);
  const result = await withTenant(ctx, async (tx) => {
    await ensurePriceListExists(tx, input.priceListId);

    // Upsert on the (priceListId, variantId, minQuantity) compound unique.
    const existing = await tx.priceListEntry.findFirst({
      where: {
        priceListId: input.priceListId,
        variantId: input.variantId,
        minQuantity: input.minQuantity,
      },
      select: { id: true },
    });

    if (existing) {
      const updated = await tx.priceListEntry.update({
        where: { id: existing.id },
        data: {
          fixedPriceCents: input.fixedPriceCents ?? null,
          percentOffList: input.percentOffList ?? null,
          maxQuantity: input.maxQuantity ?? null,
        },
      });
      return updated;
    }

    const created = await tx.priceListEntry.create({
      data: {
        tenantId: ctx.tenantId,
        priceListId: input.priceListId,
        variantId: input.variantId,
        fixedPriceCents: input.fixedPriceCents ?? null,
        percentOffList: input.percentOffList ?? null,
        minQuantity: input.minQuantity,
        maxQuantity: input.maxQuantity ?? null,
      },
    });
    return created;
  });
  return { id: result.id };
}

export async function bulkSetEntries(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ written: number }> {
  const input = BulkSetPriceListEntriesInput.parse(rawInput);
  for (const entry of input.entries) {
    if ((entry.fixedPriceCents == null) === (entry.percentOffList == null)) {
      throw new CommerceValidationError(
        'Each entry must set exactly one of fixedPriceCents or percentOffList'
      );
    }
  }

  let written = 0;
  await withTenant(ctx, async (tx) => {
    await ensurePriceListExists(tx, input.priceListId);
    for (const entry of input.entries) {
      const existing = await tx.priceListEntry.findFirst({
        where: {
          priceListId: input.priceListId,
          variantId: entry.variantId,
          minQuantity: entry.minQuantity,
        },
        select: { id: true },
      });
      if (existing) {
        await tx.priceListEntry.update({
          where: { id: existing.id },
          data: {
            fixedPriceCents: entry.fixedPriceCents ?? null,
            percentOffList: entry.percentOffList ?? null,
            maxQuantity: entry.maxQuantity ?? null,
          },
        });
      } else {
        await tx.priceListEntry.create({
          data: {
            tenantId: ctx.tenantId,
            priceListId: input.priceListId,
            variantId: entry.variantId,
            fixedPriceCents: entry.fixedPriceCents ?? null,
            percentOffList: entry.percentOffList ?? null,
            minQuantity: entry.minQuantity,
            maxQuantity: entry.maxQuantity ?? null,
          },
        });
      }
      written += 1;
    }
  });
  return { written };
}

export async function deletePriceListEntry(ctx: ServiceContext, entryId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.priceListEntry.findFirst({ where: { id: entryId } });
    if (!before) throw new CommerceNotFoundError('PriceListEntry', entryId);
    await tx.priceListEntry.delete({ where: { id: entryId } });
  });
}

// ─── Bulk price tiers ────────────────────────────────────────────────

export interface BulkPriceTierRow {
  id: string;
  variantId: string | null;
  priceListId: string | null;
  minQuantity: number;
  unitPriceCents: number;
}

export async function createBulkTier(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateBulkPriceTierInput.parse(rawInput);
  const result = await withTenant(ctx, async (tx) => {
    if (input.variantId) await ensureVariantExists(tx, input.variantId);
    if (input.priceListId) await ensurePriceListExists(tx, input.priceListId);

    const created = await tx.bulkPriceTier.create({
      data: {
        tenantId: ctx.tenantId,
        variantId: input.variantId ?? null,
        priceListId: input.priceListId ?? null,
        minQuantity: input.minQuantity,
        unitPriceCents: input.unitPriceCents,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.bulk_tier.created',
      entityType: 'BulkPriceTier',
      entityId: created.id,
      diff: {
        after: {
          variantId: created.variantId,
          priceListId: created.priceListId,
          minQuantity: created.minQuantity,
          unitPriceCents: created.unitPriceCents,
        },
      },
    });
    return created;
  });
  return { id: result.id };
}

export async function listBulkTiers(
  ctx: ServiceContext,
  filter: { variantId?: string; priceListId?: string; productId?: string } = {}
): Promise<BulkPriceTierRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.bulkPriceTier.findMany({
      where: {
        ...(filter.variantId ? { variantId: filter.variantId } : {}),
        ...(filter.priceListId ? { priceListId: filter.priceListId } : {}),
        // All variant-scoped tiers for a product (the Product → Pricing tab view).
        ...(filter.productId ? { variant: { productId: filter.productId } } : {}),
      },
      orderBy: { minQuantity: 'asc' },
      take: 500,
    });
    return rows.map((r) => ({
      id: r.id,
      variantId: r.variantId,
      priceListId: r.priceListId,
      minQuantity: r.minQuantity,
      unitPriceCents: r.unitPriceCents,
    }));
  });
}

export async function deleteBulkTier(ctx: ServiceContext, tierId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.bulkPriceTier.findFirst({ where: { id: tierId } });
    if (!before) throw new CommerceNotFoundError('BulkPriceTier', tierId);
    await tx.bulkPriceTier.delete({ where: { id: tierId } });
  });
}

// ─── Contract prices ─────────────────────────────────────────────────

export interface ContractPriceRow {
  id: string;
  companyId: string;
  variantId: string;
  variantSku: string;
  productTitle: string;
  priceCents: number;
  validFrom: string;
  validTo: string | null;
  notes: string | null;
}

export async function createContractPrice(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateContractPriceInput.parse(rawInput);
  const result = await withTenant(ctx, async (tx) => {
    await ensureVariantExists(tx, input.variantId);

    const collision = await tx.contractPrice.findFirst({
      where: {
        companyId: input.companyId,
        variantId: input.variantId,
        validFrom: new Date(input.validFrom),
      },
      select: { id: true },
    });
    if (collision) {
      throw new CommerceConflictError(
        'Contract price for this account/variant/start already exists'
      );
    }

    const created = await tx.contractPrice.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: input.companyId,
        variantId: input.variantId,
        priceCents: input.priceCents,
        validFrom: new Date(input.validFrom),
        validTo: input.validTo ? new Date(input.validTo) : null,
        signedAgreementMediaId: input.signedAgreementMediaId ?? null,
        notes: input.notes ?? null,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.contract_price.created',
      entityType: 'ContractPrice',
      entityId: created.id,
      diff: {
        after: {
          companyId: created.companyId,
          variantId: created.variantId,
          priceCents: created.priceCents,
        },
      },
    });
    return created;
  });
  return { id: result.id };
}

export async function listContractPricesForAccount(
  ctx: ServiceContext,
  companyId: string
): Promise<ContractPriceRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.contractPrice.findMany({
      where: { companyId },
      include: {
        variant: { select: { sku: true, product: { select: { title: true } } } },
      },
      orderBy: { validFrom: 'desc' },
      take: 500,
    });
    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      variantId: r.variantId,
      variantSku: r.variant.sku,
      productTitle: r.variant.product.title,
      priceCents: r.priceCents,
      validFrom: r.validFrom.toISOString(),
      validTo: r.validTo?.toISOString() ?? null,
      notes: r.notes,
    }));
  });
}

export async function deleteContractPrice(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.contractPrice.findFirst({ where: { id } });
    if (!before) throw new CommerceNotFoundError('ContractPrice', id);
    await tx.contractPrice.delete({ where: { id } });
  });
}

// ─── B2B membership ──────────────────────────────────────────────────

/**
 * True B2B pricing/payment eligibility requires more than a customer's
 * primary-account pointer (`Customer.companyId`) — it requires an ACTIVE
 * `B2bAccountContact` row on record (packages/db/prisma/schema/62-b2b-contacts.
 * prisma). Without this check, deactivating a contact (an employee who left,
 * an account put on hold) would silently leave their wholesale pricing and
 * net-terms eligibility intact forever, since nothing else re-validates the
 * pointer. Callers (cart, checkout, the storefront PDP) should resolve
 * through this rather than trusting `Customer.companyId` directly.
 */
export async function resolveActiveB2bAccountId(
  tx: TxClient,
  customerId: string | undefined,
  primaryAccountId: string | null | undefined
): Promise<string | undefined> {
  if (!customerId || !primaryAccountId) return undefined;
  const active = await tx.b2bAccountContact.findFirst({
    where: { customerId, accountId: primaryAccountId, isActive: true },
    select: { id: true },
  });
  return active ? primaryAccountId : undefined;
}

// ─── Price resolution ────────────────────────────────────────────────

/**
 * Resolve a single line. Walks the locked priority chain and returns a
 * fully-traced PricedLine. The cart pricing pipeline calls this for
 * every line; storefront PDP uses it for "your price" display when the
 * shopper is a known B2B account.
 */
export async function resolve(ctx: ServiceContext, rawInput: unknown): Promise<PricedLine> {
  const input = PriceResolutionRequest.parse(rawInput);
  const asOf = input.asOf ? new Date(input.asOf) : new Date();

  return withTenant(ctx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId, deletedAt: null },
      select: { id: true, priceCents: true, currency: true },
    });
    if (!variant) throw new CommerceNotFoundError('Variant', input.variantId);
    if (variant.currency !== input.currency) {
      throw new CommerceValidationError(
        `Currency mismatch: variant is ${variant.currency}, request is ${input.currency}`
      );
    }

    const trace: PriceTraceStep[] = [];
    let unitPriceCents = variant.priceCents;
    trace.push({
      source: 'variant_base',
      sourceId: variant.id,
      deltaCents: variant.priceCents,
      resultingUnitPriceCents: unitPriceCents,
    });

    // 1. Contract price (B2B-only, highest priority)
    if (input.companyId) {
      const contract = await tx.contractPrice.findFirst({
        where: {
          companyId: input.companyId,
          variantId: input.variantId,
          validFrom: { lte: asOf },
          OR: [{ validTo: null }, { validTo: { gte: asOf } }],
        },
        orderBy: { validFrom: 'desc' },
      });
      if (contract) {
        const delta = contract.priceCents - unitPriceCents;
        unitPriceCents = contract.priceCents;
        trace.push({
          source: 'contract_price',
          sourceId: contract.id,
          deltaCents: delta,
          resultingUnitPriceCents: unitPriceCents,
          note: 'B2B contract price',
        });
        return finishLine(input, unitPriceCents, trace);
      }
    }

    // 1.5. B2B pricing tier — the account's assigned tier (+ its own
    // account-level and tier-level product/collection overrides, and any
    // flat account discount stacked on top). This is a parallel, older B2B
    // pricing primitive from the account's `pricingTierId` (distinct from
    // ContractPrice above) whose full waterfall already lives in the
    // `resolve_b2b_price()` SQL function (docs/10, docs/64 Ph1) — it was
    // never actually called from here, so a merchant could configure a
    // tier discount, assign it to an account, and see it saved in the
    // dashboard while every real storefront/checkout price stayed at list.
    // Only applied when it beats the running price, same as bulk_tier below.
    if (input.companyId) {
      const [row] = await tx.$queryRaw<{ price: number | null }[]>`
        SELECT resolve_b2b_price(${input.variantId}::uuid, ${input.companyId}::uuid) AS price
      `;
      if (row?.price != null && row.price < unitPriceCents) {
        const delta = row.price - unitPriceCents;
        unitPriceCents = row.price;
        trace.push({
          source: 'b2b_pricing_tier',
          sourceId: input.companyId,
          deltaCents: delta,
          resultingUnitPriceCents: unitPriceCents,
          note: 'B2B account pricing tier',
        });
      }
    }

    // 2. Price list — highest-priority eligible list that has an entry
    // for this variant + quantity tier.
    const priceList = await pickEligiblePriceList(tx, {
      channel: input.channel,
      currency: input.currency,
      customerSegmentIds: input.customerSegmentIds,
      companyId: input.companyId,
      propertyId: input.propertyId,
      asOf,
    });
    if (priceList) {
      const entry = await tx.priceListEntry.findFirst({
        where: {
          priceListId: priceList.id,
          variantId: input.variantId,
          minQuantity: { lte: input.quantity },
          OR: [{ maxQuantity: null }, { maxQuantity: { gte: input.quantity } }],
        },
        orderBy: { minQuantity: 'desc' },
      });
      if (entry) {
        const proposed =
          entry.fixedPriceCents ??
          Math.round(unitPriceCents * (1 - (entry.percentOffList ?? 0) / 100));
        const delta = proposed - unitPriceCents;
        unitPriceCents = proposed;
        trace.push({
          source: 'price_list',
          sourceId: entry.id,
          deltaCents: delta,
          resultingUnitPriceCents: unitPriceCents,
          note: priceList.name,
        });
      }
    }

    // 3. Bulk tier — variant-scoped overrides list-scoped. Only applies
    // when it beats the current price (a list might already be lower).
    const variantTier = await tx.bulkPriceTier.findFirst({
      where: { variantId: input.variantId, minQuantity: { lte: input.quantity } },
      orderBy: { minQuantity: 'desc' },
    });
    const listTier = priceList
      ? await tx.bulkPriceTier.findFirst({
          where: { priceListId: priceList.id, minQuantity: { lte: input.quantity } },
          orderBy: { minQuantity: 'desc' },
        })
      : null;
    const bulkTier = variantTier ?? listTier;
    if (bulkTier && bulkTier.unitPriceCents < unitPriceCents) {
      const delta = bulkTier.unitPriceCents - unitPriceCents;
      unitPriceCents = bulkTier.unitPriceCents;
      trace.push({
        source: 'bulk_tier',
        sourceId: bulkTier.id,
        deltaCents: delta,
        resultingUnitPriceCents: unitPriceCents,
        note: `${bulkTier.minQuantity}+ at unit price`,
      });
    }

    return finishLine(input, unitPriceCents, trace);
  });
}

function finishLine(
  input: PriceResolutionRequest,
  unitPriceCents: number,
  trace: PriceTraceStep[]
): PricedLine {
  return {
    variantId: input.variantId,
    quantity: input.quantity,
    currency: input.currency,
    unitPriceCents,
    subtotalCents: unitPriceCents * input.quantity,
    trace,
  };
}

/**
 * Convenience for the cart pipeline — resolve every line in one
 * round-trip per line. Sequential rather than parallel because the
 * typical cart is small (<20 lines) and each call already issues 2-4
 * indexed queries; running them concurrently saturates the Postgres
 * pool faster than it speeds up the response.
 */
export async function resolveCart(
  ctx: ServiceContext,
  input: {
    channel: 'storefront' | 'b2b_portal' | 'admin' | 'subscription';
    currency: string;
    customerId?: string;
    companyId?: string;
    customerSegmentIds?: string[];
    /** The site the cart is on (docs/131 §4), threaded to every line's price. */
    propertyId?: string;
    lines: { variantId: string; quantity: number }[];
  }
): Promise<PricedLine[]> {
  const out: PricedLine[] = [];
  for (const line of input.lines) {
    out.push(
      await resolve(ctx, {
        ...line,
        channel: input.channel,
        currency: input.currency,
        customerId: input.customerId,
        companyId: input.companyId,
        customerSegmentIds: input.customerSegmentIds ?? [],
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      })
    );
  }
  return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function pickEligiblePriceList(
  tx: TxClient,
  filter: {
    channel: string;
    currency: string;
    customerSegmentIds: string[];
    companyId?: string;
    /** The site this price is for (docs/131 §4). A list is eligible when it has no
     *  site links (all sites) OR is linked to this one. Undefined = no site filter
     *  (admin/preview). */
    propertyId?: string;
    asOf: Date;
  }
): Promise<PriceList | null> {
  return tx.priceList.findFirst({
    where: {
      status: 'active',
      currency: filter.currency,
      deletedAt: null,
      AND: [
        { OR: [{ channel: null }, { channel: filter.channel }] },
        { OR: [{ validFrom: null }, { validFrom: { lte: filter.asOf } }] },
        { OR: [{ validTo: null }, { validTo: { gte: filter.asOf } }] },
        {
          OR: [
            ...(filter.companyId ? [{ companyId: filter.companyId }] : []),
            ...(filter.customerSegmentIds.length > 0
              ? [{ customerSegmentId: { in: filter.customerSegmentIds } }]
              : []),
            { customerSegmentId: null, companyId: null },
          ],
        },
        // Site scoping (docs/131 §4): empty links = every site, else only this site.
        ...(filter.propertyId
          ? [
              {
                OR: [
                  { propertyLinks: { none: {} } },
                  { propertyLinks: { some: { propertyId: filter.propertyId } } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
  });
}

async function ensurePriceListExists(tx: TxClient, id: string): Promise<void> {
  const row = await tx.priceList.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new CommerceNotFoundError('PriceList', id);
}

async function ensureVariantExists(tx: TxClient, id: string): Promise<void> {
  const row = await tx.productVariant.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new CommerceNotFoundError('Variant', id);
}

function serializePriceList(
  row: PriceList & {
    _count: { entries: number };
    propertyLinks?: { propertyId: string }[];
  }
): PriceListRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    currency: row.currency,
    channel: row.channel,
    customerSegmentId: row.customerSegmentId,
    companyId: row.companyId,
    collectionId: row.collectionId,
    priority: row.priority,
    validFrom: row.validFrom?.toISOString() ?? null,
    validTo: row.validTo?.toISOString() ?? null,
    status: row.status,
    entryCount: row._count.entries,
    propertyIds: row.propertyLinks?.map((l) => l.propertyId) ?? [],
    updatedAt: row.updatedAt.toISOString(),
  };
}
