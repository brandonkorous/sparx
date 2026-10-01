// The chips on the orders list, and what to say when nothing matched.
//
// ONE list, used by BOTH order lists — the shop's Orders and Wholesale orders.
// It was two hand-kept copies that had already drifted: the wholesale one was
// missing "Canceled", so a canceled wholesale order could not be picked out at
// all and nobody noticed, because there was no single place to look.
// [[feedback_structural_checks_go_blind]]
//
// Each chip maps to ONE server filter, so what is on screen is always exactly
// one server answer — no chip means "these two statuses, sort of". "Refunded" is
// deliberately absent: it is rare, it is visible on any row it applies to, and a
// seventh chip costs every operator a wider bar forever.
//
// A CHIP MAY NOT ASK FOR A COLUMN VALUE WHEN IT MEANS A QUESTION. "Not paid"
// asked for `payment_status = 'unpaid'`, and that is not the question an owner
// opens this list to ask. A CANCELLED order carries 'unpaid' for the rest of its
// life and is owed by nobody; a PART-PAID order does not carry it at all and is
// money she is still waiting for. Measured 2026-09-28: of the 91 orders it
// returned platform-wide, 18 owed nothing (11 cancelled) across 10 of the 12
// tenants with orders, and 2 that did owe were missing. On Juniper Row it
// returned 18 and the right answer was also 18 — two rows out, two rows in — so
// the count was right by accident while the rows were wrong.
//
// The console already knew: `amountDue()` in order-format.ts opens "What is
// still collectable on this order" and excludes a cancelled or refunded one, so
// the order PANE said nothing was owed while the LIST filter counted it. The chip
// now asks the named question (`owing`) and the rule is
// `isOwingOrder` in @wizeworks/crm-schemas, one place for both screens.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// And the label moved with it, because a chip's word has to be true of
// everything it returns: "Not paid" is a lie about a part-paid order. "Still
// owed" is the word the order's own money block already prints on that row.
//
// A CHIP MAY NOT NAME A DELIVERY METHOD. An order either goes out to the
// customer or waits for them to come and get it, and the same stored status
// covers both. So "To send" was returning orders the very same table marked
// "To collect", and "Delivered" was returning ones it marked "Collected" —
// measured 2026-09-22, 3 collections under "To send" and 7 under "Delivered"
// across the platform, 2 of the 3 rows on Juniper Row's own wholesale list.
// A chip names the WORK, and the work on both is the same: pick it and pack it.
// `orders-list-filters.test.ts` fails on any chip that names one method.

import type { OpenTarget } from '../../lib/surfaces/registry';

export const FILTERS = [
  { value: 'all', label: 'All', status: undefined, owing: undefined },
  { value: 'unpaid', label: 'Still owed', status: undefined, owing: true },
  { value: 'to_send', label: 'To pack', status: 'placed', owing: undefined },
  { value: 'sent', label: 'Packed', status: 'fulfilled', owing: undefined },
  { value: 'delivered', label: 'They have it', status: 'delivered', owing: undefined },
  { value: 'cancelled', label: 'Canceled', status: 'cancelled', owing: undefined },
] as const;

/** The server fields a chip may set. Exactly ONE of them, ever — the test holds
 *  that, over this list rather than over two names somebody remembered. */
export const CHIP_SERVER_FIELDS = ['status', 'owing'] as const;

export type FilterValue = (typeof FILTERS)[number]['value'];

/**
 * A chip arriving from outside: `show` on the address, which is how Home's "3
 * orders are waiting to go out" opens this list on To pack rather than on every
 * order the shop has ever taken ([258]). Read once, as the chip's starting
 * value, so it is on screen and one tap turns it off. Anything unrecognised
 * means "no narrowing", never a guess.
 */
export function parseOrderFilter(raw: unknown): FilterValue {
  return FILTERS.find((chip) => chip.value === raw)?.value ?? 'all';
}

/**
 * An order's stored status in the list's own chip word, for a place that has
 * only the status and not the whole order (the search box). It printed the
 * stored word, so a search hit said "placed" or "fulfilled" beside the list
 * that says "To pack" and "Packed" for the same orders (issue 914).
 */
export function orderStatusWords(status: string): string {
  const chip = FILTERS.find((filter) => filter.status === status);
  if (chip) return chip.label;
  if (status === 'refunded') return 'Refunded';
  const spaced = status.replace(/[-_]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * What to try when nothing matched — naming ONLY what is actually narrowing the
 * list. Telling someone to clear a filter they never set sends them looking for
 * a control that is already off.
 *
 * It used to say orders were "marked" the chip's word. They are not: a chip
 * gathers up several markings at once, so "no orders marked They have it" would
 * send someone looking down the table for a word that is not printed in it.
 */
export function emptyAdvice(search: string, filterLabel: string | null): string {
  const parts: string[] = [];
  if (search) {
    parts.push('Try part of an order number, or the customer’s name, company or email.');
  }
  if (filterLabel) {
    parts.push(`The “${filterLabel}” filter is on. Switch back to All to see the rest.`);
  }
  return parts.join(' ');
}

/** Same modifier contract as every other list in the app. */
export function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}
