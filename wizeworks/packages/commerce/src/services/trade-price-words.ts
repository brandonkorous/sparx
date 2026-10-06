// What a business on account pays for one thing, and WHY, in the owner's words.
//
// The price itself is never decided here. `pricingService.resolve` decides it,
// in the order checkout charges: a signed agreement first (and it returns), then
// the account's standing prices and its group's discount through the
// `resolve_b2b_price()` SQL function, then price lists, then bulk prices. This
// file only puts a sentence beside the number, so a quote line can say
// "Fleet price: 12% off $600.00" instead of a bare $528.00 that the owner has to
// take on trust (sparx persona issue 077).
//
// The sentence for the account's own prices has to name WHICH of the SQL
// function's layers won, and that function returns only a number. So
// `explainAccountStep` re-reads the same rows in the same precedence and then
// CHECKS its answer against the number the function returned. When the two
// disagree (a collection-wide price this does not read, say) it falls back to
// "their wholesale price" rather than naming a rule that did not set the price.
// A wrong reason is worse than a vague one.

/** What set the price, reduced to what the sentence needs. */
export type AccountPriceRule =
  | { kind: 'list' }
  | { kind: 'contract'; validTo: string | null }
  | { kind: 'account_override'; percentOff: number | null }
  | { kind: 'tier_override'; tierName: string; percentOff: number | null }
  | {
      kind: 'tier_discount';
      tierName: string;
      discountType: 'percentage' | 'fixed';
      /** Percent for `percentage`; CENTS for `fixed`, as the tier stores it. */
      value: number;
      /** The account's own flat discount, stacked on top; 0 for none. */
      accountPercent: number;
    }
  | { kind: 'account_discount'; percent: number }
  | { kind: 'price_list'; listName: string | null }
  | { kind: 'bulk'; minQuantity: number | null }
  | { kind: 'wholesale' };

/** The rows `resolve_b2b_price()` reads for one account and one version. */
export interface AccountPriceFacts {
  /** A price pinned to this account for this version. */
  accountOverride: { priceCents: number | null; percentOff: number | null } | null;
  /** The account's group, when it has one. */
  tier: { name: string; discountType: string; discountValue: number } | null;
  /** A price pinned to the group for this version. */
  tierOverride: { priceCents: number | null; percentOff: number | null } | null;
  /** The account's own flat discount, 0 for none. */
  accountPercent: number;
}

/** `ROUND(list * (1 - pct / 100))`, as the SQL function writes it. */
function percentOff(listCents: number, pct: number): number {
  return Math.max(0, Math.round(listCents * (1 - pct / 100)));
}

/**
 * Which of the account's own pricing layers produced `effectiveCents`.
 *
 * The precedence is `resolve_b2b_price()`'s, top to bottom: the account's own
 * price for this version, the group's price for this version, the group's
 * discount, and the account's flat discount stacked last. Collection-wide prices
 * are not read here, so a price set that way comes back `wholesale`, which is
 * also what any disagreement comes back as.
 */
export function explainAccountStep(
  facts: AccountPriceFacts,
  listCents: number,
  effectiveCents: number
): AccountPriceRule {
  const candidate = ((): { rule: AccountPriceRule; cents: number } | null => {
    const own = facts.accountOverride;
    if (own && own.priceCents !== null) {
      return { rule: { kind: 'account_override', percentOff: null }, cents: own.priceCents };
    }
    if (own && own.percentOff !== null) {
      return {
        rule: { kind: 'account_override', percentOff: own.percentOff },
        cents: percentOff(listCents, own.percentOff),
      };
    }
    const tier = facts.tier;
    const group = facts.tierOverride;
    if (tier && group && group.priceCents !== null) {
      return {
        rule: { kind: 'tier_override', tierName: tier.name, percentOff: null },
        cents: group.priceCents,
      };
    }
    if (tier && group && group.percentOff !== null) {
      return {
        rule: { kind: 'tier_override', tierName: tier.name, percentOff: group.percentOff },
        cents: percentOff(listCents, group.percentOff),
      };
    }
    const stack = (cents: number) =>
      facts.accountPercent > 0 ? percentOff(cents, facts.accountPercent) : cents;
    if (tier && (tier.discountType === 'percentage' || tier.discountType === 'fixed')) {
      const tiered =
        tier.discountType === 'percentage'
          ? percentOff(listCents, tier.discountValue)
          : Math.max(0, listCents - Math.trunc(tier.discountValue));
      return {
        rule: {
          kind: 'tier_discount',
          tierName: tier.name,
          discountType: tier.discountType,
          value: tier.discountValue,
          accountPercent: facts.accountPercent,
        },
        cents: stack(tiered),
      };
    }
    if (facts.accountPercent > 0) {
      return {
        rule: { kind: 'account_discount', percent: facts.accountPercent },
        cents: stack(listCents),
      };
    }
    return null;
  })();
  if (candidate?.cents !== effectiveCents) return { kind: 'wholesale' };
  return candidate.rule;
}

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** "12", "12.5": a percentage as a person says it, never "12.0000". */
function pct(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** "Dec 31, 2026": a calendar date stored at UTC midnight, read in UTC. */
function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The sentence for a quote line, or null when the list price applies.
 *
 * Always names the list price it started from, because the number beside it is
 * the one the owner will be asked about: "why is this $528 when the site says
 * $600?" has its answer in the same line.
 */
export function tradePriceWords(
  rule: AccountPriceRule,
  listCents: number,
  currency: string
): string | null {
  const list = money(listCents, currency);
  switch (rule.kind) {
    case 'list':
      return null;
    case 'contract':
      return rule.validTo
        ? `Agreed price until ${day(rule.validTo)}, instead of ${list}`
        : `Agreed price, instead of ${list}`;
    case 'account_override':
      return rule.percentOff === null
        ? `Their own price, instead of ${list}`
        : `Their own price: ${pct(rule.percentOff)}% off ${list}`;
    case 'tier_override':
      return rule.percentOff === null
        ? `${rule.tierName} price, instead of ${list}`
        : `${rule.tierName} price: ${pct(rule.percentOff)}% off ${list}`;
    case 'tier_discount': {
      const off =
        rule.discountType === 'percentage'
          ? `${pct(rule.value)}% off ${list}`
          : `${money(Math.trunc(rule.value), currency)} off ${list}`;
      const more = rule.accountPercent > 0 ? `, then ${pct(rule.accountPercent)}% more off` : '';
      return `${rule.tierName} price: ${off}${more}`;
    }
    case 'account_discount':
      return `Their discount: ${pct(rule.percent)}% off ${list}`;
    case 'price_list':
      return rule.listName
        ? `Price from the "${rule.listName}" price list, instead of ${list}`
        : `Price from one of their price lists, instead of ${list}`;
    case 'bulk':
      return rule.minQuantity
        ? `Bulk price for ${String(rule.minQuantity)} or more, instead of ${list}`
        : `Bulk price, instead of ${list}`;
    case 'wholesale':
      return `Their wholesale price, instead of ${list}`;
  }
}
