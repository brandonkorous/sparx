import { describe, expect, it } from 'vitest';
import {
  clearedFromCustomer,
  fillFromCustomer,
  misdirectedEmail,
  type BilledParty,
} from './bill-to-fill';

/**
 * A BILL WITH ONE PERSON'S NAME ON IT AND ANOTHER PERSON'S ADDRESS.
 *
 * Picking a customer filled only the boxes that were EMPTY, so changing the
 * customer on a document left the previous person's details on it in silence.
 * Measured on a real shop: INV-000004, $276, printed "Wren Ashcombe", attached
 * to Marguerite Adeyemi, emailed to Marguerite. The list shows the printed
 * name, so it reads as Wren's bill and Wren has never heard of it.
 */
const WREN: BilledParty = { name: 'Wren Ashcombe', email: 'wren.ashcombe@example.com' };
const MARGUERITE: BilledParty = {
  name: 'Marguerite Adeyemi',
  email: 'marguerite.adeyemi@example.com',
};
const EMPTY: BilledParty = { name: '', email: '' };

describe('fillFromCustomer', () => {
  it('fills a blank document from the first customer picked', () => {
    expect(fillFromCustomer(EMPTY, null, WREN)).toEqual(WREN);
  });

  it('REPLACES details it filled from the customer being replaced', () => {
    // The whole bug. The document says Wren everywhere because Wren was picked
    // a moment ago; picking Marguerite has to move all of it.
    expect(fillFromCustomer(WREN, WREN, MARGUERITE)).toEqual(MARGUERITE);
  });

  it('keeps a printed name that was deliberately made different', () => {
    // Billing a person's business, or their accounts department. Her text is
    // hers and switching the customer must not eat it.
    const typed: BilledParty = { name: 'Juniper Row Ltd, Accounts', email: WREN.email };
    expect(fillFromCustomer(typed, WREN, MARGUERITE)).toEqual({
      name: 'Juniper Row Ltd, Accounts',
      email: MARGUERITE.email,
    });
  });

  it('keeps an address that was deliberately made different', () => {
    const typed: BilledParty = { name: WREN.name, email: 'accounts@juniperrow.test' };
    expect(fillFromCustomer(typed, WREN, MARGUERITE)).toEqual({
      name: MARGUERITE.name,
      email: 'accounts@juniperrow.test',
    });
  });

  it('fills an empty box even when the other one was typed over', () => {
    const half: BilledParty = { name: 'Accounts Payable', email: '' };
    expect(fillFromCustomer(half, WREN, MARGUERITE)).toEqual({
      name: 'Accounts Payable',
      email: MARGUERITE.email,
    });
  });

  it('leaves everything alone on a document nobody was attached to', () => {
    // No attached customer means nothing can be shown to have come from one, so
    // anything already written is hers.
    const typed: BilledParty = { name: 'Some Shop', email: 'hello@someshop.test' };
    expect(fillFromCustomer(typed, null, MARGUERITE)).toEqual(typed);
  });

  it('does not care about case or stray spaces', () => {
    const sloppy: BilledParty = { name: '  wren ashcombe ', email: 'WREN.ASHCOMBE@example.com' };
    expect(fillFromCustomer(sloppy, WREN, MARGUERITE)).toEqual(MARGUERITE);
  });
});

describe('misdirectedEmail', () => {
  it('says so when the bill goes somewhere other than the customer it is filed under', () => {
    const note = misdirectedEmail(MARGUERITE.email, WREN);
    expect(note).toBe(
      "This is not Wren Ashcombe's address. Sending goes here, and their own address is wren.ashcombe@example.com."
    );
  });

  it('is quiet when the address is the customer own', () => {
    expect(misdirectedEmail(WREN.email, WREN)).toBeNull();
  });

  it('is quiet about an empty box, which is a different problem', () => {
    expect(misdirectedEmail('', WREN)).toBeNull();
  });

  it('is quiet when no customer is attached, because there is nothing to disagree with', () => {
    expect(misdirectedEmail('anyone@example.com', null)).toBeNull();
  });

  it('is quiet when the customer has no address of their own to compare', () => {
    expect(misdirectedEmail('accounts@shop.test', { name: 'Wren Ashcombe', email: '' })).toBeNull();
  });

  it('does not care about case or stray spaces', () => {
    expect(misdirectedEmail('  WREN.ASHCOMBE@EXAMPLE.COM ', WREN)).toBeNull();
  });
});

describe('clearedFromCustomer', () => {
  it('takes the departing customer details with them', () => {
    // The picker has no swap: changing who a document is for means clearing and
    // then choosing. If their name survives the clear, the next pick has
    // nothing to compare it against and keeps it — the same bug, one step on.
    expect(clearedFromCustomer(WREN, WREN)).toEqual(EMPTY);
  });

  it('leaves behind anything deliberately made different', () => {
    const typed: BilledParty = { name: 'Juniper Row Ltd, Accounts', email: WREN.email };
    expect(clearedFromCustomer(typed, WREN)).toEqual({
      name: 'Juniper Row Ltd, Accounts',
      email: '',
    });
  });

  it('touches nothing when no customer was attached', () => {
    const typed: BilledParty = { name: 'Some Shop', email: 'hello@someshop.test' };
    expect(clearedFromCustomer(typed, null)).toEqual(typed);
  });

  it('followed by a pick lands entirely on the new customer', () => {
    // The whole journey, as she actually performs it.
    const afterClear = clearedFromCustomer(WREN, WREN);
    expect(fillFromCustomer(afterClear, null, MARGUERITE)).toEqual(MARGUERITE);
  });
});
