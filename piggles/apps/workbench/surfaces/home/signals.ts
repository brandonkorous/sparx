// What Home watches, and what it offers to start.
//
// DATA, deliberately kept out of the surface: six signals and four actions are
// a product decision somebody revises, and they were sitting in the middle of a
// 425-line component where nobody would find them to revise.

import {
  faBagShopping,
  faBoxMagnifyingGlass,
  faBoxOpen,
  faCalendarCheck,
  faComment,
  faFileExclamation,
} from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';
import type { AttentionCount, AttentionKey } from '@/lib/console/home-data';

export interface Signal {
  key: AttentionKey;
  icon: PigglesIcon;
  /** The app this belongs to, so the row wears that app's hue. */
  module: string;
  surface: string;
  /**
   * What the screen must be narrowed to for the number to be visible on it. A
   * sentence naming a count promises the screen behind it shows THAT count:
   * "1 item is sold out" opened 62 unnarrowed rows with the one ninth ([258]).
   * Same values the pane's own chips use, so she can see it and turn it off.
   */
  params?: Record<string, string>;
  /** The sentence AFTER the number. Two forms, because "1 orders" is the kind of
   *  small wrongness that makes software feel unattended. */
  one: string;
  many: string;
  /** Said in the quiet line when the count is a real, measured zero. Lower case
   *  and clause-shaped — these are joined together into one sentence. */
  clear: string;
  /** Names the thing in "We could not reach your ___ just now." */
  noun: string;
}

export const SIGNALS: Signal[] = [
  {
    key: 'orders',
    icon: faBagShopping,
    module: 'commerce',
    surface: 'commerce.orders.list',
    one: 'order is waiting to go out',
    many: 'orders are waiting to go out',
    clear: 'everything is sent',
    noun: 'orders',
  },
  {
    key: 'messages',
    icon: faComment,
    module: 'chat',
    surface: 'chat.inbox',
    one: 'person is waiting to hear back',
    many: 'people are waiting to hear back',
    clear: 'everyone has had a reply',
    noun: 'messages',
  },
  {
    key: 'bookings',
    icon: faCalendarCheck,
    module: 'scheduling',
    surface: 'scheduling.calendar',
    one: 'booking needs confirming',
    many: 'bookings need confirming',
    clear: 'no bookings are waiting',
    noun: 'bookings',
  },
  {
    key: 'invoices',
    icon: faFileExclamation,
    module: 'invoicing',
    surface: 'invoicing.invoices.list',
    one: 'invoice is overdue',
    many: 'invoices are overdue',
    clear: 'nothing is overdue',
    noun: 'invoices',
  },
  // Before 'stock' on purpose: sold out is the worse of the two and the one that
  // is costing money today. "Sold out" is the shopper's own word, so the owner
  // reads the same phrase her customer is looking at.
  {
    key: 'outOfStock',
    icon: faBoxOpen,
    module: 'inventory',
    surface: 'inventory.stock.list',
    params: { level: 'out' },
    one: 'item is sold out',
    many: 'items are sold out',
    clear: 'nothing is sold out',
    noun: 'stock',
  },
  {
    key: 'stock',
    icon: faBoxMagnifyingGlass,
    module: 'inventory',
    surface: 'inventory.stock.list',
    params: { level: 'low' },
    one: 'product is running low',
    many: 'products are running low',
    // "stock is healthy" was a claim this count cannot support. It measures ONE
    // thing — items at or below a reorder point — and a business that has set no
    // reorder points scores zero on it for ever. Narrowing the words was only
    // half the repair: the SOLD OUT case above is what such an account actually
    // needed said, and it needs no reorder point to be true.
    clear: 'nothing is running low',
    noun: 'stock',
  },
];

/** What a person can start from here, in the order a day tends to need them. */
export const ACTIONS: {
  label: string;
  surface: string;
  module: string;
  params?: Record<string, string>;
}[] = [
  {
    label: 'Add a product',
    surface: 'commerce.product.detail',
    module: 'commerce',
    params: { id: 'new' },
  },
  {
    label: 'Send an invoice',
    surface: 'invoicing.invoice.edit',
    module: 'invoicing',
    params: { id: 'new' },
  },
  { label: 'Add a customer', surface: 'crm.customer.detail', module: 'crm', params: { id: 'new' } },
  { label: 'Work on my site', surface: 'builder.site', module: 'builder' },
];

/** A count that is asking for a person: a real non-zero number, or a failure to
 *  produce one. Not-knowing belongs in the list — see the file header. */
export function needsYou(count: AttentionCount): boolean {
  if (count.state === 'error' || count.state === 'unknown') return true;
  return count.state === 'ready' && (count.value ?? 0) > 0;
}

/** A real, measured zero. Nothing else qualifies. */
export function isClear(count: AttentionCount): boolean {
  return count.state === 'ready' && count.value === 0;
}

/**
 * The clear signals as one sentence: "everything is sent, nothing is overdue and
 * nothing is running low."
 *
 * One sentence rather than five pills, because the reader's question here is
 * binary — is there anything for me? — and five separate all-good badges make
 * them answer it five times.
 */
export function quietLine(clear: Signal[], { lead = true }: { lead?: boolean } = {}): string {
  const parts = clear.map((signal) => signal.clear);
  const joined =
    parts.length <= 1
      ? (parts[0] ?? '')
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  const sentence = `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`;
  return lead ? sentence : `${joined}.`;
}
