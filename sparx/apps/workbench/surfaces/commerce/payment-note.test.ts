// WHAT SOMEBODY WROTE DOWN ABOUT A PAYMENT, READ BACK.
//
// The order pane's "Anything to note" box wrote into `processorRef`, which is the
// gateway's own reference and one third of a unique key, so two cash sales noted
// the same way collided. The note now goes to `metadata.note`, and the pane draws
// it. Old hand-taken rows still hold theirs in `processorRef`; a gateway charge's
// id, or a gift card's code, is nobody's note.

import { describe, expect, it } from 'vitest';

import { paymentNote } from './data';

describe('paymentNote', () => {
  it('reads the note where it is written now', () => {
    expect(
      paymentNote({ processor: 'check', processorRef: null, metadata: { note: 'Check 1042' } })
    ).toBe('Check 1042');
  });

  it('reads an older hand-taken payment whose note sits in the reference', () => {
    expect(paymentNote({ processor: 'manual', processorRef: 'Paid at the counter' })).toBe(
      'Paid at the counter'
    );
  });

  it('never shows a gateway charge id as a note', () => {
    expect(paymentNote({ processor: 'stripe', processorRef: 'ch_3Pq', metadata: {} })).toBeNull();
  });

  it('never shows a gift card code as a note', () => {
    expect(paymentNote({ processor: 'gift_card', processorRef: 'GIFT-ABCD-1234' })).toBeNull();
  });

  it('answers null when nothing was written', () => {
    expect(paymentNote({ processor: 'manual', processorRef: '  ', metadata: { note: '' } })).toBe(
      null
    );
  });

  it('never shows the id an invoice payment left in the reference', () => {
    expect(
      paymentNote({
        processor: 'manual',
        processorRef: '2c2bc979-90bb-4210-b73e-c1d3d4d42360',
        metadata: { billingDocumentId: 'd1', billingDocumentNumber: 'INV-000002' },
      })
    ).toBeNull();
  });
});
