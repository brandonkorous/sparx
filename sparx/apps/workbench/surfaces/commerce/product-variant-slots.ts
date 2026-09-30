// Every combination the choices allow, what is sitting in each one, and the code
// a new one is offered.
//
// Lifted out of the surface so the rules can be TESTED. The console's test seat
// covers pure functions and deliberately renders no React, so a rule living
// inside a .tsx is a rule nothing can check — and this one shipped wrong for
// months (issue 172). Its Piggles twin is
// `surfaces/commerce/product-variants/slots.ts`; the two are kept in step by
// `check:console-parity` and must stay that way.

import type { Product, ProductOption, Variant } from './products-data';

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
   * still recorded, its stock is still on the shelf, and the way to sell it again
   * is to bring it back, not to create a second version on the same combination.
   * Matching only against live versions made it read as empty: the grid offered
   * "Set a price" on a square whose real version was sitting in it, and the bulk
   * fill stepped round the reserved code by appending "-2", which put five
   * brand-new codes with no stock on sale beside five stopped ones holding the
   * real codes and every garment in the shop (issue 305).
   *
   * A LIST, not one of them, because a square can genuinely hold two. Repairing a
   * shop damaged that way puts the real version back beside the "-2" that
   * displaced it, and showing only the first let array order decide which of two
   * prices, codes and stock counts the owner was offered, while the other was
   * described as belonging to no combination when it did (issue 306).
   *
   * Filled even when `variant` is set. Stopping a version and selling a new one
   * on the same combination is ordinary, and those stopped ones sit here too.
   */
  retired: Variant[];
}

function sameCoordinate(candidate: Variant, wanted: string[]): boolean {
  if (candidate.optionValueIds.length !== wanted.length) return false;
  const held = [...candidate.optionValueIds].sort();
  return held.every((id, index) => id === wanted[index]);
}

/** Every combination the choices allow, in the order they are shown.
 *
 *  `retired` is every stopped version of the product. Leave it out and every
 *  square whose version was stopped reads as empty, which is the defect above;
 *  the default exists only for callers that genuinely have no stopped versions
 *  to hand, never as a way to skip them. */
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
    return {
      key: coordinate.map((point) => point.valueId).join('|'),
      coordinate,
      variant: live.find((candidate) => sameCoordinate(candidate, wanted)) ?? null,
      retired: retired.filter((candidate) => sameCoordinate(candidate, wanted)),
    };
  });
}

export function slotLabel(slot: Slot): string {
  return slot.coordinate.map((point) => point.valueText).join(' · ');
}

