import { describe, expect, it } from 'vitest';
import { renderTemplate, type TemplateSend } from '../send';
import { TEMPLATE_PROPS } from '../template-fixtures';

// The person at a trade account who can approve orders, asked to sign off a
// colleague's order. Until this email they were never told anything (sparx
// persona issue 087), so it has to carry enough to decide from the inbox.
async function render(overrides: Partial<(typeof TEMPLATE_PROPS)['order-approval-request']> = {}) {
  const send: TemplateSend = {
    template: 'order-approval-request',
    to: 'imani@harborstreetcafes.test',
    props: { ...TEMPLATE_PROPS['order-approval-request'], ...overrides },
  };
  return renderTemplate(send);
}

describe('the order approval request email', () => {
  it('says whose order it is in the subject, never the platform', async () => {
    const out = await render();
    expect(out.subject).toBe('Order O-000214 from Joel Brandt needs your approval');
    expect(out.subject.toLowerCase()).not.toContain('sparx');
    expect(out.subject.toLowerCase()).not.toContain('piggles');
  });

  it('names who placed it, the total, the limit it went over and the PO number', async () => {
    const { text } = await render();
    expect(text).toContain('Hi Imani Okafor, Joel Brandt placed an order for $1,340.00');
    expect(text).toContain('over your spending limit of $1,000.00');
    expect(text).toContain('HSC-PO-1187');
    expect(text).toContain('Harbor Street Cafés, LLC');
  });

  it('carries every line, so they can decide without opening anything', async () => {
    const { text } = await render();
    expect(text).toContain('House espresso, 5 lb bag');
    expect(text).toContain('20 × $58.00');
    expect(text).toContain('Decaf Colombia, 5 lb bag');
  });

  it('has one button to the order on the business site', async () => {
    const { html } = await render();
    expect(html).toContain('https://ridgelinecoffee.com/account/b2b/acct-7/orders/ord-214');
    expect(html).toContain('Review order');
  });

  it('names no limit when the rule is gone, and no PO when there is none', async () => {
    const { text } = await render({ limit: null, poNumber: null });
    expect(text).not.toContain('spending limit');
    expect(text).not.toContain('PO number');
  });

  it('says when the business has to sign it too', async () => {
    expect((await render()).text).toContain('It goes ahead as soon as you approve it.');
    const { text } = await render({ businessToo: true });
    expect(text).toContain('Ridgeline Coffee Roasters also signs off this order');
    expect(text).not.toContain('as soon as you approve it');
  });

  it('prints one full stop after a business name that ends in one', async () => {
    const { text } = await render({ fromName: 'Ridgeline Roasting Co.' });
    expect(text).not.toContain('Co..');
  });
});
