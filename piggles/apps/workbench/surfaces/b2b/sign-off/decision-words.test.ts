// An order the account still has to approve is never called placed (sparx persona issue 087).
import { describe, expect, it } from 'vitest';
import { approveOutcome, approveWords, rejectWords, type DecisionFacts } from './decision-words';
import { both, day, signOff, WASATCH } from './fixtures';

const facts = (partial: Partial<DecisionFacts> = {}): DecisionFacts => ({
  orderNumber: 'O-000014',
  buyer: WASATCH,
  total: '$1,208.00',
  companyName: WASATCH,
  signOff: signOff(),
  overCreditLimit: false,
  ...partial,
});

describe('approving and rejecting', () => {
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
});

describe('approving and rejecting', () => {
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
