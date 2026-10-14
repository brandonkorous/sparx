// The sales tax on a sale made at the counter (sparx persona issue 230).
//
// Take a sale wrote every order with no tax at all: it never asked, and the order
// spine sums what each line carries. Gillett collects Utah's 7.25%, and the
// website's checkout charged it on a part collected at the same counter (issue
// 137), so the same camera cost $321.70 online and $299.95 across the counter,
// with the $21.75 owed to Utah either way.
//
// The same engine and the same facts as a collected checkout order
// (`quoteTaxForSession`): the place is the shop's own address, a line is taxed
// on the price this customer is actually charged, the buyer's certificates and
// their wholesale account's are read, and a core deposit is never in it (it is
// not a price; the till sends it apart). A line typed in by hand, or an hour of
// labor, sells nothing from the catalog and is taxed at the place's general rate.

import { z } from 'zod';
import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

import { quotedRateBasisPoints } from './order-line-tax';
import { resolveShipFromAddress } from './shipping-request-resolver';
import { exemptionIdsForBuyer } from './tax-exemption-holders';
import { taxRegionCode } from './tax-region';
import * as taxService from './tax-service';

export const SaleTaxRequest = z.object({
  customerId: z.string().uuid().nullable(),
  lines: z
    .array(
      z.object({
        /** The till's own name for the line, handed back with its tax. */
        ref: z.string().min(1).max(64),
        variantId: z.string().uuid().nullable(),
        quantity: z.number().int().positive(),
        unitPriceCents: z.number().int().min(0),
      })
    )
    .max(500),
});
export type SaleTaxRequest = z.infer<typeof SaleTaxRequest>;

export interface SaleTaxQuote {
  totalTaxCents: number;
  /** The one rate charged (725 = 7.25%), or null when none or several were. */
  rateBasisPoints: number | null;
  lines: { ref: string; taxAmountCents: number }[];
  /** The buyer, or the account they buy for, has a certificate on file. */
  certificateOnFile: boolean;
}

export async function quoteTaxForSale(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<SaleTaxQuote> {
  const input = SaleTaxRequest.parse(rawInput);
  const untaxed: SaleTaxQuote = {
    totalTaxCents: 0,
    rateBasisPoints: null,
    lines: input.lines.map((line) => ({ ref: line.ref, taxAmountCents: 0 })),
    certificateOnFile: false,
  };
  if (input.lines.length === 0) return untaxed;
  // No address for the shop is no place to be taxed in, as at checkout.
  const shop = await resolveShipFromAddress(ctx).catch(() => null);
  if (!shop) return untaxed;

  const variantIds = [...new Set(input.lines.flatMap((l) => (l.variantId ? [l.variantId] : [])))];
  const read = await withTenant(ctx, async (tx) => {
    const [exemptionIds, variants] = await Promise.all([
      exemptionIdsForBuyer(tx, input.customerId),
      variantIds.length === 0
        ? Promise.resolve([])
        : tx.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, productId: true, product: { select: { taxClass: true } } },
          }),
    ]);
    return { exemptionIds, variants: new Map(variants.map((v) => [v.id, v])) };
  });

  const region = taxRegionCode(shop.country, shop.region ?? undefined);
  const place = {
    country: shop.country,
    ...(region ? { region } : {}),
    ...(shop.postalCode ? { postalCode: shop.postalCode } : {}),
  };
  const quoted = await taxService.calculate(ctx, {
    shipFrom: place,
    shipTo: {
      ...place,
      ...(shop.city ? { city: shop.city } : {}),
      ...(shop.line1 ? { line1: shop.line1 } : {}),
    },
    customerExemptionIds: read.exemptionIds,
    shippingAmountCents: 0,
    lines: input.lines.map((line) => {
      const variant = line.variantId ? read.variants.get(line.variantId) : undefined;
      return {
        ...(variant ? { variantId: variant.id, productId: variant.productId } : {}),
        ...(variant?.product.taxClass ? { productTaxClass: variant.product.taxClass } : {}),
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
      };
    }),
  });
  return {
    totalTaxCents: quoted.totalTaxCents,
    rateBasisPoints: quotedRateBasisPoints(quoted),
    lines: quoted.lines.map((line) => ({
      ref: input.lines[line.lineRef]?.ref ?? '',
      taxAmountCents: line.taxAmountCents,
    })),
    certificateOnFile: read.exemptionIds.length > 0,
  };
}
