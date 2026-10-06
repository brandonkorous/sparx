// What a repeat delivery costs besides its items: postage and tax (issue 916).
//
// Every renewal used to be written with its items and nothing else, so
// `orderService.create` totalled it with $0 postage and $0 tax and the card was
// charged that. The first delivery, bought at checkout, carried both; every one
// after it carried neither. The shop absorbed the postage on every delivery and
// collected no tax on any of them, under a Tax screen that said "Collecting".
//
// So a renewal is priced the way checkout prices the first delivery, by the
// same two callers:
//
//   postage  `shippingService.quoteForLines`, the second half of the cart quote,
//            so the parcel, the "free over" threshold and the product groups are
//            judged exactly as they were at checkout. The option the shopper
//            CHOSE is priced again at the day's rate; nobody re-chooses.
//   tax      `taxService.calculate`, with the postage in it, so the rate in force
//            on the renewal day applies.
//
// When the shop no longer delivers to the address at all, the answer is not
// $0 postage. It is "this renewal cannot go out", and the caller holds it.

import type { Prisma } from '@wizeworks/db';
import { withTenant } from '@wizeworks/db';
import { AddressSnapshot, type RateOption, type TaxBreakdown } from '@wizeworks/commerce-schemas';

import type { ServiceContext } from '../errors';
import { describeRate, isCollection } from './collection-option';
import { resolveShipFromAddress } from './shipping-request-resolver';
import * as shippingService from './shipping-service';
import * as taxService from './tax-service';
import { exemptionIdsForBuyer } from './tax-exemption-holders';
import { taxRegionCode } from './tax-region';

/** The delivery option a repeat order keeps, in `commerce_subscriptions.shipping_choice`. */
export interface ShippingChoice {
  providerSlug: string;
  /** A shop's own rate keeps a stable ref (`manual:<id>`) and is matched on it. */
  rateRef: string | null;
  /** The words the shopper chose ("Standard Post"). A live carrier mints a new
   *  ref on every quote, so its option is found again by these. */
  description: string | null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function readShippingChoice(
  value: Prisma.JsonValue | null | undefined
): ShippingChoice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const providerSlug = text(raw.providerSlug);
  if (!providerSlug) return null;
  return { providerSlug, rateRef: text(raw.rateRef), description: text(raw.description) };
}

/** The choice a paid checkout recorded on its order, for the repeat order it starts. */
export function choiceFromOrder(
  metadata: Prisma.JsonValue | null | undefined
): ShippingChoice | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const meta = metadata as Record<string, unknown>;
  return readShippingChoice({
    providerSlug: meta.shippingProviderSlug ?? null,
    rateRef: meta.shippingRateRef ?? null,
    description: meta.shippingDescription ?? null,
  });
}

export function choiceOf(rate: RateOption): ShippingChoice {
  return {
    providerSlug: rate.providerSlug,
    rateRef: rate.rateRef,
    description: describeRate(rate),
  };
}

export interface PickedRate {
  rate: RateOption;
  /** True when the shopper's choice is no longer offered and another was used. */
  replaced: boolean;
}

/**
 * Which of today's options this renewal goes by.
 *
 * The shopper's own choice first, found by its ref and then by its name. If it
 * is gone, the cheapest way the shop still DELIVERS: the shopper asked for a
 * delivery, so a collection option is never a stand-in for one. Collection is
 * used only where it is what was chosen, or where nobody chose and it is all
 * the shop does (a repeat an owner set up by hand for a shop with a counter).
 *
 * Null means nothing on offer can honor this renewal.
 */
export function pickRenewalRate(
  rates: readonly RateOption[],
  choice: ShippingChoice | null
): PickedRate | null {
  if (choice) {
    const same =
      (choice.rateRef ? rates.find((rate) => rate.rateRef === choice.rateRef) : undefined) ??
      (choice.description
        ? rates.find(
            (rate) =>
              rate.providerSlug === choice.providerSlug && describeRate(rate) === choice.description
          )
        : undefined);
    if (same) return { rate: same, replaced: false };
  }

  const cheapestDelivery = rates
    .filter((rate) => !isCollection(rate))
    .reduce<RateOption | null>(
      (best, rate) => (best === null || rate.amountCents < best.amountCents ? rate : best),
      null
    );
  if (cheapestDelivery) return { rate: cheapestDelivery, replaced: choice !== null };

  if (choice === null || isCollection(choice)) {
    const collection = rates.find((rate) => isCollection(rate));
    if (collection) return { rate: collection, replaced: false };
  }
  return null;
}

export interface RenewalLine {
  variantId: string;
  productId: string;
  taxClass: string | null;
  quantity: number;
  unitPriceCents: number;
}

export type RenewalPrice =
  | { ok: true; shipping: PickedRate; tax: TaxBreakdown | null }
  | { ok: false; reason: 'no_delivery_address' | 'no_delivery_option' };

export async function priceRenewal(
  ctx: ServiceContext,
  input: {
    propertyId: string | null;
    currency: string;
    customerId: string;
    shippingAddress: Prisma.JsonValue;
    choice: ShippingChoice | null;
    lines: readonly RenewalLine[];
  }
): Promise<RenewalPrice> {
  const address = AddressSnapshot.safeParse(input.shippingAddress);
  if (!address.success) return { ok: false, reason: 'no_delivery_address' };
  const to = address.data;

  const rates = await shippingService.quoteForLines(ctx, {
    propertyId: input.propertyId,
    currency: input.currency,
    toAddress: to,
    lines: input.lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      subtotalCents: line.unitPriceCents * line.quantity,
    })),
  });
  const shipping = pickRenewalRate(rates, input.choice);
  if (!shipping) return { ok: false, reason: 'no_delivery_option' };

  // Their own certificates and their wholesale account's, by the same rule
  // checkout uses: a repeat order is the same purchase again (issue 075).
  const exemptionIds = await withTenant(ctx, (tx) => exemptionIdsForBuyer(tx, input.customerId));
  const from = await resolveShipFromAddress(ctx).catch(() => ({ country: 'US' }) as const);
  const fromRegion = taxRegionCode(from.country, 'region' in from ? from.region : undefined);
  const toRegion = taxRegionCode(to.country, to.region);

  const tax =
    input.lines.length === 0
      ? null
      : await taxService.calculate(ctx, {
          shipFrom: { country: from.country, ...(fromRegion ? { region: fromRegion } : {}) },
          shipTo: {
            country: to.country,
            ...(toRegion ? { region: toRegion } : {}),
            ...(to.postalCode ? { postalCode: to.postalCode } : {}),
            ...(to.city ? { city: to.city } : {}),
            ...(to.line1 ? { line1: to.line1 } : {}),
          },
          customerExemptionIds: exemptionIds,
          shippingAmountCents: shipping.rate.amountCents,
          lines: input.lines.map((line) => ({
            variantId: line.variantId,
            productId: line.productId,
            ...(line.taxClass ? { productTaxClass: line.taxClass } : {}),
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            // A renewal carries no discount: it is charged at the item price.
            discountAmountCents: 0,
          })),
        });

  return { ok: true, shipping, tax };
}

/** The sentence an owner and a shopper read when a renewal is held. */
export function heldReason(reason: 'no_delivery_address' | 'no_delivery_option'): string {
  return reason === 'no_delivery_address'
    ? 'The address on this repeat order is not complete, so the next delivery was not sent or charged. It is paused until a full delivery address is added.'
    : 'The shop no longer delivers to the address on this repeat order, so the next delivery was not sent or charged. It is paused until the address or the delivery options change.';
}
