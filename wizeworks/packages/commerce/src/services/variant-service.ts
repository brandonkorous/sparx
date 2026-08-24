// variantService — variants are the purchasable SKU. They hang off a
// Product but can be queried independently (storefront PDP, inventory
// adjustments, dropship sync). The option lattice (Color × Size × …)
// lives in ProductOption + ProductOptionValue; a variant's position on
// the lattice is recorded in ProductVariantOptionValue. Per-variant
// imagery is pinned through VariantImage + VariantImageOptionValue.
//
// Phase 1.2 wires the full Prisma surface: list / get / create / update /
// archive / restore / setDefault for variants; setOptions + listOptions
// for the lattice; addImage / removeImage / reorderImages /
// setImageBindings for media.
//
// All writes follow the locked pattern:
//   1. Validate input via @wizeworks/commerce-schemas
//   2. withTenant() transaction with RLS context
//   3. writeAuditLog inside the same transaction
//   4. publishCommerceEvent AFTER commit

import {
  AssignVariantOptionValuesInput,
  CreateVariantImageInput,
  CreateVariantInput,
  RenameVariantSkuInput,
  ReorderProductImagesInput,
  SetProductOptionsInput,
  SetVariantImageBindingsInput,
  UpdateVariantInput,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import { syncProductInStock } from '@wizeworks/inventory';
import type {
  Prisma,
  ProductOption,
  ProductOptionValue,
  ProductVariant,
  VariantImage,
} from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { CommerceConflictError, CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';
import { isInventoryActive } from '../inventory-gate';

// ─── Public shapes ────────────────────────────────────────────────────

export interface OptionValueRow {
  id: string;
  optionId: string;
  value: string;
  swatchHex: string | null;
  swatchImageId: string | null;
  position: number;
}

export interface OptionRow {
  id: string;
  productId: string;
  name: string;
  displayType: string;
  position: number;
  values: OptionValueRow[];
}

export interface VariantImageRow {
  id: string;
  variantId: string | null;
  mediaAssetId: string;
  position: number;
  /** The product's hero image — the thumbnail surfaced in lists, cards, email
   *  product blocks, and search. At most one per product. */
  isPrimary: boolean;
  alt: string | null;
  optionValueIds: string[];
}

export interface VariantRow {
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  title: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  currency: string;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  inventoryPolicy: string;
  requiresShipping: boolean;
  fulfillmentType: string | null;
  dropshipSourceId: string | null;
  isDefault: boolean;
  position: number;
  metadata: Record<string, unknown>;
  /** Set when the price is derived from a markup rule (docs/48); null = manual. */
  markupRuleId: string | null;
  optionValueIds: string[];
  imageCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// ─── Reads ────────────────────────────────────────────────────────────

export async function listOptions(ctx: ServiceContext, productId: string): Promise<OptionRow[]> {
  return withTenant(ctx, async (tx) => {
    const options = await tx.productOption.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
      include: { values: { orderBy: { position: 'asc' } } },
    });
    return options.map(toOptionRow);
  });
}

export async function listForProduct(
  ctx: ServiceContext,
  productId: string,
  args: { includeArchived?: boolean } = {}
): Promise<VariantRow[]> {
  return withTenant(ctx, async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: {
        productId,
        ...(args.includeArchived ? {} : { deletedAt: null }),
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        optionAssignments: { select: { optionValueId: true } },
        _count: { select: { images: true } },
      },
    });
    return variants.map(toVariantRow);
  });
}

export async function get(ctx: ServiceContext, variantId: string): Promise<VariantRow> {
  const variant = await withTenant(ctx, (tx) =>
    tx.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
      include: {
        optionAssignments: { select: { optionValueId: true } },
        _count: { select: { images: true } },
      },
    })
  );
  if (!variant) throw new CommerceNotFoundError('Variant', variantId);
  return toVariantRow(variant);
}

export async function getBySku(ctx: ServiceContext, sku: string): Promise<VariantRow> {
  const variant = await withTenant(ctx, (tx) =>
    tx.productVariant.findFirst({
      where: { sku, deletedAt: null },
      include: {
        optionAssignments: { select: { optionValueId: true } },
        _count: { select: { images: true } },
      },
    })
  );
  if (!variant) throw new CommerceNotFoundError('Variant', sku);
  return toVariantRow(variant);
}

