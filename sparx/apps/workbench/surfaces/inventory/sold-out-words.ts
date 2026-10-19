// What "Nothing left to sell" goes on to say, from why there is nothing.
//
// It always said "It comes back on sale by itself the moment you count some in."
// That is true of an empty shelf. The O-Ring had 11 on the shelf and 40 spoken
// for by orders not yet shipped: counting a few in brings nothing back, because
// the orders take them first (sparx persona issue 318). One outcome, two causes,
// two sentences.

export interface ShelfLevel {
  onHand: number;
  allocated: number;
}

const LEAD = 'Your website shows it as sold out and will not take an order for it.';

export function soldOutBody(out: readonly ShelfLevel[]): string {
  const owed = out.reduce((sum, l) => sum + Math.max(0, l.allocated - l.onHand), 0);
  const onShelf = out.some((l) => l.onHand > 0);
  if (owed > 0) {
    return `${LEAD} Orders not yet shipped and baskets still open hold ${owed.toLocaleString('en-US')} more than you have, so those come first and it comes back on sale once more arrive than that.`;
  }
  if (onShelf) {
    return `${LEAD} What is on the shelf is spoken for or held back, so it comes back on sale once more arrive.`;
  }
  return `${LEAD} It comes back on sale by itself the moment you count some in.`;
}
