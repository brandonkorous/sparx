import { type SignOffSide, type AccountApprover, type SignOffTone, whoAt } from './people-words';

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
  if (rule.accountName === null) return 'Each customer’s own approvers';
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

// The line under a limit the account signs, or null when the business signs. With
// nobody there who can approve, the team signs, and the row says so plainly.
export function ruleSignOffNote(rule: SignOffRule): SignOffNote | null {
  if (rule.signOffBy !== 'account') return null;
  if (rule.accountName === null) {
    return {
      tone: 'info',
      text:
        'Each customer’s own approvers say yes on your site. A customer with nobody who can ' +
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
        'orders” on their customer page.',
      fixOnAccount: true,
    };
  }
  return {
    tone: 'info',
    text:
      `${whoAt(approvers, rule.accountName)} says yes on your site, and the order goes ahead ` +
      'as soon as they do. One over their credit limit still needs your team too.',
    fixOnAccount: false,
  };
}
