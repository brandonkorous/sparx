// WHO A HELD ORDER WAITS ON (sparx persona issue 087).
//
// Wasatch's $1,000 limit held Renée's $1,208 order, O-000014, and sent it to the
// business's team. Teodora Vukić-Hale, whose role on the account literally read
// "Can approve orders", was never asked. These pin what the console says about
// who signs, so that an order the account has to approve never offers the
// business an Approve the server refuses, and an order the business signed but
// the account has not is never called placed.

import { describe, expect, it } from 'vitest';
import {
  accountApproversOption,
  approveOutcome,
  approvedStockNotice,
  approveWords,
  heldOrderNotice,
  peopleWords,
  queueSignOffView,
  rejectWords,
  ruleSignOffNote,
  type AccountApprover,
  type ApprovedStockLine,
  type DecisionFacts,
  type SignOff,
} from './sign-off-words';

const WASATCH = 'Wasatch Front Utility Contractors, LLC';
const TEODORA: AccountApprover = {
  customerId: 'c-teodora',
  name: 'Teodora Vukić-Hale',
  email: 'teodora@wasatch.test',
};
const SAM: AccountApprover = { customerId: 'c-sam', name: 'Sam Okafor', email: null };
const day = (iso: string) => `day(${iso.slice(0, 10)})`;

function signOff(partial: Partial<SignOff> = {}): SignOff {
  return {
    needs: ['business'],
    waitingOn: ['business'],
    signed: {},
    accountApprovers: [],
    ...partial,
  };
}

/** Only the account is asked: the limit is set to its own approvers. */
const accountOnly = signOff({
  needs: ['account'],
  waitingOn: ['account'],
  accountApprovers: [TEODORA],
});

/** Both are asked: account-signed limit, and over the credit limit too. */
const both = signOff({
  needs: ['account', 'business'],
  waitingOn: ['account', 'business'],
  accountApprovers: [TEODORA],
});

describe('peopleWords', () => {
  it('joins names the way the server refusal does', () => {
    expect(peopleWords(['A'])).toBe('A');
    expect(peopleWords(['A', 'B'])).toBe('A or B');
    expect(peopleWords(['A', 'B', 'C'])).toBe('A, B, or C');
  });
});

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
      'Each account’s own approvers'
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

