// Sparx persona issue 087: a held trade order names who has to approve it. The
// account's own approver was never asked and the site said "waiting for us".

import { describe, expect, it } from 'vitest';

import {
  approvalItemFacts,
  approvalPreviewSentence,
  cardNotChargedSentence,
  decisionResultSentence,
  followsLaterSentence,
  heldOrderSentence,
  orderWaitingSentence,
  overLimitSentence,
  peopleWords,
  signedSentences,
  signOffWaitingSentence,
  HOSTED_PAYMENT_NOTE,
  paymentNotice,
  waitingForYouSentence,
  type SignOffView,
} from './sign-off-words';

const TEODORA = { customerId: 'c-1', name: 'Teodora Vukić-Hale', email: null };
const ANA = { customerId: 'c-2', name: 'Ana Ruiz', email: null };
// Midday UTC, so the day reads the same in every time zone a test runs in.
const OCT_1 = '2026-10-01T12:00:00.000Z';
const OCT_2 = '2026-10-02T12:00:00.000Z';

function signOff(patch: Partial<SignOffView>): SignOffView {
  return { needs: [], waitingOn: [], signed: {}, accountApprovers: [], ...patch };
}

describe('peopleWords', () => {
  it('joins approvers with "or": any one of them can say yes', () => {
    expect(peopleWords(['Teodora Vukić-Hale'])).toBe('Teodora Vukić-Hale');
    expect(peopleWords(['Teodora Vukić-Hale', 'Ana Ruiz'])).toBe('Teodora Vukić-Hale or Ana Ruiz');
    expect(peopleWords(['A', 'B', 'C'])).toBe('A, B, or C');
  });

  it('never leaves a gap where nobody is named', () => {
    expect(peopleWords([])).toBe('someone on your account');
    expect(peopleWords(['  '])).toBe('someone on your account');
  });
});

describe('before the order is placed', () => {
  const base = {
    accountApprovers: [] as string[],
    limitCents: 100_000,
    currency: 'USD',
    accountName: 'Wasatch Front Utility Contractors, LLC',
    shopName: 'Gillett Diesel Service',
  };

  it('names the account approver when the account signs', () => {
    expect(
      approvalPreviewSentence({
        ...base,
        waitingOn: ['account'],
        accountApprovers: ['Teodora Vukić-Hale'],
      })
    ).toBe(
      'This order is over Wasatch Front Utility Contractors, LLC’s $1,000.00 limit, so Teodora Vukić-Hale approves it before it goes ahead. Nothing is sent until then.'
    );
  });

  it('names the business when it signs', () => {
    expect(approvalPreviewSentence({ ...base, waitingOn: ['business'] })).toBe(
      'This order is over Wasatch Front Utility Contractors, LLC’s $1,000.00 limit, so Gillett Diesel Service approves it before it goes ahead. Nothing is sent until then.'
    );
  });

  it('names both when both sign', () => {
    expect(
      approvalPreviewSentence({
        ...base,
        waitingOn: ['account', 'business'],
        accountApprovers: ['Teodora Vukić-Hale', 'Ana Ruiz'],
      })
    ).toBe(
      'This order is over Wasatch Front Utility Contractors, LLC’s $1,000.00 limit, so it needs two approvals before it goes ahead: one from Teodora Vukić-Hale or Ana Ruiz, and one from Gillett Diesel Service. Nothing is sent until then.'
    );
  });

  it('speaks as the business when it does not know its own name or the account’s', () => {
    expect(
      approvalPreviewSentence({ ...base, waitingOn: ['business'], accountName: null, shopName: '' })
    ).toBe(
      'This order is over your account’s $1,000.00 limit, so we approve it before it goes ahead. Nothing is sent until then.'
    );
  });

  it('says nothing when nobody will be asked', () => {
    expect(approvalPreviewSentence({ ...base, waitingOn: [] })).toBeNull();
  });

  // Sparx persona issue 087: the card used to be charged at checkout whatever
  // happened, and kept when the order was turned down.
  it('on the card form, says the card is held and not charged unless it is approved', () => {
    expect(
      approvalPreviewSentence({
        ...base,
        waitingOn: ['account'],
        accountApprovers: ['Teodora Vukić-Hale'],
        card: 'held',
      })
    ).toBe(
      'This order is over Wasatch Front Utility Contractors, LLC’s $1,000.00 limit, so Teodora Vukić-Hale approves it before it goes ahead. Your card is not charged unless it is approved, and nothing is sent until then.'
    );
  });

  it('where the card cannot be held, says it is charged now and refunded if turned down', () => {
    expect(approvalPreviewSentence({ ...base, waitingOn: ['business'], card: 'charged' })).toBe(
      'This order is over Wasatch Front Utility Contractors, LLC’s $1,000.00 limit, so Gillett Diesel Service approves it before it goes ahead. Your card is charged now, and refunded in full if the order is turned down. Nothing is sent until it is approved.'
    );
  });
});