/** Who, if anyone, is already using a product code.
 *
 * Deliberately matches `create`'s collision check EXACTLY, which means it does
 * NOT filter `deletedAt`: the unique index is `(tenantId, sku)` with no deleted
 * column in it, so a retired variant still holds its code and still blocks a new
 * one. A check that skipped deleted rows would answer "free", and the save would
 * then fail on the very constraint this exists to predict.
 */
export interface SkuOwner {
  variantId: string;
  productId: string;
  productTitle: string;
  /** The holder is retired. The code is still taken, but the sentence a person
   *  needs is a different one — they cannot see the product that has it. */
  retired: boolean;
}

export interface SkuCheck {
  /** Null when the code is free. */
  owner: SkuOwner | null;
  /** A code that IS free — the one asked about when nobody holds it, otherwise
   *  the same stem with the next unused number. Always returned, so a caller
   *  never has to ask twice or invent one itself. */
  free: string;
}

/** `WIDGET-3` → stem `WIDGET`, number 3. A code with no trailing number is all
 *  stem, and gets numbered from 1. */
function splitSkuStem(sku: string): { stem: string; n: number } {
  const match = /^(.*?)-(\d+)$/.exec(sku);
  if (!match) return { stem: sku, n: 0 };
  return { stem: match[1]!, n: Number(match[2]) };
}

const SKU_MAX = 127;

/** The first number after every one already in use on this stem. Counts UP from
 *  the highest rather than filling gaps: a code is a label somebody may already
 *  have printed, and reusing a retired product's number is how two boxes in a
 *  stockroom end up saying the same thing. */
function nextFreeSku(stem: string, taken: string[], from: number): string {
  const used = new Set(taken.map((sku) => splitSkuStem(sku)).map((parts) => parts.n));
  let n = Math.max(from, 1);
  while (used.has(n)) n += 1;
  // Keep room for the number, so a long name cannot push the result past the
  // column. Trimming the stem is safe: uniqueness comes from the number.
  const room = SKU_MAX - `-${n}`.length;
  return `${stem.slice(0, room).replace(/-+$/, '')}-${n}`;
}

export async function checkSku(ctx: ServiceContext, sku: string): Promise<SkuCheck> {
  const { stem, n } = splitSkuStem(sku);
  const [holder, siblings] = await withTenant(ctx, (tx) =>
    Promise.all([
      tx.productVariant.findFirst({
        where: { tenantId: ctx.tenantId, sku },
        select: {
          id: true,
          deletedAt: true,
          product: { select: { id: true, title: true, deletedAt: true } },
        },
      }),
      tx.productVariant.findMany({
        where: { tenantId: ctx.tenantId, sku: { startsWith: `${stem}-` } },
        select: { sku: true },
        take: 1000,
      }),
    ])
  );

  const owner: SkuOwner | null = holder
    ? {
        variantId: holder.id,
        productId: holder.product.id,
        productTitle: holder.product.title,
        retired: holder.deletedAt !== null || holder.product.deletedAt !== null,
      }
    : null;

  return {
    owner,
    free: owner
      ? nextFreeSku(
          stem,
          siblings.map((v) => v.sku),
          n + 1
        )
      : sku,
  };
}

export async function listImagesForProduct(
  ctx: ServiceContext,
  productId: string
): Promise<VariantImageRow[]> {
  return withTenant(ctx, async (tx) => {
    const images = await tx.variantImage.findMany({
      where: { productId },
      orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
      include: { optionValueLinks: { select: { optionValueId: true } } },
    });
    return images.map(toImageRow);
  });
}

// ─── Option lattice writes ────────────────────────────────────────────

/**
 * Replace the product's full option lattice. Existing options + values
 * cascade-delete (along with the variant-option-value assignments and
 * variant-image-option-value bindings that referenced them). Variant
 * rows themselves are kept — the merchant rebinds them via
 * `assignOptionValues` once the new lattice is in place.
 *
 * Returns the inserted options + values so the caller (typically the
 * dashboard variants tab) can map its local row identifiers to the new
 * DB ids without a follow-up read.
 */
