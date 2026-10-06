// WHO A HELD ORDER IS WAITING ON, IN WORDS (sparx persona issue 087).
//
// Wasatch put Teodora on its account as "Can approve orders". Renée placed a
// $1,208 order over Wasatch's $1,000 limit, it was held, and it went to the
// business's own team. Teodora, the one person whose role said she approves
// orders, was never asked. The role did nothing.
//
// A spending limit now says who signs: the business's team, or the account's
// own approvers, on the site. A held order can wait on either side or both
// (account-order-gate.ts), so every place that shows one has to say which. The
// words live here, pure, so the console's screens say the same thing about the
// same order and the tests can pin it.
//
// Two facts the copy must never blur:
//   - An order waiting only on the account is not the business's to approve.
//     The server refuses it, so the screen does not offer it. The business can
//     always turn one down.
//   - An order the business has signed but the account has not is still
//     waiting. "Approved and placed" would be a promise about an order that
//     has not gone anywhere. [[feedback_a_promise_in_copy_is_a_contract]]

export type SignOffSide = 'account' | 'business';

export interface AccountApprover {
  customerId: string;
  name: string;
  email: string | null;
}

/** Where a held order's sign-off stands, as the approval queue sends it. */
export interface SignOff {
  needs: SignOffSide[];
  waitingOn: SignOffSide[];
  signed: Partial<Record<SignOffSide, { name: string; at: string }>>;
  /** Who at the account may sign. Empty unless the account is asked. */
  accountApprovers: AccountApprover[];
}

export type SignOffTone = 'success' | 'warning' | 'info';

/** Formats a signature's ISO time as a short day ("Oct 3"). Passed in so the
 *  words stay pure and the tests do not depend on the machine's locale. */
export type DayFormat = (iso: string) => string;

/** "Teodora Vukić-Hale", "A or B", "A, B, or C". The same joining the server's
 *  own refusal uses, so the screen and the error read alike. */
export function peopleWords(names: readonly string[]): string {
  if (names.length === 0) return 'someone there who can approve orders';
  if (names.length === 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0] ?? ''} or ${names[1] ?? ''}`;
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1] ?? ''}`;
}

function whoAt(approvers: readonly AccountApprover[], companyName: string | null): string {
  const who = peopleWords(approvers.map((approver) => approver.name));
  return companyName ? `${who} at ${companyName}` : who;
}

// ── SAY IT ONCE ──────────────────────────────────────────────────────────────
//
// A badge or a title that already names who an order waits on is the name. The
// sentence beside it carries only what the badge cannot: where they approve,
// which business they are at, what happens next. "Waiting for Teodora" over
// "Waiting for Teodora at Wasatch to approve it" read the name twice in two
// lines (sparx persona issue 087).

/** ", at Wasatch Front Utility Contractors, LLC", or nothing. */
function atCompany(companyName: string | null): string {
  return companyName ? `, at ${companyName}` : '';
}

/** The subject for approvers a badge or title has already named, with its verb:
 *  "They approve", "Either of them approves", "Any of them approves". */
function namedAlreadyApprove(approvers: readonly AccountApprover[]): string {
  if (approvers.length <= 1) return 'They approve';
  if (approvers.length === 2) return 'Either of them approves';
  return 'Any of them approves';
}

/* ── The rule's "who signs it off" control ─────────────────────────────── */

export interface SignOffRule {
  signOffBy: SignOffSide;
  accountName: string | null;
  /** For a rule about one account: who there can approve. Null for a rule
   *  covering every account, and for one account while that is still loading
   *  (unknown, which is not the same as nobody). */
  accountApprovers: AccountApprover[] | null;
}

/** The names in brackets after the account's option. Two at most, so a long
 *  list does not stretch the control across the row. */
function bracketNames(approvers: readonly AccountApprover[]): string {
  if (approvers.length === 0) return 'nobody yet';
  if (approvers.length <= 2) return approvers.map((approver) => approver.name).join(', ');
  return `${approvers
    .slice(0, 2)
    .map((approver) => approver.name)
    .join(', ')}, and ${String(approvers.length - 2)} more`;
}

/** The option for the account's own approvers: named for a rule about one
 *  account, general for a rule about every account. */
export function accountApproversOption(
  rule: Pick<SignOffRule, 'accountName' | 'accountApprovers'>
): string {
  if (rule.accountName === null) return 'Each account’s own approvers';
  // Not known yet: say whose, and nothing about how many, rather than
  // "nobody yet" for a list that has not arrived.
  if (rule.accountApprovers === null) return `${rule.accountName}’s approvers`;
  return `${rule.accountName}’s approvers (${bracketNames(rule.accountApprovers)})`;
}

