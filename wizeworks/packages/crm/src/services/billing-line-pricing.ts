// Billing-document line pricing (docs/87 §5).
//
// Resolves a line's unit price from its line-type `pricingMode`. The markup and
// marked-up pass-through paths reuse the shipped, shared markup engine
// (document-line-markup.resolveAndPriceLine → @wizeworks/commerce-schemas) so
// document-line markup never drifts from catalog markup; the labor / flat / catalog
// paths are straight arithmetic. Cost-derived modes stamp the reproducibility
// snapshot (`appliedMarkup`) onto the line. Runs inside the caller's tx so cost
// basis + rule reads stay RLS-scoped and atomic.
//
// EVERY MODE KEEPS ITS COST (sparx persona issue 086). Cost is what the margin
// on a quote is worked out from, and a flat, labor or re-priced catalog line
// used to store null however carefully a cost was typed for it. A typed cost
// wins; a line naming a part falls back to the part's own cost; with neither,
// the cost stays null, because an invented zero would report a 100% margin.

import type { Prisma } from '@wizeworks/db';
import type { LineMarkupInput, LineMarkupSnapshot } from '@wizeworks/commerce-schemas';

import { CrmNotFoundError, CrmValidationError } from '../errors';
import { resolveAndPriceLine } from './document-line-markup';

export type BillingPricingMode = 'catalog' | 'markup' | 'labor' | 'flat' | 'pass_through';

export interface PriceBillingLineArgs {
  pricingMode: BillingPricingMode;
  /** Linked variant — cost basis for markup/pass_through, list price for catalog. */
  variantId?: string | null;
  /** Explicit per-line cost (cents). Prices a markup/pass_through line, and is
   *  the cost every other mode keeps for its margin. */
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
      return {
        unitPrice: round2(args.unitPrice),
        costCents: await keptCostCents(tx, tenantId, args),
        appliedMarkup: null,
      };
    }

    case 'catalog': {
      // A manual override (a typed or trade price) wins; otherwise the
      // variant's list price. Either way the line keeps its cost.
      if (args.unitPrice != null) {
        return {
          unitPrice: round2(args.unitPrice),
          costCents: await keptCostCents(tx, tenantId, args),
          appliedMarkup: null,
        };
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
        costCents: args.explicitCostCents ?? variant.costCents ?? null,
        appliedMarkup: null,
      };
    }
  }
}

/**
 * The cost to re-price an edited line with (sparx persona issue 086). A cost the
 * edit sends wins, and null clears it. Not sent, the line's own cost stands: a
 * price typed over on the line row sends only the price, and the cost typed for
 * the line used to be dropped. It follows the part instead when the edit names
 * a different part, or when a markup line's cost was read from its part.
 */
export function costForRepricing(
  input: { explicitCostCents?: number | null; variantId?: string | null },
  existing: { costCents: number | null; variantId: string | null; appliedMarkup: unknown }
): number | null {
  if (input.explicitCostCents !== undefined) return input.explicitCostCents;
  if (input.variantId !== undefined && input.variantId !== existing.variantId) return null;
  const source = (existing.appliedMarkup as { costSource?: unknown } | null)?.costSource;
  if (source === 'variant_cost') return null;
  return existing.costCents;
}

/**
 * The cost a line priced by hand keeps for its margin: the cost typed for it,
 * else the cost on the part it names, else null. Never a defaulted zero
 * (sparx persona issue 086).
 */
async function keptCostCents(
  tx: Prisma.TransactionClient,
  tenantId: string,
  args: PriceBillingLineArgs
): Promise<number | null> {
  if (args.explicitCostCents != null) return args.explicitCostCents;
  if (!args.variantId) return null;
  const variant = await tx.productVariant.findFirst({
    where: { id: args.variantId, tenantId },
    select: { costCents: true },
  });
  return variant?.costCents ?? null;
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
    'No cost basis for this pass-through line. Enter a cost or link a variant that has a cost.'
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
