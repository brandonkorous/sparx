// The offer stack (docs/151 §12, docs/152 E1 + E2).
//
// Two placements, one shape:
//
//   BUMP    — shown during checkout. Taking it is `cart.addItem`, so tax,
//             discounts, inventory commitment and refunds are the cart's and
//             nothing about payment changes. There is no payment work in E1 at
//             all; the design pass found that and it is why this file is short.
//
//   UPSELL  — shown after the order completes. Taking it creates a SECOND ORDER
//             rather than amending the first (docs/151 §12.2), which is what
//             keeps tax, receipts and refunds correct.
//
// ── ONE OFFER, NEVER A STACK ─────────────────────────────────────────────────
//
// `pickOffer` returns at most one. A checkout that asks four times is the
// pattern this feature is known for and the reason people distrust it, so the
// limit is in the selector rather than left to whoever builds the screen.

import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

export type OfferPlacement = 'bump' | 'upsell';

export interface OfferCandidate {
  id: string;
  variantId: string;
  headline: string;
  blurb: string | null;
  ctaLabel: string;
  triggerVariantIds: string[];
  priority: number;
}

/**
 * Which offer to show, given what is already in the basket.
 *
 * Pure, and separated from the query for that reason: "does this offer apply"
 * is the decision most likely to be subtly wrong (an offer for something they
 * are already buying, an offer with no trigger firing on every checkout) and
 * least likely to be noticed, because a wrong offer still renders.
 */
export function pickOffer(
  candidates: readonly OfferCandidate[],
  inBasketVariantIds: readonly string[]
): OfferCandidate | null {
  const basket = new Set(inBasketVariantIds);
  const eligible = candidates.filter((offer) => {
    // Never offer somebody a thing they are already buying. It reads as a bug to
    // the customer and as a double charge if they take it.
    if (basket.has(offer.variantId)) return false;
    // No triggers means "offer it to anybody" — a legitimate choice for a cheap
    // add-on and the author's call to make.
    if (offer.triggerVariantIds.length === 0) return true;
    return offer.triggerVariantIds.some((id) => basket.has(id));
  });
  if (eligible.length === 0) return null;
  // Lowest priority number wins; a tie falls to the older offer, so the choice
  // is stable rather than whatever the database happened to return.
  return [...eligible].sort((a, b) => a.priority - b.priority)[0] ?? null;
}

/** Active offers for this placement, cheapest-priority first. */
async function activeOffers(
  ctx: ServiceContext,
  propertyId: string,
  placement: OfferPlacement
): Promise<OfferCandidate[]> {
  return withTenant(ctx, (tx) =>
    tx.commerceOffer.findMany({
      where: { tenantId: ctx.tenantId, propertyId, placement, active: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        variantId: true,
        headline: true,
        blurb: true,
        ctaLabel: true,
        triggerVariantIds: true,
        priority: true,
      },
    })
  );
}

export interface ShownOffer extends OfferCandidate {
  /** Read from the variant EVERY time, never stored on the offer. An offer
   *  carrying its own price would be a second place a product costs something. */
  priceCents: number;
  currency: string;
  productTitle: string;
  variantTitle: string | null;
  impressionId: string;
}

/**
 * The offer to show, priced and recorded.
 *
 * Recording happens on the SHOWING, not on the acceptance. "Three people said
 * yes" with no denominator is not a conversion rate, it is a number — and the
 * denominator only exists if the showing was written down.
 *
 * Returns null when there is nothing to offer, which is the common case and not
 * an error. Out of stock counts as nothing to offer: an offer for something that
 * cannot ship is a checkout that fails after the customer already said yes.
 */
export async function offerFor(
  ctx: ServiceContext,
  input: {
    propertyId: string;
    placement: OfferPlacement;
    inBasketVariantIds: string[];
    /** Exactly one, matching the placement. */
    checkoutSessionId?: string;
    orderId?: string;
  }
): Promise<ShownOffer | null> {
  const candidates = await activeOffers(ctx, input.propertyId, input.placement);
  const picked = pickOffer(candidates, input.inBasketVariantIds);
  if (!picked) return null;

  const variant = await withTenant(ctx, (tx) =>
    tx.productVariant.findUnique({
      where: { id: picked.variantId },
      select: {
        priceCents: true,
        title: true,
        isAvailable: true,
        deletedAt: true,
        product: { select: { title: true, status: true, currency: true } },
      },
    })
  );
  // A deleted, unpublished or unavailable variant is not an offer. Silently
  // showing nothing is right here: the customer is midway through paying and an
  // apology about the shop's configuration helps nobody.
  if (!variant || variant.deletedAt || !variant.isAvailable) return null;
  if (variant.product.status !== 'active') return null;

  const impression = await withTenant(ctx, (tx) =>
    tx.commerceOfferImpression.upsert({
      where: input.checkoutSessionId
        ? {
            offerId_checkoutSessionId: {
              offerId: picked.id,
              checkoutSessionId: input.checkoutSessionId,
            },
          }
        : { offerId_orderId: { offerId: picked.id, orderId: input.orderId ?? '' } },
      // A reload is the same showing. Updating nothing keeps the original
      // timestamp and stops one customer inflating their own denominator.
      update: {},
      create: {
        tenantId: ctx.tenantId,
        offerId: picked.id,
        checkoutSessionId: input.checkoutSessionId ?? null,
        orderId: input.orderId ?? null,
      },
      select: { id: true },
    })
  );

  return {
    ...picked,
    priceCents: variant.priceCents,
    currency: variant.product.currency,
    productTitle: variant.product.title,
    variantTitle: variant.title,
    impressionId: impression.id,
  };
}

/** Mark a showing as taken. Idempotent: pressing the button twice is one yes. */
export async function acceptOffer(
  ctx: ServiceContext,
  input: { impressionId: string; resultOrderId?: string }
): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.commerceOfferImpression.updateMany({
      where: { id: input.impressionId, tenantId: ctx.tenantId, acceptedAt: null },
      data: {
        acceptedAt: new Date(),
        ...(input.resultOrderId ? { resultOrderId: input.resultOrderId } : {}),
      },
    })
  );
}

export interface OfferPerformance {
  offerId: string;
  name: string;
  placement: string;
  shown: number;
  accepted: number;
  /** Null when it has never been shown — NOT 0%, which would call an offer
   *  nobody has seen a failure. */
  acceptRate: number | null;
}

/** How each offer is doing. */
export async function offerPerformance(
  ctx: ServiceContext,
  propertyId: string
): Promise<OfferPerformance[]> {
  const offers = await withTenant(ctx, (tx) =>
    tx.commerceOffer.findMany({
      where: { tenantId: ctx.tenantId, propertyId },
      orderBy: [{ placement: 'asc' }, { priority: 'asc' }],
      select: {
        id: true,
        name: true,
        placement: true,
        _count: { select: { impressions: true } },
      },
    })
  );
  if (offers.length === 0) return [];

  const accepted = await withTenant(ctx, (tx) =>
    tx.commerceOfferImpression.groupBy({
      by: ['offerId'],
      where: {
        tenantId: ctx.tenantId,
        offerId: { in: offers.map((o) => o.id) },
        acceptedAt: { not: null },
      },
      _count: { _all: true },
    })
  );
  const acceptedBy = new Map(accepted.map((a) => [a.offerId, a._count._all]));

  return offers.map((o) => {
    const shown = o._count.impressions;
    const yes = acceptedBy.get(o.id) ?? 0;
    return {
      offerId: o.id,
      name: o.name,
      placement: o.placement,
      shown,
      accepted: yes,
      acceptRate: shown > 0 ? yes / shown : null,
    };
  });
}
