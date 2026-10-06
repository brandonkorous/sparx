// Who a held trade order is waiting on, in words (sparx persona issue 087).
//
// A spending limit can be signed off by the account's own approvers, on this
// website, by the business, in its console, or by both. Renée's order said
// "waiting for us to approve it" while the only person who could release it was
// Teodora, her own colleague, who was never asked and had no button. Every
// sentence here names who has to say yes, and who already has, from the sign-off
// the API sends. The codes `account` and `business` never reach the page.
//
// `shopName` is the business's own name where the page knows it. Where it does
// not, the site speaks as the business does everywhere else on it: "us", "we".

import { formatMoney } from './format';

export type SignOffSide = 'account' | 'business';

/** Who has to say yes, who has, and who at the account may. The shape the API
 *  sends on a held order (`SignOffView` in `@wizeworks/b2b`). */
export interface SignOffView {
  needs: SignOffSide[];
  waitingOn: SignOffSide[];
  signed: Partial<Record<SignOffSide, { name: string; at: string }>>;
  /** Who at the account may sign. Empty unless the account is asked. */
  accountApprovers: { customerId: string; name: string; email: string | null }[];
}

/** "Teodora Vukić-Hale", "A or B", "A, B, or C". Any one of them can approve,
 *  so it is "or". Nobody named reads as the account, never as an empty gap. */
export function peopleWords(names: readonly string[]): string {
  const named = names.map((n) => n.trim()).filter((n) => n.length > 0);
  if (named.length === 0) return 'someone on your account';
  if (named.length === 1) return named[0]!;
  if (named.length === 2) return `${named[0]} or ${named[1]}`;
  return `${named.slice(0, -1).join(', ')}, or ${named[named.length - 1]}`;
}

/** The business as the object of a sentence: "Gillett Diesel Service", or "us". */
function businessObject(shopName: string | null | undefined): string {
  const named = shopName?.trim() ?? '';
  return named.length > 0 ? named : 'us';
}

/** "Gillett Diesel Service approves", or "we approve". */
function businessApproves(shopName: string | null | undefined): string {
  const named = shopName?.trim() ?? '';
  return named.length > 0 ? `${named} approves` : 'we approve';
}

/** Who is still to say yes. `both` needs one yes from each side, and either
 *  may come first; otherwise `text` is whoever approves it. */
function whoIsAsked(
  waitingOn: readonly SignOffSide[],
  approverNames: readonly string[],
  shopName: string | null | undefined
): { both: boolean; text: string } {
  const account = waitingOn.includes('account');
  const business = waitingOn.includes('business');
  if (account && business) {
    return {
      both: true,
      text: `one from ${peopleWords(approverNames)}, and one from ${businessObject(shopName)}`,
    };
  }
  if (account) return { both: false, text: peopleWords(approverNames) };
  return { both: false, text: businessObject(shopName) };
}

/**
 * What happens to a card on an order that waits for sign-off.
 *
 * `held`: the card is held for the amount and charged only when the order is
 * approved; a turned-down order is never charged. `charged`: the business's
 * card processor cannot hold a card, so it is charged now and refunded in full
 * if the order is turned down. `none`: no card, the order is billed to the
 * account or paid some other way. Sparx persona issue 087: the card used to be
 * charged whatever happened, and kept when the order was turned down.
 */
export type HeldCard = 'none' | 'held' | 'charged';

/** The sentence about the card while the order waits, or null when there is
 *  no card to talk about. */
function cardWhileWaiting(card: HeldCard | undefined): string | null {
  if (card === 'held') {
    return 'Your card is not charged unless it is approved, and nothing is sent until then.';
  }
  if (card === 'charged') {
    return 'Your card is charged now, and refunded in full if the order is turned down. Nothing is sent until it is approved.';
  }
  return null;
}

export interface ApprovalPreviewInput {
  /** Who will be asked if the order is placed as it stands. */
  waitingOn: SignOffSide[];
  /** The account's approvers by name, oldest first. Empty unless asked. */
  accountApprovers: string[];
  limitCents: number;
  currency: string;
  /** The trade account's own name, when the checkout knows it. */
  accountName: string | null;
  shopName: string | null;
  /** On the card form, whether the card will be held or charged. Left out
   *  where no card has been offered yet, or none will be used. */
  card?: HeldCard;
}

