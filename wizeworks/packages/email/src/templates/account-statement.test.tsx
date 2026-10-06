import { describe, expect, it } from 'vitest';
import { renderTemplate, type TemplateSend } from '../send';
import { TEMPLATE_PROPS } from '../template-fixtures';

// The statement email is read by an accounts-payable clerk who matches every
// open invoice to a purchase order before anything is paid. The B2B page
// promises the buyer's PO number "rides onto the invoice and every statement",
// so this reads the real rendered email and checks that it does.
async function render(overrides: Partial<(typeof TEMPLATE_PROPS)['account-statement']> = {}) {
  const send: TemplateSend = {
    template: 'account-statement',
    to: 'ap@wasatchutility.test',
    props: { ...TEMPLATE_PROPS['account-statement'], ...overrides },
  };
  return renderTemplate(send);
}

describe('the account statement email', () => {
  it('names the shop and the account in the subject, never the platform', async () => {
    const { subject } = await render();
    expect(subject).toBe(
      'Statement for Wasatch Front Utility Contractors, LLC from Gillett Diesel Service, Oct 1, 2026 to Oct 31, 2026'
    );
    expect(subject.toLowerCase()).not.toContain('sparx');
    expect(subject.toLowerCase()).not.toContain('piggles');
  });

  it("lists every open invoice beside the buyer's own PO number", async () => {
    const { text } = await render();
    expect(text).toContain('INV-000001, your PO WFUC-24-0823');
    expect(text).toContain('INV-000003, your PO WFUC-24-0817');
  });

  it('says how late each one is, and what is late overall', async () => {
    const { text } = await render();
    expect(text).toContain('Due Oct 2, 2026, 29 days late');
    expect(text).toContain('Due Nov 1, 2026');
    expect(text).toContain('$678.00 is late');
    expect(text).toContain('How late: Not yet due $4,075.60, 1 to 30 days late $678.00.');
  });

  it('opens on the start of the period and closes on the end', async () => {
    const { text } = await render();
    expect(text).toContain(
      'You owed $678.00 at the start of the period and $4,753.60 at the end of it. $678.00 of that is due now.'
    );
    expect(text).toContain('Still owed');
  });

  it('prints an invoice with no PO number as its number alone', async () => {
    const { text } = await render({
      openInvoices: [
        { number: 'INV-000005', poNumber: null, dueAt: null, daysLate: 0, amount: 13.84 },
      ],
    });
    expect(text).toContain('INV-000005');
    expect(text).not.toContain('your PO');
    expect(text).toContain('Due on receipt');
  });

  it('links to the statement on the shop site, and draws no button without a link', async () => {
    expect((await render()).html).toContain(
      '/account/b2b/8aa59a36-acc9-455f-b0ba-41c0b66292b9/statement'
    );
    expect((await render({ statementUrl: null })).text).not.toContain('See the full statement');
  });

  it('thanks an account that owes nothing rather than listing an empty table', async () => {
    const { text } = await render({
      opening: 0,
      closing: 0,
      dueNow: 0,
      pastDue: 0,
      aging: [],
      openInvoices: [],
    });
    expect(text).toContain('Nothing is owed on the account. Thank you.');
    expect(text).toContain('Nothing owed');
    expect(text).not.toContain('How late');
  });

  it('points replies at the shop and carries no operator name', async () => {
    const { html, text } = await render();
    expect(text).toContain('Gillett Diesel Service reads every reply to this email.');
    expect(html).not.toContain('WizeWorks');
  });
});
