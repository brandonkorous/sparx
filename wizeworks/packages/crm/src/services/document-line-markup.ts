// Document-line markup pricing (docs/48 §5, docs/87 §5).
//
// Resolves a markup directive (a saved rule or an ad-hoc markup) against a
// BillingDocumentLine's cost basis and computes the priced line plus the
// mandatory reproducibility snapshot. The cost basis + markup rule are read
// inside the caller's transaction (so it stays RLS-scoped and atomic); the
// cost→price math lives in @wizeworks/commerce-schemas's pure `priceLineByMarkup`,
// shared with the catalog markup engine so the two never drift.
//
// This glue lives in CRM alongside the rest of the invoicing/billing-document
// service layer, and depends only on the pure commerce-schemas package, not
// the commerce service layer. Consumed by billing-line-pricing.ts's `markup`
// and marked-up `pass_through` pricing modes.

import type { MarkupRule, Prisma } from '@wizeworks/db';
import {
  priceLineByMarkup,
  type LineCostSource,
  type LineMarkupInput,
  type LineMarkupSnapshot,
  type MarkupBand,
  type MarkupRuleSpec,
  type RoundingSpec,
} from '@wizeworks/commerce-schemas';

import { CrmNotFoundError, CrmValidationError } from '../errors';

export interface PricedDocumentLine {
  unitPrice: number; // dollars — for BillingDocumentLine.unitPrice (Decimal(12,2))
  costCents: number; // the cost basis the price was derived from
  snapshot: LineMarkupSnapshot;
}

export interface PriceLineArgs {
  variantId: string | null;
  // Explicit per-line cost override (cents). Required when there is no variant
  // to fall back to (a manual part / sublet / freight line).
  explicitCostCents?: number | null;
  markup: LineMarkupInput;
}

// Map a markup_rules row to the pure engine's spec. Mirrors commerce
// markup-service.ruleToSpec — kept local so CRM depends only on the pure
// schemas package, never the commerce service layer.
function ruleToSpec(rule: MarkupRule): MarkupRuleSpec {
  return {
    method: rule.method as MarkupRuleSpec['method'],
    value: rule.value == null ? null : Number(rule.value),
    bands: (rule.bands as unknown as MarkupBand[]) ?? [],
    rounding: (rule.rounding as unknown as RoundingSpec) ?? null,
    floorProfitCents: rule.floorProfitCents,
    floorMargin: rule.floorMargin == null ? null : Number(rule.floorMargin),
    ceilingSrc: rule.ceilingSrc as MarkupRuleSpec['ceilingSrc'],
    ceilingValueCents: rule.ceilingValueCents,
  };
}

/**
 * Resolve the cost basis + markup directive and compute the priced line within
 * an existing transaction. Throws when no cost is available, the rule is
 * missing/inactive, or the rule is catalog-only (not document-applicable).
 */
export async function resolveAndPriceLine(
  tx: Prisma.TransactionClient,
  tenantId: string,
  args: PriceLineArgs
): Promise<PricedDocumentLine> {
  // 1. Cost basis: an explicit override wins; otherwise the linked variant.
  let costCents: number | null = null;
  let costSource: LineCostSource = 'manual';
  let compareAtCents: number | null = null;

  if (args.explicitCostCents != null) {
    costCents = args.explicitCostCents;
    costSource = 'manual';
  } else if (args.variantId) {
    const variant = await tx.productVariant.findFirst({
      where: { id: args.variantId, tenantId },
      select: { costCents: true, compareAtPriceCents: true },
    });
    if (variant?.costCents != null) {
      costCents = variant.costCents;
      costSource = 'variant_cost';
      compareAtCents = variant.compareAtPriceCents;
    }
  }

  if (costCents == null) {
    throw new CrmValidationError(
      'No cost basis for this line — enter a cost, or link a variant that has a cost.'
    );
  }

  const computedAt = new Date().toISOString();

  // 2. Resolve the markup directive to the pure engine's input.
  if (args.markup.kind === 'rule') {
    const rule = await tx.markupRule.findFirst({
      where: { id: args.markup.ruleId, tenantId },
    });
    if (!rule) throw new CrmNotFoundError('MarkupRule', args.markup.ruleId);
    if (!rule.isActive) {
      throw new CrmValidationError(`Markup rule "${rule.name}" is not active`);
    }
    if (rule.appliesTo !== 'document' && rule.appliesTo !== 'both') {
      throw new CrmValidationError(
        `Markup rule "${rule.name}" is catalog-only — it can't price a document line`
      );
    }
    const { result, snapshot } = priceLineByMarkup(
      costCents,
      { kind: 'rule', ruleId: rule.id, ruleName: rule.name, spec: ruleToSpec(rule), costSource },
      computedAt,
      { compareAtCents }
    );
    return { unitPrice: result.priceCents / 100, costCents, snapshot };
  }

  const { result, snapshot } = priceLineByMarkup(
    costCents,
    { kind: 'adhoc', method: args.markup.method, value: args.markup.value, costSource },
    computedAt,
    { compareAtCents }
  );
  return { unitPrice: result.priceCents / 100, costCents, snapshot };
}