/**
 * Said on the payment step, before Place order: this order goes over the
 * account's spending limit, and who approves it before it goes ahead, and on
 * the card form what happens to the card meanwhile. Null when nobody will be
 * asked, so nothing is drawn.
 */
export function approvalPreviewSentence(input: ApprovalPreviewInput): string | null {
  if (input.waitingOn.length === 0) return null;
  const account = input.accountName?.trim() ?? '';
  const whose = account.length > 0 ? `${account}’s` : 'your account’s';
  const over = `This order is over ${whose} ${formatMoney(input.limitCents, input.currency)} limit`;
  const asked = whoIsAsked(input.waitingOn, input.accountApprovers, input.shopName);
  const then = cardWhileWaiting(input.card) ?? 'Nothing is sent until then.';
  if (asked.both) {
    return `${over}, so it needs two approvals before it goes ahead: ${asked.text}. ${then}`;
  }
  if (input.waitingOn.includes('account')) {
    return `${over}, so ${asked.text} approves it before it goes ahead. ${then}`;
  }
  return `${over}, so ${businessApproves(input.shopName)} it before it goes ahead. ${then}`;
}

/** What the checkout's complete call says about a held order. */
export interface PlacedApproval {
  waitingOn: SignOffSide[];
  accountApprovers: string[];
  limitCents: number | null;
}

/**
 * The confirmation's sentence about a held order, after its number: "is waiting
 * for Teodora Vukić-Hale to approve it. Your card is not charged unless ..."
 *
 * `card` is what happened to the card: held until it is approved, charged now
 * (a card processor that cannot hold one), or none. "Nothing is charged" is said
 * only where no card was used. An older api-rest sends no `approval`: the
 * business was the only one who could ever release a held order then, so that
 * is who it names.
 */
export function heldOrderSentence(input: {
  approval: PlacedApproval | null;
  shopName: string | null;
  card: HeldCard;
}): string {
  const waitingOn: SignOffSide[] =
    input.approval && input.approval.waitingOn.length > 0 ? input.approval.waitingOn : ['business'];
  const asked = whoIsAsked(waitingOn, input.approval?.accountApprovers ?? [], input.shopName);
  const head = asked.both
    ? `needs two approvals: ${asked.text}.`
    : `is waiting for ${asked.text} to approve it.`;
  const email = 'we will email you as soon as it is approved';
  if (input.card === 'held') {
    return `${head} Your card is not charged unless it is approved, and nothing is sent until then. We will email you as soon as it is.`;
  }
  if (input.card === 'charged') {
    return `${head} Nothing is sent until then, and ${email}. Your card has been charged, and if the order is turned down the full amount goes back to it.`;
  }
  return `${head} Nothing is charged or sent until then, and ${email}.`;
}

/**
 * Said on an order that was approved but whose held card could not be charged
 * when it was (sparx persona issue 087): a card can only be held for about a
 * week, and a bank can say no. The order has gone ahead unpaid, and the
 * business has a task to send a way to pay. `placedBy` names who placed it when
 * the person reading is someone else on the account; null when it is their own.
 */
export function cardNotChargedSentence(placedBy: string | null = null): string {
  const named = placedBy?.trim() ?? '';
  const card = named.length > 0 ? 'The card' : 'Your card';
  const to = named.length > 0 ? named : 'you';
  return `We could not take the payment for this order. ${card} was held when the order was placed, to be charged once the order was approved, and that charge did not go through. Nothing has been taken, and we will send ${to} a way to pay for it.`;
}

/** "your approval", "your approval, or Ana Ruiz’s": the account's part of a
 *  sign-off said to one of its own approvers. Null when the viewer is not one
 *  of the approvers being waited on. */
function yourPart(
  signOff: SignOffView,
  waitingOn: readonly SignOffSide[],
  viewerId: string | null
): { long: string; short: string } | null {
  if (viewerId === null || !waitingOn.includes('account')) return null;
  if (!signOff.accountApprovers.some((a) => a.customerId === viewerId)) return null;
  const others = signOff.accountApprovers
    .filter((a) => a.customerId !== viewerId)
    .map((a) => a.name);
  if (others.length === 0) return { long: 'your approval', short: 'yours' };
  if (others.length === 1) {
    return { long: `your approval, or ${others[0]}’s`, short: `yours or ${others[0]}’s` };
  }
  const them = peopleWords(others);
  return { long: `your approval, or that of ${them}`, short: `yours or that of ${them}` };
}

