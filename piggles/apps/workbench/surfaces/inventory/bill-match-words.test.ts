// WHAT THE ONE SENTENCE ABOUT THE CHECK IS ALLOWED TO CLAIM (issue 886).
//
// AM-2214 from Ashcombe Mills charged Juniper Row for 2 units of a 40-unit
// order. The other 38 were on AM-2198. The check passed, correctly: 2 units at
// the agreed price, against 2 units nobody else had invoiced. Then the banner
// above the table said
//
//     The one line on this bill matches what was ordered and what arrived.
//
// over a table reading ordered 40, arrived 40, billed 2. The row itself already
// carried "38 on other invoices" — the aggregate sentence above it had never
// been told, so the screen's own summary contradicted the screen's own numbers.
//
// The second claim in that sentence was wrong on its own terms too. The check
// compares BILLED against RECEIVED and against the AGREED PRICE. It never looks
// at what was ordered, so a delivery two units short, invoiced for the
// two-short amount, passes and does not match the order.

import { describe, expect, it } from 'vitest';

import { matchSummary, type BillMatch } from './supplier-bills-data';

const clean: BillMatch = {
  ok: true,
  linesMatched: 1,
  linesFlagged: 0,
  totalVarianceCents: 0,
  uninvoicedCents: 0,
  unorderedLines: 0,
};

const line = (alreadyBilledQuantity: number | null) => ({ alreadyBilledQuantity });

describe('matchSummary - a bill that covers part of a delivery', () => {
  it('says where the rest is when other invoices already have it', () => {
    // THE DEFECT. AM-2214 exactly: everything else is on AM-2198.
    const s = matchSummary(clean, [line(38)]);

    expect(s.label).toBe('Agrees with the delivery');
    expect(s.detail).toContain('The rest of this order is on other invoices.');
    expect(s.detail).not.toContain('what was ordered');
  });

  it('still says the rest is uninvoiced when that is what it is', () => {
    const s = matchSummary({ ...clean, uninvoicedCents: 36_000 }, [line(0)]);

    expect(s.detail).toContain('has not been invoiced yet');
    expect(s.detail).not.toContain('on other invoices');
  });

  it('says both when some of the rest is billed and some is not', () => {
    const s = matchSummary({ ...clean, uninvoicedCents: 3_600 }, [line(20)]);

    expect(s.detail).toContain('partly on other invoices and partly not invoiced yet');
  });

  it('claims nothing about the rest when there is no rest', () => {
    const s = matchSummary(clean, [line(0)]);

    expect(s.detail).not.toContain('rest of this order');
    expect(s.detail).toContain('charges for what arrived');
  });
});

describe('matchSummary - what the check actually compared', () => {
  it('never claims the bill matches what was ordered', () => {
    // The check reads BILLED against RECEIVED and against the agreed price.
    // A delivery two short, invoiced for the two-short amount, passes it and
    // does not match the order, so the sentence must not say that it does.
    expect(matchSummary(clean, [line(0)]).detail).not.toContain('ordered');
    expect(matchSummary({ ...clean, linesMatched: 4 }, [line(0)]).detail).not.toContain('ordered');
  });

  it('names the price, which is the half it did check', () => {
    expect(matchSummary(clean, [line(0)]).detail).toContain('at the price you agreed');
    expect(matchSummary({ ...clean, linesMatched: 4 }, [line(0)]).detail).toContain(
      'All 4 lines charge for what arrived'
    );
  });
});

describe('matchSummary - the states either side of it', () => {
  it('still refuses to call an unmatched bill checked', () => {
    const s = matchSummary({ ...clean, ok: null }, []);

    expect(s.label).toBe('Not checked');
    expect(s.tone).toBe('neutral');
  });

  it('still calls out a bill that does not agree', () => {
    const s = matchSummary({ ...clean, ok: false, linesMatched: 0, linesFlagged: 1 }, [line(0)]);

    expect(s.label).toBe('1 line does not agree');
    expect(s.tone).toBe('danger');
  });

  it('degrades to the careful sentence when nobody passes the lines', () => {
    // A caller that has not been updated must not get the confident claim back.
    expect(matchSummary(clean).detail).not.toContain('what was ordered');
  });
});