/** Code-shaped: upper case, hyphens for anything else, no hyphen at either end. */
function normalize(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** One CHOICE of a code, kept short so a long color name does not run away with
 *  the line. Only the choices are cut: the stem is what makes a code unique
 *  across products, so shortening that is what caused the clash below. */
function token(value: string): string {
  return normalize(value).slice(0, 12);
}

/**
 * The stem every generated code hangs off: **the code this product already
 * carries**, which is the one the owner typed into "Product code" when she added
 * it. It falls back to the product's web address only when there is no version
 * yet to read a code from.
 *
 * Two things this fixes, both issue 172.
 *
 * It used to read the WEB ADDRESS every time. So a shop owner who typed
 * `ASH-OVERSHIRT` on the Add a product form, then pressed "Give them all the
 * same price", got fourteen codes reading `THE-ASH-OVER-…` beside the one she
 * wrote — including the "The" she would never put on a label. One shirt, two
 * naming schemes, and the odd one out was the only one she chose.
 *
 * And the stem is **not truncated**. Cutting it to twelve characters is the only
 * thing that made two different products generate the same code: a shop with
 * twelve products whose names all start "Brushed Terry" had every one of them
 * fall to the stem `SAMPLE-BRUSH`, so the second product to be filled in would
 * ask the server for a code the first already held and the fill would stop
 * partway with nothing to do about it. The stem is what makes a code unique
 * across products, so it is the last thing that may be shortened.
 *
 * The anchor is the version shown first — the same one the bulk fill copies the
 * price from — and its own choices are taken back off the end. A version created
 * by this generator carries its combination (`ASH-OVERSHIRT-XS-CLAY`), and
 * anyone may make that one the version shown first; hanging the next code off it
 * whole would compound into `ASH-OVERSHIRT-XS-CLAY-S-BONE`.
 */
export function skuStem(product: Product, slots: Slot[], live: Variant[]): string {
  const anchor = live.find((variant) => variant.isDefault) ?? live[0] ?? null;
  const address = normalize(product.handle) || 'ITEM';
  if (anchor === null) return address;

  let stem = anchor.sku;
  const home = slots.find((slot) => slot.variant?.id === anchor.id);
  if (home) {
    for (const point of [...home.coordinate].reverse()) {
      const tail = `-${token(point.valueText)}`;
      if (tail.length > 1 && stem.toUpperCase().endsWith(tail)) {
        stem = stem.slice(0, -tail.length);
      }
    }
  }
  return stem === '' ? address : stem;
}

/** A first code for a new version, built from the code the product already
 *  carries and the choices this one sits on, so nobody has to invent one per
 *  cell of a 3×4 grid. Stays fully editable — a business with its own scheme
 *  types theirs over the top.
 *
 *  `stem` comes from `skuStem` and is passed in rather than derived here: the
 *  three places that offer a code all need the same answer, and a stem computed
 *  twice is a stem that drifts. */
export function suggestSlotSku(stem: string, slot: Slot, taken: Set<string>): string {
  const suffix = slot.coordinate.map((point) => token(point.valueText)).filter(Boolean);
  let candidate = [stem, ...suffix].join('-').slice(0, 120);
  let attempt = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${[stem, ...suffix].join('-').slice(0, 116)}-${String(attempt)}`;
    attempt += 1;
  }
  return candidate;
}

/**
 * The version of THIS product that already carries the code a slot would be
 * given, when that version has no place in the grid.
 *
 * `suggestSlotSku` steps past a taken code by appending "-2", and against a code
 * held by some other product that is right. Against a version of this same
 * product that has lost its combination it is the worst available answer: that
 * version almost certainly IS this square's, with the real price and the real
 * stock, and minting "-2" beside it is exactly how five stockless codes went on
 * sale while the garments sat on rows nothing could reach (issue 305). The
 * remembered-coordinate fix on the server stops that happening to a choice
 * removed and re-added; it cannot help a shop already damaged, or one whose
 * record was lost some other way. So a square with a claimant is not filled in
 * bulk and not offered a "-2" code. It is offered the claimant instead.
 *
 * Only placeless versions count. One sitting in another square is a different
 * garment that happens to share a naming scheme, and the ordinary suffix is the
 * right way past it.
 */
export function claimantOf(stem: string, slot: Slot, placeless: Variant[]): Variant | null {
  if (slot.coordinate.length === 0) return null;
  const natural = suggestSlotSku(stem, slot, new Set()).toLowerCase();
  return placeless.find((variant) => variant.sku.toLowerCase() === natural) ?? null;
}

/** What the Variants tab does with each version and each square. */
export interface GridStanding {
  /** On sale, and sitting on no combination, so no shopper can reach it. */
  stranded: Variant[];
  /** Stopped, and sitting on no combination. */
  homeless: Variant[];
  /** Stopped, on a combination something else is being sold in. */
  resting: Variant[];
  /** Squares that have never held a version: nothing on sale, nothing stopped. */
  empty: Slot[];
  /** Empty squares whose own code a placeless version carries, by slot key. */
  claimants: Map<string, Variant>;
  /** Empty squares the bulk fill may create a version in. */
  fillable: Slot[];
  /** Squares with nothing ON SALE in them: where a placeless version can go. */
  free: Slot[];
}

/**
 * Sorts every version and every square into what the tab offers for it.
 *
 * Pure and here, rather than inline in the tab, because the rule it carries is
 * the one that went wrong: `empty` feeding "Give them all the same price" with
 * squares whose real version was only stopped is what minted the "-2" codes, and
 * a rule inside a .tsx is a rule nothing can test (issue 305).
 */
export function gridOf(
  slots: Slot[],
  hasChoices: boolean,
  live: Variant[],
  retired: Variant[],
  stem: string
): GridStanding {
  const placed = new Set(
    slots
      .flatMap((slot) => [slot.variant?.id, ...slot.retired.map((variant) => variant.id)])
      .filter((id): id is string => id !== undefined)
  );
  const stranded = hasChoices ? live.filter((variant) => !placed.has(variant.id)) : [];
  // One that is stopped but still sits on a coordinate HAS a place. Calling it
  // placeless is false, and it is the ordinary state of every version anybody
  // ever replaced (issue 306).
  const homeless = hasChoices ? retired.filter((variant) => !placed.has(variant.id)) : [];
  // Nothing is wrong with these, but their codes stay reserved, so hiding them
  // is what makes "that code already exists" unanswerable.
  const resting = slots.flatMap((slot) => (slot.variant ? slot.retired : []));
  // A square whose version is only STOPPED is not empty: bringing it back is the
  // move, and creating a second one on top is what put "-2" codes carrying no
  // stock on sale beside it (issue 305).
  const empty = hasChoices
    ? slots.filter((slot) => slot.variant === null && slot.retired.length === 0)
    : [];
  const claimants = new Map<string, Variant>();
  for (const slot of empty) {
    const claimant = claimantOf(stem, slot, [...stranded, ...homeless]);
    if (claimant) claimants.set(slot.key, claimant);
  }
  return {
    stranded,
    homeless,
    resting,
    empty,
    claimants,
    fillable: empty.filter((slot) => !claimants.has(slot.key)),
    // Wider than `empty` on purpose: a square holding a stopped version has
    // nothing on sale in it, and refusing those would leave a shop whose every
    // square is occupied by the wrong version with no way back at all (306).
    free: hasChoices ? slots.filter((slot) => slot.variant === null) : [],
  };
}