export interface SignOffNote {
  tone: SignOffTone;
  text: string;
  /** The fix is on the account itself: give a contact "Can approve orders". */
  fixOnAccount: boolean;
}

/**
 * The line under a limit the account signs, or null when the business signs.
 *
 * A limit set to an account with nobody who can approve is allowed, because
 * nothing is stuck: the business's team signs until somebody there can. But a
 * row that only said "Wasatch's approvers" would let the owner believe Wasatch
 * was signing, so it says plainly that it is not yet, and how to change that.
 */
export function ruleSignOffNote(rule: SignOffRule): SignOffNote | null {
  if (rule.signOffBy !== 'account') return null;
  if (rule.accountName === null) {
    return {
      tone: 'info',
      text:
        'Each account’s own approvers say yes on your site. An account with nobody who can ' +
        'approve orders falls back to your team.',
      fixOnAccount: false,
    };
  }
  const approvers = rule.accountApprovers;
  if (approvers === null) return null;
  if (approvers.length === 0) {
    return {
      tone: 'warning',
      text:
        `Nobody at ${rule.accountName} can approve orders yet, so your team signs these off ` +
        'until someone there can. To change that, give one of their contacts “Can approve ' +
        'orders” on the account.',
      fixOnAccount: true,
    };
  }
  return {
    tone: 'info',
    text:
      `${whoAt(approvers, rule.accountName)} says yes on your site, and the order goes ahead ` +
      'as soon as they do. One over the account’s credit limit still needs your team too.',
    fixOnAccount: false,
  };
}

/* ── One held order in the queue ───────────────────────────────────────── */

export interface QueueSignOffView {
  /** The business's part is still to sign, so Approve is offered. */
  canApprove: boolean;
  /** State on the row: who has signed, who is still to. Empty on an order
   *  only the team was ever asked about: Approve already says that, and a
   *  badge every row repeats would say nothing. */
  badges: { label: string; tone: SignOffTone }[];
  /** What happens next, when it is not simply "you approve it". */
  line: string | null;
}

export function queueSignOffView(
  signOff: SignOff,
  companyName: string | null,
  day: DayFormat
): QueueSignOffView {
  const waitingOnUs = signOff.waitingOn.includes('business');
  const waitingOnThem = signOff.waitingOn.includes('account');
  const badges: QueueSignOffView['badges'] = [];
  const theirsInvolved = signOff.needs.includes('account');

  for (const side of ['account', 'business'] as const) {
    const signature = signOff.signed[side];
    if (signature) {
      badges.push({
        label: `Approved by ${signature.name}, ${day(signature.at)}`,
        tone: 'success',
      });
    }
  }
  if (waitingOnUs && theirsInvolved) badges.push({ label: 'Needs your approval', tone: 'warning' });
  if (waitingOnThem) {
    const only = signOff.accountApprovers.length === 1 ? signOff.accountApprovers[0] : undefined;
    badges.push({
      label: only ? `Waiting for ${only.name}` : 'Waiting for their approvers',
      tone: 'info',
    });
  }

  // The badge names one approver; with several it says "their approvers", so
  // the sentence names them instead. Either way the name is said once.
  const badgeNamesThem = signOff.accountApprovers.length === 1;
  const where = atCompany(companyName);
  const them = whoAt(signOff.accountApprovers, companyName);
  let line: string | null = null;
  if (waitingOnThem && !waitingOnUs) {
    line = badgeNamesThem
      ? `They approve it on your site${where}. It goes ahead as soon as they do, and you can ` +
        'still turn it down here.'
      : `${them} can approve it on your site. It goes ahead as soon as one of them does, and ` +
        'you can still turn it down here.';
  } else if (waitingOnThem && waitingOnUs) {
    line = badgeNamesThem
      ? 'Either of you can go first, and it goes ahead once you both have. They approve on ' +
        `your site${where}.`
      : 'Either side can go first, and it goes ahead once both have. ' +
        `${them} can approve on your site.`;
  } else if (waitingOnUs && signOff.signed.account) {
    // "Needs your approval" beside it already says whose turn it is.
    line = 'It goes ahead as soon as you approve it.';
  }

  return { canApprove: waitingOnUs, badges, line };
}

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

/* ── What approving did to stock ───────────────────────────────────────── */
//
// Placing a held order takes its stock then, not at checkout. When the shelves
// could not cover it, the approve call says so (`order.stock`), and until now
// nothing showed it: the toast said "The order is placed." and the customer was
// quietly owed goods (sparx persona issue 087). A note means the business owes
// somebody something, so it stays on screen until it is dismissed rather than
// fading with a toast, and it points at the Waiting list, where owed stock is
// handled.

