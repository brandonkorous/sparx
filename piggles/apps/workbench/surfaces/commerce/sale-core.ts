// A rebuilt part sold at the counter: the core deposit, or the old part first.
// Sparx persona issue 061, which ported this till to the sparx console and taught
// both consoles the core deposit. The two copies of this file are one rule.
//
// A remanufactured part carries a refundable core deposit (issue 051): paid on
// top of the price, paid back when the old part comes back. Some businesses also
// let the buyer skip the deposit by bringing the old part FIRST (issue 057): no
// deposit, and the part is held until the old part arrives. The website has
// offered both since those issues. The till took neither, so a walk-in buying a
// rebuilt injector paid list for the part and the deposit was never written down
// at all. Nothing then said a core was owed, and nothing could refund one.
//
// Pure arithmetic and pure words, so the sum that is charged, the line that is
// posted and the sentence that explains both are pinned by one test file.
//
// The money follows the order spine exactly (`computeBillingTotals` in
// @wizeworks/crm): a deposit is never in the subtotal, never discounted or taxed,
// and IS in the total taken. The till prints it on its own row, under the same
// name the website's checkout summary uses, so the sum on screen adds up.

import type { SaleLine } from './sale-data';
import { formatCents } from './products-data';

/** What a version asks about its old part. */
export interface CoreOffer {
  /** Refundable deposit per unit, in cents. Always more than zero. */
  depositCents: number;
  /** The buyer may bring the old part first instead, and pay no deposit. */
  firstOffered: boolean;
}

/** The offer a catalog version makes, or undefined when it takes no core. A zero
 *  deposit is no deposit: the order spine refuses one, and so does this. */
export function coreOfferFrom(version: {
  coreChargeCents: number | null;
  coreFirstOffered: boolean;
}): CoreOffer | undefined {
  const cents = version.coreChargeCents;
  if (cents === null || !Number.isFinite(cents) || cents <= 0) return undefined;
  return { depositCents: cents, firstOffered: version.coreFirstOffered };
}

/** `{ core }` for a version that takes one, `{}` otherwise, to spread onto a
 *  row without ever writing `core: undefined`. */
export function coreFieldsFrom(version: {
  coreChargeCents: number | null;
  coreFirstOffered: boolean;
}): {
  core?: CoreOffer;
} {
  const core = coreOfferFrom(version);
  return core ? { core } : {};
}

/** Is this line going out on the old part rather than on a deposit? Only when
 *  the version offers it: a choice that is not on offer is never honored. */
export function bringsOldPartFirst(line: SaleLine): boolean {
  return line.core?.firstOffered === true && line.coreFirst === true;
}

/** Whole currency units, rounded to the cent. */
function cents2(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** The deposit this whole line takes now, in whole currency units. Zero on a
 *  line with no core and on one whose old part is coming first. */
export function lineCoreDeposit(line: SaleLine): number {
  if (!line.core || bringsOldPartFirst(line)) return 0;
  return cents2((line.core.depositCents / 100) * line.quantity);
}

/** What one line comes to before any deposit: price each times how many. */
export function lineGoods(line: SaleLine): number {
  const price = Number(line.price);
  return Number.isFinite(price) ? price * line.quantity : 0;
}

export interface SaleTotals {
  /** The parts and services themselves. */
  goods: number;
  /** Refundable core deposits taken now. Paid back as the old parts come in. */
  coreDeposits: number;
  /** What the sale comes to, deposits included. The figure the till asks for. */
  total: number;
}

export function saleTotals(lines: readonly SaleLine[]): SaleTotals {
  let goods = 0;
  let coreDeposits = 0;
  for (const line of lines) {
    goods += lineGoods(line);
    coreDeposits += lineCoreDeposit(line);
  }
  const roundedGoods = cents2(goods);
  const roundedDeposits = cents2(coreDeposits);
  return {
    goods: roundedGoods,
    coreDeposits: roundedDeposits,
    total: cents2(roundedGoods + roundedDeposits),
  };
}

/** One line as `POST /v1/orders` takes it (`LineItemInput` in crm-schemas). */
export interface SaleItemPayload {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  productId?: string;
  variantId?: string;
  /** Deposit per unit, in whole currency units. */
  coreCharge?: number;
  coreFirst?: true;
}

/**
 * The line the order is written with.
 *
 * Never both core fields on one line: the server refuses that, and it would mean
 * a deposit taken from somebody who was promised there would not be one.
 */
export function saleItem(line: SaleLine): SaleItemPayload {
  const item: SaleItemPayload = {
    sku: line.sku,
    name: line.name,
    quantity: line.quantity,
    unitPrice: Number(line.price),
    ...(line.productId ? { productId: line.productId } : {}),
    ...(line.variantId ? { variantId: line.variantId } : {}),
  };
  if (!line.core) return item;
  if (bringsOldPartFirst(line)) return { ...item, coreFirst: true };
  return { ...item, coreCharge: line.core.depositCents / 100 };
}

/** The order lines that can be handed over the moment the sale is written down.
 *  A part held for its old part stays on the shelf: the order spine would refuse
 *  to record it as handed over, and refusing the handover would read as the sale
 *  itself failing. */
export function handedOverNow<T extends { id: string; quantity: number; coreFirst: boolean }>(
  items: readonly T[]
): { orderItemId: string; quantity: number }[] {
  return items
    .filter((item) => !item.coreFirst)
    .map((item) => ({ orderItemId: item.id, quantity: item.quantity }));
}

/* ── The words ───────────────────────────────────────────────────────────── */
//
// The website's words where it has them (wizeworks/apps/site/lib/core-choice-
// copy.ts), turned round to face the person behind the counter: the buyer's
// "your old part" is "their old part" here.

/** The heading over the choice. */
export const CORE_CHOICE_LEGEND = 'Their old part';

/** The first choice, and the default: the deposit, taken now. */
export function corePayLabel(depositCents: number, quantity: number, currency: string): string {
  const deposit = formatCents(depositCents, currency);
  return quantity > 1
    ? `Pay the ${deposit} core deposit on each one now`
    : `Pay the ${deposit} core deposit now`;
}

export const CORE_PAY_HINT =
  'They take the part today. You pay the deposit back when the old part comes back.';

/** The second choice, only where the version offers it. */
export const CORE_FIRST_LABEL = 'They will bring the old part first';

export const CORE_FIRST_HINT = 'No deposit; it is held until the old part arrives.';

/** What a line says when the deposit is the only way to buy it. */
export function coreDepositOnly(depositCents: number, quantity: number, currency: string): string {
  return `Plus the ${formatCents(depositCents, currency)} refundable core deposit${
    quantity > 1 ? ' on each one' : ''
  }, paid back when their old part comes back.`;
}

/** The totals row, in the website checkout summary's own words. */
export const CORE_DEPOSITS_ROW = 'Refundable core deposits';
