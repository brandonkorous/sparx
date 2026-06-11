// Billing-document line pricing (docs/87 §5).
//
// Resolves a line's unit price from its line-type `pricingMode`. The markup and
// marked-up pass-through paths reuse the shipped, shared markup engine
// (quote-markup.resolveAndPriceLine → @sparx/commerce-schemas) so document-line
// markup never drifts from catalog/quote markup; the labor / flat / catalog
// paths are straight arithmetic. Cost-derived modes stamp the reproducibility
// snapshot (`appliedMarkup`) onto the line. Runs inside the caller's tx so cost
// basis + rule reads stay RLS-scoped and atomic.

import type { Prisma } from '@sparx/db';
import type { LineMarkupInput, LineMarkupSnapshot } from '@sparx/commerce-schemas';

import { CrmNotFoundError, CrmValidationError } from '../errors';
import { resolveAndPriceLine } from './quote-markup';

export type BillingPricingMode = 'catalog' | 'markup' | 'labor' | 'flat' | 'pass_through';

export interface PriceBillingLineArgs {
  pricingMode: BillingPricingMode;
  /** Linked variant — cost basis for markup/pass_through, list price for catalog. */
  variantId?: string | null;
  /** Explicit per-line cost override (cents) for markup/pass_through lines. */
  explicitCostCents?: number | null;
  /** Direct unit price (dollars): the amount for `flat`, the hourly rate for
   *  `labor`, or a manual override for `catalog`. */
  unitPrice?: number | null;
  /** Markup directive (rule or ad-hoc) for `markup`, or to mark up a
   *  `pass_through` line over its cost. */
  markup?: LineMarkupInput | null;
}

export interface PricedBillingLine {
  unitPrice: number; // dollars, for BillingDocumentLine.unitPrice (Decimal(12,2))
  costCents: number | null;
  appliedMarkup: LineMarkupSnapshot | null;
}

export async function priceBillingLine(
  tx: Prisma.TransactionClient,
  tenantId: string,
  args: PriceBillingLineArgs
): Promise<PricedBillingLine> {
  switch (args.pricingMode) {
    case 'markup': {
      if (!args.markup) {
        throw new CrmValidationError('A markup line needs a markup rule or an ad-hoc markup.');
      }
      const priced = await resolveAndPriceLine(tx, tenantId, {
        variantId: args.variantId ?? null,
        explicitCostCents: args.explicitCostCents ?? null,
        markup: args.markup,
      });
      return {
        unitPrice: priced.unitPrice,
        costCents: priced.costCents,
        appliedMarkup: priced.snapshot,
      };
    }

    case 'pass_through': {
      // Sublet/freight: marked up over the sublet cost when a markup is given,
      // otherwise passed through at cost.
      if (args.markup) {
        const priced = await resolveAndPriceLine(tx, tenantId, {
          variantId: args.variantId ?? null,
          explicitCostCents: args.explicitCostCents ?? null,
          markup: args.markup,
        });
        return {
          unitPrice: priced.unitPrice,
          costCents: priced.costCents,
          appliedMarkup: priced.snapshot,
        };
      }
      const costCents = await resolveCostCents(tx, tenantId, args);
      return { unitPrice: round2(costCents / 100), costCents, appliedMarkup: null };
    }

    case 'labor':
    case 'flat': {
      if (args.unitPrice == null) {
        throw new CrmValidationError(
          args.pricingMode === 'labor'
            ? 'A labor line needs an hourly rate (unit price) and hours (quantity).'
            : 'A flat line needs an amount (unit price).'
        );
      }
      return { unitPrice: round2(args.unitPrice), costCents: null, appliedMarkup: null };
    }

    case 'catalog': {
      // A manual override wins; otherwise the variant's list price.
      if (args.unitPrice != null) {
        return { unitPrice: round2(args.unitPrice), costCents: null, appliedMarkup: null };
      }
      if (!args.variantId) {
        throw new CrmValidationError('A catalog line needs a variant or an explicit unit price.');
      }
      const variant = await tx.productVariant.findFirst({
        where: { id: args.variantId, tenantId },
        select: { priceCents: true, costCents: true },
      });
      if (!variant) throw new CrmNotFoundError('ProductVariant', args.variantId);
      return {
        unitPrice: round2(variant.priceCents / 100),
        costCents: variant.costCents ?? null,
        appliedMarkup: null,
      };
    }
  }
}

async function resolveCostCents(
  tx: Prisma.TransactionClient,
  tenantId: string,
  args: PriceBillingLineArgs
): Promise<number> {
  if (args.explicitCostCents != null) return args.explicitCostCents;
  if (args.variantId) {
    const variant = await tx.productVariant.findFirst({
      where: { id: args.variantId, tenantId },
      select: { costCents: true },
    });
    if (variant?.costCents != null) return variant.costCents;
  }
  throw new CrmValidationError(
    'No cost basis for this pass-through line — enter a cost or link a variant that has a cost.'
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
