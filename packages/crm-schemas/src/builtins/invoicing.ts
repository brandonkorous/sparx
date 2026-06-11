// Built-in invoicing templates (docs/87 §3, §5).
//
// Seeded into each tenant on `invoicing` module activation, then fully
// editable — same "own copy per tenant" pattern as the default pipeline. A
// tenant gets a simple two-stage Invoice workflow (default) plus an example
// Service / Repair flow showing the full estimate→paid lifecycle, and a
// starter line-type registry covering the common charge shapes.

import type { InvoiceTemplateNodeInput } from '../invoicing';

export type DocumentStageTypeLiteral = 'draft' | 'open' | 'committed' | 'final' | 'paid' | 'void';

export type LinePricingModeLiteral = 'catalog' | 'markup' | 'labor' | 'flat' | 'pass_through';

export interface DocumentStageTemplate {
  name: string;
  customerLabel: string;
  stageType: DocumentStageTypeLiteral;
  snapshotOnEnter: boolean;
  numberOnEnter: boolean;
  numberPrefix?: string;
  locksEditing: boolean;
  sortOrder: number;
  color?: string;
}

export interface DocumentWorkflowTemplate {
  name: string;
  slug: string;
  isDefault: boolean;
  sortOrder: number;
  stages: DocumentStageTemplate[];
}

export interface DocumentLineTypeTemplate {
  key: string;
  name: string;
  label: string;
  pricingMode: LinePricingModeLiteral;
  defaultTaxable: boolean;
  computation?: string;
  category?: string;
  sortOrder: number;
}

export const DEFAULT_DOCUMENT_WORKFLOWS: DocumentWorkflowTemplate[] = [
  {
    name: 'Invoice',
    slug: 'invoice',
    isDefault: true,
    sortOrder: 0,
    stages: [
      {
        name: 'Invoice',
        customerLabel: 'Invoice',
        stageType: 'open',
        snapshotOnEnter: false,
        numberOnEnter: true,
        numberPrefix: 'INV-',
        locksEditing: false,
        sortOrder: 0,
        color: '#6366F1',
      },
      {
        name: 'Paid',
        customerLabel: 'Receipt',
        stageType: 'paid',
        snapshotOnEnter: true,
        numberOnEnter: false,
        locksEditing: true,
        sortOrder: 1,
        color: '#10B981',
      },
    ],
  },
  {
    name: 'Service / Repair',
    slug: 'service-repair',
    isDefault: false,
    sortOrder: 1,
    stages: [
      {
        name: 'Estimate',
        customerLabel: 'Estimate',
        stageType: 'draft',
        snapshotOnEnter: false,
        numberOnEnter: true,
        numberPrefix: 'EST-',
        locksEditing: false,
        sortOrder: 0,
        color: '#94A3B8',
      },
      {
        name: 'Approved',
        customerLabel: 'Approved Estimate',
        stageType: 'committed',
        snapshotOnEnter: true,
        numberOnEnter: false,
        locksEditing: false,
        sortOrder: 1,
        color: '#06B6D4',
      },
      {
        name: 'In Progress',
        customerLabel: 'Work Order',
        stageType: 'open',
        snapshotOnEnter: false,
        numberOnEnter: false,
        locksEditing: false,
        sortOrder: 2,
        color: '#0EA5E9',
      },
      {
        name: 'Invoiced',
        customerLabel: 'Invoice',
        stageType: 'final',
        snapshotOnEnter: true,
        numberOnEnter: true,
        numberPrefix: 'INV-',
        locksEditing: true,
        sortOrder: 3,
        color: '#6366F1',
      },
      {
        name: 'Paid',
        customerLabel: 'Receipt',
        stageType: 'paid',
        snapshotOnEnter: false,
        numberOnEnter: false,
        locksEditing: true,
        sortOrder: 4,
        color: '#10B981',
      },
    ],
  },
];

