// Whether a product group can actually be delivered.
//
// A delivery option belongs to a (REGION, GROUP) pair. So a group that no region
// prices shows a shopper no delivery option at all, and a basket holding
// anything filed under it cannot be checked out — silently, at the till, on the
// customer's side of the screen.
//
// The region half of this surface has always known: it carries a rate count and
// wears a "No delivery options" warning badge when it is zero. The group half
// never had the count, so the one screen that can CREATE the broken state — Add
// a group, file products into it, walk away — said nothing at all about it.
//
// Absence is the whole problem here: a group with no delivery option renders
// exactly like a group with three.

export interface GroupDeliveryShape {
  /** Delivery options naming this group, across every region. */
  rateCount: number;
  /** True for the one group everything not filed elsewhere ships under. */
  isDefault: boolean;
  productCount: number;
  variantCount: number;
  collectionCount: number;
}

/** How many things are filed under this group by hand. */
export function filedCount(g: GroupDeliveryShape): number {
  return g.productCount + g.variantCount + g.collectionCount;
}

/**
 * The warning, or null when the group can be delivered.
 *
 * Three different situations, because they want three different reactions and
 * only one of them is an emergency:
 *
 *   • the DEFAULT group with no price — nothing in the shop can be delivered
 *   • a group with products in it — those products cannot be delivered
 *   • an empty group — nothing is broken yet, but anything filed here will be
 */
export function groupDeliveryWarning(
  g: GroupDeliveryShape
): { tone: 'error' | 'warning'; short: string; detail: string } | null {
  if (g.rateCount > 0) return null;

  if (g.isDefault) {
    return {
      tone: 'error',
      short: 'Cannot be delivered',
      detail:
        'No region has a delivery option for this group, and it covers every product not filed under another group. Shoppers are offered no way to receive their order. Open a region and add a delivery option for this group.',
    };
  }

  const filed = filedCount(g);
  if (filed > 0) {
    const things = filed === 1 ? '1 product' : `${String(filed)} products`;
    return {
      tone: 'error',
      short: 'Cannot be delivered',
      detail: `No region has a delivery option for this group, so the ${things} in it cannot be delivered. A shopper with one in their basket is offered no way to receive it. Open a region and add a delivery option for this group.`,
    };
  }

  return {
    tone: 'warning',
    short: 'No delivery options',
    detail:
      'No region has a delivery option for this group yet. Nothing is filed under it, so nothing is affected, but anything you file here will have no way to be delivered until a region prices it.',
  };
}
