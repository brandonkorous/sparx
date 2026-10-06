// WHAT THEY PAY NOW, beside what a new wholesale price would make it.
//
// The price form said "They would pay $559.06 instead of $621.18", comparing
// the new price with the LIST price. A business in a wholesale group does not
// pay the list price: Wasatch Front, on Fleet, already paid $528.00 for that
// injector, so the "discount" being set was a price RISE, and the sentence
// called it a saving (sparx persona issue 085). So the comparison is with what
// they pay today, and a rise is said out loud.
//
// For one business that is asked of the server (`/v1/b2b/resolve-price`, the
// engine checkout charges with). For a group it is worked out here from what
// the pane already holds: the group's own price for this version if it has
// one, else its blanket discount when that covers every product, else the
// list price.

import {
  tradeRulePriceCents,
  type TradePricingTier,
  type TradeTierOverride,
} from './products-data';

/** What everyone in one wholesale group pays for one version today. */
export function groupPaysNowCents(
  tierId: string,
  variant: { id: string; priceCents: number },
  tiers: readonly TradePricingTier[],
  tierOverrides: readonly TradeTierOverride[]
): number {
  const own = tierOverrides.find(
    (rule) => rule.tierId === tierId && !rule.tierDeleted && rule.variantId === variant.id
  );
  const ruled = own ? tradeRulePriceCents(own, variant.priceCents) : null;
  if (ruled !== null) return ruled;
  const tier = tiers.find((one) => one.id === tierId);
  if (tier?.productScope !== 'all' || tier.discountValue <= 0) return variant.priceCents;
  if (tier.discountType === 'percentage') {
    return Math.round(variant.priceCents * (1 - tier.discountValue / 100));
  }
  return Math.max(0, variant.priceCents - Math.round(tier.discountValue * 100));
}

/** The sentence under the price box. `nowCents` is null while it is unknown. */
export function newTradePriceSentence(
  newCents: number,
  nowCents: number | null,
  money: (cents: number) => string
): string {
  if (nowCents === null) return `They would pay ${money(newCents)}.`;
  if (newCents === nowCents) return `They would pay ${money(newCents)}, the same as they pay now.`;
  if (newCents < nowCents) {
    return `They pay ${money(nowCents)} now. This brings it down to ${money(newCents)}.`;
  }
  return `They pay ${money(nowCents)} now. This raises it to ${money(newCents)}, more than they pay today.`;
}
