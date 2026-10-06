// WHO A HELD ORDER IS WAITING ON, IN WORDS (sparx persona issue 087): the team,
// the account's own approvers, or both. Never offer the team an order only the
// account can sign, never say "placed" while one side still waits.

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

export function whoAt(approvers: readonly AccountApprover[], companyName: string | null): string {
  const who = peopleWords(approvers.map((approver) => approver.name));
  return companyName ? `${who} at ${companyName}` : who;
}

// SAY IT ONCE: a badge or title that names who an order waits on is the name; the
// sentence beside it says only where and what next (sparx persona issue 087).

/** ", at Wasatch Front Utility Contractors, LLC", or nothing. */
export function atCompany(companyName: string | null): string {
  return companyName ? `, at ${companyName}` : '';
}

/** The subject for approvers a badge or title has already named, with its verb:
 *  "They approve", "Either of them approves", "Any of them approves". */
export function namedAlreadyApprove(approvers: readonly AccountApprover[]): string {
  if (approvers.length <= 1) return 'They approve';
  if (approvers.length === 2) return 'Either of them approves';
  return 'Any of them approves';
}