describe('queueSignOffView', () => {
  it('offers no Approve when only the account is waited on, and says who and that Reject stays', () => {
    const view = queueSignOffView(accountOnly, WASATCH, day);
    expect(view.canApprove).toBe(false);
    expect(view.badges).toEqual([{ label: 'Waiting for Teodora Vukić-Hale', tone: 'info' }]);
    // The badge names her; the sentence says where, and what happens next.
    expect(view.line).toBe(
      `They approve it on your site, at ${WASATCH}. It goes ahead as soon as they do, and you ` +
        'can still turn it down here.'
    );
  });

  it('offers Approve on an ordinary hold and adds no line', () => {
    const view = queueSignOffView(signOff(), WASATCH, day);
    expect(view.canApprove).toBe(true);
    expect(view.line).toBeNull();
    // Approve says it already; a badge on every row would say nothing.
    expect(view.badges).toEqual([]);
  });

  it('shows who at the account signed, and that the business is next', () => {
    const view = queueSignOffView(
      signOff({
        needs: ['account', 'business'],
        waitingOn: ['business'],
        signed: { account: { name: 'Teodora Vukić-Hale', at: '2026-10-03T15:00:00.000Z' } },
        accountApprovers: [TEODORA],
      }),
      WASATCH,
      day
    );
    expect(view.canApprove).toBe(true);
    expect(view.badges[0]).toEqual({
      label: 'Approved by Teodora Vukić-Hale, day(2026-10-03)',
      tone: 'success',
    });
    expect(view.line).toBe('It goes ahead as soon as you approve it.');
  });

  it('says both have to approve when both are waited on', () => {
    const view = queueSignOffView(both, WASATCH, day);
    expect(view.canApprove).toBe(true);
    expect(view.line).toBe(
      'Either of you can go first, and it goes ahead once you both have. They approve on your ' +
        `site, at ${WASATCH}.`
    );
    expect(view.badges.map((badge) => badge.tone)).toEqual(['warning', 'info']);
  });

  it('after the business signs, waits on the account and offers no second Approve', () => {
    const view = queueSignOffView(
      signOff({
        needs: ['account', 'business'],
        waitingOn: ['account'],
        signed: { business: { name: 'Doty Brown', at: '2026-10-03T16:00:00.000Z' } },
        accountApprovers: [TEODORA],
      }),
      WASATCH,
      day
    );
    expect(view.canApprove).toBe(false);
    expect(view.badges[0]?.label).toBe('Approved by Doty Brown, day(2026-10-03)');
    expect(view.badges[1]?.label).toBe('Waiting for Teodora Vukić-Hale');
    expect(view.line).toContain(`They approve it on your site, at ${WASATCH}`);
  });

  it('names several approvers in the sentence, since the badge does not', () => {
    const view = queueSignOffView(
      { ...accountOnly, accountApprovers: [TEODORA, SAM] },
      WASATCH,
      day
    );
    expect(view.badges).toEqual([{ label: 'Waiting for their approvers', tone: 'info' }]);
    expect(view.line).toContain(`Teodora Vukić-Hale or Sam Okafor at ${WASATCH} can approve it`);
  });

  it('never says in the sentence what a badge beside it already says', () => {
    // sparx persona issue 087: "Waiting for Teodora Vukić-Hale" sat over
    // "Waiting for Teodora Vukić-Hale at Wasatch ... to approve it".
    const signedByThem = {
      account: { name: 'Teodora Vukić-Hale', at: '2026-10-03T15:00:00.000Z' },
    };
    const signedByUs = { business: { name: 'Doty Brown', at: '2026-10-03T16:00:00.000Z' } };
    const shapes: SignOff[] = [
      accountOnly,
      both,
      { ...accountOnly, needs: ['account', 'business'], signed: signedByUs },
      { ...both, waitingOn: ['business'], signed: signedByThem },
    ];
    for (const shape of shapes) {
      const view = queueSignOffView(shape, WASATCH, day);
      for (const badge of view.badges) {
        const said = badge.label
          .replace(/^Waiting for /, '')
          .replace(/^Approved by /, '')
          .replace(/, day\(.*\)$/, '');
        expect(view.line ?? '', `${badge.label} / ${JSON.stringify(shape)}`).not.toContain(said);
      }
      // "Needs your approval" already says it is the business's turn.
      expect(view.line ?? '').not.toMatch(/sign-off is next/i);
    }
  });

  it('never offers Approve unless the business is waited on', () => {
    const shapes: SignOff[] = [
      accountOnly,
      both,
      signOff(),
      signOff({ needs: ['account', 'business'], waitingOn: ['account'], accountApprovers: [SAM] }),
      signOff({ waitingOn: [] }),
    ];
    for (const shape of shapes) {
      expect(queueSignOffView(shape, WASATCH, day).canApprove, JSON.stringify(shape)).toBe(
        shape.waitingOn.includes('business')
      );
    }
  });
});

describe('approving and rejecting', () => {
  const facts = (partial: Partial<DecisionFacts> = {}): DecisionFacts => ({
    orderNumber: 'O-000014',
    buyer: WASATCH,
    total: '$1,208.00',
    companyName: WASATCH,
    signOff: signOff(),
    overCreditLimit: false,
    ...partial,
  });

  it('does not promise placing an order the account still has to approve', () => {
    const words = approveWords(facts({ signOff: both }));
    expect(words).not.toContain('will be placed');
    expect(words).toContain(`still waits for Teodora Vukić-Hale at ${WASATCH}`);
  });

  it('says it will be placed when the business is the last to sign', () => {
    expect(approveWords(facts())).toBe(
      `Order O-000014 from ${WASATCH}, for $1,208.00, will be placed. If they're on terms, it will be invoiced.`
    );
  });

  it('names who at the account already approved an order being rejected', () => {
    const words = rejectWords(
      facts({
        signOff: signOff({
          needs: ['account', 'business'],
          waitingOn: ['business'],
          signed: { account: { name: 'Teodora Vukić-Hale', at: '2026-10-03T15:00:00.000Z' } },
        }),
      }),
      day
    );
    expect(words).toContain('Teodora Vukić-Hale approved it on day(2026-10-03)');
    expect(words).toContain('cancels it anyway');
  });

  it('reports a still-pending approval as waiting, not as placed', () => {
    const outcome = approveOutcome(
      { orderNumber: 'O-000014', status: 'pending_approval', waitingOn: ['account'] },
      both,
      WASATCH
    );
    expect(outcome.title).toBe('Your approval is in for order O-000014');
    expect(outcome.description).toContain(`now waits for Teodora Vukić-Hale at ${WASATCH}`);
    expect(outcome.description).not.toContain('placed');
  });

  it('reports a placed order as placed', () => {
    expect(
      approveOutcome(
        { orderNumber: 'O-000014', status: 'placed', waitingOn: [] },
        signOff(),
        WASATCH
      )
    ).toEqual({ title: 'Order O-000014 approved', description: 'The order is placed.' });
  });
});