export const DEFAULT_DOCUMENT_LINE_TYPES: DocumentLineTypeTemplate[] = [
  {
    key: 'part',
    name: 'Part',
    label: 'Part',
    pricingMode: 'markup',
    defaultTaxable: true,
    category: 'parts',
    sortOrder: 0,
  },
  {
    key: 'labor',
    name: 'Labor',
    label: 'Labor',
    pricingMode: 'labor',
    defaultTaxable: false,
    category: 'labor',
    sortOrder: 1,
  },
  {
    key: 'sublet',
    name: 'Sublet',
    label: 'Sublet / Outside Work',
    pricingMode: 'pass_through',
    defaultTaxable: true,
    category: 'sublet',
    sortOrder: 2,
  },
  {
    key: 'freight',
    name: 'Freight',
    label: 'Freight / Shipping',
    pricingMode: 'pass_through',
    defaultTaxable: false,
    category: 'freight',
    sortOrder: 3,
  },
  {
    key: 'materials',
    name: 'Shop Materials',
    label: 'Shop Materials / Supplies',
    pricingMode: 'flat',
    defaultTaxable: true,
    computation: 'percent_of_labor',
    category: 'materials',
    sortOrder: 4,
  },
  {
    key: 'fee',
    name: 'Fee',
    label: 'Misc / Flat Fee',
    pricingMode: 'flat',
    defaultTaxable: false,
    category: 'fee',
    sortOrder: 5,
  },
  {
    key: 'catalog',
    name: 'Catalog Item',
    label: 'Catalog Item',
    pricingMode: 'catalog',
    defaultTaxable: true,
    category: 'parts',
    sortOrder: 6,
  },
];

// ── Print template (docs/87 §10, Phase 5b) ────────────────────────────────────
//
// The document's printed presentation is ONE BuilderNode tree, AUTHOR-only — a
// peer of the page/email builder trees. The renderer (api-rest's renderInvoiceTree)
// drops the shared print section builders in wherever a DATA-AWARE invoice node
// sits, surrounded by authorable CHROME (heading / prose terms / image / divider /
// containers). These are the data-aware node types the renderer recognises; the
// rest are ordinary builder primitives.
export const INVOICE_STRUCTURED_NODE_TYPES = [
  'InvoiceMasthead', // logo + document head (number/status/dates) — the combined header
  'InvoiceLogo', // seller logo / business name block (split from the masthead)
  'InvoiceMeta', // document head only (number/status/dates)
  'InvoiceParties', // bill-to + ship-to blocks
  'InvoiceLineTable', // the line-items table
  'InvoiceTotals', // subtotal → balance-due summary
  'InvoiceNotes', // the document's own notes
  'InvoicePayments', // the payment ledger
  'InvoiceFooter', // business name + number footer line
] as const;

// The built-in default template — reproduces the code default renderer's layout as
// an editable tree, plus an authorable Prose "terms" block. Seeded (lazy) on the
// tenant's first template list; from then on it's an ordinary editable template.
// Node ids are stable + unique within this tree.
const DEFAULT_TEMPLATE_TREE: InvoiceTemplateNodeInput = {
  id: 'tpl-root',
  type: 'Section',
  name: 'Document',
  class: 'stack gap-lg',
  children: [
    { id: 'tpl-masthead', type: 'InvoiceMasthead', name: 'Header' },
    { id: 'tpl-parties', type: 'InvoiceParties', name: 'Bill to / Ship to' },
    { id: 'tpl-lines', type: 'InvoiceLineTable', name: 'Line items' },
    { id: 'tpl-totals', type: 'InvoiceTotals', name: 'Totals' },
    {
      id: 'tpl-terms',
      type: 'Prose',
      name: 'Terms',
      class: 'notes',
      props: {
        doc: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Payment is due upon receipt unless net terms apply. Thank you for your business.',
                },
              ],
            },
          ],
        },
      },
    },
    { id: 'tpl-notes', type: 'InvoiceNotes', name: 'Document notes' },
    { id: 'tpl-payments', type: 'InvoicePayments', name: 'Payments' },
    { id: 'tpl-footer', type: 'InvoiceFooter', name: 'Footer' },
  ],
};

export interface DocumentTemplateSeed {
  name: string;
  tree: InvoiceTemplateNodeInput;
}

/** The default print template seeded per tenant (docs/87 §10). */
export const DEFAULT_INVOICE_TEMPLATE: DocumentTemplateSeed = {
  name: 'Default',
  tree: DEFAULT_TEMPLATE_TREE,
};
