// The builder-authored print template renderer (docs/87 §10 Phase 5b) — a pure
// function, so unit-tested directly: it renders the data-aware invoice nodes
// through the shared section builders, resolves bound chrome leaves against the
// document scope, serializes Prose, lays out containers, and ignores unknown nodes.

import { describe, expect, it } from 'vitest';
import type { BuilderNode } from '@wizeworks/builder-schemas';
import { DEFAULT_INVOICE_TEMPLATE } from '@wizeworks/crm-schemas/builtins';
import type { BillingRenderData } from '@wizeworks/crm';

import { renderInvoiceTree } from '../../src/lib/invoice-tree-render.js';

const DATA: BillingRenderData = {
  title: 'Invoice',
  number: 'INV-000123',
  status: 'unpaid',
  currency: 'USD',
  issuedAt: '2026-06-01T00:00:00.000Z',
  dueAt: null,
  validUntil: null,
  billTo: { heading: 'Bill to', name: 'Acme Co', lines: ['acme@example.com'] },
  shipTo: null,
  lines: [
    {
      typeLabel: 'Part',
      description: 'Fuel injector',
      quantity: 2,
      unitPrice: 150,
      lineTotal: 300,
      taxable: true,
    },
  ],
  totals: {
    subtotal: 300,
    discountTotal: 0,
    taxTotal: 26.25,
    taxRate: 0.0875,
    shippingTotal: 0,
    surchargeTotal: 0,
    total: 326.25,
    depositTotal: 0,
    amountPaid: 0,
    balance: 326.25,
  },
  notes: 'Net 30. Thank you.',
};

describe('renderInvoiceTree', () => {
  it('renders the built-in default template — every section, the prose terms, the footer', () => {
    const tree = DEFAULT_INVOICE_TEMPLATE.tree as unknown as BuilderNode;
    const html = renderInvoiceTree(tree, DATA, { businessName: 'Gillett Diesel' });

    expect(html).toContain('<!DOCTYPE html>');
    // Masthead (seller + doc head)
    expect(html).toContain('Gillett Diesel');
    expect(html).toContain('INV-000123');
    // Parties + line table + totals (shared builders)
    expect(html).toContain('Acme Co');
    expect(html).toContain('Fuel injector');
    expect(html).toContain('$326.25');
    expect(html).toContain('Balance due');
    // Authored Prose terms block (the default seed copy)
    expect(html).toContain('Payment is due upon receipt');
    // Document notes (InvoiceNotes node) + footer (InvoiceFooter node)
    expect(html).toContain('Net 30. Thank you.');
    expect(html).toContain('class="footer"');
  });

  it('resolves a bound chrome leaf against the document scope', () => {
    const tree: BuilderNode = {
      id: 'r',
      type: 'Section',
      props: {},
      children: [
        { id: 'h', type: 'Heading', props: { level: 'h1' }, binding: { path: 'document.number' } },
        { id: 't', type: 'Text', props: { text: 'Static text' } },
      ],
    };
    const html = renderInvoiceTree(tree, DATA, {});
    expect(html).toContain('<h1 class="tpl-heading">INV-000123</h1>');
    expect(html).toContain('Static text');
  });

  it('lays a flex-row container side by side', () => {
    const tree: BuilderNode = {
      id: 'r',
      type: 'Row',
      class: 'flex-row',
      props: {},
      children: [
        { id: 'a', type: 'InvoiceLogo', props: {} },
        { id: 'b', type: 'InvoiceMeta', props: {} },
      ],
    };
    const html = renderInvoiceTree(tree, DATA, { businessName: 'Acme' });
    expect(html).toContain('class="ibx-row"');
    expect(html).toContain('masthead-seller');
    expect(html).toContain('doc-head');
  });

  it('serializes a static Prose node and ignores unknown node types', () => {
    const tree: BuilderNode = {
      id: 'r',
      type: 'Section',
      props: {},
      children: [
        {
          id: 'p',
          type: 'Prose',
          props: {
            doc: {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello terms' }] }],
            },
          },
        },
        { id: 'x', type: 'SomethingUnknown', props: {} },
      ],
    };
    const html = renderInvoiceTree(tree, DATA, {});
    expect(html).toContain('invoice-prose');
    expect(html).toContain('Hello terms');
    expect(html).not.toContain('SomethingUnknown');
  });
});