export async function setOptions(
  ctx: ServiceContext,
  productId: string,
  rawInput: unknown
): Promise<OptionRow[]> {
  const input = SetProductOptionsInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new CommerceNotFoundError('Product', productId);

    // Name uniqueness — the (productId, name) unique constraint would
    // also catch this, but a clean ValidationError beats a Prisma P2002.
    const names = new Set<string>();
    for (const option of input.options) {
      const key = option.name.toLowerCase();
      if (names.has(key)) {
        throw new CommerceValidationError(`Duplicate option name "${option.name}"`, [
          { field: 'options', message: `Option "${option.name}" appears twice` },
        ]);
      }
      names.add(key);

      const seen = new Set<string>();
      for (const value of option.values) {
        const valueKey = value.value.toLowerCase();
        if (seen.has(valueKey)) {
          throw new CommerceValidationError(
            `Duplicate value "${value.value}" in option "${option.name}"`,
            [
              {
                field: `options.${option.name}.values`,
                message: `Value "${value.value}" appears twice`,
              },
            ]
          );
        }
        seen.add(valueKey);
      }
    }

    await tx.productOption.deleteMany({ where: { productId } });

    const created: (ProductOption & { values: ProductOptionValue[] })[] = [];
    for (const [i, option] of input.options.entries()) {
      const optionRow = await tx.productOption.create({
        data: {
          tenantId: ctx.tenantId,
          productId,
          name: option.name,
          displayType: option.displayType,
          position: option.position || i,
        },
      });
      const valueRows: ProductOptionValue[] = [];
      for (const [j, v] of option.values.entries()) {
        valueRows.push(
          await tx.productOptionValue.create({
            data: {
              tenantId: ctx.tenantId,
              optionId: optionRow.id,
              value: v.value,
              swatchHex: v.swatchHex ?? null,
              swatchImageId: v.swatchImageId ?? null,
              position: v.position || j,
            },
          })
        );
      }
      created.push({ ...optionRow, values: valueRows });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.product.options_replaced',
      entityType: 'Product',
      entityId: productId,
      diff: { after: { optionCount: created.length } },
    });

    return created;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'product.updated',
    data: { productId, change: 'options', optionCount: result.length },
  });

  return result.map(toOptionRow);
}

export async function assignOptionValues(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = AssignVariantOptionValuesInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId, deletedAt: null },
      include: { product: { include: { options: true } } },
    });
    if (!variant) throw new CommerceNotFoundError('Variant', input.variantId);

    await validateOptionValueSet(tx, variant.product.id, input.optionValueIds);

    await tx.productVariantOptionValue.deleteMany({
      where: { variantId: input.variantId },
    });
    if (input.optionValueIds.length > 0) {
      await tx.productVariantOptionValue.createMany({
        data: input.optionValueIds.map((optionValueId) => ({
          variantId: input.variantId,
          optionValueId,
        })),
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.options_assigned',
      entityType: 'Variant',
      entityId: input.variantId,
      diff: { after: { optionValueIds: input.optionValueIds } },
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.updated',
    data: { variantId: input.variantId, change: 'optionValues' },
  });
}

// ─── Variant writes ───────────────────────────────────────────────────