/** One line of an approved order the shelves could not fully cover. */
export interface ApprovedStockLine {
  variantId: string;
  sku: string | null;
  name: string;
  /** Units of it on the order. */
  ordered: number;
  /** Units taken that were not free to sell. */
  notFree: number;
  /** Units now owed to this customer, on the Waiting list. */
  owed: number;
}

/** What placing the order did to stock, as the approve call sends it. */
export interface ApprovedStock {
  lines: ApprovedStockLine[];
  /** The server's sentence for whoever approved it. */
  note: string;
}

export interface ApprovedStockNotice {
  orderNumber: string;
  title: string;
  detail: string;
  /** Some of it is owed to this customer, so the Waiting list is offered. */
  owed: boolean;
}

/**
 * The warning after an approval that could not be filled from stock, or null
 * when there is nothing to say: every unit was there, or the order is still
 * waiting for somebody and took no stock yet.
 *
 * Units taken that were held for ANOTHER order are not owed to this customer,
 * so that case names the other order as the short one and offers no Waiting
 * list: nothing has been written there yet.
 */
export function approvedStockNotice(
  result: { orderNumber: string; status: string; stock?: ApprovedStock | null },
  buyer: string
): ApprovedStockNotice | null {
  if (result.status !== 'placed') return null;
  const stock = result.stock;
  const note = stock?.note.trim() ?? '';
  if (!stock || stock.lines.length === 0 || note === '') return null;
  const owed = stock.lines.some((line) => line.owed > 0);
  return {
    orderNumber: result.orderNumber,
    title: owed
      ? `Order ${result.orderNumber} is placed, but not all of it is in stock`
      : `Order ${result.orderNumber} is placed, and another order is now short`,
    detail: owed
      ? `${note} What ${buyer} is owed is on the Waiting list, which keeps track of it until more arrives.`
      : note,
    owed,
  };
}

/* ── The held order's own pane ─────────────────────────────────────────── */

export interface HeldOrderNotice {
  tone: 'warning' | 'info';
  title: string;
  detail: string;
}

/**
 * What the order pane says about a held order. `signOff` is null when the queue
 * could not say (it failed to load, or the order is not in it), and the pane
 * then says only what is certain: nothing goes out until it is approved.
 */
export function heldOrderNotice(
  signOff: SignOff | null,
  companyName: string | null,
  day: DayFormat
): HeldOrderNotice {
  if (signOff === null) {
    return {
      tone: 'warning',
      title: 'Waiting for sign-off',
      detail:
        'It went over a limit, so nothing goes out until it is approved. Approvals shows who ' +
        'it is waiting on.',
    };
  }
  const waitingOnUs = signOff.waitingOn.includes('business');
  const waitingOnThem = signOff.waitingOn.includes('account');
  const names = peopleWords(signOff.accountApprovers.map((approver) => approver.name));
  // The title names who; the detail says where and what next, never the
  // names again (see SAY IT ONCE above).
  const they = namedAlreadyApprove(signOff.accountApprovers);
  const where = atCompany(companyName);

  if (waitingOnThem && waitingOnUs) {
    return {
      tone: 'warning',
      title: `Waiting for your team and ${names}`,
      detail:
        `${they} on your site${where}, and your team approves under Approvals. Either can go ` +
        'first, and nothing goes out until both have.',
    };
  }
  if (waitingOnThem) {
    const ours = signOff.signed.business;
    return {
      tone: 'info',
      title: `Waiting for ${names}`,
      detail:
        `${they} it on your site${where}, and it goes ahead as soon as they do.` +
        (ours ? ` ${ours.name} approved it for your team on ${day(ours.at)}.` : '') +
        ' You can still turn it down under Approvals.',
    };
  }
  const theirs = signOff.signed.account;
  return {
    tone: 'warning',
    title: 'Waiting for your team',
    detail: theirs
      ? `${theirs.name}${companyName ? ` at ${companyName}` : ''} approved it on ${day(theirs.at)}. ` +
        'It goes ahead as soon as it is approved under Approvals.'
      : 'It went over a limit, so nothing goes out until it is approved under Approvals.',
  };
}

/* ── The account's contacts ────────────────────────────────────────────── */

/** What "Can approve orders" does, for the people choosing it. */
export const APPROVER_ROLE_MEANING =
  'Someone who can approve orders says yes, on your site, to any order held by a spending ' +
  'limit you set to the account’s own approvers under Approvals.';
