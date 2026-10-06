import { describe, expect, it } from 'vitest';

import { poNumberOf, UpdateBillingDocumentInput, withPoNumber } from './invoicing';

// The buyer's purchase order number lives in a document's metadata bag, beside
// the record of when it was emailed (sparx persona issue 077).

describe('withPoNumber', () => {
  it('keeps the send record that shares the bag', () => {
    const sent = { sentAt: '2026-10-02T17:00:00.000Z', sentTo: 'ap@wasatchutility.test' };
    expect(withPoNumber(sent, 'WFUC-24-0817')).toEqual({ ...sent, poNumber: 'WFUC-24-0817' });
  });

  it('takes the number off when it is cleared, and leaves the rest', () => {
    expect(withPoNumber({ poNumber: 'WFUC-24-0817', sentTo: 'x@y.test' }, '  ')).toEqual({
      sentTo: 'x@y.test',
    });
    expect(withPoNumber({ poNumber: 'WFUC-24-0817' }, null)).toEqual({});
  });

  it('trims what was typed', () => {
    expect(withPoNumber(null, ' WFUC-24-0817 ')).toEqual({ poNumber: 'WFUC-24-0817' });
  });
});

describe('poNumberOf', () => {
  it('reads the number, and calls a blank one none', () => {
    expect(poNumberOf({ poNumber: 'WFUC-24-0817' })).toBe('WFUC-24-0817');
    expect(poNumberOf({ poNumber: '' })).toBeNull();
    expect(poNumberOf({})).toBeNull();
    expect(poNumberOf(null)).toBeNull();
    expect(poNumberOf(['WFUC'])).toBeNull();
  });
});

describe('the document update input', () => {
  it('accepts a PO number on its own, without touching the rest of the bag', () => {
    const parsed = UpdateBillingDocumentInput.parse({ poNumber: 'WFUC-24-0817' });
    expect(parsed).toEqual({ poNumber: 'WFUC-24-0817' });
  });

  it('refuses one longer than checkout would take', () => {
    expect(() => UpdateBillingDocumentInput.parse({ poNumber: 'x'.repeat(64) })).toThrow();
  });
});
