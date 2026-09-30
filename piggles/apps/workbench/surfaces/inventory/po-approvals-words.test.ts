import { describe, expect, it } from 'vitest';
import { placingWords, sentBackNote, thresholdWords, whoSignsLine } from './po-approvals-words';
import { approvalKeys, type PoApproval } from './po-approvals-data';
import { APPROVALS_QUERY_KEY } from './purchase-orders-data';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function approval(over: Partial<PoApproval>): PoApproval {
  return {
    id: 'a1',
    purchaseOrderId: 'po1',
    purchaseOrderNumber: 'PO-000004',
    supplierName: 'Ashcombe Mills',
    ruleId: 'r1',
    ruleName: 'Anything over $200',
    status: 'pending',
    amountCents: 28_800,
    currency: 'USD',
    requestedByUserId: 'u1',
    requestedByName: 'Devi Raman',
    requestedAt: '2026-09-18T10:00:00.000Z',
    requiredApproverUserId: null,
    requiredApproverName: null,
    requiredRole: null,
    decidedByUserId: null,
    decidedByName: null,
    decidedAt: null,
    note: null,
    waitingDays: 0,
    ...over,
  };
}

describe('a threshold in words', () => {
  it('says "or more", because the resolver is at-or-over', () => {
    // "Orders over $200" held an order of exactly $200.00. The comparison has to
    // stay `>=` for "leave it at 0 to hold every order" to be true, so the
    // sentence is what was wrong.
    expect(thresholdWords(20_000, money)).toBe('$200.00 or more');
  });

  it('calls a zero limit what it is', () => {
    expect(thresholdWords(0, money)).toBe('every order');
  });
});

describe('who has to sign it off', () => {
  it('names the role the rule routes to', () => {
    // The defect in one assertion: this said "Anybody who can approve spending
    // can sign it off" over a rule whose approver was The owner.
    const line = whoSignsLine(approval({ requiredRole: 'owner' }));
    expect(line).toBe('The owner has to sign it off. Held by “Anything over $200”.');
  });

  it('prefers a named person over the role', () => {
    expect(
      whoSignsLine(approval({ requiredApproverName: 'Devi Raman', requiredRole: 'admin' }))
    ).toContain('Devi Raman has to sign it off.');
  });

  it('only says "anybody" when the rule really named nobody', () => {
    expect(whoSignsLine(approval({}))).toBe(
      'Anybody who can approve spending can sign it off. Held by “Anything over $200”.'
    );
  });

  it('leaves the rule out when the rule is gone', () => {
    expect(
      whoSignsLine({ requiredApproverName: null, requiredRole: 'admin', ruleName: null })
    ).toBe('Any administrator has to sign it off.');
  });
});

describe('what pressing Place order really does', () => {
  const order = { number: 'PO-000004', supplierName: 'Ashcombe Mills' };

  it('does not promise the supplier will see it when a limit holds it', () => {
    // The dialog said "This sends the order and locks it" and the toast said
    // "PO-000004 placed". Nothing was sent.
    const words = placingWords(
      order,
      { name: 'Anything over $200', minAmountCents: 20_000 },
      money
    );
    expect(words.description).not.toContain('This sends the order');
    expect(words.description).toContain('will NOT go to Ashcombe Mills yet');
    expect(words.description).toContain('$200.00 or more');
    expect(words.confirmLabel).toBe('Send it for sign-off');
    expect(words.toastTitle).toBe('PO-000004 is waiting for sign-off');
    expect(words.toastTitle).not.toContain('placed');
    expect(words.toastDescription).toContain('Nothing has been ordered');
  });

  it('keeps the ordinary words when nothing holds it', () => {
    const words = placingWords(order, null, money);
    // Placing sends nothing to the supplier (submitPurchaseOrder only changes
    // the status), so the words must not say it does.
    expect(words.description).toContain('This places the order and locks it');
    expect(words.description).toContain('Nothing is sent to the supplier');
    expect(words.toastDescription).not.toContain('has gone');
    expect(words.confirmLabel).toBe('Place the order');
    expect(words.toastTitle).toBe('PO-000004 placed');
  });
});

describe('what the buyer is told when it comes back', () => {
  const rejected = approval({
    status: 'rejected',
    decidedByName: 'Devi Raman',
    decidedAt: '2026-09-18T10:30:00.000Z',
    note: 'Ask Ashcombe for a price on 24 first.',
    waitingDays: null,
  });

  it('shows the reason the approver was made to type', () => {
    // The dialog promises "Required. The buyer sees it." The buyer saw an
    // ordinary draft.
    const note = sentBackNote([rejected], 'draft');
    expect(note?.title).toBe('This was sent back to you');
    expect(note?.reason).toBe('Ask Ashcombe for a price on 24 first.');
    expect(note?.detail).toContain('Devi Raman turned it down');
    expect(note?.detail).toContain('it goes back to them, not to the supplier');
  });

  it('counts the times when it has bounced more than once', () => {
    const note = sentBackNote([rejected, approval({ ...rejected, id: 'a2' })], 'draft');
    expect(note?.detail).toContain('sent back 2 times');
  });

  it('says nothing about an order nobody has ever asked about', () => {
    expect(sentBackNote([], 'draft')).toBeNull();
    expect(sentBackNote(undefined, 'draft')).toBeNull();
  });

  it('says nothing once it has been signed off', () => {
    expect(sentBackNote([approval({ status: 'approved' })], 'draft')).toBeNull();
  });

  it('does not show a stale refusal over an order now waiting again', () => {
    // Resubmitting mints a NEW request. The old refusal alongside "waiting for
    // sign-off" reads as the new one having already been turned down.
    expect(sentBackNote([rejected, approval({ id: 'a3' })], 'pending_approval')).toBeNull();
  });

  it('is honest when the reason went missing', () => {
    expect(sentBackNote([approval({ ...rejected, note: null })], 'draft')?.reason).toBe(
      'No reason was recorded.'
    );
  });
});

describe('placing an order refreshes the sign-off queue', () => {
  it('invalidates the key the queue actually uses', () => {
    // `purchase-orders-data` cannot import `approvalKeys` — the approvals module
    // already imports `purchaseOrderKeys` from it, and the cycle is worse than
    // the duplicate. So the duplicate is asserted instead of trusted: if either
    // key is renamed, this goes red rather than the queue quietly going stale.
    expect(APPROVALS_QUERY_KEY).toEqual(approvalKeys.all);
  });
});