/** "Waiting for Teodora Vukić-Hale to approve it." on an order page, for an
 *  order that is still held. `viewerId` is the signed-in customer: Teodora read
 *  her own name in "Waiting for Teodora Vukić-Hale" over her own Approve button
 *  (sparx persona issue 087), so an approver being waited on is told "your
 *  approval" instead. */
export function signOffWaitingSentence(
  signOff: SignOffView,
  shopName: string | null = null,
  viewerId: string | null = null
): string {
  const waitingOn = signOff.waitingOn.length > 0 ? signOff.waitingOn : signOff.needs;
  const yours = yourPart(signOff, waitingOn, viewerId);
  if (yours) {
    return waitingOn.includes('business')
      ? `It needs two approvals: ${yours.short}, and one from ${businessObject(shopName)}.`
      : `This order is waiting for ${yours.long}.`;
  }
  const asked = whoIsAsked(
    waitingOn,
    signOff.accountApprovers.map((a) => a.name),
    shopName
  );
  return asked.both
    ? `It needs two approvals: ${asked.text}.`
    : `Waiting for ${asked.text} to approve it.`;
}

/** "Your order O-000012 is waiting for Teodora Vukić-Hale to approve it.", for
 *  a page that speaks about the order from somewhere else, like the quote it
 *  was made from. Says only that it is waiting when the sign-off is not known,
 *  rather than guess whose yes it needs. */
export function orderWaitingSentence(
  orderNumber: string,
  signOff: SignOffView | null | undefined,
  shopName: string | null = null
): string {
  if (!signOff) return `Your order ${orderNumber} is waiting for approval before it goes ahead.`;
  const asked = whoIsAsked(
    signOff.waitingOn.length > 0 ? signOff.waitingOn : signOff.needs,
    signOff.accountApprovers.map((a) => a.name),
    shopName
  );
  return asked.both
    ? `Your order ${orderNumber} needs two approvals: ${asked.text}.`
    : `Your order ${orderNumber} is waiting for ${asked.text} to approve it.`;
}

