// An invoice reminder's button says what it does (sparx persona issue 144).
//
// MEASURED 2026-10-06 on Gillett Diesel's overdue reminder to Wasatch Front:
// "Pay now" opened the trade account's invoice list, where nothing takes a
// payment, for any business. The email that first sends an invoice links to
// the invoice itself and never says "Pay"; the reminders now do the same.

import { describe, expect, it } from 'vitest';

import { getDefaultEmailTemplate } from './default-emails';

const REMINDERS = [
  'b2b-invoice-due',
  'invoicing-reminder',
  'invoicing-overdue',
  'invoicing-overdue-2',
  'invoicing-overdue-final',
] as const;

/** Every button in a silica document, with the data ref of the section it sits in. */
function buttons(doc: unknown): { label: string; href: string; gate: string | null }[] {
  const found: { label: string; href: string; gate: string | null }[] = [];
  const walk = (node: unknown, gate: string | null): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as {
      kind?: string;
      label?: string;
      href?: string;
      data?: { ref?: string };
      children?: unknown[];
      root?: unknown;
    };
    const here = n.data?.ref ?? gate;
    if (n.kind === 'button') found.push({ label: n.label ?? '', href: n.href ?? '', gate: here });
    for (const child of n.children ?? []) walk(child, here);
    if (n.root) walk(n.root, here);
  };
  walk(doc, null);
  return found;
}

describe.each(REMINDERS)('the %s email', (key) => {
  const template = getDefaultEmailTemplate(key)!;

  it('offers no payment the site cannot take', () => {
    const json = JSON.stringify(template.doc) + JSON.stringify(template.tree);
    expect(json).not.toMatch(/Pay (now|invoice)/);
    expect(json).not.toContain('{{invoice.payUrl}}');
  });

  it('opens the invoice, and only when there is a page to open', () => {
    expect(buttons(template.doc)).toEqual([
      { label: 'See your invoice', href: '{{invoice.viewUrl}}', gate: 'invoice.viewUrl' },
    ]);
  });
});
