// The provisioned defaults, rendered through the real send path (docs/120 slice 6).
//
// These are the emails a tenant gets without ever opening the editor, so they're the
// ones most likely to ship broken and least likely to be looked at. Each assertion
// here corresponds to something that silently produces a WRONG email rather than a
// crash: a conditional that never hides, a line-item table that prints its placeholder
// row, a merge token that renders blank, a button in the wrong brand color.

import { describe, expect, it } from 'vitest';
import {
  addressMergeValue,
  DEFAULT_EMAIL_TEMPLATES,
  getDefaultEmailTemplate,
} from '@wizeworks/builder-schemas';

import { lintEmailRender } from '../lint';
import { renderSilicaEmail } from '../render-silica-email';

const brand = {
  primary: '#0f766e',
  primaryForeground: '#ffffff',
  foreground: '#18181b',
  muted: '#f4f4f5',
  border: '#e4e4e7',
  background: '#ffffff',
  fontBody: 'Georgia, serif',
  siteName: 'Northwind Supply',
};

const docFor = (key: string) => {
  const t = getDefaultEmailTemplate(key);
  if (!t) throw new Error(`no default template "${key}"`);
  return t.doc;
};

// The address in the shape the send resolver really produces (`addressMergeValue`
// over the frozen address's parts). This fixture used to be a bare STRING, which is
// the shape the template assumed and the resolver never sent, so every test here
// passed while every real receipt printed "Shipping to [object Object]" (issue 064).
const HARBOUR_RD = addressMergeValue({
  name: '',
  line1: '12 Harbour Rd',
  line2: '',
  city: 'Portland',
  region: 'OR',
  postalCode: '97201',
  country: '',
  cityStateZip: 'Portland, OR 97201',
  oneLine: '12 Harbour Rd, Portland, OR 97201',
});

const orderData = {
  site: { name: 'Northwind Supply', url: 'https://northwind.test' },
  customer: { firstName: 'Rosa' },
  order: {
    number: '1042',
    total: '$88.00',
    statusUrl: 'https://northwind.test/account/orders',
    shippingAddress: HARBOUR_RD,
    delivery: 'yes',
    pickup: '',
    pickupLater: '',
    pickedUp: '',
    items: [
      { name: 'Cedar planter', quantity: '2', lineTotal: '$60.00' },
      { name: 'Potting soil', quantity: '1', lineTotal: '$28.00' },
    ],
  },
};

