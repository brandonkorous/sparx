// How many of a bundle you can actually sell (docs/146 Phase 6.8).
//
// ── The gap this closes ──────────────────────────────────────────────────────
//
// A `decrement_components` bundle has no stock of its own — buying one takes a
// unit off each of its parts. So its availability is a property of its parts,
// and until now nothing computed it. The buy-box asked the bundle's own wrapper
// product whether it was in stock, got "untracked, always available", and
// happily sold a gift set whose candle ran out last Tuesday. The customer finds
// out at the pick face.
//
// ── The arithmetic, and the two things it deliberately does not count ────────
//
// For each REQUIRED component: how many bundles its available stock covers.
// The smallest of those is the answer, and the component that produced it is
// named — "you can sell 4, the candle runs out first" is what turns into a
// purchase order, where a bare 4 turns into a conversation.
//
//   OPTIONAL components do not gate. A bundle that can ship without the ribbon
//   is not out of stock because the ribbon is; that is what "optional" means.
//
//   SWAPPABLE components are counted on the variant they DEFAULT to, and no
//   further. Working out that the shopper could pick a different candle would
//   mean resolving the whole swap set here and being wrong the moment the
//   storefront offers a different one — so the figure is honest about being the
//   default configuration's, and the swap path is the storefront's to price.
//
// ── `decrement_bundle_sku` bundles are not this ──────────────────────────────
//
// Those have their own stock and their own level row. Asking their components is
// the wrong question and would produce a number nobody should act on, so they
// are returned as "not derived" rather than as a guess.

import { computeAvailability } from '@sparx/inventory';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import type { ServiceContext } from '../errors';

export interface BundleComponentAvailability {
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  /** Units of the component one bundle consumes. */
  quantityPerBundle: number;
  /** Sellable units of the component right now, across every location. */
  available: number;
  /** Bundles this component alone would allow. */
  supports: number;
  isRequired: boolean;
  isSwappable: boolean;
  /** True for the required component that runs out first. */
  isLimiting: boolean;
}

export interface BundleAvailability {
  bundleId: string;
  bundleProductId: string;
  inventoryMode: string;
  /** Bundles sellable right now. Null when the bundle keeps its OWN stock (a
   *  `decrement_bundle_sku` bundle) or when stock is not tracked at all — in
   *  both cases the components are the wrong question, and a number derived
   *  from them would be one nobody should act on. */
  available: number | null;
  /** Whether the buy-box should offer it. True for an untracked bundle, which is
   *  the same answer `computeAvailability` gives an untracked variant. */
  inStock: boolean;
  /** False when the figure is not derived from components — see `available`. */
  derived: boolean;
  limitingVariantId: string | null;
  limitingSku: string | null;
  components: BundleComponentAvailability[];
}

/**
 * What a bundle's components allow.
 *
 * Availability per component is summed across EVERY location, matching how
 * `computeAvailability` answers for a single variant — a shopper buying online
 * does not care which building the candle is in, only that the business has one.
 * Per-location assembly feasibility is a different question, and the one
 * `buildableQuantity` answers for a bill of materials.
 */
export async function bundleAvailability(
  ctx: ServiceContext,
  bundleProductId: string
): Promise<BundleAvailability | null> {
  return withTenant(ctx, (tx) => loadBundleAvailability(tx, ctx.tenantId, bundleProductId));
}

/** Several at once, for a listing page — one query per bundle rather than one
 *  per component, so a category of twenty gift sets is twenty round trips and
 *  not two hundred. */
export async function bundleAvailabilityFor(
  ctx: ServiceContext,
  bundleProductIds: string[]
): Promise<Map<string, BundleAvailability>> {
  const out = new Map<string, BundleAvailability>();
  if (bundleProductIds.length === 0) return out;
  await withTenant(ctx, async (tx) => {
    for (const id of bundleProductIds) {
      const result = await loadBundleAvailability(tx, ctx.tenantId, id);
      if (result) out.set(id, result);
    }
  });
  return out;
}