describe('approvedStockNotice', () => {
  // Approving placed the order and took its stock, and the shelves were short:
  // the business now owes the customer goods (sparx persona issue 087).
  const kit = (partial: Partial<ApprovedStockLine> = {}): ApprovedStockLine => ({
    variantId: 'v-kit',
    sku: 'SS-CP4',
    name: 'S&S CP4 kit',
    ordered: 3,
    notFree: 2,
    owed: 2,
    ...partial,
  });
  const NOTE =
    'S&S CP4 kit: 2 of 3 were not in stock, so they are owed to the customer and will go out when more arrive.';

  it('warns that the customer is owed goods, and points to the Waiting list', () => {
    const notice = approvedStockNotice(
      { orderNumber: 'O-000014', status: 'placed', stock: { lines: [kit()], note: NOTE } },
      WASATCH
    );
    expect(notice).toEqual({
      orderNumber: 'O-000014',
      title: 'Order O-000014 is placed, but not all of it is in stock',
      detail: `${NOTE} What ${WASATCH} is owed is on the Waiting list, which keeps track of it until more arrives.`,
      owed: true,
    });
  });

  it('names another order as the short one when nothing is owed to this customer', () => {
    const note = 'S&S CP4 kit: 2 were already set aside for another order, which is now short.';
    const notice = approvedStockNotice(
      {
        orderNumber: 'O-000014',
        status: 'placed',
        stock: { lines: [kit({ owed: 0 })], note },
      },
      WASATCH
    );
    expect(notice?.title).toBe('Order O-000014 is placed, and another order is now short');
    expect(notice?.detail).toBe(note);
    expect(notice?.owed).toBe(false);
  });

  it('says nothing extra when every unit came from stock', () => {
    expect(
      approvedStockNotice({ orderNumber: 'O-000014', status: 'placed', stock: null }, WASATCH)
    ).toBeNull();
    expect(approvedStockNotice({ orderNumber: 'O-000014', status: 'placed' }, WASATCH)).toBeNull();
  });

  it('says nothing about stock while the order still waits for somebody', () => {
    expect(
      approvedStockNotice(
        {
          orderNumber: 'O-000014',
          status: 'pending_approval',
          stock: { lines: [kit()], note: NOTE },
        },
        WASATCH
      )
    ).toBeNull();
  });
});

describe('heldOrderNotice', () => {
  it('names who the order waits on when only the account is asked', () => {
    const notice = heldOrderNotice(accountOnly, WASATCH, day);
    expect(notice.tone).toBe('info');
    expect(notice.title).toBe('Waiting for Teodora Vukić-Hale');
    expect(notice.detail).toContain('goes ahead as soon as they do');
  });

  it('says what is certain when the queue could not say', () => {
    const notice = heldOrderNotice(null, WASATCH, day);
    expect(notice.title).toBe('Waiting for sign-off');
    expect(notice.detail).toContain('Approvals');
  });

  it('never repeats in the detail the names its title gives', () => {
    const shapes: SignOff[] = [
      accountOnly,
      both,
      { ...accountOnly, accountApprovers: [TEODORA, SAM] },
      { ...both, accountApprovers: [TEODORA, SAM] },
    ];
    for (const shape of shapes) {
      const notice = heldOrderNotice(shape, WASATCH, day);
      for (const approver of shape.accountApprovers) {
        expect(notice.title).toContain(approver.name);
        expect(notice.detail, JSON.stringify(shape)).not.toContain(approver.name);
      }
      expect(notice.detail).toContain(`on your site, at ${WASATCH}`);
    }
  });

  it('asks the team when the team is waited on', () => {
    expect(heldOrderNotice(signOff(), WASATCH, day).title).toBe('Waiting for your team');
    expect(heldOrderNotice(both, WASATCH, day).title).toBe(
      'Waiting for your team and Teodora Vukić-Hale'
    );
  });
});
