// The provisioned defaults, rendered through the real send path (docs/120 slice 6).
//
// These are the emails a tenant gets without ever opening the editor, so they're the
// ones most likely to ship broken and least likely to be looked at. Each assertion
// here corresponds to something that silently produces a WRONG email rather than a
// crash: a conditional that never hides, a line-item table that prints its placeholder
// row, a merge token that renders blank, a button in the wrong brand color.

import { describe, expect, it } from 'vitest';
import { DEFAULT_EMAIL_TEMPLATES, getDefaultEmailTemplate } from '@wizeworks/builder-schemas';

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

const orderData = {
  site: { name: 'Northwind Supply', url: 'https://northwind.test' },
  customer: { firstName: 'Rosa' },
  order: {
    number: '1042',
    total: '$88.00',
    statusUrl: 'https://northwind.test/account/orders',
    shippingAddress: '12 Harbour Rd, Portland, OR 97201',
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

    // Delivered is a success; cancelled is an error; payment-failed is a warning.
    const delivered = renderSilicaEmail(
      { doc: docFor('order-delivered'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(delivered.html).toContain('✓ Delivered');

    const cancelled = renderSilicaEmail(
      { doc: docFor('order-cancelled'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(cancelled.html).toContain('Cancelled');
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
    expect(cancelled.html).toContain('Cancelled');
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
        .map((c) => `${t.key} · ${c.id} — ${c.title}: ${c.detail}`)
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
