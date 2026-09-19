// One sentence under the cost-of-goods line on the profit screen.
//
// A leaf module, importing nothing, because a rule shaped like a sentence rots
// inside a component.

/**
 * WHAT "COST OF THE GOODS: $0.00" ACTUALLY MEANS.
 *
 * The line is labelled "What the stock you sold actually cost you, from your
 * inventory records", and it prints whatever the sum comes to. A shop with no
 * costs on its shelves sums to nothing, so the screen states $0.00 with the
 * same confidence it would state $400.
 *
 * Measured 2026-09-16 on one shop: 68 items, 375 units, **not one with a cost
 * recorded**, and a profit screen reading "You lost $1,432.70" over
 * "Cost of the goods $0.00". Her materials are all in the figures somewhere, as
 * running costs, so the loss is right and the SHAPE of it is wrong: it tells her
 * the clothes she sells cost her nothing to make.
 *
 * The platform already knows. The costing screen says it plainly: "68 things on
 * your shelves, 375 units in all, have never had a cost recorded, so they count
 * as nothing in every figure about what your stock is worth." That sentence is
 * two screens from the one she reads (persona issue 545).
 *
 * A zero with nothing behind it is not a measurement. But a real $0.00 exists
 * too — a service business has no cost of goods — so the two must be told apart
 * by the STOCK, not by the sum.
 */
export function costOfGoodsNote(
  cogsCents: number,
  uncostedItems: number,
  uncostedUnits: number
): { detail: string; unmeasured: boolean } {
  const measured = 'What the stock you sold actually cost you, from your inventory records.';
  if (cogsCents > 0 || uncostedItems <= 0) return { detail: measured, unmeasured: false };
  const things = uncostedItems === 1 ? '1 thing' : `${String(uncostedItems)} things`;
  const units = uncostedUnits === 1 ? '1 unit' : `${String(uncostedUnits)} units`;
  return {
    unmeasured: true,
    detail: `Nothing here has been measured yet: ${things} on your shelves, ${units} in all, have never had a cost recorded. Until they do, what you make on each sale cannot be worked out.`,
  };
}
