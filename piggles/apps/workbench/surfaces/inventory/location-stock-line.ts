// HOW MUCH IS HERE, AND WHETHER THIS PLACE HAS SHELVES.
//
// ── The wall of zeros ────────────────────────────────────────────────────────
//
// Juniper Row's Shelves list read like this:
//
//     RECV    Receiving bay    Fulfillment Center   Goods in     0
//     A-01    Aisle A, bay 1   Fulfillment Center   Picking      0
//     A-02    Aisle A, bay 2   Fulfillment Center   Picking      0
//     B-01    Aisle B, bay 1   Fulfillment Center   Picking      0
//     BULK-1  Overstock        Fulfillment Center   Overstock    0
//
// Five shelves, nothing on any of them, and 491 units of stock in the business.
// Nothing on the screen said why, and a zero has two opposite meanings: the
// shelf is empty, or nothing was ever put on a shelf here at all.
//
// The answer was in the Location column the whole time. Every shelf is at
// Fulfillment Center; every unit is at Main Warehouse, which has no shelves. The
// Locations list did not say that either — it showed name, kind, where and
// state, and nothing about what was in the place.
//
// Measured 2026-09-16:
//
//     Juniper Row    Fulfillment Center   5 shelves      0 units
//     Juniper Row    Main Warehouse       0 shelves    491 units
//     Threadline     Fulfillment Center   3 shelves  12162 units
//     Threadline     Main Warehouse       3 shelves      0 units
//
// So the fact is counted once, on the locations list, and two screens read it.

/** What a location list row knows about itself. NULL is "nobody counted". */
export interface LocationStock {
  name: string;
  onHand: number | null;
  binCount: number | null;
}

function units(n: number): string {
  return `${new Intl.NumberFormat().format(n)} ${n === 1 ? 'unit' : 'units'}`;
}

function shelves(n: number): string {
  if (n === 0) return 'no shelves';
  return `${String(n)} ${n === 1 ? 'shelf' : 'shelves'}`;
}

/**
 * The line under a location's name: what is in it, and whether it has shelves.
 *
 * Null when nobody counted, so the row shows nothing rather than "0 units",
 * which would be a claim ([[feedback_never_present_absence_as_measurement]]).
 */
export function locationStockLine(location: LocationStock): string | null {
  if (location.onHand === null || location.binCount === null) return null;
  if (location.onHand === 0) return `Nothing here · ${shelves(location.binCount)}`;
  return `${units(location.onHand)} · ${shelves(location.binCount)}`;
}

/**
 * The sentence above a Shelves list where every shelf on screen is empty.
 *
 * Returns null whenever there is nothing to explain: some shelf has stock, or
 * the counts were never taken.
 *
 * `locations` is every location the business has, with its own counts, which is
 * what lets this name the place the stock is actually in rather than saying
 * something vague about putting away.
 */
export function emptyShelvesNote(
  shelvesShown: { unitCount: number }[],
  locations: LocationStock[] | null
): string | null {
  if (shelvesShown.length === 0) return null;
  if (shelvesShown.some((shelf) => shelf.unitCount > 0)) return null;
  if (locations === null) return null;

  const counted = locations.filter((place) => place.onHand !== null && place.binCount !== null) as {
    name: string;
    onHand: number;
    binCount: number;
  }[];
  if (counted.length === 0) return null;

  const total = counted.reduce((sum, place) => sum + place.onHand, 0);
  if (total === 0) {
    return 'None of these shelves has anything on it, and there is no stock anywhere else either. Shelves fill up when a delivery is booked in and put away.';
  }

  // The interesting case, and the one Juniper Row is in: the stock is real and
  // it is somewhere that cannot hold it on a shelf.
  const unshelved = counted.filter((place) => place.onHand > 0 && place.binCount === 0);
  if (unshelved.length > 0) {
    const where =
      unshelved.length === 1 ? unshelved[0]?.name : unshelved.map((place) => place.name).join(', ');
    return `None of these shelves has anything on it. Your stock is at ${String(where)}, which has no shelves, so there is nowhere here for it to show.`;
  }

  return `None of these shelves has anything on it, though you hold ${units(total)}. Stock appears here once a delivery has been put away onto a shelf.`;
}
