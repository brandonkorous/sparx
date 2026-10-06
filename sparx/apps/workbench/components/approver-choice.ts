// WHO SIGNS IT OFF — one answer, written for a <select>.
//
// A spending rule can route to a ROLE ("any administrator") or to one named
// PERSON. Those are stored as two different columns, and that is right: a role
// survives somebody leaving, a name does not. But they answer ONE question, so
// they are ONE control. Two dropdowns would make the reader answer "who signs
// this off" twice and then work out which of their two answers wins.
//
// The encoding is a plain string so a native <select> can hold it:
//
//     ''              nobody in particular
//     'owner'         a role
//     'user:<uuid>'   one named person
//
// `user:` is a prefix rather than a bare uuid because a role word and a uuid
// are both strings, and a rule that names a person called "owner" is not a
// thing worth leaving to chance.
//
// Pure on purpose. The thing that goes wrong with a control like this is the
// round trip — read a rule, show it, save it back, and silently drop the half
// the form did not have a box for. That is what happened here: the person
// column has existed since this shipped, the list printed the name it held,
// and no form ever wrote one. So the round trip is what the test pins.

/** Nobody in particular: whoever the screen already lets in. */
export const ANY_APPROVER = '';

const USER = 'user:';

/** What a stored rule reads as in the control. */
export function approverValue(rule: {
  requiredRole?: string | null;
  requiredApproverUserId: string | null;
}): string {
  if (rule.requiredApproverUserId) return `${USER}${rule.requiredApproverUserId}`;
  return rule.requiredRole ?? ANY_APPROVER;
}

/** What the control's value means, as the two columns a rule is stored in. */
export function approverChoice(value: string): {
  requiredRole: string | null;
  requiredApproverUserId: string | null;
} {
  if (value.startsWith(USER)) {
    const id = value.slice(USER.length);
    // An empty id is not a person. Falling through to "nobody" rather than
    // sending `user:` to the server keeps a mangled option from clearing a
    // rule's role as a side effect.
    if (id) return { requiredRole: null, requiredApproverUserId: id };
    return { requiredRole: null, requiredApproverUserId: null };
  }
  return {
    requiredRole: value === ANY_APPROVER ? null : value,
    requiredApproverUserId: null,
  };
}

// ── THE ACCOUNT'S OWN APPROVERS (sparx persona issue 087) ──────────────────
//
// A spending limit on wholesale orders can be signed off by the people at the
// buying business whose role is "Can approve orders", on the site, instead of
// by anyone here. That is a third answer to the same question, so it is a third
// value in the same control. It is stored as a third column (`signOffBy`), and
// the server refuses a rule that asks for it AND names a teammate, so the two
// helpers below always send both halves: a choice that left one out would keep
// whatever the rule said before.
//
// Not a role word and not a `user:` value, so it can never be read as either.

/** The account's own approvers sign, on the site. */
export const ACCOUNT_APPROVERS = 'account:approvers';

export type SignOffBy = 'business' | 'account';

/** What a wholesale spending limit reads as in the control. */
export function signOffValue(rule: {
  signOffBy?: SignOffBy | null;
  requiredApproverUserId: string | null;
}): string {
  // The account wins over a stale name, as it does on the server: a rule the
  // account signs names nobody here.
  if (rule.signOffBy === 'account') return ACCOUNT_APPROVERS;
  return approverValue({ requiredApproverUserId: rule.requiredApproverUserId });
}

/** What the control's value means, as the two fields a limit is saved with. */
export function signOffChoice(value: string): {
  signOffBy: SignOffBy;
  requiredApproverUserId: string | null;
} {
  if (value === ACCOUNT_APPROVERS) return { signOffBy: 'account', requiredApproverUserId: null };
  return {
    signOffBy: 'business',
    requiredApproverUserId: approverChoice(value).requiredApproverUserId,
  };
}

/** The role words, as the person running the business reads them. */
export const APPROVER_ROLES: { value: string; label: string }[] = [
  { value: ANY_APPROVER, label: 'Anyone who can edit buying' },
  { value: 'editor', label: 'Anyone who can edit' },
  { value: 'admin', label: 'Any administrator' },
  { value: 'owner', label: 'The owner' },
];

/** One teammate, as the picker needs them. */
export interface ApproverPerson {
  userId: string;
  name: string | null;
  email: string;
  status: string;
}

/**
 * Who can actually be named.
 *
 * Only people who are already IN the account. Somebody invited on Tuesday has
 * no login yet, so naming them as the only person who may sign would park every
 * order behind an empty chair. The roster surface shows them as invited; this
 * list leaves them out until they arrive.
 */
export function namableApprovers(members: readonly ApproverPerson[]): ApproverPerson[] {
  return members
    .filter((member) => member.status === 'active')
    .slice()
    .sort((a, b) => approverName(a).localeCompare(approverName(b)));
}

/** A person's name, or the email they signed up with when they never set one. */
export function approverName(member: { name: string | null; email: string }): string {
  return member.name?.trim() ? member.name.trim() : member.email;
}
