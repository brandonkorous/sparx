import { describe, expect, it } from 'vitest';

import { emailedLine, emailedToast, placeAndEmailWords } from './purchase-order-email-words';

// What the order screen says about the supplier hearing of an order (sparx
// persona issue 071).
const moment = (iso: string) => iso.slice(0, 10);
const order = {
  number: 'PO-000002',
  supplierName: 'Alliant Power',
  supplierEmail: 'orders@alliantpower.test',
};

describe('whether the supplier was emailed', () => {
  it('says plainly when the order was never emailed from here, without claiming it never went', () => {
    const line = emailedLine({ ...order, emails: [] }, moment);
    expect(line).toBe('Not emailed to Alliant Power from here.');
    expect(line).not.toMatch(/sent to|has gone/i);
  });

  it('names the newest address and time, and counts resends', () => {
    expect(
      emailedLine({ ...order, emails: [{ to: 'a@b.test', at: '2026-10-02T15:00:00Z' }] }, moment)
    ).toBe('Emailed to a@b.test on 2026-10-02.');
    expect(
      emailedLine(
        {
          ...order,
          emails: [
            { to: 'c@d.test', at: '2026-10-03T15:00:00Z' },
            { to: 'a@b.test', at: '2026-10-02T15:00:00Z' },
          ],
        },
        moment
      )
    ).toBe('Emailed to c@d.test on 2026-10-03. Sent 2 times in all.');
  });
});

describe('placing, with or without the email', () => {
  it('promises the email only when it will go', () => {
    expect(placeAndEmailWords(order, true).confirmLabel).toBe('Place and email it');
    expect(placeAndEmailWords(order, true).after).toContain('orders@alliantpower.test');
    expect(placeAndEmailWords(order, false).confirmLabel).toBe('Place the order');
    expect(placeAndEmailWords(order, false).after).toContain('Nothing goes to Alliant Power');
  });

  it('never promises an email to a supplier with no address, even when asked to', () => {
    const words = placeAndEmailWords({ ...order, supplierEmail: null }, true);
    expect(words.confirmLabel).toBe('Place the order');
    expect(words.after).not.toContain('by email');
  });

  it('says where the order went', () => {
    expect(emailedToast(order, 'orders@alliantpower.test').title).toBe(
      'PO-000002 emailed to orders@alliantpower.test'
    );
  });
});
