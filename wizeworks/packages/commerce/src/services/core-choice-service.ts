// A core charge sold as a CHOICE, turned into a real one (sparx persona issue 057).
//
// A store with no core deposit fakes it with two versions of every rebuilt part:
// a dearer "ship now" one and a cheaper "send the old part first" one. That is one
// part on one shelf sold as two, so its stock splits in two, and the dearer price
// is a deposit nobody can give back. This finds every such product and, once the
// owner has looked at each, makes it one version with a real deposit, still
// letting the buyer send the old part first when the store offered that.
//
//   listCandidates  every product whose choices read as a core charge, with what
//                   a buyer pays today on each side and what it would become
//   convert         merge the two sides into one version, product by product
//
// The deposit is read from the WORDS ("add $150 core charge"), never from the
// price difference: on Gillett Diesel's 84, the dearer side matched its own
// words on almost none, and on 15 the "ship now" side was the CHEAPER one. The
// owner reviews every row before anything changes, and can change both figures.

import {
  ConvertCoreChoicesInput,
  coreChoiceSide,
  depositInLabel,
  isCoreOptionName,
  type CoreChoiceCandidate,
  type CoreChoiceConversion,
  type CoreChoiceSide,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma, TxClient } from '@wizeworks/db';
import { syncProductInStock } from '@wizeworks/inventory';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';
import { isInventoryActive } from '../inventory-gate';
import { NOT_BOUGHT_YET, repriceCart } from './cart-service';
import { rememberCoordinates } from './lattice-memory';

