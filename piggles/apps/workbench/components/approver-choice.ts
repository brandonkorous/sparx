// WHO SIGNS IT OFF, one answer for a <select>: '' nobody in particular, 'owner'
// a role, 'user:<uuid>' one named person. Role and person are two columns but ONE
// question. Pure so the round trip (read, show, save back) is what the test pins.

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

// THE ACCOUNT'S OWN APPROVERS (sparx persona issue 087): a third answer, stored as
// `signOffBy`. The server refuses it alongside a named teammate, so the helpers
// below always send both halves or a choice would keep the rule's old value.

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

// Who can actually be named: only people already IN the account. An invitee has
// no login yet, so naming them would park every order behind an empty chair.
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
