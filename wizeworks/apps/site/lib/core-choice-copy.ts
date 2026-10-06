// The words for a rebuilt part that can be bought two ways (sparx persona issue 057).
//
// A remanufactured part carries a refundable core deposit (issue 051). Some
// businesses also let a buyer skip the deposit by sending the old part FIRST: no
// deposit, and the part ships when the old one arrives. The same promise is made on
// the product page (all three renderers), in the cart drawer, on the cart page and in
// the checkout summary, so it lives here once. A shopper who reads "we ship right
// away" on one screen and something else on the next stops believing either.
//
// Plain words for the people buying, who may never have heard the word "core": the
// old part is "your old part" everywhere, and "core" only appears beside "deposit",
// which is how the business's invoice will name the money.

import { formatMoney } from './format';

/** The buy box's first choice: pay the deposit, ship now. `depositCents` null means
 *  the versions carry different deposits, each named in the version picker, so the
 *  sentence cannot quote one figure for all of them. */
export function corePaySentence(
  depositCents: number | null,
  currency: string,
  locale: string
): string {
  const deposit =
    depositCents === null
      ? 'the core deposit'
      : `the ${formatMoney(depositCents, currency, locale)} core deposit`;
  return `Pay ${deposit} now. Your part is ready right away, and we pay the deposit back when your old part comes back.`;
}

/** The buy box's second choice: send the old part first, no deposit. */
export const CORE_FIRST_SENTENCE =
  'Send your old part first. No deposit. Your part is ready once it arrives.';

/** Said when only SOME versions of a product can be bought this way, so a shopper on a
 *  version that cannot is not surprised by the refusal. */
export const CORE_FIRST_SOME_VERSIONS = 'Not every version can be bought this way.';

/** The legend over both choices. */
export const CORE_CHOICE_LEGEND = 'Your old part';

/** What a basket line bought by sending the old part first says about itself. */
export const CORE_FIRST_LINE = 'Ready once your old part arrives';

/** The basket's shorter pair of labels, under a line that can be switched. */
export function coreLinePayLabel(depositCents: number, quantity: number, currency: string): string {
  return `Pay the ${formatMoney(depositCents, currency)} core deposit${quantity > 1 ? ' each' : ''} and get it now`;
}

export const CORE_LINE_FIRST_LABEL = 'Send my old part first, no deposit';

/** What the account's order page knows about one line's old parts. */
export interface OrderCoreFacts {
  quantity: number;
  /** Deposit per unit; null on a line with no deposit (none, or sent first). */
  coreChargeCents: number | null;
  coreFirst: boolean;
  /** Units still held until their old part arrives. */
  waitingForOldPart: number;
  coresOwed: number;
  coresReturned: number;
  coresKept: number;
}

const one = (n: number, single: string, many: string): string => (n === 1 ? single : many);

/**
 * The sentence under one order line about its old parts (sparx issues 051, 057).
 *
 * A deposit line says what is owed and what came back. A send-first line says that
 * there was no deposit, how many units are still held for their old part, and that
 * they ship when it arrives, because "where is my order?" is the question a buyer of
 * a held part asks first. Null when the line has nothing to do with an old part.
 */
export function orderCoreLine(
  item: OrderCoreFacts,
  orderNumber: string,
  currency: string
): string | null {
  if (item.coreFirst) {
    const lead = 'No deposit, because you are sending your old part first.';
    const waiting = item.waitingForOldPart;
    if (waiting > 0) {
      const which =
        waiting === item.quantity ? one(waiting, 'it', 'them') : `${String(waiting)} of them`;
      return `${lead} We hold ${which} until ${one(waiting, 'your old part arrives', 'your old parts arrive')}. Bring or send ${one(waiting, 'it', 'them')} to us with your order number, ${orderNumber}.`;
    }
    if (item.coresOwed > 0) {
      const owed = item.coresOwed;
      return `${lead} ${String(owed)} old ${one(owed, 'part', 'parts')} still to send. Bring or send ${one(owed, 'it', 'them')} to us with your order number, ${orderNumber}.`;
    }
    return 'No deposit, because you sent your old part first. Nothing left to send.';
  }
  if (item.coreChargeCents === null) return null;
  const owed = item.coresOwed;
  const parts = [`Refundable core deposit, ${formatMoney(item.coreChargeCents, currency)} each.`];
  parts.push(
    owed > 0
      ? `${String(owed)} old ${one(owed, 'part', 'parts')} still to send back. Bring ${one(owed, 'it', 'them')} in or send ${one(owed, 'it', 'them')} to us with your order number, ${orderNumber}. We pay the deposit back once we have checked ${one(owed, 'it', 'them')}.`
      : 'Nothing left to send back.'
  );
  if (item.coresReturned > 0) {
    parts.push(
      `${String(item.coresReturned)} came back and ${one(item.coresReturned, 'its deposit was', 'their deposits were')} paid back.`
    );
  }
  if (item.coresKept > 0) {
    parts.push(
      `${String(item.coresKept)} ${one(item.coresKept, 'deposit was', 'deposits were')} kept.`
    );
  }
  return parts.join(' ');
}

/** The heading over where old parts go. */
export const CORE_RETURN_HEADING = 'Where to send your old parts';

/** The sentence under it, or, when the business has no street address on file, the
 *  one that sends the buyer to ask rather than printing half an address. */
export function coreReturnSentence(orderNumber: string, hasAddress: boolean): string {
  return hasAddress
    ? `Put your order number, ${orderNumber}, in with each part so we know whose it is.`
    : `Contact us for where to send them, and keep your order number, ${orderNumber}, with each part.`;
}
