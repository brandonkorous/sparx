// Who a held wholesale order asks, and who turned one down, as fields an
// automation can test and an email can print (sparx persona issue 087). The
// business's "sign it off" task opened for orders only the account's own
// approver could sign, and the "turned down" email told the buyer nothing about
// who said no or why.

import { describe, expect, it } from 'vitest';

import { approvalFields } from '../../src/resolvers/builtins';

describe('approvalFields on a held order', () => {
  it('says who the hold asks, as booleans a condition can compare', () => {
    const both = approvalFields('b2b.order.pending_approval', { asks: ['account', 'business'] });
    expect(both['approval.asksAccount']).toBe(true);
    expect(both['approval.asksBusiness']).toBe(true);

    const account = approvalFields('b2b.order.pending_approval', { asks: ['account'] });
    expect(account['approval.asksAccount']).toBe(true);
    expect(account['approval.asksBusiness']).toBe(false);
  });

  it('reads an old event with no asks as asking the business, which is all it could mean', () => {
    const old = approvalFields('b2b.order.pending_approval', { orderId: 'o-1' });
    expect(old['approval.asksBusiness']).toBe(true);
    expect(old['approval.asksAccount']).toBe(false);
  });
});

describe('approvalFields on a turned-down order', () => {
  it('carries who said no, why, and which side they were on', () => {
    const fields = approvalFields('b2b.order.rejected', {
      reason: 'We are over budget on fittings this month.',
      decidedBy: 'Teodora Vukić-Hale',
      side: 'account',
    });
    expect(fields['approval.reason']).toBe('We are over budget on fittings this month.');
    expect(fields['approval.decidedBy']).toBe('Teodora Vukić-Hale');
    expect(fields['approval.side']).toBe('account');
    expect(fields['approval.byAccount']).toBe('yes');
    expect(fields['approval.byBusiness']).toBe('');
  });

  it('says the business decided an old turn-down with no side', () => {
    const fields = approvalFields('b2b.order.rejected', { reason: null, decidedBy: 'Doty Brown' });
    expect(fields['approval.byBusiness']).toBe('yes');
    expect(fields['approval.byAccount']).toBe('');
    // No reason given: empty, so the email's "Why" row drops instead of
    // printing a heading over nothing.
    expect(fields['approval.reason']).toBe('');
  });

  it('asks nobody, since a decided order is not waiting on anyone', () => {
    const fields = approvalFields('b2b.order.rejected', { side: 'business' });
    expect(fields['approval.asksBusiness']).toBe(false);
    expect(fields['approval.asksAccount']).toBe(false);
  });
});