describe('the provisioned default emails, on silica', () => {
  it('renders every default to real HTML and plain text', () => {
    for (const t of DEFAULT_EMAIL_TEMPLATES) {
      const out = renderSilicaEmail({ doc: t.doc, to: 'a@b.test', data: {} }, { brand });
      expect(out.html, t.key).toContain('<table');
      expect(out.text.trim(), t.key).not.toBe('');
      // No default may ship an unresolved token to a real inbox.
      expect(out.html, t.key).not.toContain('{{');
      expect(out.subject, t.key).not.toContain('{{');
    }
  });

  it('fills the line-item table once per item, dropping the authored placeholder row', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(out.html).toContain('Cedar planter');
    expect(out.html).toContain('Potting soil');
    expect(out.html).toContain('$60.00');
    // The header row prints exactly once — it lives OUTSIDE the repeating section.
    expect(out.html.match(/Qty/g)).toHaveLength(1);
  });

  it('leaves the amount EMPTY on a row with no money, not a placeholder (issue 057)', () => {
    // A part bought by sending the old part first gets a row under it with the
    // promise and the address and no money at all. The table's amount cell is
    // authored with a placeholder, and an empty value must drop it rather than
    // print a dash, a "$" or "undefined" beside a sentence about a parcel.
    const promise =
      'Bosch injector is ready once your old part arrives. Bring or send it to Doty Diesel.';
    const out = renderSilicaEmail(
      {
        doc: docFor('order-confirmation'),
        to: 'a@b.test',
        data: {
          ...orderData,
          order: {
            ...orderData.order,
            items: [
              { name: 'Bosch injector', quantity: '1', unitPrice: '$600.00', lineTotal: '$600.00' },
              { name: promise, quantity: '1', unitPrice: '', lineTotal: '' },
            ],
          },
        },
      },
      { brand }
    );
    expect(out.text).toContain(promise);
    // The row's text, from the promise to the end of the table.
    const row = out.text.slice(out.text.indexOf(promise) + promise.length);
    const tail = row.slice(0, row.search(/\n\s*\n|Subtotal|Total/));
    expect(tail).not.toMatch(/—|\$|undefined|null/);
    // The placeholder dash is authored once per row; the paid row filled its own,
    // so it must not survive anywhere in the items.
    expect(out.html).not.toContain('>—<');
  });

  it('resolves merge tokens in the subject and the body copy', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(out.subject).toBe('Your order 1042 is confirmed');
    // The greeting resolves in the hero, the order number in the lead line.
    expect(out.html).toContain('Thanks, Rosa');
    expect(out.html).toContain('order 1042');
    // The order total is the strong row of the cost summary — `{{order.total}}` resolves.
    expect(out.html).toContain('$88.00');
  });

  it('falls back when a token has no value, rather than leaving a hole in the copy', () => {
    const out = renderSilicaEmail(
      {
        doc: docFor('order-confirmation'),
        to: 'a@b.test',
        data: { ...orderData, customer: {} },
      },
      { brand }
    );
    // The greeting is `{{customer.greeting}}`, derived to never be blank — with no
    // customer at all it falls back to "there" rather than leaving a hole in the hero.
    expect(out.html).toContain('Thanks, there');
  });

  it('shows an optional card row when its data is present', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    // The shipping address is an optional row of the summary card (label over value),
    // not a prose "Shipping to: …" line — the label and the resolved value both show.
    expect(out.html).toContain('Shipping to');
    expect(out.html).toContain('12 Harbour Rd, Portland, OR 97201');
  });

  it('DROPS an optional card row when its data is absent — no dangling label', () => {
    const { shippingAddress: _omitted, ...order } = orderData.order;
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: { ...orderData, order } },
      { brand }
    );
    expect(out.html).not.toContain('Shipping to');
    expect(out.html).not.toContain('12 Harbour Rd');
    // The rest of the email is unaffected.
    expect(out.html).toContain('Cedar planter');
  });

  it('repaints the authored defaults in the tenant brand', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    // The CTA tracks the brand primary (silica's neutral #111827 must be gone from the
    // LIGHT design), and the body font follows the brand too. #111827 now appears
    // legitimately inside the dark-mode `@media` block (it's the sparx dark `muted`
    // surface any brand without its own dark palette inherits), so strip that block
    // before asserting the light render carries no default black.
    const lightOnly = out.html.replace(/@media \(prefers-color-scheme:dark\)\{[\s\S]*?\}\}/, '');
    expect(out.html).toContain('#0f766e');
    expect(lightOnly).not.toContain('#111827');
    expect(out.html).toContain('Georgia, serif');
  });

  it('renders the summary card: a semantic status cue and a rounded, inset panel', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    // The status cue carries the state in a FIXED semantic color (success green) — the
    // same for every tenant, independent of the brand hue, so "confirmed" never reads
    // as a warning on a red-branded site. It leads the email as a standalone pill above
    // the hero heading now, rather than sitting inside the panel.
    expect(out.html).toContain('✓ Order confirmed');
    expect(out.html).toContain('#15803d');
    // The ship-to card is a rounded, bordered inset panel (silicaui section box-decoration).
    expect(out.html).toContain('border-radius:16px');
  });

  it('renders the order-lifecycle emails: each with its own semantic status cue', () => {
    const refunded = renderSilicaEmail(
      {
        doc: docFor('order-refunded'),
        to: 'a@b.test',
        data: { ...orderData, order: { ...orderData.order, refundTotal: '$88.00' } },
      },
      { brand }
    );
    // Money coming back gets a success cue and the refund amount as the emphasized hero.
    expect(refunded.html).toContain('✓ Refunded');
    expect(refunded.html).toContain('Refund amount');
    expect(refunded.html).toContain('$88.00');

    // Delivered is a success; canceled is an error; payment-failed is a warning.
    const delivered = renderSilicaEmail(
      { doc: docFor('order-delivered'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(delivered.html).toContain('✓ Delivered');

    const cancelled = renderSilicaEmail(
      { doc: docFor('order-cancelled'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(cancelled.html).toContain('Canceled');
    // The FIXED error semantic red, independent of the (teal) brand hue.
    expect(cancelled.html).toContain('#b91c1c');

    const failed = renderSilicaEmail(
      { doc: docFor('payment-failed'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(failed.html).toContain('Action needed');
    expect(failed.html).toContain('Amount due');
  });

  it('drops the cancellation reason row when no reason is given', () => {
    const withReason = renderSilicaEmail(
      {
        doc: docFor('order-cancelled'),
        to: 'a@b.test',
        data: { ...orderData, order: { ...orderData.order, cancelReason: 'Out of stock' } },
      },
      { brand }
    );
    expect(withReason.html).toContain('Reason');
    expect(withReason.html).toContain('Out of stock');

    // Absent reason ⇒ the optional row self-drops, no dangling "Reason" label.
    const noReason = renderSilicaEmail(
      { doc: docFor('order-cancelled'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(noReason.html).not.toContain('Reason');
  });

  it('renders the subscription lifecycle emails with their own status cues', () => {
    const subData = {
      site: { name: 'Northwind Supply' },
      customer: { firstName: 'Rosa' },
      subscription: {
        status: 'active',
        interval: 'every month',
        amount: '$42.00',
        nextOrderDate: 'Aug 15, 2026',
        manageUrl: 'https://northwind.test/account/subscriptions',
      },
    };

    const confirmed = renderSilicaEmail(
      { doc: docFor('subscription-confirmed'), to: 'a@b.test', data: subData },
      { brand }
    );
    expect(confirmed.html).toContain('✓ Active');
    expect(confirmed.html).toContain('every month');
    expect(confirmed.html).toContain('Aug 15, 2026');

    const failed = renderSilicaEmail(
      { doc: docFor('subscription-payment-failed'), to: 'a@b.test', data: subData },
      { brand }
    );
    expect(failed.html).toContain('Action needed');
    expect(failed.html).toContain('$42.00');

    const cancelled = renderSilicaEmail(
      { doc: docFor('subscription-cancelled'), to: 'a@b.test', data: subData },
      { brand }
    );
    expect(cancelled.html).toContain('Canceled');
    expect(cancelled.html).toContain('#b91c1c'); // fixed error red
  });

  it('renders the returns + B2B-order-outcome emails with their status cues', () => {
    const data = {
      site: { name: 'Northwind Supply' },
      customer: { firstName: 'Rosa' },
      order: {
        number: '1042',
        total: '$88.00',
        statusUrl: 'https://northwind.test/account/orders',
      },
      return: {
        outcome: 'refund',
        refundAmount: '$60.00',
        refundMethod: 'your original payment method',
        manageUrl: 'https://northwind.test/account/orders',
      },
    };

    const refunded = renderSilicaEmail(
      { doc: docFor('return-refunded'), to: 'a@b.test', data },
      { brand }
    );
    expect(refunded.html).toContain('✓ Refunded');
    expect(refunded.html).toContain('$60.00');

    const approved = renderSilicaEmail(
      { doc: docFor('b2b-order-approved'), to: 'a@b.test', data },
      { brand }
    );
    expect(approved.html).toContain('✓ Approved');
    expect(approved.html).toContain('$88.00');

    const rejected = renderSilicaEmail(
      { doc: docFor('b2b-order-rejected'), to: 'a@b.test', data },
      { brand }
    );
    expect(rejected.html).toContain('Not approved');
    expect(rejected.html).toContain('#b91c1c'); // fixed error red
  });

  // Sparx persona issue 087. The person who turns an order down types a reason,
  // and the buyer was never shown it, or who it was; and the email sent them to
  // their account manager even when their own colleague, the approver on their
  // account, was the one who said no.
  describe('a turned-down wholesale order', () => {
    const base = {
      site: { name: 'Northwind Supply' },
      customer: { firstName: 'Rosa' },
      order: { number: '1042', total: '$1,208.00', statusUrl: 'https://northwind.test/o/1' },
    };
    const render = (approval: Record<string, string>) =>
      renderSilicaEmail(
        { doc: docFor('b2b-order-rejected'), to: 'a@b.test', data: { ...base, approval } },
        { brand }
      );

    it('names who turned it down and why, and points at the account manager', () => {
      const out = render({
        decidedBy: 'Doty Brown',
        reason: 'This needs a larger credit limit first.',
        byBusiness: 'yes',
        byAccount: '',
      });
      expect(out.text).toContain('Turned down by');
      expect(out.text).toContain('Doty Brown');
      expect(out.text).toContain('This needs a larger credit limit first.');
      expect(out.text).toContain('Reach out to your account manager');
      expect(out.text).not.toContain('approves orders at your company');
    });

    it('sends them to their own colleague, not the account manager, when that is who said no', () => {
      const out = render({
        decidedBy: 'Teodora Vukić-Hale',
        reason: '',
        byBusiness: '',
        byAccount: 'yes',
      });
      expect(out.text).toContain('Teodora Vukić-Hale');
      expect(out.text).toContain(
        'Someone who approves orders at your company turned this one down'
      );
      expect(out.text).not.toContain('account manager');
    });

    it('drops the reason row when none was given, rather than printing a heading over nothing', () => {
      const out = render({ decidedBy: 'Doty Brown', reason: '', byBusiness: 'yes', byAccount: '' });
      expect(out.text).not.toContain('Why');
      expect(out.text).not.toContain('{{');
    });

    it('still reads right for an old turn-down that carried neither name nor reason', () => {
      const out = renderSilicaEmail(
        { doc: docFor('b2b-order-rejected'), to: 'a@b.test', data: base },
        { brand }
      );
      expect(out.text).toContain('wasn’t approved');
      expect(out.text).not.toContain('Turned down by');
      expect(out.text).not.toContain('{{');
    });
  });

  it('composes the legal footer onto a marketing default, and not a transactional one', () => {
    const marketing = renderSilicaEmail(
      {
        doc: docFor('win-back'),
        to: 'a@b.test',
        data: orderData,
        marketing: true,
        compliance: { unsubscribeUrl: 'https://n.test/u/1', physicalAddress: '9 Dock St' },
      },
      { brand }
    );
    expect(marketing.html).toContain('Unsubscribe');
    expect(marketing.html).toContain('9 Dock St');

    const transactional = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(transactional.html).not.toContain('Unsubscribe');
  });
});

// Persona issue 064: a counter sale's receipt said "We'll email you tracking the
// moment it ships" and "Shipping to [object Object]", and the hand-over email told the
// customer who carried it out of the shop that it "has been delivered". Each case is
// rendered through the real send path with data in the shape the resolver sends.
describe('a pickup order and a delivered one say different things (issue 064)', () => {
  const pickupData = {
    ...orderData,
    order: {
      ...orderData.order,
      // What the resolver sends for a pickup: no address at all, the pickup flag set,
      // and where to collect it when the business has an address on file.
      shippingAddress: '',
      delivery: '',
      pickup: 'yes',
      pickupLater: 'yes',
      pickedUp: '',
      pickupFrom: '410 Mill St, Lowell, MA 01852',
      deliveredAt: 'Oct 1, 2026',
    },
  };

  it('prints the shipping address as words, never "[object Object]"', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(out.html).toContain('Shipping to');
    expect(out.html).toContain('12 Harbour Rd, Portland, OR 97201');
    expect(out.html).not.toContain('[object Object]');
    expect(out.text).not.toContain('[object Object]');
  });

  it('still prints words for a receipt a tenant edited before the fix', () => {
    // A tenant who edited their receipt keeps the old binding of the WHOLE address,
    // `{{order.shippingAddress}}`. The refresh never touches an edited email, so that
    // binding has to read as the address too.
    const edited = JSON.parse(
      JSON.stringify(docFor('order-confirmation')).replaceAll(
        'order.shippingAddress.oneLine',
        'order.shippingAddress'
      )
    ) as ReturnType<typeof docFor>;
    const out = renderSilicaEmail({ doc: edited, to: 'a@b.test', data: orderData }, { brand });
    expect(out.html).toContain('12 Harbour Rd, Portland, OR 97201');
    expect(out.html).not.toContain('[object Object]');
  });

  it('promises tracking on a delivered order, and nothing about picking it up', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(out.text).toContain('We’ll email you tracking the moment it ships.');
    expect(out.text).toContain('Track your order');
    expect(out.text).not.toContain('pick up');
    expect(out.text).not.toContain('Pick up from');
  });

  it('tells a pickup customer when to come, and where, with no shipping at all', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: pickupData },
      { brand }
    );
    expect(out.text).toContain('We’ll let you know when it’s ready to pick up.');
    expect(out.text).toContain('Pick up from');
    expect(out.text).toContain('410 Mill St, Lowell, MA 01852');
    expect(out.text).toContain('View your order');
    expect(out.text).not.toContain('tracking');
    expect(out.text).not.toContain('Track your order');
    expect(out.text).not.toContain('Shipping to');
    expect(out.html).not.toContain('[object Object]');
  });

  it('thanks a counter customer who already has it, and promises nothing', () => {
    // A counter sale is handed over before its receipt is built: no promise to tell
    // them when it is ready, no address to come to (the resolver sends neither).
    const out = renderSilicaEmail(
      {
        doc: docFor('order-confirmation'),
        to: 'a@b.test',
        data: {
          ...pickupData,
          order: { ...pickupData.order, pickupLater: '', pickedUp: 'yes', pickupFrom: '' },
        },
      },
      { brand }
    );
    expect(out.text).toContain('Order 1042 is yours. Thanks for coming in.');
    expect(out.text).not.toContain('ready to pick up');
    expect(out.text).not.toContain('Pick up from');
    expect(out.text).not.toContain('tracking');
  });

  it('drops "Pick up from" when the business has no address on file', () => {
    const out = renderSilicaEmail(
      {
        doc: docFor('order-confirmation'),
        to: 'a@b.test',
        data: { ...pickupData, order: { ...pickupData.order, pickupFrom: '' } },
      },
      { brand }
    );
    expect(out.text).toContain('ready to pick up');
    expect(out.text).not.toContain('Pick up from');
  });

  it('says a pickup order was picked up, not delivered', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-delivered'), to: 'a@b.test', data: pickupData },
      { brand }
    );
    expect(out.text).toContain('You picked up order 1042');
    expect(out.html).toContain('✓ Picked up');
    expect(out.text).toContain('Oct 1, 2026');
    expect(out.text).not.toMatch(/delivered/i);
    expect(out.subject).toBe('Your order 1042 is in your hands');
  });

  it('still says a sent order was delivered', () => {
    const out = renderSilicaEmail(
      {
        doc: docFor('order-delivered'),
        to: 'a@b.test',
        data: { ...orderData, order: { ...orderData.order, deliveredAt: 'Oct 1, 2026' } },
      },
      { brand }
    );
    expect(out.text).toContain('Your order 1042 has been delivered.');
    expect(out.html).toContain('✓ Delivered');
    expect(out.text).not.toMatch(/picked up/i);
    expect(out.subject).toBe('Your order 1042 is in your hands');
  });
});

// The defaults, put through the SAME lint the builder shows a tenant.
//
// `lint.test.ts` exercises `lintEmailRender` against docs written to trip each check,
// which proves the checks work but says nothing about what sparx actually ships. The
// defaults were rendered here and never linted — so a default could carry an `error` (no
// preheader, an image with no alt, a bare "click here" link, a merge tag pointing at a
// path that does not exist) while the editor showed the tenant that same failure on an
// email they did not write and cannot be expected to debug.
//
// This is the email analogue of `catalog-sweep.test.ts` for site sections: hold the
// shipped library to the standard the product enforces on everyone else.
describe('the provisioned defaults pass sparx own email lint', () => {
  // `EmailCheckLevel` is `pass | warning | error`. The first cut of this filtered on
  // `'fail'`, which is not one of them — so it matched nothing and the test passed
  // without ever looking at a check. A sweep that cannot go red is worse than no sweep,
  // because it reads like coverage.
  const lintOf = (t: (typeof DEFAULT_EMAIL_TEMPLATES)[number]) => {
    const out = renderSilicaEmail({ doc: t.doc, to: 'a@b.test', data: orderData }, { brand });
    const doc = t.doc as { preheader?: string | null };
    return lintEmailRender({
      doc: t.doc,
      html: out.html,
      subject: out.subject,
      preheader: doc.preheader ?? null,
    });
  };

  it('ships no default with an ERROR-level check', () => {
    const offenders = DEFAULT_EMAIL_TEMPLATES.flatMap((t) =>
      lintOf(t)
        .filter((c) => c.level === 'error')
        .map((c) => `${t.key} · ${c.id}: ${c.title}: ${c.detail}`)
    );
    expect(offenders).toEqual([]);
  });

  it('actually evaluates checks — guards against a vacuous sweep', () => {
    // If the lint ever stops returning checks for these docs (a shape change, an early
    // return), the assertion above would go green for the wrong reason. Pin that it saw
    // real checks, including passing ones.
    const all = DEFAULT_EMAIL_TEMPLATES.flatMap(lintOf);
    expect(all.length).toBeGreaterThanOrEqual(DEFAULT_EMAIL_TEMPLATES.length);
    expect(all.some((c) => c.level === 'pass')).toBe(true);
  });
});
