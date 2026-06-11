// Built-in invoicing templates (docs/87 §3, §5).
//
// Seeded into each tenant on `invoicing` module activation, then fully
// editable — same "own copy per tenant" pattern as the default pipeline. A
// tenant gets a simple two-stage Invoice workflow (default) plus an example
// Service / Repair flow showing the full estimate→paid lifecycle, and a
// starter line-type registry covering the common charge shapes.

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
