import { describe, expect, it } from 'vitest';
import { shipToOf } from './ship-to.js';
import { supplierOrderEmail } from './supplier-order-email.js';

// A supplier was sent an address with no name on it (sparx persona issue 214).
// An order stores its address as `AddressSnapshot`; the router read other keys.

describe('shipToOf', () => {
  it('reads the address the way an order stores it', () => {
    expect(
      shipToOf({
        recipientName: 'Renée Castañeda',
        company: 'Wasatch Front Utility Contractors, LLC',
        line1: '2275 S 900 W',
        line2: 'Suite 200',
        city: 'Salt Lake City',
        region: 'UT',
        postalCode: '84119',
        country: 'US',
        phone: '+1 (801) 555-0148',
      })
    ).toEqual({
      name: 'Renée Castañeda',
      company: 'Wasatch Front Utility Contractors, LLC',
      line1: '2275 S 900 W',
      line2: 'Suite 200',
      city: 'Salt Lake City',
      region: 'UT',
      postalCode: '84119',
      countryCode: 'US',
      phone: '+1 (801) 555-0148',
    });
  });

  it('still reads an address in the older shape', () => {
    const out = shipToOf({
      name: 'Brynn O’Hara-Løvdal',
      address1: '45 E Center St',
      city: 'Kanab',
      province: 'UT',
      zip: '84741',
      countryCode: 'US',
    });
    expect(out.name).toBe('Brynn O’Hara-Løvdal');
    expect(out.line1).toBe('45 E Center St');
    expect(out.region).toBe('UT');
    expect(out.postalCode).toBe('84741');
  });

  it('leaves out what is blank rather than sending an empty phone', () => {
    const out = shipToOf({
      recipientName: 'A',
      line1: '1 Main',
      city: 'X',
      country: 'US',
      phone: '',
    });
    expect(out.phone).toBeUndefined();
    expect(out.company).toBeUndefined();
  });

  it('has no street when the order has no address', () => {
    expect(shipToOf(null).line1).toBe('');
  });
});

describe('the supplier’s order', () => {
  it('names who and which company it goes to', () => {
    const out = supplierOrderEmail({
      fromName: 'Gillett Diesel Service Inc.',
      supplierName: 'S&B Filters',
      contactName: null,
      orderNumber: 'O-000023',
      currency: 'USD',
      shipTo: shipToOf({
        recipientName: 'Accounts Payable',
        company: 'Wasatch Front Utility Contractors, LLC',
        line1: '2275 S 900 W',
        city: 'Salt Lake City',
        region: 'UT',
        postalCode: '84119',
        country: 'US',
      }),
      lines: [{ title: 'Tank', supplierSku: '10-1008', quantity: 1, unitCostCents: 110_000 }],
    });
    if (!out.ok) throw new Error('expected an email');
    expect(out.props.shipTo.name).toBe('Accounts Payable');
    expect(out.props.shipTo.lines[0]).toBe('Wasatch Front Utility Contractors, LLC');
  });
});
