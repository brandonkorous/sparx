// What an approval rule says about who signs (sparx persona issue 087).
import { describe, expect, it } from 'vitest';
import { TEODORA, SAM, WASATCH } from './fixtures';
import { accountApproversOption, ruleSignOffNote } from './rule-words';

describe('the rule’s who-signs control', () => {
  it('names the account and its approvers on a rule about one account', () => {
    expect(accountApproversOption({ accountName: WASATCH, accountApprovers: [TEODORA] })).toBe(
      `${WASATCH}’s approvers (Teodora Vukić-Hale)`
    );
  });

  it('says nobody yet rather than an empty bracket', () => {
    expect(accountApproversOption({ accountName: WASATCH, accountApprovers: [] })).toContain(
      '(nobody yet)'
    );
  });

  it('says nothing about how many while the list is still loading', () => {
    expect(accountApproversOption({ accountName: WASATCH, accountApprovers: null })).toBe(
      `${WASATCH}’s approvers`
    );
    expect(
      ruleSignOffNote({ signOffBy: 'account', accountName: WASATCH, accountApprovers: null })
    ).toBeNull();
  });

  it('keeps a long list short', () => {
    const many = [TEODORA, SAM, { ...SAM, customerId: 'x', name: 'Lee Park' }];
    expect(accountApproversOption({ accountName: WASATCH, accountApprovers: many })).toBe(
      `${WASATCH}’s approvers (Teodora Vukić-Hale, Sam Okafor, and 1 more)`
    );
  });

  it('speaks of each account on a rule about every account', () => {
    expect(accountApproversOption({ accountName: null, accountApprovers: null })).toBe(
      'Each customer’s own approvers'
    );
  });
});

describe('ruleSignOffNote', () => {
  it('says nothing when the business signs', () => {
    expect(
      ruleSignOffNote({ signOffBy: 'business', accountName: WASATCH, accountApprovers: [TEODORA] })
    ).toBeNull();
  });

  it('warns, and says how to fix it, when the account has nobody who can approve', () => {
    const note = ruleSignOffNote({
      signOffBy: 'account',
      accountName: WASATCH,
      accountApprovers: [],
    });
    expect(note?.tone).toBe('warning');
    expect(note?.fixOnAccount).toBe(true);
    expect(note?.text).toContain(`Nobody at ${WASATCH} can approve orders yet`);
    expect(note?.text).toContain('your team signs these off');
    expect(note?.text).toContain('“Can approve orders”');
  });

  it('names who signs when the account has approvers', () => {
    const note = ruleSignOffNote({
      signOffBy: 'account',
      accountName: WASATCH,
      accountApprovers: [TEODORA],
    });
    expect(note?.tone).toBe('info');
    expect(note?.fixOnAccount).toBe(false);
    expect(note?.text).toContain(`Teodora Vukić-Hale at ${WASATCH} says yes on your site`);
  });

  it('says accounts with nobody fall back to the team on an every-account rule', () => {
    const note = ruleSignOffNote({
      signOffBy: 'account',
      accountName: null,
      accountApprovers: null,
    });
    expect(note?.text).toContain('falls back to your team');
  });
});
