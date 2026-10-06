// The words for a rebuilt part bought by paying the core deposit or by sending the
// old part first (sparx persona issue 057). These are promises about money and about
// when something ships, so each one is tested for what it says.

import { describe, expect, it } from 'vitest';

import {
  CORE_FIRST_SENTENCE,
  coreLinePayLabel,
  coreReturnSentence,
  corePaySentence,
  orderCoreLine,
  type OrderCoreFacts,
} from './core-choice-copy';

const facts = (over: Partial<OrderCoreFacts> = {}): OrderCoreFacts => ({
  quantity: 1,
  coreChargeCents: null,
  coreFirst: false,
  waitingForOldPart: 0,
  coresOwed: 0,
  coresReturned: 0,
  coresKept: 0,
  ...over,
});

describe('the buy box sentences', () => {
  it('names the deposit when there is one figure for it', () => {
    expect(corePaySentence(15_000, 'USD', 'en-US')).toBe(
      'Pay the $150.00 core deposit now. Your part is ready right away, and we pay the deposit back when your old part comes back.'
    );
  });

  it('quotes no figure when the versions carry different deposits', () => {
    expect(corePaySentence(null, 'USD', 'en-US')).toBe(
      'Pay the core deposit now. Your part is ready right away, and we pay the deposit back when your old part comes back.'
    );
  });

  it('promises no deposit and says when it ships', () => {
    expect(CORE_FIRST_SENTENCE).toBe(
      'Send your old part first. No deposit. Your part is ready once it arrives.'
    );
  });

  it('says "each" on a basket line of more than one', () => {
    expect(coreLinePayLabel(15_000, 1, 'USD')).toBe('Pay the $150.00 core deposit and get it now');
    expect(coreLinePayLabel(15_000, 8, 'USD')).toBe(
      'Pay the $150.00 core deposit each and get it now'
    );
  });
});

describe('the order page, line by line', () => {
  it('says a held part ships when its old part arrives', () => {
    expect(
      orderCoreLine(facts({ coreFirst: true, waitingForOldPart: 1, coresOwed: 1 }), '1042', 'USD')
    ).toBe(
      'No deposit, because you are sending your old part first. We hold it until your old part arrives. Bring or send it to us with your order number, 1042.'
    );
  });

  it('counts the units still held when only some are', () => {
    expect(
      orderCoreLine(
        facts({ quantity: 8, coreFirst: true, waitingForOldPart: 3, coresOwed: 3 }),
        '1042',
        'USD'
      )
    ).toBe(
      'No deposit, because you are sending your old part first. We hold 3 of them until your old parts arrive. Bring or send them to us with your order number, 1042.'
    );
  });

  it('still asks for the old part when the business shipped without waiting', () => {
    expect(
      orderCoreLine(facts({ coreFirst: true, waitingForOldPart: 0, coresOwed: 1 }), '1042', 'USD')
    ).toBe(
      'No deposit, because you are sending your old part first. 1 old part still to send. Bring or send it to us with your order number, 1042.'
    );
  });

  it('stops asking once the old part is in', () => {
    expect(orderCoreLine(facts({ coreFirst: true }), '1042', 'USD')).toBe(
      'No deposit, because you sent your old part first. Nothing left to send.'
    );
  });

  it('keeps the deposit sentence for a line that paid one', () => {
    expect(
      orderCoreLine(facts({ quantity: 2, coreChargeCents: 15_000, coresOwed: 2 }), '1042', 'USD')
    ).toBe(
      'Refundable core deposit, $150.00 each. 2 old parts still to send back. Bring them in or send them to us with your order number, 1042. We pay the deposit back once we have checked them.'
    );
  });

  it('says nothing about a line with no old part', () => {
    expect(orderCoreLine(facts(), '1042', 'USD')).toBeNull();
  });
});

describe('where old parts go', () => {
  it('asks for the order number in the box when there is an address', () => {
    expect(coreReturnSentence('1042', true)).toMatch(/order number, 1042/);
  });

  it('sends the buyer to ask when the business has no address on file', () => {
    expect(coreReturnSentence('1042', false)).toMatch(/^Contact us for where to send them/);
  });
});
