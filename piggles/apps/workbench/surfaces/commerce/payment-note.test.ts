// Only what a PERSON wrote reads as a payment's note. Measured in the dev
// database: a Piggles Pay intent id, a gift card's code, a till id and an
// invoice payment's id all sat in `processorRef` and printed as "notes".

import { describe, expect, it } from 'vitest';

import { paymentNote } from './payment-note';

describe('paymentNote', () => {
  it('reads the note where it is written now', () => {
    expect(
      paymentNote({ processor: 'check', processorRef: null, metadata: { note: 'Check 4471' } })
    ).toBe('Check 4471');
  });

  it('reads an older hand-taken note from the reference', () => {
    expect(paymentNote({ processor: 'wire', processorRef: 'Transfer ref TR-8841' })).toBe(
      'Transfer ref TR-8841'
    );
  });

  it('never prints a gateway id or a gift card code', () => {
    expect(paymentNote({ processor: 'sparx_pay', processorRef: 'pi_3TsMe0' })).toBeNull();
    expect(paymentNote({ processor: 'gift_card', processorRef: '969G-HVUS-BCAT-7PW2' })).toBeNull();
    expect(paymentNote({ processor: 'square', processorRef: 'seed-1007-cap' })).toBeNull();
  });

  it('never prints the id an invoice payment left in the reference', () => {
    expect(
      paymentNote({
        processor: 'manual',
        processorRef: '2c2bc979-90bb-4210-b73e-c1d3d4d42360',
        metadata: { billingDocumentId: 'd1', billingDocumentNumber: 'INV-000002' },
      })
    ).toBeNull();
  });
});
