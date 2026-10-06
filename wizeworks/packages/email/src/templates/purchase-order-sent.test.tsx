import { describe, expect, it } from 'vitest';
import { renderTemplate, type TemplateSend } from '../send';
import { TEMPLATE_PROPS } from '../template-fixtures';

// The supplier reads this to fill an order. Everything they need has to be in
// the body, because there is nothing to click through to (sparx persona
// issue 071).
async function render(overrides: Partial<(typeof TEMPLATE_PROPS)['purchase-order-sent']> = {}) {
  const send: TemplateSend = {
    template: 'purchase-order-sent',
    to: 'orders@valleygrowers.test',
    props: { ...TEMPLATE_PROPS['purchase-order-sent'], ...overrides },
  };
  return renderTemplate(send);
}

describe('the purchase order email', () => {
  it('names the BUSINESS and the order number in the subject, never the platform', async () => {
    const out = await render();
    expect(out.subject).toBe('Purchase order PO-000031 from Rosa Flowers');
    expect(out.subject.toLowerCase()).not.toContain('sparx');
    expect(out.subject.toLowerCase()).not.toContain('piggles');
  });

  it('carries every line with the supplier code, quantity and price', async () => {
    const { text } = await render();
    expect(text).toContain("Garden roses, 'Juliet' peach");
    expect(text).toContain('their code VG-1180');
    expect(text).toContain('120 × $4.75');
    expect(text).toContain('$570.00');
    expect(text).toContain('Eucalyptus, silver dollar');
    expect(text).toContain('$1,302.50');
  });

  it('says where it goes, when it is wanted, the reference and the terms', async () => {
    const { text } = await render();
    expect(text).toContain('Back room, 412 Alder St, Eugene, OR, 97401');
    expect(text).toContain('September 8, 2026');
    expect(text).toContain('Wedding, Sept 12');
    expect(text).toContain('Net 30');
  });

  it('names no date when nobody set one', async () => {
    const { text } = await render({ expectedBy: null });
    expect(text).not.toContain('Wanted by');
  });

  it('greets the contact by name, and the supplier when there is no contact', async () => {
    expect((await render()).text).toContain('Hi Marisol Peña');
    expect((await render({ contactName: null })).text).toContain('Hi Valley Growers Co-op');
  });

  it('invites a reply only when a reply reaches the business', async () => {
    expect((await render()).text).toContain('Rosa Flowers reads every reply to this email.');
    const { text } = await render({ canReply: false });
    expect(text).not.toContain('reply to this email');
    expect(text).toContain('Please contact Rosa Flowers about it.');
  });

  it('prints one full stop after a business name that ends in one', async () => {
    const { text } = await render({ fromName: 'Gillett Diesel Service Inc.' });
    expect(text).not.toContain('Inc..');
  });
});