export async function create(
  ctx: ServiceContext,
  productId: string,
  rawInput: unknown
): Promise<{ id: string; sku: string }> {
  const input = CreateVariantInput.parse(rawInput);

  // Resolved before the tx (cached lookup): the new variant's product needs its
  // denormalized `inStock` computed at birth, not left at the column default `false`.
  // Without this a just-created product shows "Sold out" on the search-backed PLP until
  // an inventory movement happens — which never comes for a `continue`-policy product or
  // an inventory-off tenant. See syncProductInStock.
  const inventoryActive = await isInventoryActive(ctx.tenantId);

  const result = await withTenant(ctx, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new CommerceNotFoundError('Product', productId);

    const skuCollision = await tx.productVariant.findFirst({
      where: { tenantId: ctx.tenantId, sku: input.sku },
      select: { id: true },
    });
    if (skuCollision) {
      throw new CommerceConflictError(`SKU "${input.sku}" already exists`, 'sku');
    }

    await validateOptionValueSet(tx, productId, input.optionValueIds);

    // If marked default, demote any existing default first so the
    // single-default invariant survives.
    if (input.isDefault) {
      await tx.productVariant.updateMany({
        where: { productId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const variant = await tx.productVariant.create({
      data: {
        tenantId: ctx.tenantId,
        productId,
        sku: input.sku,
        barcode: input.barcode ?? null,
        title: input.title ?? null,
        priceCents: input.priceCents,
        compareAtPriceCents: input.compareAtPriceCents ?? null,
        costCents: input.costCents ?? null,
        currency: input.currency,
        weightGrams: input.weight ?? null,
        lengthMm: input.dimensions?.lengthMm ?? null,
        widthMm: input.dimensions?.widthMm ?? null,
        heightMm: input.dimensions?.heightMm ?? null,
        inventoryPolicy: input.inventoryPolicy,
        requiresShipping: input.requiresShipping,
        fulfillmentType: input.fulfillmentType ?? null,
        dropshipSourceId: input.dropshipSourceId ?? null,
        isDefault: input.isDefault,
        position: input.position,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    if (input.optionValueIds.length > 0) {
      await tx.productVariantOptionValue.createMany({
        data: input.optionValueIds.map((optionValueId) => ({
          variantId: variant.id,
          optionValueId,
        })),
      });
    }

    await refreshProductPriceRange(tx, productId);
    await syncProductInStock(tx, variant.id, inventoryActive);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.created',
      entityType: 'Variant',
      entityId: variant.id,
      diff: { before: null, after: serializeVariant(variant) },
    });

    return variant;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.created',
    data: { variantId: result.id, productId, sku: result.sku },
  });

  return { id: result.id, sku: result.sku };
}

export async function update(
  ctx: ServiceContext,
  variantId: string,
  rawInput: unknown
): Promise<void> {
  const input = UpdateVariantInput.parse(rawInput);

  let prevCostCents: number | null = null;
  let costChanged = false;

  // Resolved before the tx: a policy change to/from `deny` flips whether a zero-stock
  // product is sellable, and only syncProductInStock refreshes the denormalized flag —
  // otherwise "keep selling when out of stock" leaves the product stuck at "Sold out".
  const inventoryActive = await isInventoryActive(ctx.tenantId);

  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });
    if (!before) throw new CommerceNotFoundError('Variant', variantId);

    if (input.isDefault === true && !before.isDefault) {
      await tx.productVariant.updateMany({
        where: { productId: before.productId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: {
        ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
        ...(input.compareAtPriceCents !== undefined
          ? { compareAtPriceCents: input.compareAtPriceCents }
          : {}),
        ...(input.costCents !== undefined ? { costCents: input.costCents } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.weight !== undefined ? { weightGrams: input.weight } : {}),
        ...(input.dimensions !== undefined
          ? {
              lengthMm: input.dimensions?.lengthMm ?? null,
              widthMm: input.dimensions?.widthMm ?? null,
              heightMm: input.dimensions?.heightMm ?? null,
            }
          : {}),
        ...(input.inventoryPolicy !== undefined ? { inventoryPolicy: input.inventoryPolicy } : {}),
        ...(input.requiresShipping !== undefined
          ? { requiresShipping: input.requiresShipping }
          : {}),
        ...(input.fulfillmentType !== undefined ? { fulfillmentType: input.fulfillmentType } : {}),
        ...(input.dropshipSourceId !== undefined
          ? { dropshipSourceId: input.dropshipSourceId }
          : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });

    if (input.priceCents !== undefined) {
      await refreshProductPriceRange(tx, before.productId);
    }

    // inventoryPolicy governs sellability (deny ↔ continue/preorder), so recompute the
    // denormalized inStock whenever an update TOUCHES it — not only when the value
    // differs. Firing on every policy-bearing patch is idempotent + cheap (one recompute)
    // and, unlike a strict change-guard, lets a stale flag be repaired by simply re-setting
    // the same policy (e.g. products created before this sync existed).
    if (input.inventoryPolicy !== undefined) {
      await syncProductInStock(tx, variantId, inventoryActive);
    }

    if (input.costCents !== undefined && before.costCents !== updated.costCents) {
      costChanged = true;
      prevCostCents = before.costCents;
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.updated',
      entityType: 'Variant',
      entityId: updated.id,
      diff: { before: serializeVariant(before), after: serializeVariant(updated) },
    });

    return updated;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.updated',
    data: { variantId: result.id, productId: result.productId },
  });

  // A cost move re-derives the price for any rule bound to this variant on the
  // variant_cost basis (docs/48 §8). Emitted as its own event so the markup-
  // recompute-worker subscribes narrowly instead of filtering every variant.updated.
  if (costChanged) {
    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'variant.cost.updated',
      data: {
        variantId: result.id,
        productId: result.productId,
        basis: 'variant_cost',
        prevCostCents,
        newCostCents: result.costCents,
      },
    });
  }
}

export async function renameSku(
  ctx: ServiceContext,
  variantId: string,
  rawInput: unknown
): Promise<void> {
  const input = RenameVariantSkuInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const before = await tx.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });
    if (!before) throw new CommerceNotFoundError('Variant', variantId);
    if (before.sku === input.sku) return;

    const collision = await tx.productVariant.findFirst({
      where: {
        tenantId: ctx.tenantId,
        sku: input.sku,
        NOT: { id: variantId },
      },
      select: { id: true },
    });
    if (collision) {
      throw new CommerceConflictError(`SKU "${input.sku}" already exists`, 'sku');
    }

    await tx.productVariant.update({
      where: { id: variantId },
      data: { sku: input.sku },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.sku_renamed',
      entityType: 'Variant',
      entityId: variantId,
      diff: { before: { sku: before.sku }, after: { sku: input.sku } },
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.updated',
    data: { variantId, change: 'sku' },
  });
}