async function loadBundleAvailability(
  tx: TxClient,
  tenantId: string,
  bundleProductId: string
): Promise<BundleAvailability | null> {
  const bundle = await tx.bundle.findFirst({
    where: { bundleProductId },
    include: {
      components: {
        orderBy: { position: 'asc' },
        include: { variant: { select: { sku: true, product: { select: { title: true } } } } },
      },
    },
  });
  if (!bundle) return null;

  const base = {
    bundleId: bundle.id,
    bundleProductId: bundle.bundleProductId,
    inventoryMode: bundle.inventoryMode,
    limitingVariantId: null as string | null,
    limitingSku: null as string | null,
  };

  // A bundle with its own stock is answered by its own level row, not by asking
  // its parts. Saying so beats inventing a number from the wrong source.
  if (bundle.inventoryMode !== 'decrement_components') {
    return { ...base, available: null, inStock: true, derived: false, components: [] };
  }

  const variantIds = bundle.components.map((c) => c.variantId);
  const levels =
    variantIds.length === 0
      ? []
      : await tx.inventoryLevel.findMany({
          where: { tenantId, variantId: { in: variantIds } },
          select: {
            variantId: true,
            onHand: true,
            allocated: true,
            safetyBuffer: true,
            unsellableOnHand: true,
          },
        });
  const policies = await tx.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, inventoryPolicy: true },
  });
  const policyByVariant = new Map(policies.map((p) => [p.id, p.inventoryPolicy]));

  const levelsByVariant = new Map<
    string,
    { onHand: number; allocated: number; safetyBuffer: number; unsellableOnHand: number }[]
  >();
  for (const l of levels) {
    const list = levelsByVariant.get(l.variantId) ?? [];
    list.push(l);
    levelsByVariant.set(l.variantId, list);
  }

  const components: BundleComponentAvailability[] = bundle.components.map((c) => {
    const quantityPerBundle = Math.max(1, c.defaultQuantity);
    // Routed through the SAME `computeAvailability` every other surface uses, so
    // a component's safety buffer and its sell-past-zero policy mean here
    // exactly what they mean on its own product page.
    const availability = computeAvailability(
      levelsByVariant.get(c.variantId) ?? [],
      policyByVariant.get(c.variantId) ?? 'deny',
      { inventoryActive: true }
    );
    const available = availability.available ?? 0;
    return {
      variantId: c.variantId,
      variantSku: c.variant?.sku ?? null,
      productTitle: c.variant?.product?.title ?? null,
      quantityPerBundle,
      available,
      // A component that may be sold past zero does not cap the bundle: the
      // business has already said it will keep taking orders for that part, and
      // a bundle refusing to sell around it would contradict its own policy.
      supports:
        (policyByVariant.get(c.variantId) ?? 'deny') === 'deny'
          ? Math.floor(available / quantityPerBundle)
          : Number.MAX_SAFE_INTEGER,
      isRequired: c.isRequired,
      isSwappable: c.isSwappable,
      isLimiting: false,
    };
  });

  const gating = components.filter((c) => c.isRequired);
  if (gating.length === 0) {
    // Nothing required means nothing can run out. Unusual, and true.
    return { ...base, available: null, inStock: true, derived: false, components };
  }

  let limiting = gating[0]!;
  for (const c of gating) {
    if (c.supports < limiting.supports) limiting = c;
  }
  const available =
    limiting.supports === Number.MAX_SAFE_INTEGER ? null : Math.max(0, limiting.supports);

  return {
    ...base,
    available,
    // Null available here means every required component sells past zero, so the
    // bundle does too.
    inStock: available === null || available > 0,
    derived: true,
    limitingVariantId: available === null ? null : limiting.variantId,
    limitingSku: available === null ? null : limiting.variantSku,
    components: components.map((c) => ({
      ...c,
      supports: c.supports === Number.MAX_SAFE_INTEGER ? (available ?? 0) : c.supports,
      isLimiting: available !== null && c.variantId === limiting.variantId && c.isRequired,
    })),
  };
}
