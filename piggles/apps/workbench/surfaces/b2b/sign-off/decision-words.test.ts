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

const DECIDE_FILE = '../approvals/decision-dialog.tsx';

// Approving after the account has paid (sparx persona issue 188): the dialog said
// "What they owe will go past their credit limit" about an order that now fit.
describe('the credit, as it stands when they approve', () => {
  const now = (partial: Partial<DecisionFacts>): DecisionFacts => ({
    orderNumber: 'O-000022',
    buyer: WASATCH,
    total: '$2,026.38',
    companyName: WASATCH,
    signOff: signOff(),
    overCreditLimit: false,
    ...partial,
  });

  it('does not say it goes past the credit once the account has paid', () => {
    const words = approveWords(now({ heldForCredit: true, creditLeftNow: '$3,795.68' }));
    expect(words).not.toContain('go past');
    expect(words).toContain('they now have $3,795.68 of credit left, enough for this order');
  });

  it('says how much is left when it still goes past', () => {
    expect(
      approveWords(now({ overCreditLimit: true, heldForCredit: true, creditLeftNow: '$1,676.08' }))
    ).toContain('What they owe will go past their credit limit: they have $1,676.08 left.');
  });

  it('the dialog asks today’s figure, not the one at placement', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(fileURLToPath(new URL(DECIDE_FILE, import.meta.url)), 'utf8');
    expect(source).toContain('item.totalCents > leftNow');
  });
});