export async function setDefault(ctx: ServiceContext, variantId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });
    if (!variant) throw new CommerceNotFoundError('Variant', variantId);
    if (variant.isDefault) return;

    await tx.productVariant.updateMany({
      where: { productId: variant.productId, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
    await tx.productVariant.update({
      where: { id: variantId },
      data: { isDefault: true },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.set_default',
      entityType: 'Variant',
      entityId: variantId,
      diff: { after: { isDefault: true } },
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.updated',
    data: { variantId, change: 'isDefault' },
  });
}

export async function archive(ctx: ServiceContext, variantId: string): Promise<void> {
  await transitionDeletedAt(ctx, variantId, new Date(), 'commerce.variant.archived');
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.deleted',
    data: { variantId },
  });
}

export async function restore(ctx: ServiceContext, variantId: string): Promise<void> {
  await transitionDeletedAt(ctx, variantId, null, 'commerce.variant.restored');
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.updated',
    data: { variantId, change: 'restored' },
  });
}

// ─── Image writes ─────────────────────────────────────────────────────

export async function addImage(ctx: ServiceContext, rawInput: unknown): Promise<{ id: string }> {
  const input = CreateVariantImageInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new CommerceNotFoundError('Product', input.productId);

    if (input.variantId) {
      const variant = await tx.productVariant.findFirst({
        where: { id: input.variantId, productId: input.productId, deletedAt: null },
        select: { id: true },
      });
      if (!variant) throw new CommerceNotFoundError('Variant', input.variantId);
    }

    if (input.optionValueIds.length > 0) {
      await validateOptionValueSet(tx, input.productId, input.optionValueIds, {
        strictSpanning: false,
      });
    }

    const image = await tx.variantImage.create({
      data: {
        tenantId: ctx.tenantId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        mediaAssetId: input.mediaAssetId,
        position: input.position,
        alt: input.alt ?? null,
      },
    });

    if (input.optionValueIds.length > 0) {
      await tx.variantImageOptionValue.createMany({
        data: input.optionValueIds.map((optionValueId) => ({
          variantImageId: image.id,
          optionValueId,
        })),
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.image_added',
      entityType: 'VariantImage',
      entityId: image.id,
      diff: {
        after: {
          productId: image.productId,
          variantId: image.variantId,
          mediaAssetId: image.mediaAssetId,
          optionValueIds: input.optionValueIds,
        },
      },
    });

    return image;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.updated',
    data: {
      variantImageId: result.id,
      productId: result.productId,
      variantId: result.variantId,
    },
  });

  return { id: result.id };
}

