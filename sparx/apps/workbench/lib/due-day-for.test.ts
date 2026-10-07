// A hand-raised wholesale invoice is due on the account's own terms.
//
// MEASURED 2026-10-06 on Gillett: Raise an invoice opened due two weeks out,
// and picking O'Malley Ranch (Net 15) left it there. Wasatch Front (Net 30)
// would have been told to pay sixteen days early (sparx persona issue 097).

import { describe, expect, it } from 'vitest';

import { dueDayFor } from './payment-terms';

// 6 October 2026, 7:30 in the evening on the reader's clock: the UTC day is
// already the 7th in Utah, which is the hour a day count read off UTC goes wrong.
const EVENING = new Date(2026, 9, 6, 19, 30);

describe('dueDayFor', () => {
  it('counts the agreed days from today', () => {
    expect(dueDayFor('net15', EVENING)).toBe('2026-10-21');
    expect(dueDayFor('net30', EVENING)).toBe('2026-11-05');
    expect(dueDayFor('net45', EVENING)).toBe('2026-11-20');
  });

  it('crosses a month and a year on the calendar', () => {
    expect(dueDayFor('net30', new Date(2026, 11, 15, 9, 0))).toBe('2027-01-14');
  });

  it('has no date for terms that are not a day count', () => {
    expect(dueDayFor('prepay', EVENING)).toBeNull();
    expect(dueDayFor(null, EVENING)).toBeNull();
    expect(dueDayFor('', EVENING)).toBeNull();
  });
});