const PRODUCT_SELECT = {
  id: true,
  title: true,
  options: {
    select: {
      id: true,
      name: true,
      values: { select: { id: true, value: true } },
    },
    orderBy: { position: 'asc' },
  },
  variants: {
    where: { deletedAt: null },
    select: {
      id: true,
      sku: true,
      priceCents: true,
      currency: true,
      position: true,
      isDefault: true,
      coreChargeCents: true,
      optionAssignments: { select: { optionValueId: true } },
    },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.ProductSelect;

// Read from the model, never written by hand: a hand-written row type behind a
// cast let `optionValues` (no such relation) through typecheck, and the screen
// failed the first time a real database answered.
type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

type Variant = ProductRow['variants'][number];

/** One combination of the product's OTHER choices: its two sides. */
interface Group {
  deposit: Variant;
  first: Variant;
  kept: Variant;
  retired: Variant;
}

interface Plan {
  candidate: CoreChoiceCandidate;
  optionId: string | null;
  groups: Group[];
}

/**
 * The version that stays is the one with the plain code. An import that met one
 * code on two versions kept it on one and lengthened the other ("0986435621" and
 * "0986435621-DEFER-CORE-CHARGE"), so the shorter code is the one his labels,
 * his supplier and his shelf know.
 */
function pickKept(a: Variant, b: Variant): Variant {
  if (a.sku.length !== b.sku.length) return a.sku.length < b.sku.length ? a : b;
  if (a.isDefault !== b.isDefault) return a.isDefault ? a : b;
  return a.position <= b.position ? a : b;
}

function planFor(product: ProductRow): Plan | null {
  const coreOptions = product.options.filter((option) => isCoreOptionName(option.name));
  if (coreOptions.length === 0) return null;

  const base = {
    productId: product.id,
    title: product.title,
    optionName: coreOptions[0]!.name,
    depositLabel: '',
    firstLabel: '',
    keptVariantId: '',
    keptSku: '',
    retiredVariantIds: [] as string[],
    groups: 0,
    depositSidePriceCents: 0,
    firstSidePriceCents: 0,
    suggestedPartPriceCents: 0,
    suggestedCoreChargeCents: null as number | null,
    currency: product.variants[0]?.currency ?? 'USD',
  };
  const refuse = (problem: string): Plan => ({
    candidate: { ...base, problem },
    optionId: coreOptions[0]!.id,
    groups: [],
  });

  if (coreOptions.length > 1) {
    return refuse(
      `It has ${String(coreOptions.length)} choices about the core (${coreOptions.map((o) => o.name).join(', ')}). Change it by hand.`
    );
  }
  const option = coreOptions[0]!;
  const sides = new Map<string, CoreChoiceSide | null>(
    option.values.map((value) => [value.id, coreChoiceSide(value.value)])
  );
  const depositValues = option.values.filter((v) => sides.get(v.id) === 'deposit');
  const firstValues = option.values.filter((v) => sides.get(v.id) === 'first');
  if (depositValues.length !== 1 || firstValues.length !== 1 || option.values.length !== 2) {
    return refuse(
      `Its choices (${option.values.map((v) => `“${v.value}”`).join(', ')}) are not one “ship now” and one “old part first”. Change it by hand.`
    );
  }
  const depositValue = depositValues[0]!;
  const firstValue = firstValues[0]!;
  base.depositLabel = depositValue.value;
  base.firstLabel = firstValue.value;
  base.suggestedCoreChargeCents = depositInLabel(depositValue.value);

  // Group the versions by everything EXCEPT the core choice.
  const coreValueIds = new Set(option.values.map((v) => v.id));
  const byRest = new Map<string, { deposit: Variant[]; first: Variant[] }>();
  for (const variant of product.variants) {
    const ids = variant.optionAssignments.map((ov) => ov.optionValueId);
    const rest = ids
      .filter((id) => !coreValueIds.has(id))
      .sort()
      .join('|');
    const entry = byRest.get(rest) ?? { deposit: [], first: [] };
    if (ids.includes(depositValue.id)) entry.deposit.push(variant);
    else if (ids.includes(firstValue.id)) entry.first.push(variant);
    else {
      return refuse(
        `Version ${variant.sku} has no core choice of its own. Give it one on the Variants tab, or change it by hand.`
      );
    }
    byRest.set(rest, entry);
  }

  const groups: Group[] = [];
  for (const entry of byRest.values()) {
    if (entry.deposit.length !== 1 || entry.first.length !== 1) {
      return refuse(
        'Not every version has exactly one “ship now” and one “old part first” side. Change it by hand.'
      );
    }
    const deposit = entry.deposit[0]!;
    const first = entry.first[0]!;
    const kept = pickKept(deposit, first);
    groups.push({ deposit, first, kept, retired: kept.id === deposit.id ? first : deposit });
  }
  const lead = groups[0]!;
  base.groups = groups.length;
  base.keptVariantId = lead.kept.id;
  base.keptSku = lead.kept.sku;
  base.retiredVariantIds = groups.map((g) => g.retired.id);
  base.depositSidePriceCents = lead.deposit.priceCents;
  base.firstSidePriceCents = lead.first.priceCents;
  base.suggestedPartPriceCents = lead.first.priceCents;

  return { candidate: { ...base, problem: null }, optionId: option.id, groups };
}

/** Stock still on a version that would stop being sold: it must be counted onto
 *  the one that stays first, or the units would vanish from every screen. */
async function stockOnRetired(
  tx: TxClient,
  variantIds: string[]
): Promise<{ sku: string; units: number } | null> {
  if (variantIds.length === 0) return null;
  const levels = await tx.inventoryLevel.findMany({
    where: { variantId: { in: variantIds }, OR: [{ onHand: { gt: 0 } }, { allocated: { gt: 0 } }] },
    select: { onHand: true, allocated: true, variant: { select: { sku: true } } },
  });
  const first = levels[0];
  if (!first) return null;
  return {
    sku: first.variant.sku,
    units: levels.reduce((sum, l) => sum + Math.max(l.onHand, l.allocated), 0),
  };
}

async function loadProducts(tx: TxClient, productIds?: string[]): Promise<ProductRow[]> {
  return tx.product.findMany({
    where: {
      deletedAt: null,
      ...(productIds ? { id: { in: productIds } } : {}),
      options: { some: { name: { contains: 'core', mode: 'insensitive' } } },
    },
    select: PRODUCT_SELECT,
    orderBy: { title: 'asc' },
  });
}

/** Every product whose choices read as a core charge, oldest problem first. */
export async function listCandidates(ctx: ServiceContext): Promise<CoreChoiceCandidate[]> {
  return withTenant(ctx, async (tx) => {
    const products = await loadProducts(tx);
    const out: CoreChoiceCandidate[] = [];
    for (const product of products) {
      const plan = planFor(product);
      if (!plan) continue;
      if (plan.candidate.problem === null) {
        const stock = await stockOnRetired(tx, plan.candidate.retiredVariantIds);
        if (stock) {
          plan.candidate.problem = `${stock.sku} still has ${String(stock.units)} in stock. Count ${stock.units === 1 ? 'it' : 'them'} onto ${plan.candidate.keptSku} first, so nothing goes missing.`;
        }
      }
      out.push(plan.candidate);
    }
    return out;
  });
}

/**
 * Turn each product's core choice into a real deposit.
 *
 * One product, one transaction: a product that cannot change (a choice the words
 * do not place, stock on the version that would go) is reported back in words and
 * the rest still change. Per product:
 *
 *  - the version with the plain code stays, at the part's own price, with the
 *    deposit and, when asked, the old-part-first choice;
 *  - the other side stops being sold; its photos move to the one that stays;
 *  - the choice is removed, after writing down where every version sat, so putting
 *    the choice back on the Options tab brings the retired side back with it;
 *  - open baskets holding the retired side are moved onto the one that stays, the
 *    same way round (old part first, or the deposit), and repriced.
 */
export async function convert(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<CoreChoiceConversion[]> {
  const input = ConvertCoreChoicesInput.parse(rawInput);
  const inventoryActive = await isInventoryActive(ctx.tenantId);
  const results: CoreChoiceConversion[] = [];
  const cartsToReprice = new Set<string>();

  for (const conversion of input.conversions) {
    const outcome = await withTenant(ctx, async (tx) => {
      const [product] = await loadProducts(tx, [conversion.productId]);
      if (!product) {
        return {
          productId: conversion.productId,
          title: 'A product',
          problem: 'It has no core choice any more, or it was removed.',
        };
      }
      const plan = planFor(product);
      if (!plan) {
        return { productId: product.id, title: product.title, problem: 'It has no core choice.' };
      }
      if (plan.candidate.problem !== null) {
        return { productId: product.id, title: product.title, problem: plan.candidate.problem };
      }
      if (conversion.partPriceCents !== undefined && plan.groups.length > 1) {
        return {
          productId: product.id,
          title: product.title,
          problem: 'It has other choices too, so each version keeps its own part price.',
        };
      }
      const stock = await stockOnRetired(
        tx,
        plan.groups.map((g) => g.retired.id)
      );
      if (stock) {
        return {
          productId: product.id,
          title: product.title,
          problem: `${stock.sku} still has ${String(stock.units)} in stock. Count it onto ${plan.candidate.keptSku} first.`,
        };
      }

      // Where everything sits, before the choice is taken away.
      await rememberCoordinates(tx, product.id);

      const retiredWasDefault = plan.groups.some((g) => g.retired.isDefault);
      const now = new Date();
      for (const group of plan.groups) {
        await tx.productVariant.update({
          where: { id: group.kept.id },
          data: {
            priceCents: conversion.partPriceCents ?? group.first.priceCents,
            coreChargeCents: conversion.coreChargeCents,
            coreFirstOffered: conversion.offerCoreFirst,
          },
        });
        await tx.productVariant.update({
          where: { id: group.retired.id },
          data: { deletedAt: now, isDefault: false },
        });

        // Photos pinned to the side that goes move to the side that stays,
        // unless that one already shows the same photo.
        const keptAssets = new Set(
          (
            await tx.variantImage.findMany({
              where: { variantId: group.kept.id },
              select: { mediaAssetId: true },
            })
          ).map((image) => image.mediaAssetId)
        );
        const moving = await tx.variantImage.findMany({
          where: { variantId: group.retired.id },
          select: { id: true, mediaAssetId: true },
        });
        for (const image of moving) {
          if (keptAssets.has(image.mediaAssetId)) {
            await tx.variantImage.delete({ where: { id: image.id } });
          } else {
            await tx.variantImage.update({
              where: { id: image.id },
              data: { variantId: group.kept.id },
            });
            keptAssets.add(image.mediaAssetId);
          }
        }

        // Baskets already holding the side that goes: the same part, bought the
        // same way round.
        const retiredSide: CoreChoiceSide =
          group.retired.id === group.first.id ? 'first' : 'deposit';
        // Only baskets still being shopped: a bought one is a record of what
        // was bought, and refuses the repricing that follows (sparx persona
        // issue 087).
        const lines = await tx.cartItem.findMany({
          where: { variantId: group.retired.id, cart: NOT_BOUGHT_YET },
          select: { id: true, cartId: true },
        });
        for (const line of lines) {
          const sendFirst = retiredSide === 'first' && conversion.offerCoreFirst;
          await tx.cartItem.update({
            where: { id: line.id },
            data: {
              variantId: group.kept.id,
              coreFirst: sendFirst,
              coreChargeCents: sendFirst ? null : conversion.coreChargeCents,
            },
          });
          cartsToReprice.add(line.cartId);
        }
      }
      if (retiredWasDefault) {
        await tx.productVariant.update({
          where: { id: plan.groups[0]!.kept.id },
          data: { isDefault: true },
        });
      }

      // The choice goes; its values and every version's place on it go with it.
      if (plan.optionId) await tx.productOption.delete({ where: { id: plan.optionId } });

      const range = await tx.productVariant.aggregate({
        where: { productId: product.id, deletedAt: null },
        _min: { priceCents: true },
        _max: { priceCents: true },
      });
      await tx.product.update({
        where: { id: product.id },
        data: {
          priceMinCents: range._min.priceCents ?? null,
          priceMaxCents: range._max.priceCents ?? null,
        },
      });
      for (const group of plan.groups) {
        await syncProductInStock(tx, group.kept.id, inventoryActive);
      }

      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action: 'commerce.product.core_choice_converted',
        entityType: 'Product',
        entityId: product.id,
        diff: {
          before: {
            option: plan.candidate.optionName,
            depositLabel: plan.candidate.depositLabel,
            firstLabel: plan.candidate.firstLabel,
            depositSidePriceCents: plan.candidate.depositSidePriceCents,
            firstSidePriceCents: plan.candidate.firstSidePriceCents,
          },
          after: {
            keptVariantIds: plan.groups.map((g) => g.kept.id),
            retiredVariantIds: plan.groups.map((g) => g.retired.id),
            partPriceCents: conversion.partPriceCents ?? null,
            coreChargeCents: conversion.coreChargeCents,
            offerCoreFirst: conversion.offerCoreFirst,
          },
        },
      });

      return { productId: product.id, title: product.title, problem: null, plan };
    });

    if ('plan' in outcome && outcome.plan) {
      const plan = outcome.plan;
      await publishCommerceEvent({
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        topic: 'product.updated',
        data: { productId: outcome.productId, change: 'core_choice_converted' },
      });
      for (const group of plan.groups) {
        await publishCommerceEvent({
          tenantId: ctx.tenantId,
          actorId: ctx.userId ?? null,
          topic: 'variant.deleted',
          data: { variantId: group.retired.id },
        });
        await publishCommerceEvent({
          tenantId: ctx.tenantId,
          actorId: ctx.userId ?? null,
          topic: 'variant.updated',
          data: { variantId: group.kept.id, change: 'core_charge' },
        });
      }
    }
    results.push({ productId: outcome.productId, title: outcome.title, problem: outcome.problem });
  }

  // Outside the product transactions: a reprice opens its own.
  for (const cartId of cartsToReprice) await repriceCart(ctx, cartId);

  return results;
}