export async function setImageBindings(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = SetVariantImageBindingsInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const image = await tx.variantImage.findFirst({
      where: { id: input.variantImageId },
      select: { id: true, productId: true },
    });
    if (!image) throw new CommerceNotFoundError('VariantImage', input.variantImageId);

    // A non-null variant binding must point at a live variant of this product.
    if (input.variantId) {
      const variant = await tx.productVariant.findFirst({
        where: { id: input.variantId, productId: image.productId, deletedAt: null },
        select: { id: true },
      });
      if (!variant) throw new CommerceNotFoundError('Variant', input.variantId);
    }

    if (input.optionValueIds.length > 0) {
      await validateOptionValueSet(tx, image.productId, input.optionValueIds, {
        strictSpanning: false,
      });
    }

    // `variant_id` is authoritative on the row — set it (or clear to product-
    // level). The storefront gallery prefers a variant's own images first.
    await tx.variantImage.update({
      where: { id: input.variantImageId },
      // `alt` is patch-style (undefined leaves it, null clears it), so it is
      // only included when the caller actually sent it.
      data: {
        variantId: input.variantId,
        ...(input.alt !== undefined ? { alt: input.alt } : {}),
      },
    });

    await tx.variantImageOptionValue.deleteMany({
      where: { variantImageId: input.variantImageId },
    });
    if (input.optionValueIds.length > 0) {
      await tx.variantImageOptionValue.createMany({
        data: input.optionValueIds.map((optionValueId) => ({
          variantImageId: input.variantImageId,
          optionValueId,
        })),
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.image_bindings_set',
      entityType: 'VariantImage',
      entityId: input.variantImageId,
      diff: {
        after: {
          variantId: input.variantId,
          optionValueIds: input.optionValueIds,
          ...(input.alt !== undefined ? { alt: input.alt } : {}),
        },
      },
    });

    return { productId: image.productId };
  });

  // Bindings decide which photos a PDP shows — bust the storefront read cache.
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.updated',
    data: {
      variantImageId: input.variantImageId,
      productId: result.productId,
      variantId: input.variantId,
    },
  });
}

export async function removeImage(ctx: ServiceContext, variantImageId: string): Promise<void> {
  const result = await withTenant(ctx, async (tx) => {
    const image = await tx.variantImage.findFirst({
      where: { id: variantImageId },
      select: { id: true, productId: true, variantId: true, mediaAssetId: true },
    });
    if (!image) throw new CommerceNotFoundError('VariantImage', variantImageId);

    await tx.variantImage.delete({ where: { id: variantImageId } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.image_removed',
      entityType: 'VariantImage',
      entityId: variantImageId,
      diff: {
        before: { mediaAssetId: image.mediaAssetId, variantId: image.variantId },
      },
    });
    return image;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.updated',
    data: { productId: result.productId, variantId: result.variantId, change: 'image_removed' },
  });
}

// Designate one image as the product's PRIMARY (hero). Clears the product's
// current primary and sets this one within a single transaction so the partial
// unique index (one primary per product) never sees two at once. A no-op if the
// image is already primary. Emits product.updated so the search projection
// re-stamps image_url to match.
export async function setPrimaryImage(ctx: ServiceContext, variantImageId: string): Promise<void> {
  const result = await withTenant(ctx, async (tx) => {
    const image = await tx.variantImage.findFirst({
      where: { id: variantImageId },
      select: { id: true, productId: true, isPrimary: true },
    });
    if (!image) throw new CommerceNotFoundError('VariantImage', variantImageId);
    if (image.isPrimary) return image; // already the hero — nothing to do

    await tx.variantImage.updateMany({
      where: { productId: image.productId, isPrimary: true },
      data: { isPrimary: false },
    });
    await tx.variantImage.update({
      where: { id: variantImageId },
      data: { isPrimary: true },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.image_primary_set',
      entityType: 'VariantImage',
      entityId: variantImageId,
      diff: { after: { productId: image.productId, isPrimary: true } },
    });
    return image;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'product.updated',
    data: { productId: result.productId, change: 'primary_image' },
  });
}

