import { describe, expect, it } from 'vitest';

import {
  addressLine,
  cadenceOpener,
  cadencePhrase,
  eachTimeNote,
  firstDeliveryNote,
  paidNote,
  repeatOrderCheck,
  worthNote,
} from './repeat-order-words';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const day = (date: Date) => date.toISOString().slice(0, 10);

describe('cadencePhrase', () => {
  it('drops the number when there is only one', () => {
    expect(cadencePhrase('month', 1)).toBe('every month');
    expect(cadencePhrase('week', 1)).toBe('every week');
  });

  it('counts in words on the other branch, never "week(s)"', () => {
    expect(cadencePhrase('week', 2)).toBe('every 2 weeks');
    expect(cadencePhrase('day', 10)).toBe('every 10 days');
  });

  it('treats nonsense as one rather than printing it', () => {
    expect(cadencePhrase('month', 0)).toBe('every month');
    expect(cadencePhrase('month', -4)).toBe('every month');
  });

  it('starts a sentence with a capital', () => {
    expect(cadenceOpener('month', 1)).toBe('Every month');
    expect(cadenceOpener('week', 3)).toBe('Every 3 weeks');
  });
});

describe('eachTimeNote', () => {
  it('names the job at zero rather than the fault', () => {
    expect(eachTimeNote([], money)).toBe(
      'Pick what goes out each time. Everything here is sent on every delivery.'
    );
  });

  it('counts one thing in words', () => {
    expect(eachTimeNote([{ unitPriceCents: 5800, quantity: 1 }], money)).toBe(
      'One thing goes out each time, coming to $58.00.'
    );
  });

  it('adds up quantity as well as lines', () => {
    expect(
      eachTimeNote(
        [
          { unitPriceCents: 5800, quantity: 2 },
          { unitPriceCents: 12800, quantity: 1 },
        ],
        money
      )
    ).toBe('3 things go out each time, coming to $244.00.');
  });
});

describe('worthNote', () => {
  it('says nothing with nothing on it', () => {
    expect(worthNote({ lines: [], unit: 'month', count: 1, money })).toBeNull();
  });

  it('does not restate a monthly figure as monthly', () => {
    expect(
      worthNote({ lines: [{ unitPriceCents: 5800, quantity: 1 }], unit: 'month', count: 1, money })
    ).toBe('Worth $58.00 a month while it runs.');
  });

  it('converts any other cadence, which is the whole point of the number', () => {
    // $58 every 2 weeks is more than $58 a month, and the sentence has to show it.
    expect(
      worthNote({ lines: [{ unitPriceCents: 5800, quantity: 1 }], unit: 'week', count: 2, money })
    ).toBe('Sent every 2 weeks, that is worth about $124.29 a month while it runs.');
  });

  it('spreads a yearly membership over the year', () => {
    expect(
      worthNote({ lines: [{ unitPriceCents: 12000, quantity: 1 }], unit: 'year', count: 1, money })
    ).toBe('Sent every year, that is worth about $10.00 a month while it runs.');
  });

  it('says nothing rather than "$0.00 a month" for a free one', () => {
    expect(
      worthNote({ lines: [{ unitPriceCents: 0, quantity: 3 }], unit: 'month', count: 1, money })
    ).toBeNull();
  });
});

describe('firstDeliveryNote', () => {
  const startAt = new Date('2026-09-19T10:00:00.000Z');

  it('names the date a month out, and says today is not it', () => {
    const note = firstDeliveryNote({ startAt, unit: 'month', count: 1, day });
    expect(note).toContain('First delivery 2026-10-19');
    expect(note).toContain('then every month after that');
    expect(note).toContain('Nothing goes out today');
  });

  it('counts weeks from the start, not from the month', () => {
    expect(firstDeliveryNote({ startAt, unit: 'week', count: 2, day })).toContain(
      'First delivery 2026-10-03'
    );
  });

  it('asks the question instead of guessing a date it cannot work out', () => {
    expect(firstDeliveryNote({ startAt, unit: 'fortnight' as never, count: 1, day })).toBe(
      'Choose how often this goes out.'
    );
  });
});

describe('paidNote', () => {
  it('uses the customer by name', () => {
    expect(paidNote('Rosalind Achebe')).toContain('billed to Rosalind Achebe');
  });

  it('has something to say before anyone is chosen', () => {
    expect(paidNote(null)).toContain('billed to the customer');
  });

  it('never promises a payment link, which not every gateway can make', () => {
    expect(paidNote('Rosalind Achebe')).not.toContain('link');
  });

  it('says plainly that nothing is charged on its own', () => {
    expect(paidNote(null)).toContain('Nothing is charged automatically');
  });
});

describe('repeatOrderCheck', () => {
  const ready = {
    customerChosen: true,
    lineCount: 1,
    addressChosen: true,
    count: 1,
    everyLinePriced: true,
  };

  it('is happy with a complete one', () => {
    expect(repeatOrderCheck(ready)).toEqual({ ok: true, problem: null });
  });

  it('asks for the customer first', () => {
    const result = repeatOrderCheck({ ...ready, customerChosen: false, lineCount: 0 });
    expect(result.ok).toBe(false);
    expect(result.problem).toContain('Choose who this is for');
  });

  it('asks for what goes out next, not everything at once', () => {
    const result = repeatOrderCheck({ ...ready, lineCount: 0, addressChosen: false });
    expect(result.problem).toBe('Add at least one thing to send each time.');
  });

  it('catches a line with no number on it', () => {
    expect(repeatOrderCheck({ ...ready, everyLinePriced: false }).problem).toContain('no price');
  });

  it('asks where it goes', () => {
    expect(repeatOrderCheck({ ...ready, addressChosen: false }).problem).toContain(
      'Choose where it goes'
    );
  });

  it('refuses a cadence of zero, which would mean nothing ever ships', () => {
    expect(repeatOrderCheck({ ...ready, count: 0 }).ok).toBe(false);
    expect(repeatOrderCheck({ ...ready, count: Number.NaN }).ok).toBe(false);
  });
});

describe('addressLine', () => {
  it('joins only the parts that are there', () => {
    expect(
      addressLine({
        line1: '12 Juniper Row',
        line2: null,
        city: 'Bristol',
        region: null,
        postalCode: 'BS1 4TR',
      })
    ).toBe('12 Juniper Row, Bristol, BS1 4TR');
  });

  it('keeps a second line when there is one', () => {
    expect(
      addressLine({
        line1: '12 Juniper Row',
        line2: 'Flat 2',
        city: 'Bristol',
        region: 'Avon',
        postalCode: 'BS1 4TR',
      })
    ).toBe('12 Juniper Row, Flat 2, Bristol, Avon, BS1 4TR');
  });

  it('never leaves a dangling comma from a blank field', () => {
    expect(addressLine({ line1: '12 Juniper Row', line2: '   ', city: 'Bristol' })).toBe(
      '12 Juniper Row, Bristol'
    );
  });
});