describe('the confirmation of a held order', () => {
  it('names the account approver, and says the held card is not charged unless it is approved', () => {
    expect(
      heldOrderSentence({
        approval: {
          waitingOn: ['account'],
          accountApprovers: ['Teodora Vukić-Hale'],
          limitCents: 1,
        },
        shopName: 'Gillett Diesel Service',
        card: 'held',
      })
    ).toBe(
      'is waiting for Teodora Vukić-Hale to approve it. Your card is not charged unless it is approved, and nothing is sent until then. We will email you as soon as it is.'
    );
  });

  it('says a card that could not be held was charged, and goes back in full if turned down', () => {
    expect(
      heldOrderSentence({
        approval: { waitingOn: ['business'], accountApprovers: [], limitCents: 1 },
        shopName: 'Gillett Diesel Service',
        card: 'charged',
      })
    ).toBe(
      'is waiting for Gillett Diesel Service to approve it. Nothing is sent until then, and we will email you as soon as it is approved. Your card has been charged, and if the order is turned down the full amount goes back to it.'
    );
  });

  it('names the business, and says nothing is charged when billed to the account', () => {
    expect(
      heldOrderSentence({
        approval: { waitingOn: ['business'], accountApprovers: [], limitCents: 1 },
        shopName: 'Gillett Diesel Service',
        card: 'none',
      })
    ).toBe(
      'is waiting for Gillett Diesel Service to approve it. Nothing is charged or sent until then, and we will email you as soon as it is approved.'
    );
  });

  it('names both', () => {
    expect(
      heldOrderSentence({
        approval: {
          waitingOn: ['account', 'business'],
          accountApprovers: ['Teodora Vukić-Hale'],
          limitCents: 1,
        },
        shopName: null,
        card: 'none',
      })
    ).toBe(
      'needs two approvals: one from Teodora Vukić-Hale, and one from us. Nothing is charged or sent until then, and we will email you as soon as it is approved.'
    );
  });

  it('names the business when an older server says nothing about who', () => {
    expect(heldOrderSentence({ approval: null, shopName: null, card: 'none' })).toBe(
      'is waiting for us to approve it. Nothing is charged or sent until then, and we will email you as soon as it is approved.'
    );
  });
});

describe('an order page', () => {
  it('says who it is still waiting on', () => {
    expect(
      signOffWaitingSentence(
        signOff({ needs: ['account'], waitingOn: ['account'], accountApprovers: [TEODORA, ANA] })
      )
    ).toBe('Waiting for Teodora Vukić-Hale or Ana Ruiz to approve it.');
    expect(signOffWaitingSentence(signOff({ needs: ['business'], waitingOn: ['business'] }))).toBe(
      'Waiting for us to approve it.'
    );
    expect(
      signOffWaitingSentence(
        signOff({
          needs: ['account', 'business'],
          waitingOn: ['account', 'business'],
          accountApprovers: [TEODORA],
        })
      )
    ).toBe('It needs two approvals: one from Teodora Vukić-Hale, and one from us.');
  });

  it('stops naming a side once it has signed', () => {
    expect(
      signOffWaitingSentence(
        signOff({
          needs: ['account', 'business'],
          waitingOn: ['business'],
          signed: { account: { name: 'Teodora Vukić-Hale', at: OCT_1 } },
          accountApprovers: [TEODORA],
        })
      )
    ).toBe('Waiting for us to approve it.');
  });

  it('names the order and who it waits on, from a page about something else', () => {
    expect(
      orderWaitingSentence(
        'O-000012',
        signOff({
          needs: ['account', 'business'],
          waitingOn: ['account'],
          signed: { business: { name: 'Doty Brown', at: OCT_1 } },
          accountApprovers: [TEODORA],
        }),
        'Gillett Diesel Service'
      )
    ).toBe('Your order O-000012 is waiting for Teodora Vukić-Hale to approve it.');
    expect(orderWaitingSentence('O-000012', null)).toBe(
      'Your order O-000012 is waiting for approval before it goes ahead.'
    );
  });

  it('says which limit it went over, and nothing when no limit held it', () => {
    expect(overLimitSentence(100_000, 'USD')).toBe(
      'This order is over your account’s $1,000.00 limit.'
    );
    expect(overLimitSentence(null, 'USD')).toBeNull();
  });

  it('says who has already approved, and when', () => {
    expect(
      signedSentences(
        signOff({
          needs: ['account', 'business'],
          signed: {
            business: { name: 'Doty Brown', at: OCT_2 },
            account: { name: 'Teodora Vukić-Hale', at: OCT_1 },
          },
        })
      )
    ).toEqual([
      'Teodora Vukić-Hale approved it on October 1, 2026.',
      'Doty Brown on our team approved it on October 2, 2026.',
    ]);
    expect(signedSentences(signOff({ needs: ['account'] }))).toEqual([]);
  });
});

