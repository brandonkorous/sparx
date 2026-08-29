'use client';

// Every combination the choices allow, and what is sitting in each one.

import type { Product, ProductOption, Variant } from '../products-data';

export interface Slot {
  key: string;
  /** One value per axis, in axis order. This is the slot's identity. */
  coordinate: { optionName: string; valueId: string; valueText: string }[];
  /** The version on sale here. */
  variant: Variant | null;
  /**
   * Every version that sits here and is no longer sold.
   *
   * A slot holding one is NOT empty. Its code is still reserved, its price is
   * still recorded, and the way to sell it again is to bring it back — not to
   * create a second version on the same coordinate. Matching only against live
   * versions made it read as empty, so the grid offered "Set a price" pre-filled
   * with the reserved code and the server refused it; the bulk fill worked
   * around the same clash by appending "-2", which put five brand-new codes with
   * no stock on sale beside five retired ones holding the real codes and all the
   * stock (issue 305).
   *
   * A LIST, not one of them, because a square can genuinely hold two — repairing
   * a shop damaged that way puts the real version back beside the "-2" that
   * displaced it. Showing the first and hiding the rest picked by array order
   * which of two prices, codes and stock counts she was offered, and told the
   * other it belonged to no combination when it did (issue 306).
   *
   * Filled even when `variant` is set. Retiring a version and selling a new one
   * on the same combination is ordinary, and those stopped ones were being
   * counted as sitting nowhere — so the console told her they belonged to no
   * combination of choices while they sat on one it was showing her.
   */
  retired: Variant[];
}

function sameCoordinate(candidate: Variant, wanted: string[]): boolean {
  if (candidate.optionValueIds.length !== wanted.length) return false;
  const held = [...candidate.optionValueIds].sort();
  return held.every((id, index) => id === wanted[index]);
}

/** Every combination the choices allow, in the order they are shown. */
export function slotsOf(
  options: ProductOption[],
  live: Variant[],
  retired: Variant[] = []
): Slot[] {
  let rows: Slot['coordinate'][] = [[]];
  for (const option of options) {
    const next: Slot['coordinate'][] = [];
    for (const row of rows) {
      for (const value of option.values) {
        next.push([...row, { optionName: option.name, valueId: value.id, valueText: value.value }]);
      }
    }
    rows = next;
  }

  return rows.map((coordinate) => {
    const wanted = [...coordinate.map((point) => point.valueId)].sort();
    const variant = live.find((candidate) => sameCoordinate(candidate, wanted)) ?? null;
    return {
      key: coordinate.map((point) => point.valueId).join('|'),
      coordinate,
      variant,
      retired: retired.filter((c) => sameCoordinate(c, wanted)),
    };
  });
}

export function slotLabel(slot: Slot): string {
  return slot.coordinate.map((point) => point.valueText).join(' · ');
}

/** A first code for a new version, built from the product's web address and the
 *  choices it sits on, so nobody has to invent one per cell of a 3×4 grid. Stays
 *  fully editable — a business with its own scheme types theirs over the top. */
export function suggestSlotSku(product: Product, slot: Slot, taken: Set<string>): string {
  const token = (value: string) =>
    value
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 12);
  const base = token(product.handle) || 'ITEM';
  const suffix = slot.coordinate.map((point) => token(point.valueText)).filter(Boolean);
  let candidate = [base, ...suffix].join('-').slice(0, 120);
  let attempt = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${[base, ...suffix].join('-').slice(0, 116)}-${String(attempt)}`;
    attempt += 1;
  }
  return candidate;
}
