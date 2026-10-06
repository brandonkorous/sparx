// The round trip is the contract: a rule read into the control and saved back
// must come out the way it went in. The person column existed for months with
// no form that wrote it, so a save that quietly drops one half is the failure
// this file is here to catch.

import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_APPROVERS,
  ANY_APPROVER,
  APPROVER_ROLES,
  approverChoice,
  approverName,
  approverValue,
  namableApprovers,
  signOffChoice,
  signOffValue,
} from './approver-choice';

const NADIA = '71a8e916-38b7-4479-9ffa-95f2101a97d2';

describe('approverValue and approverChoice', () => {
  it('round-trips a named person', () => {
    const rule = { requiredRole: null, requiredApproverUserId: NADIA };
    expect(approverChoice(approverValue(rule))).toEqual(rule);
  });

  it('round-trips every role the control offers', () => {
    for (const role of APPROVER_ROLES) {
      const rule = { requiredRole: role.value || null, requiredApproverUserId: null };
      expect(approverChoice(approverValue(rule))).toEqual(rule);
    }
  });

  it('round-trips a rule that names nobody', () => {
    const rule = { requiredRole: null, requiredApproverUserId: null };
    expect(approverValue(rule)).toBe(ANY_APPROVER);
    expect(approverChoice(approverValue(rule))).toEqual(rule);
  });

  it('shows the person, not the role, when a rule carries both', () => {
    // The person is the stricter answer. Showing the role would let a save
    // write the role back and drop the name.
    expect(approverValue({ requiredRole: 'admin', requiredApproverUserId: NADIA })).toBe(
      `user:${NADIA}`
    );
  });

  it('clears the role when a person is chosen, and the person when a role is', () => {
    expect(approverChoice(`user:${NADIA}`).requiredRole).toBeNull();
    expect(approverChoice('owner').requiredApproverUserId).toBeNull();
  });

  it('reads a person prefix with no id as nobody, never as a role called "user:"', () => {
    expect(approverChoice('user:')).toEqual({ requiredRole: null, requiredApproverUserId: null });
  });
});

// sparx persona issue 087: a wholesale limit can be signed off by the account's
// own approvers. The server refuses `signOffBy: 'account'` beside a named
// teammate, and a choice that sends only one half keeps the other as it was.
describe('signOffValue and signOffChoice', () => {
  it('round-trips the account signing', () => {
    const rule = { signOffBy: 'account' as const, requiredApproverUserId: null };
    expect(signOffValue(rule)).toBe(ACCOUNT_APPROVERS);
    expect(signOffChoice(signOffValue(rule))).toEqual(rule);
  });

  it('round-trips a named teammate as the business signing', () => {
    const rule = { signOffBy: 'business' as const, requiredApproverUserId: NADIA };
    expect(signOffChoice(signOffValue(rule))).toEqual(rule);
  });

  it('round-trips anyone on the team', () => {
    const rule = { signOffBy: 'business' as const, requiredApproverUserId: null };
    expect(signOffValue(rule)).toBe(ANY_APPROVER);
    expect(signOffChoice(signOffValue(rule))).toEqual(rule);
  });

  it('never sends a teammate with the account, which the server refuses', () => {
    expect(signOffChoice(ACCOUNT_APPROVERS).requiredApproverUserId).toBeNull();
    // A rule read back with both shows the account, as the server treats it.
    expect(signOffValue({ signOffBy: 'account', requiredApproverUserId: NADIA })).toBe(
      ACCOUNT_APPROVERS
    );
  });

  it('always says who signs, so picking the team switches the account off', () => {
    expect(signOffChoice(ANY_APPROVER).signOffBy).toBe('business');
    expect(signOffChoice(`user:${NADIA}`).signOffBy).toBe('business');
  });

  it('is never read as a role or a person by the plain approver choice', () => {
    expect(ACCOUNT_APPROVERS.startsWith('user:')).toBe(false);
    expect(APPROVER_ROLES.some((role) => role.value === ACCOUNT_APPROVERS)).toBe(false);
  });
});

describe('namableApprovers', () => {
  it('leaves out people who have not arrived yet', () => {
    const people = namableApprovers([
      { userId: 'a', name: 'Nadia Osei', email: 'n@x.test', status: 'active' },
      { userId: 'b', name: 'Sam Invited', email: 's@x.test', status: 'invited' },
    ]);
    expect(people.map((p) => p.userId)).toEqual(['a']);
  });

  it('sorts by the name the reader sees', () => {
    const people = namableApprovers([
      { userId: 'z', name: 'Zoe', email: 'z@x.test', status: 'active' },
      { userId: 'a', name: null, email: 'amy@x.test', status: 'active' },
    ]);
    expect(people.map((p) => p.userId)).toEqual(['a', 'z']);
  });
});

describe('approverName', () => {
  it('uses the name when there is one', () => {
    expect(approverName({ name: ' Nadia Osei ', email: 'n@x.test' })).toBe('Nadia Osei');
  });

  it('falls back to the email when the name is blank', () => {
    expect(approverName({ name: '  ', email: 'n@x.test' })).toBe('n@x.test');
    expect(approverName({ name: null, email: 'n@x.test' })).toBe('n@x.test');
  });
});