describe('an approver’s decision', () => {
  it('says the order went ahead when theirs was the last yes', () => {
    expect(
      decisionResultSentence({
        decision: 'approved',
        orderNumber: 'O-000014',
        status: 'placed',
        waitingOn: [],
      })
    ).toBe('You approved order O-000014. It has gone ahead.');
  });

  it('says it now waits for the business when the business signs too', () => {
    expect(
      decisionResultSentence({
        decision: 'approved',
        orderNumber: 'O-000014',
        status: 'pending_approval',
        waitingOn: ['business'],
      })
    ).toBe(
      'You approved order O-000014. It now waits for us to approve it too, and goes ahead as soon as we do.'
    );
  });

  it('says a turned-down order is canceled', () => {
    expect(decisionResultSentence({ decision: 'turned_down', orderNumber: 'O-000014' })).toBe(
      'You turned down order O-000014. It is canceled and will not go ahead.'
    );
  });
});

// Teodora's yes placed the order, and the shelves were short: part of it is now
// owed to Wasatch. She is told it follows later, and nothing when all of it was
// there (sparx persona issue 087).
describe('an approval that was short of stock', () => {
  const kit = { name: 'S&S CP4 kit', ordered: 3, owed: 2 };

  it('says part of the order follows later, and how much', () => {
    expect(followsLaterSentence({ lines: [kit] })).toBe(
      'Part of this order will follow later. S&S CP4 kit: 2 of the 3 on this order are not in stock yet. They will be sent as soon as more arrive. You do not need to order them again.'
    );
  });

  it('speaks of one unit as "it"', () => {
    expect(followsLaterSentence({ lines: [{ name: 'Injector', ordered: 1, owed: 1 }] })).toBe(
      'Part of this order will follow later. Injector is not in stock yet. It will be sent as soon as more arrive. You do not need to order it again.'
    );
  });

  it('says when none of a line is in stock', () => {
    expect(followsLaterSentence({ lines: [{ ...kit, owed: 3 }] })).toContain(
      'S&S CP4 kit: none of the 3 on this order are in stock yet.'
    );
  });

  it('says nothing when the order took no stock it did not have', () => {
    expect(followsLaterSentence(null)).toBeNull();
    expect(followsLaterSentence(undefined)).toBeNull();
    expect(followsLaterSentence({ lines: [] })).toBeNull();
  });

  it('says nothing to the buyer about stock that was held for another order', () => {
    // Taken from someone else's hold: this order gets it, the other one waits.
    expect(followsLaterSentence({ lines: [{ ...kit, owed: 0 }] })).toBeNull();
  });
});

// Teodora read "Waiting for Teodora Vukić-Hale to approve it" over her own
// Approve button. The approver being waited on is spoken to.
describe('an approver reading their own order page', () => {
  it('says "your approval" instead of their name', () => {
    const waiting = signOff({
      needs: ['account'],
      waitingOn: ['account'],
      accountApprovers: [TEODORA],
    });
    expect(signOffWaitingSentence(waiting, null, 'c-1')).toBe(
      'This order is waiting for your approval.'
    );
  });

  it('names the other approvers who could say yes instead', () => {
    const waiting = signOff({
      needs: ['account'],
      waitingOn: ['account'],
      accountApprovers: [TEODORA, ANA],
    });
    expect(signOffWaitingSentence(waiting, null, 'c-1')).toBe(
      'This order is waiting for your approval, or Ana Ruiz’s.'
    );
    expect(
      signOffWaitingSentence(
        signOff({
          needs: ['account'],
          waitingOn: ['account'],
          accountApprovers: [TEODORA, ANA, { customerId: 'c-3', name: 'Bo Li', email: null }],
        }),
        null,
        'c-1'
      )
    ).toBe('This order is waiting for your approval, or that of Ana Ruiz or Bo Li.');
  });

  it('says "yours" when the business signs too', () => {
    expect(
      signOffWaitingSentence(
        signOff({
          needs: ['account', 'business'],
          waitingOn: ['account', 'business'],
          accountApprovers: [TEODORA],
        }),
        null,
        'c-1'
      )
    ).toBe('It needs two approvals: yours, and one from us.');
  });

  it('names them as usual to anyone who is not one of the approvers', () => {
    const waiting = signOff({
      needs: ['account'],
      waitingOn: ['account'],
      accountApprovers: [TEODORA],
    });
    expect(signOffWaitingSentence(waiting, null, 'c-9')).toBe(
      'Waiting for Teodora Vukić-Hale to approve it.'
    );
  });

  it('says "You approved it" for their own signature', () => {
    const signed = signOff({
      needs: ['account', 'business'],
      waitingOn: ['business'],
      signed: { account: { name: 'Teodora Vukić-Hale', at: OCT_1 } },
      accountApprovers: [TEODORA, ANA],
    });
    expect(signedSentences(signed, null, 'c-1')).toEqual(['You approved it on October 1, 2026.']);
    expect(signedSentences(signed, null, 'c-2')).toEqual([
      'Teodora Vukić-Hale approved it on October 1, 2026.',
    ]);
  });
});

