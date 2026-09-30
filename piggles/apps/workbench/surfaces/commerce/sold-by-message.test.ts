// The six commission outcomes, and the one this console did not know (issue 871).
//
// `rate-not-in-force` is returned by the server on both the order path and the
// deal path. This console's union had five members, so the outcome fell through
// the switch to `default` and the panel said **"That sale could not be found"**
// about a sale on screen with a named person credited to it.
//
// The test that matters is the pair: `no-rate` and `rate-not-in-force` must not
// say the same thing, because they are fixed in opposite ways. Telling somebody
// who HAS set a commission rate to go and set one sends them to redo what they
// just did.

import { describe, expect, it } from 'vitest';

import { outcomeMessage, type OutcomeWords } from './sold-by-message';

const words: OutcomeWords = {
  cents: (c) => `$${(c / 100).toFixed(2)}`,
  day: (iso) => (iso === null || iso === undefined ? '—' : `day ${iso}`),
};

const say = (result: Parameters<typeof outcomeMessage>[0]) =>
  outcomeMessage(result, 'Priya', words);

describe('the outcome this console did not know', () => {
  it('does not fall through to "could not be found"', () => {
    const msg = say({
      outcome: 'rate-not-in-force',
      staffMemberId: 's1',
      rateStartsOn: '2026-09-16',
      earnedOn: '2026-09-04',
    });
    expect(msg).not.toContain('could not be found');
  });

  it('names who is credited, and both dates, because the comparison IS the message', () => {
    const msg = say({
      outcome: 'rate-not-in-force',
      staffMemberId: 's1',
      rateStartsOn: '2026-09-16',
      earnedOn: '2026-09-04',
    });
    expect(msg).toContain('Priya');
    expect(msg).toContain('day 2026-09-16');
    expect(msg).toContain('day 2026-09-04');
  });

  it('never claims they are not on commission, because they are', () => {
    const msg = say({
      outcome: 'rate-not-in-force',
      staffMemberId: 's1',
      rateStartsOn: '2026-09-16',
      earnedOn: '2026-09-04',
    });
    expect(msg).not.toContain('not on commission');
  });

  it('gives the remedy that works, not the one that is refused', () => {
    // Pay rates may not overlap, so "add an earlier rate" is rejected outright.
    const msg = say({
      outcome: 'rate-not-in-force',
      staffMemberId: 's1',
      rateStartsOn: '2026-09-16',
      earnedOn: '2026-09-04',
    });
    expect(msg).toContain('remove that rate');
    expect(msg).toContain('add it again');
  });

  it('says something different from no-rate', () => {
    const notInForce = say({
      outcome: 'rate-not-in-force',
      staffMemberId: 's1',
      rateStartsOn: '2026-09-16',
      earnedOn: '2026-09-04',
    });
    const noRate = say({ outcome: 'no-rate', staffMemberId: 's1' });
    expect(notInForce).not.toBe(noRate);
  });
});

describe('the five it already knew', () => {
  it('recorded, with an amount', () => {
    expect(say({ outcome: 'recorded', amountCents: 4250 })).toBe(
      'Priya earned $42.50 on this order.'
    );
  });

  it('recorded, where the basis came to nothing', () => {
    // Zero is not a failure and must not read as one.
    const msg = say({ outcome: 'recorded', amountCents: 0 });
    expect(msg).toContain('Credited to Priya');
    expect(msg).toContain('came to zero');
  });

  it('no-rate sends them to the pay record', () => {
    expect(say({ outcome: 'no-rate' })).toContain('Set a commission rate on their pay record');
  });

  it('not-payable explains that paid comes first', () => {
    expect(say({ outcome: 'not-payable' })).toContain('once the order is paid');
  });

  it('no-attribution names nobody', () => {
    expect(say({ outcome: 'no-attribution' })).toBe('Nobody is credited with this sale yet.');
  });

  it('unknown-sale is the only one that says it could not be found', () => {
    expect(say({ outcome: 'unknown-sale' })).toBe('That sale could not be found.');
  });
});

describe('all six say something, and nothing says it twice', () => {
  const ALL = [
    'recorded',
    'no-attribution',
    'no-rate',
    'rate-not-in-force',
    'not-payable',
    'unknown-sale',
  ] as const;

  it('every outcome produces its own sentence', () => {
    const said = ALL.map((outcome) =>
      say({
        outcome,
        staffMemberId: 's1',
        amountCents: 4250,
        rateStartsOn: '2026-09-16',
        earnedOn: '2026-09-04',
      })
    );
    expect(new Set(said).size).toBe(ALL.length);
    for (const msg of said) expect(msg.length).toBeGreaterThan(0);
  });
});