function dayWords(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Who has already approved a held order, one sentence each, account first:
 *  "Teodora Vukić-Hale approved it on October 1, 2026.", or "You approved it"
 *  when the signature is the viewer's own. A signature carries a name, not an
 *  id, so it is the viewer's when it is the name of the approver they are. */
export function signedSentences(
  signOff: SignOffView,
  shopName: string | null = null,
  viewerId: string | null = null
): string[] {
  const out: string[] = [];
  const account = signOff.signed.account;
  if (account) {
    const mine =
      viewerId !== null &&
      signOff.accountApprovers.some((a) => a.customerId === viewerId && a.name === account.name);
    out.push(`${mine ? 'You' : account.name} approved it on ${dayWords(account.at)}.`);
  }
  const business = signOff.signed.business;
  if (business) {
    const named = shopName?.trim() ?? '';
    out.push(
      named.length > 0
        ? `${business.name} at ${named} approved it on ${dayWords(business.at)}.`
        : `${business.name} on our team approved it on ${dayWords(business.at)}.`
    );
  }
  return out;
}

/** "This order is over your account’s $1,000.00 limit." Null when the order
 *  was not held by a spending limit (or the limit has since been removed). */
export function overLimitSentence(limitCents: number | null, currency: string): string | null {
  if (limitCents === null) return null;
  return `This order is over your account’s ${formatMoney(limitCents, currency)} limit.`;
}

/** What an approver's decision did, for the order page they made it on. */
export function decisionResultSentence(input: {
  decision: 'approved' | 'turned_down';
  orderNumber: string;
  /** From the approve call: `placed` when theirs was the last yes needed. */
  status?: string;
  waitingOn?: SignOffSide[];
  shopName?: string | null;
}): string {
  if (input.decision === 'turned_down') {
    return `You turned down order ${input.orderNumber}. It is canceled and will not go ahead.`;
  }
  if (input.status === 'placed' || (input.waitingOn ?? []).length === 0) {
    return `You approved order ${input.orderNumber}. It has gone ahead.`;
  }
  const named = input.shopName?.trim() ?? '';
  return named.length > 0
    ? `You approved order ${input.orderNumber}. It now waits for ${named} to approve it too, and goes ahead as soon as they do.`
    : `You approved order ${input.orderNumber}. It now waits for us to approve it too, and goes ahead as soon as we do.`;
}

/** One line of an approved order that was short of stock, as the approve call
 *  sends it (`order.stock.lines`). */
export interface ApprovedStockLine {
  name: string;
  /** Units of it on the order. */
  ordered: number;
  /** Units not in stock, so they are sent when more arrive. */
  owed: number;
}

/**
 * What an approver is told when their yes placed the order but some of it was
 * not in stock (sparx persona issue 087). Null when everything was there, so
 * nothing extra is said.
 *
 * Only what THIS order is owed is said. The server also notes units that were
 * set aside for somebody else's order; this order still gets those, so that is
 * the business's matter and not the buyer's.
 */
export function followsLaterSentence(
  stock: { lines: readonly ApprovedStockLine[] } | null | undefined
): string | null {
  const short = (stock?.lines ?? []).filter((line) => line.owed > 0);
  if (short.length === 0) return null;
  const parts = short.map((line) => {
    const name = line.name.trim() || 'An item';
    if (line.owed >= line.ordered) {
      return line.ordered === 1
        ? `${name} is not in stock yet.`
        : `${name}: none of the ${String(line.ordered)} on this order are in stock yet.`;
    }
    return `${name}: ${String(line.owed)} of the ${String(line.ordered)} on this order ${
      line.owed === 1 ? 'is' : 'are'
    } not in stock yet.`;
  });
  const one = short.length === 1 && short[0]!.owed === 1;
  return (
    `Part of this order will follow later. ${parts.join(' ')} ` +
    (one
      ? 'It will be sent as soon as more arrive. You do not need to order it again.'
      : 'They will be sent as soon as more arrive. You do not need to order them again.')
  );
}

/** "2 orders on Wasatch Front Utility Contractors, LLC are waiting for your
 *  approval.", for the account overview an approver lands on. */
export function waitingForYouSentence(count: number, accountName: string): string {
  const name = accountName.trim();
  const where = name.length > 0 ? ` on ${name}` : '';
  return count === 1
    ? `1 order${where} is waiting for your approval.`
    : `${count} orders${where} are waiting for your approval.`;
}

/** "1 item", "3 items". */
export function itemCountWords(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}

/** One order waiting for an approver, as the facts under its number:
 *  "Placed by Renée Castañeda on October 1, 2026", "Over your account’s $1,000.00 limit",
 *  "PO WFU-PO-24-0917", "3 items", and whether we sign it too. */
export function approvalItemFacts(item: {
  placedBy: string;
  createdAt: string;
  limitCents: number | null;
  currency: string;
  poNumber: string | null;
  itemCount: number;
  businessToo: boolean;
}): string[] {
  const facts = [`Placed by ${item.placedBy} on ${dayWords(item.createdAt)}`];
  if (item.limitCents !== null) {
    facts.push(`Over your account’s ${formatMoney(item.limitCents, item.currency)} limit`);
  }
  if (item.poNumber) facts.push(`Your PO number ${item.poNumber}`);
  facts.push(itemCountWords(item.itemCount));
  if (item.businessToo) facts.push('Needs our approval too');
  return facts;
}

/** The note on a card processor's own payment page, where the buyer is sent to
 *  pay rather than paying on this one. */
export const HOSTED_PAYMENT_NOTE =
  'You’ll finish paying securely on your payment provider’s page, then return here.';

/**
 * One info box on a payment screen, never two stacked: who approves the order
 * first, then what this way of paying says. Two boxes of the same color read as
 * one cluttered block (sparx persona issue 087). With nobody to approve it, the
 * screen's own note alone; with neither, nothing.
 */
export function paymentNotice(
  approval: string | null,
  then?: string,
  otherwise?: string
): string | null {
  if (approval) return then ? `${approval} ${then}` : approval;
  return otherwise ?? null;
}