describe('the account overview an approver lands on', () => {
  it('counts the orders waiting for them on each account', () => {
    expect(waitingForYouSentence(1, 'Wasatch Front Utility Contractors, LLC')).toBe(
      '1 order on Wasatch Front Utility Contractors, LLC is waiting for your approval.'
    );
    expect(waitingForYouSentence(2, 'Wasatch Front Utility Contractors, LLC')).toBe(
      '2 orders on Wasatch Front Utility Contractors, LLC are waiting for your approval.'
    );
  });
});

describe('an order waiting for an approver', () => {
  const item = {
    placedBy: 'Renée Castañeda',
    createdAt: OCT_1,
    limitCents: 100_000,
    currency: 'USD',
    poNumber: 'WFU-PO-24-0917',
    itemCount: 3,
    businessToo: false,
  };

  it('says who placed it, when, the limit it went over, the PO number and the items', () => {
    expect(approvalItemFacts(item)).toEqual([
      'Placed by Renée Castañeda on October 1, 2026',
      'Over your account’s $1,000.00 limit',
      'Your PO number WFU-PO-24-0917',
      '3 items',
    ]);
  });

  it('leaves out what it does not know, and says when we approve it too', () => {
    expect(
      approvalItemFacts({
        ...item,
        limitCents: null,
        poNumber: null,
        itemCount: 1,
        businessToo: true,
      })
    ).toEqual(['Placed by Renée Castañeda on October 1, 2026', '1 item', 'Needs our approval too']);
  });
});

describe('an approved order whose held card could not be charged', () => {
  it('asks the buyer to pay, and says nothing was taken', () => {
    expect(cardNotChargedSentence()).toBe(
      'We could not take the payment for this order. Your card was held when the order was placed, to be charged once the order was approved, and that charge did not go through. Nothing has been taken, and we will send you a way to pay for it.'
    );
  });

  it('names who placed it for somebody else on the account', () => {
    expect(cardNotChargedSentence('Renée Castañeda')).toBe(
      'We could not take the payment for this order. The card was held when the order was placed, to be charged once the order was approved, and that charge did not go through. Nothing has been taken, and we will send Renée Castañeda a way to pay for it.'
    );
  });
});

// One info box on the provider-page payment screen, not two stacked: who
// approves it and what happens to the card, then where they finish paying
// (sparx persona issue 087).
describe('the one note on a payment screen', () => {
  const preview = {
    waitingOn: ['account' as const],
    accountApprovers: ['Teodora Vukić-Hale'],
    limitCents: 100_000,
    currency: 'USD',
    accountName: 'Wasatch Front Utility Contractors, LLC',
    shopName: 'Gillett Diesel Service',
  };

  it('puts the approval first, then the screen’s own note, for a card that is held', () => {
    expect(
      paymentNotice(
        approvalPreviewSentence({ ...preview, card: 'held' }),
        HOSTED_PAYMENT_NOTE,
        HOSTED_PAYMENT_NOTE
      )
    ).toBe(
      'This order is over Wasatch Front Utility Contractors, LLC’s $1,000.00 limit, so Teodora Vukić-Hale approves it before it goes ahead. Your card is not charged unless it is approved, and nothing is sent until then. You’ll finish paying securely on your payment provider’s page, then return here.'
    );
  });

  it('says the card is charged now where the processor cannot hold it', () => {
    expect(
      paymentNotice(
        approvalPreviewSentence({ ...preview, card: 'charged' }),
        HOSTED_PAYMENT_NOTE,
        HOSTED_PAYMENT_NOTE
      )
    ).toBe(
      'This order is over Wasatch Front Utility Contractors, LLC’s $1,000.00 limit, so Teodora Vukić-Hale approves it before it goes ahead. Your card is charged now, and refunded in full if the order is turned down. Nothing is sent until it is approved. You’ll finish paying securely on your payment provider’s page, then return here.'
    );
  });

  it('is the screen’s own note alone when nobody has to approve it', () => {
    expect(paymentNotice(null, HOSTED_PAYMENT_NOTE, HOSTED_PAYMENT_NOTE)).toBe(HOSTED_PAYMENT_NOTE);
  });

  it('is nothing at all when there is nothing to say', () => {
    expect(paymentNotice(null)).toBeNull();
    expect(paymentNotice('Approved first.')).toBe('Approved first.');
  });
});