/**
 * Set the gallery order for a product's images.
 *
 * `position` was previously write-once at `addImage` time, so a merchant could
 * pick which photo came first (`setPrimaryImage`) but never say what came
 * second — the back-office had no way to write the order the storefront reads.
 *
 * Takes the FULL ordered id list and rewrites every position to its index, so
 * the result is always a dense 0..n-1 sequence with no ties to break. Every id
 * must belong to this product: a partial list would silently leave the omitted
 * images stacked on whatever positions they held, which is how a gallery ends
 * up with three photos all claiming slot 0.
 */
export async function reorderImages(
  ctx: ServiceContext,
  productId: string,
  rawInput: unknown
): Promise<void> {
  const input = ReorderProductImagesInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const existing = await tx.variantImage.findMany({
      where: { productId },
      select: { id: true },
    });
    if (existing.length === 0) throw new CommerceNotFoundError('Product images', productId);

    const owned = new Set(existing.map((image) => image.id));
    const seen = new Set<string>();
    for (const id of input.imageIds) {
      if (!owned.has(id)) throw new CommerceNotFoundError('VariantImage', id);
      if (seen.has(id)) {
        throw new CommerceValidationError('An image was listed twice in the new order', [
          { field: 'imageIds', message: `Image ${id} appears more than once` },
        ]);
      }
      seen.add(id);
    }
    if (seen.size !== owned.size) {
      throw new CommerceValidationError(
        'The new order must list every image on this product exactly once',
        [
          {
            field: 'imageIds',
            message: `Expected ${String(owned.size)} images, received ${String(seen.size)}`,
          },
        ]
      );
    }

    await Promise.all(
      input.imageIds.map((id, index) =>
        tx.variantImage.update({ where: { id }, data: { position: index } })
      )
    );

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.images_reordered',
      entityType: 'Product',
      entityId: productId,
      diff: { after: { imageIds: input.imageIds } },
    });
  });

  // Gallery order is part of the PDP payload — bust the storefront read cache.
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'product.updated',
    data: { productId, change: 'image_order' },
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────

type VariantWithIncludes = ProductVariant & {
  optionAssignments: { optionValueId: string }[];
  _count: { images: number };
};

type ImageWithIncludes = VariantImage & {
  optionValueLinks: { optionValueId: string }[];
};

function toOptionRow(o: ProductOption & { values: ProductOptionValue[] }): OptionRow {
  return {
    id: o.id,
    productId: o.productId,
    name: o.name,
    displayType: o.displayType,
    position: o.position,
    values: o.values.map((v) => ({
      id: v.id,
      optionId: v.optionId,
      value: v.value,
      swatchHex: v.swatchHex,
      swatchImageId: v.swatchImageId,
      position: v.position,
    })),
  };
}

function toVariantRow(v: VariantWithIncludes): VariantRow {
  return {
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    barcode: v.barcode,
    title: v.title,
    priceCents: v.priceCents,
    compareAtPriceCents: v.compareAtPriceCents,
    costCents: v.costCents,
    currency: v.currency,
    weightGrams: v.weightGrams,
    lengthMm: v.lengthMm,
    widthMm: v.widthMm,
    heightMm: v.heightMm,
    inventoryPolicy: v.inventoryPolicy,
    requiresShipping: v.requiresShipping,
    fulfillmentType: v.fulfillmentType,
    dropshipSourceId: v.dropshipSourceId,
    isDefault: v.isDefault,
    position: v.position,
    metadata: (v.metadata ?? {}) as Record<string, unknown>,
    markupRuleId: v.markupRuleId,
    optionValueIds: v.optionAssignments.map((oa) => oa.optionValueId),
    imageCount: v._count.images,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    deletedAt: v.deletedAt?.toISOString() ?? null,
  };
}

