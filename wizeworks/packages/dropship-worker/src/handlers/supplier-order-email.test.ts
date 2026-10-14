import { describe, expect, it } from 'vitest';
import { supplierOrderEmail } from './supplier-order-email.js';

// The order a business's own supplier gets by email when a customer buys a
// product that supplier ships (sparx persona issue 171).
const base = {
  fromName: 'Gillett Diesel Service',
  supplierName: 'S&B Filters',
  contactName: 'Marco',
  orderNumber: 'O-000023',
  currency: 'USD',
  shipTo: {
    name: 'Renée Castañeda',
    line1: '2210 S 3600 W',
    line2: 'Dock 4',
    city: 'West Valley City',
    region: 'UT',
    postalCode: '84119',
    countryCode: 'US',
    phone: '+1 801-555-0142',
  },
  lines: [
    {
      title: 'S&B 68 Gallon High-Capacity Fuel Tank, 17-26 Ford Powerstroke 6.7L Crew Cab Long Bed',
      supplierSku: '10-1008',
      quantity: 1,
      unitCostCents: 110_000,
    },
  ],
};

describe('supplierOrderEmail', () => {
  it('is the purchase order, to the customer, at what the supplier charges', () => {
    const out = supplierOrderEmail(base);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.props.shipsToCustomer).toBe(true);
    expect(out.props.documentNumber).toBe('O-000023');
    expect(out.props.supplierName).toBe('S&B Filters');
    expect(out.props.contactName).toBe('Marco');
    expect(out.props.lines).toEqual([
      {
        title: base.lines[0].title,
        subtitle: 'their code 10-1008 · 1 × $1,100.00',
        amount: '$1,100.00',
      },
    ]);
    expect(out.props.total).toBe(1100);
    expect(out.props.summary).toEqual([{ label: 'Subtotal', value: '$1,100.00' }]);
  });

  it('gives the full address a carrier needs, phone included', () => {
    const out = supplierOrderEmail(base);
    if (!out.ok) throw new Error('expected an email');
    expect(out.props.shipTo).toEqual({
      name: 'Renée Castañeda',
      lines: [
        '2210 S 3600 W',
        'Dock 4',
        'West Valley City, UT 84119',
        'US',
        'Phone +1 801-555-0142',
      ],
    });
  });

  it('adds the lines up', () => {
    const out = supplierOrderEmail({
      ...base,
      lines: [
        { title: 'Tank', supplierSku: '10-1008', quantity: 2, unitCostCents: 110_000 },
        { title: 'Strap kit', supplierSku: '10-1008-S', quantity: 1, unitCostCents: 4_950 },
      ],
    });
    if (!out.ok) throw new Error('expected an email');
    expect(out.props.total).toBe(2249.5);
    expect(out.props.lines[0].subtitle).toBe('their code 10-1008 · 2 × $1,100.00');
    expect(out.props.lines[0].amount).toBe('$2,200.00');
  });

  // The checkout asks "Anything we should know? Where to leave it…", and the
  // supplier is the one leaving it.
  it('passes on what the customer asked for the delivery', () => {
    const out = supplierOrderEmail({
      ...base,
      customerNote: 'Leave it at the fleet yard gate on 900 W.',
    });
    if (!out.ok) throw new Error('expected an email');
    expect(out.props.note).toBe('Our customer asked: “Leave it at the fleet yard gate on 900 W.”');
    const quiet = supplierOrderEmail({ ...base, customerNote: '  ' });
    if (!quiet.ok) throw new Error('expected an email');
    expect(quiet.props.note).toBeNull();
  });

  // Never the customer's price: the supplier would read what the business
  // charges, and the order would state a figure nobody agreed with them.
  it('waits for the owner when what the supplier charges is not known', () => {
    const out = supplierOrderEmail({
      ...base,
      lines: [{ ...base.lines[0], unitCostCents: null }],
    });
    expect(out).toEqual({
      ok: false,
      reason:
        'What S&B Filters charges you for S&B 68 Gallon High-Capacity Fuel Tank, 17-26 Ford Powerstroke 6.7L Crew Cab Long Bed is not set, so the order was not sent. Set it on the product, then send this order to them yourself and record it here as placed.',
    });
  });

  it('waits for the owner when there is no address to ship to', () => {
    const out = supplierOrderEmail({ ...base, shipTo: { ...base.shipTo, line1: '  ' } });
    expect(out).toEqual({
      ok: false,
      reason:
        'This order has no address to ship to, so it was not sent to S&B Filters. Send it to them yourself, then record it here as placed.',
    });
  });
});
