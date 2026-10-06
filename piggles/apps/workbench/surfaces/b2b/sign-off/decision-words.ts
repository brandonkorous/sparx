import { type SignOffSide, type SignOff, type DayFormat, whoAt } from './people-words';

/* ── Approving and rejecting ───────────────────────────────────────────── */

export interface DecisionFacts {
  orderNumber: string;
  buyer: string;
  /** The order's total, already formatted. */
  total: string;
  companyName: string | null;
  signOff: SignOff;
  overCreditLimit: boolean;
}

/** The approve dialog's sentence. When the account still has to sign, the
 *  business's yes does not place the order, and the dialog says so. */
export function approveWords(facts: DecisionFacts): string {
  const order = `${facts.orderNumber} from ${facts.buyer}, for ${facts.total}`;
  const credit = facts.overCreditLimit ? ' What they owe will go past their credit limit.' : '';
  if (facts.signOff.waitingOn.includes('account')) {
    return (
      `Your approval of order ${order} is recorded. It still waits for ` +
      `${whoAt(facts.signOff.accountApprovers, facts.companyName)}, and goes ahead as soon as ` +
      `they approve it.${credit}`
    );
  }
  return `Order ${order}, will be placed. If they're on terms, it will be invoiced.${credit}`;
}

/** The reject dialog's sentence. An order the account already approved is
 *  still the business's to turn down, and the dialog names who said yes. */
export function rejectWords(facts: DecisionFacts, day: DayFormat): string {
  const base = `Order ${facts.orderNumber} from ${facts.buyer}, for ${facts.total}, will be canceled. This can't be undone.`;
  const theirs = facts.signOff.signed.account;
  if (!theirs) return base;
  return `${base} ${theirs.name} approved it on ${day(theirs.at)}, and this cancels it anyway.`;
}

/** What the business's Approve did, from what the server answered. */
export function approveOutcome(
  result: { orderNumber: string; status: string; waitingOn?: SignOffSide[] },
  signOff: SignOff,
  companyName: string | null
): { title: string; description: string } {
  if (result.status === 'placed') {
    return { title: `Order ${result.orderNumber} approved`, description: 'The order is placed.' };
  }
  const waitingOn = result.waitingOn ?? signOff.waitingOn.filter((side) => side !== 'business');
  return {
    title: `Your approval is in for order ${result.orderNumber}`,
    description: waitingOn.includes('account')
      ? `It now waits for ${whoAt(signOff.accountApprovers, companyName)} to approve it, and goes ahead as soon as they do.`
      : 'It is still waiting for sign-off before it goes ahead.',
  };
}