function toImageRow(i: ImageWithIncludes): VariantImageRow {
  return {
    id: i.id,
    variantId: i.variantId,
    mediaAssetId: i.mediaAssetId,
    position: i.position,
    isPrimary: i.isPrimary,
    alt: i.alt,
    optionValueIds: i.optionValueLinks.map((l) => l.optionValueId),
  };
}

function serializeVariant(v: ProductVariant): Record<string, unknown> {
  return {
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    title: v.title,
    priceCents: v.priceCents,
    compareAtPriceCents: v.compareAtPriceCents,
    costCents: v.costCents,
    currency: v.currency,
    inventoryPolicy: v.inventoryPolicy,
    requiresShipping: v.requiresShipping,
    isDefault: v.isDefault,
    position: v.position,
    dropshipSourceId: v.dropshipSourceId,
    deletedAt: v.deletedAt?.toISOString() ?? null,
  };
}

/**
 * Verify that every supplied optionValueId belongs to the product, and
 * (when `strictSpanning` is true) that the set covers every option
 * exactly once — the lattice invariant for a purchasable variant.
 */
async function validateOptionValueSet(
  tx: Prisma.TransactionClient,
  productId: string,
  optionValueIds: string[],
  { strictSpanning = true }: { strictSpanning?: boolean } = {}
): Promise<void> {
  if (optionValueIds.length === 0) {
    if (strictSpanning) {
      const options = await tx.productOption.findMany({
        where: { productId },
        select: { id: true },
      });
      if (options.length > 0) {
        throw new CommerceValidationError(
          'Variant must reference every product option',
          options.map((o) => ({ field: 'optionValueIds', message: `Missing option ${o.id}` }))
        );
      }
    }
    return;
  }

  const values = await tx.productOptionValue.findMany({
    where: { id: { in: optionValueIds }, option: { productId } },
    select: { id: true, optionId: true },
  });
  if (values.length !== optionValueIds.length) {
    const found = new Set(values.map((v) => v.id));
    const missing = optionValueIds.filter((id) => !found.has(id));
    throw new CommerceValidationError('Unknown option-value id(s)', [
      { field: 'optionValueIds', message: `Not part of product: ${missing.join(', ')}` },
    ]);
  }

  const byOption = new Map<string, number>();
  for (const v of values) {
    byOption.set(v.optionId, (byOption.get(v.optionId) ?? 0) + 1);
  }
  for (const count of byOption.values()) {
    if (count > 1) {
      throw new CommerceValidationError('Variant cannot reference two values from the same option');
    }
  }

  if (strictSpanning) {
    const productOptions = await tx.productOption.findMany({
      where: { productId },
      select: { id: true },
    });
    if (productOptions.length !== byOption.size) {
      const missing = productOptions.filter((o) => !byOption.has(o.id)).map((o) => o.id);
      throw new CommerceValidationError(
        'Variant does not cover every product option',
        missing.map((id) => ({ field: 'optionValueIds', message: `Missing option ${id}` }))
      );
    }
  }
}

async function refreshProductPriceRange(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<void> {
  const range = await tx.productVariant.aggregate({
    where: { productId, deletedAt: null },
    _min: { priceCents: true },
    _max: { priceCents: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      priceMinCents: range._min.priceCents ?? null,
      priceMaxCents: range._max.priceCents ?? null,
    },
  });
}

async function transitionDeletedAt(
  ctx: ServiceContext,
  variantId: string,
  deletedAt: Date | null,
  auditAction: string
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.productVariant.findFirst({ where: { id: variantId } });
    if (!before) throw new CommerceNotFoundError('Variant', variantId);
    if (
      (deletedAt === null && before.deletedAt === null) ||
      (deletedAt !== null && before.deletedAt !== null)
    ) {
      return;
    }

    await tx.productVariant.update({
      where: { id: variantId },
      data: { deletedAt, ...(deletedAt !== null ? { isDefault: false } : {}) },
    });

    await refreshProductPriceRange(tx, before.productId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: auditAction,
      entityType: 'Variant',
      entityId: variantId,
      diff: {
        before: { deletedAt: before.deletedAt?.toISOString() ?? null },
        after: { deletedAt: deletedAt?.toISOString() ?? null },
      },
    });
  });
}
